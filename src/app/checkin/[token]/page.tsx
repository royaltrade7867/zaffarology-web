"use client";

/**
 * The daily check-in, opened straight from a reminder email.
 *
 * NO LOGIN. The signed token in the URL is the credential, so this page sits
 * outside `AuthGuard` entirely and must never assume a signed-in user.
 *
 * Designed for the one minute it actually gets: a phone, at 6am, before work.
 * Two fields, one button, nothing else on screen. The morning field is
 * autofocused when empty, because that is what the reminder asked for; in the
 * evening the plan is already filled and focus moves to the achievement.
 *
 * Saving is explicit rather than automatic. A workbook page with no save
 * button is fine when the user is signed in and the blob syncs; here the
 * person may close the tab the second they finish typing, so they need to see
 * that it was kept.
 */

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { AuthShell, Eagle } from "@/components/shell";
import { Button, Loading, TextArea } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import {
  type CheckinForm,
  longDate,
  openCheckin,
  saveCheckin,
} from "@/lib/checkin";

export default function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [data, setData] = useState<CheckinForm | null>(null);
  const [plan, setPlan] = useState("");
  const [achievement, setAchievement] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    openCheckin(token)
      .then((d) => {
        setData(d);
        setPlan(d.plan);
        setAchievement(d.achievement);
      })
      .catch((err) =>
        setLoadError(
          apiErrorMessage(
            err,
            "This link is no longer valid. Ask for a new one, or sign in to fill in your check in.",
          ),
        ),
      );
  }, [token]);

  /* Anything typed since the last successful save. Used to warn on close, and
     to keep the button meaningful rather than always enabled. */
  const dirty =
    data !== null && (plan !== data.plan || achievement !== data.achievement);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* A local draft, because `beforeunload` does not fire reliably on a phone.
     The real loss path here is someone typing at 6am, switching apps, and the
     OS reclaiming the tab: no unload event is delivered, and the text is gone.
     Kept per token so two people on one device never see each other's draft,
     and cleared the moment a save succeeds. localStorage can throw in a
     private window, so every access is guarded and the page works without it. */
  const draftKey = `zaff-checkin-draft:${token}`;

  useEffect(() => {
    if (!data || !data.editable) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { plan?: string; achievement?: string };
      // Only restore over what the server has if the draft is actually newer
      // text, never blanking something already saved.
      if (draft.plan && draft.plan !== data.plan) setPlan(draft.plan);
      if (draft.achievement && draft.achievement !== data.achievement) {
        setAchievement(draft.achievement);
      }
    } catch {
      // No storage, or unparseable. The server copy stands.
    }
    // Runs once per loaded day, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.date]);

  useEffect(() => {
    if (!data?.editable) return;
    try {
      if (dirty) {
        window.localStorage.setItem(draftKey, JSON.stringify({ plan, achievement }));
      } else {
        window.localStorage.removeItem(draftKey);
      }
    } catch {
      // Storage unavailable. Losing a draft is bad; crashing the form is worse.
    }
  }, [plan, achievement, dirty, data?.editable, draftKey]);

  /* Something worth saving. An untouched, empty form would otherwise save two
     blank strings and answer "Kept", which tells the person they have checked
     in when they have written nothing. The dashboard already ignores an empty
     row, so this is about not lying to them rather than about the figures. */
  const hasContent = !!(plan.trim() || achievement.trim());

  const submit = async () => {
    if (!data?.editable || !hasContent) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await saveCheckin(token, plan, achievement);
      setData({ ...data, ...updated });
      setPlan(updated.plan);
      setAchievement(updated.achievement);
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, "That did not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  // --- a link that does not work ------------------------------------------
  if (loadError) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <Eagle size={72} />
          <h1 className="font-heading mt-4 text-[24px] text-ink">
            This link has expired
          </h1>
          <p className="text-dim mt-2 leading-relaxed">{loadError}</p>
          <Link
            href="/login"
            className="text-gold mt-5 font-semibold underline underline-offset-4"
          >
            Sign in instead
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (!data) return <Loading label="Opening your check in" />;

  const closed = !data.editable;

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center">
        <Eagle size={64} />
        <p className="text-gold mt-3 text-[12px] font-semibold tracking-widest">
          {closed ? "A PAST DAY" : "TODAY"}
        </p>
        <h1 className="font-heading text-ink mt-1 text-[26px]">
          {longDate(data.date)}
        </h1>
        {data.name ? (
          <p className="text-dim mt-1">Good morning {data.name}.</p>
        ) : null}
      </div>

      {closed ? (
        <p className="border-line bg-surface-deep text-dim mt-6 rounded-lg border px-4 py-3 text-[14px] leading-relaxed">
          This day has closed, so it cannot be changed now. What you wrote is
          below. Your next reminder will open a fresh one.
        </p>
      ) : null}

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextArea
          label="What is the plan today?"
          value={plan}
          onChange={(v) => {
            setPlan(v);
            setSaved(false);
          }}
          rows={4}
          disabled={closed}
          placeholder="The three things that would make today count."
          autoFocus={!closed && !data.plan}
        />

        <TextArea
          label="What did you achieve?"
          value={achievement}
          onChange={(v) => {
            setAchievement(v);
            setSaved(false);
          }}
          rows={4}
          disabled={closed}
          placeholder="Come back this evening and fill this in."
          autoFocus={!closed && !!data.plan && !data.achievement}
        />

        {error ? (
          <p role="alert" className="text-danger mb-3 text-[14px]">
            {error}
          </p>
        ) : null}

        {!closed ? (
          <Button
            type="submit"
            label={saved && !dirty ? "Saved" : "Save my check in"}
            loading={busy}
            disabled={!hasContent || (!dirty && saved)}
            className="w-full"
          />
        ) : null}
      </form>

      {saved && !dirty ? (
        <p role="status" className="text-dim mt-3 text-center text-[14px]">
          Kept. You can come back to this same link this evening to add what you
          achieved.
        </p>
      ) : null}

      <p className="text-muted mt-8 text-center text-[13px] leading-relaxed">
        {data.can_sign_in ? (
          <Link href="/checkin/history" className="underline underline-offset-4">
            See all your check ins
          </Link>
        ) : (
          <>
            No account set up yet? Use the link in your welcome email to choose
            a password.
          </>
        )}
      </p>
    </AuthShell>
  );
}
