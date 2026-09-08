/**
 * Pillar 8 (display) — Department of Record Keeping (`pillar-7-records`).
 *
 * `link` is user-supplied and ends up in an href, so any report renderer must
 * scheme-check it before linking (see `reports/html/escape.ts`).
 */
import { asObj, asStr, objArr, withId } from './types';

export interface Rec {
  id: string;
  letter: string;
  name: string;
  where: string;
  link: string;
  date: string;
}

export interface P7State {
  records: Rec[];
}

export const makeInitial = (): P7State => ({ records: [] });

/** A-Z bucket derived from the name; non-alphabetic names fall into Z. */
export const letterOf = (name: string): string => {
  const m = name.trim().toUpperCase().match(/[A-Z]/);
  return m ? m[0] : 'Z';
};

const fixRec = (v: unknown): Rec => {
  const o = asObj(v);
  const name = asStr(o.name);
  return {
    id: withId(o.id),
    // Recompute rather than trust: a stored letter can disagree with the name.
    letter: asStr(o.letter) || letterOf(name),
    name,
    where: asStr(o.where),
    link: asStr(o.link),
    date: asStr(o.date),
  };
};

export const normalize = (s: P7State): P7State => ({
  records: objArr(asObj(s).records, fixRec),
});
