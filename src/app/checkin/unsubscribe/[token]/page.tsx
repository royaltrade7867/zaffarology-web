"use client";

/**
 * Stopping the reminder emails.
 *
 * The copy has one job beyond confirming: making clear this is NOT an account
 * deletion. Someone clicking "stop these reminders" in an inbox at 6am has no
 * way of knowing how much else they might be switching off, and the honest
 * answer is nothing. Their account, their password, their pillar data and
 * every check in they have written all stay exactly as they are.
 *
 * Runs on open rather than behind a confirm button. The person already made
 * the decision when they clicked the link in the email, and a second button
 * here reads as the page not having worked.
 */

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { AuthShell, Eagle } from "@/components/shell";
import { Loading } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { unsubscribeReminders } from "@/lib/checkin";

export default function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    unsubscribeReminders(token)
      .then(() => setDone(true))
      .catch((err) =>
        setError(
          apiErrorMessage(
            err,
            "This link is no longer valid. If you are still getting reminders, reply to one and we will stop them.",
          ),
        ),
      );
  }, [token]);

  if (!done && !error) return <Loading label="Stopping your reminders" />;

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <Eagle size={72} />
        {error ? (
          <>
            <h1 className="font-heading text-ink mt-4 text-[24px]">
              This link has expired
            </h1>
            <p className="text-dim mt-2 leading-relaxed">{error}</p>
          </>
        ) : (
          <>
            <p className="text-gold mt-3 text-[12px] font-semibold tracking-widest">
              REMINDERS OFF
            </p>
            <h1 className="font-heading text-ink mt-1 text-[26px]">
              That is done
            </h1>
            <p className="text-dim mt-3 leading-relaxed">
              You will not get any more check in reminders.
            </p>
            <div className="border-line bg-surface-deep text-dim mt-5 rounded-lg border px-4 py-3 text-left text-[14px] leading-relaxed">
              <p className="text-ink font-semibold">Nothing else has changed.</p>
              <p className="mt-1">
                Your account, your password and everything you have already
                written are all still there. This only stops the emails.
              </p>
            </div>
            <p className="text-muted mt-5 text-[14px] leading-relaxed">
              Changed your mind? Ask the Zaffarology team to turn them back on.
            </p>
          </>
        )}
        <Link
          href="/login"
          className="text-gold mt-6 font-semibold underline underline-offset-4"
        >
          Go to Zaffarology
        </Link>
      </div>
    </AuthShell>
  );
}
