---
phase: 05-daily-profit-display-bug
verified: 2026-06-30T14:30:00Z
status: human_needed
score: 5/5 static must-haves verified; 1 live-render check deferred to post-deploy
human_verification:
  - test: "Open Trading Cult dashboard as/on account 13535, view Daily P&L Calendar, locate 2026-06-18 cell"
    expected: "Cell renders ~$20 (true sum $20.16), NOT $55 (buggy matched-only sum $54.85). Screenshot to ticket cmquy9bqo005pny0kw6j0lr71."
    why_human: "Requires live deploy of pft-dashboard main-2026 to Trading Cult + live MT5 data on account 13535 + visual confirmation of rendered widget value. Matches the 04-04 / 03-04 / 02-02 / 03-03 deferred-human-verify convention."
---

# Phase 05: Daily Profit Display Bug Verification Report

**Phase Goal:** Fix `mergedFromDeals` in pft-dashboard so the Daily P&L Calendar widget no longer drops orphan close deals. Account 13535 / 2026-06-18 must compute $20.16 instead of $54.85.

**Verified:** 2026-06-30
**Status:** human_needed (all static checks pass; live-render check deferred to post-deploy)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Orphan CLOSE deal (no matching OPEN in buffer) now emits a closed-position row carrying Profit, not silently dropped | VERIFIED | Diff shows new `if (totalOpen <= 0) { ... closed.push({...Profit:profitTotal.toFixed(2)...}); continue; }` branch replacing the buggy combined guard |
| 2 | Live render of account 13535 / 2026-06-18 cell shows ~$20 not $55 | NEEDS HUMAN | Requires post-deploy visual check |
| 3 | Synthetic orphan rows pass `isDisplayableMergedTrade` (Symbol/Action<2/OpenPrice>0/durationMs>0) | VERIFIED | Synthetic row has: `Symbol: symbol` (from close), `Action: toActionFlag(dir)` (Action<2 since close deals are 0/1), `OpenPrice: pricePosition>0?pricePosition:price` (fallback Price), `DurationMs: 1` (truthy), `OpenTime: tSec` (>0). Filter at `tradeHistoryDisplay.ts:118-119` requires openTime>0, closeTime>=openTime, durationSec>0 \|\| durationMs>0 — all satisfied |
| 4 | Matched-pair logic + entry==='0' + entry==='2' branches byte-identical to before; only the combined `continue` line is split | VERIFIED | `git show ba06d755` shows hunk strictly inside `if (entry === "1")` block at lines 602-651. Single deleted line: `if (remain <= 0 || totalOpen <= 0) continue;`. Replaced by orphan-emit + standalone `if (remain <= 0) continue;`. No other regions touched. `git show --stat` = 1 file, +44/-1 |
| 5 | Arithmetic fix provable from diff alone: orphan Profit now included in daily sum | VERIFIED | Pre-fix: 12 matched closes sum to $54.85, orphan -$34.69 dropped → widget Math.abs(54.85).toFixed(0) = "55" → "+$55". Post-fix: orphan emitted → daily sum = 54.85 + (-34.69) = $20.16 → Math.abs(20.16).toFixed(0) = "20" → "+$20". Math.abs is display-only; signed value flows into sum |

**Score:** 5/5 static truths verified. Truth 2 awaits post-deploy human render check.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pft-dashboard/src/hooks/useTradingDashboardData.ts` | Patched mergedFromDeals with orphan-close emission | VERIFIED | Commit ba06d755 on origin/main-2026. Orphan branch at lines 605-647. Comment "Orphan close" present. `_orphanClose: true` debug marker present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useTradingDashboardData.ts` mergedFromDeals (entry==='1' orphan branch) | `tradeHistoryDisplay.ts` isDisplayableMergedTrade | Emitted row fields: DurationMs=1, OpenTime=CloseTime=tSec, Symbol from close, Action<2, OpenPrice via PricePosition fallback Price | WIRED | Filter at line 118-119 requires `openTime > 0 && closeTime >= openTime && (durationSec > 0 \|\| durationMs > 0)`. Synthetic row: openTime=tSec>0, closeTime=tSec=openTime (>=), durationMs=1 (truthy). All satisfied |
| Hook closure scoping | Not exported/refactored | mergedFromDeals declared at line 335 inside useTradingDashboardData (declared line 43) | VERIFIED | Closure preserved; no top-level export; called 6× internally as designed |

