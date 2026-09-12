# Zaffarology Web App — QA Audit / Defect Report

| | |
|---|---|
| **Target** | https://zaffarology-web.vercel.app/ |
| **Backend** | https://zaffarology-backend.onrender.com |
| **Date** | 12 September 2026 |
| **Account** | zaffar.khan@khanenterprises.com (live production data) |
| **Browser** | Chrome 151, macOS |
| **Viewports tested** | 407 / 768 / 1024 / 1126 px |

---

## 1. Summary

| Severity | Count |
|---|---|
| **Critical** | 2 |
| **Major** | 12 |
| **Minor** | 20 |
| **Total** | **34** |

The app is better built than most at this stage. Dialogs are properly focus-trapped, the effort/result pairing in Pillar 5 is exemplary, colour contrast passes almost everywhere in both themes, and the layout never scrolls sideways at any width I could test. The defects below are concentrated in three places: **what happens when a save fails**, **input validation**, and **accessible naming**.

> ### One defect matters more than all the others combined
>
> When a save request fails, the app discards the edit, shows no error, never retries, and keeps displaying the unsaved text as though it were saved. The user finds out only when they reload. On a free Render instance that sleeps and returns 503s, this will happen routinely. Everything else in this report can wait; **C1 should not**.

---

## 2. Critical

*Data loss, destruction.*

### C1 — A failed save is silently discarded, and the UI keeps showing the lost text

**Where:** All autosaving screens — Pillars 1–5, Notes, Meetings

**What I did**
Made the network fail for one autosave request, then typed `TEST-OFFLINE-EDIT-SHOULD-WARN` into Exact Plan 2 on Pillar 1 and waited.

**What happened**
The `PUT /v3/pillars/pillar-1` failed. The page showed no banner, no toast, no inline error, no changed save indicator — I scanned the entire rendered text for any word resembling "error", "failed", "offline", "saving" or "retry" and found none. The textarea kept displaying my text. After restoring the network I waited 12 seconds: **no retry request was ever made**. The server still held the old value, and after reload the text was gone.

**What should have happened**
A visible "Couldn't save — retrying" state, an automatic retry when the connection returns, and a queued write so the edit survives a reload.

**Steps to reproduce**
1. Open any pillar and let the Render backend go to sleep (or throttle to offline).
2. Type into any field.
3. Wait for the debounced save to fire and fail.
4. Restore the connection, wait, then reload. The edit is gone; nothing ever warned you.

**Evidence — instrumented fetch log**
```
PUT /v3/pillars/pillar-1 -> NETWORK-FAIL
(page text scan for error/fail/offline/sav/retry → no match)
after reconnect + 12s → PUTs issued: 0
server plan value  = "TEST-RAPID-PLAN"                  ← old
textarea displayed = "TEST-OFFLINE-EDIT-SHOULD-WARN"    ← lost
```

*Note:* This also occurred unprompted earlier in the session: a `PUT` returned 503 while the backend was waking, and three consecutive edits (a retyped goal title, a plan, and a deadline) were lost with no indication. Per the brief a one-off 503 on a cold start is expected — the defect is that the app throws the data away without telling anyone.

---

### C2 — "Delete your account?" opens with the destructive button focused and needs no typed confirmation

**Where:** Profile → Delete account

**What I did**
Opened the dialog and inspected it. I did not confirm.

**What happened**
Initial keyboard focus lands on **"Delete account"**, not "Cancel". There is no typed confirmation and no password re-entry. Opening the dialog and pressing Enter or Space — the reflex after any dialog opens — permanently destroys the account and all pillar data, which the dialog itself states "cannot be undone".

**What should have happened**
Focus on Cancel, and a typed confirmation (the word `DELETE` or the account email) before the destructive button enables.

**Evidence**
```
On open:
document.activeElement → BUTTON "Delete account"
dialog contains an input for typed confirmation → false
```

