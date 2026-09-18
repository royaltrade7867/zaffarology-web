/**
 * Zaffar's 18 Sep 2026 review of the live pillars.
 *
 * What these guard, beyond the look (which the screenshots cover):
 *  - DATA SAFETY. Real users have blobs written before any of this, and the
 *    phone app writes the same blobs. Old records with no `rating` must load
 *    unchanged; a stored goal must stay as typed even though it shows in
 *    capitals; a delegation's `due` must survive a save/load.
 *  - THE PASS/FAIL CONTRACT. The four rating boxes sit alongside `satisfied`,
 *    which the implementation-date gate, the reports and the phone app read.
 *    EXCELLENT/GOOD must mean `yes`, AVERAGE/POOR `no`.
 *  - THE RULES ZAFFAR SET. Standard departments cannot be deleted; nothing is
 *    deleted without a second chance; "Schedule another training" is gone.
 *
 * Run from the web root:  npx tsx src/pillars/__fixtures__/check-zaffar-sep18-web.ts
 */
import { readFileSync } from "node:fs";

import {
  asRating,
  deptKind,
  isStandardDept,
  normalize as normP5,
  ratingToYN,
  shownRating,
  type P8State,
} from "@/pillars/schemas/business-systems";
import { normalize as normP1, type P1State } from "@/pillars/schemas/pillar-1";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};

/** A full save -> load cycle, exactly as the blob store does it. */
const trip = <T,>(norm: (s: T) => T, s: unknown): T => norm(JSON.parse(JSON.stringify(s)) as T);

/* ------------------------- ratings: the contract ------------------------- */

ck("EXCELLENT passes", ratingToYN("excellent") === "yes");
ck("GOOD passes", ratingToYN("good") === "yes");
ck("AVERAGE does not pass", ratingToYN("average") === "no");
ck("POOR does not pass", ratingToYN("poor") === "no");
ck("no rating is unanswered", ratingToYN("") === "");
ck("junk rating is dropped, not kept", asRating("brilliant") === "" && asRating(3) === "" && asRating(null) === "");
ck("an old 'yes' shows as GOOD", shownRating("", "yes") === "good");
ck("an old 'no' shows as POOR", shownRating("", "no") === "poor");
ck("an unanswered old record shows nothing picked", shownRating("", "") === "");
ck("a real rating always wins over the old verdict", shownRating("excellent", "no") === "excellent");

/* ------------------- old Pillar 5 data loads unchanged ------------------- */

// A blob exactly as it was stored before ratings existed (from the demo seed).
const oldP5 = {
  businesses: [{
    id: "biz1", name: "Khan Textiles", seeded: true,
    departments: [
      { id: "d1", name: "AM Planning & PM Achievement ($)", num: "D1", systems: [] },
      { id: "d6", name: "Warehouse", num: "D2", systems: [{
        id: "sys1", num: "S1", name: "Stock Ordering", freq: "Weekly",
        jobs: ["Check stock levels every Monday"], efforts: ["Checked?"], results: ["No stock-outs?"], steps: ["Count"],
        trainings: [{ id: "tr1", trainee: "Bilal", trainer: "Ayesha", date: "2026-09-01", satisfied: "no", remarks: "More practice" }],
        evals: [{ id: "ev1", trainee: "Bilal", evaluator: "Imran", evalDate: "2026-09-10", satisfied: "yes", implDate: "2026-10-01", remarks: "Good" }],
        reviews: [{ id: "rv1", trainee: "Bilal", reviewer: "Imran", date: "2026-09-15", satisfied: "no", remarks: "Weak follow-through" }],
      }] },
    ],
  }],
  nextSysNum: 2, nextDeptNum: 3,
};
const p5 = trip(normP5, oldP5);
const sys = p5.businesses[0].departments[1].systems[0];
ck("old training keeps its verdict and remarks", sys.trainings[0].satisfied === "no" && sys.trainings[0].remarks === "More practice");
ck("old evaluation keeps satisfied + implementation date", sys.evals[0].satisfied === "yes" && sys.evals[0].implDate === "2026-10-01");
ck("old review keeps its confidential remarks", sys.reviews[0].remarks === "Weak follow-through");
ck("old records gain an EMPTY rating, nothing invented", sys.trainings[0].rating === "" && sys.evals[0].rating === "" && sys.reviews[0].rating === "");
ck("nothing else in the system was lost", sys.jobs[0] === "Check stock levels every Monday" && sys.pairs[0].effort === "Checked?");

// A rating written by the new screen survives a save/load.
const rated = JSON.parse(JSON.stringify(p5)) as P8State;
rated.businesses[0].departments[1].systems[0].evals[0].rating = "average";
rated.businesses[0].departments[1].systems[0].evals[0].satisfied = "no";
const back = trip(normP5, rated).businesses[0].departments[1].systems[0].evals[0];
ck("a rating round-trips", back.rating === "average" && back.satisfied === "no");

/* ----------------------- standard departments ----------------------- */

for (const n of ["AM Planning & PM Achievement ($)", "Delegation", "Loyalty", "AI", "Record Keeping"]) {
  ck(`"${n}" is standard`, isStandardDept(n));
}
ck("matching ignores case and spaces", isStandardDept("  delegation ") && isStandardDept("RECORD KEEPING"));
ck("a user's own department is not standard", !isStandardDept("Warehouse"));
// A business that lost a default department BEFORE the rule is not re-seeded.
const lost = trip(normP5, { businesses: [{ id: "b", name: "B", seeded: true, departments: [{ id: "d", name: "Delegation", systems: [] }] }] });
ck("a business that already lost a standard department is left as it is", lost.businesses[0].departments.length === 1);
// The rule is by name, never a stored flag the phone could drop.
ck("no 'standard' flag is written into the blob", !JSON.stringify(p5).includes('"standard"'));

