# Phase 7: Used Margin Display — Client + Backoffice — Research

**Researched:** 2026-06-30
**Domain:** pft-rule-checker margin pipeline + pft-dashboard TradingDashboardShared widget + accountrulestates peak-tracking + Risk Intelligence pagePermissions
**Confidence:** HIGH
**Source ticket:** cmovizb320007qs0k0fue250p (Trading Cult)

## Summary

The margin pipeline already exists end-to-end **except for persistence of a historical peak**. MT5 broker returns `Margin / MarginFree / MarginLevel` on every account-info poll; pft-rule-checker parses them in `mt5.service.ts` and pft-backend's `mt5.service.ts`. The rule-checker `batchSnapshotService` caches `margin` and `marginFree` per account in memory and emits an `accountInfo` socket event to dashboard viewers with `{ balance, equity, profit, margin, marginFree }` (and the cache computes `marginLevel = equity / margin * 100`). The dashboard `useAccountSnapshot` hook consumes that event, `useTradingDashboardData` exposes `accountInfo`, and `programs-details/types.ts` already types `AccountInfo.margin / freeMargin / marginLevel` — the field just isn't rendered anywhere in the UI.

The same `TradingDashboardShared.tsx` component renders both surfaces — client portal at `/accounts/[id]/statistics/[mtacc]` and admin/backoffice at `/admin/users/[id]/programs/[programId]/account/[accountId]`. **Adding one widget to TradingDashboardShared automatically lights up both client AND backoffice views.** No separate component, no role conditional needed.

The "historical peak margin used %" requirement is the only piece without infrastructure. The cleanest path is to extend `accountrulestates` (in pft-rule-checker, the same collection that already stores `highestEquityEver`, `peakDailyDrawdownPercent`, `peakTotalDrawdownPercent`, `peakTrailingDrawdownPercent`) with `currentMarginUsedPercent` and `peakMarginUsedPercent`, updated in the exact same code site where the other peak metrics are computed (`ruleStateService.ts` ~line 504). pft-backend already has a `strict: false` pass-through `AccountRuleState` model so the new fields are readable by the dashboard with zero backend schema work.

Bob's "enable for backoffice role" ask is more nuanced than the ticket implies: the **Risk Intelligence sidebar group is ALREADY gated `[admin, backOffice]`** in both `pft-dashboard/src/lib/config/sidebar-config.tsx` (line 370) and `pfr-super-admin/lib/sidebar-routes.ts` (line 189). The most likely cause TC's backoffice users can't see it is a per-brand `pagePermissions` override in Super Admin (NextStageFunded / Trading Cult brand config) restricting `/admin/risk*` paths. **This is a Super Admin config tweak per-brand, not a code change.** First check `pagePermissions` for the Trading Cult brand before touching code.

**Primary recommendation:** One backend extension in pft-rule-checker (extend accountrulestates schema + populate in ruleStateService) + one widget in `TradingDashboardShared.tsx` (renders peak from accountrulestates + current from live socket `accountInfo.marginLevel`) + per-brand Super Admin pagePermissions check (no code) for the role visibility. Single phase, 2-3 tasks.

## Standard Stack

