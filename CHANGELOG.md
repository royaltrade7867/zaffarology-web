# Changelog — Zaffarology Web App

Next.js 16 + Tailwind v4. Newest entries first.

## 2026-09-25 - No verification step, and deep links that survive signing in

**`/verify-email` is gone.** Signing up now lands straight on Home. The page it
replaced asked for a 6-digit code and posted it to an endpoint the API never
had, so nothing typed into it could ever work; the email had only ever contained
a link. Rather than repair a step we no longer want, the step is removed.

- `AuthGuard` and the pillar page no longer bounce an unverified account, and
  `/pricing` no longer routes through verification.
- Billing is now read for every signed-in account. It used to be skipped for an
  unverified one, because `/billing/status` would only 403. With the gate gone,
  skipping it would leave billing null for every account created before this
  change, and a null billing answer reads as "not locked" — handing them the
  whole app for free.

**A pillar deep link now keeps where it was going.** `/pillar/[id]` runs its own
guard before `AuthGuard` mounts, and that guard sent people to a bare `/login`.
Signing in then dropped them on Home, so the task-assignment email's "Open
Zaffarology" button (which opens `/pillar/4`) never actually opened it. It
carries `?next=` now, like every other guarded page.

## 2026-09-25 - Workshop check-in portal

Four pages for the workshop accountability group. Three of them work with no
sign in at all, because they are opened from a reminder email by someone who
may never have logged in: the signed token in the URL is the credential.

- `/checkin/[token]` the daily form. Two fields, one button, nothing else.
  Built for the minute it actually gets: a phone, at 6am, before work. The
  morning field is focused when empty; in the evening the plan is already
  filled and focus moves to the achievement. Saving is explicit, because the
  person may close the tab the second they finish typing and needs to see it
  was kept. A closed day renders read-only with an explanation rather than an
  error.
- `/checkin/history` their own entries, newest first. Signed in, and scoped
  server-side to the caller so there is no id to tamper with.
- `/checkin/unsubscribe/[token]` stops the reminders. The copy's real job is
  making clear this is not an account deletion: someone tapping "stop these
  reminders" in an inbox at 6am has no way of knowing what else they might be
  switching off, and the answer is nothing.
- `/set-password/[token]` choose a first password from a workshop invite. One
  step, because it verifies the address at the same time. It cannot reset a
  password: the backend refuses when one already exists, and that refusal is
  shown here pointing at Forgot password.

**`/checkin` was added to `OPEN_WITHOUT_SUBSCRIPTION`.** A workshop member has
the check-in portal without necessarily paying for the five pillars, so gating
it would lock out exactly the people it was built for. The pillars stay behind
the paywall for them like anyone else.

**Fixed in review:** an untouched, empty form could be saved, answering "Kept"
to someone who had written nothing. The backend already ignored an empty row,
so the figures were never wrong; the confirmation was. Saving now needs
content.

The form also relied on `beforeunload` to protect typed text, which does not
fire reliably on a phone. The real loss path is someone typing at 6am,
switching apps, and the OS reclaiming the tab, which delivers no unload event
at all. A draft is now kept in `localStorage` per token and cleared the moment
a save succeeds, with every access guarded so a private window cannot break the
page.

No pillar schema, shared file or blob was touched. The existing fixture suite
still passes at 775.

## 2026-09-23 - "Delegation" is now "Delegation and Follow-up"

The second standard department in Pillar 5 was renamed. New businesses are
seeded with the new name; nothing rewrites an existing one.

Three behaviours key off that name, and each fails silently if the old spelling
stops matching, so BOTH names keep working:

- `deptKind` decides which board a system opens. Lose the match and an existing
  delegate board becomes an ordinary 12-section system: the tasks are still
  stored, but nothing renders them.
- `isStandardDept` decides whether a department can be deleted. Lose it and a
  standard department quietly becomes deletable.
- `standardIndex` is what the seed checks before adding a missing standard
  department. Lose it and every load inserts a SECOND delegation department
  beside the first.

The stored name is deliberately NOT rewritten. Doing so would mean a whole-blob
write against a user's data purely to change a label, and an older phone build
reading the same blob would not know the new spelling.

New fixture `check-dept-rename.ts` (14 checks) covers both spellings, the
absence of duplicates, and that an existing business keeps its board.

## 2026-09-19 - The pricing page now shows what you are buying

It sold a price without ever naming the product, inside a 448px auth-form
column where two plans could not be compared.

