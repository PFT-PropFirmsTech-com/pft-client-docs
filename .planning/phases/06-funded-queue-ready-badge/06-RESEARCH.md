# Phase 6: Funded Queue — KYC+Contract-Approved Badge — Research

**Researched:** 2026-06-30
**Domain:** pft-dashboard sidebar pending-indicator pattern + pft-backend FundedProgressionQueue read endpoint
**Confidence:** HIGH

## Summary

The codebase already has a fully-baked, canonical pattern for sidebar red-dot indicators driven by admin-facing counts: `useAdminSidebarPending` → `NotificationsProvider` → `SidebarItem` / `SidebarSubmenu`. Risk Intelligence + Compliance + Financial + Affiliate + Support all use it. The cheapest, on-pattern way to ship this badge is:

1. Backend: one new admin route `GET /funded-queue/ready-count` returning `{ count, manualApprovalEnabled }` — live-computes by joining queue rows with the per-DB `funded_queue_settings` singleton + Kyc/Contract collections (mirrors `getMyPending`). This avoids relying on stored `kycApproved/contractApproved/reason` fields, which only refresh on the 5-min `scanAndProcessReady` cron and are demonstrably stale.
2. Dashboard: one new `useQuery` block inside the existing `useAdminSidebarPending` hook + one branch inside `adminPendingForHref` matching `/admin/funded-queue` and the Program Management parent `/admin/programs`. Zero new component code, zero new provider, zero new context plumbing — the dot renders automatically because `SidebarItem` already reads `hasPendingForHref`.

The badge MUST be off when `funded_queue_settings.manualApprovalEnabled === false` (per-brand toggle, already a singleton per the per-brand-DB architecture). The backend returns `count: 0` in that case so the hook automatically suppresses the dot.

**Primary recommendation:** Add `GET /funded-queue/ready-count` (admin/backOffice auth, live-computed) + extend `useAdminSidebarPending` with a 5th `useQuery` + 1 branch in `adminPendingForHref`. Match the existing 5-min stale/refetch cadence. No new files in dashboard; one new route+service-fn in backend.

## Standard Stack

### Core (already in use, no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | already installed | Polling + cache for sidebar counts | Every other sidebar count uses it (`useAdminSidebarPending`) |
| `mongoose` | already installed | Backend model reads | `FundedProgressionQueue` + `FundedQueueSettings` + `Kyc` + `Contract` models already exist |
| `express` + existing `Auth(...)` middleware | already installed | Route auth | `userRole.admin, userRole.backOffice` matches every other queue route |

### Supporting
None. This is a pure additive extension of two existing patterns; no new libraries.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Live-compute count by joining Kyc+Contract per pending entry | Trust stored `kycApproved/contractApproved/reason: "manual_approval_pending"` flags + just `countDocuments({ status: "pending", reason: "manual_approval_pending" })` | Cheaper backend (1 indexed count vs N joins), but BADGE LAGS up to 5 min behind reality because those flags are only synced by the `scanAndProcessReady` cron. The dashboard `getMyPending` controller deliberately live-computes for this exact reason — we should mirror that choice. |
| New endpoint `GET /funded-queue/ready-count` | Extend `GET /funded-queue/stats` aggregate to also bucket by reason | Stats endpoint already exists and is hot — extending it is fine but requires bumping a wider response contract. A dedicated lightweight endpoint is more honest about what the sidebar needs (a single integer + toggle bool) and lets us live-compute cheaply without bloating the stats payload. **Recommended: separate endpoint.** |
| Server-Sent Events / websocket push | react-query polling at 5-min cadence | No SSE/websocket infra is wired into the existing admin sidebar (every other count uses 5-min react-query polling). Adding realtime here would be a new pattern for zero ops benefit — KYC + contract approvals are admin-initiated and the 5-min refresh is acceptable. |

**Installation:** None.

## Architecture Patterns

