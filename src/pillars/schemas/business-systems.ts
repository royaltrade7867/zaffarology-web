/**
 * Pillar 5 (display) — Business Systems (`pillar-8-business-systems`).
 *
 * The deepest shape in the app: businesses → departments → systems, each system
 * carrying 12 sections plus training / evaluation / review logs.
 *
 * Privacy note for reporting: this pillar holds nine person-name fields, each
 * paired with a `satisfied` verdict and free-text remarks — effectively named
 * performance judgments. Anything that exports it is exporting that.
 */
import { asStr, asYN, objArr, strArr, withId, type Loose, type YN } from './types';
import { makeInitial as initIdea, normalize as normIdea, type IdeaState } from './idea';
import { makeInitial as initRecords, normalize as normRecords, type P7State } from './records';

export type { YN } from './types';

export interface Training {
  id: string;
  trainee: string;
  trainer: string;
  date: string;
  satisfied: YN;
  remarks: string;
}

export interface Evaluation {
  id: string;
  trainee: string;
  evaluator: string;
  evalDate: string;
  satisfied: YN;
  implDate: string;
  remarks: string;
}

export interface Review {
  id: string;
  trainee: string;
  reviewer: string;
  date: string;
  satisfied: YN;
  remarks: string;
}

/**
 * One effort question and the result question that belongs to it.
 *
 * Sections 7 and 8 stay separate ON SCREEN — row n of each is this pair. The
 * `id` is what makes daily answers trustworthy: efforts used to be plain
 * strings addressed by array index, so deleting question 1 would silently
 * re-point every historical answer to a different question.
 */
export interface EffortPair {
  id: string;
  /** Section 7, row n. */
  effort: string;
  /** Section 8, row n. */
  result: string;
}

export interface System {
  id: string;
  num: string;
  name: string;
  freq: string;
  responsible: string;
  accountable: string;
  guide: string;
  /** User ids of tagged connections, '' when the name is just typed text.
   *  Optional by design: tagging never replaces free-typed names. */
  responsibleUserId: string;
  accountableUserId: string;
  guideUserId: string;
  progression: string;
  jobs: string[];
  /**
   * The paired questions. This is the source of truth.
   *
   * `efforts` and `results` below are kept WRITTEN AND IN STEP with it, because
   * the web app writes these same blobs with no normalizers of its own — it
   * would drop `pairs` entirely. Keeping the flat arrays populated means a web
   * save costs the pairing (rebuilt by index on the next mobile load) rather
   * than the questions themselves.
   */
  pairs: EffortPair[];
  /** @deprecated Mirror of `pairs[].effort`. Never write directly. */
  efforts: string[];
  /** @deprecated Mirror of `pairs[].result`. Never write directly. */
  results: string[];
  steps: string[];
  trainings: Training[];
  evals: Evaluation[];
  reviews: Review[];
  /**
   * Payload for a system that lives in a Loyalty / AI / Record Keeping
   * department, carrying the screen those pillars used to have.
   *
   * Optional and only populated for that kind: an ordinary 12-section system
   * never allocates them, so the blob does not grow for the majority case.
   * A department renamed away from "Loyalty" leaves this data in place rather
   * than destroying it — rename it back and the ideas are still there.
   */
  idea?: IdeaState;
  records?: P7State;
}

export interface Department {
  id: string;
  name: string;
  /** "D1", "D2", … unique within the whole pillar, like system numbers. */
  num: string;
  systems: System[];
}

export interface Business {
  id: string;
  name: string;
  departments: Department[];
  /**
   * The five standard departments have been added to this business.
   *
   * Load-bearing: without it the back-fill would run on EVERY read, so a user
   * who deleted "AI" would find it back next time they opened the pillar. The
   * flag is set the moment the seed runs, so the seed is a one-time event per
   * business, not a rule the app keeps re-applying.
   */
  seeded?: boolean;
}

export interface P8State {
  businesses: Business[];
  nextSysNum: number;
  nextDeptNum: number;
}

export const makeInitial = (): P8State => ({ businesses: [], nextSysNum: 1, nextDeptNum: 1 });

/**
 * "S1", not "S-001" and not "S-1": the padding made short lists look like
 * inventory codes, and the dash made a two-character label read as a range.
 *
 * Old blobs still hold "S-1"/"D-1"; `numOf` strips every non-digit, so those
 * keep parsing and simply re-render in the new form on the next save.
 */
export const systemNum = (n: number): string => `S${n}`;
export const deptNum = (n: number): string => `D${n}`;

