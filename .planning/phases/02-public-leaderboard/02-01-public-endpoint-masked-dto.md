---
phase: 02-public-leaderboard
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - pft-backend/src/app/modules/Leaderboard/leaderboard.interface.ts
  - pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
  - pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts
  - pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts
autonomous: true

must_haves:
  truths:
    - "GET /leaderboard/public returns 200 with NO Auth() (anonymous requests succeed, never 401)"
    - "Response never contains any email field for any trader"
    - "Trader names are masked to firstName + last initial (e.g. 'John D.') for ALL viewers"
    - "Only funded accounts appear (accountType funded / programStage funded); challenge/phase accounts excluded"
    - "Traders with leaderboardOptOut=true are excluded from results"
    - "When a valid Bearer token is attached, richer stat fields are present; when absent, they are omitted"
  artifacts:
    - path: "pft-backend/src/app/modules/Leaderboard/leaderboard.interface.ts"
      provides: "PublicLeaderboardTrader + PublicLeaderboardResponse types (no email)"
      contains: "PublicLeaderboardTrader"
    - path: "pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts"
      provides: "getPublicLeaderboard() + toPublicDTO() masking + funded/opt-out filters"
      contains: "toPublicDTO"
    - path: "pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts"
      provides: "getPublicLeaderboard controller with optional-token decode (no Auth middleware)"
      contains: "getPublicLeaderboard"
    - path: "pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts"
      provides: "public route with no Auth(), low-TTL per-user-scoped cache"
      contains: "/public"
  key_links:
    - from: "leaderboard.routes.ts"
      to: "getPublicLeaderboard controller"
      via: "router.get('/public', cacheResponse(...), getPublicLeaderboard) with NO Auth()"
      pattern: "router\\.get\\(\\s*[\"']/public[\"']"
    - from: "getPublicLeaderboard controller"
      to: "verifyToken util"
      via: "optional decode of req.headers.authorization, branch on validity"
      pattern: "verifyToken"
    - from: "getPublicLeaderboard service"
      to: "toPublicDTO"
      via: "map every trader through toPublicDTO before returning"
      pattern: "toPublicDTO"
---

<objective>
Build the single public leaderboard backend endpoint that powers the entire phase. `GET /leaderboard/public` returns FUNDED traders only, with UNIVERSALLY masked names (firstName + last initial) and NO email — ever. It reuses the existing `getLeaderboard` query/sort/pagination engine, adds funded-only + opt-out query filters, and runs a `toPublicDTO()` masking pass. The controller optionally decodes a Bearer token if present (no `Auth()` middleware, so anonymous never gets 401); a valid token unlocks RICHER STAT fields only — never fuller identity.

Purpose: This endpoint is the security boundary for the whole public surface. If it leaks PII, the phase fails. Everything in waves 2+ consumes it.
Output: New public route, controller, service method, masking DTO, and public response types in pft-backend (nested repo, branch main-2026).
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-public-leaderboard/2-CONTEXT.md

