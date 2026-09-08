# Changelog — Zaffarology Web App

Next.js 16 + Tailwind v4. Newest entries first.

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

Pinned by `check-pillar-1-preserves-mobile.ts` (21 checks), which fails if the
lists are ever read from the top level again.

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
