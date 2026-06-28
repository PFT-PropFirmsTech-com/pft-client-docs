---
phase: 02-public-leaderboard
plan: 04
subsystem: public-leaderboard
tags: [leaderboard, filters, sorting, frontend, LB-04]
requires: ["02-02"]
provides:
  - "Public leaderboard filter UI (account size + challenge type)"
  - "Public leaderboard sort UI (% growth / win rate / profit factor + order toggle)"
  - "Backend public endpoint now accepts filters[challengeType] (funded-narrowing only)"
affects:
  - "pft-dashboard public /leaderboard surface"
  - "pft-backend GET /leaderboard/public param whitelist"
tech-stack:
  added: []
  patterns:
    - "Presentational filter component + container-owned state feeding the query hook (single source of truth)"
    - "Radix Select sentinel value (__all__) for the 'All' option (empty-string values disallowed)"
    - "Funded-only enforced server-side AFTER spreading caller filters — caller filters can only narrow"
key-files:
  created:
    - "pft-dashboard/src/components/public-leaderboard/PublicLeaderboardFilters.tsx"
  modified:
    - "pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx"
    - "pft-dashboard/src/hooks/usePublicLeaderboard.ts"
    - "pft-dashboard/src/types/leaderboard.types.ts"
    - "pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts"
decisions:
  - "LB-04 challengeType filter IS supported: resolved the 02-01 contradiction by un-stripping challengeType in the controller (option a) rather than dropping the UI filter — safe because the service forces programStage='funded' after the filter spread"
  - "Challenge-type dropdown options come from data.filters.availableChallengeTypes (Program.distinct), but actual filtering stays funded-only via the forced programStage"
  - "'All' option uses a __all__ sentinel mapped to undefined — Radix Select rejects empty-string item values"
metrics:
  duration: ~10 min
  completed: 2026-06-29
---

# Phase 2 Plan 04: Filters and Sorting Summary

Added account-size + challenge-type filters and a sort control (% growth / win rate / profit factor with an asc/desc toggle) to the public `/leaderboard` page, wiring them through the existing `usePublicLeaderboard` hook; un-stripped `challengeType` on the public endpoint so the filter works without weakening the funded-only/PII guarantees.

## What Was Built

**Task 1 — Hook + endpoint param wiring (commits 74172f4b dashboard, 7e0acf28 backend)**
- `usePublicLeaderboard` now accepts `challengeType` and appends `filters[challengeType]` to the request, alongside the pre-existing `filters[accountSize]`, `sortBy`, `sortOrder`. `queryKey` includes `challengeType` so caching stays correct.
- `PublicLeaderboardQuery` type gained `challengeType?: string`.
- Backend `getPublicLeaderboard` controller now forwards `filters[challengeType]` (it was previously stripped). Verified safe: `LeaderboardService.getPublicLeaderboard` spreads `query.filters` and THEN sets `programStage: "funded"`, so `challengeType` can only narrow within the funded set — it can never widen to phase1/phase2 accounts.

**Task 2 — Filter/sort UI (commit 9f1cf5a0)**
- New `PublicLeaderboardFilters.tsx` (`"use client"`): presentational, receives `{ availableAccountSizes, availableChallengeTypes, value, onChange }`.
  - Account Size select (options from `data.filters.availableAccountSizes` + "All sizes").
  - Challenge Type select (options from `data.filters.availableChallengeTypes` + "All types", humanized labels e.g. `twoStep` → `Two Step`).
  - Sort By select (`valueGrowth` "% Growth", `winRate` "Win Rate", `profitFactor` "Profit Factor") + an asc/desc order toggle button.
- `PublicLeaderboardContainer.tsx`: lifted filter/sort state into the reserved slot, feeds it into `usePublicLeaderboard`, renders `<PublicLeaderboardFilters>` above the table, and resets `page` to 1 on any filter/sort change. Loading/empty/error handling from 02-02 preserved.

## Deviations from Plan

### LB-04 vs backend-capability contradiction — RESOLVED

The plan flagged a contradiction: LB-04 wants challenge-type filtering, but 02-01 forced funded-only and the public controller stripped `challengeType`. The plan offered option (a) un-strip in the controller (preferred) or (b) drop the UI filter.

**Chose option (a)** — un-stripped `challengeType` in `getPublicLeaderboard`. This is safe because of the ordering in `LeaderboardService.getPublicLeaderboard`:

```
const publicQuery = { ...query, filters: { ...query.filters, programStage: "funded" } };
```

`programStage: "funded"` is applied AFTER the caller's filters, so it always wins. `challengeType` therefore only sub-filters the funded set; it cannot expose non-funded accounts. The funded-only and masking guarantees are untouched, and the `getPublicLeaderboard` service / `toPublicDTO` masking path was not modified.

No other deviations. No Rule 1–4 auto-fixes were needed.

## Verification (automated, passed)

- Hook forwards `filters[accountSize]`, `filters[challengeType]`, `sortBy`, `sortOrder`; `queryKey` includes the new param.
- Backend controller forwards `challengeType`; service still forces `programStage="funded"`.
- Filters component references `availableAccountSizes`, `availableChallengeTypes`, `valueGrowth`/`winRate`/`profitFactor`.
- Container imports + renders `PublicLeaderboardFilters` and wires `usePublicLeaderboard`.
- `grep -rn "email|/admin/users" src/components/public-leaderboard/` → CLEAN (no PII, no admin routing).
- Scoped `tsc --noEmit` → no errors in hook/types/public-leaderboard files.
- `eslint src/components/public-leaderboard` → clean.

## Human-Verify Checklist (NOT run — app not deployed)

The final plan task is a `checkpoint:human-verify` gate. It was intentionally NOT executed because the app is not deployed (consistent with 02-01/02-02/02-03 SUMMARYs). Run these against a live deploy once available:

1. Visit `/leaderboard` (logged out is fine).
2. Change the **Account Size** filter — confirm the table updates to only that size.
3. Change the **Challenge Type** filter — confirm the list narrows and STILL shows only funded traders (no phase/challenge accounts leak in).
4. Switch **Sort** to Win Rate, then Profit Factor, then % Growth — confirm row order changes accordingly; toggle order (High→Low / Low→High) and confirm reversal.
5. Confirm names are still masked (first name + last initial) and no email appears throughout, under all filter/sort combinations.

Resume signal: type "approved", or describe what filtered/sorted incorrectly (e.g. non-funded accounts appeared, sort had no effect).

## Notes for Future Work

- The challenge-type dropdown options come from `Program.distinct("challengeType")` (all programs, not funded-only). The OPTIONS list may therefore show a type that has zero funded traders → selecting it yields an empty table. Cosmetic only (no leak). If desired later, narrow `availableChallengeTypes` to types actually present among funded accounts.
- Both the backend (`7e0acf28`) and dashboard (`74172f4b`, `9f1cf5a0`) commits are on `main-2026` but NOT deployed, consistent with the rest of Phase 2.

## Self-Check: PASSED
