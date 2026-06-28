---
phase: 02-public-leaderboard
plan: 04
type: execute
wave: 3
depends_on: ["02-02"]
files_modified:
  - pft-dashboard/src/components/public-leaderboard/PublicLeaderboardFilters.tsx
  - pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx
  - pft-dashboard/src/hooks/usePublicLeaderboard.ts

must_haves:
  truths:
    - "Public page has a control to filter by account size"
    - "Public page has a control to filter by challenge type (within funded surface)"
    - "Public page has controls to sort by % growth, win rate, and profit factor"
    - "Changing a filter or sort re-queries /leaderboard/public and updates the table"
    - "Available account sizes are populated from the endpoint's filters.availableAccountSizes"
  artifacts:
    - path: "pft-dashboard/src/components/public-leaderboard/PublicLeaderboardFilters.tsx"
      provides: "account-size + challenge-type filter selects and sort control"
      contains: "availableAccountSizes"
  key_links:
    - from: "PublicLeaderboardFilters"
      to: "usePublicLeaderboard query"
      via: "onFilterChange/onSortChange updates container state → hook params"
      pattern: "onSortChange|onFilterChange|sortBy"
    - from: "usePublicLeaderboard"
      to: "/leaderboard/public query params"
      via: "filters[accountSize], sortBy, sortOrder appended to request"
      pattern: "sortBy"
---

