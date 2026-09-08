/**
 * Derived statistics for reports.
 *
 * Everything here is a pure function of already-loaded pillar data. Where a number
 * cannot be derived honestly, the type carries the caveat rather than the caller
 * having to remember it (see `HuddleStats.changedDays` and `MoneyTotal.unreadable`).
 */
import { dayDiff } from '@/lib/dates';
import { todayKey } from '@/lib/ids';
import type { P1State } from '@/pillars/schemas/pillar-1';
import type { P2State } from '@/pillars/schemas/pillar-2';
import type { P3State } from '@/pillars/schemas/pillar-3';
import type { P4State } from '@/pillars/schemas/pillar-4';
import type { P8State } from '@/pillars/schemas/business-systems';

import { totalMoney, type MoneyTotal } from './money';
import { coverage, filterRange, type Coverage, type DateRange } from './range';

/** Generic so callers keep their element type (notably `done`). */
const filled = <T extends { text: string }>(arr: T[]): T[] =>
  (arr ?? []).filter((t) => t.text.trim());
const doneOf = (arr: { text: string; done: boolean }[]) =>
  filled(arr).filter((t) => t.done).length;

export interface Rate {
  done: number;
  total: number;
  /** 0-1, or null when there is nothing to rate (avoids a misleading 0%). */
  pct: number | null;
}

const rate = (done: number, total: number): Rate => ({
  done,
  total,
  pct: total > 0 ? done / total : null,
});

/* --------------------------------- Pillar 1 -------------------------------- */

export interface GoalStats {
  goal: string;
  hasPlan: boolean;
  target: string;
  /** Days until target; negative means overdue. Null when no target set. */
  daysToTarget: number | null;
  dod: Rate;
  workDone: boolean;
  extra: Rate;
  delegOpen: number;
  delegOverdue: number;
}

export interface P1Stats {
  goals: GoalStats[];
  activeGoals: number;
  withTarget: number;
  overdue: number;
  dueSoon: number;
  dodRange: Rate;
  coverage: Coverage;
}

export function p1Stats(s: P1State, range: DateRange): P1Stats {
  const today = todayKey();
  const goals: GoalStats[] = s.goals
    .filter((g) => g.goal.trim() || g.plan.trim() || g.work.text.trim() || filled(g.dod).length)
    .map((g) => {
      const openDeleg = g.deleg.filter((d) => d.text.trim() && !d.done);
      return {
        goal: g.goal.trim(),
        hasPlan: !!g.plan.trim(),
        target: g.target,
        daysToTarget: g.target ? dayDiff(g.target, today) : null,
        dod: rate(doneOf(g.dod), filled(g.dod).length),
        workDone: g.work.done && !!g.work.text.trim(),
        extra: rate(doneOf(g.extra), filled(g.extra).length),
        delegOpen: openDeleg.length,
        delegOverdue: openDeleg.filter((d) => d.due && dayDiff(d.due, today) < 0).length,
      };
    });

  // Range stats come from history snapshots, which is the only dated source.
  const snaps = filterRange(s.history, range);
  let done = 0;
  let total = 0;
  for (const snap of snaps) {
    for (const g of snap.goals ?? []) {
      const f = filled(g.dod ?? []);
      total += f.length;
      done += f.filter((t) => t.done).length;
    }
  }

  return {
    goals,
    activeGoals: goals.length,
    withTarget: goals.filter((g) => g.target).length,
    overdue: goals.filter((g) => g.daysToTarget !== null && g.daysToTarget < 0).length,
    dueSoon: goals.filter((g) => g.daysToTarget !== null && g.daysToTarget >= 0 && g.daysToTarget <= 7)
      .length,
    dodRange: rate(done, total),
    coverage: coverage(s.history, range),
  };
}

/* --------------------------------- Pillar 2 -------------------------------- */

export interface P2Stats {
  hasOpenProblem: boolean;
  solutionsOnTable: number;
  chosen: number;
  solvedArchive: number;
}

export function p2Stats(s: P2State): P2Stats {
  const sols = filled(s.sols);
  return {
    hasOpenProblem: !!s.problem.trim(),
    solutionsOnTable: sols.length,
    chosen: sols.filter((x) => x.done).length,
    solvedArchive: s.filed.length,
  };
}

/* --------------------------------- Pillar 3 -------------------------------- */

export interface P3Stats {
  /** Planned vs achieved, using the screen's own definition (work + dod + extra). */
  achieved: Rate;
  perfectDays: number;
  reflectionDays: number;
  money: MoneyTotal;
  moneyEntryDays: number;
  coverage: Coverage;
}