/* ----------- C1 / C2: the AM-PM and Delegation department boards ----------- */

ck("the AM/PM department is recognised", deptKind("AM Planning & PM Achievement ($)") === "am-pm" && deptKind("am planning & pm achievement") === "am-pm");
ck("the Delegation department is recognised", deptKind(" Delegation ") === "delegation");
ck("an ordinary department stays an ordinary one", deptKind("Warehouse") === "systems");
ck("a department that never used a board saves no board",
   !("amPm" in p5.businesses[0].departments[0]) && !("delegation" in p5.businesses[0].departments[0]));

const withBoards = trip(normP5, {
  businesses: [{ id: "b", name: "B", seeded: true, departments: [
    { id: "am", name: "AM Planning & PM Achievement ($)", systems: [],
      amPm: { work: { text: "Close the uniform order", done: true }, dod: [{ text: "Call five buyers", done: false }], extra: [], pm: "Closed it", money: "1200", filed: [], day: "2026-09-18", history: [] } },
    { id: "dg", name: "Delegation", systems: [],
      delegation: { items: [{ id: "x1", text: "Chase the invoice", who: "Bilal", due: "2026-09-25", done: false, whoUserId: "" }], filed: [{ text: "Old task → Ayesha", date: "17 Sep 2026" }] } },
  ] }],
});
const am = withBoards.businesses[0].departments[0].amPm;
ck("the AM/PM board round-trips", am?.work.text === "Close the uniform order" && am.work.done && am.pm === "Closed it" && am.money === "1200");
ck("the AM/PM board always has exactly 5 do-or-die slots", am?.dod.length === 5 && am.dod[0].text === "Call five buyers");
const dg = withBoards.businesses[0].departments[1].delegation;
ck("the Delegation list round-trips with who and deadline", dg?.items[0].who === "Bilal" && dg.items[0].due === "2026-09-25");
ck("the Delegation filed archive round-trips", dg?.filed[0].text === "Old task → Ayesha");
const amSrc = readFileSync("src/pillars/pillar-5-business-systems.tsx", "utf8");
ck("Pillar 5 renders Pillar 3's board, not a copy", /<AmPmBoard/.test(amSrc) && /<AmPmBoard/.test(readFileSync("src/pillars/pillar-3.tsx", "utf8")));
ck("Pillar 5 renders Pillar 1's delegate list, not a copy", /<DelegateSection/.test(amSrc));

/* ------------------------- Pillar 1 data safety ------------------------- */

const oldP1 = {
  goals: [{
    goal: "grow the bakery", plan: "open two shops", target: "2027-01-01",
    work: { text: "w", done: false }, dod: [], extra: [],
    deleg: [{ id: "dl1", text: "Prepare the dashboard", who: "Ayesha", due: "2026-10-05", done: false, whoUserId: "" }],
  }],
  filed: [], day: "2026-09-18", history: [],
};
const p1 = trip(normP1, oldP1 as unknown as P1State);
ck("a delegation deadline (`due`) round-trips", p1.goals[0].deleg[0].due === "2026-10-05");
ck("the goal is stored exactly as typed", p1.goals[0].goal === "grow the bakery");

/* ------------------------ the screens themselves ------------------------ */

const p1src = readFileSync("src/pillars/pillar-1.tsx", "utf8");
const p5src = readFileSync("src/pillars/pillar-5-business-systems.tsx", "utf8");
const taskSrc = readFileSync("src/components/task.tsx", "utf8");
const delegSrc = readFileSync("src/components/delegate-section.tsx", "utf8");

ck("goal capitals are CSS, never written into state",
   /className="[^"]*\buppercase\b/.test(p1src) && !/x\.goal = [^;]*toUpperCase/.test(p1src));
ck("the goal-name tab strip is gone", !p1src.includes('role="tablist"'));
ck("delegations have a deadline bound to `due`", /x\.due = iso/.test(delegSrc));
ck("delegate add button wording", delegSrc.includes('label="+ Delegate task or follow-up"'));
ck("delegate placeholder wording", delegSrc.includes('placeholder="What would you like to delegate?"'));
ck("Pillar 1 renders the shared delegate list", /<DelegateSection/.test(p1src));
ck("the shared task row confirms before any delete", /confirmThen\(onDelete\)/.test(taskSrc) && /a\.kind === "delete" \? \(\) => void confirmThen/.test(taskSrc));
ck("\"Schedule another training\" is gone", !/Schedule another training/.test(p5src));
ck("Yes/No verdicts replaced by the four boxes", !/<YesNoRow/.test(p5src) && (p5src.match(/<RatingRow /g) ?? []).length === 3);
ck("every rating change also writes `satisfied`", (p5src.match(/\.rating = r; s\.\w+\[i\]\.satisfied = ratingToYN\(r\)/g) ?? []).length === 3);
ck("standard departments render no delete control", /standard \? \(/.test(p5src));
ck("systems display in small letters", /\(sys\.name \|\| "Untitled system"\)\.toLowerCase\(\)/.test(p5src) && !/sys\.name[^)]*\)\.toUpperCase\(\)/.test(p5src));
ck("job description wording", p5src.includes('addLabel="+ ONE MOST ESSENTIAL, EXACT GOAL (WITH EXPECTED OUTCOME)"'));

if (fails.length) { console.error(pass + " passed, " + fails.length + " FAILED"); fails.forEach((f) => console.error("  FAIL " + f)); process.exit(1); }
console.log("All Zaffar 18 Sep checks passed (" + pass + ")");