- **It lays out its own page** instead of borrowing `AuthShell` (`max-w-md`).
  Plans sit side by side from `sm:`; everything else reads at a book measure.
  The reason `AuthShell` was there — letting an unsubscribed person reach the
  page — is unchanged, since that came from having no `AuthGuard`, not from the
  shell.
- **Plans read as plans.** The price is the largest thing on the card, tabular
  so the two line up; the title is a tracked label above it; the intro offer is
  a gold chip. A chosen plan is marked by the border AND a tick, never colour
  alone.
- **A real radiogroup.** Arrow keys move between plans, focus follows the
  selection, and only the chosen plan is in the tab order, so Tab crosses the
  group once instead of stopping at every card.
- **"What you get"** names the five pillars, with their real numbers, names,
  taglines and accents from `PILLARS` — so it cannot drift from what ships.
- **The status card tells the truth.** It now reads `state`, `will_renew` and
  `billing_issue`, which the page ignored: a card that had failed still said
  "renews on the 3rd". It distinguishes active, trialing, ending, and a billing
  problem, each with its own colour and wording, and turns the border red only
  for the one that needs action.

Every new colour pairing was measured in both themes: lowest is 4.81:1 (the
offer chip) against a 4.5:1 floor, and the five pillar badges sit between 4.96
and 9.01:1 against a 3:1 floor for UI text.

## 2026-09-19 - All five standard departments now work the same way

**AM/PM and Delegation were the odd ones out.** Expanding either department
showed its board immediately, while Loyalty, AI and Record Keeping each asked you
to create a system first and opened the board inside it. The two boards now live
on a SYSTEM as well, so every standard department behaves alike: add a system,
open it, get the board.

- Each system carries its own board, exactly as Loyalty/AI/Record Keeping do, so
  a business can keep "Delegation → Warehouse" and "Delegation → Sales" apart.
- `System.amPm` and `System.delegation` are new in the shared schema, carried
  explicitly through `fixSystem` (a whitelist rebuild drops anything unnamed).
- **Existing work is migrated, not stranded.** `normalize` lifts an old
  department-level board into the department's first system, creating one if it
  has none. It is idempotent, and never overwrites a board already edited at
  system level.
- The old `Department.amPm` / `Department.delegation` are deprecated but still
  read AND still written. An older phone build knows only those fields, so
  stripping them would blank that user's board until they update.
- An untouched board migrates nothing: a seeded P3 board is non-empty (it has a
  `day` and five blank rows), and moving one would manufacture a phantom "S1" in
  a department the user never opened.
- The empty state now names what a system will open — "add one below to start its
  daily AM / PM board" — rather than the generic "add one below".

New fixture `check-dept-boards-to-systems.ts` (25 checks) covers the lift, the
idempotence, the round trip and the no-phantom-systems rule.

## 2026-09-16 - Real checkout, and subscription status from every store

**`/pricing` sells for real.** It uses `@revenuecat/purchases-js` (pinned to
1.62.1), always identified as our `users.id`, the same ID the phone apps use.
- Plans and prices come from the RevenueCat offering, not from code.
- Checkout is RevenueCat Billing's own sheet. Card details go to Stripe, never
  to us.
- After paying, the page asks the backend to re-read RevenueCat
  (`POST /billing/refresh`) and waits up to 45 seconds for access, with a clear
  "Payment received" state if it takes longer. It does not trust the SDK's own
  answer, because the backend's answer is the one every platform reads.
- If the person cancels checkout, the plans simply show again.
- Declined cards, pending payments, network loss and "already purchased" each
  get their own message.
- Someone already paying through the App Store or Google Play is told where
  their subscription lives and is not offered a second one.
- Sandbox and Test Store keys show a "Test mode" badge.
- The SDK is loaded only on this page, and is switched to the right user before
  every purchase, so a browser shared by two accounts cannot buy for the wrong
  one.

**Profile's Subscription card** now covers every state: which store, renewing,
cancelled (access until a date), payment problem, free trial, free access, and
paid plus free access. Store-managed subscriptions point to that store.

**Paywall.** "I've already subscribed" asks the backend to re-check RevenueCat,
so a purchase made in the phone app unlocks the web at once. If nothing is
found, the page says which account it checked.

**Dates on the paywall and Profile were never shown.** `friendlyISO` only parses
`YYYY-MM-DD`, but the billing API sends full timestamps. The new
`friendlyTimestamp` fixes that.

Verified in a browser against the backend with a stateful fake RevenueCat. The
real Stripe or Test Store checkout still needs a RevenueCat test key.

## 2026-09-16 - Billing status loads on sign-in; subscription UI follows the server switch