# Backend code lives in the NESTED repo pft-backend on branch main-2026
@pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard.interface.ts
@pft-backend/src/app/middlewares/auth.ts
@pft-backend/src/app/middlewares/cacheResponse.ts
@pft-backend/src/app/utils/tokenGenerateFunction.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add public response types + getPublicLeaderboard service with masking, funded-only, and opt-out filters</name>
  <files>pft-backend/src/app/modules/Leaderboard/leaderboard.interface.ts, pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts</files>
  <action>
  In `leaderboard.interface.ts`, add public-safe types that DO NOT carry email or lastName:

  ```typescript
  export interface PublicLeaderboardTrader {
    rank: number;
    globalRank: number;
    displayName: string;          // "John D." — masked, never full last name
    challengeTypeLabel?: string;  // generic funded label OK; do NOT expose phase/challenge specifics on public surface
    performance: {                // BASE stats always present (anon + logged-in)
      valueGrowthPercentage: number;
      winRate: number;
      profitFactor: number;
    } & Partial<{                 // RICHER stats only when logged-in
      accountSize: string;        // from program.accountSize / initialBalance
      profitPercentage: number;
      totalProfit: number;
      tradingDays: number;
    }>;
    tradingDays?: number;         // richer-only mirror, optional
    status: "ACTIVE" | "TARGET_REACHED" | "VIOLATED" | "BANNED";
  }

  export interface PublicLeaderboardResponse {
    traders: PublicLeaderboardTrader[];
    totalCount: number;
    filters: {
      availableAccountSizes: string[];
      // challengeTypes intentionally limited/omitted on public surface (funded only)
      availableChallengeTypes: string[];
    };
    lastUpdated: string;
  }
  ```
  Do NOT include `email`, `firstName`, `lastName`, or `LeaderboardUser` in these types. The masked `displayName` is the ONLY name field.

  In `leaderboard.service.ts`, add a private static `toPublicDTO(trader: LeaderboardTrader, includeRicherStats: boolean): PublicLeaderboardTrader`:
  - `displayName` = `${user.firstName} ${(user.lastName || "").charAt(0).toUpperCase()}.` — trim if lastName empty (e.g. "John ." -> "John"). NEVER output full lastName or email.
  - Always include base performance: `valueGrowthPercentage`, `winRate`, `profitFactor` (read from `trader.performance`).
  - When `includeRicherStats === true`, additionally include `accountSize` (derive from `trader.program.programId.accountSize` or `initialBalance`), `profitPercentage`, `totalProfit`, `tradingDays`.
  - Copy `rank`, `globalRank`, `status`.

  Add static `getPublicLeaderboard(query: LeaderboardQuery, includeRicherStats: boolean): Promise<PublicLeaderboardResponse>`:
  - REUSE the existing `getLeaderboard` engine rather than reimplementing aggregation. Two acceptable approaches — pick the cleaner one:
    (A) Pre-compute exclusion sets, then call `this.getLeaderboard(mergedQuery)` and map results through `toPublicDTO`, OR
    (B) Refactor `getLeaderboard` to accept an optional `extraMatch` param and pass funded + opt-out conditions.
  - FUNDED-ONLY: force `filters.programStage = "funded"` so only funded programs match (mirrors the existing `pQuery.programStage` path at service line ~67). Do NOT let callers override this to a non-funded stage on the public endpoint.
  - OPT-OUT (query time, per CONTEXT lock): `const optedOut = await User.distinct("_id", { leaderboardOptOut: true });` then exclude with `matchConditions.userId = { $nin: optedOut }` (intersect correctly if a `userId` condition already exists from search). Use the same `User` import already present in the file (see search block at line ~83).
  - Then map every resulting `LeaderboardTrader` through `this.toPublicDTO(trader, includeRicherStats)`.
  - Return `PublicLeaderboardResponse` (NO email, NO full names anywhere).

  Guard rail: after building the response, the email field must be unreachable — types enforce this, but do not spread the raw `user` object into the output.
  </action>
  <verify>
  Scoped typecheck (full repo tsc OOMs — do NOT run full build):
  `cd pft-backend && npx tsc --noEmit src/app/modules/Leaderboard/leaderboard.service.ts src/app/modules/Leaderboard/leaderboard.interface.ts --skipLibCheck 2>&1 | head -30` (ignore cross-module import errors from skipLibCheck; confirm no errors inside these two files).
  `cd pft-backend && grep -n "toPublicDTO\|getPublicLeaderboard\|leaderboardOptOut\|programStage = \"funded\"\|programStage: \"funded\"" src/app/modules/Leaderboard/leaderboard.service.ts` shows masking + funded + opt-out present.
  `cd pft-backend && grep -c "email" src/app/modules/Leaderboard/leaderboard.interface.ts` — confirm the new Public* types do NOT add email (existing LeaderboardUser email stays, but Public types must not reference it).
  </verify>
  <done>
  PublicLeaderboardTrader / PublicLeaderboardResponse types exist with no email/lastName. getPublicLeaderboard + toPublicDTO implemented, applying funded-only filter, opt-out $nin filter, masked displayName, and richer-stats-on-flag. No email reachable in output.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add controller with optional-token decode and register public route (no Auth, low-TTL per-user cache)</name>
  <files>pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts, pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts</files>
  <action>
  In `leaderboard.controller.ts`, add `getPublicLeaderboard` (catchAsync, same query-parsing shape as the existing `getLeaderboard` controller — support flat and `filters[...]` nested params for accountSize, sortBy, sortOrder, page, limit). DO NOT accept/forward `programStage`, `challengeType`, `status`, or `search` overrides that could break the funded-only/PII guarantees; the service forces funded. accountSize filtering + sorting by valueGrowth/winRate/profitFactor ARE allowed (these feed 02-04).

  Optional-token branch (the core mechanism — implement explicitly, do NOT use Auth() middleware):
  ```typescript
  import { verifyToken } from "../../utils/tokenGenerateFunction";
  import config from "../../../config";
  // ...
  let includeRicherStats = false;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const parts = authHeader.trim().split(/\s+/);
      const raw = parts.length > 1 ? parts[1] : parts[0];
      const decoded = verifyToken(raw, config.jwt_access_secret as string);
      if (decoded && decoded.email) includeRicherStats = true;
    } catch {
      includeRicherStats = false; // invalid/expired token => treat as anonymous, DO NOT throw
    }
  }
  const data = await LeaderboardService.getPublicLeaderboard(query, includeRicherStats);
  res.status(200).json({ success: true, message: "Public leaderboard retrieved successfully", data });
  ```
  Critical: a missing OR invalid token must NEVER throw — anonymous always gets 200 with masked/base data.

  In `leaderboard.routes.ts`:
  - Import `getPublicLeaderboard`.
  - Add NEAR THE TOP of the router (before any potential param routes; there are none today but keep it explicit): `router.get("/public", cacheResponse(15, { scope: "user" }), getPublicLeaderboard);` — NO `Auth()`.
  - Rationale for `scope: "user"` + TTL 15: cacheResponse keys by scope. With global scope, anon and logged-in would share a cache entry and leak richer stats to anon (or hide them from logged-in). `scope: "user"` keys per authenticated user id (and "anon" for no token), so masked-anon and richer-logged-in never cross-contaminate. TTL 15s satisfies the CONTEXT "hide near-immediately on opt-out" constraint (≤15s). Note: cacheResponse reads `req.user` for the user-scope key, but this route has no Auth middleware so `req.user` is undefined → all keys fall to "anon". That means logged-in responses would also cache under "anon" and could be served to a true anon. To prevent cross-contamination, set `keyExtra: (req) => req.headers.authorization ? "auth" : "anon"` so token-present vs token-absent get DISTINCT cache buckets. Use: `cacheResponse(15, { scope: "user", keyExtra: (req) => (req.headers.authorization ? "auth" : "anon") })`.
  - Keep the existing admin-gated `/` route untouched.
  </action>
  <verify>
  `cd pft-backend && grep -n "router.get(\"/public\"\|getPublicLeaderboard\|keyExtra" src/app/modules/Leaderboard/leaderboard.routes.ts` — public route present, no Auth on that line.
  `cd pft-backend && grep -n "verifyToken\|includeRicherStats\|getPublicLeaderboard" src/app/modules/Leaderboard/leaderboard.controller.ts` — optional decode + controller present.
  Confirm NO `Auth(` token on the `/public` route line: `cd pft-backend && grep -n "/public" src/app/modules/Leaderboard/leaderboard.routes.ts` then visually confirm absence of Auth().
  Scoped tsc: `cd pft-backend && npx tsc --noEmit src/app/modules/Leaderboard/leaderboard.controller.ts --skipLibCheck 2>&1 | head -20`.
  </verify>
  <done>
  GET /leaderboard/public is registered with no Auth(), uses a 15s auth-bucketed cache, and the controller decodes any Bearer token optionally — valid token => includeRicherStats=true, missing/invalid token => 200 masked base data (never 401/500).
  </done>
</task>

</tasks>

<verification>
- `grep -rn "email" pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` in the getPublicLeaderboard/toPublicDTO region returns no output that writes email into the public response.
- Public types in leaderboard.interface.ts contain no email/lastName fields.
- Public route has no Auth() middleware; controller never throws on missing token.
- funded-only (programStage funded) and opt-out ($nin distinct optOut) filters present in service.
</verification>

<success_criteria>
- GET /leaderboard/public responds 200 for anonymous callers (no 401).
- Response contains masked displayName (first name + last initial), never email, never full last name.
- Only funded traders appear; opted-out traders are excluded.
- A valid Bearer token adds richer stat fields (accountSize, % growth, trading days, profit factor) without changing the name masking.
</success_criteria>

<output>
After completion, create `.planning/phases/02-public-leaderboard/02-01-SUMMARY.md`.
Commit backend changes in the NESTED pft-backend repo on branch main-2026 (not the parent repo). Include the Co-Authored-By trailer.
</output>
