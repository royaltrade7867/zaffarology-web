# Changelog — Zaffarology Web App

Next.js 16 + Tailwind v4. Newest entries first.

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
