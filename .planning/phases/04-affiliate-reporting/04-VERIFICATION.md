---
phase: 04-affiliate-reporting
verified: 2026-06-30T00:00:00Z
status: human_needed
score: 13/13 static must-haves verified (live UI verify deferred per 02-02/03-03/03-04 convention)
human_verification:
  - test: "Purchase Report card renders on Affiliate Overview"
    expected: "After main-2026 dashboard deploy, log in as TradingCult affiliate, navigate to /affiliates. Purchase Report card appears below Your Referrals and above Payout History."
    why_human: "JSX render correctness, visual layout, tier-tab switching, and CSV download flow require a running browser session against a live brand backend."
  - test: "MLM tier tabs vs Standard flat table"
    expected: "MLM/Hybrid affiliate sees Tier 1/2/3 tabs; Standard affiliate sees a flat table (no tabs). Switching tabs refetches /affiliates/my-commissions?tier=N."
    why_human: "Conditional render variant depends on affiliate config; needs live affiliate accounts of each type."
  - test: "Export CSV produces well-formed file"
    expected: "Click Export CSV → file purchase-report[-tier-N]-YYYY-MM-DD.csv downloads with 9 columns, opens cleanly in Excel."
    why_human: "Browser download flow + Excel UTF-8 BOM rendering can't be verified programmatically."
  - test: "Purchase Report does NOT appear on Withdrawals page"
    expected: "Navigating to the Withdrawals view (view=\"withdrawals\") must not render the Purchase Report card."
    why_human: "Static grep confirms JSX is inside showOverview branch; live click-through confirms routing/view-flag behaviour."
  - test: "Admin Payment History CSV has 25 columns (6 new affiliate cols)"
    expected: "Admin → Payments → Export CSV downloads a file whose header row contains Commission Rate (%), Commission Amount (USD), Commission Currency, Affiliate User ID, Affiliate Name, Affiliate Email as the last 6 columns. Payments without commissions show empty strings."
    why_human: "End-to-end CSV download + Excel inspection."
  - test: "Bulk commission lookup is one POST (not per-row)"
    expected: "DevTools Network panel during Payment CSV export shows exactly one POST /affiliates/admin/commissions/bulk-by-orders call, NOT N GET calls."
    why_human: "Performance characteristic verified via Network panel."
---

# Phase 04: Affiliate Reporting Verification Report

**Phase Goal:** Deliver three affiliate reporting enhancements for Trading Cult (ticket cmqqchwh500bspi0kxw23o2rl):
1. Add affiliate commission columns to the admin Payment History CSV export
2. Reply on the ticket clarifying Payout History vs Withdrawal History (no code change)
3. Build a new Purchase Report section under My Affiliate Overview with per-tier CSV export

