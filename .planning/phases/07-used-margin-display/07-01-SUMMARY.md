---
phase: 07-used-margin-display
plan: 01
subsystem: pft-rule-checker / accountrulestates
tags: [rule-state, margin, peak-metric, schema-additive]
dependency_graph:
  requires: []
  provides:
    - "accountrulestates.currentMarginUsedPercent (Number, per-tick snapshot)"
    - "accountrulestates.peakMarginUsedPercent (Number, all-time Math.max ratchet)"
  affects:
    - "07-02 dashboard widget (reads peakMarginUsedPercent)"
tech-stack:
  added: []
  patterns: ["Math.max ratchet beside peakTotalDrawdownPercent", "strict:false passthrough in pft-backend"]
key-files:
  created: []
  modified:
    - "pft-rule-checker/src/app/models/accountRuleState.model.ts (lines 48-49)"
    - "pft-rule-checker/src/app/models/accountRuleState.interface.ts (lines 108-112)"
    - "pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts (lines ~524-534 ratchet, 672-673 $set, 1104 payout-reset comment)"
decisions:
  - "Denominator margin/equity*100 (NOT MT5 marginLevel = equity/margin*100) — see RESEARCH §Pitfall 1"
  - "Peak NOT reset on payout/daily/EOD — all-time monotonic; written to $set every tick alongside peakTotalDrawdownPercent"
  - "Zero pft-backend code change — strict:false schema (`Schema({}, { strict: false })` at line 16) surfaces new fields automatically"
  - "No retroactive backfill — peakMarginUsedPercent populates from rule-checker deploy date forward"
metrics:
  duration: "~12 min"
  completed: "2026-06-30"
---

# Phase 7 Plan 01: Used Margin Display — Persistence Backbone Summary

Added `currentMarginUsedPercent` + `peakMarginUsedPercent` to the rule-checker `accountrulestates` schema and wired both into the existing per-tick peak-metric block in `ruleStateService.updateAfterSync`. Mirrors the proven `peakTotalDrawdownPercent` Math.max pattern exactly; pft-backend reads through its existing strict:false passthrough model with zero backend code change.

## Files modified

| File                                                                                | Change                                                                                                |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pft-rule-checker/src/app/models/accountRuleState.model.ts`                         | +2 lines (48-49): both Number fields, default 0, no index                                             |
| `pft-rule-checker/src/app/models/accountRuleState.interface.ts`                     | +6 lines (108-112): both fields typed `number`, doc-commented                                         |
| `pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts`                 | +Math.max ratchet block after existing peak block (~lines 524-534); +2 lines in `updateFields` $set (672-673); +1 inline comment in payout-reset block (line 1104) |

`grep -n "peakMarginUsedPercent\|currentMarginUsedPercent" …` confirms 6 expected matches in ruleStateService.ts (compute + ratchet + 2× $set + payout-reset comment + previousPeakMargin read), 2 in model.ts, 2 in interface.ts.

## Reset-path audit — peak preservation verified

| File                                                  | peakMarginUsedPercent reset? | Notes                                                                                |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `ruleStateService.ts` payout-reset block (line ~1086) | NO — explicit inline comment "peakMarginUsedPercent is all-time, NOT reset on payout/daily"  |
| `eodService.ts`                                       | NO — grep clean (zero matches); only `peakDailyDrawdownPercent` + `peakTrailingDrawdownPercent` reset at lines 373-374 |
| `dailyResetScheduler.ts`                              | NO — grep clean (zero matches)                                                       |
| `accountRuleState.model.ts` `resetDailyValues` static (Phase 1 + Phase 2 update pipelines) | NO — only resets `peakDailyDrawdownPercent` + `peakTrailingDrawdownPercent` (lines 403-404, 481-482); `peakTotalDrawdownPercent` + `peakMarginUsedPercent` survive |
| `payoutCycleReset.service.ts` (NEW remote file)       | NO — grep clean (zero peak refs)                                                     |

Peak is all-time monotonic across daily reset, EOD, payout, and payout-cycle-reset paths.

## Sanity math (compile-time mental fixtures)

| equity | margin    | expected currentMarginUsedPercent |
| ------ | --------- | --------------------------------- |
| 10000  | 2500      | 25.0                              |
| 10000  | 0         | 0 (margin>0 guard fails)          |
| 10000  | undefined | 0 (typeof check fails)            |
| 0      | 5000      | 0 (equity>0 guard fails)          |
| -100   | 5000      | 0 (equity>0 guard fails)          |

No NaN / Infinity paths.

## Operational notes

- **pft-backend ZERO code change** — confirmed via `grep -n "strict: false" pft-backend/src/app/models/accountRuleState.model.ts` returns `16:const accountRuleStateSchema = new Schema({}, { strict: false });`. New fields surface automatically when rule-checker writes them.
- **Deploy ordering** — rule-checker MUST deploy FIRST. 07-02 dashboard widget will read `peakMarginUsedPercent = 0` until at least one tick of `updateAfterSync` lands post-rollout. No retroactive backfill is in scope.
- **Risk Intelligence backoffice visibility (Bob/ops follow-up)** — making the Risk Intelligence admin page visible to the BackOffice role is a **Super Admin per-brand `pagePermissions` check**, NOT a code change. Lives in `pfr-super-admin` Permissions tab per `reference_page_visibility_permissions.md` memory. Flag for Bob/ops; not blocking deploy.
- **tsc** — clean on all three touched files (project-wide errors unchanged from baseline).

## Commit

`pft-rule-checker` main-2026 `abede27` — `feat(07-01): add current + peak margin used % to accountrulestates`. PUSHED to `origin/main-2026` (`ea8f358..abede27`). NOT deployed.

Pre-edit `git fetch origin main-2026` discovered 7 new remote commits (pay-after-pass Klaviyo work + event-driven V2 + payoutCycleReset.service.ts) since plan-write; fast-forwarded clean before editing per `feedback_rebase_when_remote_already_fixed.md`. New `payoutCycleReset.service.ts` was audited in the reset-path table above (zero peak refs — no conflict).

## Human-verify (DEFERRED — post-deploy)

After main-2026 rule-checker deploys to a brand with live MT5 traffic:
1. Open mongosh to that brand's DB, find a recently-updated `accountrulestates` doc: `db.accountrulestates.findOne({ updatedAt: { $gt: new Date(Date.now() - 60000) } })` — verify both new fields are present and `peakMarginUsedPercent >= currentMarginUsedPercent`.
2. Take a funded account with known open positions, compare `currentMarginUsedPercent` against MT5 terminal's `(margin / equity) * 100` — should match to 1 decimal.
3. Wait for the same account to close all positions → `currentMarginUsedPercent` drops to 0; `peakMarginUsedPercent` stays at the prior high (ratchet preserved).
4. Force a daily reset (or wait for next EOD) → `peakMarginUsedPercent` UNCHANGED.

## Self-Check: PASSED

- Files modified: 3 (confirmed via `git show --stat abede27`)
- Commit `abede27` present on origin/main-2026 (confirmed via push output `ea8f358..abede27`)
- Greps in `eodService.ts` / `dailyResetScheduler.ts` / `payoutCycleReset.service.ts` for `peakMarginUsedPercent` return ZERO matches (peak preserved)
- pft-backend `strict: false` confirmed at line 16
