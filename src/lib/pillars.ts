/**
 * Pillar accents, as CSS variables rather than fixed hexes.
 *
 * These are read into inline `style` props all over the pillar screens. A fixed
 * hex there cannot follow the theme, and the LIGHT accents are unreadable on
 * the dark page — plum sits at 1.60:1 on navy, gold at 2.91:1. Pointing them at
 * the variables means one definition per theme in globals.css and every call
 * site follows automatically, with no edit.
 *
 * The literal values live in globals.css; `AccentHex` below keeps the raw light
 * values for the few places that genuinely need a hex (report HTML, which is
 * rendered outside the document and printed on paper).
 */
export const Accents = {
  gold: "var(--p1)",
  red: "var(--p2)",
  green: "var(--p3)",
  blue: "var(--p4)",
  plum: "var(--p5)",
  teal: "var(--p6)",
  brown: "var(--p7)",
  navy: "var(--p8)",
} as const;

/**
 * The same accents as real hexes, light theme.
 *
 * Only for output that leaves the document: a report is generated as standalone
 * HTML for an email or a PDF, where `var(--p1)` resolves against nothing. Never
 * use these in a component — they will not follow the theme.
 */
export const AccentHex = {
  /** Darkened from #9A6A00, which scored 4.38:1 as text on paper — the only
   *  accent to miss 4.5:1. Must match --gold/--p1 in globals.css, Colors.light
   *  in the mobile theme, and the report palette; a fixture asserts all four. */
  gold: "#8F6200",
  red: "#C8102E",
  green: "#1F6B4A",
  blue: "#1E4E8C",
  plum: "#6B2D5C",
  teal: "#0E5E6F",
  brown: "#6B4A1F",
  navy: "#1B3A5C",
} as const;

export const HEADING = "var(--heading)";
export const INK = "var(--ink)";
export const FIELD_EMPTY = "var(--field-empty)";
/**
 * The "still to fill" wash for PILLAR screens: red while empty, green once
 * written in.
 *
 * Deliberately not applied outside the five pillars. The shared `TextField` /
 * `TextArea` are used by Notes, meetings and the auth screens too, and a red
 * sign-in form reads as an error state on the first screen anyone sees — so
 * those keep the green-when-empty rule and this is opted into per callsite.
 */
export const FIELD_RED = "var(--field-red)";
export const FIELD_RED_BORDER = "var(--field-red-border)";

export interface PillarMeta {
  n: number;
  /** persistence namespace / route key — MUST match mobile for shared data */
  key: string;
  /** Theme-aware: a `var(--pN)`. Use this in components. */
  accent: string;
  /** The same accent as a literal hex, light theme. ONLY for output that leaves
   *  the document — report HTML for an email or a PDF, where a var() resolves
   *  against nothing. */
  accentHex: string;
  name: string;
  tag: string;
  sub?: string;
}

export const PILLARS: PillarMeta[] = [
  { n: 1, key: "pillar-1", accent: Accents.gold, accentHex: AccentHex.gold, name: "Dreaming to Achieving", tag: "Exact goal, plan & do-or-die day" },
  { n: 2, key: "pillar-2-problem-solving", accent: Accents.red, accentHex: AccentHex.red, name: "Problem Solving", tag: "Exact problem & possible solutions" },
  {
    n: 3,
    key: "pillar-3-am-pm",
    accent: Accents.green, accentHex: AccentHex.green,
    name: "AM Planning & PM Achievement",
    tag: "The money-making engine",
    sub: "$ This pillar is for money-making activity only",
  },
  {
    n: 4,
    key: "pillar-4-huddle",
    accent: Accents.blue, accentHex: AccentHex.blue,
    name: "2-Minute Huddle Meetings",
    tag: "Accountability, no excuses",
    sub: "Accountability meetings, no reasons, no excuses.",
  },
  {
    n: 5,
    key: "pillar-8-business-systems",
    accent: Accents.navy, accentHex: AccentHex.navy,
    name: "Business Systems",
    tag: "12-heading systems for every business",
  },
];

export const pillarByNumber = (n: number): PillarMeta | undefined => PILLARS.find((p) => p.n === n);

/**
 * Should row `i` of an ordered list be locked?
 *
 * The rule is "fill them in order", so an EMPTY row is locked until the one
 * before it has something in it. Two things that rule must never do:
 *
 *  - lock a row that already has text. Typing 1, 2, 3 and then clearing 2 used
 *    to lock 3 — text you had already written, now uneditable, with no way to
 *    fix it except deleting it. That is the bug this function exists to stop.
 *  - look only at `i - 1`. What matters is whether ANY earlier row has content:
 *    after clearing 2, row 3 follows a filled row 1, so the list is still being
 *    worked on in order.
 *
 * Shared because it was written inline at six call sites, and a rule copied six
 * times is a rule that gets fixed in five.
 */
export const rowLocked = (items: { text: string }[], i: number): boolean => {
  if (i === 0) return false;
  // Never lock a row that already has text. This is the whole point: typing
  // 1, 2, 3 then clearing 2 used to lock 3, stranding work you had done.
  if (items[i]?.text.trim()) return false;
  // An empty row opens when the one before it has something in it, so the list
  // still fills top-down and only ONE empty row is ever open at a time.
  return !items[i - 1]?.text.trim();
};

/**
 * `rowLocked`, plus a required date: the next row opens only once the one
 * before it has text AND its date.
 *
 * Zaffar, 19 Sep: "If the date is not chosen it must not write further.
 * Deadline, implementation dates are compulsory." Same safety rule as above:
 * a row that already has text is never locked, so nothing written is stranded.
 */
export const rowLockedDated = <K extends string>(
  items: ({ text: string } & Record<K, string>)[],
  i: number,
  dateKey: K,
): boolean => {
  if (i === 0) return false;
  if (items[i]?.text.trim()) return false;
  const prev = items[i - 1];
  return !prev?.text.trim() || !prev[dateKey]?.trim();
};

/** Why row `i` is locked, in plain words, for the alert a locked row shows. */
export const lockReason = (items: { text: string }[], i: number, dateLabel: string): string => {
  const prev = items[i - 1];
  if (!prev?.text.trim()) return "Fill in the one above first.";
  return `Choose the ${dateLabel} for the one above first.`;
};

/**
 * The id the BACKEND uses for a pillar in `per_pillar` maps — which is not the
 * number shown in the UI. Pillar 5 is stored as `pillar-8-business-systems` and
 * reported as 8, because renumbering would orphan every existing blob row.
 *
 * Derived from `key` rather than hand-listed so the two cannot drift. The Team
 * table used to look up `p.n`, so Pillar 5 asked for "5", got nothing, and
 * showed a grey 0% for every member no matter how much work they had done.
 */
export const backendPillarId = (p: PillarMeta): string => {
  const m = /^pillar-(\d+)/.exec(p.key);
  return m ? m[1] : String(p.n);
};
