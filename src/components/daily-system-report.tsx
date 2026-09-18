"use client";

/**
 * Answering one system's effort and result questions for a day.
 *
 * The questions come from the pillar blob; the answers are rows in their own
 * table, joined by `pair_id`. That id is why the pairs carry one at all —
 * answers keyed by list position would silently re-attach to a different
 * question after a pair was deleted.
 *
 * Ported from `zaffarology-mobileapp/src/components/daily-system-report.tsx`.
 */
import { useEffect, useMemo, useState } from "react";

import { Check, Close } from "@/components/icons";
import { Loading, cx } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { reportError } from "@/lib/error-reporting";
import {
  loadDayReports,
  saveReport,
  type Answer,
  type SystemReport,
} from "@/lib/system-reports-api";
import type { EffortPair } from "@/pillars/schemas/business-systems";

/** The server rejects anything above this (`DAYS_MORE_MAX`), so the field
 *  stops at three digits rather than letting a 4-digit entry bounce back as a
 *  400 the user has to decode. */
const DAYS_MAX = 999;

type Draft = { effort: Answer; result: Answer; days: string; reason: string };

const emptyDraft = (): Draft => ({ effort: "", result: "", days: "", reason: "" });

const fromRow = (r: SystemReport): Draft => ({
  effort: r.effort_done,
  result: r.result_done,
  days: r.days_more == null ? "" : String(r.days_more),
  reason: r.reason,
});

/** Either side answered "no" means the day owes an explanation. */
export const needsReason = (d: Draft): boolean => d.effort === "no" || d.result === "no";

/** Enough to save: nothing answered yet is fine, but a "no" must be explained. */
export const canSave = (d: Draft): boolean => {
  if (!d.effort && !d.result) return false;
  if (!needsReason(d)) return true;
  const n = Number(d.days);
  return (
    d.days.trim() !== "" &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= DAYS_MAX &&
    d.reason.trim() !== ""
  );
};

const ACCENT = "var(--gold)";

export function DailySystemReport({
  systemId,
  pairs,
  date,
  onSaved,
}: {
  systemId: string;
  pairs: EffortPair[];
  /** ISO yyyy-mm-dd */
  date: string;
  onSaved?: () => void;
}) {
  const answerable = useMemo(
    () => pairs.filter((p) => p.effort.trim() || p.result.trim()),
    [pairs],
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    loadDayReports(date, systemId)
      .then((rows) => {
        if (!active) return;
        const next: Record<string, Draft> = {};
        for (const r of rows) next[r.pair_id] = fromRow(r);
        setDrafts(next);
      })
      .catch((err) => {
        if (!active) return;
        setError("Could not load today's answers.");
        reportError(err, { area: "daily-report-load", systemId, date });
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [systemId, date]);

  const draftFor = (id: string): Draft => drafts[id] ?? emptyDraft();

  /** Apply a change, then save when the row is complete enough to be valid. */
  const patch = async (pairId: string, change: Partial<Draft>) => {
    const next: Draft = { ...draftFor(pairId), ...change };
    // Clearing the "no" also clears what it owed, so a stale reason cannot
    // ride along on an answer that no longer needs one.
    if (!needsReason(next)) {
      next.days = "";
      next.reason = "";
    }
    setDrafts((prev) => ({ ...prev, [pairId]: next }));

    if (!canSave(next)) return;
    setSaving(pairId);
    setError(null);
    try {
      await saveReport({
        date,
        systemId,
        pairId,
        effortDone: next.effort,
        resultDone: next.result,
        daysMore: needsReason(next) ? Number(next.days) : null,
        reason: needsReason(next) ? next.reason.trim() : "",
      });
      onSaved?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save that answer. Check your connection."));
      reportError(err, { area: "daily-report-save", systemId, pairId });
    } finally {
      setSaving(null);
    }
  };

  if (!loaded) {
    // The spinning circle the rest of the app uses, rather than a line of text.
    // A plain apostrophe: this is an attribute value, a JS string, so an HTML
    // entity here would be read out literally as "apos".
    return <Loading full={false} label="Loading today's answers" />;
  }

  if (!answerable.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-heading text-[16px] text-heading">No questions yet</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
          Add an effort and a result to this system&apos;s sections 7 and 8, and
          they will show up here to answer each day.
        </p>
      </div>
    );
  }

  return (
    <div>
      {answerable.map((p, i) => {
        const d = draftFor(p.id);
        const owes = needsReason(d);
        const incomplete = owes && !canSave(d);
        return (
          <section
            key={p.id}
            className="mb-4 rounded-2xl border bg-surface p-4"
            style={{ borderColor: incomplete ? "var(--danger)" : "var(--line)" }}
          >
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
              Question {i + 1}
            </p>

            <YesNo
              label="Effort"
              question={p.effort}
              value={d.effort}
              busy={saving === p.id}
              onChange={(v) => patch(p.id, { effort: v })}
            />
            <YesNo
              label="Result"
              question={p.result}
              value={d.result}
              busy={saving === p.id}
              onChange={(v) => patch(p.id, { result: v })}
            />

            {/* A "no" owes an explanation. The server enforces this too — it is
                the workbook's rule, not a UI convention — so asking here just
                means the user is told before the request, not after a 400. */}
            {owes ? (
              <div className="mt-3 border-t border-line pt-3">
                <Field
                  label="How many days more?"
                  value={d.days}
                  onChange={(v) => patch(p.id, { days: v.replace(/[^0-9]/g, "").slice(0, 3) })}
                  placeholder="e.g. 2"
                  inputMode="numeric"
                />
                <Field
                  label="What's the reason?"
                  value={d.reason}
                  onChange={(v) => patch(p.id, { reason: v })}
                  placeholder="What got in the way?"
                />
                {incomplete ? (
                  <p className="text-[12px] font-semibold text-danger" role="status">
                    Both are needed before a &quot;no&quot; can be saved.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {error ? (
        <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------- pieces -------------------------------- */

function YesNo({
  label,
  question,
  value,
  busy,
  onChange,
}: {
  label: string;
  question: string;
  value: Answer;
  busy: boolean;
  onChange: (v: Answer) => void;
}) {
  if (!question.trim()) return null;
  return (
    <div className="mb-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mb-2 text-[14.5px] leading-snug text-ink">{question}</p>
      <div role="group" aria-label={`${label}: ${question}`} className="flex gap-2">
        {(
          [
            { v: "yes" as const, text: "Yes", Icon: Check },
            { v: "no" as const, text: "No", Icon: Close },
          ]
        ).map(({ v, text, Icon }) => {
          const on = value === v;
          const tone = v === "yes" ? "var(--p3)" : "var(--danger)";
          return (
            <button
              key={v}
              type="button"
              disabled={busy}
              aria-pressed={on}
              onClick={() => onChange(on ? "" : v)}
              className={cx(
                "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-[13.5px] font-semibold transition-colors",
                busy ? "cursor-wait" : "",
                on ? "text-on-accent" : "border-line text-muted hover:bg-line-soft",
              )}
              style={on ? { backgroundColor: tone, borderColor: tone } : undefined}
            >
              <Icon size={15} />
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[12px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={inputMode === "numeric" ? 3 : 2000}
        // Writing surfaces stay white/green whatever the page does, so the ink
        // on them is always the dark token.
        style={{ backgroundColor: value.trim() ? "var(--field)" : "var(--field-empty)" }}
        className="w-full min-h-[44px] rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-on-card outline-none transition-colors focus:border-line-focus"
      />
    </label>
  );
}
