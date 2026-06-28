# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Funded traders rank and compete in monthly prize pool competitions
**Current focus:** Phase 1 — Pre-Work

## Current Position

Phase: 1 of 3 (Pre-Work)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-06-29 — Completed 01-02-add-leaderboard-opt-out.md

Progress: [██████████] 100% (Phase 1)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
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

### Pending Todos

None yet.

### Blockers/Concerns

- PRE-01/PRE-02 must land before Phase 2 work — do not skip
- leaderboardOptOut schema default landed (01-02) — `{ leaderboardOptOut: false }` is now safe; schema must deploy from `main-2026` before leaderboard service relies on it at runtime

## Session Continuity

Last session: 2026-06-29
Stopped at: Phase 1 (Pre-Work) complete — both 01-01 (floatingPL fix) and 01-02 (leaderboard opt-out) done. Ready to plan Phase 2.
Resume file: None
