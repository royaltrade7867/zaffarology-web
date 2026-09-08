# Changelog — Zaffarology Web App

Next.js 16 + Tailwind v4. Newest entries first.

## 2026-09-08 - Voice notes join the Notes screen's own filter

Standalone recordings now carry Personal / Business, and **the screen's single
filter drives all three lists**. Picking "Business" shows business notes,
business meetings and business recordings; "All" shows everything. Needed a
backend change too — see the backend changelog.

- One control, at the top of the screen, where it already was. The recorder has
  no filter of its own: notes, meetings and recordings are three views of the
  same person's material, so asking for "Personal" twice would be two controls
  doing one job.
- A new recording inherits the active filter's tag, so making one while
  "Business" is selected does not immediately hide it — the same rule a new
  note already followed.
- A per-row control still moves a recording between the two, because filtering
  and *correcting* a tag are different jobs: the filter cannot fix one that was
  recorded under the wrong tag.
- None of it appears on a recording attached to a note or meeting — that one is
  already filtered by its owner, so a second control would be a lie. The server
  refuses it there as well.

## 2026-09-08 - Phase 7: The design pass, and dark mode

`PRODUCT.md` and `DESIGN.md` now record what the app is and the visual system it
inherited from the phone. The world was not replaced — it was documented and
extended for a wide screen.

**Dark mode, matching the phone.** Navy page, cream text, lightened gold, with
the phone's rule intact: **writing surfaces stay white in both themes**, because
a workbook's paper does not go dark. Light / Dark / System in Profile, applied
before first paint so there is no flash of the wrong theme.

**Nineteen fields would have rendered invisible text the moment dark mode
existed.** They set `text-ink` on a white field — cream on white, 1.2:1. This is
the bug CLAUDE.md says has shipped twice on the phone, and it was sitting in the
web app waiting for a dark theme to expose it. All nineteen now use `--on-card`.

Other contrast failures found by measuring rather than looking:

- `bg-heading text-white` on four tab/pill controls: `--heading` is navy in
  light and **cream** in dark, so white-on-cream was 1.2:1. Replaced with a
  `--selected` / `--on-selected` pair that contrasts by construction.
- White text on a pillar-accent fill failed on **all five** accents in dark
  (2.2–2.8:1), because the accents lighten for the navy page. Added
  `--on-accent`, which flips with the theme; worst case is now 5.36:1.
- The placeholder was tinted for the navy page, but a placeholder only ever sits
  on a *field* — it was 2.58:1 on the white paper it actually renders against.
  It is now one value that clears 3:1 on both field states.

**The accents became CSS variables.** ~80 call sites read `p.accent` into an
inline style, where a fixed hex cannot follow the theme, and the light accents
sit at 1.6–2.9:1 on navy. `Accents` are now `var(--pN)`; `AccentHex` keeps the
literal values for report HTML, which is rendered outside the document where a
`var()` resolves to nothing. A fixture asserts each is used in the right place.

Also in this pass: the browser's own surfaces are themed (selection, caret,
scrollbars, focus rings); `focus-visible` is always visible and a mouse click
leaves no ring; `prefers-reduced-motion` is respected; Home was rebuilt for the
width with a real masthead; control glyphs (`✕ ◀ ▶ ✓`) became drawn icons, while
the same glyphs *inside the workbook's own copy* were left alone; and three
stale "8 pillars" strings in app copy became 5.

81 checks in `check-theme-web.ts`, including two that assert the WRONG pairings
really are unreadable — which is why the tokens exist separately at all.

## 2026-09-08 - Phase 6: About → Instructions

The workbook's own guidance, on the About screen behind a switcher: the general
"How to Use This App" sections, then one collapsible row per pillar with its
steps, summary, core truth and how it is actually worked.

This also brings the pillar COPY to the web for the first time —
`content/pillars.ts` had no web equivalent at all, so the scaffold rendered
titles and nothing else. Both content files ported verbatim; they are pure data
with no imports.

