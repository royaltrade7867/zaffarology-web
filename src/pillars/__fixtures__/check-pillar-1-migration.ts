/**
 * Web Pillar 1 stores a DIFFERENT shape than mobile: work/dod/extra/deleg sit at
 * the top level of the blob instead of inside each goal. Rebuilding the screen
 * against the shared schema only makes sense if the existing web-written data
 * survives that move — this asserts it does, before any UI work.
 */
import { normalize, type P1State } from "@/pillars/schemas/pillar-1";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

/* Exactly what today's web app writes. */
const webBlob = {
  goals: [{ goal: "Hit $1M", plan: "Weekly reviews" }],
  work: { text: "Call 10 leads", done: false },
  dod: [{ text: "Send proposal", done: true }],
  extra: [{ text: "Tidy CRM", done: false }],
  deleg: [{ task: "Invoices", who: "Sam", due: "2026-09-20" }],
  filed: [], day: "2026-09-08", history: [],
} as unknown as P1State;

const a = normalize(webBlob);
ck("the goal text survives", a.goals[0]?.goal === "Hit $1M", a.goals[0]?.goal);
ck("the plan survives", a.goals[0]?.plan === "Weekly reviews");
ck("work-of-the-day moves INTO the goal", a.goals[0]?.work?.text === "Call 10 leads",
   JSON.stringify(a.goals[0]?.work));
ck("do-or-die moves in too", a.goals[0]?.dod?.[0]?.text === "Send proposal",
   JSON.stringify(a.goals[0]?.dod));
ck("and keeps its done flag", a.goals[0]?.dod?.[0]?.done === true);
ck("extras move in", a.goals[0]?.extra?.[0]?.text === "Tidy CRM");
ck("delegations move in", a.goals[0]?.deleg?.[0]?.who === "Sam",
   JSON.stringify(a.goals[0]?.deleg));

/* The dangerous case: tasks filled in but goal/plan left blank. A naive
   migration drops all of it because there is no goal to attach to. */
const noGoalText = {
  goals: [], goal: "", plan: "",
  work: { text: "Ship the update", done: false },
  dod: [], extra: [], deleg: [], filed: [], day: "2026-09-08", history: [],
} as unknown as P1State;
const b = normalize(noGoalText);
ck("a blank-goal blob still keeps its work", b.goals[0]?.work?.text === "Ship the update",
   JSON.stringify(b.goals));

/* A genuinely empty blob gets ONE blank goal — the screen renders goals[idx],
   so an empty array would leave nothing to type into. It must be blank, though:
   seeding placeholder text would put words in the user's mouth. */
const empty = normalize({ goals: [], filed: [], day: "", history: [] } as unknown as P1State);
ck("an empty blob gets exactly one goal row", (empty.goals?.length ?? 0) === 1,
   String(empty.goals?.length));
ck("and that row is genuinely blank",
   !empty.goals[0].goal && !empty.goals[0].plan && !empty.goals[0].work?.text,
   JSON.stringify(empty.goals[0]));

ck("normalize is idempotent",
   JSON.stringify(normalize(JSON.parse(JSON.stringify(a)))) === JSON.stringify(a));

if (fails.length) { console.error(pass + " passed, " + fails.length + " FAILED"); fails.forEach(f => console.error("  FAIL " + f)); process.exit(1); }
console.log("All web Pillar 1 migration checks passed (" + pass + ")");
