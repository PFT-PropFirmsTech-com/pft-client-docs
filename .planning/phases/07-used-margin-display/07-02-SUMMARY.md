---
phase: 07-used-margin-display
plan: 02
subsystem: dashboard-widget
tags: [margin-usage, dashboard, trading-cult, risk-monitoring]
status: complete
revision: 1 (Blocker 1+2 resolved post-Task-0 audit)
dependency:
  requires: [07-01]
  provides: [margin-usage-widget]
  affects: [accountStatistics-response, TradingDashboardShared mount]
key-files:
  created:
    - pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/MarginUsageCard.tsx
  modified:
    - pft-backend/src/app/modules/AccountStatistics/accountStatistics.service.ts
    - pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/TradingDashboardShared.tsx
    - pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/types.ts
    - pft-dashboard/messages/en.json
commits:
  - repo: pft-backend
    branch: main-2026
    hash: 1a7aa01e
    pushed: true
  - repo: pft-dashboard
    branch: main-2026
    hash: 1acd03c6
    pushed: true
deploy-ordering: pft-rule-checker (abede27, already shipped) → pft-backend (1a7aa01e) → pft-dashboard (1acd03c6)
human-verify: DEFERRED (matches 04-04 / 05-01 / 06-01 convention — app not deployed)
duration: ~20min
completed: 2026-06-30
---

# Phase 7 Plan 02: Margin Usage Display Widget Summary

Renders MarginUsageCard on both client + admin account routes via single mount inside `TradingDashboardShared.tsx` (next to `CompactInfoCards`); current % from live socket `margin/equity*100`, peak % from `accountrulestates.peakMarginUsedPercent` surfaced via new `marginUsage:{current,peak}` field on accountStatistics response. Closes Trading Cult ticket cmovizb320007qs0k0fue250p.

## Revision History

**Original plan** declared 2 assumptions both disproved by Task 0 audit (documented in `07-02-BLOCKER.md`):

1. **Blocker 1** — `strict:false` passthrough on pft-backend's AccountRuleState model alone is insufficient. `accountStatistics.service.ts:462-487` cherry-picks fields into the response DTO; new fields were silently dropped. Audit also identified `statistics.service.ts:232-255` `.select()` whitelist + `user.service.ts:439-454` `.select()` whitelist as additional drop points (not modified — only the single dashboard read path needed).
2. **Blocker 2** — `AccountInfoSection.tsx` is an ORPHAN: imported at TradingDashboardShared.tsx:81 but never rendered (`grep "<AccountInfoSection" src/` → 0 matches). Plan's "single mount lights up both routes" mechanism did not exist.

**User-approved revisions executed:**
- **Fix 1** → +13 lines on `accountStatistics.service.ts` only (no `statistics.service.ts` or `user.service.ts` edits — single dashboard read path is sufficient; deferred to separate ticket if other surfaces need it later)
- **Fix 2** → mount inside `TradingDashboardShared.tsx` next to `CompactInfoCards` (line ~2089); AccountInfoSection.tsx left orphaned (pre-existing condition, out of scope)

## Read-Path Audit Result

Only `pft-backend/src/app/modules/AccountStatistics/accountStatistics.service.ts` touched. Other read paths deliberately NOT modified:

| File | Mode | Why not touched |
| --- | --- | --- |
| `Statistics/statistics.service.ts:232-255` | (b) explicit `.select()` whitelist | Not the dashboard widget's read path; separate ticket if needed |
| `User/user.service.ts:439-454` | (b) explicit `.select()` whitelist | `/accounts` overview list — not widget read path |
| `AccountStatistics/accountStatistics.service.ts:408-416` | (a) pass-through `.lean()` fetch | **TOUCHED** — response shape (line 462) extended with `marginUsage:{current,peak}` |

Other (a) pass-through paths (`account-remediation.service.ts`, `withdrawal.service.ts`, `tradeHistory.service.ts`) — admin remediation / withdrawals / trade history surfaces, not the dashboard widget.

## What Shipped

