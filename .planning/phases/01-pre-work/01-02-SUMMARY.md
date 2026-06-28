---
phase: 01-pre-work
plan: 02
subsystem: database
tags: [mongoose, mongodb, typescript, schema, leaderboard]

# Dependency graph
requires: []
provides:
  - leaderboardOptOut Boolean field on UserSchema (default false)
  - leaderboardOptOut?: boolean on TUser interface
  - Indexed-ready { leaderboardOptOut: false } query support for leaderboard filtering
affects: [leaderboard, competition, public-rankings, toPublicDTO]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mongoose schema default backfills existing documents — no migration script for additive boolean flags"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Auth/auth.interface.ts
    - pft-backend/src/app/modules/Auth/auth.model.ts

key-decisions:
  - "No DB migration script: Mongoose default: false handles all existing docs and new docs uniformly"
  - "Interface field is optional (?) because existing documents return undefined (falsy, equivalent to false for opt-out checks)"

patterns-established:
  - "Additive boolean opt-out flags use Mongoose default: false instead of a backfill migration"

# Metrics
duration: ~4min
completed: 2026-06-29
---

# Phase 1 Plan 02: Add Leaderboard Opt-Out Summary

**Added leaderboardOptOut Boolean (default false) to the Mongoose UserSchema and TUser interface, enabling safe `{ leaderboardOptOut: false }` filtering for public rankings without a migration script.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-29
- **Completed:** 2026-06-29
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `leaderboardOptOut?: boolean` added to the `TUser` interface (after `preferredCurrency`)
- `leaderboardOptOut` field with `type: Boolean, default: false` added to `UserSchema` (after `isDeleted`)
- Existing documents are covered by the Mongoose default — no backfill/migration needed

## Task Commits

Each task was committed atomically (in the nested `pft-backend` git repo):

1. **Task 1: Add leaderboardOptOut to TUser interface** - `6139622d` (feat)
2. **Task 2: Add leaderboardOptOut field to UserSchema** - `903bef2d` (feat)

## Files Created/Modified
- `pft-backend/src/app/modules/Auth/auth.interface.ts` - Added optional `leaderboardOptOut?: boolean` to TUser interface (line 311)
- `pft-backend/src/app/modules/Auth/auth.model.ts` - Added `leaderboardOptOut` Boolean field with `default: false` to UserSchema (line 461, between `isDeleted` and `isNameLocked`)

## Decisions Made
- No migration script: Mongoose `default: false` returns `false` for all existing documents lacking the field and for new documents, making `{ leaderboardOptOut: false }` a safe and complete filter.
- Interface field marked optional (`?`) since Mongoose returns `undefined` for pre-existing docs at the type level; `undefined` is falsy and equivalent to `false` for opt-out checks.

## Deviations from Plan

### Discovery: pft-backend is a nested git repository

- **Found during:** Task 1 commit attempt
- **Issue:** The outer workspace repo tracks `pft-backend/` as an untracked directory; the planned commit failed because `pft-backend` is its own independent git repo (HEAD `6e90b6da`).
- **Resolution:** Performed all per-task commits inside the `pft-backend` repo rather than the workspace root. This is the correct location for backend source commits. No code change required.
- **Impact:** None on deliverables. Commit hashes (`6139622d`, `903bef2d`) live in the `pft-backend` repo.

This is a tooling/location adjustment, not a code deviation. Plan code edits executed exactly as written.

## Issues Encountered
- Initial commit ran from the workspace root and failed (pft-backend is a separate repo). Resolved by committing within the nested repo. No rework of edits needed.

## User Setup Required
None - no external service configuration required. Mongoose schema default applies automatically on next backend deploy.

## Next Phase Readiness
- `leaderboardOptOut` is now a valid, safe filter field. Per STATE.md guidance, `{ leaderboardOptOut: false }` is now safe to use (PRE-02 schema default landed — no `$ne: true` pattern needed).
- Both PRE-01 and PRE-02 must land before Phase 2 leaderboard work. PRE-02 (this plan) is complete.
- Schema change must be deployed (ships from `main-2026` per project memory) before leaderboard service relies on the field at runtime.

---
*Phase: 01-pre-work*
*Completed: 2026-06-29*

## Self-Check: PASSED

- FOUND: .planning/phases/01-pre-work/01-02-SUMMARY.md
- FOUND: leaderboardOptOut?: boolean in auth.interface.ts
- FOUND: leaderboardOptOut field in auth.model.ts
- FOUND: commit 6139622d (Task 1, pft-backend repo)
- FOUND: commit 903bef2d (Task 2, pft-backend repo)