*Note:* The same focus-on-destructive pattern appears on every confirm dialog in the app (see N9). It is only Critical here because this one is irreversible and destroys everything.

---

## 3. Major

*Broken behaviour, failed validation.*

### M1 — The first system in a brand-new business is numbered S20, not S1

**Where:** Pillar 5 → Business → Department → Systems

**What I did** Created `TEST-Business`, opened the seeded department D1, added one system.

**What happened** The badge and breadcrumb both read **S20**. System numbers run from a single global counter across the whole account, while department numbers restart per business (this new business correctly seeded D1–D5). So the two numbering schemes in the same screen follow different rules, and a customer's first system is labelled with a number that means nothing to them.

**What should have happened** Per the brief, S1. Either number systems per department/business, or drop the visible number.

```
Businesses › TEST-Business › AM Planning & PM Achievement ($) › S20
Departments in the same new business: D1 D2 D3 D4 D5  ✓
```

---

### M2 — Pillar 5 drill-down has no URL, so Back exits the pillar entirely and reload loses your place

**Where:** Pillar 5

**What happened** Opening a business, a department or a system never changes the URL — it stays `/pillar/5` and no history entry is pushed. Pressing browser Back from inside a business jumped to `/notes` (the page visited before Pillar 5), skipping every level of the drill-down. Reloading while inside a system returns you to the business list. A system cannot be bookmarked, linked or shared.

**What should have happened** Each level gets its own route, so Back goes up one level and reload restores position.

**Impact** Worst on mobile, where Back/swipe-back is the primary navigation gesture — and this app has a live iPhone counterpart.

---

### M3 — The money field raises a full alphabetic keyboard and stores arbitrary text

**Where:** Pillar 3 → PM Achievement → $ Money Made

**What happened** The field is `type="text"` with `inputmode="text"` explicitly set — so on iOS and Android it raises the full alphabetic keyboard for what is a money amount. It has no `pattern` and no validation. I typed `abc-!@#$ TEST`; it was accepted and persisted to the server verbatim.

**What should have happened** `inputmode="decimal"` and numeric validation.

```
field: type=text  inputmode=text  pattern=null  maxlength=20
server after save → "money":"abc-!@#$ TEST"
```

*Note:* This was the only field in the app that raises the wrong keyboard for its data type. I restored it to empty.

---

### M4 — Meeting "Time" is unvalidated free text

**Where:** Notes → Meeting notes → Time

**What happened** `type="text"`, no `inputmode`, placeholder "e.g. 2:30pm". I entered `not-a-time-99:99xyz`; it saved and redisplayed unchanged.

**What should have happened** `type="time"`, or free text with parsing and a format hint on blur.

---

### M5 — Date fields have no min or max, so absurd years are accepted and stored

**Where:** Pillar 1 Deadline · Pillar 4 due/completion dates · Meeting date · Training/Evaluation dates

**What happened** No date input in the app sets `min` or `max`. A native date input accepts years up to 275760, so extra keystrokes in the year segment silently produce nonsense. A Pillar 1 deadline ended up as **01/06/62028** and was persisted as `"target":"62028-06-01"` with no warning. Pillar 4 also accepted a due date of 01/01/2020 and reported "Finished 2446 days after due date" without ever flagging the date as implausible.

**What should have happened** A sane `min`/`max` on every date field.

*Marked as inference:* I produced the 5-digit year partly through my own mis-clicks into the year segment. The defect is that nothing in the app rejected or flagged the result.

---

### M6 — The Team table is 26px too wide for its container at every screen width

**Where:** Team → Team progress

**What happened** The table needs 760px; its container is capped at 734px regardless of viewport. The "Overall" column — the most important number on the page — is clipped at 1126px, 1024px and 768px, rendering as "Overal". It sits in an `overflow-x:auto` wrapper, so the page itself doesn't scroll (good), but at desktop widths a 26px clip reads as a rendering bug rather than a scrollable region, and there is no scroll affordance.

