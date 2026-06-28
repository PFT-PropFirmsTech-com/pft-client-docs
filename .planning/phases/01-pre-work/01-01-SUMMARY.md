---
phase: 01-pre-work
plan: 01
subsystem: leaderboard
tags: [leaderboard, mt5-fallback, determinism, bugfix]
requires: []
provides:
  - "Deterministic floatingPL fallback (0) when MT5 open-position data is unavailable"
affects:
  - "pft-backend leaderboard ranking stability during MT5 downtime"
tech-stack:
  added: []
  patterns:
    - "MT5-offline fallback values must be deterministic, never randomized"
key-files:
  created: []
  modified:
    - "pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts"
decisions:
  - "floatingPL fallback is exactly 0 (not random) when MT5 is offline — equity then equals currentBalance, keeping ranks stable across requests"
metrics:
  duration: "~3 min"
  completed: 2026-06-29
---

# Phase 1 Plan 01: Fix Floating PL Summary

Replaced the `Math.random() * 200 - 100` placeholder floatingPL on the MT5-offline code path with a deterministic `0`, so leaderboard rankings no longer reshuffle between page loads when live open-position data is unavailable.

## What Changed

In `pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` (line 646-647):

Before:
```ts
// Mock floating PL (in real implementation, this would come from open positions)
const floatingPL = Math.random() * 200 - 100;
```

After:
```ts
// floatingPL is 0 when MT5 is offline — open position data unavailable
const floatingPL = 0;
```

`const equity = currentBalance + floatingPL;` (line 648) is unchanged — with floatingPL now 0, equity equals currentBalance in this fallback path. Lines 456 (`accountInfo.floating || 0`) and 500 (`floatingPL: 0`) were already correct and were not touched.

## Why It Matters

A random floatingPL meant two traders with identical realized performance ranked differently on each request, and the same trader's rank shifted on every page load during MT5 downtime. Rankings must be stable; the deterministic 0 fallback achieves that.

## Verification

- `grep "Math.random"` on the file: zero matches (placeholder fully removed).
- `grep "const floatingPL = 0"` on the file: exactly 1 match at line 647.
- Lines 456 and 500 unchanged.
- Scoped `npx tsc --noEmit --skipLibCheck` produced zero errors referencing `leaderboard.service` (full-repo tsc OOM avoided per project memory; scoped/timed run used).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Committed in the nested pft-backend repo, not the parent planning repo**
- **Found during:** Task 1 commit
- **Issue:** `pft-backend/` is an independent nested git repository (its own `.git`, branch `main-2026`), not a submodule of the parent repo. The first commit attempt from the parent repo root captured nothing because the parent only sees `pft-backend/` as an untracked directory.
- **Fix:** Committed the code change inside the `pft-backend` repo on `main-2026` (the confirmed deploy branch per project memory).
- **Files modified:** `pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts`
- **Commit:** `364dadc0` (in pft-backend repo, branch main-2026)

## Authentication Gates

None.

## Commits

| Repo        | Branch     | Hash     | Message |
| ----------- | ---------- | -------- | ------- |
| pft-backend | main-2026  | 364dadc0 | fix(01-01): make floatingPL fallback deterministic when MT5 offline |

## Notes for Next Plan

- Plan 01-02 (add leaderboard opt-out) is next in this phase. Per STATE.md, use `{ leaderboardOptOut: false }` (not `{ $ne: true }`) only after the PRE-02 migration is confirmed.
- Code changes for backend land in the nested `pft-backend` repo on `main-2026`; `.planning/` docs live in the parent repo. Keep this split in mind for all future plan commits.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-pre-work/01-01-SUMMARY.md`
- FOUND: `pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts`
- FOUND: commit `364dadc0` (pft-backend, main-2026)
- FOUND: `const floatingPL = 0` present in target file
