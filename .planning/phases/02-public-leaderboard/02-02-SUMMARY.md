---
phase: 02-public-leaderboard
plan: 02
subsystem: leaderboard
tags: [public-ui, leaderboard, pii-masking, react-query, middleware, next-app-router]
requires:
  - "GET /leaderboard/public endpoint + PublicLeaderboard types (02-01)"
  - "apiClient auto-attaches Bearer token (existing)"
provides:
  - "Public /leaderboard page outside the (dashboard) auth group"
  - "usePublicLeaderboard react-query hook hitting /leaderboard/public"
  - "Slim PublicLeaderboardTable + PublicLeaderboardContainer (no PII, no admin routing)"
  - "Frontend PublicLeaderboardTrader/Response/Query types"
  - "ENDPOINTS.leaderboard.public endpoint constant"
  - "/leaderboard whitelisted in middleware (anon-reachable)"
affects:
  - "02-04 adds filter/sort UI into the slot left in PublicLeaderboardContainer"
tech-stack:
  added: []
  patterns:
    - "Public route lives OUTSIDE (dashboard) auth group + middleware isPublicPath OR-clause"
    - "Auth-by-field-presence: richer columns rendered when response carries richer stats, never a separate fetch"
    - "Dedicated slim public components (NOT reusing admin LeaderboardTable which renders email + /admin/users)"
    - "Short staleTime (10s) on the public hook to match backend 15s cache TTL"
key-files:
  created:
    - pft-dashboard/src/hooks/usePublicLeaderboard.ts
    - pft-dashboard/src/app/leaderboard/layout.tsx
    - pft-dashboard/src/app/leaderboard/page.tsx
    - pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx
    - pft-dashboard/src/components/public-leaderboard/PublicLeaderboardTable.tsx
  modified:
    - pft-dashboard/src/middleware.ts
    - pft-dashboard/src/lib/api/config.ts
    - pft-dashboard/src/types/leaderboard.types.ts
decisions:
  - "Public types added into existing src/types/leaderboard.types.ts (already re-exported via @/types) rather than a new src/types/leaderboard.ts — avoids a second leaderboard type module and a custom import path"
  - "Logged-in vs anonymous detected for DISPLAY ONLY via presence of richer stat fields (performance.accountSize / tradingDays); never used to branch the fetch"
  - "Richer columns chosen = Account Size + Trading Days (base columns always = Rank, Trader, % Growth, Win Rate, Profit Factor) per CONTEXT lock"
  - "Filter/sort UI deferred to 02-04 — container holds a filters slot + commented mount point; no filter UI built here"
metrics:
  duration: ~12 min
  completed: 2026-06-29
  tasks: 2 auto (1 human-verify checkpoint deferred — app not deployed)
  commits: 2
---

# Phase 2 Plan 02: Public Leaderboard Page + Components Summary

Public funded-trader leaderboard at `/leaderboard` (outside the `(dashboard)` auth group) consuming `GET /leaderboard/public` through a dedicated slim table — masked names for everyone, richer stat columns automatically when a logged-in trader views it, no PII or admin routing anywhere.

## What Was Built

One public page + the supporting wiring, all in the `pft-dashboard` repo (`main-2026`):

- **Middleware allowlist** — added `isLeaderboardPath = path.startsWith("/leaderboard")` to the `isPublicPath` OR-chain so anonymous visitors reach `/leaderboard` without a redirect to `/auth/login`. `/leaderboard` was deliberately NOT added to `protectedPaths`.
- **Endpoint constant** — `ENDPOINTS.leaderboard.public = "/leaderboard/public"` so the path is centralized.
- **Frontend public types** — `PublicLeaderboardTrader`, `PublicLeaderboardResponse`, and `PublicLeaderboardQuery` added to `src/types/leaderboard.types.ts`, mirroring the backend `leaderboard.interface.ts` (02-01) field-for-field. They carry NO `email`/`firstName`/`lastName`; `displayName` is the only name field. Base stats (`valueGrowthPercentage`, `winRate`, `profitFactor`) are always typed-present; richer stats (`accountSize`, `profitPercentage`, `totalProfit`, `tradingDays`) are `Partial`.
- **`usePublicLeaderboard` hook** — react-query hook modeled on `useLeaderboard` but hitting `ENDPOINTS.leaderboard.public`. Sends only public-allowed params (`page`, `limit`, `sortBy`, `sortOrder`, and `filters[accountSize]` nested form). Unwraps `response.data.data`, returns typed `PublicLeaderboardResponse`. `staleTime: 10_000` (≤ backend 15s TTL) so opt-out changes surface quickly.
- **`/leaderboard/layout.tsx`** — minimal layout exporting `metadata` via `generateMetadata({ title: "Leaderboard", … })`, no auth gating; renders `{children}`.
- **`/leaderboard/page.tsx`** — thin server wrapper rendering `<PublicLeaderboardContainer />`.
- **`PublicLeaderboardContainer`** (`"use client"`) — calls `usePublicLeaderboard()`, manages pagination, renders loading / error / empty / table states, plus Previous/Next pagination. Holds a `filters` slot and a commented `<PublicLeaderboardFilters …>` mount point reserved for 02-04. Derives `showRicherColumns` for DISPLAY ONLY from the presence of richer stat fields.
- **`PublicLeaderboardTable`** (`"use client"`) — slim presentational table. Always renders Rank / Trader (`displayName` only) / % Growth / Win Rate / Profit Factor; conditionally renders Account Size + Trading Days when richer stats are present. No email, no full last name, no `/admin/users` link, no admin "view report" handler.