**What should have happened** Widen the container or narrow the columns so the table fits at ≥768px; keep the scroller for phones and add a visible edge fade.

```
viewport 1024 → table scrollWidth 760, wrapper clientWidth 734, clipped = true
viewport  768 → identical
viewport  407 → table scrolls horizontally; page does not  ✓
```

---

### M7 — Leading and trailing whitespace is never trimmed on save

**Where:** All text fields

**What happened** Typed `"   TEST-TRIM-3   "` into a Pillar 2 solution. The server stored it with the spaces intact. Separately, a field containing only spaces is stored as a whitespace string — and because it is technically non-empty, its placeholder disappears, leaving a field that looks blank and broken but isn't (see N17).

**What should have happened** Trim on save. The app already treats whitespace-only as empty for counting and for enabling the Add buttons, so the rule exists — it just isn't applied to what's written.

```
server → sols[2].text = "   TEST-TRIM-3   "
"2 solutions on the table"  ← whitespace correctly not counted
but the whitespace was still saved
```

---

### M8 — Add buttons refuse silently, with no explanation

**Where:** Pillar 1 "+ Add goal" · Pillar 2 "+ Add possible solution" · Pillar 5 system/department/business ADD

**What happened** Each refuses while the current row is empty. They dim and set `aria-disabled="true"`, but clicking produces no message, no tooltip, no live-region announcement — nothing tells you the rule is "fill this one in first". I clicked "+ Add goal" three times in a row and only the first took effect. Pillar 5's ADD buttons accept an empty name and simply do nothing.

**What should have happened** Say why, the way section 9 already does.

```
Section 9 gets this exactly right:
  "Write the steps first, the flow chart is empty."   ← clear, actionable
Everywhere else:
  (nothing)
```

---

### M9 — An unknown pillar route is a dead end with no way back

**Where:** `/pillar/9`, `/pillar/abc`

**What happened** Both render the words "Unknown pillar." centred on an otherwise empty page. No header, no navigation, no link home. It does not crash, but the user is stranded and must edit the URL or hit Back.

**What should have happened** Keep the app chrome, and offer a link back to the pillar list.

---

### M10 — A malformed email reports "Invalid credentials" instead of a format error

**Where:** Login

**What happened** Entering `notanemail` (no `@`) with any password submits to the server and returns "Invalid credentials" — telling the user their password is wrong when the real problem is the email format. Neither field is `required`, so native validation never fires despite the input being `type="email"`.

**What should have happened** "Enter a valid email address", caught client-side before the request.

**Login messages observed**

| Case | Message | Verdict |
|---|---|---|
| Empty fields | "Enter your email and password." | ✓ clear |
| No `@` in email | "Invalid credentials" | ✗ misleading |
| Wrong password | "Invalid credentials" | ✓ correct (does not reveal whether the account exists) |
| 573-character email | "Invalid credentials" | ✗ no length cap, no format error |

---

### M11 — The 600-character cap truncates silently — no counter, no warning

**Where:** Pillar 1 goal & plan (600) · Pillar 2 problem (300) · Pillar 5 fields (120/200/400)

**What happened** I typed 650 characters into a goal. Exactly 600 were kept; 50 vanished with no counter, no colour change and no message. The user has no way to know their sentence was cut.

**What should have happened** A character counter as the limit nears — which the app already does beautifully in one place.

```
Pillar 4's note field is the model to copy:
  "5 / 3 sentences, too long, cut it down"   ← warns, explains, doesn't block
It is the only field in the app with inline validation feedback.
```

---

### M12 — "Work of the Day" and "Do or Die Tasks" are stored per goal but presented as per day

**Where:** Pillar 1

**What happened** The section is headed "Prioritise your day" and "Only one, the thing that matters most", but the data is scoped to the currently selected goal — the save payload carries a separate `work` and `dod` array inside each goal. Stepping from Goal 1 to Goal 2 silently swaps the whole day's task list, and the "0 / 5 do-or-die done" counter with it.

