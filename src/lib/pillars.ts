/** Pillar accents (hex) — matched 1:1 to mobile src/constants/theme.ts Accents. */
export const Accents = {
  gold: "#9A6A00",
  red: "#C8102E",
  green: "#1F6B4A",
  blue: "#1E4E8C",
  plum: "#6B2D5C",
  teal: "#0E5E6F",
  brown: "#6B4A1F",
  navy: "#1B3A5C",
} as const;

export const HEADING = "#1B3A5C";
export const INK = "#191A1E";
export const FIELD_EMPTY = "#F3FAF6";

export interface PillarMeta {
  n: number;
  /** persistence namespace / route key — MUST match mobile for shared data */
  key: string;
  accent: string;
  name: string;
  tag: string;
  sub?: string;
}

export const PILLARS: PillarMeta[] = [
  { n: 1, key: "pillar-1", accent: Accents.gold, name: "Dreaming to Achieving", tag: "Exact goal, plan & do-or-die day" },
  { n: 2, key: "pillar-2-problem-solving", accent: Accents.red, name: "Problem Solving", tag: "Exact problem & possible solutions" },
  {
    n: 3,
    key: "pillar-3-am-pm",
    accent: Accents.green,
    name: "AM Planning & PM Achievement",
    tag: "The money-making engine",
    sub: "$ This pillar is for money-making activity only",
  },
  {
    n: 4,
    key: "pillar-4-huddle",
    accent: Accents.blue,
    name: "2-Minute Huddle Meetings",
    tag: "Accountability, no excuses",
    sub: "Accountability meetings, no reasons, no excuses.",
  },
  {
    n: 5,
    key: "pillar-8-business-systems",
    accent: Accents.navy,
    name: "Business Systems",
    tag: "12-heading systems for every business",
  },
];

export const pillarByNumber = (n: number): PillarMeta | undefined => PILLARS.find((p) => p.n === n);
