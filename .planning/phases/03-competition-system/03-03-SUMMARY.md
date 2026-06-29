---
phase: 03-competition-system
plan: 03
subsystem: competition
tags: [public-surface, competition, masking, cache-bucket, countdown, rankings]
requires:
  - "03-02: CompetitionEntry.baselineValueGrowth activation snapshot"
  - "03-01: Competition model + admin CRUD + competitions ENDPOINTS block"
  - "02-01: leaderboard.service toPublicDTO masking + opt-out + auth/anon cache bucket (security template)"
provides:
  - "GET /competitions (public list — active/ended only, public-safe fields)"
  - "GET /competitions/:id/rankings (public masked delta-ranked rankings, auth/anon cache-bucketed)"
  - "public /competitions list + /competitions/[id] detail pages (outside (dashboard) auth group)"
  - "usePublicCompetition hook, CompetitionCountdown, PublicCompetitionRankingsTable"
affects:
  - "pft-dashboard middleware public allowlist (isCompetitionsPath)"
  - "pft-dashboard competitions ENDPOINTS block (+publicList/publicRankings)"
tech-stack:
  added: []
  patterns:
    - "Public masking via toPublicRankingDTO (explicit object build, no raw-user spread) — clone of leaderboard.service toPublicDTO"
    - "Opt-out re-filter at query time via User.distinct($nin) — entries persist but opted-out users vanish from public rankings"
    - "Delta ranking: current valueGrowthPercentage (Leaderboard collection) − entry.baselineValueGrowth"
    - "cacheResponse auth/anon keyExtra bucket on the public rankings route (mandatory — route has no Auth)"
    - "Optional Bearer decode in controller (never throws on anon; valid token unlocks richer stats only)"
    - "date-fns + setInterval countdown with interval cleanup on unmount"
key-files:
  created:
    - pft-dashboard/src/hooks/usePublicCompetition.ts
    - pft-dashboard/src/app/competitions/layout.tsx
    - pft-dashboard/src/app/competitions/page.tsx
    - pft-dashboard/src/app/competitions/[id]/page.tsx
    - pft-dashboard/src/components/public-competition/PublicCompetitionContainer.tsx
    - pft-dashboard/src/components/public-competition/CompetitionCountdown.tsx
    - pft-dashboard/src/components/public-competition/PublicCompetitionRankingsTable.tsx
  modified:
    - pft-backend/src/app/modules/Competition/competition.service.ts
    - pft-backend/src/app/modules/Competition/competition.controller.ts
    - pft-backend/src/app/modules/Competition/competition.routes.ts
    - pft-backend/src/app/modules/Competition/competition.interface.ts
    - pft-dashboard/src/middleware.ts
    - pft-dashboard/src/lib/api/config.ts
    - pft-dashboard/src/types/competition.types.ts
decisions:
  - "Public competition meta sourced from the public LIST endpoint (no separate public detail endpoint) — the detail page filters the list by id; rankings come from the dedicated /:id/rankings endpoint"
  - "No live Leaderboard row for an entry (stale/empty in non-prod) => current falls back to baseline => delta 0 (graceful, no crash)"
  - "Public list = status in [active, ended] only; getPublicRankings also guards the competition is active/ended (never exposes draft rankings)"
  - "Entries whose populated user is missing (deleted) are dropped from rankings (mirror leaderboard .filter(entry.userId))"
metrics:
  duration: ~12 min
  completed: 2026-06-29
---

# Phase 3 Plan 03: Public Competition Page Summary

Public competition surface — backend public list + masked delta-ranked rankings endpoints (auth/anon cache-bucketed), and public `/competitions` pages (prize pool, live countdown, masked live rankings) — cloning Phase 2's vetted leaderboard masking/opt-out/cache-bucket guarantees verbatim.

## What Was Built

### Backend (pft-backend, main-2026 — commit a27eb855)
- `competition.service.ts`:
  - `listPublic()` — competitions with `status in ["active","ended"]` only (never draft/closing/archived), explicit public-safe projection (name, description, startDate, endDate, status, prizePool, winners — no createdBy/internal fields).
  - `getPublicRankings(competitionId, includeRicherStats)` — loads CompetitionEntry rows, reads CURRENT `valueGrowthPercentage` from the Leaderboard collection (same source as enrollment), computes `delta = current − baselineValueGrowth`, sorts desc by delta, assigns live rank, and masks every row through `toPublicRankingDTO`.
  - `toPublicRankingDTO()` — the PII boundary, cloned from `leaderboard.service.ts:223 toPublicDTO`. Builds an explicit object (no raw-user spread). `displayName = "John D."` (first name + last initial). NEVER email, NEVER full lastName. Richer numeric stats (baseline/current) only when `includeRicherStats`.
  - Opt-out re-filter via `User.distinct("_id", { leaderboardOptOut: true })` + `userId $nin` — traders who opt out AFTER enrollment vanish from public rankings.
- `competition.controller.ts`: `publicList` + `publicRankings` handlers; `publicRankings` does the optional Bearer decode cloned from `leaderboard.controller.ts getPublicLeaderboard` (anon never throws; valid token => `includeRicherStats=true`; never branches identity).
- `competition.routes.ts`: public `router.get("/", cacheResponse(30), publicList)` and `router.get("/:id/rankings", cacheResponse(15, { scope:"user", keyExtra: req => req.headers.authorization ? "auth" : "anon" }), publicRankings)`. The keyExtra auth/anon bucket is MANDATORY (route has no Auth — without it the richer logged-in payload would be served to anon). Public routes declared before `/:id` mutations; admin reads remain under `/admin*`.
- `competition.interface.ts`: added `IPublicCompetition`, `IPublicCompetitionRanking`, `IPublicCompetitionRankingsResponse` (no email/lastName fields).