/** The digits inside "S-007" / "D12", or 0 when there are none. */
export const numOf = (raw: unknown): number => {
  const parsed = parseInt(asStr(raw).replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Departments whose systems are NOT the 12-section kind.
 *
 * Loyalty, AI and Record Keeping were pillars 6-8 before the 5-pillar
 * restructure. Their work does not decompose into "responsible / effort
 * question / training log" — it is a running list of ideas, or an A-Z index —
 * so a system inside one of these keeps the screen it always had. Matching is
 * by department NAME because that is what the seed writes and what a user
 * renaming a department would change; a renamed department reverts to the
 * ordinary 12-section system, which is the honest behaviour.
 */
export type DeptKind = 'systems' | 'idea-loyalty' | 'idea-ai' | 'records';

export const deptKind = (name: string): DeptKind => {
  const n = name.trim().toLowerCase();
  if (n === 'loyalty') return 'idea-loyalty';
  if (n === 'ai') return 'idea-ai';
  if (n === 'record keeping') return 'records';
  return 'systems';
};

/**
 * The five departments every business is expected to run, in Zaffar's order.
 *
 * Seeded into a business ONCE — on create, and once retroactively for
 * businesses that pre-date this. They are ordinary departments afterwards:
 * renameable, deletable, and never re-added once removed.
 */
export const DEFAULT_DEPARTMENTS = [
  'AM Planning & PM Achievement ($)',
  'Delegation',
  'Loyalty',
  'AI',
  'Record Keeping',
] as const;

export const blankDepartment = (name: string, n: number): Department => ({
  id: withId(undefined),
  name,
  num: deptNum(n),
  systems: [],
});

/**
 * A stable id for a migrated pair, derived from the SYSTEM and the question text.
 *
 * Migration happens on every load, and the read-only surfaces (the Home card,
 * the daily-report screen) never write the blob back — only the Pillar 5 editor
 * does. A random id would therefore be re-minted on every load, and yesterday's
 * answers would point at an id nothing has any more. Deriving it means the same
 * question always resolves to the same id, whether or not the blob was ever
 * saved.
 *
 * Editing a question's wording DOES change its id, which is the honest
 * behaviour: a rewritten question is a different question, and its old answers
 * belong to the old wording. Once the editor saves, the id is stored and frozen,
 * so later edits keep it.
 */
const derivedPairId = (systemId: string, index: number, effort: string, result: string): string => {
  const seed = `${systemId}|${index}|${effort.trim()}|${result.trim()}`;
  // djb2 — short, dependency-free and stable across platforms. Collisions do
  // not matter beyond one system's question list.
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  return `p${(h >>> 0).toString(36)}${index}`;
};

export const blankPair = (): EffortPair => ({
  id: withId(undefined),
  effort: '',
  result: '',
});

/**
 * Rewrite the flat mirrors from `pairs`.
 *
 * Call after ANY mutation of `pairs`. Nothing should ever write `efforts` or
 * `results` directly — they exist only so a web-app save degrades gracefully.
 */
export const syncPairMirrors = (sys: System): void => {
  sys.efforts = sys.pairs.map((p) => p.effort);
  sys.results = sys.pairs.map((p) => p.result);
};

export const blankSystem = (name: string, n: number): System => ({
  id: withId(undefined),
  num: systemNum(n),
  name,
  freq: '',
  responsible: '',
  accountable: '',
  guide: '',
  responsibleUserId: '',
  accountableUserId: '',
  guideUserId: '',
  progression: '',
  jobs: [''],
  pairs: [blankPair()],
  efforts: [''],
  results: [''],
  steps: [''],
  trainings: [],
  evals: [],
  reviews: [],
});

const fixTraining = (t: Loose): Training => ({
  id: withId(t.id),
  trainee: asStr(t.trainee),
  trainer: asStr(t.trainer),
  date: asStr(t.date),
  satisfied: asYN(t.satisfied),
  remarks: asStr(t.remarks),
});

const fixEval = (t: Loose): Evaluation => ({
  id: withId(t.id),
  trainee: asStr(t.trainee),
  evaluator: asStr(t.evaluator),
  evalDate: asStr(t.evalDate),
  satisfied: asYN(t.satisfied),
  implDate: asStr(t.implDate),
  remarks: asStr(t.remarks),
});

const fixReview = (t: Loose): Review => ({
  id: withId(t.id),
  trainee: asStr(t.trainee),
  reviewer: asStr(t.reviewer),
  date: asStr(t.date),
  satisfied: asYN(t.satisfied),
  remarks: asStr(t.remarks),
});

const fixPair = (p: Loose): EffortPair => ({
  id: withId(p.id),
  effort: asStr(p.effort),
  result: asStr(p.result),
});

const fixSystem = (s: Loose): System => ({
  id: withId(s.id),
  num: asStr(s.num),
  name: asStr(s.name),
  freq: asStr(s.freq),
  responsible: asStr(s.responsible),
  accountable: asStr(s.accountable),
  guide: asStr(s.guide),
  responsibleUserId: asStr(s.responsibleUserId),
  accountableUserId: asStr(s.accountableUserId),
  guideUserId: asStr(s.guideUserId),
  progression: asStr(s.progression),
  jobs: strArr(s.jobs, ['']),
  // Built below in `normalize`, which needs the flat arrays to migrate from.
  pairs: objArr(s.pairs, fixPair),
  efforts: strArr(s.efforts, ['']),
  results: strArr(s.results, ['']),
  steps: strArr(s.steps, ['']),
  trainings: objArr(s.trainings, fixTraining),
  evals: objArr(s.evals, fixEval),
  reviews: objArr(s.reviews, fixReview),
  /* Carried through explicitly: this builder rebuilds from a whitelist, so an
     unnamed field is dropped on every load. Only normalised when present, so
     an ordinary system stays free of them. */
  ...(s.idea ? { idea: normIdea(s.idea as never) } : {}),
  ...(s.records ? { records: normRecords(s.records as never) } : {}),
});

const fixDept = (d: Loose): Department => ({
  id: withId(d.id),
  name: asStr(d.name),
  // '' for blobs written before departments were numbered; normalize() below
  // assigns one, so the value is only ever missing in transit.
  num: asStr(d.num),
  systems: objArr(d.systems, fixSystem),
});

const fixBiz = (b: Loose): Business => ({
  id: withId(b.id),
  name: asStr(b.name),
  departments: objArr(b.departments, fixDept),
  // Carried through explicitly: these builders rebuild from a whitelist, so an
  // unnamed field is dropped. Losing this would re-seed on every single load.
  seeded: b.seeded === true,
});

export const normalize = (st: P8State): P8State => {
  const loose = st as unknown as Loose;
  const businesses = objArr(loose.businesses, fixBiz);

  /* ---- effort/result pairing ----
     Older blobs (and anything the web app saves) carry two independent
     `string[]`s with no guarantee they are the same length. Zip them by index:
     that is the relationship the workbook always implied, and the only one the
     old data can express. A longer `efforts` list simply yields pairs with a
     blank `result`.

     Pairs already present win — they carry ids that daily answers point at, so
     rebuilding them from the mirrors would orphan every historical answer. */
  for (const b of businesses) {
    for (const d of b.departments) {
      for (const s of d.systems) {
        if (!s.pairs.length) {
          const n = Math.max(s.efforts.length, s.results.length);
          s.pairs = Array.from({ length: n }, (_, i) => {
            const effort = s.efforts[i] ?? '';
            const result = s.results[i] ?? '';
            // Derived, NOT random: this runs on every load, and the surfaces
            // that only read the blob can never persist a fresh id.
            return { id: derivedPairId(s.id, i, effort, result), effort, result };
          });
        }
        // A system with nothing at all still needs one row to type into.
        if (!s.pairs.length) s.pairs = [blankPair()];
        // The mirrors are derived, never authoritative.
        syncPairMirrors(s);
      }
    }
  }

  /* ---- system numbers: drop the padding and the dash, keep the number ----
     "S-007" and "S-7" were written by earlier versions. Re-rendering as "S7"
     keeps the identity of the system while matching the new format, so a system
     does not appear to change number when the app updates. */
  let highestSys = 0;
  for (const b of businesses) {
    for (const d of b.departments) {
      for (const s of d.systems) {
        const n = numOf(s.num);
        if (n > 0) {
          s.num = systemNum(n);
          if (n > highestSys) highestSys = n;
        }
      }
    }
  }

  /* ---- department numbers ----
     ALWAYS sequential from D1, per business, in list order.

     Unlike systems, a department's number is a POSITION, not an identity: it is
     display-only (nothing keys off it — daily answers use system_id + pair_id),
     so leaving gaps after a delete just looks broken. Deleting D2 of five
     renumbers the rest to D1-D4 rather than leaving D1, D3, D4, D5.

     System numbers deliberately do NOT work this way: S2 appears in emailed
     daily reports, so resequencing would make an old report contradict a new
     one. */
  /* ---- the five standard departments ----
     Businesses created before this existed get them once, retroactively. The
     `seeded` flag is what makes it ONCE: without it this runs on every read and
     a department the user deleted would reappear next time they opened the
     pillar.

     Matching is by NAME, case-insensitively, so a business that already has its
     own "Loyalty" does not end up with two. An unseeded business with all five
     already present is simply marked and left alone. */
  for (const b of businesses) {
    if (b.seeded) continue;
    const existing = new Set(b.departments.map((d) => d.name.trim().toLowerCase()));
    for (const name of DEFAULT_DEPARTMENTS) {
      if (existing.has(name.trim().toLowerCase())) continue;
      // Number is a placeholder: the pass below renumbers every department by
      // position anyway.
      b.departments.push(blankDepartment(name, 0));
    }
    b.seeded = true;
  }

  /* Renumber AFTER seeding, so the five land in sequence with whatever was
     already there and no gap is left behind. */
  for (const b of businesses) {
    b.departments.forEach((d, i) => {
      d.num = deptNum(i + 1);
    });
  }

  // Systems keep their identity, so their counter must never re-issue a number
  // already in use. Departments are positional now, so `nextDeptNum` is only
  // kept for older clients and the web app, which still read it.
  const storedSys = typeof loose.nextSysNum === 'number' ? (loose.nextSysNum as number) : 1;
  const mostDepts = businesses.reduce((n, b) => Math.max(n, b.departments.length), 0);
  return {
    businesses,
    nextSysNum: Math.max(storedSys, highestSys + 1),
    nextDeptNum: mostDepts + 1,
  };
};
