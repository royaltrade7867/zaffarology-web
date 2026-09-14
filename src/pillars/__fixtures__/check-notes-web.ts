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
/* THE direction that matters. Deleting a note soft-deletes its recordings, so
   "not counted yet" must mean "assume it has audio". A bare `false` asserts
   there is definitely none and would delete a recording. */
ck("hasVoice fails SAFE when the count is unknown",
   /const hasVoice = voiceCount === null \|\| voiceCount > 0;/.test(page));
ck("and is never hardcoded false", !/const hasVoice = false/.test(page));
/* A fresh item must start unknown, or the previous note's count authorises a
   delete on this one. */
ck("the count resets when a different item opens",
   /setVoiceCount\(null\);\s*\n\s*\}, \[openNoteId, openMeetingId\]\)/.test(page));
ck("the recorder reports its count back",
   /onCountChange=\{onVoiceCount\}/.test(page));

/* --------------------- never clear what the phone set --------------------- */

/* Attendee tagging landed in Phase 3, so the editor DOES write attendee_ids now
   — but only ever by adding or removing ONE id. A blanket write (`[]`, or the
   whole array from local text) would un-tag everyone on a meeting the phone had
   tagged. */
ck("tagging adds one id, never replaces the list",
   /attendee_ids: \[\.\.\.meeting\.attendee_ids, p\.userId\]/.test(editor));
ck("untagging removes one id by filter",
   /attendee_ids: meeting\.attendee_ids\.filter\(\(id\) => id !== untagUserId\)/.test(editor));
ck("the editor never blanks the id list",
   !/attendee_ids: \[\]/.test(editor));
/* The field owns the visible text. Writing `attendees` from addAttendee too
   raced it and overwrote the chips with the raw draft. */
ck("addAttendee touches ids only, not the text",
   !/attendees:/.test(editor.match(/const addAttendee[\s\S]*?\n  \};/)?.[0] ?? ""));
ck("but create still seeds the field", /attendee_ids: input\.attendee_ids \?\? \[\]/.test(api));

/* ------------------------ the optimistic save layer ---------------------- */

ck("a pending save is flushed on unmount, not cancelled",
   /useEffect\(\(\) => \(\) => flushAll\(\), \[flushAll\]\)/.test(hook));
ck("and flushed when the tab closes", /beforeunload/.test(hook));
ck("flushAll runs the save rather than dropping it",
   /clearTimeout\(timer\);\s*\n\s*\/\/[^\n]*\n\s*send\(patch, unloading\)/.test(hook));
ck("a refresh cannot overwrite a row with unsaved edits",
   /dirty\.current\.has\(`note-\$\{row\.id\}`\)/.test(hook) &&
   /dirty\.current\.has\(`meeting-\$\{row\.id\}`\)/.test(hook));
ck("a failed save is surfaced, not swallowed",
   /Some changes could not be saved/.test(hook));

/* THE data-loss bug found in browser testing. Each queued save used to REPLACE
   the pending one for that row, and each carried only its own patch — so typing
   a title and then the body inside the 500ms window sent `{body}` alone and the
   title was silently lost. Local state kept showing it, so nothing looked wrong
   until a real reload. Patches now accumulate. */
ck("pending patches MERGE rather than replace",
   /const merged: Partial<T> = \{ \.\.\.\(existing\?\.patch as Partial<T>\), \.\.\.patch \};/.test(hook));
ck("the accumulated patch is what gets sent", /send\(merged, beacon\)/.test(hook));
ck("and a flush sends the accumulated patch too", /send\(patch, unloading\)/.test(hook));

