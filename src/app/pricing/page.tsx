"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Offering, Purchases } from "@revenuecat/purchases-js";

import { AuthShell, Eagle } from "@/components/shell";
import { Button, Loading, cx } from "@/components/ui";
import {
  STORE_NAMES,
  api,
  apiErrorMessage,
  isStoreManaged,
  type ApiBillingConfig,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { friendlyTimestamp } from "@/lib/dates";
import {
  classifyPurchaseError,
  describePackage,
  loadOffering,
  purchasesFor,
} from "@/lib/purchases";

/** How long to wait for a paid purchase to show up as access. */
const ACTIVATION_TIMEOUT_MS = 45_000;
const ACTIVATION_POLL_MS = 2_500;

type Phase =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "subscribed" }
  | { kind: "plans"; offering: Offering }
  | { kind: "no_plans" }
  | { kind: "paying" }
  | { kind: "activating" }
  | { kind: "activation_slow" }
  | { kind: "error"; message: string };

/**
 * Plans, and checkout.
 *
 * `AuthShell`, not `AuthGuard` — the people who most need this page are the ones
 * without a subscription, and the guard would bounce them to /paywall, which
 * links back here.
 *
 * Prices and plans come from RevenueCat's offering, never from this file, so a
 * price change in the dashboard is a price change here. Checkout is RevenueCat
 * Billing's own sheet (card details go to Stripe, never to us).
 *
 * After paying, access is confirmed by OUR backend, not by the SDK's own
 * answer: the backend is what every platform reads, and it may take a few
 * seconds to hear from RevenueCat. This page asks it to re-check and waits.
 *
 * Someone already paying through the App Store or Google Play is not offered a
 * second subscription here — they are told where theirs lives.
 */
