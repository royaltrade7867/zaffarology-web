/**
 * Pillar 4 — 2-Minute Huddle Meetings (`pillar-4-huddle`).
 *
 * Has `history`, but note it only snapshots when the board CHANGED, so gaps mean
 * "unchanged", not "no activity". Reports must say "the board changed on N days"
 * rather than implying a daily activity count.
 */
import { newId, todayKey } from '@/lib/ids';

import { asObj, asStr, objArr, withId } from './types';

export type Status = '' | 'completed' | 'notdone';

export interface Item {
  /** Stable identity. Items are spliced by index when filed or removed, so a
   *  board position is NOT an identity — a task assignment points at this.
   *  Minted by `withId` on load, so older blobs self-heal. */
  id: string;
  name: string;
  who: string;
  /** ISO yyyy-mm-dd */
  due: string;
  status: Status;
  newDate: string;
  note: string;
  completedOn: string;
  /** User id of a tagged connection, '' when the name is just typed text.
   *  Optional by design: tagging never replaces free-typed names. */
  assigneeUserId: string;
}

export interface Filed {
  name: string;
  who: string;
  /** Pre-rendered display string, e.g. "🏆 3 days early". */
  early: string;
  date: string;
}

export interface DaySnap {
  date: string;
  items: Item[];
}

export interface P4State {
  items: Item[];
  filed: Filed[];
  day: string;
  history: DaySnap[];
}

export const blank = (): Item => ({
  id: newId(),
  name: '',
  who: '',
  due: '',
  status: '',
  newDate: '',
  note: '',
  completedOn: '',
  assigneeUserId: '',
});

export const makeInitial = (): P4State => ({
  items: [blank()],
  filed: [],
  day: todayKey(),
  history: [],
});

const asStatus = (v: unknown): Status => (v === 'completed' || v === 'notdone' ? v : '');

const fixItem = (v: unknown): Item => {
  const o = asObj(v);
  return {
    id: withId(o.id),
    name: asStr(o.name),
    who: asStr(o.who),
    due: asStr(o.due),
    status: asStatus(o.status),
    newDate: asStr(o.newDate),
    note: asStr(o.note),
    completedOn: asStr(o.completedOn),
    assigneeUserId: asStr(o.assigneeUserId),
  };
};

const fixFiled = (v: unknown): Filed => {
  const o = asObj(v);
  return { name: asStr(o.name), who: asStr(o.who), early: asStr(o.early), date: asStr(o.date) };
};

const fixSnap = (v: unknown): DaySnap => {
  const o = asObj(v);
  return { date: asStr(o.date), items: objArr(o.items, fixItem) };
};

export const normalize = (s: P4State): P4State => {
  const o = asObj(s);
  const items = objArr(o.items, fixItem);
  return {
    // The screen indexes items[idx], so the board is never empty.
    items: items.length ? items : [blank()],
    filed: objArr(o.filed, fixFiled),
    day: asStr(o.day) || todayKey(),
    history: objArr(o.history, fixSnap).filter((d) => d.date),
  };
};
