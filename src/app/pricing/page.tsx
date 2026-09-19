"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Eagle } from "@/components/shell";
import { Check } from "@/components/icons";
import { StripeCheckout } from "@/components/stripe-checkout";
import { Button, Loading, TextField, cx } from "@/components/ui";
import { STORE_NAMES, apiErrorMessage, isStoreManaged } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { friendlyTimestamp } from "@/lib/dates";
import { PILLARS } from "@/lib/pillars";
import {
  formatMoney,
  getStripeConfig,
  intervalWords,
  syncCheckout,
  type StripeConfig,
} from "@/lib/stripe";

/** How long to wait for a paid purchase to show up as access. */
const ACTIVATION_TIMEOUT_MS = 45_000;
const ACTIVATION_POLL_MS = 2_500;

type Phase =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "subscribed" }
  | { kind: "plan"; config: StripeConfig }
  | { kind: "checkout"; config: StripeConfig }
  | { kind: "activating" }
  | { kind: "activation_slow" }
  | { kind: "error"; message: string };

/**
 * Plans, current status, and checkout.
 *
 * Buys through STRIPE DIRECTLY, not `purchases-js` (19 Sep 2026). RevenueCat's
 * Stripe checkout sends `ui_mode=embedded`, which Stripe removed in the dahlia
 * API line, so it answers 422 on any current account and no purchase can
 * complete. RevenueCat still owns entitlements and will carry iOS and Android
 * purchases when mobile ships — only this screen changed.
 *
 * `AuthShell` is deliberately not used: the people who most need this page are
 * the ones without a subscription, and `AuthGuard` would bounce them to
 * /paywall, which links back here.
 *
 * After paying, access is confirmed by OUR backend, never by the browser. The
 * webhook is what grants it; this page polls until it lands.
 */
