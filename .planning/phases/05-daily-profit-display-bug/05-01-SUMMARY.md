---
phase: 05-daily-profit-display-bug
plan: 01
subsystem: ui
tags: [pft-dashboard, mt5-deals, daily-pnl, trade-history-merge]

requires:
  - phase: 01-pre-work
    provides: useTradingDashboardData mergedFromDeals closure pattern (pre-existing)
provides:
  - Orphan-close emission so paginated/archive-boundary close deals appear in daily P&L sums
affects: [pft-rule-checker (companion server-side pairing bug — separate ticket), Daily P&L Calendar widget consumers]

tech-stack:
  added: []
  patterns: ["Orphan-emit guard inside MT5 deal merge: when matching open is outside loaded buffer, synthesize a closed row from the close deal alone with DurationMs=1 so the display filter accepts it"]

key-files:
  created: []
  modified: [pft-dashboard/src/hooks/useTradingDashboardData.ts]

key-decisions:
  - "Emit synthetic orphan-close row instead of dropping it — preserves daily P&L accuracy at the cost of a synthetic OpenTime=CloseTime row (acceptable: rows already use this shape for matched same-second scalps)"
  - "DurationMs=1 (not 0) is mandatory — isDisplayableMergedTrade at utils/tradeHistoryDisplay.ts:119 drops rows when both durationSec==0 AND durationMs==0; with openTime==closeTime durationSec=0 so durationMs must be truthy"
  - "Use PricePosition (fallback Price) for the synthetic OpenPrice — mirrors the standalone fallback path already in the file at line 727"
  - "Kept mergedFromDeals inline in the closure (no refactor) — out of scope per plan"
  - "Did NOT add a test file — pft-dashboard has no jest/vitest setup; standing up infra for one bug = scope creep"

patterns-established:
  - "Orphan close emission: any future change to mergedFromDeals must preserve the totalOpen<=0 orphan branch; deleting it re-introduces the bug"

duration: 14min
completed: 2026-06-30
---

# Phase 5 Plan 01: Daily Profit Display Bug Summary

**mergedFromDeals now emits synthetic closed-position rows for orphan close deals (open outside loaded buffer), fixing Daily P&L Calendar undercounting for paginated/archive-boundary trades on Trading Cult account 13535.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-06-30T14:06:15Z
- **Tasks:** 1 of 2 (Task 2 human-verify DEFERRED)
- **Files modified:** 1

## Accomplishments
- Surgical single-line replacement in `useTradingDashboardData.ts` close-deal branch (entry==="1") — buggy `if (remain <= 0 || totalOpen <= 0) continue;` split into orphan-emit branch + matched zero-remaining guard.
- Synthetic row shape mirrors `emitClosed` helper field-for-field (Time/Profit/Commission/Storage/Symbol/Volume/Action/Deal/PositionID/Lots/OpenTime/CloseTime/OpenTimeMs/CloseTimeMs/DurationMs/OpenPrice/ClosePrice/TP/SL/Comment/OrderOpen/OrderClose/Direction) with `_orphanClose: true` debug marker.
- Matched-pair while-loop, entry==="0" branch, entry==="2" branch all byte-identical to before (verified via `git diff --stat` showing only +44/-1 lines in the orphan region).

## Task Commits

1. **Task 1: Patch mergedFromDeals close-deal branch** — `ba06d755` (fix)
2. **Task 2: Post-deploy human verify** — DEFERRED (no dev-server start per objective)

Pushed: pft-dashboard origin/main-2026 fast-forward `73414998..ba06d755`.

## Arithmetic Verification

Trading Cult live DB fixture for account 13535 / 2026-06-18 (per Phase 5 RESEARCH.md):
- Matched-pair closes (12 deals): sum = **$54.85**
- Orphan close (Deal 1036327 / Position 1048884): Profit = **-$34.69**
- True day sum (matched + orphan): $54.85 + (-$34.69) = **$20.16**

Before fix: orphan dropped at the `continue` guard → widget rendered `Math.abs(54.85).toFixed(0)` → **"+$55"**.
After fix: orphan emitted as synthetic row → sum becomes $20.16 → widget renders **"~$20"**.

