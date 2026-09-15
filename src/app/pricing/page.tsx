"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell, Eagle } from "@/components/shell";
import { Button, Loading } from "@/components/ui";
import { api, apiErrorMessage, type ApiBillingConfig } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Plans, and the way in to checkout.
 *
 * `AuthShell`, not `AuthGuard` — the people who most need this page are the ones
 * without a subscription, and the guard would bounce them to /paywall, which
 * links back here. That loop is the reason verify-email does the same thing.
 *
 * Degrades on purpose. Until a RevenueCat account exists, `/billing/config`
 * answers `enabled: false` and this says so plainly rather than rendering a
 * checkout that cannot work. That is also the state every developer sees.
 */
export default function Pricing() {
  const { user, loading, billing, refreshBilling } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<ApiBillingConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        setConfig(await api.get<ApiBillingConfig>("/billing/config"));
      } catch (err) {
        setError(apiErrorMessage(err, "Could not load the plans. Please try again."));
      } finally {
        setConfigLoading(false);
      }
    })();
  }, [loading, user]);

  if (loading || !user) return <Loading />;

  return (
    <AuthShell>
      <div className="text-center">
        <Eagle size={64} />
        <h1 className="mt-4 font-heading text-[26px] leading-tight text-heading">
          Keep going
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Forty years of business success in three years, structured as five
          pillars.
        </p>
      </div>

      {configLoading ? (
        <Loading full={false} label="Loading plans" />
      ) : error ? (
        <p className="mt-6 text-center text-[13.5px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : !config?.enabled ? (
        /* No RevenueCat account yet. Say so honestly — a disabled button with no
           explanation reads as a bug, and support hears about it. */
        <div className="mt-7 rounded-2xl border border-dashed border-line px-5 py-6 text-center">
          <p className="font-heading text-[15px] text-heading">
            Payments are not switched on yet
          </p>
          <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">
            Subscriptions are coming shortly. Nothing is locked in the meantime,
            and your work is safe.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-3">
          {/* The real packages come from the RevenueCat offering once
              `@revenuecat/purchases-js` is installed and configured with
              `config.public_key`. Until the account exists there is nothing to
              list, and inventing prices here would be a lie on a payment page. */}
          <div className="rounded-2xl border border-line bg-surface p-5 text-center">
            <p className="text-[13.5px] leading-relaxed text-muted">
              Choose a plan to continue. You will be asked for payment details on
              the next step, and can cancel any time.
            </p>
          </div>
          <Button
            label="Continue to checkout"
            onClick={() => {
              // Wired in Phase 3's final step: Purchases.configure(...) then
              // purchase({ rcPackage }). Deliberately not stubbed with a fake
              // redirect — a button that pretends to charge someone is worse
              // than one that says it is not ready.
              setError(
                "Checkout is not connected yet. This arrives with the RevenueCat account.",
              );
            }}
          />
        </div>
      )}

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