**Backend (`1a7aa01e`)** — `accountStatistics.service.ts` `getAccountStatistics` return object now includes:
```typescript
marginUsage: {
  current: typeof ruleState?.currentMarginUsedPercent === "number"
    ? ruleState.currentMarginUsedPercent : null,
  peak: typeof ruleState?.peakMarginUsedPercent === "number"
    ? ruleState.peakMarginUsedPercent : null,
}
```
Null-safe via `typeof` guard — no NaN/Infinity escape. Reads from the already-fetched lean `ruleState` doc (no additional Mongo query). 13 lines added, zero pre-existing tsc errors introduced at touched file.

**Dashboard (`1acd03c6`, 4 files +221/-1):**

- `MarginUsageCard.tsx` (NEW, 173 lines) — div-card shape mirroring `ConsistencyScoreCard`, props `{currentMarginUsedPct: number | null; peakMarginUsedPct: number | null}`, big bold current % (or "—"), color-graded progress bar (emerald <50% / amber 50-80% / red ≥80%), icon flip ShieldCheck → AlertTriangle at ≥80%, Info tooltip explaining "margin / equity × 100" + all-time peak semantics. `useMemo`-wrapped rating computation — `Number.isFinite` guard plus `>=0` check on current and `>0` check on peak so 0/null both render "—". `Math.max(0, Math.min(100, pct))` clamp on bar width — never overflows.

