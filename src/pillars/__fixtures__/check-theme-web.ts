/**
 * The two themes, and the rule that governs both.
 *
 *   TEXT COLOUR FOLLOWS THE SURFACE, NOT THE THEME.
 *
 * Writing surfaces stay white (or the pale green "still to fill" wash) in both
 * themes, because a workbook's paper does not go dark. The page and the cards
 * do change. So text on a field is `--on-card`; text on a card or the page is
 * `--ink` / `--heading`.
 *
 * Getting it backwards gives ~1.2:1 — invisible. It has shipped twice on the
 * phone, and this pass found NINETEEN fields on the web that would have
 * rendered cream-on-white the moment dark mode existed. That is what these
 * checks are for.
 */
import { readFileSync } from "fs";
import { readdirSync } from "fs";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const css = readFileSync("src/app/globals.css", "utf8");

/* ------------------------------ contrast --------------------------------- */

const lum = (hex: string) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Pull a token's value out of one CSS block.
 *  A token the dark block does not redeclare INHERITS the light value — which
 *  is the whole point for the field tokens — so fall back to it. */
const tokenIn = (block: string, name: string, fallback = ""): string =>
  block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? fallback;

const lightBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme"));
const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("@theme inline"));

for (const [themeName, block] of [["light", lightBlock], ["dark", darkBlock]] as const) {
  // Inheritance is deliberate: --field, --on-card and --placeholder are the
  // same in both themes because they all describe PAPER.
  const t = (n: string) => tokenIn(block, n, tokenIn(lightBlock, n));

  /* Text on the page and on cards. */
  ck(`${themeName}: ink on the page`, ratio(t("ink"), t("background")) >= 4.5,
     `${ratio(t("ink"), t("background")).toFixed(2)}:1`);
  ck(`${themeName}: muted on the page`, ratio(t("muted"), t("background")) >= 4.5,
     `${ratio(t("muted"), t("background")).toFixed(2)}:1`);
  ck(`${themeName}: ink on a card`, ratio(t("ink"), t("surface")) >= 4.5,
     `${ratio(t("ink"), t("surface")).toFixed(2)}:1`);
  ck(`${themeName}: muted on a card`, ratio(t("muted"), t("surface")) >= 4.5,
     `${ratio(t("muted"), t("surface")).toFixed(2)}:1`);
  ck(`${themeName}: gold on the page`, ratio(t("gold"), t("background")) >= 4.5,
     `${ratio(t("gold"), t("background")).toFixed(2)}:1`);
  ck(`${themeName}: danger on the page`, ratio(t("danger"), t("background")) >= 4.5,
     `${ratio(t("danger"), t("background")).toFixed(2)}:1`);

  /* Text on a WRITING SURFACE, which is white in both themes. */
  ck(`${themeName}: on-card ink on a field`, ratio(t("on-card"), t("field")) >= 4.5,
     `${ratio(t("on-card"), t("field")).toFixed(2)}:1`);
  ck(`${themeName}: on-card ink on the empty wash`,
     ratio(t("on-card"), t("field-empty")) >= 4.5,
     `${ratio(t("on-card"), t("field-empty")).toFixed(2)}:1`);
  ck(`${themeName}: placeholder on a field`, ratio(t("placeholder"), t("field")) >= 3,
     `${ratio(t("placeholder"), t("field")).toFixed(2)}:1`);

  /* The paired tokens. */
  ck(`${themeName}: on-gold on gold`, ratio(t("on-gold"), t("gold")) >= 4.5,
     `${ratio(t("on-gold"), t("gold")).toFixed(2)}:1`);
  ck(`${themeName}: on-selected on selected`, ratio(t("on-selected"), t("selected")) >= 4.5,
     `${ratio(t("on-selected"), t("selected")).toFixed(2)}:1`);

  /* Every pillar accent, as text and as a fill. */
  for (const n of [1, 2, 3, 4, 5]) {
    const a = t(`p${n}`);
    ck(`${themeName}: accent p${n} as text on the page`, ratio(a, t("background")) >= 4.5,
       `${ratio(a, t("background")).toFixed(2)}:1`);
    ck(`${themeName}: accent p${n} as text on a card`, ratio(a, t("surface")) >= 4.5,
       `${ratio(a, t("surface")).toFixed(2)}:1`);
    ck(`${themeName}: on-accent text on a p${n} fill`, ratio(t("on-accent"), a) >= 4.5,
       `${ratio(t("on-accent"), a).toFixed(2)}:1`);
  }

  /* THE bug, asserted as a bug: these pairings must be BAD, which is why the
     tokens exist as separate things at all. */
  if (themeName === "dark") {
    ck("dark: ink on a white field really is unreadable (hence --on-card)",
       ratio(t("ink"), t("field")) < 3);
    ck("dark: on-card on a dark card really is unreadable (hence --ink)",
       ratio(t("on-card"), t("surface")) < 3);
  }
}

