---
phase: 04-affiliate-reporting
plan: 01
subsystem: api
tags: [affiliate, commissions, express, mongoose, mongodb, pagination]

# Dependency graph
requires: []
provides:
  - "POST /affiliates/admin/commissions/bulk-by-orders — admin/backOffice/sales bulk lookup keyed by orderId (used by Payment History CSV export)"
  - "GET /affiliates/my-commissions — user-scoped paginated commission history (used by Purchase Report UI)"
  - "AffiliateService.getCommissionsBulkByOrders(orderIds) — one-query grouping helper"
  - "AffiliateService.getMyCommissions(userId, query) — paginated, batched Payment join via Promise.all"
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batched populate + Promise.all Payment join (avoids sequential awaits inside .map)"
    - "User-only route auth as a security boundary (req.user._id is the only userId source)"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Affiliate/affiliate.service.ts
    - pft-backend/src/app/modules/Affiliate/affiliate.controller.ts
    - pft-backend/src/app/modules/Affiliate/affiliate.routes.ts

key-decisions:
  - "/my-commissions auth locked to userRole.user ONLY — admin/backOffice/sales deliberately excluded so the service can never be silently changed to accept an override userId"
  - "Bulk lookup returns Record<orderId, entry[]> from a single $in query — caller pivots client-side; no N round-trips"
  - "Payment join in getMyCommissions uses Promise.all over rows (NOT sequential await in map) — matches getAdminUserCommissions perf pattern"
  - "payment.mt5Login surfaced when set, null otherwise — plan-confirmed to exist on Payment doc (16/16 in live TradingCult DB)"

patterns-established:
  - "Bulk-by-IDs endpoint pattern: POST with { orderIds: string[] } body, returns Record keyed by id"
  - "User-facing scoped read endpoint pattern: derive userId from req.user, never from query/body"

# Metrics
duration: ~3 min
completed: 2026-06-30
---

# Phase 04 Plan 01: Affiliate reporting backend endpoints Summary

**Two new affiliate routes — admin bulk-by-orders commission lookup (for Payment History CSV export) and user-scoped /my-commissions (for Purchase Report UI) — built as straight extensions of existing affiliate.service patterns.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-30T10:16:45Z
- **Completed:** 2026-06-30T10:19:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `getCommissionsBulkByOrders(orderIds)` — one `$in` query, results grouped by `orderId` into `Record<string, entry[]>`. Unblocks Plan 03 admin CSV export.
- `getMyCommissions(userId, query)` — paginated commission history scoped to one user, joins `Payment` via `Promise.all` (not sequential await), surfaces `mt5Login` when present. Unblocks Plan 04 Purchase Report UI.
- Two routes wired with correct auth: `/my-commissions` is `userRole.user` ONLY (security-critical), `/admin/commissions/bulk-by-orders` is `admin/backOffice/sales`.

## Task Commits

1. **Task 1: Add getCommissionsBulkByOrders + getMyCommissions service functions** — `e136636c` (feat)
2. **Task 2: Add controller methods + wire routes** — `63f7d44a` (feat)

Both pushed to `origin/main-2026`.

## Files Created/Modified
- `pft-backend/src/app/modules/Affiliate/affiliate.service.ts` — two new service functions inserted between `getCommissionsByOrderId` and `selectLevelIndexByThreshold`; both exported in `AffiliateService` block.
- `pft-backend/src/app/modules/Affiliate/affiliate.controller.ts` — two new controllers inserted between `getCommissionsByOrderId` and `getAdminWithdrawals`; both exported in `AffiliateController` block.
- `pft-backend/src/app/modules/Affiliate/affiliate.routes.ts` — `/my-commissions` placed next to other user-facing routes (after `/referrals`); `/admin/commissions/bulk-by-orders` placed immediately after `/admin/commissions/order/:orderId`.

## Decisions Made
- **Security:** `/my-commissions` uses `Auth(userRole.user)` only. Admins/sales/backOffice MUST NOT be added — the service derives the scope from `req.user._id`, so adding them would either give a confusing self-only view (admin sees only their own commissions) or set up a silent privilege-bypass regression if anyone later refactored the service to accept an override userId. Comment in the route file documents this.
- **Perf:** Both functions use batched DB access — bulk lookup is one `find({orderId:{$in}})`; my-commissions uses one paginated `find` plus `Promise.all` over `Payment.findById` calls.
- **Auth source:** Controller reads `req.user?._id` first then falls back to `req.user?.id` — matches the existing controller cast pattern (`(req as any).user?.id`) used elsewhere in this file to bypass the pre-existing Request typing gap.

## Deviations from Plan

None — plan executed exactly as written.

The plan was explicit and surgical (function signatures, file insertion points, security note, perf note all spelled out). No bugs found, no missing functionality, no blocking issues. Pre-existing tsc errors in unrelated modules (esModuleInterop config, Request.user typing across all controllers) were NOT touched — they affect the whole codebase, not the new code.

## Issues Encountered

None. Scoped `npx tsc --noEmit --skipLibCheck` on the three modified files produced zero errors in the new code lines; all reported errors are pre-existing in unrelated modules (`Intercom`, `metrics`, `geoip`, etc.) or pre-existing typing gaps on `Request.user` that affect every existing controller.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 02:** Free to proceed (no backend dependency).
- **Plan 03 (admin CSV export):** Backend dependency satisfied — `POST /affiliates/admin/commissions/bulk-by-orders` is live in `main-2026` and pushed.
- **Plan 04 (Purchase Report UI):** Backend dependency satisfied — `GET /affiliates/my-commissions` is live in `main-2026` and pushed.
- **Deployment:** Both commits pushed to `origin/main-2026` but NOT yet deployed. Routes go live when `main-2026` deploys.

## Self-Check

Verified the three modified files are tracked in commits `e136636c` and `63f7d44a` on `main-2026`:
- `getCommissionsBulkByOrders` exported in `AffiliateService` (line ~5634 area)
- `getMyCommissions` exported in `AffiliateService`
- `bulkCommissionsByOrders` and `getMyCommissions` exported in `AffiliateController`
- `router.get("/my-commissions", Auth(userRole.user), ...)` present in routes
- `router.post("/admin/commissions/bulk-by-orders", Auth(userRole.admin, userRole.backOffice, userRole.sales), ...)` present in routes
- Both commits exist in git history (`git log --oneline -3` shows them)

## Self-Check: PASSED

---
*Phase: 04-affiliate-reporting*
*Completed: 2026-06-30*
