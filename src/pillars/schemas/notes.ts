/**
 * Personal notes (`personal-notes`).
 *
 * Deliberately unrelated to the eight pillars: a free-form scratchpad the user
 * keeps for themselves. It rides the same per-user JSON store so it syncs across
 * phone and web for free, but it is NOT a pillar — it never counts toward
 * progress, and it is not part of any report.
 */
import { newId, todayKey } from '@/lib/ids';

import { asObj, asStr, objArr } from './types';

export interface Note {
  id: string;
  title: string;
  body: string;
  /** ISO yyyy-mm-dd, when the note was first written. */
  createdAt: string;
  /** ISO yyyy-mm-dd, last edit. Drives the default sort. */
  updatedAt: string;
  /** Kept at the top of the list. */
  pinned: boolean;
}

export interface NotesState {
  notes: Note[];
}

export const makeInitial = (): NotesState => ({ notes: [] });

export const blankNote = (): Note => ({
  id: newId(),
  title: '',
  body: '',
  createdAt: todayKey(),
  updatedAt: todayKey(),
  pinned: false,
});

const fixNote = (v: unknown): Note => {
  const o = asObj(v);
  const created = asStr(o.createdAt) || todayKey();
  return {
    id: asStr(o.id) || newId(),
    title: asStr(o.title),
    body: asStr(o.body),
    createdAt: created,
    // Fall back to createdAt rather than today, so an older note does not jump to
    // the top of a recently-edited sort just because it was healed.
    updatedAt: asStr(o.updatedAt) || created,
    pinned: o.pinned === true,
  };
};

export const normalize = (s: NotesState): NotesState => ({
  notes: objArr(asObj(s).notes, fixNote),
});

/** A note worth keeping — an untouched blank one is discarded on exit. */
export const hasContent = (n: Note): boolean => !!(n.title.trim() || n.body.trim());

/** Pinned first, then most recently edited. */
export const sortNotes = (notes: Note[]): Note[] =>
  [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