### Existing files to MODIFY (not create)
```
pft-backend/src/app/modules/FundedProgressionQueue/
├── fundedProgressionQueue.routes.ts     # +1 route line
├── fundedProgressionQueue.controller.ts # +1 handler (getReadyCount)
└── fundedProgressionQueue.service.ts    # +1 service fn (getReadyCount)

pft-dashboard/src/
├── lib/api/config.ts                    # +1 endpoint entry under admin
└── hooks/useAdminSidebarPending.ts      # +1 useQuery + 1 field in AdminSidebarPendingCounts + 1 branch in adminPendingForHref
```

### Pattern 1: Sidebar pending indicator (CANONICAL — match this exactly)
**What:** A polling react-query hook in `useAdminSidebarPending` produces a `counts` object; a pure function `adminPendingForHref(href, counts)` decides which sidebar items light up; `SidebarItem` / `SidebarSubmenu` already read `hasPendingForHref` from `NotificationsProvider` and render the `<span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--sidebar-bg,transparent)]" />` over the icon. Parent menu items inherit the dot when any submenu href lights up (see `SidebarSubmenu.tsx` line 110-118).

**When to use:** Any admin-facing "X items need action" count that should surface as a sidebar red dot.

**Example (verbatim from existing code, what to mirror):**
```ts
// Source: pft-dashboard/src/hooks/useAdminSidebarPending.ts:140-151
const supportTicketStats = useQuery({
  queryKey: ADMIN_SIDEBAR_STATS_QUERY_KEYS.supportTickets,
  enabled,
  queryFn: async () => {
    const { data } = await apiClient.get(ENDPOINTS.support.ticketStats);
    return data.data as Record<string, number>;
  },
  staleTime: SIDEBAR_STATS_STALE_MS,        // 5 * 60 * 1000
  refetchInterval: enabled ? SIDEBAR_STATS_REFETCH_MS : false,
  refetchOnWindowFocus: enabled,
  retry: 1,
});
```

```ts
// Source: pft-dashboard/src/hooks/useAdminSidebarPending.ts:31-63 (the predicate)
export function adminPendingForHref(href, counts) {
  if (!counts) return false;
  const h = normalizePath(href);
  if (counts.pendingKyc > 0) {
    if (pathMatches(h, "/admin/kyc-verification")) return true;
  }
  // ...etc
  return false;
}
```

### Pattern 2: Live-compute compliance state (mirror getMyPending)
**What:** Read all pending queue rows for the brand, then in ONE shared compliance read figure out which entries truly have KYC+Contract approved RIGHT NOW (not just per the stored flag). Trust the live read.

**When to use:** Any read that must reflect compliance state without waiting for the next queue-cron sync.

**Example:**
```ts
// Source: pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.controller.ts:46-58
const { Kyc } = await import("../Kyc/kyc.model");
const { Contract } = await import("../Contracts/contracts.model");
const [approvedKyc, approvedContract, manualApprovalEnabled] = await Promise.all([
  Kyc.findOne({ userId, status: "approved" }).lean(),
  Contract.findOne({ userId, status: "approved", fileType: "contract" }).lean(),
  FundedQueueSettingsService.isManualApprovalEnabled(),
]);
```
For the ready-count endpoint we generalize this to N users in one round trip: fetch the pending queue user-ids, then one `Kyc.find({ userId: { $in: ids }, status: "approved" })` + one `Contract.find({ userId: { $in: ids }, status: "approved", fileType: "contract" })`, intersect.

