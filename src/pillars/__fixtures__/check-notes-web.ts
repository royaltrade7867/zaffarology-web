/**
 * Notes and meeting notes on the web.
 *
 * These are table-backed rows, so the pillar blob's whole-document overwrite is
 * not the risk here. The risks are different and all three have a check below:
 *
 *  - the blank-discard rule deleting something the user actually wrote
 *  - `attendee_ids` being cleared by the web app, silently un-tagging the
 *    connections a phone user attached to a meeting
 *  - the optimistic save layer dropping an edit (flush on unmount, don't cancel)
 */
import { readFileSync } from "fs";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const page = readFileSync("src/app/notes/page.tsx", "utf8");
const hook = readFileSync("src/lib/use-notes.ts", "utf8");
const editor = readFileSync("src/components/meeting-editor.tsx", "utf8");
const api = readFileSync("src/lib/notes-api.ts", "utf8");

/* --------------------------- the discard rule ---------------------------- */

/* Rebuild the two predicates from source so the test exercises the real
   conditions rather than a copy that could drift. */
type M = Record<string, unknown>;
const blankMeeting = (m: M) =>
  !String(m.title ?? "").trim() && !String(m.date ?? "").trim() && !String(m.time ?? "").trim() &&
  !String(m.place ?? "").trim() && !String(m.agenda ?? "").trim() && !String(m.notes ?? "").trim() &&
  !String(m.decisions ?? "").trim() && !String(m.next_steps ?? "").trim() &&
  !String(m.attendees ?? "").trim() && (m.attendee_ids as number[] ?? []).length === 0;

const base: M = { title: "", date: "", time: "", place: "", agenda: "", notes: "",
  decisions: "", next_steps: "", attendees: "", attendee_ids: [] };

ck("a wholly empty meeting is discardable", blankMeeting({ ...base }));
/* Each field on its own must be enough to KEEP the meeting. A field missing
   from the predicate is how a user's only line gets deleted on back. */
for (const f of ["title", "date", "time", "place", "agenda", "notes", "decisions", "next_steps", "attendees"]) {
  ck("a meeting with only " + f + " is kept", !blankMeeting({ ...base, [f]: "x" }));
}
ck("a meeting with only tagged attendees is kept",
   !blankMeeting({ ...base, attendee_ids: [7] }));

/* The predicate in the source must list every text field the API defines —
   a field added to ApiMeeting but not here would be treated as "blank". */
const apiTextFields = ["title", "date", "time", "place", "agenda", "notes", "decisions", "next_steps", "attendees"];
for (const f of apiTextFields) {
  ck("isMeetingBlank checks " + f, new RegExp("!m\\." + f + "\\.trim\\(\\)").test(page));
}
ck("isMeetingBlank checks attendee_ids", /m\.attendee_ids\.length === 0/.test(page));

ck("a note is only blank with no title, no body and unpinned",
   /!n\.title\.trim\(\) && !n\.body\.trim\(\) && !n\.pinned/.test(page));
/* Voice notes land in Phase 5. The hook must already be in the condition, or
   the first recording-only note gets thrown away on back. */
ck("the discard rule still consults hasVoice",
   (page.match(/&& !hasVoice/g) ?? []).length === 2);

/* --------------------- never clear what the phone set --------------------- */

/* The web editor has no connection picker yet. It must therefore never send
   attendee_ids at all — sending [] would un-tag everyone on a meeting the
   phone had tagged. */
ck("the web editor never writes attendee_ids",
   !/onChange\(\{[^}]*attendee_ids/.test(editor));
ck("but create still seeds the field", /attendee_ids: input\.attendee_ids \?\? \[\]/.test(api));

/* ------------------------ the optimistic save layer ---------------------- */

ck("a pending save is flushed on unmount, not cancelled",
   /useEffect\(\(\) => \(\) => flushAll\(\), \[flushAll\]\)/.test(hook));
ck("and flushed when the tab closes", /beforeunload/.test(hook));
ck("flushAll runs the save rather than dropping it",
   /clearTimeout\(timer\);\s*\n\s*run\(\)/.test(hook));
ck("a refresh cannot overwrite a row with unsaved edits",
   /dirty\.current\.has\(`note-\$\{row\.id\}`\)/.test(hook) &&
   /dirty\.current\.has\(`meeting-\$\{row\.id\}`\)/.test(hook));
ck("a failed save is surfaced, not swallowed",
   /Some changes could not be saved/.test(hook));
ck("a failed delete puts the row back",
   (hook.match(/prev\.slice\(0, at\), row, \.\.\.prev\.slice\(at\)/g) ?? []).length === 2);
ck("a delete cancels the pending save first",
   (hook.match(/cancelSave\(`(note|meeting)-\$\{id\}`\)/g) ?? []).length === 2);

/* ---------------------------- API surface -------------------------------- */

for (const fn of ["loadNotes", "createNote", "updateNote", "deleteNote", "restoreNote",
                  "loadMeetings", "createMeeting", "updateMeeting", "deleteMeeting", "restoreMeeting"]) {
  ck("notes-api exports " + fn, new RegExp("export async function " + fn + "\\b").test(api));
}
/* PATCH, not PUT: the endpoints treat an absent field as untouched, so a PUT
   would blank every field the screen did not happen to send. */
ck("updates use PATCH", (api.match(/api\.patch</g) ?? []).length === 2);
ck("the api client actually has patch",
   /patch: <T>\(path: string, body\?: unknown\)/.test(readFileSync("src/lib/api.ts", "utf8")));

/* --------------------------- decisions list ------------------------------ */

ck("decisions stay one newline-separated string",
   /meeting\.decisions\.split\("\\n"\)/.test(editor) && /decisions: next\.join\("\\n"\)/.test(editor));
ck("a decision cannot contain a newline of its own",
   /t\.replace\(\/\\n\/g, " "\)/.test(editor));
ck("adding is gated on the last row having text",
   /canAddDecision = !!decisions\[decisions\.length - 1\]\.trim\(\)/.test(editor));
ck("removing the last decision leaves one empty row",
   /writeDecisions\(next\.length \? next : \[""\]\)/.test(editor));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web notes checks passed (" + pass + ")");
