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
import { asObj, asStr, asYN, fixDeleg, objArr, strArr, withId, type Deleg, type Loose, type YN } from './types';
import { normalize as normP3, type P3State } from './pillar-3';
import { makeInitial as initIdea, normalize as normIdea, type IdeaState } from './idea';
import { makeInitial as initRecords, normalize as normRecords, type P7State } from './records';

export type { YN } from './types';

/**
 * Zaffar's four-box verdict for training, evaluation and fortnightly review.
 *
 * It sits ALONGSIDE `satisfied`, never instead of it: `satisfied` is what the
 * pass/fail notes, the implementation-date gate, the reports and the phone app
 * all read. Every rating change writes both (see `ratingToYN`), so an app that
 * only knows `satisfied` still sees the right pass/fail.
 */
export type Rating = '' | 'excellent' | 'good' | 'average' | 'poor';

export const RATINGS: Exclude<Rating, ''>[] = ['excellent', 'good', 'average', 'poor'];

export const asRating = (v: unknown): Rating =>
  v === 'excellent' || v === 'good' || v === 'average' || v === 'poor' ? v : '';

/** EXCELLENT / GOOD pass, AVERAGE / POOR do not (agreed 18 Sep 2026). */
export const ratingToYN = (r: Rating): YN =>
  r === 'excellent' || r === 'good' ? 'yes' : r === 'average' || r === 'poor' ? 'no' : '';

/**
 * The box to show as picked. A record from before ratings existed — or saved by
 * a build that drops `rating` — has only `satisfied`; it shows as GOOD or POOR,
 * the nearest box on the right side of pass/fail. Display only: nothing is
 * written until someone picks a box.
 */
export const shownRating = (r: Rating, satisfied: YN): Rating =>
  r || (satisfied === 'yes' ? 'good' : satisfied === 'no' ? 'poor' : '');

export interface Training {
  id: string;
  trainee: string;
  trainer: string;
  date: string;
  satisfied: YN;
  rating: Rating;
  remarks: string;
}

export interface Evaluation {
  id: string;
  trainee: string;
  evaluator: string;
  evalDate: string;
  satisfied: YN;
  rating: Rating;
  implDate: string;
  remarks: string;
}

export interface Review {
  id: string;
  trainee: string;
  reviewer: string;
  date: string;
  satisfied: YN;
  rating: Rating;
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

/** A filed (chased and put away) delegation in a business's Delegation department. */
export interface DelegFiled {
  text: string;
  date: string;
}

/** The Delegation department's own list — Pillar 1's delegate or follow-up. */
export interface DelegationBoard {
  items: Deleg[];
  filed: DelegFiled[];
}

export interface Department {
  id: string;
  name: string;
  /** "D1", "D2", … unique within the whole pillar, like system numbers. */
  num: string;
  systems: System[];
  /**
   * The "AM Planning & PM Achievement ($)" department's daily board — the
   * same shape as Pillar 3, one per business. Only present once used.
   */
  amPm?: P3State;
  /** The "Delegation" department's delegate / follow-up list. Only present once used. */
  delegation?: DelegationBoard;
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
export type DeptKind = 'systems' | 'am-pm' | 'delegation' | 'idea-loyalty' | 'idea-ai' | 'records';

export const deptKind = (name: string): DeptKind => {
  const n = name.trim().toLowerCase();
  // Zaffar, 18 Sep 2026: these two work like Pillar 3 and Pillar 1.
  if (n === 'am planning & pm achievement ($)' || n === 'am planning & pm achievement') return 'am-pm';
  if (n === 'delegation') return 'delegation';
  if (n === 'loyalty') return 'idea-loyalty';
  if (n === 'ai') return 'idea-ai';
  if (n === 'record keeping') return 'records';
  return 'systems';
};

/**
 * The five departments every business is expected to run, in Zaffar's order.
 *
 * Seeded into a business ONCE — on create, and once retroactively for
 * businesses that pre-date this. They cannot be deleted from the screen
 * (`isStandardDept`, 18 Sep 2026); a business that lost one before that rule
 * still never has it re-added.
 */
export const DEFAULT_DEPARTMENTS = [
  'AM Planning & PM Achievement ($)',
  'Delegation',
  'Loyalty',
  'AI',
  'Record Keeping',
] as const;

/**
 * One of the five standard departments — these cannot be deleted.
 *
 * Decided by NAME, the same way their colour is, rather than by a stored flag:
 * the phone app rebuilds departments from a fixed field list, so a flag written
 * here would be dropped by the next phone save and the department would
 * silently become deletable again.
 */
export const isStandardDept = (name: string): boolean => {
  const n = name.trim().toLowerCase();
  return DEFAULT_DEPARTMENTS.some((d) => d.trim().toLowerCase() === n);
};

/**
 * The colour a department is drawn in.
 *
 * The five standard departments are the SAME in every business, so they get a
 * fixed colour rather than one derived from their position — plum, the app's
 * pink. Colouring by index meant "Loyalty" was teal in one business and brown
 * in another, which made the row read as a different department.
 *
 * A department the user added themselves has no fixed identity, so it still
 * cycles through the remaining accents by position.
 *
 * Returns an accent KEY, not a hex, so each app resolves it in its own theme —
 * the light plum is 1.6:1 on the dark page and must not be reused there.
 */
export type DeptAccent = 'plum' | 'gold' | 'teal' | 'green' | 'brown' | 'red' | 'blue';

/** Every department the user adds themselves. One colour, not a cycle — see
 *  `deptAccent`. */
const CUSTOM_DEPT_ACCENT: DeptAccent = 'gold';

/**
 * TWO colours in total: plum for the five standard departments, gold for
 * anything the user adds (Zaffar, 18 Sep 2026).
 *
 * Custom departments used to cycle a six-colour palette by position, which had
 * the same failing the standard ones were fixed for: "Operations" was gold in
 * one business and teal in another, and reordering recoloured a department that
 * had not changed. One colour says the only thing worth saying — standard, or
 * mine.
 *
 * `index` is kept in the signature so every existing caller still compiles, and
 * so a future rule that does depend on position has somewhere to go.
 */
export function deptAccent(name: string, index?: number): DeptAccent {
  void index;
  return isStandardDept(name) ? 'plum' : CUSTOM_DEPT_ACCENT;
}

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
  rating: asRating(t.rating),
  remarks: asStr(t.remarks),
});

