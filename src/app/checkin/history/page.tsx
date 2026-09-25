"use client";

/**
 * Your own check-in history.
 *
 * Signed in, unlike the form itself, and scoped server-side to the caller, so
 * there is no id in the URL to tamper with. Listed under
 * `OPEN_WITHOUT_SUBSCRIPTION` because a workshop member has the portal without
 * necessarily paying for the five pillars.
 *
 * Reverse chronological, newest first, because the useful question is "have I
 * kept it up lately", not "how did I start".
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/shell";
import { Loading } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { type CheckinHistory, longDate, myCheckinHistory } from "@/lib/checkin";

/**
 * Guarded, unlike the check-in form itself, because this page reads the
 * caller's own rows and needs a real session to know who that is. A signed-out
 * visitor is sent to sign in rather than shown an empty page and a failed
 * request. `/checkin` is in `OPEN_WITHOUT_SUBSCRIPTION`, so being signed in is
 * enough: no subscription is required.
 */
export default function CheckinHistoryPage() {
  return (
    <AuthGuard>
      <History />
    </AuthGuard>
  );
}

function History() {
  const [data, setData] = useState<CheckinHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myCheckinHistory()
      .then(setData)
      .catch((err) =>
        setError(apiErrorMessage(err, "Could not load your check ins.")),
      );
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <p role="alert" className="text-danger">
          {error}
        </p>
      </main>
    );
  }

  if (!data) return <Loading label="Loading your check ins" />;

  const written = data.entries.filter(
    (e) => e.plan.trim() || e.achievement.trim(),
  );

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-gold text-[12px] font-semibold tracking-widest">
        ACCOUNTABILITY
      </p>
      <h1 className="font-heading text-ink mt-1 text-[28px]">Your check ins</h1>
      <p className="text-dim mt-2 leading-relaxed">
        What you planned, and what you achieved. Newest first.
      </p>

      {data.opted_out ? (
        <p className="border-line bg-surface-deep text-dim mt-5 rounded-lg border px-4 py-3 text-[14px] leading-relaxed">
          Your reminders are switched off. You can still record a check in from
          any link you already have. To start the reminders again, ask the
          Zaffarology team to turn them back on.
        </p>
      ) : null}

      {written.length === 0 ? (
        <div className="border-line bg-surface mt-6 rounded-xl border p-6 text-center">
          <p className="font-heading text-ink text-[18px]">Nothing yet</p>
          <p className="text-dim mt-2 leading-relaxed">
            {data.in_cohort
              ? "Your next reminder will have a link to your first one."
              : "You are not in a workshop group at the moment."}
          </p>
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {written.map((e) => (
            <li
              key={`${e.date}-${e.slot}`}
              className="border-line bg-surface rounded-xl border p-5"
            >
              <p className="text-gold text-[12px] font-semibold tracking-widest">
                {longDate(e.date).toUpperCase()}
              </p>
              {e.plan.trim() ? (
                <div className="mt-3">
                  <p className="text-muted text-[13px]">Planned</p>
                  <p className="text-ink mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {e.plan}
                  </p>
                </div>
              ) : null}
              {e.achievement.trim() ? (
                <div className="mt-3">
                  <p className="text-muted text-[13px]">Achieved</p>
                  <p className="text-ink mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {e.achievement}
                  </p>
                </div>
              ) : (
                <p className="text-muted mt-3 text-[14px]">
                  Nothing recorded for the evening.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 text-center">
        <Link href="/home" className="text-gold underline underline-offset-4">
          Back to the app
        </Link>
      </p>
    </main>
  );
}