<objective>
Add filtering and sorting controls to the public leaderboard page. The backend `getLeaderboard` engine (reused by 02-01's `getPublicLeaderboard`) already supports `filters[accountSize]`, `filters[challengeType]`, and `sortBy` (valueGrowth/winRate/profitFactor) + `sortOrder` — so this is primarily a frontend control layer that feeds params into the existing `usePublicLeaderboard` hook. Per the CONTEXT lock, the public surface is funded-only; challenge-type filtering operates within that funded set and must not expose phase/challenge accounts.

Purpose: Satisfies LB-04. Depends on 02-02 (the page + container + hook must exist first).
Output: Filters/sort component plus container + hook wiring. pft-dashboard repo.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-public-leaderboard/2-CONTEXT.md
@.planning/phases/02-public-leaderboard/02-02-SUMMARY.md

# Frontend repo pft-dashboard
@pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx
@pft-dashboard/src/hooks/usePublicLeaderboard.ts
@pft-dashboard/src/components/ui/switch.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend hook to accept challengeType + sort params</name>
  <files>pft-dashboard/src/hooks/usePublicLeaderboard.ts</files>
  <action>
  Extend the `usePublicLeaderboard` query arg (from 02-02) to accept: `accountSize?: string`, `challengeType?: string`, `sortBy?: "valueGrowth" | "winRate" | "profitFactor"`, `sortOrder?: "asc" | "desc"`. Append to the request:
  - `filters[accountSize]` when set
  - `filters[challengeType]` when set
  - `sortBy` and `sortOrder` (default `valueGrowth` / `desc`)
  Confirm backend `getPublicLeaderboard` forwards these (02-01 allowed accountSize + sort; verify it also forwards challengeType WITHOUT dropping the funded-only guarantee — the service forces `programStage=funded` regardless, so challengeType only narrows within funded). If 02-01's controller stripped challengeType, EITHER (a) un-strip challengeType in the controller while keeping the forced funded stage, OR (b) drop the challenge-type filter from the UI and note it. Prefer (a). Update queryKey to include the new params so caching is correct.
  </action>
  <verify>
  `cd pft-dashboard && grep -n "challengeType\|sortBy\|filters\[accountSize\]" src/hooks/usePublicLeaderboard.ts`.
  If un-stripping challengeType in backend: `cd pft-backend && grep -n "challengeType\|programStage" src/app/modules/Leaderboard/leaderboard.controller.ts` and confirm funded stage still forced in the service.
  `cd pft-dashboard && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "usePublicLeaderboard" | head`.
  </verify>
  <done>
  Hook accepts and forwards accountSize, challengeType, sortBy, sortOrder; queryKey includes them; funded-only guarantee preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build filter/sort UI and wire into container</name>
  <files>pft-dashboard/src/components/public-leaderboard/PublicLeaderboardFilters.tsx, pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx</files>
  <action>
  1. `PublicLeaderboardFilters.tsx` (`"use client"`): presentational controls receiving `{ availableAccountSizes, availableChallengeTypes, value, onChange }` where `value` = `{ accountSize, challengeType, sortBy, sortOrder }`.
     - Account size: select populated from `availableAccountSizes` (from `data.filters.availableAccountSizes`), plus an "All" option.
     - Challenge type: select populated from `availableChallengeTypes`, plus "All". (Funded-only surface — these are the challenge types present among funded accounts.)
     - Sort: a select or button group offering "% Growth" (valueGrowth), "Win Rate" (winRate), "Profit Factor" (profitFactor), plus an asc/desc toggle (reuse the styling of the rest of the page; a small button works).
     Use existing UI primitives (Select/Button from `@/components/ui/...`). Keep it slim and consistent with PublicLeaderboardTable.
  2. `PublicLeaderboardContainer.tsx`: lift filter/sort state (the slot reserved in 02-02). Hold `{ accountSize, challengeType, sortBy, sortOrder }` in state, pass to `usePublicLeaderboard`, and render `<PublicLeaderboardFilters availableAccountSizes={data?.filters.availableAccountSizes ?? []} availableChallengeTypes={data?.filters.availableChallengeTypes ?? []} value={filterState} onChange={setFilterState} />` above the table. Reset page to 1 when filters/sort change. Keep the loading/empty handling from 02-02.
  </action>
  <verify>
  `cd pft-dashboard && grep -n "availableAccountSizes\|availableChallengeTypes\|sortBy\|valueGrowth\|winRate\|profitFactor" src/components/public-leaderboard/PublicLeaderboardFilters.tsx`.
  `cd pft-dashboard && grep -n "PublicLeaderboardFilters\|usePublicLeaderboard" src/components/public-leaderboard/PublicLeaderboardContainer.tsx`.
  `cd pft-dashboard && grep -rn "email\|/admin/users" src/components/public-leaderboard/` — still nothing.
  `cd pft-dashboard && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "public-leaderboard" | head`.
  `cd pft-dashboard && npx eslint src/components/public-leaderboard 2>&1 | head`.
  </verify>
  <done>
  Public page shows account-size + challenge-type filters and sort-by (% growth / win rate / profit factor) with order toggle; changing any control re-queries and updates the table; funded-only preserved.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Filter + sort controls on the public leaderboard, wired to /leaderboard/public.</what-built>
  <how-to-verify>
  1. Visit /leaderboard (logged out is fine).
  2. Change the Account Size filter — confirm the table updates to only that size.
  3. Change the Challenge Type filter — confirm the list narrows and STILL shows only funded traders (no phase/challenge accounts leak in).
  4. Switch Sort to Win Rate, then Profit Factor, then % Growth — confirm row order changes accordingly; toggle asc/desc and confirm reversal.
  5. Confirm names are still masked (first name + last initial) and no email appears throughout.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what filtered/sorted incorrectly (e.g. non-funded accounts appeared, sort had no effect).</resume-signal>
</task>

</tasks>

<verification>
- Filter controls populated from endpoint filter options; sort controls offer valueGrowth/winRate/profitFactor + order.
- Changing controls re-queries /leaderboard/public and updates the table.
- Funded-only + masking guarantees still hold under all filter/sort combinations.
</verification>

<success_criteria>
- Public leaderboard supports filtering by account size and challenge type, and sorting by % growth, win rate, and profit factor.
- All results remain funded-only with masked names and no PII.
</success_criteria>

<output>
After completion, create `.planning/phases/02-public-leaderboard/02-04-SUMMARY.md`.
Commit frontend changes in pft-dashboard (and any backend challengeType un-strip in the nested pft-backend repo on main-2026, if done). Include the Co-Authored-By trailer.
</output>