**Billing status was only read on a full page load.** `signIn`, all three
sign-ups and `verifyEmail` set the user without ever reading `/billing/status`,
so after logging in the paywall gate and the Profile card did nothing until a
reload. Each of them now reads it BEFORE publishing the user, because
`AuthGuard` decides on both together. An unverified user is skipped, because
the endpoint would only return 403; `verifyEmail` reads it once they are
verified. Checked in a browser: `/billing/status` is requested right after
`/auth/login`, and a user without access lands on `/paywall` with no reload.

**The Subscription card hides while the backend's `BILLING_ENFORCED` is off.**
While the paywall is switched off, everyone is in for free, and a card saying
"Ended" with a link to a checkout that is not live would only alarm people.
Deploy the backend first: an older backend sends no `enforced` field, so the card
stays hidden, but it would still paywall users who have no billing row.

## 2026-09-13 - Responsive audit: 320px, tap targets, and a keyboard dead end

**The money field's earlier fix had never actually shipped.** A scripted edit
dropped the replacement INSIDE a comment, so `inputMode="decimal"` was commented
out and `inputMode="text"` stayed live — the phone kept raising an alphabetic
keyboard for a money amount. The fixture now strips comments before asserting,
so a fix that lands in a comment fails loudly instead of passing.

The same field also overflowed a 320px viewport by 7px, unreachable because the
page never scrolls sideways. A flex item keeps `min-width: auto`, which for an
input resolves to its intrinsic width from the default `size="20"` — about
241px. `min-w-0` plus `size={1}` lets it shrink; it now ends 31px inside the
edge at 320px.

**Pillar 5 rows were a keyboard dead end.** Each row was a clickable `<div>`
holding a Delete button, so Tab reached Delete but never the row: a keyboard
user could DELETE a business but not OPEN one, leaving every department, system
and the 12 sections beneath unreachable without a pointer. A button may not nest
inside a button, so the row's content is now the button and Delete is its
sibling. Verified with a real Enter keypress: the view moves into the business,
the breadcrumb updates, and each department row is individually named.

**Tap targets.** Everything the audit measured under the WCAG 2.2 minimum is now
at least 24px: Pillar 2's "Remove" (was 21x13, a destructive control at roughly
a quarter of the required area), the recording tag chips, the Pillar 5
breadcrumbs (18px — the text height alone), the header logo links, and the two
login links.

**The Team table** scrolls inside its own box on a phone, which is correct, but
nothing said so and "Overall" sat up to 286px out of view at 320px. A one-line
hint appears below `sm` and disappears once the table fits.

Measured in a real browser rather than inferred: **33 page-width combinations**
(11 routes at 320, 768 and 1280) report no page-level horizontal scroll, no
element past the viewport, and zero targets under 24px. 602 checks green; each
new guard verified to fail when its bug is reintroduced.

## 2026-09-12 - QA audit, round 2: the rest of the M and N series

**A build-breaking bug came out of this.** `useSearchParams` (added for the
login redirect) opts the tree into client rendering, so `/login` needs a Suspense
boundary or the static export fails outright. Caught by running the build, not
by typecheck — it would have broken the Vercel deploy.

**M6** the Team table declared `min-w-[760px]` inside a 734px container, clipping
its own Overall column to "Overal" at every desktop width; it needs 560.
**M8** every Add button that refused did so in silence — Pillar 2 and the Pillar 5
ADD now say why and focus the field to fix. **M9** a mistyped pillar URL rendered
the bare words "Unknown pillar." with no nav and no link; it keeps the chrome and
offers a way back. **M10** a malformed email reported "Invalid credentials",
blaming the password — caught client-side now, with `required`, `maxLength={254}`,
`autoComplete="current-password"` and autofocus alongside (N12-N14).
**M11** `maxLength` truncated in silence; `CharsLeft` appears in the last ~15% and
turns danger-coloured at the limit, modelled on the Pillar 4 sentence hint.

**N15 and the open redirect it could have been.** Signing in now returns you to
where you were headed — but only ever an in-app path. A full URL there would make
the login form an open redirect; ten cases tested, every external form rejected.

**Also:** raw ISO dates on the meeting card and report period are formatted (N5);
the report success message clears when the form changes, so it cannot describe a
config you are no longer looking at (N6); disabled navigator arrows look disabled
(N8); "Remove" says how it differs from "Delete" (N10 — and the first wording I
wrote was wrong: `removeItem` discards, only `fileItem` keeps a record); the
Team gold header uses the deeper token to clear 4.41:1 in light (N16); a clipped
task row can be read on hover (N18); the AM plan-check toggle is named, exposes
`aria-pressed` and is a 24px target (N3); the reset link is 24px (N4); and the
shared inputs fall back to their placeholder for an accessible name, instead of
announcing their own value or nothing (N1, N2).

