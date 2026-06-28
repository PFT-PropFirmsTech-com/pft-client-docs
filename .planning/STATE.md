# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Funded traders rank and compete in monthly prize pool competitions
**Current focus:** Phase 1 complete → Phase 2 (Public Leaderboard) next

## Current Position

Phase: 2 of 3 (Public Leaderboard)
Plan: 03 of 4 in current phase
Status: In progress
Last activity: 2026-06-29 — Completed 02-03-opt-out-toggle.md (auto tasks; human-verify checkpoint pending live deploy)

Progress: [██░░] 25% (Phase 2: 02-03 done; 02-01, 02-02, 02-04 pending)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~3 min
- Total execution time: <1 hour

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture: toPublicDTO() serializer built in same phase as LB-01 (Phase 2) — prevents PII leak
- Architecture: CompetitionEntry as separate collection (not embedded) — avoids 16MB BSON limit at 10k+ participants
- Architecture: CAS close pattern for competition close — prevents double winner determination
- Architecture: Baseline snapshot per participant at competition start — rank by delta, not absolute value
- 01-01: floatingPL MT5-offline fallback is deterministic 0 (not random) — keeps leaderboard ranks stable across requests
- 01-02: leaderboardOptOut added via Mongoose `default: false` — no migration; `{ leaderboardOptOut: false }` is now a safe filter
- Repo split: backend code commits land in nested `pft-backend` repo on `main-2026`; `.planning/` docs live in parent repo
- 02-03: dashboard `User` type lives in `src/types/user.types.ts` (not `index.ts`); `leaderboardOptOut` added there + to `useUpdateUser` payload allow-list
- 02-03: opt-out is frontend-only — `PATCH /users/:id` already self-updates `leaderboardOptOut` (raw findByIdAndUpdate, not in sensitive-strip)

### Pending Todos

None yet.

### Blockers/Concerns

- PRE-01/PRE-02 must land before Phase 2 work — do not skip
- leaderboardOptOut schema default landed (01-02) — `{ leaderboardOptOut: false }` is now safe; schema must deploy from `main-2026` before leaderboard service relies on it at runtime

## Session Continuity

Last session: 2026-06-29
Stopped at: Phase 2 plan 02-03 (opt-out toggle) auto tasks complete + committed in pft-dashboard (b96474dd, e1628f7f). human-verify checkpoint NOT run (app not deployed) — checklist recorded in 02-03-SUMMARY.md for later live verification.
Resume file: .planning/phases/02-public-leaderboard/02-03-SUMMARY.md (human-verify checklist) — or proceed with 02-01/02-02/02-04.
