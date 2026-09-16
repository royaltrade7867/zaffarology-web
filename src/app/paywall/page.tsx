"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell, Eagle } from "@/components/shell";
import { Button, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { friendlyTimestamp } from "@/lib/dates";

/**
 * Shown when a trial or subscription has ended.
 *
 * Built on `AuthShell`, NOT `AuthGuard`. The guard is what sends people here, so
 * wrapping this page in it would redirect the paywall to itself forever. Same
 * reason `verify-email` does it this way.
 *
 * Never a dead end: sign out is always reachable, and the page says plainly that
 * nothing has been deleted — because nothing has. Lockout hides the UI; every
 * pillar, note and recording is exactly where it was.
 */
export default function Paywall() {
  const { user, loading, billing, syncBilling, signOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    // Self-dismissing: if access came back (they subscribed, or an admin granted
    // it), leave rather than stranding them on a screen that no longer applies.
    else if (billing?.entitled) router.replace("/home");
  }, [user, loading, billing, router]);

  if (loading || !user) return <Loading />;

  const ended = friendlyTimestamp(billing?.until);
  const [stillLocked, setStillLocked] = useState(false);

  return (
    <AuthShell>
      <div className="text-center">
        <Eagle size={72} />
        <h1 className="mt-4 font-heading text-[26px] leading-tight text-heading">
          {billing?.state === "expired" && billing?.source === "promotional"
            ? "Your free trial has ended"
            : "Your subscription has ended"}
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          {ended ? `Access ended on ${ended}. ` : ""}
          Subscribe to pick up exactly where you left off.
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Nothing has been deleted. Every pillar, note and recording is still
          here, waiting.
        </p>
      </div>

      <div className="mt-7 space-y-2">
        <Button
          label="See plans"
          onClick={() => router.push("/pricing")}
        />
        <Button
          label={checking ? "Checking…" : "I've already subscribed"}
          variant="ghost"
          loading={checking}
          onClick={async () => {
            // For the gap between paying and the webhook landing — or a
            // purchase made in the phone app. Asks the backend to re-read
            // RevenueCat now, rather than trusting the client's own optimism.
            setChecking(true);
            setStillLocked(false);
            try {
              const fresh = await syncBilling();
              if (!fresh?.entitled) setStillLocked(true);
            } finally {
              setChecking(false);
            }
          }}
        />
      </div>

      {stillLocked ? (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-muted" role="status">
          We could not find an active subscription for {user.email}. If you subscribed
          in the phone app, make sure you were signed in with this same account.
        </p>
      ) : null}

      <div className="mt-6 border-t border-line pt-4 text-center">
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/");
          }}
          className="tap-row rounded px-2 text-[13.5px] font-semibold text-muted transition-colors hover:text-heading"
        >
          Use a different account
        </button>
      </div>
    </AuthShell>
  );
}
