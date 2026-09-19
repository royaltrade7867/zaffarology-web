/**
 * Sections 7 and 8 of a Pillar 5 system must be two views of ONE `pairs` array.
 *
 * THE BUG THIS EXISTS FOR. The web screen bound both sections to `efforts` and
 * `results` — the DEPRECATED flat mirrors. `fixSystem` rebuilds those FROM
 * `pairs` on load, so a typed answer:
 *   1. saved to the server correctly (the POST body held it),
 *   2. was discarded the next time the blob was normalized, and
 *   3. was written back as BLANK by the following save.
 * Silent, and destructive across devices: an answer typed on the phone was
 * erased by opening the same system in the browser and touching any field.
 *
 * Daily answers are keyed by `pair.id`, so the pairing and the id are
 * load-bearing — index-based keys re-attach answers to the wrong question after
 * a delete.
 */
import { readFileSync, readdirSync } from "node:fs";

import {
  blankPair,
  makeInitial,
  normalize,
  syncPairMirrors,
  type P8State,
  type System,
} from "@/pillars/schemas/business-systems";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};

/** A full save -> load cycle, exactly as the blob store does it. */
const trip = (s: P8State): P8State => normalize(JSON.parse(JSON.stringify(s)));

const withSystem = (mut: (s: System) => void): System => {
  const st = trip({
    businesses: [
      {
        id: "b",
        name: "B",
        seeded: true,
        departments: [{ id: "d", name: "Delegation", systems: [{ id: "s", num: 1, name: "S" }] }],
      },
    ],
  } as unknown as P8State);
  // By id: since 19 Sep a missing standard department is re-added in front
  // of this one, so its position is not fixed.
  const dept = (x: P8State) => x.businesses[0].departments.find((d) => d.id === "d")!;
  const sys = dept(st).systems[0];
  mut(sys);
  return dept(trip(st)).systems[0];
};

/* ---------------------- the data-loss bug itself ------------------------- */

// Writing ONLY the mirror is what the broken screen did.
const viaMirror = withSystem((s) => {
  (s as unknown as { efforts: string[] }).efforts = ["Did you call 20 leads?"];
});
ck(
  "writing only the deprecated mirror LOSES the answer (the bug, still reproducible)",
  viaMirror.efforts[0] === "" && viaMirror.pairs[0].effort === "",
  JSON.stringify(viaMirror.efforts),
);

// Mutating `pairs` and syncing is what the screen must do.
const viaPairs = withSystem((s) => {
  s.pairs[0].effort = "Did you call 20 leads?";
  syncPairMirrors(s);
});
ck(
  "mutating pairs SURVIVES a round-trip",
  viaPairs.pairs[0].effort === "Did you call 20 leads?",
  viaPairs.pairs[0].effort,
);
ck("the mirror is rewritten in step", viaPairs.efforts[0] === "Did you call 20 leads?");
ck("the pair keeps a stable id", !!viaPairs.pairs[0].id);

/* ----------------------------- the pairing ------------------------------- */

const added = withSystem((s) => {
  s.pairs[0].effort = "A";
  s.pairs.push(blankPair());
  s.pairs[1].effort = "B";
  syncPairMirrors(s);
});
ck("adding an effort adds a blank result", added.results.length === 2 && added.results[1] === "");
ck("both efforts survive", added.efforts.join("") === "AB", added.efforts.join(""));

const deleted = withSystem((s) => {
  s.pairs[0].effort = "A";
  s.pairs[0].result = "ra";
  s.pairs.push(blankPair());
  s.pairs[1].effort = "B";
  s.pairs[1].result = "rb";
  syncPairMirrors(s);
  s.pairs.splice(0, 1);
  syncPairMirrors(s);
});
ck(
  "deleting a row removes BOTH sides of that pair",
  deleted.efforts.join("") === "B" && deleted.results.join("") === "rb",
  `${deleted.efforts.join("")} / ${deleted.results.join("")}`,
);

/* ------------------- the screen may not regress to mirrors --------------- */

const screen = readFileSync("src/pillars/pillar-5-business-systems.tsx", "utf8");
ck(
  "sections 7/8 are bound to pairs, never to the flat mirrors",
  !/items=\{sys\.(efforts|results)\}/.test(screen) && !/s\.(efforts|results)\s*=/.test(screen),
);
ck("the screen edits pairs through the syncing helper", /syncPairMirrors\(s\)/.test(screen));
ck("a pair side list exists", /PairSideList/.test(screen));
ck("rows are keyed by pair id, not index", /key=\{p\.id\}/.test(screen));

/* No OTHER web screen may write the mirrors either. */
const others = [
  ...readdirSync("src/pillars").filter((f) => f.endsWith(".tsx")).map((f) => `src/pillars/${f}`),
  ...readdirSync("src/components").filter((f) => f.endsWith(".tsx")).map((f) => `src/components/${f}`),
];
const writers = others.filter((f) => /\.(efforts|results)\s*=[^=]/.test(readFileSync(f, "utf8")));
ck("nothing writes efforts/results directly", writers.length === 0, writers.join(", "));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web effort-pair checks passed (" + pass + ")");
