# Zaffarology Web App

A **Next.js 16 + Tailwind v4** web version of the Zaffarology 8-Pillars app. It talks to the
**same FastAPI backend** the mobile app uses (`NEXT_PUBLIC_API_URL`), shares the **same accounts**,
and reads/writes the **same per-pillar data blobs** (`/v3/pillars/{key}`) — so a user's pillars are
identical whether they open the phone app or the website.

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run typecheck
```
`.env.local` → `NEXT_PUBLIC_API_URL=https://zaffarology-backend.onrender.com` (same as mobile).

## Architecture (mirrors mobile 1:1)
- **Theme** — `src/app/globals.css`: the paper palette + one accent per pillar + empty-input green,
  matched to `zaffarology-mobileapp/src/constants/theme.ts`. Fonts: Inter + Archivo Black.
- **API** — `src/lib/api.ts`: fetch client, JWT in `localStorage`, `Authorization: Bearer`.
- **Auth** — `src/lib/auth-context.tsx`: login / 3-path signup / verify / session restore / delete.
- **Pillar data** — `src/lib/use-pillar-state.ts`: loads `/v3/pillars/{key}`, debounced save, deep-clone
  `update(draft => …)`, localStorage cache — **the exact same blob shapes as mobile** (data is shared).
- **Shell** — `src/components/shell.tsx` (top nav + auth guard), `pillar-scaffold.tsx` (pinned brand
  bar + pillar chips + title), `ui.tsx` + `task.tsx` (buttons, inputs, task rows, checkbox, date field,
  reporting).

## Status — complete (builds clean)
Scaffold, theme, API + auth + pillar-state layer, all shared components, **welcome / login / signup /
verify-email / forgot-password**, **home grid, About, Team, Profile**, and **all 8 pillars** fully
ported from mobile, each using the **same blob key + exact state shape** so data is shared:
- **P1** `pillar-1` — goal, plan, do-or-die board, extra-mile, delegated, new-day reset, reporting, filed.
- **P2** `pillar-2-problem-solving` — problem + numbered solutions, winner, solved archive.
- **P3** `pillar-3-am-pm` — AM plan (work/do-or-die/extra), PM achievement + money, new-day reset, reporting.
- **P4** `pillar-4-huddle` — huddle board (owner/due/status/notes), overdue/early, reporting, filed.
- **P5** `dept-of-loyalty` / **P6** `pillar-6-dept-of-ai` — idea-of-day + numbered ideas + extra + implemented archive (shared `idea-pillar.tsx`).
- **P7** `pillar-7-records` — A–Z filing, search, add-record, letter index, share/copy.
- **P8** `pillar-8-business-systems` — businesses → departments → systems tree, 12-section detail, training/eval/review records, flow chart, `normalizeP8` healing.

Verified: `npm run build` ✓ and `npx tsc --noEmit` ✓ across all pillars.

## Notes
- **No subscription paywall on web** — Apple/Google IAP is mobile-only; a web paywall would use Stripe
  (via RevenueCat Web Billing) feeding the same `pro` entitlement. Out of scope for this pass.
- Backend CORS is `*`, so the browser can call it directly.