- `TradingDashboardShared.tsx` — `import MarginUsageCard from "./MarginUsageCard"` at line 90. New `<section className="mb-8">` inserted ABOVE the existing CompactInfoCards section (line ~2089), mounting the card unconditionally (no `isAdminView` branch). Wires:
  - `currentMarginUsedPct` = `accountInfo.margin / accountInfo.equity * 100` (NOT `accountInfo.marginLevel` — inverse, RESEARCH §Pitfall 1) — uses `typeof === "number" && > 0` guards on both legs → null otherwise
  - `peakMarginUsedPct` = `statisticsDataFromHook.marginUsage.peak` (typed via `(as any)` cast because the hook's `data` is typed `any` — the response shape contract is documented in `types.ts` MarginUsageDTO) — `> 0` guard so unseeded value (0) renders "—"

- `types.ts` — new `MarginUsageDTO` interface documenting the backend response contract (`{current: number | null; peak: number | null}`).

- `messages/en.json` — 5 i18n keys under `dashboard.programDetails.marginUsage`: title / current / peak / tooltip / noPositions.

**Untouched (deliberate):**
- `pft-rule-checker` — 07-01 (`abede27`) already shipped + pushed; persistence backbone in place.
- `pft-backend/Statistics/statistics.service.ts` + `User/user.service.ts` — explicit `.select()` whitelists that would also strip the new fields, but they aren't the widget's read path. Separate ticket if needed.
- `pft-dashboard/AccountInfoSection.tsx` — orphan (pre-existing), not introduced by 07-02; left alone.
- `pfr-super-admin` — Risk Intelligence backoffice page visibility is per-brand `pagePermissions` config (operational, see follow-up).

## Self-Check

Verified post-edit:
- `grep "marginUsage" pft-backend/.../accountStatistics.service.ts` → 1 hit (the new field)
- `grep "<MarginUsageCard" pft-dashboard/.../TradingDashboardShared.tsx` → mounted at line 2095
- `grep "accountInfo.margin" pft-dashboard/.../TradingDashboardShared.tsx` → margin/equity*100 computation present
- `grep "marginLevel" pft-dashboard/.../TradingDashboardShared.tsx` → no NEW uses (only any pre-existing); the new wiring uses `accountInfo.margin / accountInfo.equity * 100`
- `grep "<AccountInfoSection" pft-dashboard/src/` → 0 matches (orphan untouched, as intended)
- `grep "marginUsage" pft-dashboard/.../types.ts` → MarginUsageDTO defined
- `grep "marginUsage" pft-dashboard/messages/en.json` → 5 keys present
- tsc scoped on touched files → 0 new errors (pre-existing baseline preserved)
- Pre-edit `git fetch origin main-2026` discovered 1 incoming pft-backend commit (`6689f3d1` — Klaviyo PAP-recovery event-tracking), no overlap with target file, fast-forwarded clean. Dashboard already up to date.

## Self-Check: PASSED

## Deploy Ordering

1. **pft-rule-checker** main-2026 `abede27` — ALREADY PUSHED (07-01). Required to seed `currentMarginUsedPercent` + `peakMarginUsedPercent` on accountrulestates per tick. Without this, backend `marginUsage.peak` returns null and the card shows "—" indefinitely.
2. **pft-backend** main-2026 `1a7aa01e` — exposes `marginUsage:{current,peak}` on `getAccountStatistics` response.
3. **pft-dashboard** main-2026 `1acd03c6` — renders MarginUsageCard, reads from the new backend field for peak + live socket for current.

**Strict order:** rule-checker → backend → dashboard. Reverse order produces "—" until backend catches up.

## Post-Deploy Human-Verify (DEFERRED)

Matches 04-04 / 05-01 / 06-01 convention — app not deployed; verification deferred to post-deploy. Resume signal: pick an active Trading Cult MT5 account with open positions.

**Client route (`/accounts/{userId}/statistics/{mtacc}`):**
- [ ] MarginUsageCard renders above CompactInfoCards
- [ ] Current % updates live as positions change (open small position, watch bar move)
- [ ] Tooltip on Info icon explains "margin / equity × 100" + "peak is all-time"
- [ ] With NO positions open: card shows "—" (not "0.0%", not "NaN%")

**Admin route (`/admin/users/{userId}/programs/{programId}/account/{mtacc}`):**
- [ ] SAME MarginUsageCard renders identically (same colors, same position, same tooltip)
- [ ] No admin/client divergence in the card itself

**Peak ratchet:**
- [ ] Open larger position so current exceeds previous peak; refresh page; peak updates to new high
- [ ] Close all positions; peak STAYS at higher value (peak is all-time, NOT reset)
- [ ] Next daily reset / EOD; peak UNCHANGED (07-01 audit confirms: not in eodService, dailyResetScheduler, resetDailyValues, or payoutCycleReset)

**Edge cases:**
- [ ] Account with zero open positions: card shows "—" + "—"
- [ ] Fresh account after deploy (no peak history): peak shows "—" until first tick

**Bug signatures to flag if seen:**
- Current % wrong direction (e.g. shows 350% when expected ~5%) → marginLevel/marginUsed flip, RESEARCH §Pitfall 1
- Peak resets to 0 on daily/EOD → 07-01 reset audit gap
- NaN%, Infinity%, "0.0%" when "—" expected → guard regression
- Visual difference between client and admin views → role-conditional regression

After verify passes: screenshot + post to ticket cmovizb320007qs0k0fue250p → set WAITING_CLIENT.

## Operational Follow-up (NOT a code task — flag to Bob)

Trading Cult's Super Admin per-brand `pagePermissions` for `/admin/risk-intelligence/*`, `/admin/users/suspicious-accounts`, `/admin/users/fraud-check` must permit the `backOffice` role. If backoffice users can't see Risk Intelligence in the sidebar despite the code allowing it, this Super Admin config is the cause (per `reference_page_visibility_permissions.md` memory, RESEARCH §Pitfall 5). NO code change here — Super Admin Permissions tab only.

## Historical Reference

`07-02-BLOCKER.md` kept in place for historical reference — documents the Task 0 audit that triggered this revision. Do NOT delete.

## Decisions

- **Single backend read path extended** — `accountStatistics.service.ts` only. `statistics.service.ts` + `user.service.ts` `.select()` whitelists left alone (separate ticket if/when those surfaces need margin fields). Smallest possible blast radius.
- **Mount in TradingDashboardShared, not AccountInfoSection** — AccountInfoSection is orphan; resurrecting it would duplicate cards already rendered via CompactInfoCards. Direct mount keeps the delta minimal.
- **`> 0` guard on peak** — distinguishes "rule-checker hasn't ticked yet post-07-01-deploy" (renders "—") from "current 0% is genuinely 0" (renders 0.0% only when current itself is non-null). Defensive against the fresh-account case.
- **No new pft-backend deploy bypass possible** — rule-checker → backend → dashboard order is strict. Reverse order = "—" everywhere.