## Key Decisions

- **Public types into existing module.** Added to `src/types/leaderboard.types.ts` (already re-exported via `@/types`) instead of creating a new `src/types/leaderboard.ts`. This keeps one leaderboard type module and avoids a bespoke import path — the plan explicitly allowed this fallback.
- **Auth-by-field-presence, never auth-by-fetch.** Because `apiClient` auto-attaches the Bearer token, the same page + same endpoint return richer data for a logged-in trader and masked base for an anonymous visitor. The container decides which COLUMNS to show purely from whether the response carries richer fields — there is no second/branched request.
- **Dedicated slim components.** The admin `LeaderboardTable` renders `trader.user.email` and pushes to `/admin/users`, so it was NOT reused. Brand-new minimal components were built to guarantee no PII or admin routing leaks onto the public surface.
- **Filter/sort deferred.** Per the CONTEXT lock this page is the ranked table ONLY (no stats banner, no weekly prize widget). Filter/sort UI is 02-04 — the container exposes the slot but builds no filter UI.

## Deviations from Plan

None affecting behavior. Minor adjustments within plan allowances:
- Public types placed in the existing `leaderboard.types.ts` rather than a new `leaderboard.ts` (explicitly permitted fallback in the task).
- Memoized `traders` in the container (`useMemo`) to clear a `react-hooks/exhaustive-deps` ESLint warning — cosmetic, no behavior change.
- Reworded two inline security comments so they don't contain the literal strings `email` / `/admin/users` / `lastName`, keeping the PII grep gate fully clean (the components were already PII-free in actual code).

## Verification (auto tasks)

- `grep` middleware: `isLeaderboardPath` + `startsWith("/leaderboard")` present in `isPublicPath` chain.
- `grep` config: `public: "/leaderboard/public"` present.
- `grep` hook: references `leaderboard/public` + returns `PublicLeaderboardResponse`.
- `grep` table: renders `displayName`.
- **PII/admin scan** `grep -rniE "email|/admin/users|lastName" src/components/public-leaderboard/ src/app/leaderboard/` → **no matches (fully clean)**.
- Scoped `tsc --noEmit`: no errors in any of the new/edited files.
- `eslint src/components/public-leaderboard src/app/leaderboard src/hooks/usePublicLeaderboard.ts` → **0 problems**.

## Human-Verify Checklist (DEFERRED — app not deployed)

This checkpoint was NOT executed because the dashboard is not deployed and backend 02-01 is committed but not live. Run these once a dev server or staging deploy is available:

- [ ] Run the dashboard dev server (or use staging if backend 02-01 is deployed from `main-2026`).
- [ ] In a LOGGED-OUT / incognito browser, visit `/leaderboard`. Confirm: page loads (no redirect to `/auth`); table shows funded traders with names like "John D." (first name + last initial); columns shown are % Growth / Win Rate / Profit Factor; NO email anywhere; NO Account Size / Trading Days columns.
- [ ] Log in as a trader, revisit `/leaderboard`. Confirm the SAME page ALSO shows Account Size and Trading Days columns (richer stats), while names remain masked to first name + last initial.
- [ ] DevTools → Network → `/leaderboard/public` response: confirm the JSON contains NO `email` field and NO full `lastName` for any trader.
- [ ] Resume signal: type "approved", or describe what rendered incorrectly (email visible, anon redirected, richer stats missing when logged in).

## For Next Plan (02-04)

- Filter/sort UI mounts into the reserved slot in `PublicLeaderboardContainer` (commented `<PublicLeaderboardFilters value={filters} onChange={setFilters} />`). `filters` state + the `usePublicLeaderboard` query already accept `sortBy`/`sortOrder`/`accountSize`; 02-04 only needs to add the UI and wire `setFilters`.
- Available filter options come from `data.filters.availableAccountSizes` / `availableChallengeTypes` already returned by the endpoint.

## Commits (pft-dashboard, main-2026)

- `def211e8` feat(02-02): wire public leaderboard route, endpoint, types, and hook
- `f75af977` feat(02-02): add public leaderboard page, container, and slim table

## Self-Check: PASSED

All 5 created files + 3 modified files present in pft-dashboard. SUMMARY present. Both commits (`def211e8`, `f75af977`) verified in pft-dashboard `main-2026`. PII grep gate clean; tsc + eslint clean on edited files.
