---
phase: 07-used-margin-display
verified: 2026-06-30T00:00:00Z
status: human_needed
score: 10/10 static must-haves verified (live render deferred)
human_verification:
  - test: "Client route MarginUsageCard renders"
    expected: "Visit /accounts/{userId}/statistics/{mtacc} on Trading Cult; MarginUsageCard renders above CompactInfoCards with live current % updating as positions change."
    why_human: "Live socket cadence + visual render — requires deployed app + active MT5 account."
  - test: "Admin route MarginUsageCard renders identically"
    expected: "Visit /admin/users/{userId}/programs/{programId}/account/{mtacc}; same card, same colors, same tooltip — no role divergence."
    why_human: "Visual parity between two surfaces requires human eyes."
  - test: "Peak ratchets across daily/EOD reset"
    expected: "Open position pushing current past prior peak → peak updates. Close positions → peak stays. Next EOD → peak unchanged."
    why_human: "Multi-day live observation; not statically verifiable."
  - test: "Edge cases render '—' not garbage"
    expected: "No-positions account: current '—' + peak '—'. Fresh account: peak '—' until first tick. Never NaN/Infinity/0.0%."
    why_human: "Live rendering on a real account."
  - test: "Bob/ops Super Admin pagePermissions for Risk Intelligence (backOffice role)"
    expected: "Operational config audit per reference_page_visibility_permissions.md — not a code change."
    why_human: "Out-of-band ops task; flagged separately."
---

# Phase 7: Used-Margin Display Verification Report

**Phase Goal:** Surface CURRENT used-margin % (margin/equity*100, NOT marginLevel) and ALL-TIME PEAK used-margin % on both client trader and admin/backoffice account views via a single component (no role conditional). Help Trading Cult catch "all-in" trading before breaches.

**Verified:** 2026-06-30
**Status:** human_needed (all static checks pass; live render deferred until next deploy — matches 04-04 / 05-01 / 04.1-01 / 06-01 convention)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | accountrulestates carries currentMarginUsedPercent + peakMarginUsedPercent (Number, default 0) | VERIFIED | model.ts:48-49; interface.ts:109,112 |
| 2   | Per-tick Math.max ratchet writes both fields with margin/equity*100 denominator | VERIFIED | ruleStateService.ts:524-534; downstream $set at 672-673 |
| 3   | Edge cases (equity<=0, missing margin) return 0 — no NaN/Infinity | VERIFIED | ruleStateService.ts:529-532 — guards `currentEquity > 0 && typeof marginValue === "number" && marginValue > 0` |
| 4   | Peak preserved on payout/daily/EOD reset paths | VERIFIED | grep clean: eodService.ts 0 matches, dailyResetScheduler.ts 0 matches, payoutCycleReset.service.ts 0 matches; ruleStateService.ts:1104 explicit comment in payout-reset block |
| 5   | pft-backend accountStatistics response carries marginUsage:{current,peak} with null fallbacks reading from lean ruleState | VERIFIED | accountStatistics.service.ts:485-499 — `typeof === "number"` guard, null fallback |
| 6   | MarginUsageCard renders current/peak with thresholds <50/50-80/>=80 and "—" for nulls | VERIFIED | MarginUsageCard.tsx: 174 lines; safeCurrent/safePeak null branches lines 32-43; thresholds lines 45-55; "—" labels lines 60-61 |
| 7   | NO role conditional in MarginUsageCard | VERIFIED | grep MarginUsageCard.tsx — no isAdmin/role/userRole reference |
| 8   | Card mounted ONCE in TradingDashboardShared (NOT AccountInfoSection orphan) | VERIFIED | TradingDashboardShared.tsx:90 import + 2095 single render; AccountInfoSection.tsx — 0 MarginUsageCard refs (orphan untouched) |
| 9   | Wiring uses margin/equity*100, NOT marginLevel | VERIFIED | TradingDashboardShared.tsx:2102 `(accountInfo.margin / accountInfo.equity) * 100`; no `marginLevel` reference in margin-usage block |
| 10  | Same widget on both client + admin routes via shared component | VERIFIED | TradingDashboardShared imported by both `/accounts/[id]/statistics/[mtacc]/page.tsx` and `/admin/users/[id]/programs/[programId]/account/[accountId]/page.tsx` |

