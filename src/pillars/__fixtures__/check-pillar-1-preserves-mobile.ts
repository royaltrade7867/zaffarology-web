/**
 * Opening Pillar 1 on the web must not delete what the phone wrote.
 *
 * Mobile stores each goal's deadline and daily task lists INSIDE the goal. This
 * screen once kept those lists at the top level and rebuilt every goal from
 * `goal`/`plan` alone, so the other five fields were dropped and saved back over
 * the shared blob — merely viewing the page destroyed a phone user's
 * Work-of-the-Day, Do-or-Die list, extras and delegations. That shipped.
 *
 * The screen now renders per-goal lists and takes its types and normalizer from
 * the shared schema. These checks pin both halves: the data survives a round
 * trip, and the screen no longer keeps a private copy of the shape that could
 * drift from mobile again.
 */
import { readFileSync } from "fs";

import { normalize, type GoalPlan, type P1State } from "@/pillars/schemas/pillar-1";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

/* ---------------------- the data survives a web load ---------------------- */

const MOBILE_ONLY = ["target", "work", "dod", "extra", "deleg"] as const;
const fromMobile = {
  goals: [{
    goal: "Hit $1M", plan: "Weekly reviews", target: "2026-12-31",
    work: { text: "Call 10 leads", done: false },
    dod: [{ text: "Send proposal", done: true }],
    extra: [{ text: "Tidy CRM", done: false }],
    deleg: [{ text: "Invoices", who: "Sam", done: false }],
  }],
  filed: [], day: "2026-09-08", history: [],
} as unknown as P1State;

const after = normalize(JSON.parse(JSON.stringify(fromMobile)));
const g = after.goals[0] as GoalPlan | undefined;

ck("a goal survives the load at all", !!g);
for (const k of MOBILE_ONLY) {
  ck("a web load preserves goal." + k, g?.[k] !== undefined, "was dropped");
}
ck("the deadline keeps its value", g?.target === "2026-12-31", String(g?.target));
ck("Work-of-the-Day keeps its text", g?.work?.text === "Call 10 leads", String(g?.work?.text));
ck("the Do-or-Die item keeps its done flag", g?.dod?.[0]?.done === true);
ck("the delegated item keeps who it went to", g?.deleg?.[0]?.who === "Sam", String(g?.deleg?.[0]?.who));
ck("what the screen renders still works",
   g?.goal === "Hit $1M" && g?.plan === "Weekly reviews");

/* Saving is what actually overwrites the phone's blob, so a SECOND pass over
   already-normalized data must be lossless too. */
const twice = normalize(JSON.parse(JSON.stringify(after)));
ck("a second load is lossless", JSON.stringify(twice) === JSON.stringify(after));

/* ------------------- the screen cannot drift from mobile ------------------ */

const src = readFileSync("src/pillars/pillar-1.tsx", "utf8");

ck("the screen takes its types from the shared schema",
   /from "@\/pillars\/schemas\/pillar-1"/.test(src));
ck("it no longer declares its own GoalPlan",
   !/^interface GoalPlan\b/m.test(src));
ck("it no longer declares its own P1State",
   !/^interface P1State\b/m.test(src));
ck("it no longer keeps a private migrateGoals",
   !/^const migrateGoals\b/m.test(src));

/* The whole point of the rebuild: the lists are read from the GOAL, not from
   the top level of the blob. `state.work` would mean the old shape is back. */
for (const k of ["work", "dod", "extra", "deleg"]) {
  ck("the " + k + " list is read per-goal, not top-level",
     !new RegExp("state\\." + k + "\\b").test(src), "found state." + k);
}
ck("the target date is rendered", /g\.target/.test(src));

if (fails.length) { console.error(pass + " passed, " + fails.length + " FAILED"); fails.forEach(f => console.error("  FAIL " + f)); process.exit(1); }
console.log("All web Pillar 1 preservation checks passed (" + pass + ")");
