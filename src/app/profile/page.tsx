"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { friendlyTimestamp } from "@/lib/dates";
import { STORE_NAMES, isStoreManaged, api, apiErrorMessage, setToken } from "@/lib/api";
import { Button, Loading, TextField, cx } from "@/components/ui";
import { useDialog } from "@/components/dialog";
import {
  cancelSubscription,
  formatMoney,
  getSubscription,
  intervalWords,
  resumeSubscription,
  type SubscriptionSummary,
} from "@/lib/stripe";

/* The KEYS are the backend's role values and must stay as they are — they come
   from the database and the auth routes. Only the labels shown to people change. */
const ROLE_LABELS: Record<string, string> = {
  individual: "Individual",
  employee: "Team Member",
  company_admin: "Company admin",
};

function ProfileInner() {
  const { user, company, signOut, deleteAccount } = useAuth();
  const dialog = useDialog();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /**
   * Two steps on purpose. This is the only irreversible action in the app — it
   * hard-deletes the account and every pillar, with no history to restore from
   * (App Store policy requires the hard delete). A single confirm put the
   * destructive button under the Enter key the instant the dialog opened, which
   * is the reflex after any dialog appears.
   *
   * So: confirm, then TYPE the word. Typing cannot happen by reflex.
   */
  const confirmDelete = async () => {
    if (
      !(await dialog.confirm("Delete your account?", {
        body: "This permanently deletes your account and all your pillar data. This cannot be undone.",
        confirmLabel: "Continue",
        danger: true,
      }))
    ) {
      return;
    }
    const typed = await dialog.prompt("Type DELETE to confirm", {
      placeholder: "DELETE",
      confirmLabel: "Delete account",
    });
    // Cancelling the prompt returns null; anything but the exact word aborts.
    if (typed?.trim().toUpperCase() !== "DELETE") {
      if (typed !== null) {
        await dialog.alert("Account not deleted.", "You need to type DELETE exactly.");
      }
      return;
    }
    setBusy(true);
    try {
      await deleteAccount();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-heading text-[30px] leading-tight text-heading">{user?.fullName}</h1>
      <p className="mt-1.5 text-[13.5px] text-muted">
        {user?.email}
        {ROLE_LABELS[user?.role ?? ""] ? ` · ${ROLE_LABELS[user?.role ?? ""]}` : ""}
        {user?.companyName ? ` · ${user.companyName}` : ""}
      </p>

      {/* Two errands, not one stack: what this account IS on the left, what you
          can change about it on the right. Stacked full-width buttons in an
          840px column were a phone's settings screen. */}
      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        {/* The invite-code card was removed with the company sign-up paths: a
            code is no use when nobody can choose "Join a company" any more.
            Teams are built from Connections, which connect on the spot. */}
        <div className="space-y-5">
          <BillingCard />
        </div>

        <div>
          <PasswordCard />

          <div className="mt-8 space-y-2">
            <Button label="Log out" variant="ghost" onClick={async () => { await signOut(); router.replace("/"); }} />
            <Button label="Delete account" variant="danger" onClick={confirmDelete} loading={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Subscription state, and the one link that manages it.
 *
 * Lives on Profile because Profile is reachable without a subscription — a
 * locked-out user has to be able to get here.
 *
 * A WEB subscription is sold by us through Stripe, so managing it is ours to
 * build: `StripeManage` below does cancel, resume, card and receipts. Only a
 * store-managed one (App Store, Play) links out to its own store.
 */
function BillingCard() {
  const { billing, billingLoading } = useAuth();

  // Silent until known. A card that says "expired" for a second while loading
  // is worse than no card at all.
  if (billingLoading || !billing) return null;
  // Paywall switched off: everyone is in for free, and a card saying "Ended"
  // with a link to a checkout that is not live would only alarm people.
  if (!billing.enforced) return null;

  const paid = Boolean(billing.entitled && billing.store);
  const label = !billing.entitled
    ? "Ended"
    : billing.state === "in_grace_period" || billing.billing_issue
      ? "Payment problem"
      : paid
        ? billing.will_renew === false
          ? "Cancelled"
          : "Active"
        : billing.state === "trialing"
          ? "Free trial"
          : "Free access";
  const tint = !billing.entitled
    ? "var(--danger)"
    : label === "Payment problem" || label === "Cancelled"
      ? "var(--gold)"
      : "var(--p3)";
  const when = friendlyTimestamp(billing.until);
  const grantUntil = billing.grant?.until ? friendlyTimestamp(billing.grant.until) : null;

  let detail: string;
  if (!billing.entitled) {
    detail = when ? `Ended ${when}.` : "No active subscription.";
  } else if (paid) {
    const via = `Subscribed through ${STORE_NAMES[billing.store ?? "other"]}`;
    detail =
      label === "Payment problem"
        ? `${via}. The last payment failed. Update your payment method to keep access.`
        : billing.will_renew === false
          ? `${via}. Auto-renew is off; access ends ${when ?? "at the end of the period"}.`
          : when
            ? `${via}. Renews ${when}.`
            : `${via}.`;
    if (billing.grant) {
      detail += grantUntil ? ` You also have free access until ${grantUntil}.` : " You also have permanent free access.";
    }
  } else if (billing.state === "trialing") {
    detail = when ? `Your trial runs until ${when}.` : "You are on a free trial.";
  } else {
    detail = when ? `Free access until ${when}.` : "You have permanent access.";
  }

  const storeManaged = paid && isStoreManaged(billing.store);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-heading text-[12px] uppercase tracking-widest text-muted">
        Subscription
        {billing.is_sandbox ? <span className="ml-2 normal-case tracking-normal text-gold">(test)</span> : null}
      </h2>
      <p className="mt-1.5 font-heading text-[20px]" style={{ color: tint }}>
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{detail}</p>

      {storeManaged ? (
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Manage or cancel it in {STORE_NAMES[billing.store ?? "other"]} on the device you
          subscribed with.
        </p>
      ) : null}
      {/* Only a STORE-managed subscription links out. A web one is sold by us
          through Stripe and managed below, in our own UI — `management_url` on
          those rows is a leftover RevenueCat portal link, and rendering it put
          two "Manage subscription" buttons side by side, one of which led
          somewhere that no longer knows about the subscription. */}
      {storeManaged && billing.can_manage && billing.management_url ? (
        <a
          href={billing.management_url}
          target="_blank"
          rel="noreferrer noopener"
          className="tap-row mt-3 inline-flex rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
        >
          Open {STORE_NAMES[billing.store ?? "other"]}
        </a>
      ) : !paid ? (
        <Link
          href="/pricing"
          className="tap-row mt-3 inline-flex rounded-lg border border-gold px-3 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/8"
        >
          {billing.entitled ? "Subscribe" : "See plans"}
        </Link>
      ) : null}

      {/* A web subscription is managed HERE, in our own UI, because we sell it
          ourselves through Stripe — there is no store page to send people to.
          A store-managed one (App Store, Play) still goes to its own store. */}
      {paid && !storeManaged ? <StripeManage /> : null}
    </div>
  );
}

/**
 * Cancel, resume, change the card, and the receipts.
 *
 * Loaded on demand rather than with the page: it costs three Stripe calls, and
 * most visits to Profile are not about billing. Everything here is also written
 * by Stripe's webhook, so this only ever ASKS Stripe to change something and
 * then re-reads the answer — it never decides access itself.
 */
function StripeManage() {
  const { refreshBilling } = useAuth();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<SubscriptionSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setSub(await getSubscription());
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load your subscription."));
    }
  };

  const act = async (run: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await run();
      await load();
      await refreshBilling();
    } catch (err) {
      setError(apiErrorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void load();
        }}
        className="tap-row mt-3 inline-flex rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
      >
        Manage subscription
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      {error ? (
        <p role="alert" className="mb-3 text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {!sub ? (
        <Loading full={false} label="Loading your subscription" />
      ) : !sub.has_subscription ? (
        <p className="text-[13px] text-muted">No subscription is on file.</p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Plan</dt>
            <dd className="tabular-nums text-ink">
              {formatMoney(sub.amount, sub.currency)} {intervalWords(sub.interval)}
            </dd>
            <dt className="text-muted">Renews</dt>
            <dd className="text-ink">
              {sub.cancel_at_period_end
                ? `No, access ends ${epochDate(sub.current_period_end)}`
                : sub.current_period_end
                  ? epochDate(sub.current_period_end)
                  : "N/A"}
            </dd>
            {sub.cards?.length ? (
              <>
                <dt className="text-muted">Card</dt>
                <dd className="text-ink">
                  {sub.cards[0].brand} ending {sub.cards[0].last4}
                  {sub.cards[0].exp_month
                    ? ` (expires ${sub.cards[0].exp_month}/${sub.cards[0].exp_year})`
                    : ""}
                </dd>
              </>
            ) : null}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {sub.cancel_at_period_end ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(resumeSubscription, "Could not resume your subscription.")}
                className="tap-row rounded-lg border border-gold px-3 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/8 disabled:opacity-60"
              >
                {busy ? "Working…" : "Resume subscription"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  /* Say what cancelling actually does. "Are you sure?" alone
                     leaves people thinking they lose access immediately, and
                     they do not — they keep what they paid for. */
                  const ends = epochDate(sub.current_period_end);
                  const ok = await dialog.confirm(
                    "Cancel your subscription?",
                    {
                      body: ends
                        ? `You keep full access until ${ends}, then it stops renewing. You can resume any time before then.`
                        : "You keep access until the end of the period you have paid for.",
                      confirmLabel: "Cancel subscription",
                      danger: true,
                    },
                  );
                  if (ok) await act(cancelSubscription, "Could not cancel your subscription.");
                }}
                className="tap-row rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft disabled:opacity-60"
              >
                Cancel subscription
              </button>
            )}
          </div>

          {sub.invoices?.length ? (
            <div className="mt-5">
              <h3 className="font-heading text-[11px] uppercase tracking-widest text-muted">
                Receipts
              </h3>
              <ul className="mt-2 space-y-1">
                {sub.invoices.slice(0, 6).map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 text-[13px]">
                    <span className="tabular-nums text-muted">{epochDate(inv.created)}</span>
                    <span className="tabular-nums text-ink">
                      {formatMoney(inv.amount, inv.currency)}
                    </span>
                    {inv.pdf ? (
                      <a
                        href={inv.pdf}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="ml-auto font-semibold text-gold hover:underline"
                      >
                        PDF
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Stripe timestamps are epoch SECONDS; `Date` takes milliseconds. */
function epochDate(seconds: number | null | undefined): string {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The minimum the backend enforces (`ChangePasswordIn`). Stated in the UI so
 *  the rule is visible before the server rejects it, not after. */
const MIN_PASSWORD = 8;

/**
 * Change your password while signed in.
 *
 * Collapsed until asked for: on a settings page every open form reads as
 * something you are expected to fill in, and most visits are not here to change
 * a password.
 *
 * The backend returns a FRESH token, because changing a password bumps
 * `token_version` and evicts every session — including this one. Storing that
 * token is what stops the change logging you out of the device that made it.
 */
function PasswordCard() {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = async () => {
    // Checked here as well as server-side: a mismatch or a short password is
    // worth saying immediately rather than after a round trip.
    if (!current) return setError("Enter your current password.");
    if (next.length < MIN_PASSWORD) return setError(`Your new password needs at least ${MIN_PASSWORD} characters.`);
    if (next !== confirm) return setError("The two new passwords do not match.");
    if (next === current) return setError("The new password must be different from your current one.");

    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; access_token?: string }>("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      // Keep this device signed in. Without it the very next request 401s,
      // because the token that made this change was just invalidated.
      if (res.access_token) setToken(res.access_token);
      reset();
      setOpen(false);
      await dialog.alert("Password changed", "Any other devices have been signed out.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not change your password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 max-w-sm">
      <h2 className="font-heading text-[12px] uppercase tracking-wide text-muted">Password</h2>

      {!open ? (
        <div className="mt-2">
          <Button label="Change password" variant="ghost" onClick={() => setOpen(true)} />
        </div>
      ) : (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextField
            label="Current password"
            value={current}
            onChange={setCurrent}
            type="password"
            autoComplete="current-password"
            maxLength={128}
            placeholder="Your password now"
          />
          <TextField
            label="New password"
            value={next}
            onChange={setNext}
            type="password"
            autoComplete="new-password"
            maxLength={128}
            placeholder={`At least ${MIN_PASSWORD} characters`}
          />
          <TextField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            type="password"
            autoComplete="new-password"
            maxLength={128}
            placeholder="Type it again"
            error={error ?? undefined}
          />
          <div className="space-y-2">
            <Button type="submit" label="Save new password" onClick={() => void submit()} loading={busy} />
            <Button
              label="Cancel"
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            />
          </div>
        </form>
      )}
    </section>
  );
}

export default function Profile() {
  return (
    <AuthGuard>
      <ProfileInner />
    </AuthGuard>
  );
}