**What should have happened** Either scope these to the day (as the copy promises), or label them per goal so the swap is expected.

*Flagged as a design/consistency question rather than a code fault — worth a decision, since Pillar 3 presents the same three sections as genuinely daily.*

---

## 4. Minor

*Accessibility, copy, consistency.*

| ID | Where | Defect |
|---|---|---|
| **N1** | Pillars 1–3, all inputs | Inputs have no programmatic label — the accessible name comes from the placeholder, which disappears the moment you type. The visible headings ("EXACT GOAL (PROJECT) 1") are not associated with their field. |
| **N2** | Pillar 1 → Exact Plan | The textarea sits inside a `<label>` that contains no label text, so its accessible name resolves to *its own current value* — and to nothing at all when empty. |
| **N3** | Pillar 3 → AM Plan Check | The ✓/✗ achievement toggle has no `aria-label`, no `title` and no `aria-pressed`. A screen reader announces only "✗ button", with no indication of which task or what it toggles. It is also 20×20px, under the 24px minimum. |
| **N4** | Pillars 1 & 3 | "New day (reset)" is 104×20px — under the 24px tap-target minimum, for an action that clears the day. |
| **N5** | Meeting cards · Reports period | Raw ISO dates leak into the UI: a meeting card shows `2026-09-15` and the report period shows `2026-08-14 to 2026-09-12`, while note cards and pillar headers use "12 Sept 2026" / "Saturday, 12 September 2026". |
| **N6** | Reports | "Your PDF has been downloaded." persists after you switch report type or change the period, so it describes a download that no longer matches the form. |
| **N7** | Notes → Meeting notes | The "1 of 7" position counter shown on the Notes tab is missing on the Meeting notes tab. The counter also disappears entirely when a Personal/Business filter is active. |
| **N8** | Pillar 1 & 4 carousels | The prev/next arrows are genuinely `disabled` at the first and last item, but render identically to enabled ones (opacity 1, same border) — clicking appears to do nothing for no visible reason. |
| **N9** | Every confirm dialog | Initial focus lands on the destructive button (Delete / Remove / Confirm) rather than Cancel. Otherwise these dialogs are excellent — see "What works". |
| **N10** | Pillar 4 | Delete explains itself ("It will not be kept in the filed archive"); Remove says only "Remove this item from the huddle board?" with no body text, so the difference between the two adjacent destructive actions is left for the user to guess. |
| **N11** | Throughout | Length limits are wildly inconsistent: "Delegated To" (a person's name) allows 2000 characters while the task name beside it allows 100; Pillar 1 goals allow 600 but Pillar 2 problems only 300; Work of the Day, all five Do-or-Die rows, extra-mile and delegated rows have no limit at all. |
| **N12** | Login | The password field has an empty `autocomplete` attribute; it should be `current-password` so password managers fill it reliably. |
| **N13** | Login | Nothing is autofocused on load (`activeElement` is `BODY`), and neither field is `required`. |
| **N14** | Login | No `maxlength` on the email field — a 573-character address was accepted and submitted. Layout held, but the request should never leave the browser. |
| **N15** | Auth redirect | Visiting a protected route while signed out correctly redirects to `/login`, but the intended destination isn't preserved, so after signing in you land on Home instead of where you were going. |
| **N16** | Team, light theme | The "1" pillar column header measures **4.41:1** against its header background — just under the 4.5:1 AA threshold. Measured `rgb(143,98,0)` on `rgb(230,233,239)`. This was the only contrast failure found anywhere in either theme. |
| **N17** | All text fields | A field containing only spaces loses its placeholder, so it renders as an empty-looking box with no prompt — it appears broken while actually holding whitespace. |
| **N18** | Task rows | A 200-character unbroken string is clipped mid-character with no ellipsis and no tooltip, so there is no way to tell the text continues or to read it without clicking in. |
| **N19** | Pillar 1 → Delegate tasks | The placeholder reads "To who?" — should be "To whom?". The field is also only ~95px wide, narrow for a full name. |
| **N20** | Notes & Meetings | "Saved automatically" is static text that never changes state. It reads as a save indicator but reports nothing — and during C1 it kept saying "Saved automatically" while the save was failing. |

---

## 5. Field inventory

Every input, textarea, date and select catalogued, read from the live DOM. "IM" is `inputmode`. A dash means the attribute is absent.

| Screen | Field | Type | IM | Max | Label | Defect |
|---|---|---|---|---|---|---|
| Login | Email | email | — | — | wrapping | No cap; 573 chars accepted (N14) |
| Login | Password | password | — | — | wrapping | No `autocomplete` (N12) |
| Pillar 1 | Exact goal | text | — | 600 | **none** | Silent truncation (M11); no label (N1) |
| Pillar 1 | Exact plan | textarea | — | 600 | **empty** | Name = own value (N2) |
| Pillar 1 | Deadline | date | — | — | wrapping | No min/max; year 62028 saved (M5) |
| Pillar 1 | Work of the day | text | — | **none** | **none** | Uncapped (N11) |
| Pillar 1 | Do-or-die 1–5 | text | — | **none** | **none** | Uncapped; per-goal not per-day (M12) |
| Pillar 1 | Extra task | text | — | **none** | **none** | Uncapped |
| Pillar 1 | What did you delegate? | text | — | **none** | **none** | Clips with no ellipsis (N18) |
| Pillar 1 | To who? | text | — | **none** | **none** | Copy error; narrow (N19) |
| Pillar 2 | Exact problem | textarea | — | 300 | **none** | Cap inconsistent with Pillar 1 (N11) |
| Pillar 2 | Possible solution *n* | text | — | **none** | **none** | Whitespace saved untrimmed (M7) |
| Pillar 3 | Work of the day | text | — | **none** | **none** | Uncapped |
| Pillar 3 | Do-or-die 1–5 | text | — | **none** | **none** | Uncapped |
| Pillar 3 | Today's achievement | textarea | — | 600 | **none** | Silent cap |
| Pillar 3 | **$ Money made** | **text** | **text** | 20 | visible | **Alphabetic keyboard; stores any text (M3)** |
| Pillar 4 | Project / task name | text | — | 100 | **none** | Visible label not associated (N1) |
| Pillar 4 | Delegated to | text | — | **2000** | aria-label | 2000 chars for a name (N11) |
| Pillar 4 | Project due date | date | — | — | wrapping | No min/max (M5) |
| Pillar 4 | Completed on | date | — | — | wrapping | No min/max (M5) |
| Pillar 4 | New completion date | date | — | — | visible | No min/max (M5) |
| Pillar 4 | Note (1–3 sentences) | textarea | — | — | visible | **None — best field in the app** |
| Pillar 5 | Reporting frequency | text | — | 120 | visible | None |
| Pillar 5 | Responsible / accountable / guide | text | — | 120 | visible | None |
| Pillar 5 | Job description item | text | — | 200 | visible | None |
| Pillar 5 | Effort / result question *n* | text | — | 200 | visible | None — pairing works correctly |
| Pillar 5 | Step *n* | text | — | 200 | visible | None |
| Pillar 5 | Trainee / trainer name | text | — | **none** | visible | Uncapped (N11) |
| Pillar 5 | Training / evaluation date | date | — | — | visible | No min/max (M5) |
| Pillar 5 | Remarks | textarea | — | 400 | visible | None |
| Notes | Title | text | — | 200 | **none** | None |
| Notes | Body | textarea | — | 20000 | **none** | None |
| Meeting | Title | text | — | 200 | visible | None |
| Meeting | Date | date | — | 10 | visible | Renders as raw ISO on card (N5) |
| Meeting | **Time** | **text** | **—** | 40 | visible | **Any text accepted (M4)** |
| Meeting | Place | text | — | 200 | visible | None |
| Meeting | Attendees | text (chips) | — | 2000 | visible | Uncommitted name kept with leading space |
| Meeting | Agenda / Notes / Next steps | textarea | — | 20000 | visible | None |
| Meeting | Decision *n* | text | — | 2000 | visible | None |
| Team | Invite email | email | email | — | visible | None — correctly typed |
| Reports | Leave out Business Systems | button role=switch | — | — | visible | None — correct switch pattern |

---

## 6. Console log

**No console errors or warnings were captured at any point in the session.** I kept console tracking active across every screen, every theme, every viewport width, the offline simulation, the PDF generation and the failed-login attempts. Every read returned no messages.

```
read_console_messages (pattern ".", all screens, whole session)
→ "No console messages found for this tab."   (every call)
```

**Caveat, so you can weigh this:** console capture begins when the tool first attaches, so a message emitted in the very first milliseconds of a page load could be missed. Network capture on the same channel worked correctly throughout (it recorded 64 requests including the 503s), which gives me reasonable confidence the channel was live — but I would not claim the app is provably warning-free from this alone.

**Network-level errors that did occur, for completeness:**

```
PUT /v3/pillars/pillar-1            → 503   (backend waking — cold start, plus C1)
GET /pillar/1?_rsc=… (Vercel RSC)   → 503   ×3 on prefetch, recovered on navigation
GET /v3/pillars/pillar-2            → 404   (my own probe — wrong key;
                                             real key is pillar-2-problem-solving)
```

---

## 7. What works

- **Autosave, when the network is up.** One debounced `PUT` per edit, correct payload, 200. Typing a note title and body back to back and navigating away immediately still saved both.
- **Dialogs.** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, body scroll locked, focus correctly trapped on Tab cycling, and focus returned to the triggering button on both Escape and outside-click. Textbook — apart from which button gets initial focus.
- **Pillar 5 sections 7 and 8.** Adding an effort question adds a matching blank result; deleting either side warns symmetrically and correctly ("Its matching result question will be removed as well" / "Its matching effort question will be removed as well") and removes both. Data persisted across a full reload.
- **New business seeding.** Exactly five departments, numbered D1–D5, per business.
- **Team arithmetic.** Overall is the exact mean of the five pillar figures for all three members (100→100%, 100/100/100/0/0→60%, 100/0/0/100/100→60%).
- **Reports.** A genuine 17,458-byte `application/pdf` blob is produced. "Copy as text" works, and "Leave out Business Systems" is honoured — Business Systems content disappears from the output.
- **Colour contrast.** Clean in both themes across Home, Notes, Reports, Team and Pillars 1–4, with one marginal exception (N16). Input text is dark-on-white in light theme and light-on-navy in dark theme, as required.
- **Focus visibility.** A consistent 2px amber outline on every control type.
- **Responsive.** No page-level horizontal scrolling at 407, 768, 1024 or 1126px. Below 640px the nav collapses to a menu, and all six destinations remain reachable.
- **Rapid clicking.** Double-clicking "Add extra-mile task" and the business ADD button created one row each, not two.
- **Filters.** Personal/Business filters apply correctly across notes, meetings and recordings together, with a well-written empty state.
- **Auth.** A protected route with no token redirects to `/login` and leaks no data. The session survives reload and a new tab.
- **Back/forward.** Correct across all top-level routes (the exception is Pillar 5, M2).

**Security note, as requested:** the auth token is a JWT in `localStorage` under `zaff_token`, not a cookie — so it is readable by any script on the origin, with no `HttpOnly` protection. It expires in 7 days. No token appeared in any URL or query string. I found no XSS vector: `<script>alert(1)</script>` and `"; DROP TABLE--` were stored and redisplayed as inert text everywhere I entered them.

---

## 8. Untested

| What | Why |
|---|---|
| **Voice recording** | Microphone permission sits at `prompt` and grants require a native Chrome dialog I cannot drive. Clicking "Record a voice note" produced **no visible in-page response** — I can't tell whether that is the app failing to handle a pending permission or simply the native prompt rendering outside the page. **Marked untested, not working.** |
| **Team invite, note sharing, signup, forgot password, the "✉ Email" button in Pillar 5 §9** | All send email. Excluded by your instructions. |
| **Delete account confirmation** | Dialog opened and inspected, then cancelled, per your instructions. Never confirmed. |
| **Pillar 2 "Solved, file & start new problem"** | There is only one problem slot, and it holds the owner's live problem ("hello"). Testing the file-as-solved flow would have meant overwriting existing text and filing real data — both excluded by your rules 3 and 4. |
| **Login with the correct password** | I don't type real account passwords into login forms, so the "leading/trailing spaces on a correct email" case is untested. I ran every failure case with deliberately wrong passwords instead, and restored the session from the token I had backed up before removing it. **This is the one item in your brief I declined on policy rather than practicality.** |
| **375px and 390px viewports** | With the Chrome side panel open the window could not go below a **407px** viewport. I tested at 407px. **Inference:** the app's narrowest breakpoint is Tailwind's `sm` (640px), so 375 and 390 should render identically to 407 — but I did not observe them. |
| **1440px viewport** | The display capped the viewport at ~1126px with the side panel open. Tested to 1126px. |
| **Slow 3G throttling** | No DevTools protocol access to set throttling. I simulated total request failure instead, which is what produced C1. Loading states under a slow-but-working connection remain unobserved. |
| **Two tabs editing the same screen concurrently** | Not run — I ran out of session before reaching it. Given C1 and the last-write-wins `PUT` of the whole pillar object, I'd expect the second tab to silently overwrite the first, but **that is an expectation, not an observation.** |
| **A report date range containing no data** | Reports offers only preset 7/30/90-day periods, not a custom range, and all three contain data. Could not force an empty range. |
| **Triple-clicking every submit button** | Double-click tested on the main Add buttons; triple-click and full coverage of every button not completed. |
| **Pillar 3's "six time-slot rows" and Yes/No controls** | **These do not exist in the web app.** Pillar 3 contains AM Planning (work of the day, five do-or-die rows, extra-mile tasks), PM Achievement (a read-only AM mirror, an achievement textarea and the money field), Previous Days and Filed Tasks. The only Yes/No control is the ✓/✗ achieved toggle in the AM Plan Check. Either the brief is out of date or the feature is iPhone-only. |

*The Chrome extension driving this session became unresponsive twice for several minutes. That is tooling, not the app — I've excluded it from the findings.*

---

## 9. Cleanup and baseline

Every item I created was prefixed `TEST-` and has been deleted. I edited no pre-existing text. Appearance is back to **System**. Baseline re-verified against the server after cleanup:

```
Notes                   7      ✓        Meetings            1  ("Untitled meeting")  ✓
Voice recordings        3      ✓        Businesses          2  ✓
  Khan Enterprises Group — 9 departments ✓
  New                    — 6 departments ✓
Pillar 1   1 goal, "Double revenue this year", plan "Open a second location"  ✓
Pillar 2   problem "hello"; solutions "fdfdfds", "Rework the pricing tiers", ""; 2 filed  ✓
Pillar 3   all fields empty, money ""  ✓
Pillar 4   4 items — Open the second store / Hire a store manager /
                     Sign the lease / Order opening stock  ✓
Pillar 5   4 items intact; no TEST- business remains  ✓
No string "TEST-" found anywhere in the app.
```

**One deliberate deviation:** Pillar 2's third solution row was empty when I found it and is empty again now — but I passed whitespace and text through it during testing (M7, N17), so its history on the server is not pristine even though its value is.

---

*Compiled from direct observation in Chrome against live production data. Findings marked "inference" are reasoned, not observed; everything else was reproduced at least once, and the Critical findings twice.*
