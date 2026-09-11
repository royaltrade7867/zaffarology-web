/**
 * Reachability, target size and destructive-action guards.
 *
 * Each check here is a bug that actually shipped and was found by a browser
 * test, not a hypothetical.
 */
import { readFileSync, readdirSync } from "node:fs";

import { PILLARS, backendPillarId } from "@/lib/pillars";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};

const read = (f: string) => readFileSync(f, "utf8");

/* ------------------------------ navigation ------------------------------- */

/* Six links plus the wordmark need ~580px. Below that they overlapped the logo
   and ran off the right edge, and the page does not scroll horizontally — so
   Team, About and Profile were UNREACHABLE on a phone. */
{
  const shell = read("src/components/shell.tsx");
  ck("the wide nav is hidden on narrow screens", /hidden[^"]*sm:flex/.test(shell));
  ck("a menu button appears instead", /sm:hidden/.test(shell) && /aria-expanded/.test(shell));
  ck("the menu button says what it does", /aria-label=\{open \? "Close menu" : "Open menu"\}/.test(shell));
  ck("it controls the menu it opens", /aria-controls="zaff-nav-menu"/.test(shell));
  ck("changing route closes the menu", /useEffect\(\(\) => setOpen\(false\), \[pathname\]\)/.test(shell));
  ck("escape closes the menu", /e\.key === "Escape"/.test(shell));
  ck("the current page is announced", /aria-current=\{isActive\(n\.href\) \? "page" : undefined\}/.test(shell));
}

/* --------------------------- the Team table ------------------------------ */

/* per_pillar is keyed by the BACKEND id. Pillar 5 is stored as
   `pillar-8-business-systems` and reported as 8, so looking up the DISPLAYED
   number made Pillar 5 read a key that is never sent: a grey 0% for every
   member, however much work they had done. */
{
  ck("Pillar 5 maps to backend id 8", backendPillarId(PILLARS[4]) === "8", backendPillarId(PILLARS[4]));
  ck(
    "pillars 1-4 map to themselves",
    PILLARS.slice(0, 4).every((p, i) => backendPillarId(p) === String(i + 1)),
  );
  const team = read("src/app/team/page.tsx");
  ck("the Team table keys by backend id, not the shown number", /backendPillarId\(p\)/.test(team));
  ck("it no longer keys by p.n", !/per_pillar\?\.\[String\(p\.n\)\]/.test(team));
  // `on-accent` is tuned for text ON a filled accent; on the hairline used for
  // an unstarted pillar it was 1.63:1 dark / 1.42:1 light.
  ck("a 0% chip does not use on-accent over the hairline",
     !/text-on-accent"[^>]*backgroundColor: pct \? p\.accent : "var\(--line\)"/.test(team));
}

/* ------------------------ destructive confirmations ---------------------- */

const uiFiles = [
  ...readdirSync("src/pillars").filter((f) => f.endsWith(".tsx")).map((f) => `src/pillars/${f}`),
  ...readdirSync("src/components").filter((f) => f.endsWith(".tsx")).map((f) => `src/components/${f}`),
  "src/app/notes/page.tsx",
  "src/app/profile/page.tsx",
];

/* Pillar 4's "Delete" threw the item away on one click while "Remove" beside it
   asked — the more destructive of the two was the unguarded one. */
{
  const p4 = read("src/pillars/pillar-4.tsx");
  const deleteBlock = /Delete this item\?[\s\S]{0,220}danger: true/.test(p4);
  ck("huddle Delete confirms before destroying", deleteBlock);
  ck("huddle Remove still confirms", /Remove this item from the huddle board\?[\s\S]{0,120}danger: true/.test(p4));
}

/* Every confirm whose wording is destructive must LOOK destructive. Flow steps
   ("Start a new day", "File this problem") deliberately stay gold. */
{
  const notDanger: string[] = [];
  for (const f of uiFiles) {
    const src = read(f);
    if (f.endsWith("dialog.tsx")) continue;
    for (const m of src.matchAll(/dialog\.confirm\(([\s\S]{0,400}?)\)\s*[),;]/g)) {
      const call = m[1];
      const destructive = /\b(Delete|Remove|Withdraw|Decline)\b/.test(call);
      if (destructive && !/danger: true/.test(call)) notDanger.push(`${f}: ${call.slice(0, 46).replace(/\s+/g, " ")}`);
    }
  }
  ck("destructive confirms are styled destructive", notDanger.length === 0, notDanger.slice(0, 3).join(" | "));
}

/* ------------------------------ target size ------------------------------ */

/* A 13px icon in a 13px box fails WCAG 2.2 target size (24px) and gives a
   screen reader nothing to announce. */
{
  const p5 = read("src/pillars/pillar-5-business-systems.tsx");
  // Greedy-enough span to cover a multi-line button, and `[\s\S]*?` rather than
  // a fixed budget — an earlier version capped at 520 chars and so "found" only
  // one of the three buttons, reporting a failure that did not exist.
  const closeButtons = [...p5.matchAll(/<button[\s\S]*?<\/button>/g)].filter((m) =>
    /<Close size=\{13\} \/>/.test(m[0]),
  );
  ck("every 13px Close button was found", closeButtons.length === 3, String(closeButtons.length));
  // 24px can be spelled `min-h-[24px]` or a Tailwind `h-8 w-8` (32px). Both are
  // fine; requiring the literal spelling flagged a correct button.
  const sized = (s: string) => /min-h-\[24px\]/.test(s) || /\bh-(?:[89]|1[0-9])\b/.test(s);
  const bad = closeButtons.filter((m) => !sized(m[0]) || !/aria-label=/.test(m[0]));
  ck("each is >= 24px and has an accessible name", bad.length === 0, String(bad.length) + " without");
}

/* Icon-only navigator arrows need a name AND a tooltip — all four of them. */
{
  for (const [f, prev, next] of [
    ["src/pillars/pillar-1.tsx", "Previous goal", "Next goal"],
    ["src/pillars/pillar-4.tsx", "Previous item", "Next item"],
  ] as const) {
    const src = read(f);
    for (const label of [prev, next]) {
      ck(`${f.split("/").pop()} arrow "${label}" is named`, src.includes(`aria-label="${label}"`));
      ck(`${f.split("/").pop()} arrow "${label}" has a tooltip`, src.includes(`title="${label}"`));
    }
  }
}

/* ------------------------------- overflow -------------------------------- */

/* A flex item will not shrink below its content's intrinsic width without
   `min-w-0`, and a date input carries a UA intrinsic width that `w-full` does
   not override — so the due date pushed past the card AND the viewport. */
{
  const task = read("src/components/task.tsx");
  ck("the date input can shrink", /type="date"[\s\S]{0,400}?min-w-0/.test(task));
  const p4 = read("src/pillars/pillar-4.tsx");
  ck("the due-date row stacks on narrow screens", /flex flex-col gap-3 sm:flex-row/.test(p4));
  ck("both of its columns can shrink", (p4.match(/min-w-0 flex-1/g) ?? []).length >= 2);
}

/* -------------------------------- dialog --------------------------------- */

/* The scrim is painted ON TOP of its wrapper, so it was always `e.target` and
   the wrapper's `target === currentTarget` test never held: clicking outside
   did nothing. */
{
  // Strip comments first: the file EXPLAINS the old bug, and matching the
  // explanation reported the bug as still present.
  const dlg = read("src/components/dialog.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  ck("the scrim itself closes the dialog", /bg-\[rgba\(4,16,31,0\.55\)\][\s\S]{0,160}onMouseDown=\{\(\) => close\(/.test(dlg));
  ck("the old always-false wrapper test is gone", !/e\.target === e\.currentTarget/.test(dlg));
}

/* ------------------------------ live region ------------------------------ */

{
  const rep = read("src/app/reports/page.tsx");
  ck("a long build is announced", /role="status"/.test(rep) && /aria-live="polite"/.test(rep));
  ck("the buttons report their busy state", (rep.match(/aria-busy=/g) ?? []).length >= 2);
}

/* ------------------------- paired fill/text tokens ----------------------- */

/* A fill that CHANGES LIGHTNESS between themes needs a paired text token.
   --danger goes #c8102e (light) -> #ff6b7a (dark), so the hardcoded white label
   on every delete confirm — including Delete account — was 2.75:1 in dark.
   Same bug class as --on-accent and --on-gold before it. */
{
  const css = read("src/app/globals.css");
  ck("--on-danger exists in all three theme blocks",
     (css.match(/--on-danger:/g) ?? []).length === 3,
     String((css.match(/--on-danger:/g) ?? []).length));
  ck("--on-danger is exported to Tailwind", /--color-on-danger: var\(--on-danger\)/.test(css));
  const dlg = read("src/components/dialog.tsx");
  ck("the danger button uses the paired token, not a fixed white",
     /bg-danger text-on-danger/.test(dlg) && !/bg-danger text-white/.test(dlg));
}

/* A colour TRANSITION can strand text mid-fade: the gold fill eased out while
   the text colour swapped instantly, so the busy label sat on a gold-over-navy
   blend at ~1.6:1 for the whole transition. The busy state paints a solid
   surface and does not animate. */
{
  const rep = read("src/app/reports/page.tsx");
  // BOTH busy branches, counted. A single `.test()` matched the sibling button
  // and so passed with the bug fully reintroduced on the first one.
  const busyBranches = [...rep.matchAll(/"cursor-wait[^"]*"/g)].map((m) => m[0]);
  ck("both buttons have a busy branch", busyBranches.length === 2, String(busyBranches.length));
  ck("every busy branch paints a solid surface",
     busyBranches.every((b) => b.includes("bg-surface")), busyBranches.join(" | "));
  ck("and none of them fades into it",
     busyBranches.every((b) => b.includes("transition-none")), busyBranches.join(" | "));
}

/* Dismissing by CLICK must restore focus too, not only Escape. The scrim fires
   on mousedown and the browser then moves focus itself as the click completes,
   so a synchronous restore was immediately undone. */
{
  const dlg = read("src/components/dialog.tsx");
  ck("focus restore survives a scrim click", /requestAnimationFrame\(\(\) => back\?\.focus\?\.\(\)\)/.test(dlg));
}

/* WCAG 2.2 target size: the ring may stay 22px, the BUTTON may not. */
{
  const task = read("src/components/task.tsx");
  ck("the tick is padded to a 24px target", /const pad = Math\.max\(0, \(24 - size\) \/ 2\)/.test(task));
  ck("the tick has an accessible name", /aria-label=\{label\}/.test(task));
  ck("and the call site passes one", /label=\{filled \? `Mark done/.test(task));
}

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web a11y/layout checks passed (" + pass + ")");
