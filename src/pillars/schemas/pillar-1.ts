/**
 * Pillar 1 — Dreaming to Achieving (`pillar-1`).
 *
 * Each goal is a self-contained project owning its own plan, target date and daily
 * task lists. Moved out of the screen so the reporting layer can read and heal the
 * same blobs without mounting a component.
 */
import { todayKey } from '@/lib/ids';

import {
  asObj,
  asStr,
  fixDeleg,
  fixTask,
  fixedTasks,
  objArr,
  type Deleg,
  type Task,
} from './types';

// Re-exported so a screen has one import source for its whole shape.
export type { Deleg, Task } from './types';
export { blankDeleg } from './types';

export type Section = 'work' | 'dod' | 'extra' | 'deleg';

export interface Filed {
  text: string;
  section: Section;
  date: string;
}

/** One goal = one self-contained project: its plan, target date, and its own
 *  work-of-day / do-or-die / extra-mile / delegated lists. */
export interface GoalPlan {
  goal: string;
  plan: string;
  /** Deadline for the goal (ISO yyyy-mm-dd), '' when unset. The stored key stays
   *  `target` — renaming it would orphan every existing user's dates. */
  target: string;
  work: Task;
  dod: Task[];
  extra: Task[];
  deleg: Deleg[];
}

export interface DaySnap {
  date: string;
  goals: GoalPlan[];
  /** Legacy pre-per-goal fields, folded in by `normalize`. */
  goal?: string;
  plan?: string;
  work?: Task;
  dod?: Task[];
  extra?: Task[];
  deleg?: Deleg[];
}

export interface P1State {
  goals: GoalPlan[];
  /** Legacy pre-per-goal fields, folded in by `normalize`. */
  goal?: string;
  plan?: string;
  work?: Task;
  dod?: Task[];
  extra?: Task[];
  deleg?: Deleg[];
  filed: Filed[];
  day: string;
  history: DaySnap[];
}

export const blankTask = (): Task => ({ text: '', done: false });
export const blankDod = () => Array.from({ length: 5 }, blankTask);

/** A brand-new goal starts completely empty — its own plan, date and task lists. */
export const emptyGoal = (): GoalPlan => ({
  goal: '',
  plan: '',
  target: '',
  work: blankTask(),
  dod: blankDod(),
  extra: [],
  deleg: [],
});

/** Goal, plan and deadline are all written in. */
export const goalReady = (g: GoalPlan): boolean => !!(g.goal.trim() && g.plan.trim() && g.target.trim());

/**
 * How much of a goal's page to show.
 *
 *  1 = the goal box only (exact goal, plan, deadline)
 *  2 = plus work of the day and the 5 do-or-die tasks
 *  3 = plus go-extra-mile and delegate
 *
 * Zaffar, 19 Sep: "There should be visible only first box ... Once you
 * complete there should appear another box with work of the day & 5 do or die
 * tasks. Then Go-Extra and Delegate."
 *
 * The one rule it may never break: anything already written stays visible.
 * A goal from before this change, or one whose plan was later cleared, still
 * shows every group that has content in it.
 */
export const revealStage = (g: GoalPlan): 1 | 2 | 3 => {
  const dayStarted = !!g.work.text.trim() || g.dod.some((t) => t.text.trim());
  const laterContent = g.extra.some((t) => t.text.trim()) || g.deleg.some((d) => d.text.trim());
  if (dayStarted || laterContent) return 3;
  return goalReady(g) ? 2 : 1;
};

/** Fill in any missing per-goal field so a partially-shaped blob is safe to render. */
export const healGoal = (g: Partial<GoalPlan> | undefined): GoalPlan => ({
  goal: g?.goal ?? '',
  plan: g?.plan ?? '',
  target: g?.target ?? '',
  work: g?.work ?? blankTask(),
  dod: Array.isArray(g?.dod) && g.dod.length ? g.dod.map((t) => t ?? blankTask()) : blankDod(),
  extra: Array.isArray(g?.extra) ? g.extra : [],
  deleg: Array.isArray(g?.deleg) ? g.deleg : [],
});

