/**
 * The About tab's instructions.
 *
 * The copy is the workbook's, shared verbatim with mobile. The one thing that
 * can go quietly wrong is the mapping: `content/pillars.ts` keeps the
 * WORKBOOK's numbering (Business Systems is 8) while the app shows Business
 * Systems as pillar 5, and pillar 1's content is titled "EXACT GOAL AND PLAN"
 * rather than "Dreaming to Achieving".
 *
 * So matching on title text almost works, then attaches the wrong instructions
 * to a pillar with no error anywhere. These checks pin the explicit map and the
 * text it resolves to.
 */
import { readFileSync } from "fs";

import { HOW_TO_USE, PILLAR_INSTRUCTIONS } from "@/content/instructions";
import { PILLARS as CONTENT } from "@/content/pillars";
import { PILLARS } from "@/lib/pillars";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const panel = readFileSync("src/components/instructions-panel.tsx", "utf8");
const about = readFileSync("src/app/about/page.tsx", "utf8");
const instr = readFileSync("src/content/instructions.ts", "utf8");

/* ----------------------- THE mapping, explicitly ------------------------- */

ck("there is one entry per app pillar",
   PILLAR_INSTRUCTIONS.length === PILLARS.length,
   `${PILLAR_INSTRUCTIONS.length} vs ${PILLARS.length}`);
ck("they are in the app's display order",
   PILLAR_INSTRUCTIONS.map((p) => p.meta.n).join(",") === PILLARS.map((p) => p.n).join(","));

/* The trap case: display 1 must resolve to content titled EXACT GOAL AND PLAN.
   If someone "simplifies" the map to a title match, this is what breaks. */
const p1 = PILLAR_INSTRUCTIONS.find((p) => p.meta.n === 1);
ck("pillar 1 is 'Dreaming to Achieving' in the app", p1?.meta.name === "Dreaming to Achieving");
ck("but its workbook title is EXACT GOAL AND PLAN",
   p1?.title === "EXACT GOAL AND PLAN", String(p1?.title));

/* The other renumbering: app pillar 5 carries workbook content 8. */
const p5 = PILLAR_INSTRUCTIONS.find((p) => p.meta.n === 5);
ck("app pillar 5 is Business Systems", p5?.meta.name === "Business Systems");
ck("and takes the workbook's id-8 content",
   p5?.title === CONTENT.find((c) => c.id === 8)?.title, String(p5?.title));

ck("the map is explicit, not derived from titles",
   /CONTENT_ID_FOR_DISPLAY/.test(instr));
ck("and the reason is written down", /quietly fails on pillar 1/.test(instr));

/* Every pillar must actually find its content — a missing id silently yields
   the fallback title and an empty body. */
for (const p of PILLAR_INSTRUCTIONS) {
  ck(`pillar ${p.meta.n} resolved real content`,
     !!p.title && p.title !== p.meta.name.toUpperCase() ? true : !!p.summary || !!p.coreTruth,
     "fell back to the meta name with no body");
}

/* --------------------------- the copy is present ------------------------- */

ck("the general instructions have a title", !!HOW_TO_USE.title.trim());
ck("and several sections", HOW_TO_USE.sections.length >= 3, String(HOW_TO_USE.sections.length));
ck("every section has a heading and a body",
   HOW_TO_USE.sections.every((s) => s.heading.trim() && s.body.trim()));
ck("Zaffar's closing words are there", !!HOW_TO_USE.zaffarSays.trim());

/* Each pillar says how it is actually worked — not derivable from the data. */
for (const p of PILLAR_INSTRUCTIONS) {
  ck(`pillar ${p.meta.n} explains how it is worked`, !!p.howItWorks.trim());
}

/* The lines removed from the pillar screens moved HERE, so they must still be
   somewhere the user can find them. */
const p2 = PILLAR_INSTRUCTIONS.find((p) => p.meta.n === 2);
ck("the 'tick the solution that works' line lives in the instructions",
   /Tick .{0,3} the solution that works/.test(p2?.howItWorks ?? ""),
   "it was taken off the pillar screen on the promise it would appear here");

/* ----------------------------- the panel --------------------------------- */

ck("the panel renders the general instructions", /HOW_TO_USE\.sections\.map/.test(panel));
ck("and one row per pillar", /PILLAR_INSTRUCTIONS\.map/.test(panel));
ck("rows start collapsed", /useState<number \| null>\(null\)/.test(panel));
ck("only one row opens at a time", /setOpen\(isOpen \? null : p\.meta\.n\)/.test(panel));
/* An accordion that does not say it is one is unusable by keyboard. */
ck("the toggle announces its state", /aria-expanded=\{isOpen\}/.test(panel));
ck("and names the panel it controls", /aria-controls=\{panelId\}/.test(panel));
ck("each pillar carries its own accent", /const accent = p\.meta\.accent/.test(panel));
ck("the workbook title is shown, not just the app name", /\{p\.title\}/.test(panel));

/* ------------------------------- the tab --------------------------------- */

ck("About has an Instructions tab", /InstructionsPanel/.test(about));
ck("the two sections are exclusive", /tab === "instructions" \? \(/.test(about));
ck("the switcher is a labelled group", /aria-label="Section"/.test(about));
ck("and its buttons report which is on", /aria-pressed=\{on\}/.test(about));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web instructions checks passed (" + pass + ")");