### Dashboard (pft-dashboard, main-2026 — commit 133edad3)
- `middleware.ts`: `isCompetitionsPath = path.startsWith("/competitions")` added to the `isPublicPath` OR-chain next to `isLeaderboardPath` — `/competitions` no longer redirects to login.
- `lib/api/config.ts`: `publicList: "/competitions"` + `publicRankings: (id) => /competitions/${id}/rankings` added to the competitions ENDPOINTS block.
- `usePublicCompetition.ts`: `usePublicCompetitions()` (staleTime 30s) + `usePublicCompetitionRankings(id)` (staleTime 15s, matches backend cache TTL). apiClient auto-attaches the token — no auth branching.
- `app/competitions/` (PLAIN folder OUTSIDE `(dashboard)`): `layout.tsx` (public chrome), `page.tsx` (active + past cards linking to detail), `[id]/page.tsx` (renders the container).
- `PublicCompetitionContainer.tsx`: sources competition meta from the public list (by id) + rankings from the rankings hook; renders prize pool (1st/2nd/3rd), `CompetitionCountdown`, and `PublicCompetitionRankingsTable`. Richer columns are DISPLAY-only (presence of richer fields), never a branched fetch.
- `CompetitionCountdown.tsx`: date-fns `differenceInSeconds` + `setInterval(1000)` counting down to endDate; shows "Ended" past endDate; clears the interval on unmount.
- `PublicCompetitionRankingsTable.tsx`: slim masked table cloned from `PublicLeaderboardTable` — columns rank, masked displayName, Growth Δ (signed delta); Baseline/Current columns only when richer fields present. Grep-clean of email/PII/admin routing.
- `competition.types.ts`: added `PublicCompetition`, `PublicCompetitionRanking`, `PublicCompetitionRankingsResponse` (no identity fields).

## How It Maps to Requirements
- COMP-04 — public competition page shows prize pool, live countdown, and rankings sorted by % growth DELTA from competition start, with Phase 2 masking/opt-out/cache-bucket guarantees intact. SATISFIED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `theme.classes.bgWhite` does not exist**
- **Found during:** Task 2 (competitions list card)
- **Issue:** `bgWhite` lives under `theme.colors`, not `theme.classes`; referencing `theme.classes.bgWhite` would render `undefined`.
- **Fix:** Used `theme.classes.bgGray50` for the card background (an existing class).
- **Files modified:** pft-dashboard/src/app/competitions/page.tsx
- **Commit:** 133edad3

Otherwise the plan executed as written.

## Verification Performed
- Backend scoped `tsc -p tsconfig.json | grep Competition/` => no Competition type errors.
- Backend grep: `keyExtra` present on rankings route; `delta`/`baselineValueGrowth`/`toPublic`/`displayName` present in service; email/lastName references are ONLY masking inputs/comments (output DTO exposes `displayName` only).
- Dashboard scoped `tsc | grep -i competition` => no competition type errors.
- `isCompetitionsPath` present in middleware; `src/app/competitions` exists and is NOT inside `(dashboard)`.
- `grep -rniE "email|admin/users" src/components/public-competition/` => clean; `lastName` absent from the entire public dashboard surface.

## Self-Check: PASSED
(see appended block)

## Deployment Status
Committed + pushed to both repos (pft-backend main-2026 a27eb855, pft-dashboard main-2026 133edad3). NOT yet deployed. The public rankings read `leaderboardOptOut` and the Leaderboard collection at runtime — both the 01-02 schema and the competition endpoints must ship from main-2026 before the public surface goes live.

## Human-Verify Checklist (post-deploy — NOT yet executed; app not deployed)

Once the app is deployed from main-2026:

1. **Anonymous load** — Open `/competitions` while LOGGED OUT (incognito). Confirm: page loads WITHOUT a login redirect; an active competition shows prize pool + a ticking countdown + rankings. Open a competition's `/competitions/[id]` detail.
2. **No PII (anon)** — In the rankings, confirm masked names ONLY ("John D.") — NO email, NO full last name anywhere. View the network response for the `/competitions/:id/rankings` call and confirm there is no `email` and no full `lastName` field — only `displayName`, `rank`, `deltaValueGrowth`.
3. **Logged-in masking holds** — Open `/competitions` while LOGGED IN. Confirm richer stat columns (Baseline/Current) appear, but identity is STILL masked ("John D.").
4. **Cache bucket** — Confirm the anonymous response never carries the richer logged-in fields (auth/anon cache buckets are separated via keyExtra). Hit the anon endpoint, then the auth endpoint, then anon again — anon must never receive baseline/current.
5. **Opt-out** — Confirm a trader with `leaderboardOptOut=true` does NOT appear in the rankings.
6. **Delta ranking** — Confirm ranking order matches % growth DELTA from competition start (current − baseline), NOT absolute value.

NOTE (staging caveat): if `MT5_CRONS_ENABLED` is off in this environment, the Leaderboard collection is stale/empty, so rankings/deltas may be empty (delta falls back to 0) — that is expected (Pitfall 2). Verify masking + countdown + page load + cache bucketing regardless; verify ranking accuracy only where leaderboard data is live.

**Resume signal:** Type "approved" or describe issues (especially any PII leak, missing cache bucketing, or wrong ranking order).
