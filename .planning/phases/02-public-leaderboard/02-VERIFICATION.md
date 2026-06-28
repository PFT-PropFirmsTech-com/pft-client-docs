---
phase: 02-public-leaderboard
verified: 2026-06-29T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (code); 3 live-UI checkpoints deferred
re_verification:
  none: true
human_verification:
  - test: "Anonymous /leaderboard render (02-02 checkpoint)"
    expected: "Logged-out visitor reaches /leaderboard (no redirect), sees funded traders as 'John D.', base stats only, NO email, NO account-size/trading-days columns"
    why_human: "App not deployed; requires running dashboard + visual/network inspection"
  - test: "Logged-in richer stats render (02-02 checkpoint)"
    expected: "Same page adds Account Size + Trading Days columns when logged in; names still masked"
    why_human: "Requires live auth session and visual confirmation"
  - test: "Opt-out disappearance within ~15s (02-03 checkpoint)"
    expected: "Toggle ON in Settings persists; trader gone from public list within cache TTL; toggle OFF restores"
    why_human: "Requires live end-to-end timing across Settings + public endpoint cache"
  - test: "Filter/sort behavior (02-04 checkpoint)"
    expected: "Account-size + challenge-type filters narrow results (funded-only preserved); sort by %growth/winRate/profitFactor reorders; asc/desc reverses"
    why_human: "Requires live interaction with running data set"
---

# Phase 2: Public Leaderboard Verification Report

**Phase Goal:** Any visitor can view a public leaderboard with masked trader identities; logged-in traders see full stats and can opt out.
**Verified:** 2026-06-29
**Status:** human_needed (all CODE verified; live-UI checkpoints deferred per instructions — app not deployed)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Anonymous visitor sees top FUNDED traders, masked names, no email/account details | ✓ VERIFIED (code) | routes.ts: `/public` route has NO `Auth()`, `keyExtra` buckets auth/anon; interface Public types carry no email/lastName; service `toPublicDTO` masks `firstName + last initial` universally; `getPublicLeaderboard` forces `programStage:"funded"` |
| 2 | Logged-in trader sees account size, % growth, trading days, profit factor | ✓ VERIFIED (code) | controller optional-token branch sets `includeRicherStats` only on valid token w/ email; service gates accountSize/profitPercentage/totalProfit/tradingDays behind flag; table renders accountSize/tradingDays columns conditionally |
| 3 | Trader toggles "Hide me from leaderboard", disappears near-immediately | ✓ VERIFIED (code) | SettingsContainer Switch wired to `updateUser.mutateAsync({ leaderboardOptOut })` → PATCH `/users/:id`; service excludes opted-out via `User.distinct("_id",{leaderboardOptOut:true})` + `$nin`; cache TTL = 15s |
| 4 | Filtering (account size, challenge type) + sorting (% growth, win rate, profit factor) | ✓ VERIFIED (code) | PublicLeaderboardFilters has account-size + challenge-type selects + sort keys valueGrowth/winRate/profitFactor + asc/desc; hook forwards `filters[accountSize]`, `filters[challengeType]`, `sortBy`, `sortOrder`; service forces funded AFTER spread so challengeType only narrows within funded (no widening) |

**Score:** 4/4 truths verified at the code level.

### Security Verification (CRITICAL)