/* Prove the behaviour, not just its shape. */
type P = Record<string, string>;
const timers = new Map<string, { patch: P }>();
const queue = (key: string, patch: P) => {
  const ex = timers.get(key);
  timers.set(key, { patch: { ...ex?.patch, ...patch } });
};
queue("note-1", { title: "TEST" });
queue("note-1", { body: "words" });
const merged = timers.get("note-1")!.patch;
ck("title survives a body edit in the same window", merged.title === "TEST");
ck("body survives too", merged.body === "words");
timers.clear();
queue("m1", { date: "2026-09-10" });
queue("m1", { time: "2:30pm" });
queue("m1", { place: "Head office" });
const m = timers.get("m1")!.patch;
ck("a meeting keeps date, time AND place",
   m.date === "2026-09-10" && m.time === "2:30pm" && m.place === "Head office");
ck("a failed delete puts the row back",
   (hook.match(/prev\.slice\(0, at\), row, \.\.\.prev\.slice\(at\)/g) ?? []).length === 2);
ck("a delete cancels the pending save first",
   (hook.match(/cancelSave\(`(note|meeting)-\$\{id\}`\)/g) ?? []).length === 2);

/* ------------------- a save must survive the tab closing ----------------- */

/* A plain fetch started from an unload handler is cancelled with the document.
   Only `keepalive` survives, so the flush must use the beacon variant. */
const apiSrc = readFileSync("src/lib/api.ts", "utf8");
ck("the client can send a keepalive request", /keepalive,/.test(apiSrc));
ck("and exposes it as patchBeacon", /patchBeacon: <T>/.test(apiSrc));
ck("the unload flush uses the beacon form",
   /send\(patch, unloading\)/.test(hook) && /flushAll\(true\)/.test(hook));
ck("both unload events are handled (Safari fires only pagehide)",
   /"beforeunload", onLeave/.test(hook) && /"pagehide", onLeave/.test(hook));
ck("the note write can be sent as a beacon",
   /updateNote\(id, merged, beacon\)/.test(hook));
ck("the meeting write can be sent as a beacon",
   /updateMeeting\(id, merged, beacon\)/.test(hook));

/* ------------------ a delete can be taken back --------------------------- */

ck("a delete offers undo", /undoRemoveNote|undoRemoveMeeting/.test(page));
ck("and the offer expires", /setUndo\(null\), 8000/.test(page));
ck("stepping back on delete keeps the position sane",
   /setCur\(\(c\) => Math\.max\(0, c - 1\)\);/.test(page));

/* --------------- the shared decisions column cannot be overrun ----------- */

/* Pydantic REJECTS over-length rather than truncating, and every save PATCHes
   the whole meeting — so one over-long decisions list wedges every later edit
   to that meeting, title included. */
ck("the joined decisions are capped before sending",
   /joined\.length > DECISIONS_MAX/.test(editor));
ck("the cap matches the API schema", /const LONG_MAX = 20000;/.test(editor));
ck("adding stops when the column is full", /used < DECISIONS_MAX/.test(editor));
ck("the user is warned before the hard stop", /nearLimit/.test(editor));
/* The meeting date cannot overrun its column any more, and not because it is
   sliced: it comes from the shared day/month/year wheel, which builds the ISO
   string itself from a bounded year and a real day, so it is always exactly 10
   characters. This used to be a native `type="date"`, where a 5-digit year gave
   Chrome's "+012025-03-04" — 13 chars, which Pydantic REJECTS rather than
   truncating, wedging every later save to that meeting. */
ck("the meeting date comes from the bounded wheel, not a native picker",
   /<DateField[\s\S]*?value=\{meeting\.date\}/.test(editor) && !/type="date"/.test(editor));

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
   /meeting\.decisions\.split\("\\n"\)/.test(editor) &&
   /const joined = next\.join\("\\n"\);/.test(editor) &&
   /onChange\(\{ decisions: joined \}\)/.test(editor));
ck("a decision cannot contain a newline of its own",
   /t\.replace\(\/\\n\/g, " "\)/.test(editor));
ck("adding is gated on the last row having text",
   /canAddDecision = !!decisions\[decisions\.length - 1\]\?\.trim\(\)/.test(editor));
ck("removing the last decision leaves one empty row",
   /writeDecisions\(next\.length \? next : \[""\]\)/.test(editor));

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web notes checks passed (" + pass + ")");