export default function Pricing() {
  const { user, loading, billing, billingLoading, refreshBilling, syncBilling } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [fullName, setFullName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Stops the activation poll if the person leaves the page.
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    /* Keep the place through login and verification, so a new sign-up lands
       back here rather than on Home. */
    if (!user || !user.isVerified) {
      const next = `?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      router.replace(`${!user ? "/login" : "/verify-email"}${next}`);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.fullName) setFullName((current) => current || user.fullName);
  }, [user?.fullName]);

  const paid = Boolean(billing?.entitled && billing.store);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const config = await getStripeConfig();
      if (!config.enabled || !config.price_id) {
        setPhase({ kind: "disabled" });
        return;
      }
      setPhase({ kind: "plan", config });
    } catch (err) {
      setPhase({
        kind: "error",
        message: apiErrorMessage(err, "Could not load the plan. Check your connection and try again."),
      });
    }
  }, []);

  const userId = user?.id;
  const verified = user?.isVerified;
  const loadedFor = useRef<string | null>(null);
  const busy = phase.kind === "checkout" || phase.kind === "activating";
  useEffect(() => {
    if (loading || billingLoading || !userId || !verified || busy) return;
    if (paid) {
      setPhase({ kind: "subscribed" });
      return;
    }
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    void load();
  }, [loading, billingLoading, userId, verified, paid, busy, load]);

  /** Wait until the backend reports the purchase as access. */
  const awaitActivation = async (sessionId?: string): Promise<boolean> => {
    const deadline = Date.now() + ACTIVATION_TIMEOUT_MS;
    // Ask the backend to read the session once, so access usually appears
    // before the webhook has even arrived.
    try {
      await syncCheckout(sessionId);
    } catch {
      // The webhook is still coming; polling below will see it.
    }
    while (aliveRef.current && Date.now() < deadline) {
      const fresh = await syncBilling();
      if (fresh?.entitled && fresh.store) return true;
      await new Promise((r) => setTimeout(r, ACTIVATION_POLL_MS));
    }
    return false;
  };

  const beginCheckout = () => {
    if (phase.kind !== "plan") return;
    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.split(" ").length < 2) {
      setNameError("Enter the full name as it appears on the card, first and last name.");
      return;
    }
    setNameError(null);
    setNotice(null);
    setPhase({ kind: "checkout", config: phase.config });
  };

  const onPaid = async (sessionId: string) => {
    setPhase({ kind: "activating" });
    const ok = await awaitActivation(sessionId);
    if (!aliveRef.current) return;
    if (ok) router.replace("/home");
    else setPhase({ kind: "activation_slow" });
  };

  if (loading || !user) return <Loading />;

  const subscribed = phase.kind === "subscribed";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <header className="text-center">
        <Eagle size={64} />
        <h1 className="mt-4 font-heading text-[28px] leading-tight text-heading sm:text-[34px]">
          {subscribed ? "You're subscribed" : "Keep going"}
        </h1>
        {!subscribed ? (
          <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted">
            Forty years of business success in three years, structured as five
            pillars.
          </p>
        ) : null}
      </header>

      {phase.kind === "loading" ? (
        <div className="mt-10">
          <Loading full={false} label="Loading the plan" />
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-[14px] font-semibold text-danger" role="alert">
            {phase.message}
          </p>
          <Button label="Try again" variant="ghost" onClick={() => void load()} />
        </div>
      ) : null}

      {phase.kind === "disabled" ? (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-line px-6 py-8 text-center">
          <p className="font-heading text-[16px] text-heading">Payments are not switched on yet</p>
          <p className="mx-auto mt-2 max-w-[38ch] text-[14px] leading-relaxed text-muted">
            Subscriptions are coming shortly. Nothing is locked in the meantime,
            and your work is safe.
          </p>
        </div>
      ) : null}

      {subscribed && billing ? <SubscriptionCard /> : null}

      {phase.kind === "plan" ? (
        <>
          <div className="mt-9">
            <PlanCard config={phase.config} />
          </div>

          {billing?.grant?.kind === "trial" && billing.grant.until ? (
            <p className="mt-4 text-center text-[13px] text-muted">
              Your free trial runs until {friendlyTimestamp(billing.grant.until)}. Subscribing now
              keeps access going without a gap.
            </p>
          ) : null}

          {notice ? (
            <p
              className="mt-4 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-center text-[13.5px] font-semibold text-danger"
              role="alert"
            >
              {notice}
            </p>
          ) : null}

          <div className="mx-auto mt-6 max-w-md space-y-3">
            <TextField
              label="Full name (as on card)"
              value={fullName}
              onChange={(v) => {
                setFullName(v);
                if (nameError) setNameError(null);
              }}
              autoComplete="cc-name"
              maxLength={120}
              error={nameError ?? undefined}
            />
            <Button label="Continue to checkout" onClick={beginCheckout} />
            <p className="text-center text-[12.5px] leading-relaxed text-muted">
              Card details go straight to Stripe and are never stored by us.
              Cancel any time.
            </p>
          </div>

          <WhatYouGet />
        </>
      ) : null}

      {phase.kind === "checkout" ? (
        <div className="mt-9">
          <StripeCheckout
            fullName={fullName}
            returnUrl={`${window.location.origin}/pricing`}
            onComplete={(sessionId) => void onPaid(sessionId)}
            onError={(message) => {
              setNotice(message);
              setPhase({ kind: "plan", config: phase.config });
            }}
          />
          <div className="mx-auto mt-4 max-w-md text-center">
            <button
              type="button"
              onClick={() => setPhase({ kind: "plan", config: phase.config })}
              className="tap-row rounded px-2 text-[13.5px] font-semibold text-muted transition-colors hover:text-heading"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {phase.kind === "activating" ? (
        <div className="mt-10 text-center">
          <Loading full={false} label="Activating your subscription" />
          <p className="mt-3 text-[14px] text-muted">Payment received. Switching on your access…</p>
        </div>
      ) : null}

      {phase.kind === "activation_slow" ? (
        <div className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-heading text-[16px] text-heading">Payment received</p>
          <p className="text-[14px] leading-relaxed text-muted">
            Your access is taking a little longer than usual to switch on. You
            will not be charged again. Check again in a minute.
          </p>
          <Button
            label="Check again"
            onClick={async () => {
              setPhase({ kind: "activating" });
              const ok = await awaitActivation();
              if (ok) router.replace("/home");
              else setPhase({ kind: "activation_slow" });
            }}
          />
        </div>
      ) : null}

      <div className="mt-10 border-t border-line pt-5 text-center">
        <button
          type="button"
          onClick={() => {
            void refreshBilling();
            router.push(billing?.entitled ? "/home" : "/profile");
          }}
          className="tap-row rounded px-2 text-[13.5px] font-semibold text-muted transition-colors hover:text-heading"
        >
          {billing?.entitled ? "Back to the platform" : "Back to my profile"}
        </button>
      </div>
    </main>
  );

  /* ---------------------------------------------------------------- status */

  /**
   * What someone already paying needs: what happens next, and where to change
   * it. Reads `state`, `will_renew` and `billing_issue` — a card that has
   * failed must not be told its subscription renews normally.
   */
  function SubscriptionCard() {
    if (!billing) return null;
    const store = STORE_NAMES[billing.store ?? "other"];
    const managed = isStoreManaged(billing.store);

    const trouble = billing.billing_issue;
    const ending = billing.will_renew === false;
    const when = billing.until ? friendlyTimestamp(billing.until) : null;
    const lede = trouble
      ? "We could not take the last payment"
      : ending
        ? "Your subscription is ending"
        : billing.state === "trialing"
          ? "You're on a free trial"
          : "Your subscription is active";
    const detail = trouble
      ? `Update your payment method to keep access${when ? `. Access continues until ${when}` : ""}.`
      : ending && when
        ? `It stays on until ${when}, then stops renewing.`
        : when
          ? `It renews on ${when}.`
          : null;

    return (
      <div
        className={cx(
          "mx-auto mt-9 max-w-md rounded-2xl border bg-surface p-6 text-center",
          trouble ? "border-danger" : "border-line",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "inline-block h-2 w-2 rounded-full",
            trouble ? "bg-danger" : ending ? "bg-muted" : "bg-gold",
          )}
        />
        <p
          className={cx(
            "mt-3 font-heading text-[17px] leading-snug",
            trouble ? "text-danger" : "text-heading",
          )}
          role={trouble ? "alert" : undefined}
        >
          {lede}
        </p>
        {detail ? <p className="mt-2 text-[14px] leading-relaxed text-ink">{detail}</p> : null}

        <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
          Billed through {store}.
        </p>

        {managed ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            To change or cancel it, use {store} on the device you subscribed with.
            It works here too, nothing else to buy.
          </p>
        ) : (
          /* Managing a web subscription lives in Profile now, in our own UI,
             rather than on a store's page we do not control. */
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="tap-row mt-3 inline-flex items-center justify-center rounded-xl border border-line px-4 text-[13.5px] font-semibold text-heading transition-colors hover:bg-line-soft"
          >
            Manage subscription
          </button>
        )}
      </div>
    );
  }
}

/* ------------------------------------------------------------------- plan */

/**
 * The one plan, and its price.
 *
 * A single plan does not need a radio group — there is nothing to choose
 * between. It reads as a statement of what the subscription costs.
 */
function PlanCard({ config }: { config: StripeConfig }) {
  const price = formatMoney(config.amount, config.currency);
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gold bg-surface p-6">
      <span className="flex items-start justify-between gap-3">
        <span className="font-heading text-[13px] uppercase tracking-[0.1em] text-muted">
          Zaffarology
        </span>
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold bg-gold text-on-gold"
        >
          <Check size={12} />
        </span>
      </span>

      {/* Tabular so a price change does not shift the layout under it. */}
      <span className="mt-4 flex items-baseline gap-1.5">
        <span className="font-heading text-[34px] leading-none tabular-nums text-heading">
          {price || "—"}
        </span>
        <span className="text-[13px] text-muted">{intervalWords(config.interval)}</span>
      </span>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Every pillar, on the web and on your phone. Cancel whenever you like.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ what you get */

/**
 * What the subscription buys: the five pillars, by name.
 *
 * Read from `PILLARS`, the same source the rest of the app uses, so it cannot
 * drift from what ships.
 */
function WhatYouGet() {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-center font-heading text-[13px] uppercase tracking-[0.14em] text-muted">
        What you get
      </h2>
      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <li key={p.n} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-[1.5px] font-heading text-[12px] tabular-nums"
              style={{ borderColor: p.accent, color: p.accent }}
            >
              {p.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-snug text-heading">
                {p.name}
              </span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{p.tag}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-6 max-w-[54ch] text-center text-[13px] leading-relaxed text-muted">
        Plus notes and voice notes, meeting notes, your team&apos;s progress, and
        PDF reports of any pillar. Everything syncs between the web app and your
        phone.
      </p>
    </section>
  );
}
