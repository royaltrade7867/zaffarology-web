/** Pillar 2 — Problem Solving (`pillar-2-problem-solving`). Snapshot-only, no history. */
import { asObj, asStr, fixTask, objArr, type Task } from './types';

export type Sol = Task;

export interface Filed {
  problem: string;
  solution: string;
  date: string;
}

export interface P2State {
  problem: string;
  sols: Sol[];
  filed: Filed[];
}

export const makeInitial = (): P2State => ({
  problem: '',
  sols: [{ text: '', done: false }],
  filed: [],
});

const fixFiled = (v: unknown): Filed => {
  const o = asObj(v);
  return { problem: asStr(o.problem), solution: asStr(o.solution), date: asStr(o.date) };
};

export const normalize = (s: P2State): P2State => {
  const o = asObj(s);
  const sols = objArr(o.sols, fixTask);
  return {
    problem: asStr(o.problem),
    // The screen indexes sols[0], so there is always at least one row.
    sols: sols.length ? sols : [{ text: '', done: false }],
    filed: objArr(o.filed, fixFiled),
  };
};
