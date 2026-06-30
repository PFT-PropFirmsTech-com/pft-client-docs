---
phase: 07-used-margin-display
plan: 02
status: BLOCKED
discovered: 2026-06-30
discovered_by: execute-phase (Task 0 audit)
---

# 07-02 BLOCKER — two structural assumptions in the plan do NOT hold

Plan 07-02 declared:
1. `files_modified` = ZERO `pft-backend` files (strict:false passthrough handles the new fields end-to-end).
2. `AccountInfoSection.tsx` is unconditionally rendered by `TradingDashboardShared.tsx` on both client and admin routes, so editing `AccountInfoSection` lights up both surfaces.

Task 0 verification disproves BOTH assumptions. Per plan instructions ("If, at execute time, Task 0 verification shows the dashboard read path does NOT receive the new fields end-to-end, the executor MUST STOP… DO NOT silently add a pft-backend projection extension or any other backend edit"), execution halts here pending revision.

---

## Blocker 1 — backend read paths explicitly whitelist rule-state fields

**Confirmed:** `pft-backend/src/app/models/accountRuleState.model.ts:16`
`const accountRuleStateSchema = new Schema({}, { strict: false });` ✅

`strict: false` on the model alone is NOT sufficient. The dashboard's per-account stats reads pass through code that explicitly `.select({...: 1})` the rule-state shape, which **drops any field not enumerated**.

| File:line | Read mode | Verdict |
| --- | --- | --- |
| `pft-backend/src/app/modules/Statistics/statistics.service.ts:232-255` | `.select({ currentBalance:1, currentEquity:1, balanceAtBreach:1, equityAtBreach:1, highestEquityEver:1, eodHighWatermark:1, tradingDaysCount:1, qualifyingTradingDays:1, minTradingDaysRequired:1, status:1, isBanned:1, accountType:1, breachType:1 })` | **(b) Explicit whitelist — STRIPS new fields.** Used by the dashboard statistics endpoint. |
| `pft-backend/src/app/modules/User/user.service.ts:439-454` | `.find(..., { accountId:1, loginId:1, currentBalance:1, currentEquity:1, balanceAtBreach:1, equityAtBreach:1 }).lean()` | **(b) Explicit whitelist — STRIPS new fields.** Used by `/accounts` overview list. |
| `pft-backend/src/app/modules/AccountStatistics/accountStatistics.service.ts:408-416` | `.findOne({...}).lean()` — pass-through query, BUT… | **(a) Pass-through fetch** — however the assembled response (lines 462-487) returns `accountState / program / rulesEvaluated / tradeHistory` only. `peakMarginUsedPercent` is **never copied to the response object**. UI cannot see it. |
| `pft-backend/src/app/modules/Statistics/statistics.service.ts:51` | `.findOne(buildAccountRuleStateLoginFilter(loginId))` (no `.select` shown) — but cross-check the response shaper | Inspect at revision time; same risk as `accountStatistics` if response object cherry-picks fields. |
| `pft-backend/src/app/modules/Admin/AccountRemediation/account-remediation.service.ts:132` | `.findOne(...).lean()` — read-pass-through | (a) — but this is admin-remediation, not the dashboard widget path. |
| `pft-backend/src/app/modules/Withdrawals/withdrawal.service.ts:466, 507` | `.findOne(...).lean()` — read-pass-through | (a) — withdrawal-eligibility path; not the widget path. |
| `pft-backend/src/app/modules/TradeHistory/tradeHistory.service.ts:27, 338` | `.findOne(...)` / `.find(...)` — pass-through | (a) — trade history; not the widget path. |
| `pft-backend/src/app/modules/Admin/InactivityPolicy/inactivity-*.service.ts:183, 630, 794` | Cron paths — not the dashboard read | n/a |

**Conclusion:** `strict: false` works at the Mongoose document layer, but every dashboard-facing route either `.select()`-whitelists the rule-state fields or cherry-picks them into a response DTO that excludes the new fields. Without a backend edit (extend at least one `.select` projection AND surface the field on at least one response object), `peakMarginUsedPercent` will arrive at the dashboard `undefined` no matter what rule-checker writes.

**Cross-check independent of audit:** `grep -rn "peakTotalDrawdownPercent\|peakMarginUsedPercent" pft-dashboard/src` returns **zero matches**. The dashboard does not currently consume *any* peak field from rule-state. There is no proven passthrough channel to inherit.

### Recommendation for revision

Add to `files_modified` (small, scoped):

- `pft-backend/src/app/modules/AccountStatistics/accountStatistics.service.ts` — extend the response object (lines ~462-487) with `peakMarginUsedPercent` + `currentMarginUsedPercent` cherry-picked from the already-fetched `ruleState`. Single object spread, no schema work, no new route.

  ```typescript
  return {
    account: { ... },
    accountState: { ... },
    program: { ... },
    rulesEvaluated: { ... },
    tradeHistory,
    // NEW (07-02 BLOCKER fix)
    marginUsage: {
      currentMarginUsedPercent: ruleState?.currentMarginUsedPercent ?? null,
      peakMarginUsedPercent: ruleState?.peakMarginUsedPercent ?? null,
    },
  };
  ```

