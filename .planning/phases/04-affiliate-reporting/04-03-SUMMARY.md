---
phase: 04-affiliate-reporting
plan: 03
subsystem: payments
tags: [csv-export, affiliate, commissions, admin, react-query]

# Dependency graph
requires:
  - phase: 04-affiliate-reporting/04-01
    provides: POST /affiliates/admin/commissions/bulk-by-orders endpoint
provides:
  - Admin Payment History CSV with 6 affiliate commission columns
  - Bulk commission lookup pattern (one POST for N order IDs, not N+1 GETs)
affects: [04-04 purchase-report-ui, future admin payment exports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk POST lookup for N-to-1 enrichment (avoids URL-length blow-up of GET ?ids=...)"
    - "Try/catch graceful degrade on optional enrichment fetch (broken commission API still produces a valid CSV with empty affiliate columns)"

key-files:
  created: []
  modified:
    - pft-dashboard/src/lib/api/config.ts
    - pft-dashboard/src/hooks/usePayments.ts

key-decisions:
  - "Use POST not GET to send orderIds[] (avoids 2000+ ID URL length limit)"
  - "Wrap commission fetch in try/catch — export must not break if commission endpoint fails"
  - "For MLM payments with multi-tier commissions, pick lowest tier (tier 1 = direct referrer) — single column-set per payment"
  - "Base payment fetch still uses skipEnrichment=true; commissions are merged client-side after the bulk lookup"

patterns-established:
  - "Bulk-enrich-by-IDs: when a list endpoint returns lean rows and detail enrichment is needed for export/report, fetch enrichment in one POST keyed by IDs rather than per-row GETs"
  - "Graceful enrichment degrade: optional enrichment failure leaves the primary feature working with empty values"

# Metrics
duration: ~4min
completed: 2026-06-30
---

# Phase 04 Plan 03: Affiliate columns in Admin Payment History CSV Summary

**Admin Payment History CSV now ships 25 columns (was 19) — 6 new affiliate commission fields merged in via a single bulk POST per export.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-30T10:20:00Z
- **Completed:** 2026-06-30T10:24:11Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Wired `ENDPOINTS.admin.affiliate.bulkCommissionsByOrders` to the backend route shipped in Plan 04-01.
- Added 6 trailing columns to the CSV export: `Commission Rate (%)`, `Commission Amount (USD)`, `Commission Currency`, `Affiliate User ID`, `Affiliate Name`, `Affiliate Email`.
- Single bulk POST `/affiliates/admin/commissions/bulk-by-orders` with full orderIds[] — no per-row fetches, export performance unchanged on hundreds of rows.
- For MLM payments (multi-tier commissions per order) picks the lowest tier (tier 1 = direct referrer) so the row has one clear commission perspective.
- Commission fetch wrapped in try/catch → if the endpoint fails, affiliate columns render empty but the CSV still downloads (no broken export).
- Base payment fetch still passes `skipEnrichment=true` — the slow per-row admin affiliate enrichment is replaced by the single bulk POST.

## Task Commits

Each task was committed atomically inside pft-dashboard on main-2026:

1. **Task 1: Add bulkCommissionsByOrders endpoint config** — `97783483` (feat)
2. **Task 2: Add 6 affiliate columns to useExportPaymentsCsv** — `6566f16d` (feat)

Both commits pushed to `origin/main-2026`.

## Files Created/Modified
- `pft-dashboard/src/lib/api/config.ts` — added `bulkCommissionsByOrders` entry inside `ENDPOINTS.admin.affiliate` next to the existing `commissionsByOrder` per-order lookup
- `pft-dashboard/src/hooks/usePayments.ts` — inserted bulk commission POST after the payment fetch, extended headers (+6) and row mapping (+6) inside `useExportPaymentsCsv`

## Decisions Made
- **POST vs GET for orderIds:** chosen POST — 2000+ orderIds in a query string would exceed URL length limits. Plan called this out, kept that decision.
- **Tier selection for MLM:** lowest tier (tier 1) wins per payment. Single-row export must collapse the N-tier list; tier 1 is the direct referrer (the closest commission to the payment).
- **Graceful degrade:** commission fetch failure logs nothing, just leaves affiliate columns empty. Reasoning: admins reading the CSV for non-affiliate analysis must not be blocked by a transient commission endpoint outage.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Scoped `npx tsc --noEmit --skipLibCheck src/hooks/usePayments.ts` flagged three `@/...` module-resolution errors. These are pre-existing artifacts of invoking tsc on a single file outside the project's tsconfig `paths` mapping — not caused by these changes. No new errors introduced.

## User Setup Required

None — backend route already shipped (Plan 04-01, pft-backend `e136636c` + `63f7d44a`). Authentication is admin/backOffice/sales token, already auto-attached by the existing `apiClient`.

## Verification (post-deploy, deferred)

After main-2026 deploys (both pft-backend and pft-dashboard), admin user runs:

1. Open `/admin/payments` (Payment History).
2. Click Export CSV with any filter that returns ≥1 payment with a known affiliate referral.
3. Open downloaded CSV. Confirm:
   - 25 columns total (19 original + 6 new at the tail).
   - Column order matches headers in code.
   - A payment WITH an affiliate referral shows non-empty `Commission Rate (%)`, `Commission Amount (USD)`, `Commission Currency`, `Affiliate User ID`, `Affiliate Name`, `Affiliate Email`.
   - A payment WITHOUT a referral shows empty strings in the 6 new columns (CSV still parses cleanly).
   - For MLM-eligible referrals (tier 2/3 levels present), the lowest-tier (tier 1 / direct) commission is shown.
4. Network tab: exactly ONE `POST /affiliates/admin/commissions/bulk-by-orders` per export (not N requests).

## Next Phase Readiness

- Plan 04-04 (My Purchases / Purchase Report UI for affiliates) is unblocked: backend `GET /affiliates/my-commissions` (Plan 04-01 second route) is already live in code.
- No deploy of these dashboard changes yet — gates with the next main-2026 dashboard rollout.

## Self-Check

Verifying claims against filesystem and git.

- FOUND: pft-dashboard/src/lib/api/config.ts — bulkCommissionsByOrders entry present
- FOUND: pft-dashboard/src/hooks/usePayments.ts — bulk POST + 6 columns + tier sort present
- FOUND commit: 97783483 (Task 1)
- FOUND commit: 6566f16d (Task 2)
- FOUND push: 4a345ff3..6566f16d main-2026 -> main-2026 (pushed to origin)

## Self-Check: PASSED

---
*Phase: 04-affiliate-reporting*
*Completed: 2026-06-30*
