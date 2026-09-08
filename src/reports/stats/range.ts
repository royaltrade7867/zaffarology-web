/**
 * Date-range filtering over pillar history.
 *
 * `DaySnap.date` is always ISO `YYYY-MM-DD`, which sorts lexicographically — so
 * range filtering is a plain string compare. No Date parsing, no timezone bugs.
 *
 * Only Pillars 1, 3 and 4 keep history; the other five are snapshot-only and must
 * be reported "as of today" rather than over a range.
 */
import { dayDiff } from '@/lib/dates';
import { todayKey } from '@/lib/ids';

export interface DateRange {
  /** ISO yyyy-mm-dd, inclusive. */
  from: string;
  /** ISO yyyy-mm-dd, inclusive. */
  to: string;
}

/** History arrays are capped at this many entries by every pillar's rollover. */
export const HISTORY_CAP_DAYS = 180;

/** Below this many recorded days, rate-style stats mislead — show detail instead. */
export const MIN_DAYS_FOR_RATES = 5;

export const lastNDays = (n: number): DateRange => {
  const to = todayKey();
  const d = new Date(`${to}T00:00:00`);
  d.setDate(d.getDate() - (n - 1));
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return { from, to };
};

export const inRange = (iso: string, r: DateRange): boolean =>
  !!iso && iso >= r.from && iso <= r.to;

export function filterRange<T extends { date: string }>(history: T[], r: DateRange): T[] {
  return (history ?? []).filter((d) => inRange(d.date, r));
}

/** Whole days the range spans, inclusive. */
export const rangeLength = (r: DateRange): number => Math.abs(dayDiff(r.to, r.from)) + 1;

export interface Coverage {
  /** Snapshots that fall inside the range. */
  recorded: number;
  /** Calendar days the range covers. */
  span: number;
  /** True when the range reaches back past the oldest snapshot we still keep. */
  beyondHistory: boolean;
  /** Oldest snapshot date we hold, if any. */
  earliest?: string;
}

/**
 * Describe how much of the range is actually backed by data.
 *
 * This matters more than it looks: rollover only runs when a pillar screen mounts
 * on a new day, so a user who skips three days then opens the app produces ONE
 * snapshot, not four. "Days recorded" is therefore never the same as "days worked",
 * and every report must show the denominator instead of implying full coverage.
 */
export function coverage<T extends { date: string }>(history: T[], r: DateRange): Coverage {
  const all = (history ?? []).filter((d) => d.date);
  const inside = filterRange(all, r);
  const earliest = all.length ? all.map((d) => d.date).sort()[0] : undefined;
  return {
    recorded: inside.length,
    span: rangeLength(r),
    // Only true when history is actually AT the cap and therefore losing days.
    // Without the length check, a new user with 12 days of data would be told
    // "history is kept for 180 days" for any 30-day range, which reads as though
    // their data had been discarded when they simply had not used the app yet.
    beyondHistory: all.length >= HISTORY_CAP_DAYS && !!earliest && r.from < earliest,
    earliest,
  };
}

/** One honest sentence about coverage, for the report header. */
export function describeCoverage(c: Coverage): string {
  const base = `${c.recorded} of ${c.span} days recorded in this period.`;
  if (c.recorded === 0) {
    return c.earliest
      ? `No days recorded in this period. Your earliest record is ${c.earliest}.`
      : 'No days recorded yet.';
  }
  if (c.beyondHistory) {
    return `${base} History is kept for the last ${HISTORY_CAP_DAYS} days, so this range extends beyond available data.`;
  }
  return base;
}
