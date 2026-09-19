"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Offering, Purchases } from "@revenuecat/purchases-js";

import { Eagle } from "@/components/shell";
import { Check } from "@/components/icons";
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
import { PILLARS } from "@/lib/pillars";
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
 * Plans, current status, and checkout.
 *
 * NOT `AuthShell` (2026-09-19): that is a `max-w-md` auth-form column, and two
 * plans stacked inside 448px cannot be compared — the page read as a form with
 * a price on it. This lays its own page out, so the plans sit side by side from
 * `sm:` and the five pillars can say what is actually being bought.
 *
 * `AuthShell`'s other job — letting an unsubscribed person in — is kept: there
 * is no `AuthGuard` here, because the people who most need this page are the
 * ones without a subscription, and the guard would bounce them to /paywall,
 * which links back here.
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

  const subscribed = phase.kind === "subscribed";

  return (
    /* The page lays itself out rather than borrowing the auth column. Plans need
       to sit beside each other to be compared; everything else reads at a
       book measure. */
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
        {sandbox ? (
          <p className="mt-4 inline-flex rounded-full border border-dashed border-gold px-3 py-1 text-[12px] font-semibold text-gold">
            Test mode: no real charges
          </p>
        ) : null}
      </header>

      {phase.kind === "loading" ? (
        <div className="mt-10">
          <Loading full={false} label="Loading plans" />
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-[14px] font-semibold text-danger" role="alert">
            {phase.message}
          </p>
          <Button label="Try again" variant="ghost" onClick={() => void loadPlans()} />
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

      {phase.kind === "no_plans" ? (
        <p className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-line px-6 py-8 text-center text-[14px] text-muted">
          No plans are available right now. Please try again later.
        </p>
      ) : null}

      {subscribed && billing ? <SubscriptionCard /> : null}

      {phase.kind === "plans" ? (
        <>
          {/* A real radiogroup: arrow keys move between plans and only the
              chosen one is in the tab order, so Tab crosses the group once. */}
          <div
            role="radiogroup"
            aria-label="Plans"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              const list = phase.offering.availablePackages;
              if (list.length < 2) return;
              e.preventDefault();
              const at = list.findIndex((p) => p.identifier === selected);
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
              const next = list[(Math.max(at, 0) + step + list.length) % list.length];
              setSelected(next.identifier);
              /* Focus follows selection inside a radiogroup, or the arrow keys
                 move the tick while the focus ring stays behind. */
              const el = e.currentTarget.querySelector<HTMLElement>(`[data-plan="${next.identifier}"]`);
              el?.focus();
            }}
            className="mt-9 grid gap-3 sm:grid-cols-2"
          >
            {phase.offering.availablePackages.map((pkg) => {
              const view = describePackage(pkg);
              return (
                <PlanCard
                  key={view.id}
                  view={view}
                  on={selected === view.id}
                  onPick={() => setSelected(view.id)}
                />
              );
            })}
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

          <div className="mx-auto mt-6 max-w-md">
            <Button label="Continue to checkout" onClick={() => void checkout()} disabled={!selected} />
            <p className="mt-3 text-center text-[12.5px] leading-relaxed text-muted">
              Card details are handled by our payment provider. Cancel any time.
              One subscription works on the web, iPhone and Android.
            </p>
          </div>

          <WhatYouGet />
        </>
      ) : null}

      {phase.kind === "paying" ? (
        <div className="mt-10">
          <Loading full={false} label="Opening checkout" />
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
              const fresh = await syncBilling();
              if (fresh?.entitled && fresh.store) router.replace("/home");
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
   * What someone already paying needs: where it is billed, what happens next,
   * and the way to change it.
   *
   * It reads `state`, `will_renew` and `billing_issue`, which the page used to
   * ignore — a card that had failed still said "renews on the 3rd".
   */
  function SubscriptionCard() {
    if (!billing) return null;
    const store = STORE_NAMES[billing.store ?? "other"];
    const managed = isStoreManaged(billing.store);

    const trouble = billing.billing_issue;
    const ending = billing.will_renew === false;
    /* One line that is true in every case, rather than always "renews on". */
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
        {/* A state dot, not an icon: the colour IS the status, and it needs no
            second reading. `aria-hidden` because the words below say it. */}
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
        ) : billing.management_url ? (
          <a
            href={billing.management_url}
            target="_blank"
            rel="noreferrer noopener"
            className="tap-row mt-3 inline-flex items-center justify-center rounded-xl border border-line px-4 text-[13.5px] font-semibold text-heading transition-colors hover:bg-line-soft"
          >
            Manage subscription
          </a>
        ) : null}
      </div>
    );
  }
}

/* ------------------------------------------------------------------ plans */

/**
 * One plan, as a radio.
 *
 * The price is the largest thing on the card because it is what the card is
 * for. A chosen plan is marked by BOTH the gold border and a tick — colour
 * alone would be the only signal for someone who cannot see it.
 */
function PlanCard({
  view,
  on,
  onPick,
}: {
  view: ReturnType<typeof describePackage>;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      // Only the selected radio is tabbable; arrow keys move within the group.
      tabIndex={on ? 0 : -1}
      data-plan={view.id}
      onClick={onPick}
      className={cx(
        "group relative flex flex-col rounded-2xl border bg-surface p-5 text-left transition-colors",
        on ? "border-gold" : "border-line hover:bg-line-soft",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-heading text-[13px] uppercase tracking-[0.1em] text-muted">
          {view.title}
        </span>
        <span
          aria-hidden
          className={cx(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            on ? "border-gold bg-gold text-on-gold" : "border-line",
          )}
        >
          {on ? <Check size={12} /> : null}
        </span>
      </span>

      {/* The number is the point of the card. Tabular so the two plans'
          prices line up down the column. */}
      <span className="mt-4 flex items-baseline gap-1.5">
        <span className="font-heading text-[30px] leading-none tabular-nums text-heading">
          {view.price}
        </span>
        {view.per ? <span className="text-[13px] text-muted">{view.per}</span> : null}
      </span>

      {view.offer ? (
        <span className="mt-3 inline-flex self-start rounded-full bg-gold/8 px-2.5 py-1 text-[12px] font-semibold text-gold">
          {view.offer}
        </span>
      ) : null}

      {view.description ? (
        <span className="mt-3 text-[13px] leading-relaxed text-muted">{view.description}</span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------ what you get */

/**
 * What the subscription actually buys: the five pillars, by name.
 *
 * The page sold a price without ever naming the product. These are the real
 * pillars from `PILLARS` — the same names, numbers and accents as the rest of
 * the app — so this cannot drift from what ships.
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