### Scope Discipline

| Check | Status | Evidence |
|-------|--------|----------|
| No test file added | VERIFIED | git show --stat shows single file modified |
| mergedFromDeals not exported / not refactored out of closure | VERIFIED | Still `const mergedFromDeals = (` at line 335 inside hook |
| Diff scoped to close-deal branch only | VERIFIED | Hunk header `@@ -602,7 +602,50 @@` falls entirely within `if (entry === "1")` block; matched while-loop, entry==='0', entry==='2' untouched |
| Matched-pair while-loop byte-identical | VERIFIED | Diff replaces only the pre-loop guard line; while-loop below the orphan branch is unchanged |

### Out-of-Scope Preservation (SUMMARY.md)

| Item | Status | Evidence |
|------|--------|----------|
| $9.90 vs $20.16 MT5/DB sync note | VERIFIED | SUMMARY.md "Out-of-Scope Follow-ups" §1: "MT5 broker data-sync delta ($9.90 vs $20.16)" |
| pft-rule-checker companion follow-up | VERIFIED | SUMMARY.md "Out-of-Scope Follow-ups" §2: "pft-rule-checker companion bug" with DEV ticket recommendation |
| Deferred-human-verify convention match | VERIFIED | SUMMARY.md "Next Phase Readiness": references 04-04 / 03-04 / 03-03 / 02-02 PUSHED-NOT-DEPLOYED convention |

### Arithmetic Re-derivation

- Pre-fix daily sum (matched-only) = $54.85 → `Math.abs(54.85).toFixed(0)` = "55" rendered as "+$55" — matches reported bug
- Post-fix daily sum (matched + orphan) = $54.85 + (-$34.69) = **$20.16** → `Math.abs(20.16).toFixed(0)` = "20" rendered as "+$20" — matches expected fix
- The signed value (-$34.69) is what now flows into the sum via `closed.push({ Profit: profitTotal.toFixed(2), ...})`; Math.abs is display-side only

VERIFIED.

### Anti-Patterns Found

None. The `_orphanClose: true` marker is intentional and noted in SUMMARY.md as a debug marker; not a TODO/stub.

### Human Verification Required

1. **Live render check on Trading Cult account 13535 / 2026-06-18**
   - Test: After next pft-dashboard main-2026 deploy reaches Trading Cult, log in as/impersonate the trader on account 13535, open Daily P&L Calendar, locate the 2026-06-18 cell
   - Expected: Cell renders ~$20 (true sum $20.16), NOT $55 (buggy matched-only sum $54.85). Spot-check adjacent days for no regression on matched-pair days.
   - Why human: Requires live deploy + live MT5 data + visual widget confirmation. Cannot be verified programmatically without a running app + live broker connection.

### Gaps Summary

No code gaps. The patch is surgical (1 file, +44/-1), correctly scoped (only the close-deal branch's combined `continue` guard is split), and arithmetically forces the dropped $-34.69 back into the daily sum. The synthetic row construction mirrors the existing `emitClosed` shape and passes the display filter (`DurationMs: 1` defeats the durationSec==0 trap; OpenTime=CloseTime is acceptable since closeTime >= openTime succeeds at equality).

The only open item is the post-deploy human render check, which is the standard convention in this milestone (04-04, 03-04, 03-03, 02-02 all pushed-not-deployed).

---

*Verified: 2026-06-30*
*Verifier: Claude (gsd-verifier)*
