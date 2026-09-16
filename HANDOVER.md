# Handover: web app (billing + RevenueCat checkout)

**For:** Hammad
**Date:** 16 September 2026
**Branch:** `staging` (= `hotfix/billing-safety` + `feature/revenuecat`)

The full picture, the backend details and the remaining RevenueCat setup are in the backend repo: `docs/HANDOVER.md` and `docs/REVENUECAT.md`. This file covers the web app only.

---

## What changed here

### 1. Hotfix (release with the backend hotfix, before the summit)

- **Billing status now loads at sign-in.** `signIn`, all three sign-ups and `verifyEmail` read `/billing/status` *before* publishing the user, because `AuthGuard` decides on both together. Previously it was only read on a full page load, so after logging in the paywall gate and the Profile card did nothing until a reload. Unverified users are skipped (the endpoint would return 403); `verifyEmail` reads it once they are verified.
- **The Profile subscription card hides while the backend reports `enforced: false`.** While the paywall is switched off everyone is in for free, and a card saying "Ended" next to a checkout that is not live would only alarm people.

### 2. RevenueCat (after the summit)

- **`/pricing` sells for real,** using `@revenuecat/purchases-js` (pinned to `1.62.1`), always identified as `users.id` — the same ID the phone apps use, which is what makes one subscription work everywhere.
  - Plans, prices and trial wording come from the RevenueCat offering. Nothing is hard-coded.
  - Checkout is RevenueCat Billing's own sheet; card details go to Stripe, never to us.
  - After paying, the page calls `POST /billing/refresh` and polls for up to 45 seconds until the **backend** confirms access, then goes to Home. It never trusts the SDK's own answer, because the backend's answer is what every platform reads. If it takes longer, a "Payment received — activating" state with a "Check again" button.
  - Cancelling checkout simply shows the plans again. Declined cards, pending bank confirmation, lost connection and "already purchased" each get their own message.
  - Someone already subscribed through the App Store or Google Play is told where their subscription lives instead of being sold a second one.
  - Sandbox and Test Store keys show a "Test mode — no real charges" badge.
  - The SDK is loaded only on this page (dynamic import) and switched to the current user before every purchase, so a browser shared by two accounts cannot buy for the wrong one.
- **Profile's subscription card** covers every state: which store, renewing, cancelled (access until a date), payment problem, free trial, free access, and paid plus free access on top. Store-managed subscriptions link to that store.
- **Paywall:** "I've already subscribed" now asks the backend to re-read RevenueCat, so a purchase made in the phone app unlocks the web at once. If nothing is found, the page says which account it checked.
- **Bug fixed:** billing dates never appeared on Profile or the paywall. `friendlyISO` parses `YYYY-MM-DD`, but the billing API sends full timestamps. New helper: `friendlyTimestamp`.

### Files

| File | What |
|---|---|
| `src/lib/purchases.ts` | new — SDK wrapper, package formatting, purchase-error classification |
| `src/app/pricing/page.tsx` | rewritten — real checkout |
| `src/app/profile/page.tsx` | subscription card |
| `src/app/paywall/page.tsx` | re-check through the backend |
| `src/lib/auth-context.tsx` | billing on sign-in, `syncBilling()` |
| `src/lib/api.ts` | billing types, store names |
| `src/lib/dates.ts` | `friendlyTimestamp` |

---

## What is left here

1. **Nothing, until RevenueCat keys exist.** The checkout path has never run against real RevenueCat — that is the one untested piece (see backend `docs/HANDOVER.md` section 4.3).
2. When the keys are in the backend environment, `GET /billing/config` starts returning `enabled: true` and the pricing page works with no web change.
3. **Deploy order: backend first**, then the web app. An older backend sends no `enforced` field, so the card stays hidden, but it would still paywall users who have no billing row.
4. No new environment variables are needed here. The public key comes from the backend through `/billing/config`.

## How it was tested

Real browser (Playwright, Edge) against the backend with a stateful fake RevenueCat: 33 checks covering trial, lapsed trial, purchase on a phone unlocking the web, grace period, cancellation, expiry, the "already subscribed elsewhere" pricing state, and the pricing page's error handling when RevenueCat cannot be reached. No page errors in any state.