| Check | Status | Evidence |
| ----- | ------ | -------- |
| No email leaks through public endpoint | ✓ PASS | `toPublicDTO` and `getPublicLeaderboard` bodies contain NO `email`; explicit DTO build (no raw `user` spread); Public types carry no email/lastName |
| Masking universal (anon AND logged-in) | ✓ PASS | `displayName` computed unconditionally; `includeRicherStats` only unlocks STAT fields, never identity |
| Cache buckets auth vs anon | ✓ PASS | `cacheResponse(15,{scope:"user",keyExtra:req=>req.headers.authorization?"auth":"anon"})`; cacheResponse.ts incorporates `keyExtra` into key — richer stats cannot serve to anon |
| Frontend renders no PII | ✓ PASS | grep for `.email`/`.lastName`/`/admin/users` across `public-leaderboard/` + `app/leaderboard/` returns EMPTY |
| funded-only not caller-overridable | ✓ PASS | controller does NOT accept programStage/status/search; service forces `programStage:"funded"` after spread |

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| pft-backend leaderboard.interface.ts | ✓ VERIFIED | PublicLeaderboardTrader/Response present, no email/lastName |
| pft-backend leaderboard.service.ts | ✓ VERIFIED | toPublicDTO + getPublicLeaderboard + funded-only + `$nin` opt-out |
| pft-backend leaderboard.controller.ts | ✓ VERIFIED | getPublicLeaderboard with optional verifyToken decode, never throws |
| pft-backend leaderboard.routes.ts | ✓ VERIFIED | `/public` route, no Auth(), 15s auth-bucketed cache |
| pft-dashboard middleware.ts | ✓ VERIFIED | `isLeaderboardPath` added to isPublicPath OR-chain |
| pft-dashboard usePublicLeaderboard.ts (129 ln) | ✓ VERIFIED | hits /leaderboard/public, forwards params, staleTime 10s |
| pft-dashboard app/leaderboard/page.tsx (8 ln) | ✓ VERIFIED | renders PublicLeaderboardContainer |
| pft-dashboard PublicLeaderboardTable.tsx (143 ln) | ✓ VERIFIED | displayName only, conditional richer cols, no PII |
| pft-dashboard PublicLeaderboardContainer.tsx (230 ln) | ✓ VERIFIED | hook + filters + table + pagination wired, page reset on filter change |
| pft-dashboard PublicLeaderboardFilters.tsx (209 ln) | ✓ VERIFIED | account-size + challenge-type + sort controls |
| pft-dashboard SettingsContainer.tsx | ✓ VERIFIED | opt-out Switch seeded + optimistic PATCH |
| pft-dashboard useUsers.ts | ✓ VERIFIED | leaderboardOptOut in update payload; PATCH /users/:id |
| pft-dashboard types (leaderboard.types.ts + user.types.ts) | ✓ VERIFIED | Public types (no PII) + User.leaderboardOptOut?:boolean |

Note: public types live in `src/types/leaderboard.types.ts` and User opt-out in `src/types/user.types.ts` (plans suggested index.ts; the fallback-to-existing-types-section was explicitly allowed). Wiring resolves correctly.

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| routes `/public` | getPublicLeaderboard | ✓ WIRED | registered, no Auth() |
| controller | verifyToken | ✓ WIRED | optional decode, branch on validity, catch swallows errors |
| service | toPublicDTO | ✓ WIRED | every trader mapped before return |
| getLeaderboard | extraMatch ($nin) | ✓ WIRED | 3rd param applied at match stage (line 100) |
| page | PublicLeaderboardContainer | ✓ WIRED | imported + rendered |
| hook | /leaderboard/public | ✓ WIRED | ENDPOINTS.leaderboard.public + token auto-attach via apiClient |
| middleware | /leaderboard | ✓ WIRED | startsWith("/leaderboard") in isPublicPath |
| Settings Switch | PATCH /users/:id | ✓ WIRED | updateUser.mutateAsync → apiClient.patch(/users/:id) |
| Filters | hook params | ✓ WIRED | onChange → container state → usePublicLeaderboard |

### Requirements Coverage

| Requirement | Status | Note |
| ----------- | ------ | ---- |
| LB-01 (anon masked view) | ✓ SATISFIED (code) | truths 1 + security checks |
| LB-02 (logged-in richer stats) | ✓ SATISFIED (code) | truth 2 |
| LB-03 (opt-out) | ✓ SATISFIED (code) | truth 3 |
| LB-04 (filter/sort) | ✓ SATISFIED (code) | truth 4 |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| PublicLeaderboardFilters.tsx | `placeholder="All sizes"/"All types"` | ℹ️ Info | Legitimate Select placeholder UI text, not a stub |

No blocker or warning anti-patterns. Scoped `tsc --noEmit` on the dashboard project produced zero errors in any changed file.

### Human Verification Required

Four blocking human-verify checkpoints (02-02, 02-03 x2-as-one, 02-04) are DEFERRED because the app is not deployed. The CODE backing each is verified correct. See frontmatter `human_verification` for the precise live tests to run once deployed.

### Gaps Summary

No code gaps. Every must_have across plans 02-01..02-04 maps to substantive, wired implementation. The PII boundary is sound: masking is universal, the public route is unauthenticated yet never leaks email/last name, richer stats are gated by valid token AND isolated in the cache via keyExtra auth/anon bucketing, funded-only is forced server-side and cannot be widened by challengeType. The only outstanding items are live-UI confirmations that cannot run without a deployed environment.

---

_Verified: 2026-06-29_
_Verifier: Claude (gsd-verifier)_
