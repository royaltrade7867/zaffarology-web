/**
 * RevenueCat's web SDK, behind a small wrapper.
 *
 * Why a wrapper: the SDK is a single process-wide instance, configured once, for
 * ONE App User ID. A browser can see several accounts in a row (sign out, sign
 * in as someone else), and buying under the previous person's ID would hand
 * the subscription to the wrong account. `purchasesFor()` therefore checks the
 * current ID on every call and switches when it differs.
 *
 * Loaded with a dynamic import: only the pricing page needs it, and the rest of
 * the app should not download a payment SDK.
 *
 * The App User ID is always our `users.id` as a string — the same one the phone
 * apps log in with — which is what makes a purchase on any platform unlock all
 * of them.
 */
import type {
  ErrorCode as ErrorCodeT,
  Offering,
  Package,
  Purchases as PurchasesT,
  PurchasesError as PurchasesErrorT,
} from "@revenuecat/purchases-js";

import type { ApiBillingConfig } from "@/lib/api";

type Sdk = typeof import("@revenuecat/purchases-js");

let sdkPromise: Promise<Sdk> | null = null;

function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) {
    sdkPromise = import("@revenuecat/purchases-js").catch((err) => {
      // Let a later attempt retry (a flaky network should not poison the page).
      sdkPromise = null;
      throw err;
    });
  }
  return sdkPromise;
}

/** The SDK, configured for exactly this user. */
export async function purchasesFor(config: ApiBillingConfig): Promise<PurchasesT> {
  if (!config.public_key) throw new Error("Payments are not configured.");
  const { Purchases } = await loadSdk();
  if (!Purchases.isConfigured()) {
    return Purchases.configure({ apiKey: config.public_key, appUserId: config.app_user_id });
  }
  const instance = Purchases.getSharedInstance();
  if (instance.getAppUserId() !== config.app_user_id) {
    await instance.changeUser(config.app_user_id);
  }
  return instance;
}

/** The offering the pricing page shows: the configured one, else the current. */
export async function loadOffering(
  purchases: PurchasesT,
  offeringId: string | null,
): Promise<Offering | null> {
  if (offeringId) {
    const offerings = await purchases.getOfferings({ offeringIdentifier: offeringId, currency: "AUD" });
    return offerings.all[offeringId] ?? offerings.current ?? null;
  }
  // AUD whatever country the visitor is in: the business is Australian.
  const offerings = await purchases.getOfferings({ currency: "AUD" });
  return offerings.current;
}

/* ------------------------------------------------------------ display */

const UNIT_WORDS: Record<string, [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
  year: ["year", "years"],
};

function periodWords(period: { number: number; unit: string } | null | undefined): string | null {
  if (!period) return null;
  const words = UNIT_WORDS[period.unit];
  if (!words) return null;
  return period.number === 1 ? words[0] : `${period.number} ${words[1]}`;
}

export interface PackageView {
  id: string;
  title: string;
  price: string;
  /** "per month", "per year" — null for a one-off purchase. */
  per: string | null;
  /** "7-day free trial", "First month £1.99" — null if none. */
  offer: string | null;
  description: string | null;
}

/** What a customer needs to read about a package, in plain words. */
export function describePackage(pkg: Package): PackageView {
  const product = pkg.webBillingProduct;
  const option = product.defaultSubscriptionOption;
  const per = periodWords(product.period);

  let offer: string | null = null;
  const trial = option?.trial;
  const intro = option?.introPrice;
  if (trial?.period) {
    const n = trial.period.number;
    const unit = UNIT_WORDS[trial.period.unit]?.[0] ?? trial.period.unit;
    offer = `${n}-${unit} free trial`;
  } else if (intro?.price && intro.period) {
    offer = `${intro.price.formattedPrice} for the first ${periodWords(intro.period)}`;
  }

  return {
    id: pkg.identifier,
    title: product.title || product.displayName,
    price: product.currentPrice.formattedPrice,
    per: per ? `per ${per}` : null,
    offer,
    description: product.description,
  };
}

/* ------------------------------------------------------------- errors */

export type PurchaseFailure =
  | { kind: "cancelled" }
  | { kind: "already_owned" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

/**
 * Turn whatever `purchase()` threw into something the page can act on.
 *
 * Cancelling is not an error: the person closed the checkout and should see the
 * plans again, not a red message.
 */
export async function classifyPurchaseError(err: unknown): Promise<PurchaseFailure> {
  let sdk: Sdk | null = null;
  try {
    sdk = await loadSdk();
  } catch {
    sdk = null;
  }
  const PurchasesError = sdk?.PurchasesError as typeof PurchasesErrorT | undefined;
  const ErrorCode = sdk?.ErrorCode as typeof ErrorCodeT | undefined;
  if (PurchasesError && ErrorCode && err instanceof PurchasesError) {
    switch (err.errorCode) {
      case ErrorCode.UserCancelledError:
        return { kind: "cancelled" };
      case ErrorCode.ProductAlreadyPurchasedError:
        return { kind: "already_owned" };
      case ErrorCode.PaymentPendingError:
        return { kind: "pending" };
      case ErrorCode.NetworkError:
        return { kind: "error", message: "Connection lost during checkout. You have not been charged twice. Check your subscription, then try again." };
      case ErrorCode.PurchaseInvalidError:
      case ErrorCode.StoreProblemError:
        return { kind: "error", message: "The payment did not go through. Please check your card details and try again." };
      case ErrorCode.InvalidEmailError:
        return { kind: "error", message: "That email address was not accepted. Please check it and try again." };
      default:
        return { kind: "error", message: err.message || "Checkout failed. Please try again." };
    }
  }
  return {
    kind: "error",
    message: err instanceof Error && err.message ? err.message : "Checkout failed. Please try again.",
  };
}