### Core (all already installed — zero new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mongoose` | already in pft-rule-checker | Extend `accountrulestates` schema + write new fields in `ruleStateService.updateRuleStateRT` | Same model already holds peakDailyDrawdownPercent / peakTotalDrawdownPercent — perfect parallel |
| `socket.io-client` via `useAccountSnapshot` | already in pft-dashboard | Live `accountInfo.margin / marginFree` already delivered to client | No new socket plumbing |
| `@tanstack/react-query` | already in pft-dashboard | Fetch persisted `peakMarginUsedPercent` from a small backend read endpoint | Matches Phase 6 sidebar-pending pattern + every other admin read |
| `lucide-react` icons (existing) | already in pft-dashboard | Gauge / progress visual | Existing `Activity`, `ShieldCheck`, `AlertTriangle` already imported in TDS |
| Tailwind utility classes + existing UI primitives (`Card`, `Progress`) | already in pft-dashboard | Visual rendering | Matches CompactInfoCards / ConsistencyScoreCard style |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `@/components/ui/progress` (shadcn) | already in repo | Linear progress bar for margin % gauge | Bar (0–100%) is cheaper than a radial gauge and matches ConsistencyScoreCard style |
| Optional: `recharts` (already imported in DailyBalanceChart) | already in repo | If a small radial/gauge visual is desired | Only if linear bar is judged insufficiently "graphical" |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend `accountrulestates` schema | New `marginSnapshots` collection / extend `highestequities` | New collection = new index + cron + cleanup; `highestequities` exists but is per-day equity-only and would need cron coupling. Extending the already-updated accountrulestates document costs **one extra `$max` write per existing tick** — no cron, no new writer. |
| Persist peak in pft-rule-checker | Persist peak in pft-backend cron | rule-checker already touches the document every tick with `peakDailyDrawdownPercent`; pft-backend cron would mean a second writer with race conditions. |
| Custom radial gauge widget | shadcn `Progress` bar + bold % label | Radial = more "graphical" but bigger UI surface to maintain; bar matches ConsistencyScoreCard cell footprint exactly and is good enough for Trading Cult's stated need. |
| Add margin% to `dailysnapshots` for time-series | Out of scope per phase context | Out of scope — only current + peak needed. |
| pft-backend re-poll MT5 for margin on each dashboard request | Read live margin from rule-checker socket (already delivered) | Backend re-poll = stale or expensive REST calls to MT5 VPS; socket path is already paid for. |

**Installation:** No new dependencies.

## Architecture Patterns

### Recommended Data Flow

```
MT5 broker (Windows VPS 135.181.60.227:50XX)
   │  Margin / MarginFree / MarginLevel fields on user-info polls
   ▼
pft-rule-checker mt5.service.ts (parses)
   │
   ├─► batchSnapshotService.updateAccountData({ margin, marginFree })
   │       │   (in-memory cache; computes marginLevel = equity / margin * 100)
   │       ▼
   │   socketService.emit("accountInfo", { ..., margin, marginFree })   ──► useAccountSnapshot (dashboard) ──► accountInfo.margin / marginLevel  ◄── CURRENT %
   │
   └─► ruleStateService.updateRuleStateRT (existing peak computation site, ~line 504)
           │   const currentMarginUsedPercent = equity > 0 ? (margin / equity) * 100 : 0
           │   const peakMarginUsedPercent = Math.max(state.peakMarginUsedPercent || 0, currentMarginUsedPercent)
           ▼
       accountrulestates.{ currentMarginUsedPercent, peakMarginUsedPercent }  (Mongo $max-style write, same tick as peakDailyDrawdownPercent)
                  │
                  ▼
       pft-backend GET /accounts/:loginId/margin-snapshot  ──► useQuery (dashboard) ──► peakMarginUsedPercent  ◄── PEAK %
```

### Recommended UI Placement

`TradingDashboardShared.tsx` already imports `CompactInfoCards`, `CompactObjectivesGrid`, `CompactStatusCard`. Add `MarginUsageCard` (new) next to `ConsistencyScoreCard` inside `AccountInfoSection.tsx`'s 3-column grid OR as a fourth `CompactInfoCard` cell, whichever the planner prefers. Same component renders for both client (`/accounts/[id]/statistics/[mtacc]`) and admin (`/admin/users/.../account/[accountId]`) — single edit covers both surfaces.

### Pattern 1: Adding a Peak Metric to accountrulestates
**What:** Add new fields next to existing peak metrics, update in the same tick site.
**When to use:** Any "highest X seen ever" requirement on a live MT5 account.
**Example:**
```typescript
// pft-rule-checker/src/app/models/accountRuleState.model.ts (add to schema, line ~46-47 area)
peakDailyDrawdownPercent: { type: Number, default: 0 },
peakTotalDrawdownPercent: { type: Number, default: 0 },
peakMarginUsedPercent: { type: Number, default: 0 },        // NEW
currentMarginUsedPercent: { type: Number, default: 0 },     // NEW

// pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts ~line 504
const previousPeakDaily = (state as any).peakDailyDrawdownPercent || 0;
const previousPeakTotal = (state as any).peakTotalDrawdownPercent || 0;
const previousPeakMargin = (state as any).peakMarginUsedPercent || 0;       // NEW
const currentMarginUsedPercent =                                             // NEW
  currentEquity > 0 && typeof currentMargin === "number"
    ? (currentMargin / currentEquity) * 100
    : 0;
const peakMarginUsedPercent = Math.max(previousPeakMargin, currentMarginUsedPercent);
```

