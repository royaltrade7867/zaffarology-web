"use client";

/**
 * Reports.
 *
 * Ports `zaffarology-mobileapp/src/app/(tabs)/reports.tsx`: pick one pillar or
 * the whole progress report, choose a range, then take it away.
 *
 * Where mobile opens a share sheet, the web downloads a real PDF (pdfmake) or
 * copies the plain-text version to the clipboard. Emailing a *daily system*
 * report is a separate, server-rendered path — see `/reports/daily`.
 */
import { useState } from "react";

import { AuthGuard } from "@/components/shell";
import { Check, Share } from "@/components/icons";
import { Loading, SectionLabel, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { PILLARS } from "@/lib/pillars";
import { reportError } from "@/lib/error-reporting";
import {
  NoDataError,
  UnverifiedError,
  sharePillarReport,
  shareProgressReport,
  type Identity,
  type ReportFormat,
} from "@/reports/generate";
import { lastNDays, type DateRange } from "@/reports/stats/range";

type ReportKind = "pillar" | "progress";

const PRESETS = [7, 30, 90] as const;

export default function ReportsPage() {
  return (
    <AuthGuard>
      <Reports />
    </AuthGuard>
  );
}

function Reports() {
  const { user, company } = useAuth();
  const [kind, setKind] = useState<ReportKind>("pillar");
  const [pillarNumber, setPillarNumber] = useState(1);
  const [range, setRange] = useState<DateRange>(() => lastNDays(30));
  const [days, setDays] = useState<number>(30);
  const [excludeP5, setExcludeP5] = useState(false);
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Loading />;

  const identity: Identity = {
    userId: user.id,
    fullName: user.fullName,
    companyName: company?.name ?? user.companyName,
  };

  const setPreset = (n: number) => {
    setDays(n);
    setRange(lastNDays(n));
  };

  const run = async (format: ReportFormat) => {
    if (busy) return;
    setBusy(format);
    setNote(null);
    setError(null);
    try {
      if (kind === "pillar") {
        await sharePillarReport(identity, pillarNumber, format);
      } else {
        await shareProgressReport(identity, range, format, {
          excludeBusinessSystems: excludeP5,
        });
      }
      setNote(
        format === "text"
          ? "Copied to your clipboard."
          : "Your PDF has been downloaded.",
      );
    } catch (err) {
      if (err instanceof NoDataError || err instanceof UnverifiedError) {
        setError(err.message);
      } else {
        reportError(err, { area: "report-generate", kind, format });
        setError("Something went wrong while building it. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1 className="font-heading text-[26px] leading-tight text-heading">SHARE YOUR WORK</h1>
      <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
        Send your pillars to your coach or a business partner, or keep a copy for
        yourself.
      </p>

      {/* What kind of report */}
      <div className="mt-6">
        <SectionLabel text="Report" small="one pillar, or everything at once" />
        <div role="group" aria-label="Report type" className="flex flex-wrap gap-2">
          {(
            [
              { k: "pillar" as const, label: "One pillar" },
              { k: "progress" as const, label: "Progress across all pillars" },
            ]
          ).map(({ k, label }) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k)}
                className={cx(
                  "rounded-xl border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                  on ? "border-selected bg-selected text-on-selected" : "border-line text-heading hover:bg-line-soft",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Which pillar */}
      {kind === "pillar" ? (
        <div className="mt-6">
          <SectionLabel text="Which pillar" />
          <div className="flex flex-wrap gap-2">
            {PILLARS.map((p) => {
              const on = pillarNumber === p.n;
              return (
                <button
                  key={p.n}
                  type="button"
                  onClick={() => setPillarNumber(p.n)}
                  aria-pressed={on}
                  // The visible label is a number in a coloured badge, which a
                  // screen reader would read as a bare digit.
                  aria-label={`Pillar ${p.n}, ${p.name}`}
                  title={p.name}
                  className={cx(
                    "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    on ? "bg-surface" : "border-line text-muted hover:bg-line-soft",
                  )}
                  style={on ? { borderColor: p.accent, color: p.accent } : undefined}
                >
                  <span
                    aria-hidden
                    className="font-heading text-[15px]"
                    style={{ color: on ? p.accent : "var(--placeholder)" }}
                  >
                    {p.n}
                  </span>
                  <span className="max-w-[16ch] truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Range */}
          <div className="mt-6">
            <SectionLabel text="Period" small="how far back to look" />
            <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
              {PRESETS.map((n) => {
                const on = days === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPreset(n)}
                    className={cx(
                      "rounded-xl border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                      on ? "border-gold text-gold" : "border-line text-muted hover:bg-line-soft",
                    )}
                  >
                    Last {n} days
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] tabular-nums text-muted">
              {range.from} to {range.to}
            </p>
          </div>

          {/* Options */}
          <button
            type="button"
            role="switch"
            aria-checked={excludeP5}
            onClick={() => setExcludeP5((v) => !v)}
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:bg-line-soft"
          >
            <span
              aria-hidden
              className={cx(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                excludeP5 ? "border-gold bg-gold text-on-gold" : "border-line",
              )}
            >
              {excludeP5 ? <Check size={13} /> : null}
            </span>
            <span className="text-[13.5px] text-ink">
              Leave out Business Systems
              <span className="block text-[12px] text-muted">
                Useful when the report is for someone outside the business.
              </span>
            </span>
          </button>
        </>
      )}

      {/* Take it away */}
      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("pdf")}
          disabled={!!busy}
          className={cx(
            "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors",
            busy ? "cursor-wait border border-line text-muted" : "bg-gold text-on-gold hover:bg-gold-hover",
          )}
        >
          <Share size={18} />
          {busy === "pdf" ? "Building your PDF…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => run("text")}
          disabled={!!busy}
          className={cx(
            "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-5 text-[15px] font-semibold transition-colors",
            busy ? "cursor-wait border-line text-muted" : "border-line text-heading hover:bg-line-soft",
          )}
        >
          {busy === "text" ? "Copying…" : "Copy as text"}
        </button>
      </div>

      {note ? (
        <p className="mt-3 text-[13px] font-semibold text-gold" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[13px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
