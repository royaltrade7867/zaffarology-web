"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
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
        <div>
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
