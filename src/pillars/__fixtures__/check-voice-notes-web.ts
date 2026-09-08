/**
 * Voice notes in the browser.
 *
 * This was the phase with real platform risk: browsers record webm/opus
 * (Chrome, Firefox) or mp4/aac (Safari), where iOS produces m4a, and the
 * backend identifies audio by its magic bytes. That was checked BEFORE any UI
 * was written — the sniffer already accepts all three, so no backend change
 * was needed. These checks stop the client half from drifting away from it.
 *
 * The other risks, each with checks below:
 *  - a `FormData` body being JSON-stringified into "[object Object]"
 *  - audio fetched without the auth header (a bare <audio src> 401s)
 *  - the microphone left live after unmount, keeping the recording indicator on
 *  - a recording-only note being thrown away by the blank-discard rule
 */
import { readFileSync } from "fs";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const api = readFileSync("src/lib/voice-notes-api.ts", "utf8");
const client = readFileSync("src/lib/api.ts", "utf8");
const rec = readFileSync("src/components/voice-notes.tsx", "utf8");
const notes = readFileSync("src/app/notes/page.tsx", "utf8");
const editor = readFileSync("src/components/meeting-editor.tsx", "utf8");
const service = readFileSync(
  "../zaffarology-backend/app/services/voice_note_service.py",
  "utf8",
);

/* -------------- the containers a browser can actually produce ------------ */

/* Each of these is a magic-byte branch in `_looks_like_audio`. If the backend
   ever loses one, browser recordings from that engine stop uploading. */
