---
phase: 02-public-leaderboard
plan: 01
subsystem: leaderboard
tags: [public-api, pii-masking, leaderboard, caching, auth-optional]
requires:
  - "leaderboardOptOut field on User schema (01-02)"
  - "floatingPL deterministic fallback (01-01)"
provides:
  - "GET /leaderboard/public endpoint (no Auth, anon-safe)"
  - "PublicLeaderboardTrader/PublicLeaderboardResponse types (no PII)"
  - "LeaderboardService.getPublicLeaderboard() + toPublicDTO() masking"
  - "auth-bucketed low-TTL response cache for public leaderboard"
affects:
  - "Waves 2+ public leaderboard UI consumes this endpoint"
tech-stack:
  added: []
  patterns:
    - "Optional-token decode (no Auth middleware) — missing/invalid token => anonymous 200, never 401"
    - "PII boundary DTO — explicit object build, no spread of raw user, masked displayName only"
    - "Cache key auth/anon bucketing via keyExtra to prevent richer-stat leak to anon"
    - "Reuse-and-layer: getPublicLeaderboard wraps getLeaderboard with forced funded + opt-out $nin"
key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Leaderboard/leaderboard.interface.ts
    - pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
    - pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts
    - pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts
decisions:
  - "Name masking is UNIVERSAL (anon + logged-in both get 'John D.'); token unlocks only richer STAT fields, never identity"
  - "Cache split into auth/anon buckets via keyExtra because route has no Auth middleware (req.user undefined) — scope:user alone would collapse all to anon and leak richer stats"
  - "Opt-out applied at query time via User.distinct + userId $nin, merged field-wise with search $in via new extraMatch param on getLeaderboard"
  - "funded-only forced in service (programStage='funded'), not caller-overridable; controller whitelists only accountSize/sort/pagination params"
metrics:
  duration: ~2.5 min
  completed: 2026-06-29
  tasks: 2
  commits: 2
---

# Phase 2 Plan 01: Public Endpoint + Masked DTO Summary

Public funded-trader leaderboard endpoint (`GET /leaderboard/public`) with universal name masking, no-PII response types, funded-only + opt-out filtering, optional-token richer stats, and an auth-bucketed low-TTL cache.

## What Was Built

The single public-facing security boundary for the entire Phase 2 surface. It reuses the existing `getLeaderboard` query/sort/pagination engine and layers the public guarantees on top:

- **PII-safe types** (`PublicLeaderboardTrader`, `PublicLeaderboardResponse`) carrying no `email`, no `firstName`/`lastName`, no `LeaderboardUser`. The masked `displayName` ("John D.") is the only name field.
- **`toPublicDTO()`** masking serializer: builds the output object explicitly (never spreads the raw `user`), produces `displayName` as first name + last initial (collapses to bare first name when no last name), always emits base stats (`valueGrowthPercentage`, `winRate`, `profitFactor`), and only when `includeRicherStats` is true adds `accountSize`, `profitPercentage`, `totalProfit`, `tradingDays`.
- **`getPublicLeaderboard()`** service method: forces `programStage="funded"` (not caller-overridable), excludes opted-out users via `User.distinct("_id", { leaderboardOptOut: true })` → `userId $nin`, maps every trader through `toPublicDTO`.
- **`getLeaderboard` extension**: new optional `extraMatch` param merged field-wise into match conditions so a search-driven `userId $in` and the opt-out `userId $nin` coexist instead of clobbering each other.
- **Controller** `getPublicLeaderboard`: no `Auth()` middleware; decodes any Bearer token in try/catch (`verifyToken` + `config.jwt_access_secret`); a valid token with `email` claim sets `includeRicherStats=true`; missing/invalid token falls through to anonymous 200 (never 401/500). Whitelists only `accountSize`, sort, and pagination params — no `programStage`/`challengeType`/`status`/`search` overrides.
- **Route** `GET /leaderboard/public`: registered above the admin `/` route, no `Auth()`, `cacheResponse(15, { scope: "user", keyExtra: req => req.headers.authorization ? "auth" : "anon" })`.

## Key Decisions

- **Universal masking, token-gated stats only.** Both anonymous and logged-in viewers see masked `displayName`. A valid Bearer token unlocks richer STAT fields (account size, % growth, trading days, profit factor) and never fuller identity.
- **Auth/anon cache bucketing is the non-obvious correctness detail.** The route has no Auth middleware, so `req.user` is undefined and `scope:"user"` alone would key every response under `"anon"` — meaning a richer logged-in response could be cached and served to a true anonymous caller. `keyExtra` splits the cache into `"auth"` vs `"anon"` buckets keyed on Authorization-header presence, preventing cross-contamination. TTL 15s satisfies the "hide near-immediately on opt-out" constraint.
- **Reuse-and-layer over reimplement.** `getPublicLeaderboard` wraps `getLeaderboard` rather than duplicating aggregation, adding funded-only + opt-out via the new `extraMatch` param and a forced filter.

## Deviations from Plan

None — plan executed exactly as written. Both acceptable opt-out approaches were offered; chose the `extraMatch` refactor (approach B) for the opt-out `$nin` so it intersects correctly with any search-driven `userId $in`, and the forced-filter approach (approach A) for funded-only.

## Verification

- Scoped tsc on edited files: no errors inside the four Leaderboard files (full-repo tsc skipped — known OOM).
- Public types contain no `email`/`lastName`; only references to "email" in the module are security comments and the pre-existing admin `LeaderboardUser.email`.
- `/public` route line has no `Auth()`; funded-only (`programStage: "funded"`) and opt-out (`leaderboardOptOut` / `$nin`) filters present in service.
- Controller decodes optional token and never throws on missing/invalid token.

## For Next Phase

- Endpoint is the consumed contract for Waves 2+ (public UI, filters, sorting). Sorting by `valueGrowth`/`winRate`/`profitFactor` and `accountSize` filtering are wired and feed 02-04.
- Backend changes are committed on `pft-backend` `main-2026` but **not deployed**. The leaderboard service relies on `leaderboardOptOut` at runtime — the 01-02 schema and this code must both ship from `main-2026` before the endpoint is live.

## Commits (pft-backend, main-2026)

- `9399ecc9` feat(02-01): add public leaderboard types + masked service
- `586949ca` feat(02-01): add public leaderboard controller + route

## Self-Check: PASSED

All 4 modified files present, SUMMARY present, both commits (`9399ecc9`, `586949ca`) verified in pft-backend `main-2026`.