export function p3Stats(s: P3State, range: DateRange): P3Stats {
  const snaps = filterRange(s.history, range);
  let done = 0;
  let total = 0;
  let perfect = 0;
  let reflection = 0;
  const moneyEntries: string[] = [];

  for (const d of snaps) {
    const planned = [...(d.work.text.trim() ? [d.work] : []), ...filled(d.dod), ...filled(d.extra)];
    const dayDone = planned.filter((t) => t.done).length;
    total += planned.length;
    done += dayDone;
    if (planned.length > 0 && dayDone === planned.length) perfect += 1;
    if (d.pm.trim()) reflection += 1;
    if (d.money.trim()) moneyEntries.push(d.money);
  }

  return {
    achieved: rate(done, total),
    perfectDays: perfect,
    reflectionDays: reflection,
    money: totalMoney(moneyEntries),
    moneyEntryDays: moneyEntries.length,
    coverage: coverage(s.history, range),
  };
}

/* --------------------------------- Pillar 4 -------------------------------- */

export interface HuddleStats {
  /** Items currently ON the board (filed ones have been removed from it). */
  total: number;
  /** Completed and still on the board. See `filedCount` for the archive. */
  completed: number;
  notDone: number;
  noStatus: number;
  overdue: number;
  early: number;
  late: number;
  slipped: number;
  /**
   * Days on which the board CHANGED — not days the user was active. History only
   * snapshots on change, so gaps mean "unchanged", never "nothing happened".
   */
  changedDays: number;
  /** Completed items the user filed away. Filing DELETES the item from the board
   *  (`pillar-4.tsx` fileItem), taking its status and dates with it — so without
   *  counting these, a user who completed and filed a month of work would be
   *  reported as having completed nothing. */
  filedCount: number;
  /** Completed on the board PLUS filed — the honest "work finished" number. */
  completedIncludingFiled: number;
}

export function p4Stats(s: P4State, range: DateRange): HuddleStats {
  const today = todayKey();
  const items = s.items.filter((i) => i.name.trim());
  let early = 0;
  let late = 0;

  for (const i of items) {
    if (i.status === 'completed' && i.due && i.completedOn) {
      const diff = dayDiff(i.due, i.completedOn);
      if (diff > 0) early += 1;
      else if (diff < 0) late += 1;
    }
  }

  const completed = items.filter((i) => i.status === 'completed').length;
  return {
    total: items.length,
    completed,
    completedIncludingFiled: completed + s.filed.length,
    notDone: items.filter((i) => i.status === 'notdone').length,
    noStatus: items.filter((i) => !i.status).length,
    overdue: items.filter((i) => i.status !== 'completed' && i.due && dayDiff(i.due, today) < 0)
      .length,
    early,
    late,
    slipped: items.filter((i) => i.newDate.trim()).length,
    changedDays: filterRange(s.history, range).length,
    filedCount: s.filed.length,
  };
}

/* ------------------------ Pillar 5 — business systems ---------------------- */

export interface SystemsStats {
  businesses: number;
  departments: number;
  systems: number;
  /** Systems with every one of the four list sections filled. */
  complete: number;
  /** Systems nobody has been trained on — the real gap signal. */
  untrained: number;
  trainings: number;
  trainingsSatisfied: number;
}

export function p8Stats(s: P8State): SystemsStats {
  let departments = 0;
  let systems = 0;
  let complete = 0;
  let untrained = 0;
  let trainings = 0;
  let satisfied = 0;

  for (const b of s.businesses) {
    departments += b.departments.length;
    for (const d of b.departments) {
      for (const sys of d.systems) {
        systems += 1;
        const hasAll = [sys.jobs, sys.efforts, sys.results, sys.steps].every((l) =>
          l.some((x) => x.trim()),
        );
        if (hasAll) complete += 1;
        if (!sys.trainings.length) untrained += 1;
        trainings += sys.trainings.length;
        satisfied += sys.trainings.filter((t) => t.satisfied === 'yes').length;
      }
    }
  }

  return {
    businesses: s.businesses.length,
    departments,
    systems,
    complete,
    untrained,
    trainings,
    trainingsSatisfied: satisfied,
  };
}

export { totalMoney, describeMoney, formatAmount, parseMoney } from './money';
export {
  coverage,
  describeCoverage,
  filterRange,
  lastNDays,
  rangeLength,
  MIN_DAYS_FOR_RATES,
  HISTORY_CAP_DAYS,
  type Coverage,
  type DateRange,
} from './range';