ck("the backend recognises WebM (Chrome, Firefox)", /x1a\\x45\\xdf\\xa3/.test(service));
ck("the backend recognises MP4 (Safari)", /b"ftyp"/.test(service));
ck("the backend recognises Ogg", /b"OggS"/.test(service));
/* The client's preference list must only contain containers the server knows. */
const offered = (rec.match(/"audio\/[a-z0-9;=+ ]+"/g) ?? []).map((s) => s.replace(/"/g, ""));
const known = ["audio/webm", "audio/ogg", "audio/mp4"];
ck("every container offered is one the server accepts",
   offered.every((m) => known.some((k) => m.startsWith(k))),
   offered.join(", "));
ck("the client asks for opus first (smallest)", /audio\/webm;codecs=opus/.test(rec));
ck("and falls back to mp4 for Safari", /"audio\/mp4"/.test(rec));
ck("an unsupported list falls through to the browser's own choice",
   /return undefined; \/\/ let the browser choose/.test(rec));

/* The server decides from BYTES, not the label — which is why MediaRecorder's
   ";codecs=opus" suffix is harmless. */
ck("the server ignores the client's content type",
   /Decide from the bytes, not the label/.test(service));

/* ------------------------- multipart actually works ---------------------- */

/* JSON.stringify on a FormData yields "[object Object]", and setting
   Content-Type by hand drops the multipart boundary. Both are silent. */
ck("FormData is passed through unstringified", /body instanceof FormData/.test(client));
ck("and Content-Type is left to the browser",
   /\.\.\.\(isForm \? \{\} : \{ "Content-Type": "application\/json" \}\)/.test(client));
ck("the upload uses the multipart helper", /api\.upload<ApiVoiceNote>/.test(api));
ck("the blob is appended with a filename", /form\.append\("audio", input\.blob, /.test(api));

/* ---------------------------- authorised playback ------------------------ */

/* A bare <audio src="/voice-notes/1/audio"> sends no Authorization header and
   comes back 401, so audio is fetched through the client and played from an
   object URL. */
ck("a binary fetch path exists", /export async function requestBlob/.test(client));
ck("it sends the auth header", /Authorization: `Bearer \$\{token\}`/.test(client));
ck("audio is fetched through it", /requestBlob\(voiceNoteAudioPath\(id\)\)/.test(api));
ck("and played from an object URL", /URL\.createObjectURL\(blob\)/.test(rec));
ck("the previous object URL is revoked", /URL\.revokeObjectURL/.test(rec));

/* --------------------------- the microphone ------------------------------ */

/* A live MediaStream keeps the browser's recording indicator lit. Every exit
   path has to stop the tracks. */
/* Two distinct exits, and the first was easy to lose: the `onstop` handler
   must release the mic whether or not the recording is kept. Anchor on the
   handler itself, not on any getTracks call anywhere in the file. */
const onStop = rec.match(/rec\.onstop = \(\) => \{[\s\S]*?\n      \};/)?.[0] ?? "";
ck("the recorder's onstop releases the microphone",
   /stream\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(onStop),
   "a live MediaStream keeps the browser's recording indicator lit");
ck("and on unmount", /recorderRef\.current\?\.stream\.getTracks\(\)/.test(rec));
ck("the timer is cleared on unmount", /clearInterval\(tickRef\.current\)/.test(rec));

/* Recording needs a secure context; on plain HTTP mediaDevices is absent. */
ck("an insecure context is explained, not just broken",
   /needs a secure \(https\) connection/.test(rec));
ck("a blocked microphone says how to fix it",
   /NotAllowedError/.test(rec) && /site settings/.test(rec));
ck("the control is disabled where recording is impossible", /disabled=\{!canRecord\}/.test(rec));

/* ------------------------------ the limits ------------------------------- */

const serverMax = Number(service.match(/MAX_AUDIO_BYTES = (\d+) \* 1024 \* 1024/)?.[1] ?? 0);
ck("the server caps uploads at 4 MB", serverMax === 4, String(serverMax));
ck("the client stops at two minutes", /MAX_RECORDING_MS = 120_000/.test(api));
/* 2 minutes of opus at 128 kbps is ~1.8 MB, comfortably inside the cap. */
ck("two minutes of audio fits the cap", (128 * 1000 / 8 * 120) < serverMax * 1024 * 1024);
ck("recording stops itself at the limit", /if \(ms >= MAX_RECORDING_MS\) stop\(\)/.test(rec));
ck("a stray click is not uploaded", /MIN_RECORDING_MS = 800/.test(rec));

/* ------------------- a recording makes a note non-empty ------------------ */

/* Deleting a note soft-deletes its recordings, so the blank-discard rule must
   know about them. "Not counted yet" has to mean "assume it has audio". */
ck("the note screen tracks a real count",
   /const hasVoice = voiceCount === null \|\| voiceCount > 0;/.test(notes));
ck("the recorder reports its count", /onCountChange\?\.\(notes\.length\)/.test(rec));
ck("both editors mount the recorder",
   /<VoiceNotes noteId=\{openNote\.id\}/.test(notes) && /<VoiceNotes meetingId=\{meeting\.id\}/.test(editor));

/* A recording need not belong to a typed note. The Notes LIST carries its own
   recorder for those, exactly as the phone does — without it there is no way to
   make one on the web at all. */
ck("the notes list has a standalone recorder", /<VoiceNotes \/>/.test(notes));
/* ...and it must ask for ONLY the unattached ones, or a note's recordings show
   twice: once inside the note and once in the general list. The backend's own
   docstring names this bug. */
ck("standalone is derived from having no ids",
   /const standalone = noteId == null && meetingId == null;/.test(rec));
ck("and is sent as a query flag", /parts\.push\("standalone=true"\)/.test(api));
ck("the server implements the split",
   /standalone_only/.test(
     readFileSync("../zaffarology-backend/app/services/voice_note_service.py", "utf8"),
   ));
ck("deleting a note takes its recordings with it (server)",
   /_soft_delete_voice_notes/.test(
     readFileSync("../zaffarology-backend/app/services/notes_service.py", "utf8"),
   ));

/* ------------------ Personal / Business on a recording ------------------- */

/* A standalone recording carries the same filter notes and meetings do — it is
   the only list on the Notes screen that could not be filtered before. */
const model = readFileSync("../zaffarology-backend/app/models/voice_note.py", "utf8");
ck("the column exists", /tag = Column\(String\(20\), nullable=False, default="personal"\)/.test(model));
ck("and is indexed with user_id, like notes", /ix_voice_notes_user_tag/.test(model));
ck("a migration adds it", /add_column\(\s*"voice_notes"/.test(
  readFileSync("../zaffarology-backend/alembic/versions/c7d1e4a90b62_voice_note_tag.py", "utf8")));
/* Existing rows need a value for the NOT NULL to hold. */
ck("existing recordings get a default server-side",
   /server_default="personal"/.test(
     readFileSync("../zaffarology-backend/alembic/versions/c7d1e4a90b62_voice_note_tag.py", "utf8")));

/* THE rule: only a standalone recording owns a tag. An attached one is already
   filtered by its note or meeting, so a second tag could disagree with it. */
ck("the server refuses to retag an attached recording",
   /This recording belongs to a note, so it follows/.test(
     readFileSync("../zaffarology-backend/app/services/voice_note_service.py", "utf8")));
ck("and only tag-filters the standalone list",
   /if tag and standalone_only:/.test(
     readFileSync("../zaffarology-backend/app/services/voice_note_service.py", "utf8")));
ck("the client only shows the filter when standalone",
   /\{standalone \? \(\s*<div role="group" aria-label="Recording type"/.test(rec));
ck("and only sends a tag when standalone",
   /tag: standalone \? tag : undefined/.test(rec));
ck("the list refetches when the filter changes",
   /\}, \[noteId, meetingId, standalone, tag\]\)/.test(rec));
ck("a recording can be moved between the two", /retagVoiceNote/.test(rec));
ck("moving is optimistic and reverts on failure",
   /setNotes\(before\);[\s\S]{0,140}voice-note-retag/.test(rec));
ck("the api exposes retag", /export async function retagVoiceNote/.test(api));
ck("the tag rides on upload", /form\.append\("tag", input\.tag\)/.test(api));

/* --------------------------- discard means discard ----------------------- */

/* The recording is held locally until it is named, so discarding it leaves
   nothing behind on the server. */
ck("naming happens before the upload", /setPending\(\{ blob, ms \}\)/.test(rec));
ck("discarding uploads nothing", /nothing was uploaded, so there is nothing/.test(rec));

/* ------------------------------ API surface ------------------------------ */

for (const fn of ["loadVoiceNotes", "uploadVoiceNote", "loadVoiceNoteAudio",
                  "renameVoiceNote", "restoreVoiceNote", "deleteVoiceNote"]) {
  ck("voice-notes-api exports " + fn, new RegExp("export async function " + fn + "\\b").test(api));
}

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web voice-note checks passed (" + pass + ")");
