/**
 * Instructions shown on the About tab: how to use the app in general, and what
 * each pillar asks of you.
 *
 * The text is the workbook's, not new copy. General instructions come straight
 * from `HOW_TO_USE`; a pillar's instructions are built from the content it
 * already carries — its steps, summary and core truth.
 */
import { PILLARS as META, type PillarMeta } from '@/lib/pillars';
import { PILLARS as CONTENT, type Pillar } from '@/content/pillars';

/**
 * Display pillar number → the id it has in `content/pillars.ts`.
 *
 * These two files are NOT in the same order. The content file keeps the
 * workbook's original numbering, where Business Systems is 8 and Loyalty is 5;
 * the app shows Business Systems as pillar 5. Matching on title text almost
 * works and then quietly fails on pillar 1, whose content is titled "EXACT GOAL
 * AND PLAN" rather than "Dreaming to Achieving" — which would attach the wrong
 * instructions to a pillar with no error anywhere. So the map is explicit.
 */
const CONTENT_ID_FOR_DISPLAY: Record<number, number> = {
  1: 1, // Dreaming to Achieving   → EXACT GOAL AND PLAN
  2: 2, // Problem Solving
  3: 3, // AM Planning & PM Achievement
  4: 4, // 2-Minute Huddle Meetings
  5: 8, // Business Systems        ← content id 8
};

export interface PillarInstructions {
  meta: PillarMeta;
  /** The workbook title, which differs from the app's short name on pillar 1. */
  title: string;
  tagline: string;
  /** What to do, in order. Empty for the pillars that are a live tracker. */
  steps: { num: string; heading: string; subtext?: string }[];
  summary: string;
  coreTruth: string;
  zaffarSays: string;
  /**
   * How this pillar is actually worked, when it is not a read-and-fill page.
   * Written per pillar because "open it daily" is not derivable from the data.
   */
  howItWorks: string;
}

/** The one sentence that explains a pillar's rhythm, keyed by DISPLAY number. */
const HOW_IT_WORKS: Record<number, string> = {
  1: 'Write one exact goal, the plan behind it and the do-or-die day. Come back as the plan moves.',
  2: 'Add a problem, then list the possible solutions under it. Work down the list until one holds. Tick ✓ the solution that works, then Delete it, File it, or mark the problem Solved.',
  3: 'A daily page. Plan the money-making actions in the morning, mark what was achieved in the evening.',
  4: 'A running board. Add the tasks a huddle agrees, tick them off, and extend the ones that slip with a reason.',
  5: 'Build the tree once: businesses, departments, then a system in each. Then answer its effort and result questions each day from the Reports tab.',
};

/** General instructions, in the workbook's words. */
export { HOW_TO_USE } from '@/content/pillars';

/** Per-pillar instructions, in the app's display order. */
export const PILLAR_INSTRUCTIONS: PillarInstructions[] = META.map((meta) => {
  const id = CONTENT_ID_FOR_DISPLAY[meta.n];
  const c = CONTENT.find((x) => x.id === id) as Pillar | undefined;
  return {
    meta,
    title: c?.title ?? meta.name.toUpperCase(),
    tagline: c?.tagline ?? meta.tag,
    steps: (c?.steps ?? []).map((s) => ({
      num: s.num,
      heading: s.heading,
      subtext: s.subtext,
    })),
    summary: c?.summary ?? '',
    coreTruth: c?.coreTruth ?? '',
    zaffarSays: c?.zaffarSays ?? '',
    howItWorks: HOW_IT_WORKS[meta.n] ?? '',
  };
});