export default function Pricing() {
  const { user, loading, billing, billingLoading, refreshBilling, syncBilling } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<ApiBillingConfig | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const purchasesRef = useRef<Purchases | null>(null);
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
    if (!user) router.replace("/login");
    else if (!user.isVerified) router.replace("/verify-email");
  }, [user, loading, router]);

  const paidElsewhere = Boolean(billing?.entitled && billing.store);

  const loadPlans = useCallback(async () => {
    setPhase({ kind: "loading" });
    setNotice(null);
    try {
      const cfg = await api.get<ApiBillingConfig>("/billing/config");
      setConfig(cfg);
      if (!cfg.enabled) {
        setPhase({ kind: "disabled" });
        return;
      }
      const purchases = await purchasesFor(cfg);
      purchasesRef.current = purchases;
      setSandbox(purchases.isSandbox());
      const offering = await loadOffering(purchases, cfg.offering_id);
      if (!offering || offering.availablePackages.length === 0) {
        setPhase({ kind: "no_plans" });
        return;
      }
      setSelected((current) =>
        current && offering.availablePackages.some((p) => p.identifier === current)
          ? current
          : (offering.annual ?? offering.monthly ?? offering.availablePackages[0]).identifier,
      );
      setPhase({ kind: "plans", offering });
    } catch (err) {
      setPhase({
        kind: "error",
        message: apiErrorMessage(err, "Could not load the plans. Check your connection and try again."),
      });
    }
  }, []);

  const userId = user?.id;
  const verified = user?.isVerified;
  // Plans load once per person. Later status changes (the activation poll
  // updates billing) must not reload them underneath someone mid-checkout.
  const loadedFor = useRef<string | null>(null);
  const busy = phase.kind === "paying" || phase.kind === "activating";
  useEffect(() => {
    if (loading || billingLoading || !userId || !verified || busy) return;
    if (paidElsewhere) {
      setPhase({ kind: "subscribed" });
      return;
    }
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    void loadPlans();
  }, [loading, billingLoading, userId, verified, paidElsewhere, busy, loadPlans]);

  /** Wait until the backend reports the purchase as access. */
  const awaitActivation = async (): Promise<boolean> => {
    const deadline = Date.now() + ACTIVATION_TIMEOUT_MS;
    while (aliveRef.current && Date.now() < deadline) {
      const fresh = await syncBilling();
      if (fresh?.entitled && fresh.store) return true;
      await new Promise((r) => setTimeout(r, ACTIVATION_POLL_MS));
    }
    return false;
  };

  const checkout = async () => {
    if (phase.kind !== "plans" || !config || !purchasesRef.current) return;
    const pkg = phase.offering.availablePackages.find((p) => p.identifier === selected);
    if (!pkg) return;
    const offering = phase.offering;
    setNotice(null);
    setPhase({ kind: "paying" });
    try {
      // Re-check the account right before charging: this tab may have been
      // open while someone else signed in on another.
      const purchases = await purchasesFor(config);
      await purchases.purchase({ rcPackage: pkg, customerEmail: config.email });
    } catch (err) {
      const failure = await classifyPurchaseError(err);
      if (failure.kind === "cancelled") {
        setPhase({ kind: "plans", offering });
        return;
      }
      if (failure.kind === "already_owned") {
        setPhase({ kind: "activating" });
        const ok = await awaitActivation();
        if (ok) router.replace("/home");
        else setPhase({ kind: "activation_slow" });
        return;
      }
      if (failure.kind === "pending") {
        setNotice("Your payment is still being confirmed by your bank. Access starts as soon as it clears.");
        setPhase({ kind: "plans", offering });
        return;
      }
      setNotice(failure.message);
      setPhase({ kind: "plans", offering });
      return;
    }

    setPhase({ kind: "activating" });
    const ok = await awaitActivation();
    if (!aliveRef.current) return;
    if (ok) router.replace("/home");
    else setPhase({ kind: "activation_slow" });
  };

  if (loading || !user) return <Loading />;

  return (
    <AuthShell>
      <div className="text-center">
        <Eagle size={64} />
        <h1 className="mt-4 font-heading text-[26px] leading-tight text-heading">
          {phase.kind === "subscribed" ? "You're subscribed" : "Keep going"}
        </h1>
        {phase.kind !== "subscribed" ? (
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Forty years of business success in three years, structured as five
            pillars.
          </p>
        ) : null}
        {sandbox ? (
          <p className="mx-auto mt-3 inline-flex rounded-full border border-dashed border-gold px-3 py-0.5 text-[12px] font-semibold text-gold">
            Test mode — no real charges
          </p>
        ) : null}
      </div>

      {phase.kind === "loading" ? <Loading full={false} label="Loading plans" /> : null}

      {phase.kind === "error" ? (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-[13.5px] font-semibold text-danger" role="alert">
            {phase.message}
          </p>
          <Button label="Try again" variant="ghost" onClick={() => void loadPlans()} />
        </div>
      ) : null}

      {phase.kind === "disabled" ? (
        <div className="mt-7 rounded-2xl border border-dashed border-line px-5 py-6 text-center">
          <p className="font-heading text-[15px] text-heading">Payments are not switched on yet</p>
          <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">
            Subscriptions are coming shortly. Nothing is locked in the meantime,
            and your work is safe.
          </p>
        </div>
      ) : null}

      {phase.kind === "no_plans" ? (
        <p className="mt-7 rounded-2xl border border-dashed border-line px-5 py-6 text-center text-[13.5px] text-muted">
          No plans are available right now. Please try again later.
        </p>
      ) : null}

      {phase.kind === "subscribed" && billing ? (
        <div className="mt-7 rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="text-[14px] leading-relaxed text-heading">
            Your subscription is through {STORE_NAMES[billing.store ?? "other"]}
            {billing.until ? (
              <>
                {billing.will_renew ? " and renews on " : " and runs until "}
                {friendlyTimestamp(billing.until)}
              </>
            ) : null}
            .
          </p>
          {isStoreManaged(billing.store) ? (
            <p className="mt-2 text-[13px] text-muted">
              To change or cancel it, use {STORE_NAMES[billing.store ?? "other"]} on the device you
              subscribed with. It works here too — nothing else to buy.
            </p>
          ) : billing.management_url ? (
            <a
              href={billing.management_url}
              target="_blank"
              rel="noreferrer noopener"
              className="tap-row mt-3 inline-flex rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
            >
              Manage subscription
            </a>
          ) : null}
        </div>
      ) : null}

      {phase.kind === "plans" ? (
        <div className="mt-7 space-y-3">
          <div role="radiogroup" aria-label="Plans" className="space-y-2">
            {phase.offering.availablePackages.map((pkg) => {
              const view = describePackage(pkg);
              const on = selected === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(view.id)}
                  className={cx(
                    "w-full rounded-2xl border bg-surface p-4 text-left transition-colors",
                    on ? "border-gold ring-1 ring-gold" : "border-line hover:bg-line-soft",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-[16px] text-heading">{view.title}</span>
                    <span className="shrink-0 text-[15px] font-semibold text-heading">
                      {view.price}
                      {view.per ? <span className="text-[12.5px] font-normal text-muted"> {view.per}</span> : null}
                    </span>
                  </div>
                  {view.offer ? (
                    <p className="mt-1 text-[12.5px] font-semibold text-gold">{view.offer}</p>
                  ) : null}
                  {view.description ? (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{view.description}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
          {billing?.grant?.kind === "trial" && billing.grant.until ? (
            <p className="text-center text-[12.5px] text-muted">
              Your free trial runs until {friendlyTimestamp(billing.grant.until)}. Subscribing now keeps
              access going without a gap.
            </p>
          ) : null}
          {notice ? (
            <p className="text-center text-[13px] font-semibold text-danger" role="alert">
              {notice}
            </p>
          ) : null}
          <Button label="Continue to checkout" onClick={() => void checkout()} disabled={!selected} />
          <p className="text-center text-[12px] leading-relaxed text-muted">
            Card details are handled by our payment provider. Cancel any time.
            One subscription works on the web, iPhone and Android.
          </p>
        </div>
      ) : null}

      {phase.kind === "paying" ? <Loading full={false} label="Opening checkout" /> : null}

      {phase.kind === "activating" ? (
        <div className="mt-7 text-center">
          <Loading full={false} label="Activating your subscription" />
          <p className="mt-2 text-[13px] text-muted">Payment received. Switching on your access…</p>
        </div>
      ) : null}

      {phase.kind === "activation_slow" ? (
        <div className="mt-7 space-y-3 rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="font-heading text-[15px] text-heading">Payment received</p>
          <p className="text-[13.5px] leading-relaxed text-muted">
            Your access is taking a little longer than usual to switch on. You
            will not be charged again. Check again in a minute.
          </p>
          <Button
            label="Check again"
            onClick={async () => {
              setPhase({ kind: "activating" });
              const fresh = await syncBilling();
              if (fresh?.entitled && fresh.store) router.replace("/home");
              else setPhase({ kind: "activation_slow" });
            }}
          />
        </div>
      ) : null}

      <div className="mt-6 border-t border-line pt-4 text-center">
        <button
          type="button"
          onClick={() => {
            void refreshBilling();
            router.push(billing?.entitled ? "/home" : "/profile");
          }}
          className="tap-row rounded px-2 text-[13.5px] font-semibold text-muted transition-colors hover:text-heading"
        >
          {billing?.entitled ? "Back to the app" : "Back to my profile"}
        </button>
      </div>
    </AuthShell>
  );
}