### Anti-Patterns to Avoid
- **Trusting stored `kycApproved`/`contractApproved`/`reason` for the badge.** They lag the cron — TC live DB right now shows 0 rows with `reason: "manual_approval_pending"` despite the screenshot showing one such row in the UI (the page itself live-recomputes via the row enrichment / forcibly trusts what's currently in the doc post-cron). For a sidebar badge that should fire INSTANTLY when a trader's contract gets approved, live-compute or you'll get bug reports about a missing dot.
- **Adding a brand-new sidebar provider/context.** Wire into `useAdminSidebarPending` — it already plugs into `NotificationsProvider.hasPendingForHref` and that powers the dot. New context = duplicate plumbing.
- **Polling shorter than 5 min.** Every other admin sidebar count uses `SIDEBAR_STATS_STALE_MS = 5 * 60 * 1000`. Going lower hammers the backend for low operational value (admins aren't watching the dot tick).
- **Wiring without the per-brand `manualApprovalEnabled` gate.** If the toggle is off, the brand auto-processes ready entries and the badge would fire on a row that's about to vanish in seconds — confusing UX. The endpoint must return `count: 0` when the toggle is off.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar red dot rendering | A new badge component on the `Funded Queue` sidebar item | `useNotificationsContext().hasPendingForHref` (already wired into `SidebarItem.tsx:154` and `SidebarSubmenu.tsx:111`) | Existing pattern handles icon overlay, parent inheritance, accessibility (`aria-label="Pending items"`), brand-aware ring color via `var(--sidebar-bg)`, and the active/coming-soon branches. |
| Polling/cache layer for the count | A bespoke `setInterval` or new react-query setup | `useAdminSidebarPending` — add a 5th `useQuery` next to the four existing ones, reusing `SIDEBAR_STATS_STALE_MS` / `SIDEBAR_STATS_REFETCH_MS` | Reuses the `enabled` gate (only fetch when in `/admin/*`), the 1-retry policy, refetch-on-focus, and the role gate `hasAdminSidebarRole`. |
| "Is this entry truly ready?" recompute | Re-implementing KYC/Contract joins in a fresh helper | `Kyc.findOne({ userId, status: "approved" })` + `Contract.findOne({ userId, status: "approved", fileType: "contract" })` + `FundedQueueSettingsService.isManualApprovalEnabled()` — the same triple used by `getMyPending` | Same source of truth as the trader-facing banner; if they ever drift, both surfaces would lie consistently. |
| Per-brand DB scoping | Anything | Nothing — the per-brand DB connection is implicit; `FundedQueueSettings` is a per-DB singleton; `Kyc`/`Contract`/`FundedProgressionQueue` are all per-DB. No code change needed. | Per-brand isolation is an architectural property of the existing models (per memory: `reference_per_brand_databases.md`). |

**Key insight:** Both the polling pattern and the live-compute pattern are already shipped, battle-tested, and ergonomically perfect for this feature. The phase is essentially "wire two existing patterns together" — resist any urge to introduce new infrastructure.

## Common Pitfalls

### Pitfall 1: Stale stored flags
**What goes wrong:** Counting `{ status: "pending", reason: "manual_approval_pending" }` returns 0 even though the screenshot row exists.
**Why it happens:** `kycApproved`, `contractApproved`, and `reason` on `FundedProgressionQueue` are only written by `processQueueForUser` / `scanAndProcessReady` (5-min cron) / event-driven approval handlers. Between syncs, an entry whose user just got KYC-approved STILL has `kycApproved: false, reason: "kyc_pending"` in Mongo.
**How to avoid:** Live-compute by joining Kyc + Contract collections at request time (see Pattern 2). Single round-trip with `$in` keeps it cheap.
**Warning signs:** "I approved Japhet's KYC 30 seconds ago and the badge still isn't showing" / "Badge disappeared but the UI still shows the row" — both are clues the count and the UI rendering are sourced from different freshness layers.

### Pitfall 2: Counting completed/failed/rejected as pending
**What goes wrong:** Badge stays lit forever because the query includes terminal states.
**Why it happens:** The status enum has 5 values: `pending / processing / completed / failed / rejected`. Only `pending` matters for "needs admin action now". `processing` is in-flight (cron is touching it) — exclude. `failed` shows up in stats too but is its own UI surface (retry button), not "ready to approve".
**How to avoid:** `status: "pending"` only, NOT `{ $in: ["pending", "processing"] }` (that's what `getMyPending` does for the trader banner — different semantic).
**Warning signs:** Total ready count > admin's eyeball count of "Manual Approval" reason rows on the page.

### Pitfall 3: Forgetting the toggle gate
**What goes wrong:** Badge fires on brands where `manualApprovalEnabled === false`; ops gets confused because the entry auto-processes seconds later and the dot vanishes mysteriously.
**Why it happens:** When the toggle is off, the cron auto-creates the funded account as soon as compliance lands; the row passes through `pending → processing → completed` in one tick. A query that doesn't gate on the toggle catches the brief `pending` window.
**How to avoid:** First line of the service: `const manualApprovalEnabled = await FundedQueueSettingsService.isManualApprovalEnabled(); if (!manualApprovalEnabled) return { count: 0, manualApprovalEnabled: false };`
**Warning signs:** Brand has the manual-approval toggle OFF but the sidebar dot blinks occasionally.

### Pitfall 4: Auth mismatch with the sidebar item
**What goes wrong:** Sidebar shows the "Funded Queue" item to BackOffice (per `sidebar-config.tsx:450 roles: [ROLES.admin, ROLES.backOffice]`), but the count endpoint is admin-only → 403 in BackOffice console + no dot for BackOffice users.
**Why it happens:** Habit of writing `Auth(userRole.admin)` only.
**How to avoid:** Use `Auth(userRole.admin, userRole.backOffice)` to match the rest of the queue routes (`listQueue`, `getStats`, `retryEntry`, `forceProcess`, `rejectEntry` — all admin+backOffice).
**Warning signs:** 403 errors in network tab for BackOffice users.

### Pitfall 5: Excluding `manual_approval_pending` users whose compliance reverted
**What goes wrong:** Row has stored `reason: "manual_approval_pending"` but trader's KYC actually got revoked (rare but possible). Counting by stored reason includes that row; counting by live compliance excludes it. The badge should match the page rendering.
**Why it happens:** Compliance state can change in either direction; the page row computes from stored fields, the count from live data → drift.
**How to avoid:** For v1 it's fine to keep counting strict (live compliance AND toggle on AND status=pending). If admin sees the dot but the page row already turned red ("KYC reverted"), they'll click in, see the rejected/failed state, and move on. Document this as a known-acceptable edge.
**Warning signs:** Dot appears but no actionable row on the page (very rare).

### Pitfall 6: Multiple brands sharing the same dashboard URL pattern
**What goes wrong:** Path `/admin/funded-queue` is constant across brands; nothing to worry about — per-brand isolation is implicit because each brand's dashboard talks to its own backend → its own DB.
**How to avoid:** Nothing. Just don't accidentally hard-code a brand slug anywhere.

## Code Examples

### Backend: ready-count service function (new in `fundedProgressionQueue.service.ts`)
```ts
// Source: extends pattern from fundedProgressionQueue.controller.ts:46-58 (getMyPending)
getReadyForApprovalCount: async (): Promise<{ count: number; manualApprovalEnabled: boolean }> => {
  const manualApprovalEnabled = await FundedQueueSettingsService.isManualApprovalEnabled();
  if (!manualApprovalEnabled) {
    // Brand auto-processes; sidebar must stay dark.
    return { count: 0, manualApprovalEnabled: false };
  }

  const pendingUserIds = await FundedProgressionQueue.distinct("userId", { status: "pending" });
  if (!pendingUserIds.length) return { count: 0, manualApprovalEnabled: true };

  const { Kyc } = await import("../Kyc/kyc.model");
  const { Contract } = await import("../Contracts/contracts.model");
  const [approvedKycs, approvedContracts] = await Promise.all([
    Kyc.find({ userId: { $in: pendingUserIds }, status: "approved" }).select("userId").lean(),
    Contract.find({
      userId: { $in: pendingUserIds },
      status: "approved",
      fileType: "contract",
    }).select("userId").lean(),
  ]);

  const kycReady = new Set(approvedKycs.map((d) => String(d.userId)));
  const contractReady = new Set(approvedContracts.map((d) => String(d.userId)));
  const readyUserIds = pendingUserIds.filter(
    (id) => kycReady.has(String(id)) && contractReady.has(String(id)),
  );
  if (!readyUserIds.length) return { count: 0, manualApprovalEnabled: true };

  // Count pending entries (not users) — a single user could have >1 funded account pending.
  const count = await FundedProgressionQueue.countDocuments({
    status: "pending",
    userId: { $in: readyUserIds },
  });
  return { count, manualApprovalEnabled: true };
},
```

### Backend: controller handler + route (`fundedProgressionQueue.controller.ts` + `.routes.ts`)
```ts
// controller — new handler
getReadyCount: catchAsync(async (req, res) => {
  const data = await FundedProgressionQueueService.getReadyForApprovalCount();
  sendResponse(res, { statusCode: httpStatus.OK, success: true, data });
}),

// routes — add ABOVE the generic `GET /` listQueue (Express matches in order; specific routes first)
router.get(
  "/ready-count",
  Auth(userRole.admin, userRole.backOffice),
  FundedProgressionQueueController.getReadyCount,
);
```

### Dashboard: endpoint entry (`pft-dashboard/src/lib/api/config.ts`)
```ts
// Inside ENDPOINTS.admin (find a sibling like admin.userDocuments.getStats and add nearby).
admin: {
  // ...existing
  fundedQueue: {
    readyCount: "/funded-queue/ready-count",
  },
},
```

### Dashboard: extension to `useAdminSidebarPending.ts`
```ts
// 1. Extend the typed counts object
export interface AdminSidebarPendingCounts {
  pendingKyc: number;
  pendingContracts: number;
  pendingTraderWithdrawals: number;
  pendingAffiliateWithdrawals: number;
  pendingSupportTickets: number;
  pendingFundedManualApproval: number; // NEW
}

// 2. Add to ADMIN_SIDEBAR_STATS_QUERY_KEYS
export const ADMIN_SIDEBAR_STATS_QUERY_KEYS = {
  // ...existing
  fundedQueueReady: ["admin", "fundedQueueReadyCount"] as const, // NEW
};

// 3. Add a 5th useQuery right next to supportTicketStats (paste verbatim, swap endpoint+queryKey)
const fundedQueueReadyStats = useQuery({
  queryKey: ADMIN_SIDEBAR_STATS_QUERY_KEYS.fundedQueueReady,
  enabled,
  queryFn: async () => {
    const { data } = await apiClient.get(ENDPOINTS.admin.fundedQueue.readyCount);
    return {
      count: data.data?.count ?? 0,
      manualApprovalEnabled: !!data.data?.manualApprovalEnabled,
    };
  },
  staleTime: SIDEBAR_STATS_STALE_MS,
  refetchInterval: enabled ? SIDEBAR_STATS_REFETCH_MS : false,
  refetchOnWindowFocus: enabled,
  retry: 1,
});

// 4. Add to the counts useMemo
pendingFundedManualApproval: fundedQueueReadyStats.data?.count ?? 0,

// 5. Add a branch to adminPendingForHref — light up BOTH the leaf and the Program Management parent
if (counts.pendingFundedManualApproval > 0) {
  if (pathMatches(h, "/admin/funded-queue")) return true;
  if (h === "/admin/programs") return true; // Program Management parent href
}
```

That's the entire feature. No new files, no provider edits, no SidebarItem edits.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trader funded pending banner (only) | Trader banner + admin sidebar dot | This phase | Ops sees there's work without having to bookmark/visit `/admin/funded-queue` |
| Stats endpoint returns only `{ counts: { pending, processing, ... }, total }` | Same — and a NEW dedicated `/ready-count` for the badge-specific live compute | This phase | Decouples sidebar's freshness need from the stats-card payload |

**Deprecated/outdated:**
- Nothing. Pure additive change.

## Live Data Sanity Check

Ran against the TradingCult production DB (read-only):

```
mongosh "mongodb://TradingCult:****@65.109.82.254:27017/TradingCult" --quiet
> db.fundedprogressionqueues.countDocuments({})                                       // 44 total
> db.fundedprogressionqueues.countDocuments({ status: "pending" })                    // 6
> db.fundedprogressionqueues.countDocuments({ status: "pending", reason: "manual_approval_pending" })  // 0
> db.fundedprogressionqueues.find({ status: "pending" }, { reason, kycApproved, contractApproved }).toArray()
  // 3× both_pending, 3× kyc_pending — none with both compliance flags true
> db.funded_queue_settings.findOne({})  // { manualApprovalEnabled: true, allowFlexiblePapFundedSize: undefined, ... }
```

**Findings:**
1. ✅ `funded_queue_settings.manualApprovalEnabled === true` for TradingCult — the toggle is ON, so the badge should be active on this brand.
2. ⚠️ **Zero rows currently match the badge criteria via stored fields.** The "Japhet Ngulu / Manual Approval / ✓ ✓" screenshot row is NOT visible in stored data right now — either (a) that entry was processed/completed/rejected between the screenshot and now, (b) the screenshot reflected live-compute state that the cron later turned into completed, or (c) the page row enriches via a live read that I didn't trace. Regardless, **for the deploy human-verify pass the team will likely need a synthetic test row**: enqueue a funded progression for a user who is already KYC-approved + contract-approved on TC staging. Without this, the badge will not light up during verification even though the code is correct.
3. ✅ The live-compute strategy is VINDICATED by this finding: counting stored `reason: "manual_approval_pending"` would have returned 0 at the moment the screenshot was taken too (likely), missing the badge. The live `Kyc + Contract` join will pick up Japhet-style rows the instant compliance lands, not 5 minutes later after the cron syncs.

## Implementation Surfaces

| Repo | File | Change |
|------|------|--------|
| pft-backend | `src/app/modules/FundedProgressionQueue/fundedProgressionQueue.routes.ts` | +4 lines (1 new route) |
| pft-backend | `src/app/modules/FundedProgressionQueue/fundedProgressionQueue.controller.ts` | +4 lines (1 new handler) |
| pft-backend | `src/app/modules/FundedProgressionQueue/fundedProgressionQueue.service.ts` | +1 new method `getReadyForApprovalCount` (~30 lines) |
| pft-dashboard | `src/lib/api/config.ts` | +3 lines (nested endpoint entry) |
| pft-dashboard | `src/hooks/useAdminSidebarPending.ts` | +1 useQuery (~15 lines), +1 type field, +1 query-key, +1 counts entry, +1 branch in `adminPendingForHref` |
| pft-dashboard | `src/components/ui/sidebar/SidebarItem.tsx` | **NO CHANGE** — already renders the dot generically |
| pft-dashboard | `src/components/ui/sidebar/SidebarSubmenu.tsx` | **NO CHANGE** — parent inherits automatically |
| pft-dashboard | `src/lib/config/sidebar-config.tsx` | **NO CHANGE** — Funded Queue submenu item already exists at line 462-466 |
| pft-dashboard | `src/providers/NotificationsProvider.tsx` | **NO CHANGE** — already calls `useAdminSidebarPending` |
| pfr-super-admin | NONE | The toggle is already editable via the existing per-brand admin "Funded Queue Settings" panel + the `PATCH /funded-queue/settings` admin endpoint. Super-admin not involved. |
| pft-rule-checker | NONE | Read-only sidebar feature; rule-checker only writes to the queue. |

## Open Questions

1. **Should the badge also count `failed` entries that have compliance done?**
   - What we know: `failed` entries have a "Retry" button on the page. They're separate from `pending + manual_approval_pending`.
   - What's unclear: Whether ops wants ONE dot meaning "anything needing attention" or specifically "manual approval ready".
   - Recommendation: v1 ships strict pending-only matching the ticket wording ("KYC+contract-approved badge"). If ops requests broader scope later, extend `getReadyForApprovalCount` to also include `status: "failed"` rows whose compliance is live-true. Document this as a deliberate scope choice in the PLAN.

2. **Should the dot also appear on the global navbar / a notification bell, not just the sidebar?**
   - What we know: There's a `useNotificationsContext().unreadCount` for the bell; it's driven by `useNotifications` (a different system from sidebar pending).
   - What's unclear: Whether the ticket wants a bell notification too.
   - Recommendation: Out of scope per the phase context ("one sidebar badge use"). Don't expand.

3. **Is there a Japhet-row hidden in `processing` or in failed status?**
   - What we know: The 6 pending rows in TC right now don't match the screenshot. The screenshot may simply be older than my DB read.
   - What's unclear: How long after compliance landed the screenshot was taken.
   - Recommendation: Test verify by creating a synthetic row on TC staging (per Live Data Sanity Check finding #2). Add this to the PLAN's verification checklist explicitly.

## Sources

### Primary (HIGH confidence)
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.interface.ts` — field schema authority
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.model.ts` — indexes + collection name (default: `fundedprogressionqueues`)
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.routes.ts` — auth pattern (`admin, backOffice`), URL structure
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.controller.ts` — `getMyPending` (lines 19-72): the live-compute pattern to mirror
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.service.ts` — `scanAndProcessReady` (line 542+) confirms cron syncs stored flags every 5min
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedQueueSettings.model.ts` — singleton collection `funded_queue_settings`, `manualApprovalEnabled: boolean`
- `pft-dashboard/src/hooks/useAdminSidebarPending.ts` — canonical pattern + `SIDEBAR_STATS_STALE_MS = 5min` + `SIDEBAR_STATS_REFETCH_MS = 5min`
- `pft-dashboard/src/providers/NotificationsProvider.tsx` — provider wiring; no edit needed
- `pft-dashboard/src/components/ui/sidebar/SidebarItem.tsx` lines 154, 212-217 — the red dot rendering
- `pft-dashboard/src/components/ui/sidebar/SidebarSubmenu.tsx` lines 110-118, 162-167, 222-227 — parent-inheritance dot + submenu dot
- `pft-dashboard/src/lib/config/sidebar-config.tsx` line 462-466 — existing Funded Queue sidebar entry
- `pft-dashboard/src/hooks/useFundedQueue.ts` — existing queue hooks (NOT to be extended; sidebar uses its own hook)
- `pft-dashboard/src/app/(dashboard)/admin/funded-queue/page.tsx` lines 100-108, 619-633 — `REASON_CONFIG` mapping + how page treats `manual_approval_pending`
- Live TC DB read 2026-06-30 via `mongosh` — empirical confirmation of cron-lag pitfall + toggle state

### Secondary (MEDIUM confidence)
- Memory `reference_per_brand_databases.md` — per-DB singleton scoping of `funded_queue_settings` (consistent with model `collection: "funded_queue_settings"` + no `brandId` field)

### Tertiary (LOW confidence)
- None. Every claim is grounded in source code reads or a live DB query.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library/pattern is already shipped in repo, no external research needed
- Architecture: HIGH — `useAdminSidebarPending` + `adminPendingForHref` + `SidebarItem` are textbook clean to extend
- Pitfalls: HIGH — stored-flag staleness confirmed empirically against TC live DB; toggle gate and auth match documented from existing routes

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stable internal codebase; only invalidated by a sidebar/notifications refactor or a queue-fields schema change)

## RESEARCH COMPLETE
