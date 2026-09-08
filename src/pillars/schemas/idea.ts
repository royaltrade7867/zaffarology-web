/**
 * Shared shape behind two display pillars:
 *   6 — Department of Loyalty (`dept-of-loyalty`)
 *   7 — Department of AI      (`pillar-6-dept-of-ai`)
 *
 * The per-pillar labels live here too so reporting can title each section
 * correctly without importing a screen module.
 */
import { asBool, asObj, asStr, objArr, type Task } from './types';

/**
 * An idea, plus when it is meant to be implemented.
 *
 * `Task` on its own has no date, so an implemented idea could never be measured
 * against a deadline — reporting could only ever count them. `impl` is the
 * planned implementation date (ISO yyyy-mm-dd, '' when unset); `done` marks it
 * implemented.
 */
export interface Idea extends Task {
  /** Planned implementation date, ISO yyyy-mm-dd. '' when unset. */
  impl: string;
}

export interface Filed {
  text: string;
  /** Display date it was filed. */
  date: string;
  /** The implementation date it was planned for, kept so a report can say
   *  whether it landed on time. '' for ideas filed before this existed. */
  impl: string;
}

export interface IdeaState {
  iod: Idea;
  ideas: Idea[];
  extra: Idea[];
  filed: Filed[];
}

/** Wording that differs between the two idea pillars. */
export interface IdeaLabels {
  /** Section title for the numbered list. */
  listName: string;
  /** Title of the filed archive. */
  archiveTitle: string;
  /** Glyph used as the idea-of-the-day marker. */
  mark: string;
}

export const IDEA_LABELS: Record<string, IdeaLabels> = {
  'dept-of-loyalty': { listName: 'Loyalty Ideas', archiveTitle: 'Implemented Ideas', mark: '♥' },
  'pillar-6-dept-of-ai': { listName: 'AI Ideas', archiveTitle: 'Implemented Ideas', mark: '⚡' },
};

export const blankIdea = (): Idea => ({ text: '', done: false, impl: '' });

export const makeInitial = (): IdeaState => ({
  iod: blankIdea(),
  ideas: Array.from({ length: 5 }, blankIdea),
  extra: [],
  filed: [],
});

const fixIdea = (v: unknown): Idea => {
  const o = asObj(v);
  return { text: asStr(o.text), done: asBool(o.done), impl: asStr(o.impl) };
};

/** Exactly `n` ideas — pads short arrays and truncates long ones, because the
 *  screen indexes ideas[0..4] directly. */
const fixedIdeas = (v: unknown, n: number): Idea[] => {
  const src = Array.isArray(v) ? v : [];
  return Array.from({ length: n }, (_, i) => fixIdea(src[i]));
};

const fixFiled = (v: unknown): Filed => {
  const o = asObj(v);
  return { text: asStr(o.text), date: asStr(o.date), impl: asStr(o.impl) };
};

export const normalize = (s: IdeaState): IdeaState => {
  const o = asObj(s);
  return {
    iod: fixIdea(o.iod),
    ideas: fixedIdeas(o.ideas, 5),
    extra: objArr(o.extra, fixIdea),
    filed: objArr(o.filed, fixFiled),
  };
};
