---
phase: 02-public-leaderboard
plan: 02
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - pft-dashboard/src/middleware.ts
  - pft-dashboard/src/lib/api/config.ts
  - pft-dashboard/src/types/leaderboard.ts
  - pft-dashboard/src/hooks/usePublicLeaderboard.ts
  - pft-dashboard/src/app/leaderboard/page.tsx
  - pft-dashboard/src/app/leaderboard/layout.tsx
  - pft-dashboard/src/components/public-leaderboard/PublicLeaderboardTable.tsx
  - pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx
autonomous: false

must_haves:
  truths:
    - "Anonymous visitor can open /leaderboard without being redirected to login"
    - "Public page renders a ranked table of funded traders showing masked names (first name + last initial)"
    - "No email or full last name is ever rendered in the public table"
    - "When logged in, richer stats (account size, % growth, trading days, profit factor) render in the same table"
    - "Page consumes GET /leaderboard/public via apiClient (token auto-attached when present)"
  artifacts:
    - path: "pft-dashboard/src/app/leaderboard/page.tsx"
      provides: "public leaderboard page outside (dashboard) auth layout"
      min_lines: 5
    - path: "pft-dashboard/src/components/public-leaderboard/PublicLeaderboardTable.tsx"
      provides: "slim presentational table (no email, no /admin links)"
      contains: "displayName"
    - path: "pft-dashboard/src/hooks/usePublicLeaderboard.ts"
      provides: "react-query hook hitting /leaderboard/public"
      contains: "/leaderboard/public"
    - path: "pft-dashboard/src/middleware.ts"
      provides: "/leaderboard added to isPublicPath allowlist"
      contains: "/leaderboard"
  key_links:
    - from: "src/app/leaderboard/page.tsx"
      to: "PublicLeaderboardContainer"
      via: "render container which uses usePublicLeaderboard"
      pattern: "PublicLeaderboardContainer"
    - from: "usePublicLeaderboard"
      to: "/leaderboard/public"
      via: "apiClient.get with auto-attached Bearer token"
      pattern: "leaderboard/public"
    - from: "src/middleware.ts isPublicPath"
      to: "/leaderboard route"
      via: "path.startsWith('/leaderboard') OR-clause"
      pattern: "startsWith\\(\"/leaderboard\"\\)"
---

<objective>
Build the public-facing leaderboard page and its dedicated slim components in pft-dashboard. The page lives at `src/app/leaderboard/` (OUTSIDE the `(dashboard)` auth-enforcing group) and is whitelisted in middleware so anonymous visitors reach it. It renders a ranked funded-trader table with masked names and never shows email. Because `apiClient` auto-attaches the Bearer token, the SAME page and SAME endpoint render richer stats automatically when a logged-in trader views it — no frontend auth branching.

Purpose: Satisfies LB-01 (anon masked view) and LB-02 (logged-in richer stats) with one page. The admin `LeaderboardTable` is NOT reusable (renders trader.user.email and pushes to /admin/users) — build dedicated components.
Output: Public page, layout, container, slim table, react-query hook, public endpoint config, public types, and middleware allowlist entry. All in pft-dashboard (separate repo).
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-public-leaderboard/2-CONTEXT.md
@.planning/phases/02-public-leaderboard/02-01-SUMMARY.md