The `Math.abs` in the widget renderer is the reason this bug was visually invisible — even though the true daily sum was positive, the matched-only sum was *also* positive (just inflated), so no sign-flip telegraphed the data loss. Future negative-day spotting won't catch this class of bug either; the diff-scope assertion in the commit is the durable safeguard.

## Files Created/Modified

- `pft-dashboard/src/hooks/useTradingDashboardData.ts` — added 44-line orphan-close emission branch inside `mergedFromDeals` close-deal handler (entry==="1"); preserved matched-pair `while` loop unchanged.

## Diff Scope

`git diff --stat`: `1 file changed, 44 insertions(+), 1 deletion(-)`. The single deleted line was the buggy combined `continue`; matched-pair pairing, OPEN-deal handling (entry==="0"), and reversal handling (entry==="2") are byte-identical.

## Decisions Made

See frontmatter `key-decisions`. Notable: kept `mergedFromDeals` inline; no test file; DurationMs=1 sentinel.

## Deviations from Plan

None — plan executed exactly as written. Used the existing helpers (`lotsFromVolume`, `toUiVolumeUnits`, `toActionFlag`, `toNum`) already in scope; mirrored `emitClosed` field shape.

## Issues Encountered

- Initial push rejected (remote ahead `35337a41..73414998`) — pulled with `--rebase`, single-commit rebase succeeded clean, pushed `ba06d755`. No conflicts.
- Full-project `tsc` on the file emits 11 pre-existing module-resolution errors (`@/hooks/*`, `@/lib/*`, `@/types/*`, `@/utils/*`) and one pre-existing MapIterator/--downlevelIteration error at line 1065. None new at patched lines. Consistent with memory note: "pft-dashboard tsc reports 259 pre-existing errors."

## Out-of-Scope Follow-ups

**1. MT5 broker data-sync delta ($9.90 vs $20.16).** The MT5 terminal for account 13535 shows $9.90 for 2026-06-18 while the DB sum (post-fix) is $20.16. Separate concern: data sync between broker and our trade-history store. Do NOT block this fix on it. Recommend DEV ticket once a sample of accounts is gathered to determine if this is per-account drift or a systemic sync window.

**2. pft-rule-checker companion bug.** The same orphan-drop pattern likely exists server-side in `pft-rule-checker`'s pairing logic (rule-checker emits server-merged trade rows that the dashboard reconciles by `tradeRowKey`). If rule-checker also drops orphan closes, server-side rule evaluation (drawdown breach detection, daily-loss enforcement) is undercounting losses by the same mechanism. Recommend DEV ticket: audit rule-checker for the symmetric guard, port the same fix.

## User Setup Required

None — no env vars, no config, no migrations.

## Next Phase Readiness

**Code complete + pushed; human-verify DEFERRED.** Matches the v1.0/v1.1 convention (04-04, 03-04, 03-03, 02-02 all PUSHED but NOT deployed). Resume signal: post next pft-dashboard main-2026 deploy → verify on Trading Cult account 13535 / 2026-06-18 (expect ~$20, not $55), screenshot, attach to ticket `cmquy9bqo005pny0kw6j0lr71`, set status `WAITING_CLIENT`.

**Deploy note:** pft-dashboard `main-2026` ships ALL brands together — Trading Cult, NSF, Easy Funding, etc. all receive this fix on the next dashboard deploy. The bug is data-shape-driven (orphan close on archive boundary), not brand-specific, so any brand with paginated load could have been affected; Trading Cult was just where it was first observed.

## Self-Check

Verifying claims before finalizing:

- `pft-dashboard/src/hooks/useTradingDashboardData.ts` modified: confirmed (commit `ba06d755` shows +44/-1).
- Commit `ba06d755` exists on origin/main-2026: confirmed via `git push` output `73414998..ba06d755 main-2026 -> main-2026`.
- Markers present: `Orphan close` (comment), `_orphanClose: true` (marker), `DurationMs: 1` (display-filter sentinel) all grep-confirmed.
- Diff scope: only orphan branch added; matched-pair while-loop / entry==="0" / entry==="2" untouched.

## Self-Check: PASSED

---
*Phase: 05-daily-profit-display-bug*
*Completed: 2026-06-30*
