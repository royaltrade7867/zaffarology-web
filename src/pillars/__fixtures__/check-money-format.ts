/**
 * Money on the billing screens is Australian, and says so.
 *
 * This guards a bug that shipped: `Intl.NumberFormat` with
 * `currencyDisplay: "narrowSymbol"` renders AUD as a bare "$35.00", which reads
 * as US dollars to most of the world — on the one screen where someone is
 * deciding whether to pay.
 *
 * The obvious fix is worse. `style: "currency"` gives an answer that depends on
 * WHO IS READING: `en-AU` prints "$35.00" (AUD is local there, so the prefix is
 * dropped) while `en-US` prints "A$35.00". Pinning the locale to Australia
 * therefore removes the "A$" for exactly the reader most likely to assume
 * dollars are theirs. Hence an explicit prefix, and this fixture.
 *
 * Run from the web root:  npx tsx src/pillars/__fixtures__/check-money-format.ts
 */
import { readFileSync } from "node:fs";

import { formatMoney } from "@/lib/stripe";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};

/* ------------------------- Australian dollars ------------------------- */

ck("AUD is prefixed A$", formatMoney(3500, "AUD") === "A$35.00", formatMoney(3500, "AUD"));
ck("a lower-case code still works", formatMoney(4000, "aud") === "A$40.00", formatMoney(4000, "aud"));
ck("cents survive", formatMoney(199, "AUD") === "A$1.99", formatMoney(199, "AUD"));
ck("thousands are grouped", formatMoney(123456, "AUD") === "A$1,234.56", formatMoney(123456, "AUD"));

/* Never a BARE dollar sign: that is the bug this file exists for. */
ck("never renders a bare $", !/^\$/.test(formatMoney(3500, "AUD")), formatMoney(3500, "AUD"));

/* ------------------------- other currencies ------------------------- */

ck("another currency keeps its code", formatMoney(3500, "USD") === "USD 35.00", formatMoney(3500, "USD"));
/* Zero-decimal currencies have no minor unit: 1000 JPY is 1000, not 10. */
ck("zero-decimal currencies are not divided", formatMoney(1000, "JPY") === "JPY 1,000", formatMoney(1000, "JPY"));

/* ------------------------- nothing to show ------------------------- */

ck("no amount renders nothing", formatMoney(null, "AUD") === "");
ck("no currency renders nothing", formatMoney(3500, null) === "");
ck("zero is a real price, not nothing", formatMoney(0, "AUD") === "A$0.00", formatMoney(0, "AUD"));

/* ------------------------- the implementation ------------------------- */

{
  const src = readFileSync("src/lib/stripe.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /* `style: "currency"` is what makes the output depend on the reader's
     locale. If it comes back, so does the bug. */
  ck("does not use style: currency", !/style:\s*["']currency["']/.test(code));
  ck("does not use narrowSymbol", !code.includes("narrowSymbol"));
  ck("prefixes A$ explicitly", code.includes('`A$${'));
}

if (fails.length) {
  console.error(`FAILED (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`passed (${pass})`);
