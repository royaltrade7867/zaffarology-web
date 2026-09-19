"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { friendlyTimestamp } from "@/lib/dates";
import { STORE_NAMES, isStoreManaged, api, apiErrorMessage, setToken } from "@/lib/api";
import { Button, TextField, cx } from "@/components/ui";
import { useDialog } from "@/components/dialog";

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
 * locked-out user has to be able to get here. RevenueCat hosts the portal
 * (cancel, change card, receipts), so `management_url` is the whole of the
 * "manage" UI; there is nothing to build.
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
      {billing.can_manage && billing.management_url ? (
        <a
          href={billing.management_url}
          target="_blank"
          rel="noreferrer noopener"
          className="tap-row mt-3 inline-flex rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
        >
          {storeManaged ? `Open ${STORE_NAMES[billing.store ?? "other"]}` : "Manage subscription"}
        </a>
      ) : !paid ? (
        <Link
          href="/pricing"
          className="tap-row mt-3 inline-flex rounded-lg border border-gold px-3 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/8"
        >
          {billing.entitled ? "Subscribe" : "See plans"}
        </Link>
      ) : null}
    </div>
  );
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