### Pattern 2: Reading Live Margin in the Widget
**What:** Margin data is already on `accountInfo.margin / marginFree / marginLevel` from `useTradingDashboardData()`.
**When to use:** Any client/admin widget that needs current margin %.
**Example:**
```typescript
// Inside TradingDashboardShared / a child:
const { accountInfo } = useTradingDashboardData(...);
const currentMarginLevelPct = accountInfo?.marginLevel ?? 0;  // already pre-computed in batch-snapshot.service.ts:1305

// Ticket asks for "margin used %": that is margin/equity * 100 (inverse of marginLevel for >0 case)
const currentMarginUsedPct =
  accountInfo?.equity && accountInfo.equity > 0 && accountInfo.margin
    ? (accountInfo.margin / accountInfo.equity) * 100
    : 0;
```
**Important:** `marginLevel` in MT5 convention is `equity / margin * 100` (a *safety* indicator, higher = safer). The ticket asks for "margin used %" which is `margin / equity * 100` (higher = more leverage utilized). Use the latter. Show "—" when there are no open positions (margin = 0).

### Pattern 3: Reading Persisted Peak From accountrulestates
**What:** pft-backend already has a pass-through `AccountRuleState` model with `strict: false` — new fields readable without schema change.
**When to use:** Any cross-service read of a rule-checker-maintained field.
**Example:**
```typescript
// pft-backend new lightweight route, mirrors existing admin reads
// src/app/modules/AccountOverview/...marginSnapshot.controller.ts
const ruleState = await AccountRuleState.findOne(
  { $or: [{ accountId: loginId }, { loginId }] },
  { peakMarginUsedPercent: 1, currentMarginUsedPercent: 1, updatedAt: 1 }
).lean();

res.json({
  peakMarginUsedPercent: ruleState?.peakMarginUsedPercent ?? 0,
  currentMarginUsedPercentAtRest: ruleState?.currentMarginUsedPercent ?? 0,
  lastUpdatedAt: ruleState?.updatedAt,
});
```

### Anti-Patterns to Avoid
- **Polling MT5 REST API from pft-backend on every dashboard request:** Wasteful and slow. Socket-pushed `accountInfo` already has margin/marginFree.
- **Creating a new `marginSnapshots` collection + cron:** Unnecessary. The peak update is a `Math.max` against an in-document value updated every existing tick. No new writer, no new cron.
- **Adding the widget to a different component for admin vs client:** They use the same `TradingDashboardShared` — duplication is a bug magnet.
- **Treating `marginLevel` and "margin used %" as the same number:** Inverses. Document which one the UI shows.
- **Touching dashboard sidebar role config to "enable Risk Intelligence for backoffice":** It's already enabled there. Check Super Admin per-brand `pagePermissions` first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live margin streaming | New WebSocket emit | Existing `accountInfo` socket event in `websocket-stream-bridge.ts:707` already includes `margin / marginFree` | All wiring exists; dashboard already deserializes |
| Peak tracking persistence | New collection + cron | Extend `accountrulestates` with two fields; update inside `ruleStateService.updateRuleStateRT` `Math.max(...)` block | Existing peak fields (drawdown) prove the pattern + cadence |
| Backend schema for new fields | Strict `AccountRuleStateSchema` extension in pft-backend | Existing `accountRuleStateSchema = new Schema({}, { strict: false })` in `pft-backend/src/app/models/accountRuleState.model.ts` | Already a pass-through — new rule-checker fields readable immediately |
| Progress bar UI | Custom SVG gauge | shadcn `Progress` + Tailwind + an `AlertTriangle` color flip at >80% | Matches ConsistencyScoreCard look and feel exactly |
| Sidebar role visibility | New code | Super Admin `pagePermissions` per-brand check first | Already coded `[admin, backOffice]` in sidebar config |

**Key insight:** Every wire from MT5 → dashboard for margin data already exists. The only gap is two new fields in one Mongo collection and one new card component.

## Common Pitfalls