# Frontend repo pft-dashboard (separate repo)
@pft-dashboard/src/middleware.ts
@pft-dashboard/src/lib/api/config.ts
@pft-dashboard/src/lib/api/client.ts
@pft-dashboard/src/hooks/useLeaderboard.ts
@pft-dashboard/src/app/changelog/page.tsx
@pft-dashboard/src/components/ui/switch.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire public route — middleware allowlist, endpoint config, public types, and react-query hook</name>
  <files>pft-dashboard/src/middleware.ts, pft-dashboard/src/lib/api/config.ts, pft-dashboard/src/types/leaderboard.ts, pft-dashboard/src/hooks/usePublicLeaderboard.ts</files>
  <action>
  1. `src/middleware.ts` (~line 435): add `const isLeaderboardPath = path.startsWith("/leaderboard");` next to the other predicate consts, and add `isLeaderboardPath ||` to the `isPublicPath` OR-chain. This lets anonymous users reach /leaderboard without redirect. Do NOT add /leaderboard to `protectedPaths`.

  2. `src/lib/api/config.ts` (leaderboard block ~line 128): add `public: "/leaderboard/public",` to the `leaderboard` object so endpoints are centralized.

  3. `src/types/leaderboard.ts`: add public types mirroring the backend 02-01 response (see 02-01-SUMMARY for exact shape). Define `PublicLeaderboardTrader` (rank, globalRank, displayName, status, performance.{valueGrowthPercentage,winRate,profitFactor} always + optional accountSize, profitPercentage, totalProfit, tradingDays) and `PublicLeaderboardResponse` (traders, totalCount, filters.{availableAccountSizes, availableChallengeTypes}, lastUpdated). NO email/lastName fields. If `src/types/leaderboard.ts` does not exist, add these to the existing `src/types/index.ts` leaderboard section instead and update the import path used below.

  4. `src/hooks/usePublicLeaderboard.ts`: new react-query hook modeled on `useLeaderboard.ts` but hitting `ENDPOINTS.leaderboard.public`. Accept a query arg `{ page?, limit?, sortBy?, sortOrder?, accountSize? }` (only the public-allowed params — do NOT send programStage/challengeType/search). Build URLSearchParams (use `filters[accountSize]` nested form to match backend parsing), call `apiClient.get`, unwrap `response.data.data`, return typed `PublicLeaderboardResponse`. Set a SHORT staleTime (≤15s, e.g. 10_000) so opt-out changes reflect quickly, matching the backend cache TTL. queryKey must include all params.
  </action>
  <verify>
  `cd pft-dashboard && grep -n "isLeaderboardPath\|startsWith(\"/leaderboard\")" src/middleware.ts` — predicate added to isPublicPath chain.
  `cd pft-dashboard && grep -n "public:" src/lib/api/config.ts | head` and confirm `/leaderboard/public` present.
  `cd pft-dashboard && grep -n "leaderboard/public\|PublicLeaderboardResponse" src/hooks/usePublicLeaderboard.ts`.
  Scoped typecheck: `cd pft-dashboard && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "usePublicLeaderboard\|leaderboard.ts\|middleware" | head` (project tsc is fine for dashboard; only backend full tsc OOMs).
  </verify>
  <done>
  /leaderboard is a public path in middleware, endpoint + public types + hook exist, hook fetches /leaderboard/public and returns typed masked data with short stale time.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build dedicated public page, layout, container, and slim table</name>
  <files>pft-dashboard/src/app/leaderboard/page.tsx, pft-dashboard/src/app/leaderboard/layout.tsx, pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx, pft-dashboard/src/components/public-leaderboard/PublicLeaderboardTable.tsx</files>
  <action>
  Build a SLIM, dedicated public surface. Do NOT reuse admin `LeaderboardTable`/`LeaderboardContainer` (they render `trader.user.email` and push to `/admin/users` — confirmed in research). Per CONTEXT lock: ranked table ONLY — NO stats banner, NO weekly prize widget.

  1. `src/app/leaderboard/layout.tsx`: minimal layout exporting `metadata` (title e.g. "Leaderboard", description). Render `{children}`. Mirror the admin leaderboard layout.tsx structure for metadata but no auth gating.

  2. `src/app/leaderboard/page.tsx`: `"use client"` not required at page level — render `<PublicLeaderboardContainer />`. Keep it a thin server/client wrapper.

  3. `src/components/public-leaderboard/PublicLeaderboardContainer.tsx` (`"use client"`): call `usePublicLeaderboard()`. Manage pagination state (page/limit). Handle loading (spinner) and empty states. Render `<PublicLeaderboardTable traders={data.traders} />` plus simple pagination controls. Leave a clearly-marked slot/prop for filters+sort to be added in 02-04 (e.g. accept `filters`/`onFilterChange` props on the table or container, but DO NOT build the filter UI here — that is 02-04). Detect logged-in state for display purposes ONLY via the presence of richer fields in the returned data (e.g. `traders[0]?.performance?.accountSize !== undefined`) OR via existing `useAuth().useCurrentUser()` — used solely to decide which COLUMNS to show, never to fetch differently.

  4. `src/components/public-leaderboard/PublicLeaderboardTable.tsx` (`"use client"`): presentational table. Columns ALWAYS: Rank, Trader (render `trader.displayName` ONLY — never email, never full last name), % Growth (`performance.valueGrowthPercentage`), Win Rate (`performance.winRate`), Profit Factor (`performance.profitFactor`). Columns CONDITIONAL on richer stats being present (logged-in): Account Size (`performance.accountSize`), Trading Days (`performance.tradingDays`). NO link to /admin/users; NO "view report" handler that routes to admin. Use existing UI primitives (Card, table styling) consistent with the app. Apply adaptive-contrast/theme classes if the surrounding app uses them, but keep dependencies minimal.

  Render guard: there must be NO reference to `.email`, `.user.email`, or full `lastName` anywhere in these components.
  </action>
  <verify>
  `cd pft-dashboard && grep -rn "displayName" src/components/public-leaderboard/PublicLeaderboardTable.tsx` — masked name rendered.
  `cd pft-dashboard && grep -rn "email\|/admin/users\|user.lastName" src/components/public-leaderboard/ src/app/leaderboard/` — MUST return nothing (no PII, no admin routing).
  `cd pft-dashboard && grep -rn "PublicLeaderboardContainer" src/app/leaderboard/page.tsx`.
  `cd pft-dashboard && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "public-leaderboard\|app/leaderboard" | head`.
  `cd pft-dashboard && npx next build 2>&1 | tail -20` is heavy — prefer `npx eslint src/components/public-leaderboard src/app/leaderboard 2>&1 | head` for a quick gate; full build optional.
  </verify>
  <done>
  /leaderboard renders a ranked funded-trader table with masked names and base stats for anon; richer columns appear when logged-in. No email/admin-link anywhere. Filter/sort slot exists but UI deferred to 02-04.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Public leaderboard page at /leaderboard consuming GET /leaderboard/public — masked names, funded-only, richer stats when logged in. Middleware whitelisted so anon can reach it.</what-built>
  <how-to-verify>
  1. Run the dashboard dev server (or use the staging deploy if backend 02-01 is deployed to main-2026).
  2. In a LOGGED-OUT browser (or incognito), visit /leaderboard. Confirm: page loads (no redirect to /auth), table shows funded traders with names like "John D." (first name + last initial), and you see % Growth / Win Rate / Profit Factor. Confirm NO email anywhere and NO account-size/trading-days columns.
  3. Log in as a trader, visit /leaderboard again. Confirm the SAME page now ALSO shows Account Size and Trading Days columns (richer stats), while names are STILL masked to first name + last initial (identity never fuller).
  4. Open DevTools Network → /leaderboard/public response: confirm the JSON contains NO "email" field and NO full "lastName" for any trader.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what rendered incorrectly (e.g. email visible, anon got redirected, richer stats missing when logged in).</resume-signal>
</task>

</tasks>

<verification>
- /leaderboard reachable while logged out (middleware allowlist).
- Public table renders displayName only; grep finds no email/lastName/admin link in public components.
- Logged-in view adds richer columns via the same endpoint (token auto-attached).
</verification>

<success_criteria>
- Anonymous visitor opens /leaderboard and sees top funded traders with first name + last initial only.
- Logged-in trader sees account size, % growth, trading days, profit factor in the same view.
- No PII (email, full last name) is rendered or present in the network payload.
</success_criteria>

<output>
After completion, create `.planning/phases/02-public-leaderboard/02-02-SUMMARY.md`.
Commit frontend changes in the pft-dashboard repo (separate from the parent and from pft-backend). Include the Co-Authored-By trailer.
</output>
