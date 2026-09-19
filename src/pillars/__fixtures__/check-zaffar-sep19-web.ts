/**
 * Zaffar's 19 Sep 2026 review, plus the items from Hammad's list the user
 * confirmed. These guard the DATA and COPY rules behind each change; how it
 * looks is proven by the browser suite and screenshots.
 *
 * Run from the web root:  npx tsx src/pillars/__fixtures__/check-zaffar-sep19-web.ts
 */
import { readFileSync } from "node:fs";

import { blankDeleg, emptyGoal, revealStage, type GoalPlan } from "@/pillars/schemas/pillar-1";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};
const read = (f: string) => readFileSync(f, "utf8");
/** Source with comments removed, so a rule is judged on code only. */
const code = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, "$1");

/* ------------------------- B2: paywall hook order ------------------------ */
{
  const pw = code(read("src/app/paywall/page.tsx"));
  const early = pw.search(/\n\s*if \([^)]*\) return <Loading \/>;/);
  const after = early >= 0 ? pw.slice(early) : "";
  ck("paywall has its early return", early >= 0);
  ck("no hook runs after the paywall's early return", !/\buse(State|Effect|Memo|Callback|Ref)\(/.test(after));
}

/* ------------------------- A9 / A11: Phase 1 bugs ------------------------ */
{
  const p2 = code(read("src/pillars/pillar-2.tsx"));
  ck("Pillar 2 File removes the filed solution", /label: "File"[\s\S]{0,400}s\.sols\.splice\(i, 1\)/.test(p2));
  ck("Pillar 2 File says where it went", /Filed to Solved Problems/.test(p2));
  const board = code(read("src/components/am-pm-board.tsx"));
  ck("money box shows A$ inside it", />A\$</.test(board));
  ck("money box explains a refused keystroke", /Numbers only/.test(board));
}

/* ------------------------- A4: Pillar 1 step-by-step ------------------------- */
{
  const g = (over: Partial<GoalPlan>): GoalPlan => ({ ...emptyGoal(), ...over });
  const full = { goal: "Grow sales", plan: "Hire two agents", target: "2027-01-01" };
  ck("a brand-new goal shows only the goal box", revealStage(g({})) === 1);
  ck("goal + plan without a deadline is still step 1", revealStage(g({ goal: "x", plan: "y" })) === 1);
  ck("goal, plan and deadline open step 2", revealStage(g(full)) === 2);
  ck("writing the work of the day opens everything", revealStage(g({ ...full, work: { text: "Call Ali", done: false } })) === 3);
  ck("a do-or-die task opens everything", revealStage(g({ ...full, dod: [{ text: "x", done: false }, ...emptyGoal().dod.slice(1)] })) === 3);
  // Never hide what someone already wrote, even with the goal box incomplete.
  ck("an existing extra task is never hidden", revealStage(g({ extra: [{ text: "Read", done: false }] })) === 3);
  ck("an existing delegation is never hidden", revealStage(g({ deleg: [{ ...blankDeleg(), text: "Chase bank" }] })) === 3);
  ck("existing day tasks are never hidden", revealStage(g({ dod: [{ text: "x", done: false }, ...emptyGoal().dod.slice(1)] })) === 3);
}

if (fails.length) { console.error(pass + " passed, " + fails.length + " FAILED"); fails.forEach((f) => console.error("  FAIL " + f)); process.exit(1); }
console.log("All Zaffar 19 Sep checks passed (" + pass + ")");