### Pitfall 1: marginLevel vs marginUsed semantic flip
**What goes wrong:** Display shows "Margin Used: 350%" because someone copied `accountInfo.marginLevel` straight through.
**Why it happens:** MT5 `MarginLevel = Equity / Margin * 100` (a *safety* number — typical healthy account 200%+). Ticket asks for the *inverse*: `Margin / Equity * 100` (how much of your equity is locked as margin — higher = more leveraged).
**How to avoid:** Compute `marginUsedPct = (margin / equity) * 100` explicitly in the widget. Add a Storybook fixture or unit test verifying the math direction. Document in the PR.
**Warning signs:** Number > 100% in non-leveraged scenarios, or QA seeing 500% when they expect ~5%.

### Pitfall 2: Zero margin / zero equity edge cases
**What goes wrong:** `NaN` or `Infinity` rendered when there are no open positions (margin = 0) or freshly created account (equity = 0).
**Why it happens:** Division by zero in `margin / equity * 100`.
**How to avoid:** Guard with `equity > 0` before division; render `"—"` or `"0.0%"` for the no-positions case. Match the convention already in `batch-snapshot.service.ts:1305` (`account.margin > 0 ? ... : 0`).

### Pitfall 3: Stale peak after archive / reassignment
**What goes wrong:** Account is reassigned to a new MT5 login (or daily reset / EOD), but `peakMarginUsedPercent` carries over from the old life. Or worse: phase progression (phase1 → phase2 → funded) creates a new account but inherits an old peak.
**Why it happens:** `accountrulestates` docs are per `accountId / loginId`. Reassignment creates a new doc (so historical peak is naturally lost) BUT EOD/daily-reset paths in `eodService.ts:373` zero out `peakDailyDrawdownPercent` — they must NOT zero `peakMarginUsedPercent` (it's an all-time / per-life metric, not daily).
**How to avoid:** When extending `eodService.ts` EOD reset and `GlobalBatchScheduler.ts:994` reset paths, explicitly DO NOT reset `peakMarginUsedPercent`. Reset only on archive/new-account creation, which already produces a fresh document.
**Warning signs:** Phase-progressed account starts with non-zero peak from day 1.

### Pitfall 4: pft-rule-checker change requires separate deploy
**What goes wrong:** Backend route shipped; dashboard widget shipped; peak still reads as 0 because rule-checker hasn't been redeployed.
**Why it happens:** pft-rule-checker is a separate service from pft-backend (different repo, different deploy). The schema add + update logic lives there.
**How to avoid:** Coordinate deploys: rule-checker first (so peak starts populating), then backend route, then dashboard. Verification step: confirm `accountrulestates.peakMarginUsedPercent` is non-zero for at least one live account on Trading Cult before declaring done.
**Warning signs:** Dashboard shows current margin correctly but peak is always 0.0%.

### Pitfall 5: "Enable for backoffice" assumed to be code
**What goes wrong:** Engineer changes `roles: [ROLES.admin]` to `[ROLES.admin, ROLES.backOffice]` in `sidebar-config.tsx` — except it was already that way.
**Why it happens:** Bob's ticket phrasing implies code change; reality is a per-brand Super Admin `pagePermissions` override blocking backoffice on Trading Cult.
**How to avoid:** Before any code change, log into Super Admin → Trading Cult brand → Permissions tab → search for `/admin/risk*`, `/admin/symbol-*`, `/admin/payout-risk`, `/admin/users/suspicious-accounts`, `/admin/users/fraud-check` rules and verify `backOffice` is in `allowedRoles`. The middleware.ts `pagePermissions` enforcement at `pft-dashboard/src/middleware.ts:511` is what actually gates the route at runtime.
**Warning signs:** Sidebar items show in dev for admin but vanish for backoffice in TC prod even though `sidebar-config.tsx` lists both roles.

### Pitfall 6: Reading `accountInfo` from MongoDB cache vs live socket
**What goes wrong:** Widget reads from `AccountOverview` (which has no margin field) or from `mt5AccountInfo` (SDK fallback only when websockets disabled) and gets `undefined`.
**Why it happens:** `useTradingDashboardData.ts:1352-1367` has two branches: `useSDKData` (REST) vs websocket. Widget must read post-merge `accountInfo`, not either source individually.
**How to avoid:** Read `accountInfo.margin` / `accountInfo.equity` / `accountInfo.marginLevel` from the merged value returned by the hook. Already correct typing in `programs-details/types.ts:97-99`.

## Code Examples

### Example 1: Current Margin Used % (from already-delivered socket data)
```typescript
// pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/MarginUsageCard.tsx (NEW)
"use client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface Props {
  margin?: number;
  equity?: number;
  peakMarginUsedPercent?: number;  // from useQuery against new backend route
}

export default function MarginUsageCard({ margin, equity, peakMarginUsedPercent }: Props) {
  const currentPct =
    typeof margin === "number" && typeof equity === "number" && equity > 0
      ? Math.min((margin / equity) * 100, 100)
      : 0;

  const hasOpen = typeof margin === "number" && margin > 0;
  const isHigh = currentPct > 70;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        {isHigh ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
        <h3 className="text-sm font-semibold text-adaptive-primary">Margin Usage</h3>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-adaptive-muted">Current</span>
            <span className="text-2xl font-bold text-adaptive-primary">
              {hasOpen ? `${currentPct.toFixed(1)}%` : "—"}
            </span>
          </div>
          <Progress value={currentPct} className={isHigh ? "[&>div]:bg-amber-500" : ""} />
        </div>
        <div className="flex items-baseline justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-adaptive-muted">All-time peak</span>
          <span className="text-sm font-semibold text-adaptive-primary">
            {peakMarginUsedPercent != null ? `${peakMarginUsedPercent.toFixed(1)}%` : "—"}
          </span>
        </div>
      </div>
    </Card>
  );
}
```

### Example 2: Backend Read Endpoint (pft-backend, strict:false model)
```typescript
// pft-backend/src/app/modules/Account/marginSnapshot.controller.ts (or extend Statistics module)
import AccountRuleState from "../../models/accountRuleState.model";

export const getMarginSnapshot = catchAsync(async (req, res) => {
  const { loginId } = req.params;
  const doc: any = await AccountRuleState.findOne(
    { $or: [{ accountId: loginId }, { loginId }] },
    { peakMarginUsedPercent: 1, currentMarginUsedPercent: 1, updatedAt: 1 },
  ).lean();
  res.json({
    peakMarginUsedPercent: doc?.peakMarginUsedPercent ?? 0,
    currentMarginUsedPercentAtRest: doc?.currentMarginUsedPercent ?? 0,
    lastUpdatedAt: doc?.updatedAt,
  });
});
```
Route: `GET /accounts/:loginId/margin-snapshot`, gated `Auth(userRole.user, userRole.admin, userRole.backOffice)` (user gets own account; ownership check matches existing per-account stats routes).

### Example 3: Peak Tracking in pft-rule-checker
```typescript
// pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts ~line 504 area
const previousPeakMargin = (state as any).peakMarginUsedPercent || 0;
const liveMargin = (state as any).currentMargin ?? 0;   // see schema + persistLiveAccountMetrics below
const currentMarginUsedPercent =
  currentEquity > 0 && liveMargin > 0 ? (liveMargin / currentEquity) * 100 : 0;
const peakMarginUsedPercent = Math.max(previousPeakMargin, currentMarginUsedPercent);

if (currentMarginUsedPercent > previousPeakMargin && currentMarginUsedPercent > 0) {
  logger.info(
    `[RuleState] ${accountId}: NEW PEAK margin used: ${currentMarginUsedPercent.toFixed(3)}% (prev: ${previousPeakMargin.toFixed(3)}%)`,
  );
}

// In the $set object that persists ruleState:
const set = {
  ...,
  currentMarginUsedPercent,
  peakMarginUsedPercent,
};
```

Also extend `persistLiveAccountMetrics` (`pft-rule-checker/src/app/services/broker/liveAccountMetrics.service.ts:39`) to write `currentMargin` into the document so `ruleStateService` can read it on the next tick — currently `margin` only lives in the in-memory `batchSnapshotService` cache, not on `accountrulestates`:

```typescript
// Add to set object in liveAccountMetrics.service.ts:35
if (typeof metrics.margin === "number" && Number.isFinite(metrics.margin)) {
  set.currentMargin = metrics.margin;
}
if (typeof metrics.marginFree === "number" && Number.isFinite(metrics.marginFree)) {
  set.currentMarginFree = metrics.marginFree;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Margin only in-memory in `batchSnapshotService` cache | Persist `currentMargin / peakMarginUsedPercent` to `accountrulestates` | This phase | Margin data survives rule-checker restarts; queryable from backend |
| Risk Intelligence routes assumed admin-only | Already gated `[admin, backOffice]` in both sidebar configs | Pre-existing | Per-brand `pagePermissions` may still block — that's the actual lever |
| Custom polling of MT5 REST API for live values | Socket-pushed `accountInfo` event from rule-checker bridge | Pre-existing | Widget reads from `useTradingDashboardData` hook; no extra polling |

**Deprecated/outdated:** none directly relevant. The existing `marginLevel` computation in `batch-snapshot.service.ts:1305` is correct MT5 convention; just not what the ticket asks for.

## Strategy Recommendation

Per phase context section 5:
- **Strategy A (current only):** Too thin — fails "highest margin used" requirement.
- **Strategy B (current + naive peak via cron):** Over-engineered — peak already computable in the existing per-tick rule-state update.
- **Strategy C (retroactive from tradehistories):** MT5 deal-level margin is unreliable for "margin at a moment in time" — deals are point events, not equity snapshots.
- **Strategy D (rule-checker integration):** WINNER. Extend the document rule-checker already writes every tick. No new infra, no new cron, no race conditions, peak is computed at the same `Math.max` site as the proven drawdown peaks.

**Use Strategy D.**

## Plan Shape Recommendation

Single phase, **2 plans**:

- **Plan 07-01 — Backend margin pipeline** (pft-rule-checker + pft-backend)
  - Extend `accountrulestates` schema with `currentMargin`, `currentMarginUsedPercent`, `peakMarginUsedPercent` (rule-checker model)
  - Update `liveAccountMetrics.service.ts:persistLiveAccountMetrics` to persist `currentMargin / currentMarginFree`
  - Update `ruleStateService.ts:updateRuleStateRT` peak computation block to track `peakMarginUsedPercent`
  - Ensure `eodService.ts` + `GlobalBatchScheduler.ts` reset paths do NOT zero peak margin
  - Add pft-backend route `GET /accounts/:loginId/margin-snapshot` (Auth admin + backOffice + user-self)

- **Plan 07-02 — Dashboard widget** (pft-dashboard, single edit covers client + admin)
  - New `MarginUsageCard.tsx` in `programs-details/`
  - Wire into `AccountInfoSection.tsx` or `TradingDashboardShared.tsx` (4th grid cell)
  - Read current % from `accountInfo.margin / accountInfo.equity` (already live)
  - Read peak via `useQuery` against new `/accounts/:loginId/margin-snapshot` endpoint (5–10 min cache)
  - Guards: no-open-positions → "—"; equity===0 → "—"; high-usage color flip (>70% amber, >90% red)

**Not a plan — operational check first:**
- Before any code: verify Super Admin Trading Cult brand `pagePermissions` for `/admin/symbol-risk`, `/admin/payout-risk`, `/admin/symbol-analysis`, `/admin/users/suspicious-accounts`, `/admin/risk/copy-trading-network`, `/admin/users/fraud-check`, `/admin/risk-settings`, `/admin/evaluation-heatmap`. If `backOffice` is missing from `allowedRoles` on any of these for the TC brand, add it via Super Admin UI. This is a config tweak, no PR. If config already includes `backOffice`, escalate to Bob for clarification before assuming a code bug.

Plans can be sequenced: 07-01 ships first (and starts populating peak), 07-02 ships after rule-checker is in prod for ≥1 hour so peaks have realistic values.

## Open Questions

1. **What exactly does Bob mean by "the existing risk insights section already available client-side"?**
   - What we know: Risk Intelligence sidebar group lives entirely under `/admin/*` paths — there is NO client-facing risk-intelligence sidebar item in `sidebar-config.tsx`. The only client-facing "risk" UI is `RiskViolationsSection.tsx` in the trader's own account view, which lists violation flags (not margin metrics).
   - What's unclear: Bob may have meant `RiskViolationsSection`, or he may have meant the admin Risk Intelligence pages (and his "client side" phrasing was loose). Or there's a brand-specific section we haven't found.
   - Recommendation: Treat as ambiguous. The widget proposed here sits in `AccountInfoSection` next to other account stats — visible on both client and admin (same component renders both). If Bob meant something else, the widget is still on-spec for the ticket's core ask.

2. **Is `marginUsed` per the ticket = `margin / equity * 100` or `margin / balance * 100`?**
   - What we know: Industry convention varies. MT5 broker terminal shows `Margin Level = Equity / Margin`. Most prop firm "margin used" UIs use equity in the denominator.
   - What's unclear: Trading Cult's preferred denominator.
   - Recommendation: Default to `margin / equity * 100`. Document the formula on the widget tooltip so QA can flag if TC disagrees.

3. **Does the widget need historical max from BEFORE this phase ships?**
   - What we know: Adding `peakMarginUsedPercent` starts tracking from rule-checker deploy. Pre-existing accounts will show 0 until they next touch margin.
   - What's unclear: Whether TC expects retroactive backfill for in-flight accounts.
   - Recommendation: Document "peak tracking begins YYYY-MM-DD" in release notes; do not backfill (tradehistories margin per-deal is not equivalent and would be expensive + lossy). Pre-existing accounts will populate within hours of their next trade.

4. **Does the per-brand DB pattern (per memory: each TC/NSF/etc. has its own MongoDB) affect this at all?**
   - What we know: `accountrulestates` lives in the per-brand DB; rule-checker writes per-brand; backend reads per-brand. No cross-DB issues.
   - Recommendation: No special handling needed; same schema + code rolls out per-brand naturally.

## Sources

### Primary (HIGH confidence)
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/services/broker/liveAccountMetrics.service.ts` — confirms margin currently in-memory only
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/services/broker/batch-snapshot.service.ts:1242-1305` — confirms margin in cache + marginLevel computed
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/services/broker/websocket-stream-bridge.ts:698-710` — confirms `accountInfo` socket event includes margin
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts:504-521` — exact hook site for peak tracking
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/models/accountRuleState.model.ts:46-47` — pattern for peakDailyDrawdownPercent / peakTotalDrawdownPercent to mirror
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/models/accountRuleState.model.ts` — confirms pass-through `strict: false` model
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/types.ts:94-101` — confirms AccountInfo already types margin/freeMargin/marginLevel
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/hooks/useTradingDashboardData.ts:85-115, 1352-1367` — confirms accountInfo merged from live + SDK sources
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/app/(dashboard)/admin/users/[id]/programs/[programId]/account/[accountId]/page.tsx` + `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/app/(dashboard)/accounts/[id]/statistics/[mtacc]/page.tsx` — confirms same `TradingDashboardShared` renders both admin + client views
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/lib/config/sidebar-config.tsx:365-413` — confirms Risk Intelligence sidebar already gated `[admin, backOffice]`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pfr-super-admin/lib/sidebar-routes.ts:186-200` — confirms super-admin also has `[admin, backOffice]`
- Live MongoDB `TradingCult` DB — `accountrulestates`, `highestequities`, `accountoverviews`, `dailysnapshots` schemas verified by direct query; `accountrulestates` confirmed to have peak drawdown fields and zero margin fields

### Secondary (MEDIUM confidence)
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/middleware.ts:508-720` — runtime `pagePermissions` enforcement (read but full per-brand seeding flow not traced)

### Tertiary (LOW confidence)
- Interpretation of Bob's "section of the dashboard already client-side" wording — no direct quote, inferred from phase brief

## Metadata

**Confidence breakdown:**
- Data sources: HIGH — verified live DB + code paths end-to-end
- Architecture pattern: HIGH — exact-mirror of existing peakDailyDrawdownPercent path
- UI placement: HIGH — single component proven to render both client + admin
- Role permission claim: MEDIUM — code is already permissive; per-brand `pagePermissions` is the likely real lever but not directly inspected for TC
- Strategy choice: HIGH — alternatives evaluated against existing infra, D is clearly cheapest

**Research date:** 2026-06-30
**Valid until:** 30 days (rule-checker peak-tracking pattern is stable; only risk is rule-checker refactor)

## RESEARCH COMPLETE