**Verified:** 2026-06-30
**Status:** human_needed
**Re-verification:** No — initial verification
**Backend HEAD:** pft-backend main-2026 @ 63f7d44a
**Dashboard HEAD:** pft-dashboard main-2026 @ 35337a41

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | POST /affiliates/admin/commissions/bulk-by-orders returns Record keyed by orderId | ✓ VERIFIED | `affiliate.routes.ts:134-138` registers POST with `Auth(userRole.admin, userRole.backOffice, userRole.sales)`; `affiliate.service.ts:266-300` returns `Record<string, any[]>` grouped by orderId |
| 2 | GET /affiliates/my-commissions returns paginated commission rows scoped to req.user._id | ✓ VERIFIED | `affiliate.routes.ts:61-65` registers GET with `Auth(userRole.user)` ONLY; controller `affiliate.controller.ts:477-503` reads userId from `req.user`; service `affiliate.service.ts:304-383` scopes whereConditions to `affiliateUserId: new Types.ObjectId(userId)` with no override path |
| 3 | Both endpoints protected by correct auth guards (admin/backOffice/sales vs user) | ✓ VERIFIED | Bulk endpoint = admin/backOffice/sales (line 136). My-commissions = userRole.user ONLY (line 63). Comments above route explicitly call out the security boundary. |
| 4 | Ticket cmqqchwh500bspi0kxw23o2rl has a clarifying reply | ✓ VERIFIED | 04-02-SUMMARY.md confirms reply posted (comment id cmr0hsfj300h3ny0kpmx9qeng) explaining Payout History and Withdrawal History display identical data. Ticket intentionally kept IN_PROGRESS until 04-04 ships. |
| 5 | Admin Payment History CSV includes 6 new affiliate columns | ✓ VERIFIED | `usePayments.ts:305-331` headers array contains exactly 25 entries; last 6 are Commission Rate (%), Commission Amount (USD), Commission Currency, Affiliate User ID, Affiliate Name, Affiliate Email |
| 6 | Payments with no affiliate commission show empty strings (not errors) | ✓ VERIFIED | `usePayments.ts:338-344` uses `commByOrder[p._id] \|\| []` and `c ?? ""` fallback in escapeField calls |
| 7 | Base payment fetch still uses skipEnrichment=true | ✓ VERIFIED | `usePayments.ts:262` `queryParams.append("skipEnrichment", "true");` unchanged |
| 8 | Commission columns use lowest-tier entry per payment (MLM) | ✓ VERIFIED | `usePayments.ts:339-343` sorts commissions array ascending by `tier` and picks index 0 |
| 9 | useExportPaymentsCsv posts to bulk endpoint (one bulk call, NOT per-row) | ✓ VERIFIED | `usePayments.ts:285-289` single `apiClient.post(ENDPOINTS.admin.affiliate.bulkCommissionsByOrders, { orderIds }, { timeout: 60000 })` outside the rows.map |
| 10 | useGetMyCommissions hook + MyCommissionEntry type exported from useAffiliates.ts | ✓ VERIFIED | `useAffiliates.ts:647-672` exports MyCommissionEntry interface; `useAffiliates.ts:1250-1285` exports useGetMyCommissions hook calling `ENDPOINTS.affiliate.myCommissions` |
| 11 | Purchase Report card present in AffiliatesContainer.tsx inside showOverview branch only | ✓ VERIFIED | Card JSX at lines 1654-1704 sits between Referrals (closes 1649) and Payout History (1707). Wrapping `{showOverview && (...)}` block spans lines 929-1759. Withdrawals view (`{showWithdrawals && (...)}`) at line 1762 is sibling, NOT enclosing. |
| 12 | Per-tier tabs for MLM/Hybrid, flat table for Standard | ✓ VERIFIED | `AffiliatesContainer.tsx:1676-1702` branches on `hasMlmCommissionTiers` → Tabs with `tigerTab/tabHoverTeal/tabActiveTeal` classes or flat `<PurchaseReportTable />` |
| 13 | Per-tier Export CSV button wired to exportPurchaseReportCsv(activePurchaseTier) | ✓ VERIFIED | `AffiliatesContainer.tsx:1660-1667` Button onClick → `exportPurchaseReportCsv(activePurchaseTier)`; handler defined at line 721 using saveAs from file-saver |

