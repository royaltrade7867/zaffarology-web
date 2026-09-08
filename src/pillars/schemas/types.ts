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

export const fixDeleg = (d: unknown): Deleg => {
  const o = asObj(d);
  return {
    id: withId(o.id),
    text: asStr(o.text),
    who: asStr(o.who),
    due: asStr(o.due),
    done: asBool(o.done),
    whoUserId: asStr(o.whoUserId),
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
});

/** Exactly `n` tasks — pads short arrays and truncates long ones, because several
 *  screens index a fixed-length list (e.g. the Do-or-Die five). */
export const fixedTasks = (v: unknown, n: number): Task[] => {
  const src = Array.isArray(v) ? v : [];
  return Array.from({ length: n }, (_, i) => fixTask(src[i]));
};

export const withId = (v: unknown): string => asStr(v) || newId();