**The mapping trap, avoided and pinned.** `content/pillars.ts` keeps the
workbook's numbering, where Business Systems is 8, while the app shows it as
pillar 5 — and pillar 1's content is titled "EXACT GOAL AND PLAN", not
"Dreaming to Achieving". Matching on title text almost works and then silently
attaches the wrong instructions to pillar 1 with no error anywhere. The explicit
`CONTENT_ID_FOR_DISPLAY` map came across with it, and the fixture proves the
failure: reintroducing title matching leaves pillar 1 with the fallback title
and an empty body. Verified the resolved instructions are identical across both
apps before building the UI.

Rows are collapsed by default with proper `aria-expanded`/`aria-controls`, since
the general instructions are what a first-time reader needs and five expanded
pillars would bury them.

35 checks in `check-instructions-web.ts`.

## 2026-09-08 - Phase 5: Voice notes

Recording and playback in the browser, attached to a note or a meeting exactly
as on the phone.

**The container risk turned out to be no risk at all, and that was checked
first.** The plan flagged this as the highest-risk phase: browsers record
webm/opus (Chrome, Firefox) or mp4/aac (Safari) where iOS produces m4a, and the
backend sniffs magic bytes. Before writing any UI I fed the real sniffer genuine
files produced by ffmpeg — WebM/Opus, MP4/AAC and Ogg/Opus — and all three were
accepted. **No backend change was needed.** The service ignores the client's
Content-Type entirely and decides from the bytes, which is also why
`MediaRecorder`'s `;codecs=opus` suffix is harmless.

- **`MediaRecorder`** with a container preference list, opus first (smallest),
  falling back to mp4 for Safari and then to the browser's own choice.
- **Naming before upload**, pre-filled with the date. Discard really discards —
  nothing has been uploaded at that point.
- **Playback through the API client**, not a bare `<audio src>`: the audio
  endpoint needs the Authorization header, so a plain src attribute 401s. The
  blob is played from an object URL, which is revoked when the next one starts.
- **The microphone is released on every exit path.** A live `MediaStream` keeps
  the browser's recording indicator lit; both `onstop` and unmount stop the
  tracks.
- **A blocked mic or an insecure origin is explained**, not left as a dead
  button — on plain HTTP `navigator.mediaDevices` is simply absent.
- `api.upload` and `requestBlob` added to the client. A `FormData` body must not
  be `JSON.stringify`d (it becomes `"[object Object]"`) and its Content-Type
  must be left to the browser, or the multipart boundary is missing.

**`hasVoice` is now a real count.** Phase 2 pinned it `true` because the web
could not count recordings and deleting a note soft-deletes its audio. The
blank-discard rule now reads the recorder's count, with "not counted yet" still
meaning "assume it has audio" — the direction that cannot destroy anything.

40 checks in `check-voice-notes-web.ts`.

## 2026-09-08 - Phase 4b: Daily system reporting

The daily path into Pillar 5, completing Phase 4.

- **"Today's reports" on Home** — every system with effort/result questions,
  with how many are answered today, one click from opening the app. A system is
  otherwise five clicks deep, which is right for defining one and far too buried
  for something done daily. It renders nothing when there are no systems, and a
  failure leaves Home alone rather than putting an error banner on the first
  screen anyone sees.
- **`/daily-report/[id]`** answers one system's questions for the day. Questions
  are read from the Pillar 5 blob, answers written to the `system_reports`
  table, joined by the pair's stable id — index-based keys would re-attach an
  answer to the wrong question after a pair was deleted.
- **A "no" owes days and a reason.** That is the workbook's rule and the server
  enforces it, so the client does too: the user is told before the request goes,
  not after it comes back 400. Switching away from "no" clears both, so a stale
  reason cannot ride along on an answer that no longer needs one.
- Saving is a PUT and idempotent — answering the same pair twice updates one row
  rather than adding a second.

**Caught a client/server mismatch:** the server caps `days_more` at 999 and
rejects anything higher, but the field allowed four digits — so "1000" would
have been accepted by the UI and bounced back as a 400 the user had to decode.
The cap is now read from the backend source in the fixture, so the two cannot
drift. Mobile has the same gap and is worth the same fix.

36 checks in `check-daily-reports-web.ts`.

## 2026-09-08 - Phase 4a: Reports, as a real PDF