**Score:** 13/13 static must-haves verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `pft-backend/src/app/modules/Affiliate/affiliate.service.ts` | getCommissionsBulkByOrders + getMyCommissions | ✓ VERIFIED | Both substantive functions (35 + 80 lines), exported at lines 5634-5635 |
| `pft-backend/src/app/modules/Affiliate/affiliate.controller.ts` | bulkCommissionsByOrders + getMyCommissions | ✓ VERIFIED | Both at lines 457-503, exported at 1122-1123, use catchAsync + sendResponse pattern |
| `pft-backend/src/app/modules/Affiliate/affiliate.routes.ts` | POST /admin/commissions/bulk-by-orders + GET /my-commissions | ✓ VERIFIED | Lines 61-65 and 134-138, auth guards correct |
| `pft-dashboard/src/lib/api/config.ts` | ENDPOINTS.admin.affiliate.bulkCommissionsByOrders + ENDPOINTS.affiliate.myCommissions | ✓ VERIFIED | Lines 430 + 166 |
| `pft-dashboard/src/hooks/usePayments.ts` | useExportPaymentsCsv with affiliate columns | ✓ VERIFIED | 25-column CSV, bulk POST, skipEnrichment=true preserved, lowest-tier picker |
| `pft-dashboard/src/hooks/useAffiliates.ts` | useGetMyCommissions hook + MyCommissionEntry type | ✓ VERIFIED | Lines 647-672 (type), 1250-1285 (hook) |
| `pft-dashboard/src/app/(dashboard)/_components/modules/users/affiliates/AffiliatesContainer.tsx` | Purchase Report card | ✓ VERIFIED | Module-scope PurchaseReportTable (line 193), card JSX (lines 1654-1704), inside showOverview block, with tier tabs + Export CSV |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| affiliate.routes.ts | affiliate.controller.ts (bulkCommissionsByOrders) | AffiliateController.bulkCommissionsByOrders | ✓ WIRED | Route 137 references controller, controller exported at 1122 |
| affiliate.routes.ts | affiliate.controller.ts (getMyCommissions) | AffiliateController.getMyCommissions | ✓ WIRED | Route 64 references controller, controller exported at 1123 |
| affiliate.controller.ts | affiliate.service.ts (both) | AffiliateService.getCommissionsBulkByOrders + getMyCommissions | ✓ WIRED | Controller methods call service functions at lines 467, 488 |
| usePayments.ts | bulk-by-orders endpoint | apiClient.post(ENDPOINTS.admin.affiliate.bulkCommissionsByOrders) | ✓ WIRED | Single POST at line 285, response merged into commByOrder used in rows.map |
| AffiliatesContainer.tsx | useGetMyCommissions | imported from @/hooks/useAffiliates, called at line 711 | ✓ WIRED | Hook result drives myCommissions + commissionsLoading state |
| useGetMyCommissions | /affiliates/my-commissions | apiClient.get(`${ENDPOINTS.affiliate.myCommissions}?...`) | ✓ WIRED | Query param builder + URL assembly at lines 1266-1273 |
| AffiliatesContainer.tsx | /affiliates/my-commissions (CSV export) | apiClient.get with limit=0 inside exportPurchaseReportCsv | ✓ WIRED | Helper defined at line 721, used by Button onClick at line 1663 |

### Requirements Coverage

| Requirement (ticket item) | Status | Notes |
| ------------------------- | ------ | ----- |
| Item 1: Affiliate columns in Payment History CSV | ✓ SATISFIED | 25-column CSV with 6 new affiliate fields |
| Item 2: Reply explaining Payout vs Withdrawal History | ✓ SATISFIED | Reply posted on ticket (per 04-02 SUMMARY); status intentionally held IN_PROGRESS until 04-04 ships |
| Item 3: Purchase Report section + per-tier CSV export | ✓ SATISFIED (code) / ? NEEDS HUMAN (live UI verify) | All code present and wired; visual + flow verification deferred to post-deploy human check |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No TODO/FIXME/placeholder/stub patterns found in new code paths |

The `return {}` at controller line 460 and `return {}` at service line 267 are guard clauses for empty `orderIds` — correct behaviour, not stubs.

### Security Notes

- `/my-commissions` route uses `Auth(userRole.user)` ONLY — admin/backOffice/sales are deliberately excluded (confirmed at routes line 63 with explicit security comment above). The controller derives `userId` from `req.user?._id` and the service injects it into the Mongo query as `affiliateUserId: new Types.ObjectId(userId)` with no override path from query/body. Verified resistant to IDOR escalation.
- Bulk endpoint uses POST body for `orderIds` (avoids URL-length limits AND removes them from access logs as bonus).

### Human Verification Required

Six post-deploy checks (in frontmatter above) covering visual layout, tab switching, CSV download/format, view-flag scoping, admin CSV column population, and Network-panel verification of the single-POST bulk pattern. Matches the deferred-verify convention used in phases 02-02, 03-03, 03-04.

### Gaps Summary

None. All 13 static must-haves verified against the codebase. Code-complete; awaiting live human-verify pass post next main-2026 dashboard deploy. This matches the explicit convention noted by the user.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
