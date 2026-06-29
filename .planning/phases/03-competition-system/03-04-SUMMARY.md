---
phase: 03-competition-system
plan: 04
subsystem: competition
tags: [competition, winner-determination, CAS, cron, admin]
requires: ["03-02", "03-03"]
provides:
  - "closeAndDetermineWinners(id) — CAS-gated close + winner determination (single write path)"
  - "POST /competitions/:id/determine-winners admin trigger"
  - "GET /competitions/admin/:id/results admin results read (full identity)"
  - "Admin CompetitionResults view (winners podium + final standings)"
affects:
  - "competition transition cron (closeIfDue now routes through closeAndDetermineWinners)"
  - "admin /admin/competitions page (Results + Determine-winners actions)"
tech-stack:
  added: []
  patterns:
    - "CAS gate (findOneAndUpdate {_id,status:'active'} -> 'closing') as the single concurrency guard"
    - "dedupe-by-user Map (best delta per user) for distinct winners"
key-files:
  created:
    - "pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionResults.tsx"
  modified:
    - "pft-backend/src/app/modules/Competition/competition.service.ts"
    - "pft-backend/src/app/modules/Competition/competition.controller.ts"
    - "pft-backend/src/app/modules/Competition/competition.routes.ts"
    - "pft-dashboard/src/lib/api/config.ts"
    - "pft-dashboard/src/types/competition.types.ts"
    - "pft-dashboard/src/hooks/useCompetitions.ts"
    - "pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx"
    - "pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionsTable.tsx"
decisions:
  - "CAS active->closing flip is the ONLY guard against double winner determination; cron + admin trigger both call closeAndDetermineWinners so there is exactly one write path"
  - "Disqualification checks THREE sources: Leaderboard.status in {BANNED,VIOLATED}, programs[].isBanned, top-level User.isBanned"
  - "finalValueGrowth + delta persisted on ALL entries (winners and non-winners) so admin standings render the full board"
  - "determineWinners() on an already-ended/closing competition returns existing winners WITHOUT recompute (idempotent); non-active/non-ended throws"
  - "Admin results read its OWN full-identity data (firstName+lastName) — NEVER the public masked toPublicRankingDTO"
metrics:
  duration: ~12 min
  completed: 2026-06-29
---

# Phase 3 Plan 04: Close + Winner Determination Summary

CAS-gated competition close that ranks entries by final % growth delta, disqualifies BANNED/VIOLATED/banned accounts, dedupes per-account entries to each user's best account (top 3 = 3 distinct users), records a winners[] snapshot, and surfaces winners + final standings in an admin results view. FINAL plan of the competition system phase.

## What Was Built

### Backend (pft-backend main-2026, commit 2e914996)

- **`closeAndDetermineWinners(competitionId)`** — the single winner-write path:
  1. **CAS GATE** — `Competition.findOneAndUpdate({_id, status:"active"}, {$set:{status:"closing"}}, {new:true})`. If null (already claimed / not active), no-op and return current doc. Only the flip-winner proceeds.
  2. Load all CompetitionEntry rows; read current `valueGrowthPercentage` + `status` from the Leaderboard collection (keyed userId+programId).
  3. **Disqualify** entries whose Leaderboard.status is BANNED/VIOLATED, OR programs[].isBanned, OR top-level User.isBanned.
  4. Persist `finalValueGrowth` + `delta` on every entry (bulkWrite) for standings.
  5. **Dedupe-by-user** — keep each user's highest-delta eligible entry (Map<userId, best>).
  6. Sort desc by delta, take top N = prizePool.length; mark winning entries (rank+isWinner); write `winners[]` snapshot; set status `ended`.
  - Prize disbursement is NOT automated (record-only, LOCKED).
- **`determineWinners(id)`** — admin entry point; ended/closing returns existing winners (idempotent), active routes through the CAS gate, otherwise 400.
- **`getAdminResults(id)`** — full-identity winners + full final standings (populated firstName/lastName/email, sorted by delta).
- **`closeIfDue(id)`** — cron hook now delegates to `closeAndDetermineWinners` (replaces the 03-02 placeholder).
- Controller: `determineWinners`, `getResults`. Routes: `POST /:id/determine-winners` + `GET /admin/:id/results` (both `Auth(admin, backOffice)`).

### Dashboard (pft-dashboard main-2026, commit 1d1ececc)

- `config.ts`: `determineWinners(id)` + `adminResults(id)` endpoints.
- `competition.types.ts`: `CompetitionAdminWinner` / `CompetitionAdminStanding` / `CompetitionAdminResults` (full-name admin types).
- `useCompetitions.ts`: `useDetermineWinners()` mutation + `useCompetitionResults(id)` query.
- `CompetitionResults.tsx` (new): winners podium (1st/2nd/3rd, mirror of WeeklyPrizeWinners) + full final-standings table, inside a Dialog. Shows FULL names (admin Auth-gated).
- `CompetitionsTable.tsx`: "Determine winners" button for past-end active competitions (CAS-safe) + "Results" button for ended competitions.
- `CompetitionContainer.tsx`: results modal state + determine-winners handler wiring.

## Deviations from Plan

None — plan executed as written. Disqualification was implemented against three ban sources (Leaderboard status, per-program isBanned, top-level User.isBanned) to fully honor the locked "banned/violated cannot win" rule; the plan named the Leaderboard status + program isBanned path and this is a strict superset.

## Verification

- Backend scoped tsc (`tsc --noEmit -p tsconfig.json | grep Competition/`): clean.
- Dashboard scoped tsc: no errors in any touched file (one pre-existing unrelated error in `useProjectConfig.ts`, untouched).
- grep confirms: CAS findOneAndUpdate active->closing (service:401), disqualify BANNED/VIOLATED/isBanned, `determine-winners` route, dedupe Map, container renders CompetitionResults, both endpoints wired.
- Both repos committed and pushed.

## Post-Deploy Human-Verify Checklist (Task 3 — DEFERRED, app not deployed)

Once deployed from main-2026, with a competition that has enrolled entries (needs live Leaderboard data):

- [ ] Let a competition reach endDate (or click "Determine winners"). Admin Results show a top-3 podium with prize amounts.
- [ ] Top 3 are 3 DISTINCT users — no single trader in two slots even if they had multiple funded accounts.
- [ ] A BANNED/VIOLATED account does NOT appear in winners even if its growth ranks high.
- [ ] Ranking is by % growth DELTA from competition start (final − baseline), NOT absolute value.
- [ ] Trigger "Determine winners" twice (and/or let cron + button both fire) — winners recorded ONCE, no duplicates (CAS holds).
- [ ] Admin Results final-standings table shows the full board (all entries) ranked by delta, winners highlighted.

**STAGING CAVEAT:** if `MT5_CRONS_ENABLED` is off, the Leaderboard collection is stale/empty so deltas may all be 0 / no eligible winners — expected Pitfall 2 behavior. The CAS no-double-write, disqualify, and distinct-user logic should still be verified wherever live leaderboard data exists; idempotency is verifiable regardless.

## Self-Check: PASSED