/* ------------------- writing surfaces do not go dark --------------------- */

for (const [name, block] of [["light", lightBlock], ["dark", darkBlock]] as const) {
  const v = (n: string) => tokenIn(block, n, tokenIn(lightBlock, n)).toLowerCase();
  ck(`${name}: the field surface is white`, v("field") === "#ffffff");
  ck(`${name}: the ink on it is dark`, v("on-card") === "#191a1e");
}

/* ------------- no component paints ink on the wrong surface -------------- */

const componentFiles = [
  ...readdirSync("src/components").filter((f) => f.endsWith(".tsx")).map((f) => `src/components/${f}`),
  ...readdirSync("src/pillars").filter((f) => f.endsWith(".tsx")).map((f) => `src/pillars/${f}`),
];

const offenders: string[] = [];
for (const f of componentFiles) {
  const src = readFileSync(f, "utf8");
  // A className that styles an input surface must not also set text-ink.
  for (const m of src.matchAll(/className=\{?"([^"]*)"/g)) {
    const cls = m[1];
    const isField =
      /rounded-(?:md|lg|xl)/.test(cls) &&
      /(border-line|border-\[1\.5px\]|bg-transparent|min-h-\[\d+px\])/.test(cls) &&
      /(px-2|px-3|px-3\.5|pl-9)/.test(cls);
    if (isField && /\btext-ink\b/.test(cls)) offenders.push(`${f}: ${cls.slice(0, 60)}`);
  }
}
ck("no field paints theme ink on itself", offenders.length === 0, offenders.slice(0, 3).join(" | "));

/* The OTHER half of the same bug, and the one the class-name check above cannot
   see: an element whose TEXT is `on-card` must never be `transparent` when
   filled. `on-card` is near-black because a field is white paper in both
   themes; transparent lets it paint on the navy card at 1.30:1 instead.
   This shipped in the Pillar 5 system editor — sections 1-5 were unreadable in
   dark mode while the textarea one line below was correct. */
const transparentInk: string[] = [];
for (const f of componentFiles) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/trim\(\)\s*\?\s*"transparent"/g)) {
    // Look at the surrounding element for the ink it pairs with.
    const around = src.slice(Math.max(0, m.index! - 400), m.index! + 400);
    if (/text-on-card/.test(around)) transparentInk.push(`${f}: ${around.slice(380, 460).trim()}`);
  }
}
ck("no filled field goes transparent while its ink is on-card",
   transparentInk.length === 0,
   transparentInk[0] ?? "");

/* Auth must stay neutral: a green sign-in form reads as an error state on the
   first screen anyone sees. */
const ui = readFileSync("src/components/ui.tsx", "utf8");
ck("the shared TextField tints only when asked", /emptyTint = false/.test(ui));
ck("and puts on-card ink on itself", /color: "var\(--on-card\)"/.test(ui));
for (const f of ["login", "signup", "forgot-password"]) {
  const src = readFileSync(`src/app/${f}/page.tsx`, "utf8");
  ck(`${f} stays neutral`, !/emptyTint/.test(src));
}

/* ------------------------------ the toggle ------------------------------- */

const theme = readFileSync("src/lib/theme.tsx", "utf8");
ck("the theme is applied before first paint", /ThemeScript/.test(theme));
ck("so there is no flash of the wrong theme", /before the first paint/.test(theme));
ck("Light, Dark and System are all offered", /"light" \| "dark" \| "system"/.test(theme));
ck("System follows the machine live", /matchMedia\("\(prefers-color-scheme: dark\)"\)/.test(theme));
ck("the choice survives a reload", /localStorage/.test(theme));
ck("storage failure is not fatal", /catch/.test(theme));

const layout = readFileSync("src/app/layout.tsx", "utf8");
ck("the pre-paint script is in the document head", /<ThemeScript \/>/.test(layout));
ck("hydration is told the html element differs", /suppressHydrationWarning/.test(layout));

/* -------------------------- both themes defined -------------------------- */

ck("a media query covers people who never choose",
   /@media \(prefers-color-scheme: dark\)/.test(css));
ck("and an explicit choice overrides it", /:root\[data-theme="dark"\]/.test(css));
ck("light can be forced back on a dark machine",
   /:root:not\(\[data-theme="light"\]\)/.test(css));

/* The browser's own surfaces are part of the design. */
for (const [what, re_] of [
  ["text selection", /::selection/],
  ["the caret", /caret-color:/],
  ["scrollbars", /scrollbar-color:|::-webkit-scrollbar/],
  ["the focus ring", /:focus-visible/],
] as const) {
  ck(`${what} is themed`, re_.test(css));
}
ck("a mouse click leaves no focus ring", /:focus:not\(:focus-visible\)/.test(css));
ck("motion is optional", /prefers-reduced-motion/.test(css));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web theme checks passed (" + pass + ")");