Not changed: **M12** per-goal `work`/`dod` is deliberate — flattening it to the
top level previously destroyed per-goal data for phone users. **M1** global system
numbering matches CLAUDE.md, where system numbers are identity and appear in
emailed reports. **N20** Notes already reports saving/error correctly; what the
audit saw was C1 on the pillar screens.

`check-a11y-web.ts` is now 78 checks; 589 across the suite. Each new guard was
verified to fail when its bug is reintroduced — one of them caught a stale
comment mentioning the old 760px value and had to be taught to ignore comments.

## 2026-09-12 - QA audit: both Critical findings, and the validation cluster

From the 12 Sep external QA audit (34 defects). Both Critical fixed, plus the
input-typing and whitespace findings.

**C1 - a failed save was silently discarded.** Every save path ended in
`.catch(() => {})`: a failed write showed nothing, never retried, and the screen
kept displaying text the server had never received. Worse, the draft was written
to the NORMAL cache key before the request - which the load path overwrites from
the server, so the edit was destroyed on the next reload either way. Routine
against a backend that sleeps and answers 503 while waking.

Now: an unsaved draft goes to its own `zaff:v3:pending:*` key, written before the
request and cleared only on success, and it OUTRANKS the server on the next load
- so reloading mid-failure restores the edit instead of losing it. Failures
retry with backoff (1s/3s/8s/20s), retry immediately when the tab comes back
online, and surface a `role="alert"` banner with a "Try now" button. The banner
is silent while idle on purpose: a permanent "Saved" badge trains people to
ignore the place the real warning appears.

**C2 - "Delete your account?" opened with the destructive button focused.**
Pressing Enter is the reflex the instant a dialog appears, and this one is
irreversible with no history to restore from. Destructive dialogs now focus
Cancel (fixing N9 across every confirm in the app), and account deletion needs
the word DELETE typed - typing cannot happen by reflex.

**Input typing and validation.** The money field was `inputMode="text"`, raising
the alphabetic keyboard on a phone for a number and storing `abc-!@#$` verbatim;
it is now `inputMode="decimal"`, digits-and-one-point only, and labelled. Meeting
Time uses a native time input, falling back to text for a legacy free-text value
so it is neither blanked nor wiped. Every date field is bounded to 1900-2100 - a
native date input accepts years to 275760, and a deadline had been stored as
`62028-06-01`. Strings are trimmed on save, which also fixes the whitespace-only
field that lost its placeholder and rendered as a blank broken box. "To who?" is
now "To whom?".

New `check-save-failure.ts` (21 checks) and 12 more in `check-a11y-web.ts`; each
verified to fail when its bug is reintroduced. 566 checks green.

Still open from the audit: M1 global system numbering (may be intended - system
numbers are identity and appear in emailed reports), M2 Pillar 5 drill-down has
no URL, M6 Team table 26px overflow, M8 silent Add refusals, M9 unknown-pillar
dead end, M10 login email format, M11 silent truncation, M12 per-goal vs per-day
scoping, and the N-series accessible-name gaps.

## 2026-09-11 - Two contrast regressions from the last round, and the focus gap

**The red confirm button was 2.75:1 in dark** — the consistency fix traded a
colour problem for a contrast one. `--danger` flips between themes (`#c8102e`
light, `#ff6b7a` dark) but the label was a hardcoded `text-white`, so on the
lightened red it was unreadable — on every delete dialog, Delete account
included. Added `--on-danger`, paired with `--danger` the way `--on-gold` is
paired with `--gold`: **5.68:1 dark, 5.88:1 light**. Third instance of this bug
class after `--on-accent` and `--on-selected`; a fixture now pins all of them.

**"Building your PDF…" was unreadable while it worked.** Not a static colour
bug: the gold fill EASES out under `transition-colors` while the text colour
swaps instantly, so for the whole transition the muted label sat on a
gold-over-navy blend — ~1.6:1 at its worst. The busy state now paints a solid
`bg-surface` with `transition-none`, so there is no blend to be caught in:
**6.18:1 dark, 5.58:1 light**.

**Dismissing a dialog by clicking the scrim lost keyboard focus.** `close()` did
restore it, but the scrim fires on *mousedown* and the browser then moves focus
itself as the click completes, undoing the restore — so only Escape appeared to
work. Deferred a frame with `requestAnimationFrame`.

