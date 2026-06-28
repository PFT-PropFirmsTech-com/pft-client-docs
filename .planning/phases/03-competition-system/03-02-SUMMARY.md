---
phase: 03-competition-system
plan: 02
subsystem: Competition (pft-backend)
tags: [competition, enrollment, baseline, cron, leaderboard]
requires:
  - "03-01: Competition + CompetitionEntry models, competition.service.ts activate()"
  - "Leaderboard collection (precomputed, MT5-gated refresh cron)"
  - "Program.programStage === 'funded' as the funded discriminator"
provides:
  - "CompetitionService.enrollParticipants(competitionId): one CompetitionEntry per funded non-opted-out account with baselineValueGrowth snapshot"
  - "activate() now triggers enrollment after draft->active flip"
  - "CompetitionService.tickTransitions(): date-driven draft->active (enroll) + active->ended (close placeholder) dispatcher"
  - "CompetitionService.closeIfDue(competitionId): placeholder for 03-04 CAS close + winner determination"
  - "CompetitionCronService: static-class 5-min ticker registered in server.ts, NOT MT5-gated"
affects:
  - "03-03 (rankings): reads CompetitionEntry.baselineValueGrowth for live delta"
  - "03-04 (close/winners): replaces closeIfDue() body with CAS close + winner determination"
tech-stack:
  added: []
  patterns:
    - "Reuse precomputed Leaderboard collection for funded+opt-out set (no fresh MT5 traversal, no raw-User funded derivation)"
    - "Idempotent activation snapshot (guarded on existing CompetitionEntry count)"
    - "Static-class cron mirroring LeaderboardCronService (isRunning guard, setInterval, start/stop)"
    - "Thin cron dispatcher (tickTransitions) so 03-04 can fill close path without restructuring cron"
key-files:
  created:
    - "pft-backend/src/app/modules/Competition/competition.cron.ts"
  modified:
    - "pft-backend/src/app/modules/Competition/competition.service.ts"
    - "pft-backend/src/server.ts"
decisions:
  - "Baseline field = baselineValueGrowth (matches CompetitionEntry schema from 03-01; same field read at close 03-04)"
  - "Enrollment is per-account + activation-only + idempotent (LOCKED); no rolling mid-competition enrollment"
  - "Competition cron NOT gated on MT5_CRONS_ENABLED (does no MT5 work); reads precomputed Leaderboard"
  - "User model imported as default export from ../Auth/auth.model (same as leaderboard.service), not ../User/user.model"
metrics:
  duration: "~8 min"
  completed: "2026-06-29"
---

# Phase 3 Plan 02: Activation Enrollment + Baseline Snapshot Summary

Auto-enroll all funded, non-opted-out trading accounts (one CompetitionEntry per funded account) with an activation baseline % growth snapshot when a competition transitions draft->active, plus a lightweight non-MT5 competition cron that drives that transition by date.

## What Was Built

### Task 1 — enrollParticipants + baseline, hooked into activate()
`CompetitionService.enrollParticipants(competitionId)`:
- Sources the funded, non-opted-out set from the precomputed **Leaderboard collection** — mirrors `leaderboard.service.ts:288-297` / `getPublicLeaderboard`:
  - `optedOut = User.distinct("_id", { leaderboardOptOut: true })`
  - `fundedProgramIds = Program.distinct("_id", { programStage: "funded" })` (funded is NOT an accountType — Pitfall 1)
  - `Leaderboard.find({ programId: { $in: fundedProgramIds }, userId: { $nin: optedOut } })` selecting `performance.valueGrowthPercentage`.
- Writes **one CompetitionEntry per funded account** via `insertMany`, with `baselineValueGrowth = row.performance.valueGrowthPercentage ?? 0` and `snapshotAt: now`. Per-account, NOT per-user — dedupe-to-best happens at close (03-04).
- **Idempotent:** skips if entries already exist for the competition (one-time activation snapshot; safe for cron/manual-activate races).
- **Activation-only:** no rolling enrollment; mid-competition funded traders are deliberately excluded (commented in code).

`activate()` now flips status to `active`, saves, then calls `enrollParticipants()`.

### Task 2 — CompetitionCronService + tickTransitions + server registration
- `CompetitionService.tickTransitions()`: thin dispatcher.
  - draft + `startDate <= now` -> `activateCompetition()` (enrolls; same idempotent path as manual admin activate).
  - active + `endDate <= now` -> `closeIfDue()` placeholder (03-04 replaces with CAS close + winner determination; no winner logic here).
- `CompetitionService.closeIfDue()`: logs/flags only for now.
- `CompetitionCronService` (`competition.cron.ts`): static class mirroring `LeaderboardCronService` — `syncInterval`, `isRunning` guard, `start()`/`stop()`, 5-min `setInterval` (`COMPETITION_CRON_INTERVAL_MS` override).
- `server.ts`: imported alongside `LeaderboardCronService`; `CompetitionCronService.start()` registered immediately after the leaderboard cron block (line 398), **outside** any `MT5_CRONS_ENABLED` gate, with `✅ Competition cron started` log.

## Non-prod staleness caveat (IMPORTANT)
The competition cron itself is NOT MT5-gated and runs in every environment. However, the **leaderboard scoring data IT reads is MT5-gated**: the Leaderboard refresh cron runs only when `MT5_CRONS_ENABLED` (server.ts:387). In staging / non-prod that refresh is OFF, so the Leaderboard collection is stale/empty — meaning enrollment can produce **zero or stale baselines** and competition rankings will be stale/empty in non-prod. This is expected and documented in code comments at the enrollment query. Real baselines/rankings require a production environment with `MT5_CRONS_ENABLED=true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] User model import path corrected**
- **Found during:** Task 1
- **Issue:** Plan/context implied `User` from `../User/user.model`, but that module exists empty; the codebase exports the user model as a **default** export from `../Auth/auth.model` (as `leaderboard.service.ts` does).
- **Fix:** `import User from "../Auth/auth.model";`
- **Files modified:** competition.service.ts
- **Commit:** 8dec4e3a

Otherwise plan executed as written.

## Verification

- Scoped tsc (`tsc --noEmit` filtered to `Competition/` and `server.ts`): clean. Full-repo tsc NOT run (OOMs).
- `enrollParticipants` / `baselineValueGrowth` / `programStage: "funded"` / `leaderboardOptOut` / `insertMany` / `CompetitionEntry` all present in service.
- `CompetitionCronService.start()` at server.ts:398, after leaderboard block (387-392), outside MT5_CRONS_ENABLED gate.
- `setInterval` / `isRunning` / `tickTransitions` present in cron + service.

## Commits

- `8dec4e3a` feat(03-02): activation auto-enroll + baseline snapshot + competition cron (pft-backend main-2026, pushed)

## Self-Check: PASSED
