/**
 * Stripe, called directly.
 *
 * Replaces `purchases-js` for web purchases. RevenueCat's Stripe checkout sends
 * `ui_mode=embedded`, which Stripe removed in the `dahlia` API line, so it
 * returns 422 on any current account and no purchase can complete. The backend
 * talks to Stripe itself now; this file is the browser half.
 *
 * RevenueCat is NOT gone — it still owns entitlements, and it is what will
 * unify iOS and Android purchases when mobile ships, which Apple requires and
 * Stripe cannot serve. Only the web checkout moved.
 *
 * The publishable key comes from the SERVER, never from a build-time env var:
 * test and live differ, and baking one into the bundle means a rebuild to
 * switch, with the wrong key silently taking fake money in production.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { api } from "@/lib/api";

export interface StripeConfig {
  enabled: boolean;
  publishable_key: string | null;
  price_id: string | null;
  /** Smallest currency unit: 1900 is A$19.00. */
  amount: number | null;
  currency: string | null;
  interval: string | null;
  email: string;
}

export interface CheckoutStart {
  client_secret: string;
  session_id: string;
  publishable_key: string;
  existing_customer: boolean;
}

export interface CardOnFile {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

export interface InvoiceRow {
  id: string;
  amount: number | null;
  currency: string;
  status: string | null;
  /** Epoch seconds. */
  created: number | null;
  pdf: string | null;
}

export interface SubscriptionSummary {
  has_subscription: boolean;
  status?: string;
  cancel_at_period_end?: boolean;
  /** Epoch seconds. */
  current_period_end?: number | null;
  amount?: number | null;
  currency?: string | null;
  interval?: string | null;
  cards?: CardOnFile[];
  invoices?: InvoiceRow[];
}

/* One Stripe instance per key, for the life of the page. `loadStripe` injects a
   script tag, and calling it per render would add one on every keystroke. */
const cache = new Map<string, Promise<Stripe | null>>();

export function stripeFor(publishableKey: string): Promise<Stripe | null> {
  let loading = cache.get(publishableKey);
  if (!loading) {
    loading = loadStripe(publishableKey);
    cache.set(publishableKey, loading);
  }
  return loading;
}

export const getStripeConfig = () => api.get<StripeConfig>("/billing/stripe/config");

export const startCheckout = (returnUrl: string, fullName: string) =>
  api.post<CheckoutStart>("/billing/stripe/checkout", {
    return_url: returnUrl,
    full_name: fullName,
  });

/** Apply a finished checkout now, rather than waiting for the webhook. */
export const syncCheckout = (sessionId?: string) =>
  api.post<unknown>(
    `/billing/stripe/sync${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`,
  );

export const getSubscription = () =>
  api.get<SubscriptionSummary>("/billing/stripe/subscription");

export const cancelSubscription = () => api.post<unknown>("/billing/stripe/cancel");
export const resumeSubscription = () => api.post<unknown>("/billing/stripe/resume");

export const startCardUpdate = () =>
  api.post<{ client_secret: string; publishable_key: string }>("/billing/stripe/card");

export const finishCardUpdate = (paymentMethodId: string) =>
  api.put<{ ok: boolean }>("/billing/stripe/card", { payment_method_id: paymentMethodId });

/**
 * "A$19.00" from 1900 and "AUD".
 *
 * Zero-decimal currencies (JPY and friends) have no minor unit, so dividing by
 * 100 would show ¥10 for a ¥1000 charge.
 */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null || !currency) return "";
  const code = currency.toUpperCase();
  const major = ZERO_DECIMAL.has(code) ? minor : minor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).format(major);
  } catch {
    // An unknown code must still render a price, not an empty string.
    return `${code} ${major.toFixed(ZERO_DECIMAL.has(code) ? 0 : 2)}`;
  }
}

/** "per month" / "per year", from Stripe's interval. */
export function intervalWords(interval: string | null | undefined): string {
  if (!interval) return "";
  return interval === "month" ? "per month" : interval === "year" ? "per year" : `per ${interval}`;
}
