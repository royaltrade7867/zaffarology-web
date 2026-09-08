/**
 * Reports on the web.
 *
 * The report tree is shared source with mobile — same stats, same HTML, same
 * text. What differs is delivery: mobile prints via `expo-print`, the web
 * downloads a real PDF built by pdfmake.
 *
 * The checks that matter:
 *  - the ported files still render byte-identically to mobile's
 *  - the report palette matches the app it came out of, in all three places
 *    that define it
 *  - the pdfmake font wiring stays correct. Getting it wrong does not throw:
 *    `createPdf` simply hangs, so nothing downloads and nothing is logged.
 */
import { readFileSync } from "fs";

import { AccentHex, Accents } from "@/lib/pillars";
import { ReportColors } from "@/reports/palette";
import { renderPillarReport } from "@/reports/html/pillar-report";
import { makeInitial as p1Init } from "@/pillars/schemas/pillar-1";
import { PILLARS } from "@/lib/pillars";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const pdf = readFileSync("src/reports/pdf.ts", "utf8");
const gen = readFileSync("src/reports/generate.ts", "utf8");
const load = readFileSync("src/reports/load.ts", "utf8");
const page = readFileSync("src/app/reports/page.tsx", "utf8");

/* ------------------ the palette agrees across all three ------------------ */

/* A report in different colours from the app looks like a different product.
   The values live in three places by necessity: report HTML cannot use CSS
   custom properties (it is rendered into emails and PDFs), the screens must,
   and mobile has its own theme file. */
const css = readFileSync("src/app/globals.css", "utf8");
const cssVar = (name: string) =>
  css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase() ?? "";

for (const [token, cssName] of [
  ["paper", "background"],
  ["ink", "ink"],
  ["line", "line"],
  ["muted", "muted"],
  ["heading", "heading"],
  ["gold", "gold"],
  ["danger", "danger"],
] as const) {
  const a = ReportColors[token].toLowerCase();
  const b = cssVar(cssName);
  ck(`report ${token} matches --${cssName}`, a === b, `${a} vs ${b}`);
}

/* The TS accent map is a THIRD copy, and it had drifted: reports were printing
   the old #9A6A00 gold (4.38:1 on paper) while the CSS used the fixed one. */
ck("AccentHex.gold matches the report palette",
   AccentHex.gold.toLowerCase() === ReportColors.gold.toLowerCase(),
   `${AccentHex.gold} vs ${ReportColors.gold}`);

/* Two accent maps by design, and mixing them up is silent either way:
   `Accents` is theme-aware for components, `AccentHex` is literal for output
   that leaves the document. A var() in report HTML renders as NOTHING, and a
   fixed hex in a component cannot follow the theme. */
