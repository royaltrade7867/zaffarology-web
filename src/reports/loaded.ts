/**
 * Pure types and predicates for loaded pillar data.
 *
 * Deliberately separate from `load.ts`: that module imports axios and
 * expo-secure-store, so anything importing it drags the network stack in too.
 * Report rendering only needs these, and staying pure keeps it runnable (and
 * reviewable) outside the React Native runtime.
 */
import type { PillarMeta } from '@/lib/pillars';
import type { PillarData } from '@/pillars/schemas';

export type LoadStatus =
  /** Loaded fine (may still be an untouched pillar — see `hasContent`). */
  | 'ok'
  /** Nothing saved for this pillar yet. */
  | 'empty'
  /** Server or cache read failed; the report says so rather than omitting it. */
  | 'error';

export interface LoadedPillar {
  meta: PillarMeta;
  status: LoadStatus;
  data?: PillarData;
  /** Set when status is 'error', for the report's "could not load" line. */
  error?: string;
  /** True when the load came from the offline cache rather than the server. */
  fromCache?: boolean;
}

/* ---------------------------------------------------------------- content --- */

const anyText = (arr: { text?: string }[] | undefined) =>
  Array.isArray(arr) && arr.some((t) => (t?.text ?? '').trim());

/**
 * Whether the user has actually put anything in this pillar. Drives the "nothing
 * to report yet" guard and the "Not started" rows in the cross-pillar report —
 * an untouched pillar is not the same as a failed one.
 */
export function hasContent(loaded: LoadedPillar): boolean {
  if (loaded.status !== 'ok' || !loaded.data) return false;
  const d = loaded.data;
  switch (d.kind) {
    case 'p1':
      return d.data.goals.some(
        (g) =>
          g.goal.trim() ||
          g.plan.trim() ||
          g.target.trim() ||
          g.work.text.trim() ||
          anyText(g.dod) ||
          anyText(g.extra) ||
          g.deleg.some((x) => x.text.trim()),
      );
    case 'p2':
      return !!(d.data.problem.trim() || anyText(d.data.sols) || d.data.filed.length);
    case 'p3':
      return !!(
        d.data.work.text.trim() ||
        anyText(d.data.dod) ||
        anyText(d.data.extra) ||
        d.data.pm.trim() ||
        d.data.money.trim() ||
        d.data.history.length
      );
    case 'p4':
      return d.data.items.some((i) => i.name.trim()) || d.data.filed.length > 0;
    case 'business-systems':
      return d.data.businesses.length > 0;
  }
}
