/**
 * Zaffar's 19 Sep 2026 review, plus the items from Hammad's list the user
 * confirmed. These guard the DATA and COPY rules behind each change; how it
 * looks is proven by the browser suite and screenshots.
 *
 * Run from the web root:  npx tsx src/pillars/__fixtures__/check-zaffar-sep19-web.ts
 */
import { readFileSync } from "node:fs";

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

if (fails.length) { console.error(pass + " passed, " + fails.length + " FAILED"); fails.forEach((f) => console.error("  FAIL " + f)); process.exit(1); }
console.log("All Zaffar 19 Sep checks passed (" + pass + ")");