/**
 * Fold older shapes into the per-goal array:
 *  - v1: a single top-level `goal`/`plan` pair
 *  - v2: a `goals` array of {goal, plan} with shared top-level task lists
 * In both cases the shared work/dod/extra/deleg belong to the FIRST goal, since
 * that is the goal they were being worked against.
 */
export const migrateGoals = <T extends Partial<P1State>>(s: T): T => {
  let goals: Partial<GoalPlan>[] = Array.isArray(s.goals) ? s.goals.filter(Boolean) : [];
  // Seed a goal from the legacy shape whenever the old blob held ANYTHING — not
  // just goal/plan text. A v1 user who filled Work-of-the-Day and Do-or-Die but
  // left goal/plan blank would otherwise end up with `goals: []`, and the shared
  // task lists below would have nowhere to attach: all of it silently deleted.
  const hadLegacyContent =
    (s.goal ?? '').trim() ||
    (s.plan ?? '').trim() ||
    s.work?.text?.trim() ||
    s.dod?.some((t) => t?.text?.trim()) ||
    s.extra?.some((t) => t?.text?.trim()) ||
    s.deleg?.some((d) => d?.text?.trim());
  if (!goals.length && hadLegacyContent) {
    goals = [{ goal: s.goal ?? '', plan: s.plan ?? '' }];
  }
  const healed = goals.map(healGoal);
  // Attach the old shared task lists to the first goal (only if it has none yet).
  const hadShared = s.work || s.dod || s.extra || s.deleg;
  if (hadShared && healed.length) {
    const first = healed[0];
    const firstEmpty =
      !first.work.text.trim() &&
      !first.dod.some((t) => t.text.trim()) &&
      !first.extra.length &&
      !first.deleg.length;
    if (firstEmpty) {
      if (s.work) first.work = s.work;
      if (s.dod?.length) first.dod = s.dod;
      if (s.extra?.length) first.extra = s.extra;
      if (s.deleg?.length) first.deleg = s.deleg;
    }
  }
  const out = { ...s, goals: healed };
  delete out.goal;
  delete out.plan;
  delete out.work;
  delete out.dod;
  delete out.extra;
  delete out.deleg;
  return out as T;
};

/** Heal a loaded blob: migrate legacy shapes and any history snapshots. */
export const normalize = (s: P1State): P1State => {
  const next = migrateGoals(s);
  if (!next.goals.length) next.goals = [emptyGoal()];
  next.history = (Array.isArray(next.history) ? next.history : []).map(
    (d) => migrateGoals(asObj(d) as Partial<P1State>) as DaySnap,
  );
  // Defensive pass for blobs that never went through the screen: coerce every
  // nested value so report code can index freely.
  const fixGoal = (g: unknown): GoalPlan => {
    const o = asObj(g);
    return {
      goal: asStr(o.goal),
      plan: asStr(o.plan),
      target: asStr(o.target),
      work: fixTask(o.work),
      dod: fixedTasks(o.dod, 5),
      extra: objArr(o.extra, fixTask),
      deleg: objArr(o.deleg, fixDeleg),
    };
  };
  next.goals = next.goals.map(fixGoal);
  // History needs the SAME treatment: a snapshot task missing `text` used to
  // crash the whole cross-pillar report on `t.text.trim()`. Snapshots without a
  // date are dropped, matching Pillars 3 and 4 — they cannot be range-filtered
  // and would corrupt any "days recorded" count.
  next.history = (Array.isArray(next.history) ? next.history : [])
    .map((d) => {
      const o = asObj(d);
      return { ...o, date: asStr(o.date), goals: objArr(o.goals, fixGoal) } as DaySnap;
    })
    .filter((d) => d.date);
  next.filed = Array.isArray(next.filed) ? next.filed : [];
  next.day = asStr(next.day) || todayKey();
  return next;
};

export const makeInitial = (): P1State => ({
  goals: [emptyGoal()],
  filed: [],
  day: todayKey(),
  history: [],
});
