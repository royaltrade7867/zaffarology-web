/**
 * Registry of every pillar's state shape, keyed by STORAGE KEY.
 *
 * Always look a pillar up through `PILLARS` (`@/constants/pillars`) → `key` → this
 * registry. Display number, filename and storage key all disagree in this codebase
 * (display 5 is `pillar-8-business-systems`, in the file `pillar-8.tsx`), so any
 * code that assumes `pillar-${n}` will read the wrong pillar's data.
 */
import * as businessSystems from './business-systems';
import * as p1 from './pillar-1';
import * as p2 from './pillar-2';
import * as p3 from './pillar-3';
import * as p4 from './pillar-4';

/** Discriminated union so consumers can switch exhaustively with real types. */
export type PillarData =
  | { kind: 'p1'; data: p1.P1State }
  | { kind: 'p2'; data: p2.P2State }
  | { kind: 'p3'; data: p3.P3State }
  | { kind: 'p4'; data: p4.P4State }
  | { kind: 'business-systems'; data: businessSystems.P8State };

export type PillarKind = PillarData['kind'];

interface SchemaEntry {
  kind: PillarKind;
  makeInitial: () => object;
  normalize: (s: never) => object;
}

export const PILLAR_SCHEMAS: Record<string, SchemaEntry> = {
  'pillar-1': { kind: 'p1', makeInitial: p1.makeInitial, normalize: p1.normalize as SchemaEntry['normalize'] },
  'pillar-2-problem-solving': { kind: 'p2', makeInitial: p2.makeInitial, normalize: p2.normalize as SchemaEntry['normalize'] },
  'pillar-3-am-pm': { kind: 'p3', makeInitial: p3.makeInitial, normalize: p3.normalize as SchemaEntry['normalize'] },
  'pillar-4-huddle': { kind: 'p4', makeInitial: p4.makeInitial, normalize: p4.normalize as SchemaEntry['normalize'] },
  'pillar-8-business-systems': {
    kind: 'business-systems',
    makeInitial: businessSystems.makeInitial,
    normalize: businessSystems.normalize as SchemaEntry['normalize'],
  },
};

/**
 * Heal a raw blob for one pillar key, mirroring what `usePillarState` does on load
 * (`{ ...makeInitial(), ...raw }` then normalise) so report data matches the screen.
 * Returns null for an unknown key. Never throws.
 */
export function healBlob(key: string, raw: unknown): PillarData | null {
  const entry = PILLAR_SCHEMAS[key];
  if (!entry) return null;
  const merged = { ...entry.makeInitial(), ...(raw && typeof raw === 'object' ? raw : {}) };
  const data = entry.normalize(merged as never);
  return { kind: entry.kind, data } as PillarData;
}

export { businessSystems, p1, p2, p3, p4 };