Pillar and progress reports, ported from mobile onto the same shared report
tree — the stats, HTML and text renderers are the *same source*, so both apps
agree on what a report says. Only `share.ts` had native imports, so everything
else moved across untouched.

- **A real PDF download** (pdfmake), chosen over rasterising the HTML: the text
  is selectable and searchable, verified by extracting the ToUnicode CMaps from
  a generated file rather than assuming it. ~1 MB, dynamically imported, so
  nobody pays for it until they ask for a PDF.
- **Copy as text** for a quick paste into an email or a message.
- The report loader mirrors `usePillarState`'s semantics without a component,
  including the offline `localStorage` fallback — the cache key is asserted to
  match the hook's, or the fallback silently finds nothing.

**A pdfmake bug worth recording.** pdfmake 0.3's `vfs_fonts` registers its own
fonts; the first version of this code hand-wired them from a `mod.vfs` that
does not exist in 0.3, overwriting the working font map with `{}`. `createPdf`
then hung forever — no throw, no console output, no download. It was only found
by generating a PDF in headless Chrome. The fixture now pins the correct wiring.

**Fixed a colour drift found on the way.** `Accents.gold` in `lib/pillars.ts`
was still `#9A6A00` — the value that fails contrast at 4.38:1 on paper — while
`globals.css` had been corrected to `#8F6200`. So every report printed the wrong
gold, and the TS and CSS layers disagreed. All three definitions (report
palette, CSS, accent map) are now asserted equal.

32 checks in `check-reports-web.ts`.

## 2026-09-08 - Phase 3: Connections and task assignment

Invite people by email, accept, and tag them on a task so it lands on their
board — the same rows the phone uses.

- **Connections panel** on Team: invite, invites received (accept/decline),
  connected, invites sent (withdraw). Rows are busy-guarded so a double-click
  cannot fire two requests.
- **The invite message never varies.** `/connections/invite` answers
  byte-identically whether the address has an account, is already connected, or
  is the user themselves — otherwise it becomes a way to discover who has a
  Zaffarology account. The UI says the same thing regardless, and the fixture
  asserts it does not read the server's reply to decide what to show.
- **`PersonTagField`** with connection suggestions, matching the START of any
  word in a name or email — a bare `includes` made typing "H" match "Sarah" and
  "Ahmed" as well as "Hammad". Free-typed names keep working; tagging is
  additive and never forced.
- **Confirm before sending**, mirroring mobile: picking someone asks whether to
  email them, and the wording says they are tagged *either way* — otherwise
  "just tag" reads like it cancels. This is what replaced the old 30s undo
  window; CLAUDE.md still described the window, and has been corrected.
- **`AssignedToMe` overlay** above the Pillar 4 board — read-only apart from the
  done checkbox. Assignments are never merged into the pillar blob: the title
  lives on a server row the assignee cannot write, which makes "you can't edit
  the assigner's wording" structural rather than a UI convention, and means a
  whole-blob overwrite cannot delete a task someone assigned you.
- **Meeting attendees can now be tagged**, closing the Phase 2 gap. `addAttendee`
  handles ids ONLY — the field owns the visible text, and writing both from the
  handler raced it and overwrote the chips with the raw draft.
