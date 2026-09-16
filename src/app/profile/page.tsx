"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { friendlyISO } from "@/lib/dates";
import { Button, cx } from "@/components/ui";
import { useTheme, type ThemeChoice } from "@/lib/theme";
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
        <div className="space-y-5">
          {company && user?.role === "company_admin" ? (
            <div className="rounded-2xl border-[1.5px] border-gold bg-surface p-5">
              <h2 className="font-heading text-[12px] uppercase tracking-widest text-gold">
                Team invite code
              </h2>
              <p className="mt-1.5 font-heading text-[26px] tracking-widest text-gold">
                {company.inviteCode}
              </p>
              <p className="mt-1.5 max-w-[44ch] text-[13px] leading-relaxed text-muted">
                Share this code with your Team Members. They choose &ldquo;Join a company&rdquo; at sign-up.
              </p>
            </div>
          ) : null}

          <BillingCard />
        </div>

        <div>
          <ThemePicker />

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

  const LABEL: Record<string, string> = {
    trialing: "Free trial",
    active: "Active",
    in_grace_period: "Payment problem",
    expired: "Ended",
  };
  const tint =
    billing.state === "expired"
      ? "var(--danger)"
      : billing.state === "in_grace_period"
        ? "var(--gold)"
        : "var(--p3)";
  const when = billing.until ? friendlyISO(billing.until) : null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-heading text-[12px] uppercase tracking-widest text-muted">
        Subscription
      </h2>
      <p className="mt-1.5 font-heading text-[20px]" style={{ color: tint }}>
        {LABEL[billing.state] ?? billing.state}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {billing.state === "expired"
          ? when
            ? `Ended ${when}.`
            : "No active subscription."
          : when
            ? billing.state === "trialing"
              ? `Your trial runs until ${when}.`
              : `Renews ${when}.`
            : "You have permanent access."}
      </p>

      {billing.can_manage && billing.management_url ? (
        <a
          href={billing.management_url}
          target="_blank"
          rel="noreferrer noopener"
          className="tap-row mt-3 inline-flex rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
        >
          Manage subscription
        </a>
      ) : billing.state === "expired" || billing.state === "trialing" ? (
        <Link
          href="/pricing"
          className="tap-row mt-3 inline-flex rounded-lg border border-gold px-3 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/8"
        >
          See plans
        </Link>
      ) : null}
    </div>
  );
}

/** Light / Dark / System, the same three the phone offers. */
function ThemePicker() {
  const { choice, setChoice } = useTheme();
  return (
    <section className="mt-8 max-w-sm">
      <h2 className="font-heading text-[12px] uppercase tracking-wide text-muted">Appearance</h2>
      <div role="group" aria-label="Appearance" className="mt-2 flex gap-2">
        {(
          [
            { k: "light" as const, label: "Light" },
            { k: "dark" as const, label: "Dark" },
            { k: "system" as const, label: "System" },
          ]
        ).map(({ k, label }) => {
          const on = choice === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setChoice(k as ThemeChoice)}
              className={cx(
                "flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors",
                on ? "border-gold text-gold" : "border-line text-muted hover:bg-line-soft",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
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
