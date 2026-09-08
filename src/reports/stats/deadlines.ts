/**
 * Did the work land by the date it was FIRST promised?
 *
 * This is the accountability question the workbook is built around, and it is
 * deliberately measured against the *original* deadline. Pillar 4 lets a user
 * push an item to a `newDate`; counting against that would let anything be "on
 * time" simply by moving the goalposts, which is exactly the behaviour the
 * huddle is meant to expose.
 *
 * Every count here is honest about what it cannot know: an item with no deadline
 * is not a hit or a miss, it is unmeasurable, and it is reported separately
 * rather than quietly folded into either column.
 */
import { type P1State } from '@/pillars/schemas/pillar-1';
import { type P4State } from '@/pillars/schemas/pillar-4';

export interface DeadlineStats {
  /** Completed on or before the FIRST deadline. */
  onTime: number;
  /** Completed, but after the first deadline. */
  late: number;
  /** Not finished, and the first deadline has passed. */
  overdue: number;
  /** Not finished, deadline still ahead. */
  pending: number;
  /** Has no deadline set, so it cannot be judged either way. */
  noDeadline: number;
  /** How many were pushed to a later date at least once (P4 only). */
  postponed: number;
  /** Everything with BOTH a first deadline and an outcome — the denominator. */
  measured: number;
  /** onTime / measured, or null when nothing is measurable. */
  hitRate: number | null;
  /** Worst offenders first: what slipped, and by how many days. */
  misses: { text: string; due: string; by: number }[];
}

const empty = (): DeadlineStats => ({
  onTime: 0,
  late: 0,
  overdue: 0,
  pending: 0,
  noDeadline: 0,
  postponed: 0,
  measured: 0,
  hitRate: null,
  misses: [],
});

/** ISO dates compare correctly as strings; no Date parsing, no timezone drift. */
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Whole days from `a` to `b`, both ISO. Positive when b is later. */
export const daysBetween = (a: string, b: string): number => {
  const ms = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const ns = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((ns - ms) / 86_400_000);
};

const finish = (s: DeadlineStats): DeadlineStats => {
  s.measured = s.onTime + s.late + s.overdue;
  s.hitRate = s.measured ? s.onTime / s.measured : null;
  s.misses.sort((a, b) => b.by - a.by);
  s.misses = s.misses.slice(0, 10);
  return s;
};

/** One item's outcome against its first deadline. */
function judge(
  out: DeadlineStats,
  text: string,
  firstDue: string,
  completedOn: string,
  done: boolean,
  today: string,
) {
  if (!isIso(firstDue)) {
    out.noDeadline += 1;
    return;
  }
  if (done) {
    // Completed but with no recorded date: it happened, but we cannot place it
    // relative to the deadline, so it is not counted as a hit.
    if (!isIso(completedOn)) {
      out.noDeadline += 1;
      return;
    }
    const by = daysBetween(firstDue, completedOn);
    if (by <= 0) out.onTime += 1;
    else {
      out.late += 1;
      out.misses.push({ text, due: firstDue, by });
    }
    return;
  }
  const by = daysBetween(firstDue, today);
  if (by > 0) {
    out.overdue += 1;
    out.misses.push({ text, due: firstDue, by });
  } else {
    out.pending += 1;
  }
}

/**
 * Pillar 4 — the huddle board. The only pillar that records a first deadline
 * (`due`), a postponement (`newDate`) and a completion date, so it is the one
 * that can answer the question fully.
 */
export function p4Deadlines(s: P4State, today: string): DeadlineStats {
  const out = empty();
  for (const it of s.items) {
    if (!it.name.trim()) continue;
    if (isIso(it.newDate)) out.postponed += 1;
    judge(out, it.name, it.due, it.completedOn, it.status === 'completed', today);
  }
  // Filed items are completed and removed from the board; excluding them would
  // report a user's finished work as if it never happened. Their dates are
  // display strings, so they can only be counted, not judged.
  out.noDeadline += s.filed.length;
  return finish(out);
}

/** Pillar 1 — delegated tasks carry a deadline; goals carry a target date. */
export function p1Deadlines(s: P1State, today: string): DeadlineStats {
  const out = empty();
  for (const g of s.goals) {
    // The goal itself, against its Deadline.
    if (g.goal.trim()) {
      const allDone =
        !!g.work.text.trim() &&
        g.work.done &&
        g.dod.filter((t) => t.text.trim()).every((t) => t.done);
      judge(out, g.goal, g.target, '', allDone, today);
    }
    for (const d of g.deleg) {
      if (!d.text.trim()) continue;
      // Delegated tasks record no completion date, only a done flag. A task
      // ticked before its deadline passed counts as on time; there is no way to
      // know the exact day, so this is the closest honest reading.
      judge(out, d.text, d.due, d.done ? today : '', d.done, today);
    }
  }
  return finish(out);
}

/** Merge several pillars' figures into one app-wide picture. */
export function totalDeadlines(parts: DeadlineStats[]): DeadlineStats {
  const out = empty();
  for (const p of parts) {
    out.onTime += p.onTime;
    out.late += p.late;
    out.overdue += p.overdue;
    out.pending += p.pending;
    out.noDeadline += p.noDeadline;
    out.postponed += p.postponed;
    out.misses.push(...p.misses);
  }
  return finish(out);
}