This keeps the backend edit ≈3 lines, no new endpoint, no schema change, no new auth gate.

Alternative: extend the `.select` in `statistics.service.ts:232-253` if that's the route the dashboard actually hits for live rule-state in the widget. Need a one-shot grep at revision time to confirm which endpoint `useTradingDashboardData` is calling for stats vs which surfaces peak fields.

---

## Blocker 2 — `AccountInfoSection.tsx` is currently an ORPHAN — never rendered

Plan 07-02 says (must_haves, line 17): *"Admin account view... shows the SAME widget rendered by the SAME component (TradingDashboardShared → AccountInfoSection) — NO role conditional"*, and Task 2 says *"Open AccountInfoSection.tsx. Locate where ConsistencyScoreCard is rendered inside the section's grid. Add MarginUsageCard adjacent to it"*.

**Evidence the assumption is wrong:**

```
$ grep -rn "<AccountInfoSection" pft-dashboard/src
# (zero matches — no JSX usage)

$ grep -n "AccountInfoSection" pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/TradingDashboardShared.tsx
81:import { AccountInfoSection } from "./AccountInfoSection";
# imported but never rendered

$ grep -n "ConsistencyScoreCard" pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/TradingDashboardShared.tsx
# (zero matches — ConsistencyScoreCard is NOT rendered inside TDS)
```

`AccountInfoSection.tsx` exists in the repo (renders `AccountInfoCard`, `ConsistencyScoreCard`, `AddonsCard` in a 3-column grid), and is `export`-ed from `./index.ts`, but no JSX site mounts it. `TradingDashboardShared.tsx` imports it (line 81) without rendering. Both client `/accounts/[id]/statistics/[mtacc]` and admin `/admin/users/.../account/[accountId]` routes load `TradingDashboardShared`, but TDS renders `CompactInfoCards` (line 2089), not `AccountInfoSection`.

**Implication:** Adding `MarginUsageCard` to `AccountInfoSection.tsx` per the plan as written produces a card that NEVER appears in the running UI. The plan's "single mount lights up both routes" mechanism does not exist today.

### Recommendation for revision

Two options for the planner to pick:

**Option A — mount AccountInfoSection inside TradingDashboardShared.**
Add `<AccountInfoSection currentProgram={...} userData={...} isAdminView={isAdminView} trades={trades} />` to TDS near `CompactInfoCards` (line ~2089). This is what the plan implicitly assumed, but it's a non-trivial surface change: AccountInfoSection adds 3 cards (AccountInfoCard / ConsistencyScoreCard / AddonsCard) that may duplicate cards already on the page via CompactInfoCards. Audit for duplication.

**Option B — bypass AccountInfoSection entirely, mount MarginUsageCard directly in TradingDashboardShared next to CompactInfoCards.**
Cleanest and smallest delta. AccountInfoSection stays orphaned (a pre-existing condition, not introduced by 07-02). MarginUsageCard becomes a direct child of TDS, wired from the same `useTradingDashboardData` hook that TDS already calls. Single source of truth for `accountInfo.margin`/`accountInfo.equity` and the soon-to-be-added rule-state read. Both routes light up because both render TDS.

Option B is the safer revision — it matches the plan's *intent* (one card, one mount, both surfaces) without re-architecting a dead section.

Updated `files_modified` for Option B:
- `pft-dashboard/.../TradingDashboardShared.tsx` (mount + wire data) — REPLACES AccountInfoSection.tsx in scope
- `pft-dashboard/.../MarginUsageCard.tsx` (NEW component — unchanged)
- `pft-dashboard/.../types.ts` (+2 optional fields — unchanged)
- `pft-dashboard/messages/en.json` (5 i18n keys — unchanged)
- `pft-backend/.../accountStatistics.service.ts` (response shape — Blocker 1 fix, +3 lines)

---

## What was NOT done

- Zero files modified (read-only audit only)
- Zero commits, zero pushes
- No `07-02-SUMMARY.md` written
- STATE.md NOT updated (this plan is not complete; defer to revision)

## What IS verified and re-usable post-revision

- `strict: false` on pft-backend confirmed at `accountRuleState.model.ts:16`.
- Read-path inventory (table above) is comprehensive — revision can pick the smallest projection/response-shape edit.
- Orphan status of `AccountInfoSection.tsx` is established and the cleanest mount site is `TradingDashboardShared.tsx` next to `CompactInfoCards`.
- 07-01 persistence backbone is shipped (`pft-rule-checker abede27`) — rule-checker side is correct and will deliver `peakMarginUsedPercent` to Mongo as soon as it deploys. Only the backend read-projection + dashboard mount remain.

## Return to orchestrator

Plan 07-02 needs a revision pass to:
1. Add a ≈3-line `pft-backend/.../accountStatistics.service.ts` response-shape edit (or equivalent projection extension) so the new fields actually traverse to the UI.
2. Pick Option B (or A) for the mount site and update `files_modified` accordingly.

After revision, re-execute. Task 0 audit and read-path inventory above can be cited verbatim — no need to re-grep.