**Score:** 10/10 static truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `pft-rule-checker/src/app/models/accountRuleState.model.ts` | 2 new Number fields default 0 | VERIFIED | Lines 48-49 |
| `pft-rule-checker/src/app/models/accountRuleState.interface.ts` | 2 new `number` fields | VERIFIED | Lines 109, 112 |
| `pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts` | Math.max ratchet + $set inclusion + payout-reset comment | VERIFIED | Lines 524-534 (compute), 672-673 ($set), 1104 (comment) |
| `pft-backend/src/app/modules/AccountStatistics/accountStatistics.service.ts` | marginUsage:{current,peak} on response | VERIFIED | Lines 485-499 |
| `pft-dashboard/.../programs-details/MarginUsageCard.tsx` | New 40+ line component with null-safe render | VERIFIED | 174 lines; props match; tooltip; thresholds; no role gating |
| `pft-dashboard/.../programs-details/TradingDashboardShared.tsx` | Single mount; no role conditional; margin/equity*100 | VERIFIED | Import line 90; render lines 2095-2111 |
| `pft-dashboard/.../programs-details/types.ts` | MarginUsageDTO defined | VERIFIED | Lines 138-148 |
| `pft-dashboard/messages/en.json` | 5 keys under marginUsage namespace | VERIFIED | Lines 1962-1968 (title, current, peak, tooltip, noPositions) |
| `pft-dashboard/.../programs-details/AccountInfoSection.tsx` (orphan) | No MarginUsageCard reference (correct — file remains orphan) | VERIFIED | grep returns 0 matches; AccountInfoSection unused in src/ (pre-existing orphan, untouched) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| ruleStateService tick block | accountrulestates `$set` | Same write path as peakTotalDrawdownPercent | WIRED | Lines 672-673 include both new fields in `updateFields` $set |
| accountStatistics.service.ts | lean ruleState doc → response.marginUsage | typeof guard + null fallback | WIRED | Lines 490-499 |
| TradingDashboardShared | accountInfo socket | margin/equity*100 with `typeof` + `> 0` guards | WIRED | Lines 2096-2104 |
| TradingDashboardShared | statisticsDataFromHook.marginUsage.peak | `(as any)` cast + `> 0` guard | WIRED | Lines 2105-2110 |
| Client route | TradingDashboardShared | dynamic import | WIRED | accounts/[id]/statistics/[mtacc]/page.tsx:10,48 |
| Admin route | TradingDashboardShared | dynamic import | WIRED | admin/users/[id]/programs/[programId]/account/[accountId]/page.tsx:9,50 |

### Commit Verification

| Repo | Branch | Expected | Actual | Status |
| ---- | ------ | -------- | ------ | ------ |
| pft-rule-checker | main-2026 | abede27 | abede27 | MATCH |
| pft-backend | main-2026 | 1a7aa01e | 1a7aa01e | MATCH |
| pft-dashboard | main-2026 | 1acd03c6 | 1acd03c6 | MATCH |

### Anti-Patterns Found

None. MarginUsageCard has explicit null/NaN/Infinity guards (Number.isFinite + typeof checks); no TODO/FIXME; no console.log-only handlers; no placeholder returns.

### Human Verification Required

Five items in frontmatter: client-route render, admin-route render parity, peak ratchet across EOD, edge-case rendering, and Bob/ops Super Admin pagePermissions audit. All require live deployment + active MT5 account.

### Gaps Summary

No automated gaps detected. All 10 observable truths satisfied by static code inspection. Three commits land cleanly on main-2026 across pft-rule-checker, pft-backend, pft-dashboard. The remaining open item is post-deploy human verification on a live Trading Cult MT5 account with open positions — matches the deferred-human-verify convention used for 04-04 / 05-01 / 04.1-01 / 06-01.

Notes:
- AccountInfoSection.tsx remains an orphan (pre-existing condition acknowledged in 07-02 BLOCKER and SUMMARY). Not introduced by Phase 7 and out of scope.
- statistics.service.ts + user.service.ts retain `.select()` whitelists that would strip the new fields — deliberately not modified per the locked single-read-path decision; deferred to a separate ticket if/when those surfaces need margin-usage.
- Risk Intelligence backoffice page visibility is per-brand Super Admin pagePermissions config (per reference_page_visibility_permissions.md memory) — flagged for Bob/ops, not a code task.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
