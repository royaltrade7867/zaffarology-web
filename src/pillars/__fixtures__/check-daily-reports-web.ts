/**
 * Daily system reporting on the web.
 *
 * The questions live in the Pillar 5 BLOB and the answers in their own TABLE,
 * joined by `pair_id`. Three things can go wrong, and each has checks below:
 *
 *  - the client's "a no needs an explanation" rule drifting from the server's,
 *    so a save the UI accepted comes back 400
 *  - answers keyed by anything other than the pair's stable id, which
 *    re-attaches them to the wrong question after a pair is deleted
 *  - this screen writing to the pillar blob, which it must never do
 */
import { readFileSync } from "fs";

import { canSave, needsReason } from "@/components/daily-system-report";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const editor = readFileSync("src/components/daily-system-report.tsx", "utf8");
const card = readFileSync("src/components/todays-reports-card.tsx", "utf8");
const api = readFileSync("src/lib/system-reports-api.ts", "utf8");
const route = readFileSync("src/app/daily-report/[id]/page.tsx", "utf8");
const service = readFileSync(
  "../zaffarology-backend/app/services/system_report_service.py",
  "utf8",
);

/* ------------------- the rule matches the server's exactly --------------- */

type D = { effort: "" | "yes" | "no"; result: "" | "yes" | "no"; days: string; reason: string };
const d = (o: Partial<D> = {}): D => ({ effort: "", result: "", days: "", reason: "", ...o });

ck("nothing answered saves nothing", !canSave(d()));
ck("a plain yes/yes saves", canSave(d({ effort: "yes", result: "yes" })));
ck("one side answered is enough", canSave(d({ effort: "yes" })));

/* THE workbook rule: a "no" owes days AND a reason. */
ck("an effort 'no' needs an explanation", needsReason(d({ effort: "no" })));
ck("a result 'no' needs one too", needsReason(d({ result: "no" })));
ck("a bare 'no' cannot be saved", !canSave(d({ effort: "no" })));
ck("a 'no' with only days cannot be saved", !canSave(d({ effort: "no", days: "2" })));
ck("a 'no' with only a reason cannot be saved", !canSave(d({ effort: "no", reason: "late" })));
ck("a 'no' with both saves", canSave(d({ effort: "no", days: "2", reason: "late" })));
ck("zero days is allowed", canSave(d({ effort: "no", days: "0", reason: "late" })));
ck("whitespace is not a reason", !canSave(d({ effort: "no", days: "2", reason: "   " })));

/* The server caps days; the client must too, or a valid-looking entry 400s. */
const serverMax = Number(service.match(/DAYS_MORE_MAX\s*=\s*(\d+)/)?.[1] ?? 0);
const clientMax = Number(editor.match(/const DAYS_MAX = (\d+)/)?.[1] ?? 0);
ck("the client knows the server's day cap", clientMax === serverMax, `${clientMax} vs ${serverMax}`);
ck("a day count above the cap is refused",
   !canSave(d({ effort: "no", days: String(serverMax + 1), reason: "late" })));
ck("the cap itself is allowed",
   canSave(d({ effort: "no", days: String(serverMax), reason: "late" })));
ck("the field cannot type past the cap's width", /slice\(0, 3\)/.test(editor));

/* Both sides must agree on which answers exist at all. */
ck("the server accepts exactly '', 'yes', 'no'",
   /effort not in \("", "yes", "no"\)/.test(service));
ck("and so does the client's type", /"" \| "yes" \| "no"/.test(api));

/* --------------- clearing a 'no' clears what it owed --------------------- */

/* A stale reason riding along on an answer that no longer needs one is exactly
   what the server strips, so the client must not send it. */
ck("switching away from 'no' clears days and reason",
   /if \(!needsReason\(next\)\) \{\s*\n\s*next\.days = "";\s*\n\s*next\.reason = "";/.test(editor));
ck("and they are omitted from the request too",
   /daysMore: needsReason\(next\) \? Number\(next\.days\) : null/.test(editor) &&
   /reason: needsReason\(next\) \? next\.reason\.trim\(\) : ""/.test(editor));

/* ----------------------- answers key off the pair id --------------------- */

/* Index-based keys re-attach answers to the wrong question after a delete —
   the reason EffortPair carries a stable id at all. */
ck("saves are keyed by pair id", /pairId: string/.test(api) && /pair_id: input\.pairId/.test(api));
ck("loaded answers are keyed by pair id", /next\[r\.pair_id\] = fromRow\(r\)/.test(editor));
ck("the card counts by pair id", /byPair\.has\(p\.id\)/.test(card));
ck("no index is used as an answer key", !/pairs\[\s*i\s*\]\.\s*(effort|result)\b.*save/i.test(editor));

/* ------------------- this screen never writes the blob ------------------- */

/* The 12 sections are edited in Pillar 5. Only the day's answers belong here,
   and they live in a table — a blob write from this screen could clobber a
   system definition edited elsewhere. */
for (const [name, src] of [["editor", editor], ["card", card], ["route", route]] as const) {
  ck(`the ${name} never PUTs a pillar blob`, !/api\.put\([^)]*v3\/pillars/.test(src));
}
ck("the card is read-only by construction", /Nothing here writes anything/.test(card));

/* ---------------------------- the card's manners ------------------------- */

/* Home is the first thing anyone sees: a daily-report failure must not put an
   error banner on it, and an account with no systems must not see an empty
   card. */
ck("a failure leaves Home alone", /setRows\(\[\]\);/.test(card) && /must not\s*\n\s*\/\/ put an error banner/.test(card));
ck("no systems means no card", /if \(!answerable\.length\) return null;/.test(card));
ck("one system's failure does not blank the others",
   /One system's answers failing must not blank the whole card/.test(card));
ck("a long list is capped", /const VISIBLE = 5/.test(card));

/* ----------------------------- API surface ------------------------------- */

for (const fn of ["loadDayReports", "loadRangeReports", "saveReport", "shareSystemReport"]) {
  ck("system-reports-api exports " + fn, new RegExp("export async function " + fn + "\\b").test(api));
}
/* PUT, not POST: answering the same pair twice must update one row, not add a
   second. The server relies on that being idempotent. */
ck("saving is idempotent (PUT)", /api\.put<SystemReport>\("\/system-reports"/.test(api));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web daily-report checks passed (" + pass + ")");