**Also:** the Pillar 5 business/department/system row × gained the `title` the
effort/result rows already had; and the do-or-die tick circles keep their 22px
ring but are padded to a 24px button (WCAG 2.2) and carry the task's own words
as an accessible name instead of announcing only "pressed".

`check-a11y-web.ts` is now 42 checks. One of its new guards was itself wrong —
it matched the sibling button and passed with the bug fully reintroduced — and
now counts both busy branches and names the offending one.

## 2026-09-11 - Reachability, Team accuracy, destructive actions

**The nav was unreachable on a phone.** Six links plus the wordmark need ~580px;
below that they overlapped the logo and ran off the right edge, and the page
does not scroll horizontally — so Team, About and Profile could not be reached
at all. They now collapse into a menu button under `sm`, which closes on route
change and on Escape, and marks the current page with `aria-current`.

**The Team table was showing the wrong numbers, two ways.** `per_pillar` is
keyed by the BACKEND id, but the table looked up the DISPLAYED number — so
Pillar 5 (stored as `pillar-8-business-systems`, reported as 8) asked for a key
that is never sent and showed a grey 0% for every member regardless of their
work. Backend progress also averaged over `range(1, 9)`, dividing a 5-pillar sum
by 8: a member with 3 of 5 done read 38% instead of 60%, visibly disagreeing
with the table's own five columns. `LIVE_PILLAR_IDS` and a derived
`backendPillarId` fix both; the blob whitelist is untouched, so history and old
clients still work. A 0% chip no longer paints `on-accent` on the hairline
(1.63:1 dark / 1.42:1 light) but reads as muted text in an outline (7.20 / 5.58).

**Destructive actions now look and behave destructive.** Pillar 4's "Delete"
threw an item away on one click while "Remove" beside it asked — the more
destructive of the two was the unguarded one. Every confirm whose wording
deletes, removes, withdraws or declines is now styled `danger`; flow steps
("Start a new day", "File this problem") deliberately stay gold.

**Also:** the dialog scrim now dismisses (it was painted on top of the wrapper
whose `target === currentTarget` test therefore never held); the Pillar 4 due
date no longer overflows the card and viewport on a phone (`min-w-0` on both
columns and on the date input, which carries a UA intrinsic width `w-full` does
not override, plus stacking under `sm`); all four navigator arrows have an
accessible name and a tooltip; every 13px row × is a 24px target with a label;
and a long PDF build announces itself via `aria-busy` and a live region.

New fixture `check-a11y-web.ts` (32 checks) covers all of the above; each guard
was verified to fail when its bug is reintroduced.

## 2026-09-11 - Pillar 5 sections 7/8 data loss, PDF export, placeholder token

**Sections 7 and 8 destroyed what you typed.** Both were bound to `efforts` /
`results` — the deprecated flat mirrors. `fixSystem` rebuilds those *from*
`pairs` on load, so an answer saved correctly, was discarded on the next load,
and was written back blank by the following save. Because the blob is shared,
an answer typed on the phone was erased by opening the same system on the web
and touching any field. Both sections now render one `pairs` array through a
`mutatePairs` helper that re-syncs the mirrors, matching the mobile app: adding
an effort adds a blank result, deleting either side removes the whole pair, and
`pair.id` — which daily answers are keyed by — stays stable. Deleting now says
the matching question goes too. New fixture `check-effort-pairs-web.ts`
reproduces the original loss and fails if the binding regresses.

**PDF export was broken and reported success anyway.** `vfs_fonts` only
self-registers when a global `pdfMake` exists — true for a `<script>` tag,
false for a bundled ES import — so the browser got no fonts and `createPdf`
threw "Roboto-Medium.ttf not found". `download()` is async, so the failure
became an uncaught rejection *after* the page had already said "Your PDF has
been downloaded." Fonts are now wired explicitly via `addVirtualFileSystem`,
registration is asserted before the caller is promised a file, and every
download is awaited. Verified in a browser: valid `%PDF`, embedded
Roboto-Medium and Roboto-Regular streams, zero console errors.

**`--placeholder` was doing two incompatible jobs.** It is tuned for fields,
which are white paper in both themes; it was also used for empty-state and hint
text on cards and the page, which do go dark. Darkening it to fix the fields
pushed that text to 2.30:1. Hint text now uses `--muted` (2.30 → 7.20:1 dark,
5.58:1 light) and `--placeholder` is pinned to `::placeholder` only, where it
clears 4.5:1 on all three field surfaces. A fixture catches both spellings —
the `text-placeholder` class and an inline `var(--placeholder)`; the second had
escaped a sweep that only looked for the first.

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