const fixEval = (t: Loose): Evaluation => ({
  id: withId(t.id),
  trainee: asStr(t.trainee),
  evaluator: asStr(t.evaluator),
  evalDate: asStr(t.evalDate),
  satisfied: asYN(t.satisfied),
  rating: asRating(t.rating),
  implDate: asStr(t.implDate),
  remarks: asStr(t.remarks),
});

const fixReview = (t: Loose): Review => ({
  id: withId(t.id),
  trainee: asStr(t.trainee),
  reviewer: asStr(t.reviewer),
  date: asStr(t.date),
  satisfied: asYN(t.satisfied),
  rating: asRating(t.rating),
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

const fixDelegation = (v: unknown): DelegationBoard => {
  const o = asObj(v);
  return {
    items: objArr(o.items, fixDeleg),
    filed: objArr(o.filed, (f) => ({ text: asStr(f.text), date: asStr(f.date) })),
  };
};

const fixDept = (d: Loose): Department => ({
  id: withId(d.id),
  name: asStr(d.name),
  // '' for blobs written before departments were numbered; normalize() below
  // assigns one, so the value is only ever missing in transit.
  num: asStr(d.num),
  systems: objArr(d.systems, fixSystem),
  /* Carried through explicitly (this builder rebuilds from a whitelist) and
     only when present, so a department that never used its board stays small. */
  ...(d.amPm ? { amPm: normP3(d.amPm as never) } : {}),
  ...(d.delegation ? { delegation: fixDelegation(d.delegation) } : {}),
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

  /* ---- system numbers: POSITIONAL, restarting at S1 in every department ----

     Each department counts its own systems: D1 holds S1, S2, S3 and so does D2.
     Deleting S2 of three renumbers the rest, so a department always reads
     S1, S2, S3 with no gaps — the same rule departments themselves follow.

     This REPLACED an identity rule, where a number was issued once from a
     pillar-wide counter and never reused: that produced D2 starting at S4 because
     D1 had taken the first three, and the workbook asks each department to number
     its own systems from one.

     What this costs: a system number in a report printed before the change may
     now point at a different system. Nothing in the data keys off the number —
     daily answers use `system_id` + `pair_id` — so no recorded answer moves.
     "S-007" and "S-7" from older versions are re-rendered in the same pass. */
  for (const b of businesses) {
    for (const d of b.departments) {
      d.systems.forEach((s, i) => {
        s.num = systemNum(i + 1);
      });
    }
  }

  /* ---- department numbers ----
     ALWAYS sequential from D1, per business, in list order.

     Unlike systems, a department's number is a POSITION, not an identity: it is
     display-only (nothing keys off it — daily answers use system_id + pair_id),
     so leaving gaps after a delete just looks broken. Deleting D2 of five
     renumbers the rest to D1-D4 rather than leaving D1, D3, D4, D5.

     System numbers work the same way, per department, since 2026-09-15. */
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

  /* `nextSysNum` and `nextDeptNum` no longer issue anything — both numbers are
     derived from position now. They stay in the shape, and keep advancing, ONLY
     so an older client reading this blob still finds the fields it expects: the
     blob is a whole-document replace, and a field this app drops is a field that
     app loses. Do not read them to number anything. */
  const mostSys = businesses.reduce(
    (n, b) => b.departments.reduce((m, d) => Math.max(m, d.systems.length), n),
    0,
  );
  const mostDepts = businesses.reduce((n, b) => Math.max(n, b.departments.length), 0);
  return {
    businesses,
    nextSysNum: mostSys + 1,
    nextDeptNum: mostDepts + 1,
  };
};
