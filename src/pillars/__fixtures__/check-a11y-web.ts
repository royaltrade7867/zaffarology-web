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
  /* Assert the INVARIANT, not a head-count. This pinned `=== 3` and failed when
     the Pillar 5 tree became an accordion: the one delete button in the old
     shared row list became two (a department's and a system's), which is correct
     and changed nothing about target size. What matters is that a 13px icon
     never sits in a 13px box. */
  ck("Pillar 5 has 13px Close buttons to check", closeButtons.length > 0, String(closeButtons.length));
  // 24px can be spelled `min-h-[24px]` or a Tailwind `h-8 w-8` (32px). Both are
  // fine; requiring the literal spelling flagged a correct button.
  const sized = (s: string) => /\btap-target\b/.test(s) || /\bh-(?:[89]|1[0-9])\b/.test(s);
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
  /* Assert the INVARIANT, not the markup: the date field must be able to shrink
     inside a flex row, whatever control it is built from. It has been a native
     `type="date"`, then a typed text box, and is now a day/month/year wheel like
     the phone's — pinning any one of those spellings failed correct code. */
  ck("the date field can shrink", /DateField[\s\S]*?min-w-0/.test(task));
  ck("and is bounded to a sane year range",
     /DATE_MIN = "1900-01-01"/.test(task) && /DATE_MAX = "2100-12-31"/.test(task));
  /* The wheel cannot OFFER an out-of-range year, which is a stronger guarantee
     than parsing one back out: the year column is generated from the bounds. */
  ck("and the year column is generated from those bounds",
     /MIN_YEAR = Number\(DATE_MIN/.test(task) && /MAX_YEAR - MIN_YEAR \+ 1/.test(task));
  /* 31 spun onto February must land on the 28th, not store a day that does not
     exist in that month. */
  ck("and a day is clamped to the month it lands in",
     /Math\.min\(draft\.d, daysIn\(y, mo\)\)/.test(task));
  /* A calendar grid and a locale-formatted native input are both out: the phone
     uses a spin wheel, and the two apps should read the same.

     Tested with comments STRIPPED. The doc comment above `DateField` names
     `type="date"` to explain what it deliberately is not, and a plain grep read
     that prose as code — failing a correct file, which is the same trap the
     money-field checks below already avoid. */
  const taskCode = task.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  ck("and it is not the browser's calendar popup", !/type="date"/.test(taskCode));
  /* Parsing `new Date("2026-08-05")` is UTC midnight, which renders as the 4th
     in every timezone behind UTC. */
  ck("and builds the display date in local time", /new Date\(y, mo - 1, d\)/.test(task));
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
  ck("the tick is padded to the minimum target", /const pad = Math\.max\(0, \(MIN_TAP - size\) \/ 2\)/.test(task));
  ck("the tick has an accessible name", /aria-label=\{label\}/.test(task));
  ck("and the call site passes one", /label=\{filled \? `Mark done/.test(task));
}

/* ------------------- destructive focus & typed confirmation -------------- */

/* Pressing Enter/Space is the reflex the instant a dialog opens. On "Delete
   your account?" that reflex was irreversible: focus landed on the destructive
   button and there was no typed confirmation. */
{
  const dlg = read("src/components/dialog.tsx");
  ck("a destructive dialog focuses Cancel", /req\.danger\) cancelRef\.current\?\.focus\(\)/.test(dlg));
  ck("a safe dialog still focuses the affirmative button", /else confirmRef\.current\?\.focus\(\)/.test(dlg));
  ck("Cancel is reachable by ref", /ref=\{cancelRef\}/.test(dlg));

  const prof = read("src/app/profile/page.tsx");
  ck("deleting an account needs the word typed", /Type DELETE to confirm/.test(prof));
  ck("and checks it exactly", /!== "DELETE"/.test(prof));
}

/* ----------------------------- input typing ------------------------------ */

{
  const p3 = read("src/components/am-pm-board.tsx");
  // `inputMode="text"` on a money field raises the alphabetic keyboard on a
  // phone, and the field accepted `abc-!@#$` verbatim.
  ck("the money field asks for a number", /inputMode="decimal"/.test(p3));
  // Thousands commas are allowed since 19 Sep ("1,200.50"); anything else is still stripped.
  ck("and strips anything that is not one", /replace\(\/\[\^\\d\.,?\]\/g, ""\)/.test(p3));
  ck("and is labelled", /aria-label="Money made today"/.test(p3));

  const me = read("src/components/meeting-editor.tsx");
  ck("meeting time uses a time input when it can", /\? "time" : "text"/.test(me));
  /* The meeting date is bounded by the WHEEL now, not by a native input's
     min/max: it comes from the shared `DateField`, whose year column is built
     from DATE_MIN..DATE_MAX (asserted above). That is a stronger guarantee than
     min/max, which a browser only enforces on its own picker — typing past it
     still produced "62028-06-01", and Pydantic rejects the 13 characters rather
     than truncating, wedging every later save to that meeting. */
  ck("meeting dates come from the bounded wheel",
     /<DateField[\s\S]*?value=\{meeting\.date\}/.test(me));

  const ups = read("src/lib/use-pillar-state.ts");
  ck("saved strings are trimmed", /const trimDeep/.test(ups) && /trimDeep\(data\)/.test(ups));

  const task = read("src/components/task.tsx");
  ck("the delegate placeholder is grammatical", /To whom\?/.test(task) && !/To who\?/.test(task));
}

/* ---------------------- QA round 2: the M/N series ----------------------- */

{
  // M9 — a mistyped pillar URL stranded the user on a bare sentence.
  const route = read("src/app/pillar/[id]/page.tsx");
  ck("an unknown pillar keeps the app chrome", /There is no Pillar/.test(route) && /<AuthGuard>/.test(route));
  ck("and offers a way back", /Back to the pillars/.test(route));

  // M10 / N12 / N13 / N14 — login.
  const login = read("src/app/login/page.tsx");
  ck("a malformed email is caught before the request", /does not look like an email address/.test(login));
  ck("the password field can be autofilled", /autoComplete="current-password"/.test(login));
  ck("the email field is capped", /maxLength=\{254\}/.test(login));
  ck("the first field is focused", /autoFocus/.test(login));
  // `useSearchParams` needs a Suspense boundary or the static export FAILS.
  ck("the page is inside a Suspense boundary", /<Suspense/.test(login));
  // N15 — and the redirect cannot leave the origin.
  ck("the next path is honoured", /search\.get\("next"\)/.test(login));
  ck("but only as an in-app path", /startsWith\("\/"\) && !raw\.startsWith\("\/\/"\)/.test(login));

  // M6 — the Team table clipped its own Overall column.
  const team = read("src/app/team/page.tsx");
  // Strip comments: the file EXPLAINS the old 760px value, and matching the
  // explanation reported a fixed file as broken.
  const teamCode = team.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  ck("the team table fits its container",
     /min-w-\[560px\]/.test(teamCode) && !/min-w-\[760px\]/.test(teamCode));
  /* Pillar 1's header gold must FLIP with the theme. `--gold-deep` is #8a5b13
     in BOTH themes: it fixed light (4.41 -> 4.81:1) and broke dark, where the
     same value on the dark header fill measured 2.13:1 while all four sibling
     accents lightened correctly. Assert the paired token, not a class name. */
  ck("the gold header uses a theme-flipping token", /var\(--gold-header\)/.test(teamCode));
  ck("and not the fixed deep gold", !/text-gold-deep/.test(teamCode));
  {
    const css = read("src/app/globals.css");
    // Light root + the media-query dark block + the [data-theme="dark"] block.
    ck("the header gold is defined for every theme",
       (css.match(/--gold-header:/g) ?? []).length === 3,
       String((css.match(/--gold-header:/g) ?? []).length));
  }

  // M8 — Add buttons refused in silence.
  const p2 = read("src/pillars/pillar-2.tsx");
  ck("adding a solution explains a refusal", /before adding another/.test(p2));
  const p5 = read("src/pillars/pillar-5-business-systems.tsx");
  ck("the Pillar 5 ADD explains a refusal", /Give it a name first/.test(p5));

  // M11 — silent truncation.
  const ui = read("src/components/ui.tsx");
  ck("a near-full field says how much is left", /export function CharsLeft/.test(ui));
  // Pillar 3's board (and its counter) lives in the shared AmPmBoard since 18 Sep 2026.
  for (const [f, file] of [["pillar-1", "src/pillars/pillar-1.tsx"], ["pillar-2", "src/pillars/pillar-2.tsx"], ["pillar-3", "src/components/am-pm-board.tsx"]]) {
    ck(`${f} shows the counter`, /<CharsLeft /.test(read(file)));
  }

  // N1 / N2 — a placeholder-only field announced its own value, or nothing.
  ck("shared inputs fall back to the placeholder for a name",
     (ui.match(/aria-label=\{rest\["aria-label"\] \?\? \(label \? undefined : rest\.placeholder\)\}/g) ?? []).length === 2);

  // N3 — the AM plan check toggle.
  const p3 = read("src/components/am-pm-board.tsx");
  ck("the achievement toggle is named", /aria-label=\{`\$\{task\.done \? "Achieved" : "Not achieved"\}/.test(p3));
  ck("and exposes its pressed state", /aria-pressed=\{task\.done\}/.test(p3));

  // N5 — raw ISO dates leaked into the UI.
  ck("the meeting card date is formatted", /friendlyISO\(meeting\.date\)/.test(read("src/app/notes/page.tsx")));
  ck("the report period is formatted", /friendlyISO\(range\.from\)/.test(read("src/app/reports/page.tsx")));

  // N8 — a disabled arrow looked enabled.
  ck("disabled arrows look disabled",
     /opacity: disabled \? 0\.45 : 1/.test(read("src/pillars/pillar-1.tsx")));
}

/* -------------------- responsive audit, 13 Sep 2026 ---------------------- */

{
  const p3 = read("src/components/am-pm-board.tsx");
  /* The money field regressed ONCE already: a scripted edit dropped the
     replacement inside a comment, so `inputMode="decimal"` was commented out
     and `inputMode="text"` shipped. Assert on code with comments stripped. */
  const p3code = p3.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  ck("the money field asks for a number", /inputMode="decimal"/.test(p3code));
  ck("and never for text", !/inputMode="text"/.test(p3code));
  /* A flex item keeps `min-width:auto`, which for an input resolves to its
     intrinsic width from `size="20"` — about 241px. At 320px that pushed the
     field 7px past the viewport, unreachable because the page never scrolls. */
  ck("the money field can shrink below its intrinsic width",
     /min-w-0[^"]*flex-1|flex-1[^"]*min-w-0/.test(p3code) && /size=\{1\}/.test(p3code));

  // Pillar 5 rows: a keyboard user could DELETE a business but not OPEN one.
  const p5 = read("src/pillars/pillar-5-business-systems.tsx");
  /* Assert the INVARIANT, not one component's variable names: every row that
     opens something is a real <button> carrying an "Open …" label. The rows used
     to come from a single `LevelList` with an `r.onOpen` prop; they are now the
     department header and the system row inside the accordion, so pinning `r.`
     failed correct code. */
  const openLabels = [...p5.matchAll(/aria-label=\{`Open \$\{/g)].length;
  ck("Pillar 5 rows open from the keyboard", openLabels >= 2, `${openLabels} labelled rows`);
  ck("and are real buttons, not clickable divs",
     !/<div[^>]*\n\s*(?:role="button"|onClick=\{[^}]*(?:onOpen|onToggle)\})/.test(p5));
  /* The department header must say whether it is open, or a screen reader
     announces a button that appears to do nothing. */
  ck("an expandable department announces its state", /aria-expanded=\{open\}/.test(p5));

  // WCAG 2.2 target size on the controls the audit measured under 24px.
  const task = read("src/components/task.tsx");
  ck("row action buttons carry the tap class", /tap-row[^"]*rounded border/.test(task));
  ck("the bare remove button carries the tap class", /shrink-0 tap-target|tap-target shrink-0/.test(task));
  ck("breadcrumbs carry the tap class", /tap-row[^"]*font-semibold text-\[12px\]/.test(p5));
  ck("the recording tag chip carries the tap class",
     /tap-row[^"]*uppercase/.test(read("src/components/voice-notes.tsx")));
  /* Comments STRIPPED before counting. A comment explaining why the links need
     `block` names `.tap-row`, and a plain count read that prose as a third
     usage — the same trap the money-field, date-field and placeholder checks
     already avoid. */
  const login = read("src/app/login/page.tsx").replace(
    /\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    "",
  );
  ck("the login links carry the tap class", (login.match(/\btap-row\b/g) ?? []).length === 2);
  /* `.tap-row` is `inline-flex` in globals.css, so two of them sat on one line
     and read as "Forgot password?New here? Create account".

     Stacking is the PARENT's job, asserted here as such. The first attempt put
     Tailwind's `block` on each link, which loses to a plain `.tap-row` class
     selector of equal specificity defined later in the stylesheet — it looked
     right in the source and was still one line in the browser. */
  ck("and are stacked by their container, not by a losing utility",
     /flex flex-col[^"]*/.test(login) && !/tap-row block\b/.test(login));
  ck("the header logo link carries the tap class",
     /tap-row min-w-0/.test(read("src/components/shell.tsx")));

  // The team table scrolls inside its own box; say so where it cannot fit.
  const team = read("src/app/team/page.tsx");
  ck("a narrow team table says it scrolls", /Scroll sideways to see every pillar/.test(team));
  ck("and the hint is hidden once it fits", /sm:hidden/.test(team));
}

/* The target-size floor lives in ONE place. Thirteen call sites each hardcoding
   `min-h-[24px]` all landed on EXACTLY 24px with no headroom, so any later
   padding or line-height change would silently drop them back under. */
{
  const css = read("src/app/globals.css");
  const px = (name: string) =>
    Number(css.match(new RegExp(`\\.${name}\\s*\\{[^}]*min-height:\\s*(\\d+)px`))?.[1] ?? 0);
  ck("the icon target clears 24px with slack", px("tap-target") >= 26, String(px("tap-target")));
  ck("the text target clears 24px with slack", px("tap-row") >= 26, String(px("tap-row")));
  ck("an icon target constrains width too", /\.tap-target\s*\{[^}]*min-width:\s*26px/.test(css));
  // A text control gets its width from its label; a min-width would stretch it.
  ck("a text target does not", !/\.tap-row\s*\{[^}]*min-width:/.test(css));
  ck("the TS constant agrees with the CSS",
     new RegExp(`export const MIN_TAP = ${px("tap-target")}`).test(read("src/components/task.tsx")));
}

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web a11y/layout checks passed (" + pass + ")");
