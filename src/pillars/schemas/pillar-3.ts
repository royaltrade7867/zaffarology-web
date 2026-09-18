/**
 * Pillar 3 — AM Planning & PM Achievement (`pillar-3-am-pm`).
 *
 * Has `history` (ISO-dated, 180-day cap) so it supports date-range reporting, and
 * carries the app's only money figure — which is FREE TEXT, so any report summing
 * it must parse tolerantly and show what it could not read.
 */
import { todayKey } from '@/lib/ids';

import { asObj, asStr, fixTask, fixedTasks, objArr, type Task } from './types';

export type { Task } from './types';

export type Section = 'work' | 'dod' | 'extra';

export interface Filed {
  text: string;
  section: Section;
  date: string;
}

export interface DaySnap {
  date: string;
  work: Task;
  dod: Task[];
  extra: Task[];
  pm: string;
  /** Free text — users type "5,000", "$5k", "approx 300". Never assume a number. */
  money: string;
}

export interface P3State {
  work: Task;
  dod: Task[];
  extra: Task[];
  pm: string;
  money: string;
  filed: Filed[];
  day: string;
  history: DaySnap[];
}

export const makeInitial = (): P3State => ({
  work: { text: '', done: false },
  dod: Array.from({ length: 5 }, () => ({ text: '', done: false })),
  extra: [],
  pm: '',
  money: '',
  filed: [],
  day: todayKey(),
  history: [],
});

/** Whether today's board has anything worth keeping in history. */
export const hasDay = (s: P3State): boolean =>
  !!(
    s.work.text.trim() ||
    s.dod.some((t) => t.text.trim()) ||
    s.extra.some((t) => t.text.trim()) ||
    s.pm.trim() ||
    s.money.trim()
  );

/**
 * Snapshot the whole closing day into history, then clear everything for a
 * fresh day. Shared by Pillar 3 and the Pillar 5 "AM Planning & PM
 * Achievement" department, which runs the same board per business.
 */
export function rollover(s: P3State, closingDate: string): void {
  if (hasDay(s)) {
    const snap: DaySnap = { date: closingDate, work: s.work, dod: s.dod, extra: s.extra, pm: s.pm, money: s.money };
    // Collapse multiple rolls on the same closing date into one entry.
    if (s.history[0]?.date === closingDate) s.history[0] = snap;
    else s.history = [snap, ...s.history].slice(0, 180);
  }
  s.work = { text: '', done: false };
  s.dod = Array.from({ length: 5 }, () => ({ text: '', done: false }));
  s.extra = [];
  s.pm = '';
  s.money = '';
  s.day = todayKey();
}

const asSection = (v: unknown): Section =>
  v === 'work' || v === 'dod' || v === 'extra' ? v : 'work';

const fixFiled = (v: unknown): Filed => {
  const o = asObj(v);
  return { text: asStr(o.text), section: asSection(o.section), date: asStr(o.date) };
};

const fixSnap = (v: unknown): DaySnap => {
  const o = asObj(v);
  return {
    date: asStr(o.date),
    work: fixTask(o.work),
    dod: fixedTasks(o.dod, 5),
    extra: objArr(o.extra, fixTask),
    pm: asStr(o.pm),
    money: asStr(o.money),
  };
};

export const normalize = (s: P3State): P3State => {
  const o = asObj(s);
  return {
    work: fixTask(o.work),
    dod: fixedTasks(o.dod, 5),
    extra: objArr(o.extra, fixTask),
    pm: asStr(o.pm),
    money: asStr(o.money),
    filed: objArr(o.filed, fixFiled),
    day: asStr(o.day) || todayKey(),
    // Drop snapshots with no usable date — they cannot be range-filtered and would
    // corrupt any "days recorded" count.
    history: objArr(o.history, fixSnap).filter((d) => d.date),
  };
};