- Hooks refetch when the tab becomes visible (the browser's stand-in for
  mobile's foreground event); there is no push channel either way.

Review caught five defects, fixed before the phase closed:

- **Typing a comma was silently eaten**, merging two attendees into one. The
  port dropped mobile's `onDraft`, and `setAll` trimmed the trailing separator —
  which is precisely what marks a name as committed — so "Ana, Bo" was stored as
  the single name "Ana Bo" with no chips. The separator is now always kept, and
  three keystroke replays in the fixture prove the sequences stay apart.
- **Removing a chip never untagged the person.** Both the X and backspace
  rewrote only the text, so `attendee_ids` kept an id with nothing on screen to
  show it — unremovable, since re-adding and re-removing repeated the no-op.
- **The "Invites sent" list disclosed who has an account, and their real name.**
  `/connections/invite` answers identically by design, but the pending row it
  creates resolved the counterpart User a moment later, so a registered address
  showed "Jane Doe / Waiting for them to accept" and a stranger showed the raw
  email. One invite at a time, that enumerates the user base and maps it to
  names. **Fixed in the backend** (`ConnectionService.list_for` now withholds
  the id and name on an unaccepted *outgoing* row), since both apps read the
  same rows; incoming invites and accepted connections resolve as before. The
  web wording no longer branches either. 13 checks in
  `zaffarology-backend/scripts/check_invite_privacy.py`.
- **The suggestion list was unreachable by keyboard.** It handled `onMouseDown`
  only, and blur closed the list before Tab could reach it — so tagging was
  mouse-only. Now a proper combobox: arrow keys move, Enter picks, Escape
  dismisses, with `role="option"` and `aria-activedescendant`. Nothing is
  pre-selected, so a stray Enter cannot assign anyone.
- **Two people assigned the same task collapsed to one badge.** The DB
  constraint is (assigner, pillar, task, assignee), so several rows can share a
  `source_task_id`; a plain map kept whichever the server returned last, which
  made the status note flip between people and could unassign the wrong one.
  Rows are now grouped and ordered by id, with "+N more assigned" surfacing the
  rest instead of hiding them.

**One deliberate divergence from mobile:** untagging now clears the tag only
after the server confirms the unassign. Mobile clears it first, so a failed
`unassignTask` leaves that board looking untagged while the task is still on the
assignee's board — the two disagree until someone reloads. Worth porting back to
mobile; the assign path already had the safe ordering on both.

68 checks in `check-connections-web.ts`, including behavioural proof of the
suggestion matcher and the attendee chip parsing.

## 2026-09-08 - Phase 2: Notes and Meeting notes

Ported from mobile onto the same backend rows (`/notes`, `/notes/meetings`), so
a note written on the phone opens on the web and back again.

- **Notes / Meeting notes switcher**, a Personal / Business filter, and a
  Prev/Next navigator that walks the *filtered* list. Switching tab or filter
  resets the position — index 3 of one list means nothing in another.
- **The blank-discard rule.** Creating a note has to create the row up front
  (the editor saves by id), so opening one and going straight back would leave
  an "Untitled note" nobody meant to create. A single character or a pin counts
  as intent and keeps it.
- **A new item inherits the active filter's tag**, falling back to whatever the
  last item of that kind used — defaulting a business user's every note to
  "personal" would hide it the moment they filter.
- **Meeting decisions are a numbered list**, gated so a new row needs the
  previous one filled, stored as one newline-separated string exactly as mobile
  does. Changing that shape would break the emailed report and the phone.
- **The web editor never writes `attendee_ids`.** Connection-tagging is Phase 3
  here, and sending `[]` would silently un-tag everyone on a meeting the phone
  had tagged.
- Optimistic edits on a 500 ms debounce, ported with all three of mobile's
  safety rules — a pending save is flushed rather than cancelled, a refresh
  cannot overwrite a row with unsaved edits, and a failed delete puts the row
  back. Added `beforeunload` on top: a browser tab can be closed mid-debounce,
  where the phone always unmounts first.
- `api.patch` added to the client. These endpoints treat an absent field as
  untouched, so a PUT would blank every field the screen did not send.
- **A drawn icon set** (`components/icons.tsx`) — one family, one stroke weight,
  `currentColor` — replacing Unicode arrows, which render differently on every
  platform and cannot be baseline-aligned.

Review of the port caught four defects, fixed before it landed:

- **The blank-discard rule could delete a phone recording.** `hasVoice` was
  hardcoded `false`, which asserts "definitely no audio"; mobile treats unknown
  as *has* audio so a slow load can never delete. Deleting a note soft-deletes
  its voice notes server-side, so a recording-only note opened on the web and
  backed out of would have destroyed the audio. Now pinned `true` — discard is
  off here until the recorder can actually count them.
- **The tab-close flush never reached the server.** A `fetch` started from a
  `beforeunload` handler is cancelled when the document is torn down, so the
  last edit before a close was silently lost while the code looked correct.
  Added `keepalive` support (`api.patchBeacon`) and `pagehide` alongside
  `beforeunload`, since Safari often fires only the latter.
- **A long decisions list wedged every later save.** All the rows share one
  20000-char column and Pydantic rejects rather than truncates — and each save
  PATCHes the whole meeting, so one over-long list 422'd every subsequent edit
  to it, title included, while the screen still showed the text. The join is
  now capped client-side with a warning before the hard stop.
- **`maxLength` does nothing on `<input type="date">`.** A five-digit year
  yields `+012025-03-04` (13 chars) against a 10-char column, wedging saves the
  same way. Clamped on write.

Also: deletes now offer **Undo** (the rows are soft-deleted, so it genuinely
restores them, recordings included), `cur` steps back on delete so the user
lands beside what they removed, and the kind switcher became plain toggle
buttons — it announced itself as a tab widget without arrow-key support.

**Contrast:** `--gold` moved to `#8F6200`. The web app still carried `#9A6A00`,
which sits at 4.38:1 on paper — mobile had already darkened it for exactly this
reason, so the two apps disagreed. `--placeholder` moved to `#7d8a9c` (2.38:1 →
3.51:1 on white, 3.31:1 on the empty-field green).

63 checks in `check-notes-web.ts`, covering every field of the discard predicate
individually and each of the four defects above.

## 2026-09-08 - Pillar 1 rebuilt: each goal is its own project

The screen now matches mobile's model instead of merely preserving it. A goal is
a self-contained project owning its plan, **target date** and its own
work-of-day / do-or-die / extra-mile / delegated lists — previously those four
lists were shared across every goal, and the deadline could not be seen or
edited on the web at all.

- **One goal at a time**, behind a ◀ Prev / Next ▶ project navigator ("Goal 2 of
  3"), matching the Pillar 4 huddle board.
- **Target date** field added — mobile has stored `target` per goal all along;
  the web could not show it.
- **New day** now clears only the daily task lists. Goals, plans and target
  dates persist (they are projects, not day entries) and un-chased delegated
  items carry over. `rollover` is now byte-identical to mobile's.
- **Previous Days** groups each day's entry per goal, with that goal's deadline
  and its four lists, rather than one flat set.
- "+ Add goal" is gated on the **last** goal being filled, not the viewed one —
  otherwise navigating back to a complete goal 1 let you add goal 3 while goal 2
  sat blank in the middle. Extra-mile adds are gated the same way.
- `setG` re-clamps the goal index inside the updater, so a late keystroke after
  a removal cannot write to a goal that no longer exists.

Two further data-loss bugs found in review of the rebuild and fixed before it
landed:

- **A delegated task created on web had no stable `id`.** It was pushed as an
  inline literal, so `withId` minted a *fresh random* id on every load until a
  save landed. A phone user who tagged that task would see its "Sent to Sam,
  waiting" badge silently vanish, and re-tagging sent a duplicate email. Now
  uses `blankDeleg()`, which is what that helper exists for.
- **Goal and plan were capped at 250 characters, where mobile allows 600.** An
  HTML `maxLength` does not truncate an existing value on render, but the
  browser clamps it the moment the user types — so opening a 480-character plan
  written on the phone and pressing one key destroyed 230 characters of it, with
  no save button and no warning.
- Previous Days now shows the deadline as "Thu, 31 Dec 2026" rather than a raw
  ISO string, and the live field is labelled "Deadline" to match mobile (the
  history renderer on this screen already said Deadline).

Pinned by `check-pillar-1-preserves-mobile.ts` (28 checks), which fails if the
lists are read from the top level again, if a delegated row is pushed without an
id, or if the input cap drops below mobile's.

## 2026-09-08 - Phase 1: pillars on the shared schema, and a data-loss fix

**Fixed: opening Pillar 1 on the web deleted phone data.** Mobile stores each
goal's deadline and task lists inside the goal (`target`, `work`, `dod`,
`extra`, `deleg`); web's `migrateGoals` rebuilt every goal from `goal`/`plan`
alone, so the other five were dropped and saved back over the shared
`/v3/pillars/{key}` blob. Merely *viewing* the page destroyed a phone user's
Work-of-the-Day, Do-or-Die list, extras and delegations. Goals are now carried
through by spread; the screen still renders goal/plan, but no longer destroys
what it does not display. Pinned by `check-pillar-1-preserves-mobile.ts`, which
names each field if the one-character regression returns.

- **Pillars 2, 3 and 4 now run the shared normalizer.** They previously passed
  none at all — the raw blob was spread into state and saved straight back, so
  every field mobile added rode on luck.
- **Pillar 4 was dropping `id` and `assigneeUserId`** from every item. `id` is
  identity for task assignments, and rows are spliced by index, so losing it
  orphans an assignment. Web now uses the shared `blank()`/`makeInitial()`,
  which mint an id and self-heal older blobs via `withId`.
- **Local type declarations removed from pillars 2–5** in favour of
  `@/pillars/schemas/*`. One definition per shape across both apps, so the two
  cannot silently drift again.
- Added three web fixtures (30 checks) covering the round trip against
  realistic mobile- and legacy-written blobs.

Verified: web `tsc` + `next build` clean, all 26 mobile fixtures still pass
(the schemas are shared source).

## 2026-08-21 - Pillar 1: multiple exact goals, each with its own plan

- Ported the mobile change: repeating **"Exact Goal N" / "Exact Plan N"** blocks with a **"+ Add goal"** button that adds the goal and its plan field together, plus per-block **Remove** (kept at a minimum of one).
- **"+ Add goal" is gated on the previous goal being filled** — greyed out while the last goal is incomplete, and clicking it alerts "Fill in *Exact Goal N* / *Exact Plan N* before adding another goal." Matches mobile; new `dimmed` prop on the shared `AddButton`.
- Same `goals: { goal, plan }[]` state shape and `normalize` migration as mobile, so the shared `pillar-1` blob reads/writes identically on both clients.

## 2026-08-19 - QA fixes (from browser test pass)

- **Stuck checkbox (HIGH):** clearing a checked task's text now auto-unchecks it, and a done task can always be unchecked (`disabled={!filled && !done}`) — no more permanently-checked empty rows inflating the counter. Same fix applied to the mobile `TaskRow`.
- **Double strikethrough (MEDIUM):** the done-task input drew two lines; consolidated to a single inline `text-decoration` in the accent colour.
- **Pillar 3 Achievement (MEDIUM):** the PM Achievement textarea now shows the light-green empty state like every other field.
- **Team table (MEDIUM):** the wide progress table no longer clips its "Overall" column — it has a min-width and scrolls horizontally.
- **Eagle image (LOW):** set explicit aspect (541×424) + `height:auto` to clear the Next.js image aspect-ratio warning (browser console now clean).

## 2026-08-19 - Initial web app (foundation + Pillar 1)

- **Scaffold:** Next.js 16 (App Router) + Tailwind v4 + TypeScript, mirroring the admin-panel stack.
- **Theme:** paper palette + per-pillar accents + empty-input green, matched to the mobile app; Inter + Archivo Black fonts.
- **Backend integration (same backend as mobile):** fetch API client with JWT in localStorage; `use-pillar-state` reads/writes the **same `/v3/pillars/{key}` blobs** as mobile (shared data), debounced save + localStorage cache + unmount flush.
- **Auth:** welcome, login, 3-path signup (individual/company/employee), verify-email, forgot-password; session restore + account deletion.
- **Shell:** top nav + auth guard, pinned pillar scaffold (brand bar + chips + title), shared UI (buttons, empty-green inputs, task rows, gold/navy checkbox, date field, filed box, "Previous Days" reporting).
- **Screens:** home 8-pillar grid, About, Team (per-pillar progress table), Profile (invite code + delete).
- **All 8 pillars fully ported** from mobile, each keeping the exact state shape + blob key (shared data):
  - P1 Dreaming to Achieving, P2 Problem Solving, P3 AM/PM (money engine), P4 2-Minute Huddle, P5 Loyalty & P6 AI (shared idea-pillar), P7 Record Keeping (A–Z), P8 Business Systems (12-section tree + `normalizeP8`).
  - Same reset/reporting/reporting-snapshot logic, same content/labels, same empty-input green + gold/navy checkboxes.
  - RN→web translations: Alert → window.confirm/alert, native date picker → `<input type=date>`, share sheet → mailto/clipboard.
- Verified: `npm run build` (all 11 routes) and `tsc --noEmit` clean.
