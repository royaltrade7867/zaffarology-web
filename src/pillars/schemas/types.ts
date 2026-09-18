/**
 * Shared pillar state shapes and the primitives used to heal loaded blobs.
 *
 * These live outside the screen files so non-React code (the reporting layer) can
 * read and normalise a user's pillar data without mounting a component. Nothing
 * here may import React or react-native.
 *
 * The healing rule for every normaliser built on these: given `unknown`, return a
 * valid value — never throw. Blobs come from builds we no longer control, and a
 * throw in the report path would take out an entire cross-pillar report.
 */
import { newId } from '@/lib/ids';

export type Loose = Record<string, unknown>;

export type YN = '' | 'yes' | 'no';

export interface Task {
  text: string;
  done: boolean;
}

/** '' = not yet answered. Mirrors Pillar 4's `Status` exactly, so the two
 *  screens can share the same Completed / Not Completed control. */
export type DelegStatus = '' | 'completed' | 'notdone';

export interface Deleg {
  /** Stable identity. These are spliced by index, so a position is NOT an
   *  identity — a task assignment has to point at this instead. Minted by
   *  `withId` on load, so blobs written before this field existed self-heal. */
  id: string;
  text: string;
  who: string;
  due: string;
  done: boolean;
  /** User id of a tagged connection, '' when the name is just typed text.
   *  Optional by design: tagging never replaces free-typed names. */
  whoUserId: string;

  /* --- the huddle flow, added 18 Sep 2026 -------------------------------
     Zaffar asked for delegate-or-follow-up to work like the 2-minute huddle:
     answer Completed or Not Completed, and if not, give a NEW DATE rather than
     an excuse. These mirror Pillar 4's `Item` field-for-field so the same
     controls drive both.

     `done` is kept and still drives the tick and the carry-over rule; `status`
     is the richer answer. A row is complete when EITHER says so, so blobs
     written before this existed keep working. */
  status: DelegStatus;
  /** When it was actually finished. Only meaningful with status 'completed'. */
  completedOn: string;
  /** The re-committed date. Only meaningful with status 'notdone'. */
  newDate: string;
  /** What happens next — deliberately not "why it didn't happen". */
  note: string;
}

/** A snapshot of one closing day. `date` is always ISO `YYYY-MM-DD`. */
export interface DaySnapshot {
  date: string;
}

/* ---------------------------- primitives ---------------------------- */

export const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');

export const asBool = (v: unknown): boolean => v === true;

export const asYN = (v: unknown): YN => (v === 'yes' || v === 'no' ? v : '');

export const strArr = (v: unknown, fb: string[]): string[] =>
  Array.isArray(v) ? v.map(asStr) : fb;

export const objArr = <T,>(v: unknown, fix: (o: Loose) => T): T[] =>
  Array.isArray(v) ? v.map((o) => fix((o ?? {}) as Loose)) : [];

/** Coerce anything into a well-formed object we can read keys off. */
export const asObj = (v: unknown): Loose =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : {};

export const fixTask = (t: unknown): Task => {
  const o = asObj(t);
  return { text: asStr(o.text), done: asBool(o.done) };
};

export const asDelegStatus = (v: unknown): DelegStatus =>
  v === 'completed' || v === 'notdone' ? v : '';

export const fixDeleg = (d: unknown): Deleg => {
  const o = asObj(d);
  const status = asDelegStatus(o.status);
  const done = asBool(o.done);
  return {
    id: withId(o.id),
    text: asStr(o.text),
    who: asStr(o.who),
    due: asStr(o.due),
    /* Kept in step with `status`, in BOTH directions. An old blob has `done`
       and no `status`; a row completed through the new control has `status`
       and must still show a tick on a client that only reads `done`. */
    done: done || status === 'completed',
    whoUserId: asStr(o.whoUserId),
    status: status || (done ? 'completed' : ''),
    completedOn: asStr(o.completedOn),
    newDate: asStr(o.newDate),
    note: asStr(o.note),
  };
};

/** A blank delegated task. Use this rather than an inline literal — an object
 *  literal at a push site is exactly how a new field gets missed. */
export const blankDeleg = (): Deleg => ({
  id: newId(),
  text: '',
  who: '',
  due: '',
  done: false,
  whoUserId: '',
  status: '',
  completedOn: '',
  newDate: '',
  note: '',
});

/** Exactly `n` tasks — pads short arrays and truncates long ones, because several
 *  screens index a fixed-length list (e.g. the Do-or-Die five). */
export const fixedTasks = (v: unknown, n: number): Task[] => {
  const src = Array.isArray(v) ? v : [];
  return Array.from({ length: n }, (_, i) => fixTask(src[i]));
};

export const withId = (v: unknown): string => asStr(v) || newId();