ck("Accents are CSS variables, for components", Accents.gold.startsWith("var(--"));
ck("AccentHex are literal hexes, for report output", /^#[0-9A-Fa-f]{6}$/.test(AccentHex.gold));
ck("report HTML uses the hex map, never the var one",
   /AccentHex as Accents/.test(readFileSync("src/reports/html/progress-report.ts", "utf8")));
ck("and the pillar report uses accentHex",
   /accent: p\.accentHex/.test(readFileSync("src/reports/html/pillar-report.ts", "utf8")));

/* ---------------- the report still renders, and renders content ---------- */

const meta = PILLARS[0];
const s = p1Init();
s.goals[0].goal = "Hit $1M";
s.goals[0].plan = "Weekly reviews";
s.goals[0].target = "2026-12-31";
const html = renderPillarReport(
  { meta, status: "ok", data: { kind: "p1", data: s } } as never,
  { userName: "Test User", generatedOn: "Monday, 8 September 2026" } as never,
);
ck("a pillar report renders", html.length > 1000, `${html.length} bytes`);
ck("it is a complete document", html.startsWith("<!doctype html>") && html.includes("</html>"));
ck("the user's own words reach the report", html.includes("Hit $1M"));
ck("it carries A4 page CSS, so printing is sane", /@page\s*\{[^}]*A4/.test(html));
ck("the accent is the corrected gold", html.includes(ReportColors.gold));
/* A var() reaching report HTML resolves against no document and renders as
   nothing — the report's OWN variables, declared in its <style>, are fine. */
ck("no app CSS variable leaks into report HTML",
   !/var\(--(p[1-8]|gold|ink|heading|muted|line|surface|background)\)/.test(
     html.replace(/<style>[\s\S]*?<\/style>/g, ""),
   ));

/* ------------------------- the pdfmake wiring ---------------------------- */

/* THE bug this section exists for. pdfmake 0.3's `vfs_fonts` registers its
   fonts by itself; an earlier version of pdf.ts read a `mod.vfs` that does not
   exist in 0.3 and assigned `{}` over the working font map. `createPdf` then
   hung forever — no error, no download, nothing in the console. Verified in a
   real browser after the fix: createPdf(...).getBase64() resolves to a %PDF. */
ck("the fonts module is imported for its side effect",
   /import\("pdfmake\/build\/vfs_fonts"\)/.test(pdf));
ck("and is NOT hand-wired across", !/\.vfs\b\s*(\?\?|\|\||=[^=])/.test(pdf));
ck("virtualfs is not written to directly", !/virtualfs\s*[.[]/.test(pdf.replace(/\/\*[\s\S]*?\*\//g, "")));
ck("the module shape is asserted rather than assumed",
   /no createPdf export/.test(pdf));
/* ~1 MB: it must not land in the main bundle. */
ck("pdfmake is imported dynamically", /await Promise\.all\(\[\s*import\("pdfmake/.test(pdf));
ck("and only once", /pdfPromise \?\?=/.test(pdf));

/* --------------------------- what a PDF contains ------------------------- */

/* The PDF is built from the same structured data as the HTML and text, never
   by parsing either of their outputs — a third representation would be a third
   thing to keep in step. */
/* Strip comments first: the file mentions the other renderers in prose to
   explain why it does not use them. */
const pdfCode = pdf.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
ck("the PDF reads the stats functions directly", /p1Stats\(/.test(pdfCode) && /p4Stats\(/.test(pdfCode));
ck("and never parses the HTML or text renderers' output",
   !/renderPillarReport|renderPillarText|renderProgress/.test(pdfCode));
ck("a null rate shows as a dash, not 0%",
   /r\.pct === null \? "—"/.test(pdf),
   "a bare 0% reads as failure where nothing is measurable");
ck("every pillar kind is handled",
   ["p1", "p2", "p3", "p4", "business-systems"].every((k) => pdf.includes(`case "${k}"`)));
ck("progress reports break pages per pillar", /pageBreak: "before"/.test(pdf));

/* ---------------------------- delivery paths ----------------------------- */

ck("text copies to the clipboard", /navigator\.clipboard/.test(gen));
ck("with a fallback for older browsers", /execCommand\("copy"\)/.test(gen));
ck("an empty pillar is refused before building", /NoDataError/.test(gen));
ck("an unverified account is told why", /UnverifiedError/.test(gen));
ck("the screen reports both outcomes to the user",
   /Your PDF has been downloaded/.test(page) && /Copied to your clipboard/.test(page));

/* ----------------------------- offline load ------------------------------ */

/* The cache key must match use-pillar-state.ts exactly, or the offline
   fallback silently finds nothing and every pillar reports as empty. */
const hook = readFileSync("src/lib/use-pillar-state.ts", "utf8");
const keyOf = (src: string) => src.match(/`zaff:v3:\$\{[^}]+\}:\$\{[^}]+\}`/)?.[0] ?? "";
ck("the report loader uses the app's cache key",
   !!keyOf(load) && keyOf(load) === keyOf(hook), `${keyOf(load)} vs ${keyOf(hook)}`);
ck("one failing pillar does not lose the others", /allSettled/.test(load));
ck("a cached-but-unreadable blob is reported, not called empty",
   /Cached blob could not be healed/.test(load));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web report checks passed (" + pass + ")");
