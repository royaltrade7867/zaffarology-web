"use client";

/**
 * "Today's reports" — the daily path into Pillar 5.
 *
 * A system is otherwise five clicks deep (pillar → business → department →
 * system → past twelve sections), which is right for defining one and far too
 * buried for something done every day. This puts it one click from opening the
 * app, and says how much is left.
 *
 * The questions live in the Pillar 5 BLOB and the answers live in their own
 * TABLE, so this reads both and merges them at render time — a read-only
 * overlay, exactly like assigned tasks. Nothing here writes anything.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ChevronRight } from "@/components/icons";
import { api } from "@/lib/api";
import { todayKey } from "@/lib/ids";
import { loadDayReports } from "@/lib/system-reports-api";
import { healBlob } from "@/pillars/schemas";
import type { P8State, System } from "@/pillars/schemas/business-systems";

const P5_KEY = "pillar-8-business-systems";

/** Rows past this are hidden behind "show all", so a 40-system user does not
 *  push the pillars off the screen. */
const VISIBLE = 5;

type Row = { system: System; answered: number; total: number; deptName: string };

export function TodaysReportsCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: unknown }>(`/v3/pillars/${P5_KEY}`);
      const raw = res?.data ?? null;
      if (raw == null) {
        setRows([]);
        return;
      }
      const healed = healBlob(P5_KEY, raw);
      // healBlob returns a tagged union; narrowing beats casting, and a blob
      // that is somehow not this pillar simply yields no rows.
      if (!healed || healed.kind !== "business-systems") {
        setRows([]);
        return;
      }
      const state: P8State = healed.data;
      const systems: { system: System; deptName: string }[] = [];
      for (const b of state.businesses) {
        for (const d of b.departments) {
          for (const s of d.systems) systems.push({ system: s, deptName: d.name });
        }
      }
      const date = todayKey();
      const built = await Promise.all(
        systems.map(async ({ system, deptName }) => {
          const answerable = system.pairs.filter((p) => p.effort.trim() || p.result.trim());
          let answered = 0;
          if (answerable.length) {
            try {
              const reports = await loadDayReports(date, system.id);
              const byPair = new Set(
                reports.filter((r) => r.effort_done || r.result_done).map((r) => r.pair_id),
              );
              answered = answerable.filter((p) => byPair.has(p.id)).length;
            } catch {
              // One system's answers failing must not blank the whole card.
            }
          }
          return { system, deptName, answered, total: answerable.length };
        }),
      );
      setRows(built);
    } catch {
      // Home is the first thing anyone sees. A daily-report problem must not
      // put an error banner on it — the card simply does not appear.
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on return, so answers given in another tab show up here.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const answerable = (rows ?? []).filter((r) => r.total > 0);
  // Nothing to answer means nothing to show — never an empty card on Home.
  if (!answerable.length) return null;

  const shown = showAll ? answerable : answerable.slice(0, VISIBLE);
  const outstanding = answerable.filter((r) => r.answered < r.total).length;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-[13px] uppercase tracking-wide text-heading">
          Today&apos;s reports
        </h2>
        <span className="text-[12px] tabular-nums text-muted">
          {outstanding ? `${outstanding} still to do` : "All done"}
        </span>
      </div>

      <ul className="space-y-1.5">
        {shown.map((r) => {
          const done = r.answered >= r.total;
          return (
            <li key={r.system.id}>
              <Link
                href={`/daily-report/${encodeURIComponent(r.system.id)}`}
                className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:bg-line-soft"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">
                    {r.system.name.trim() || "Untitled system"}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{r.deptName}</span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                  style={
                    done
                      ? { backgroundColor: "color-mix(in srgb, var(--p3) 14%, transparent)", color: "var(--p3)" }
                      : { backgroundColor: "var(--line-soft)", color: "var(--muted)" }
                  }
                >
                  {r.answered}/{r.total}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>

      {answerable.length > VISIBLE ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-gold transition-colors hover:bg-gold/8"
        >
          {showAll ? "Show fewer" : `Show all ${answerable.length}`}
        </button>
      ) : null}
    </section>
  );
}
