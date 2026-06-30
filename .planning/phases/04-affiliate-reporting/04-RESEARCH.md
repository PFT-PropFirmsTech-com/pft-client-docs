# Phase 4: Affiliate Reporting Enhancements - Research

**Researched:** 2026-06-30
**Domain:** Affiliate reporting — CSV export enrichment, data-model distinction, new per-purchase report UI + backend endpoint
**Confidence:** HIGH (all findings sourced directly from codebase)

---

## Summary

Three separate deliverables of varying scope. Item 1 (CSV export) and Item 2 (clarification) are small and well-understood; Item 3 (Purchase Report) is the largest and requires a new backend endpoint plus new frontend section.

**Item 1 — CSV export affiliate columns:** The export lives entirely client-side in `useExportPaymentsCsv` (`pft-dashboard/src/hooks/usePayments.ts:250–343`). It already fetches all payments in one bulk call (`limit=0&skipEnrichment=true`). The problem is that `skipEnrichment=true` bypasses affiliate data — the enrichment step is what populates commission info. The fix must either (a) add commission data to the bulk-fetch response when `skipEnrichment=false` (too slow for hundreds of rows), or (b) add a new backend endpoint that returns commission data bulk-keyed by orderId so the export can batch-load commissions once rather than N calls. Option (b) is the correct approach.

**Item 2 — Payout vs Withdrawal clarification:** Both sections render from the same `useGetWithdrawals` hook and the same `AffiliateWithdrawal` collection. "Payout History" (Overview page, `showOverview` branch) and "Withdrawal History" (Withdrawals page, `showWithdrawals` branch) are identical data, different UI contexts. No code change is needed — this is purely a ticket-reply clarification task.

**Item 3 — Purchase Report:** The `AffiliateCommission` collection already stores per-purchase commission rows linked to orderId. The existing `/affiliates/admin/users/:userId/commissions` endpoint is admin-only. A new user-facing endpoint is needed: `GET /affiliates/my-commissions` with `?tier=N&page=&limit=` — querying `AffiliateCommission` where `affiliateUserId = req.user._id`, joining Payment for challengeType/accountSize/mt5Login and User (buyerId) for name/email. Frontend: new "Purchase Report" section below the "Your Referrals" tabs in `AffiliatesContainer.tsx`, matching the existing MLM tier-tabs pattern.

**Primary recommendation:** Build a new backend endpoint for commissions-by-tier (user-facing), a batch commissions endpoint for export, and add the Purchase Report UI section matching the existing tier-tabs pattern.

---

## Architecture Patterns

### Pattern 1: Client-Side CSV Export (current pattern)

**What:** `useExportPaymentsCsv` in `usePayments.ts` does a single bulk GET, builds CSV in memory with `file-saver`'s `saveAs`.
**Files:** `pft-dashboard/src/hooks/usePayments.ts:250–343`
**Pattern:**
```typescript
// Import
import { saveAs } from "file-saver";

// Bulk fetch with limit=0
const url = `${ENDPOINTS.admin.payments.get}?page=1&limit=0&skipEnrichment=true`;
const { data: response } = await apiClient.get(url, { timeout: 120000 });
const payments: PaymentData[] = response.data || [];

// Build CSV
const headers = ["Payment ID", "Date", ...];
const rows = payments.map(p => [...].join(","));
const csvContent = [headers.join(","), ...rows].join("\n");
const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8" });
saveAs(blob, `payments-${new Date().toISOString().split("T")[0]}.csv`);
```

### Pattern 2: Tier-Tab Referrals (existing pattern to mirror for Purchase Report)

**What:** In `AffiliatesContainer.tsx` the "Your Referrals" section uses `<Tabs>` with tab per tier. This exact pattern should be used for "Purchase Report".
**File:** `pft-dashboard/src/app/(dashboard)/_components/modules/users/affiliates/AffiliatesContainer.tsx:1336–1415`
**Key logic:**
- `tiersCount = hasMlmCommissionTiers ? activeSettings?.tiers?.length || maxTiers || 1 : 1`
- `<Tabs defaultValue='tier-1'>` → `<TabsTrigger value={'tier-${tier}'}>`
- Each tab fetches its data; for Purchase Report, filter by `tier` param.

### Pattern 3: Backend Commission Endpoint (admin, to mirror for user-facing)

**What:** `GET /affiliates/admin/users/:userId/commissions` — queries `AffiliateCommission` by `affiliateUserId`, joins Payment + User, returns paginated CommissionEntry array with full purchase detail.
**File:** `pft-backend/src/app/modules/Affiliate/affiliate.service.ts:526–637`
**Response shape per row:**
```
{
  _id, affiliateUserId, buyerId, orderId,
  amount,          // commission amount in commission currency
  rate,            // commission % (e.g. 10)
  source,          // "coupon" | "referral" | "mlm" | "manual"
  status,          // "paid" | "unpaid" | "pending"
  tier,            // 1, 2, 3...
  referralCode, couponCode, currency,
  createdAt, updatedAt,
  affiliate: { _id, name, email },
  buyer: { _id, name, email },
  payment: {
    _id, totalPrice, usdAmount, amount, paidAmount,
    status, paymentMethod, currency,
    couponCode, referralCode,
    challengeType,    // e.g. "2-step"
    accountSize,      // e.g. "5000"
    selectedAddons,
    program: { _id, name }   // MT5 login is on program
  }
}
```

**Missing field:** `mt5Login` (account number) is not directly on Payment. It's on the assigned funded account / program. The `payment.program` is populated but `mt5Login` may require a further lookup on the `FundedAccount` or `Program` collection. This is the one open question.

### Pattern 4: Bulk Commission Lookup for Export

**What:** The `commissionsByOrder` endpoint (`/affiliates/admin/commissions/order/:orderId`) is per-order. For a bulk export of 500+ payments, calling this N times is too slow.
**Needed:** A new endpoint `GET /affiliates/admin/commissions/bulk-by-orders?orderIds=id1,id2,...` OR embed commission data in the payments export call when `skipEnrichment=false`.

**Simplest solution:** Add a new backend endpoint:
```
GET /affiliates/admin/commissions/bulk-by-orders
Query: orderIds (comma-separated, up to e.g. 5000)
Returns: Record<orderId, CommissionEntry[]>
```
Then the export fetches payments first (with skipEnrichment=true for speed), fetches all commissions in one second call, merges in memory.

### Anti-Patterns to Avoid

- **N+1 commission fetches in export:** Do NOT call `commissionsByOrder` once per payment row during export. For 500 rows this means 500 HTTP calls → timeout/DoS. Use a bulk endpoint.
- **Embedding enrichment in skipEnrichment path:** The `skipEnrichment=true` path in the payments service intentionally skips affiliate lookups for performance. Don't break that optimization.
- **Re-using the admin commissions endpoint for user-facing:** `/affiliates/admin/users/:userId/commissions` requires admin auth. User-facing purchase report needs a separate route scoped to `req.user._id`.

---

## Item-by-Item Research Findings

### Item 1: Payment History CSV Export — Add Affiliate Columns

**Where export lives:** `pft-dashboard/src/hooks/usePayments.ts` — `useExportPaymentsCsv` function (line 250–343). This is purely client-side logic in a hook exported from usePayments. No separate export file.

**Current CSV columns (19 columns):**
```
Payment ID, Date, Customer Email, Customer Name, Country, Status,
Payment Method, Challenge Type, Account Size, Amount, Paid Amount,
Total Price, Currency, Coupon Code, Referral Code, Invoice, Source,
MT5 Login, Program Assigned
```

**Columns to add:**
- Affiliate User ID
- Affiliate Name
- Affiliate Email
- Commission % (rate)
- Commission Amount (USD)
- Commission Currency

**How CommissionLink fetches data:** `useQuery` in `PaymentsTable.tsx:382–400`, calls `ENDPOINTS.admin.affiliate.commissionsByOrder(payment._id)` → backend route `GET /affiliates/admin/commissions/order/:orderId`. Returns array of `{ _id, affiliateUserId, rate, source, tier, referralCode, couponCode }` plus `affiliate: { _id, name, email }`, `amount`, `currency`.

**The problem:** Export uses `skipEnrichment=true` and skips per-row enrichment. Adding N commission lookups in the export loop would be catastrophic for performance.

**Solution:** Add a new backend endpoint for bulk commission lookup by order IDs. Then the export flow becomes:
1. Bulk-fetch all payments (existing, limit=0, skipEnrichment=true)
2. Bulk-fetch all commissions for those orderIds in one call
3. Merge in memory, generate CSV

**Backend endpoint to add:**
- Route: `GET /affiliates/admin/commissions/bulk-by-orders`
- Query param: `orderIds` (comma-separated ObjectId strings, cap at e.g. 2000)
- Returns: `{ data: Record<string, CommissionEntry[]> }` — keyed by orderId
- Auth: admin/backOffice/sales (same as other admin commission routes)
- Implementation: `AffiliateCommission.find({ orderId: { $in: orderIds } }).populate(...)` — single MongoDB query

**New CSV columns to add after existing 19:**
```
Commission Rate (%),Commission Amount (USD),Commission Currency,Affiliate User ID,Affiliate Name,Affiliate Email
```
For payments with multiple commission entries (MLM tiers), use tier-1 row (lowest tier value), same logic as `CommissionLink` component.

**File to modify:** `pft-dashboard/src/hooks/usePayments.ts` — modify `useExportPaymentsCsv` function. Add ENDPOINTS entry for the new bulk endpoint.

---

### Item 2: Payout History vs Withdrawal History Distinction

**Finding:** Both "Payout History" and "Withdrawal History" display **identical data** from the same source.

**Data source:** `useGetWithdrawals` hook → `GET /affiliates/withdrawals` → `AffiliateWithdrawal` collection.

**"Payout History" section** (Overview page, `view='overview'`, `showOverview=true`):
- Rendered at line ~1471–1521 in `AffiliatesContainer.tsx`
- Shows: Amount, Method, Status, Date, Notes
- Context: Summary snapshot on the main overview — "you've requested/received these payouts"
- This is a condensed view (limit=10 in `useGetWithdrawals` call at line 194)
- Title key: `t("affiliates.payoutHistory")`

**"Withdrawal History" section** (Withdrawals page, `view='withdrawals'`, `showWithdrawals=true`):
- Rendered at lines ~1871–1924 in `AffiliatesContainer.tsx`
- Shows: Amount, Method, Status, Date, Notes (same columns)
- Context: On the dedicated Withdrawals page alongside the withdrawal submission form
- Also uses the same `withdrawals` variable (same `useGetWithdrawals` call at line 194, limit=10)
- Title key: `t("affiliates.withdrawalHistory")`

**Distinction for ticket reply:** "Payout History" and "Withdrawal History" are the same data displayed in two different UI contexts. Both show the affiliate's withdrawal requests (amounts the affiliate has requested to withdraw their commission earnings) and their statuses (pending/approved/completed/rejected). There is NO difference in the underlying data — they are not separate systems. "Payout History" is a compact view on the affiliate overview dashboard; "Withdrawal History" is the same list shown next to the withdrawal form on the dedicated Withdrawals page.

---

### Item 3: Referral Purchase Report — New Section

**Where "Your Referrals" currently renders:** `AffiliatesContainer.tsx` at line ~1316–1468. Card with header "Your Referrals", with tier tabs (for MLM/Hybrid) or a flat table (for Standard). Referral data comes from `useGetReferrals` (hook → `GET /affiliates/referrals?tier=N&page=&limit=50`).

**What "Your Referrals" currently shows:** One row per referred USER (the person who signed up), not per purchase. Fields: Referral name, join date, cumulative commissionEarned total, status. No per-purchase breakdown.

**What Purchase Report needs to show:** One row per PURCHASE COMMISSION entry. The `AffiliateCommission` collection stores exactly this.

**Backend data availability:**
- `AffiliateCommission` model fields: `affiliateUserId`, `buyerId`, `orderId`, `amount` (commission $), `rate` (commission %), `source`, `status`, `tier`, `referralCode`, `couponCode`, `currency`, `createdAt`
- When joined with Payment: `challengeType`, `accountSize`, `totalPrice`/`paidAmount`, `currency`
- When joined with User (buyerId): buyer `name`, `email`
- MT5 login (trading account number): NOT directly on Payment. Must check Program/FundedAccount collection via `payment.programId`. This needs investigation at implementation time.

**Backend endpoint needed:**
- Route: `GET /affiliates/my-commissions`
- Auth: user (scoped to `req.user._id`)
- Query params: `page`, `limit`, `tier` (optional), `sortBy`, `sortOrder`
- Query: `AffiliateCommission.find({ affiliateUserId: req.user._id, ...(tier ? { tier } : {}) })` with Payment + User joins
- Response shape: same as `getAdminUserCommissions` response but scoped to requesting user

**Frontend component plan:**
- Location: Below the "Your Referrals" card in `AffiliatesContainer.tsx` (overview section only)
- New card: "Purchase Report"
- Tab structure: Tier 1 / Tier 2 / Tier 3 (if MLM/Hybrid), same `<Tabs>` pattern as referrals section
- For Standard (non-MLM): single flat table (no tabs)
- Columns: Client Name, Client Email, Trading Account #, Product (e.g. "2-Step $5k"), Date, Purchase Amount, Commission %, Commission Amount, Commission Currency
- Export button (CSV): one export per active tier tab — same `file-saver`/`saveAs` pattern
- New hook: `useGetMyCommissions({ page, limit, tier, sortBy, sortOrder })` in `useAffiliates.ts`
- New endpoint config entry: `ENDPOINTS.affiliate.myCommissions` → `/affiliates/my-commissions`

**Export for Purchase Report:** Client-side CSV using `file-saver`, same as `useExportPaymentsCsv` pattern. Fetch all with `limit=0` then generate blob. File name: `purchase-report-tier-${tier}-${date}.csv`.

---

## Common Pitfalls

### Pitfall 1: MT5 Login (Trading Account Number) Field
**What goes wrong:** `payment.accountSize` is the challenge size (e.g. "5000"), NOT the MT5 login. The MT5 login lives on the funded account/program assigned after passing, not on the payment record itself.
**How to avoid:** For the Purchase Report columns, use `payment.challengeType + payment.accountSize` to form "Product" (e.g. "2-Step $5k"). For "Trading Account Number", query `FundedAccount` or `Program` via `payment.programId`. If programId is null (challenge not yet passed), show "—".
**Warning signs:** If you see `payment.mt5Login` referenced in export — this field DOES exist on PaymentData type and is populated by the enrichment step. But with `skipEnrichment=true` it's absent. For the user-facing Purchase Report, the backend joins with Payment which does have `programId` populated — check if `program._id` can be used to resolve the MT5 login.

### Pitfall 2: skipEnrichment=true Skips Affiliate Data
**What goes wrong:** The existing CSV export uses `skipEnrichment=true` which causes the backend to skip all affiliate/commission lookups. Simply removing this flag will make exports very slow (per-row enrichment on 500+ payments = slow DB queries).
**How to avoid:** Keep `skipEnrichment=true` for the base payment fetch. Use the new bulk commission endpoint as a second parallel call, then merge in memory.

### Pitfall 3: Admin vs User Auth for Commission Endpoints
**What goes wrong:** The existing `/affiliates/admin/users/:userId/commissions` is guarded by `Auth(userRole.admin, ...)`. If you try to call it from the user-facing Purchase Report you'll get 403.
**How to avoid:** Create a NEW route `/affiliates/my-commissions` with `Auth(userRole.user, ...)`. Scope the service function to `req.user._id` (never accept userId from the URL/query in the user-facing version).

### Pitfall 4: Payout History Same Data, Different Title
**What goes wrong:** Trying to "fix" Payout History to show different data from Withdrawal History — they ARE the same data intentionally.
**How to avoid:** Ticket reply only. No code change needed for item 2.

### Pitfall 5: Commission Rate vs Commission Amount Units
**What goes wrong:** `rate` field is a percentage (e.g. `10` means 10%). `amount` is the commission dollar value. Don't confuse them.
**Label in CSV/table:** "Commission %" for `rate`, "Commission Amount" for `amount`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV file download | Custom anchor download hack | `file-saver` (`saveAs`) | Already in package.json, used in usePayments.ts and journalExport.ts — consistent pattern |
| Tab UI for tiers | Custom tab component | shadcn/ui `<Tabs>/<TabsList>/<TabsTrigger>/<TabsContent>` | Already used for the referrals section — exact same pattern to copy |
| Commission bulk lookup | N parallel fetches | Single MongoDB `find({ orderId: { $in: [...] } })` | One query vs N queries — obvious |
| Data fetching state | Custom loading/error state | `useQuery` from `@tanstack/react-query` | All hooks in codebase use this pattern |

---

## Code Examples

### Adding bulk-by-orders endpoint (backend)

```typescript
// affiliate.service.ts — new function
const getCommissionsBulkByOrders = async (orderIds: string[]): Promise<Record<string, any[]>> => {
  if (!orderIds.length) return {};
  const rows = await AffiliateCommission.find({ orderId: { $in: orderIds } })
    .populate("buyerId", "firstName lastName email")
    .populate("affiliateUserId", "firstName lastName email")
    .sort({ createdAt: -1 });

  const result: Record<string, any[]> = {};
  for (const r of rows as any[]) {
    const oid = String(r.orderId);
    if (!result[oid]) result[oid] = [];
    const affiliateUser = r.affiliateUserId;
    result[oid].push({
      _id: r._id,
      affiliateUserId: String(affiliateUser?._id ?? r.affiliateUserId ?? ""),
      amount: r.amount,
      rate: r.rate,
      source: r.source,
      tier: r.tier,
      currency: r.currency,
      affiliate: affiliateUser
        ? { _id: affiliateUser._id, name: `${affiliateUser.firstName || ""} ${affiliateUser.lastName || ""}`.trim() || affiliateUser.email, email: affiliateUser.email }
        : null,
    });
  }
  return result;
};
```

### New CSV columns in useExportPaymentsCsv

```typescript
// In useExportPaymentsCsv, after fetching payments:
// 1. Collect all payment IDs
const orderIds = payments.map(p => p._id).join(",");
// 2. Fetch bulk commissions
const commUrl = `${ENDPOINTS.admin.affiliate.bulkCommissionsByOrders}?orderIds=${orderIds}`;
const { data: commResponse } = await apiClient.get(commUrl, { timeout: 60000 });
const commByOrder: Record<string, any[]> = commResponse?.data || {};

// 3. In headers add:
"Commission Rate (%)", "Commission Amount (USD)", "Commission Currency",
"Affiliate User ID", "Affiliate Name", "Affiliate Email"

// 4. In rows map, after existing fields:
const commissions = commByOrder[p._id] || [];
// Prefer tier-1 (lowest tier)
const c = commissions.sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1))[0];
escapeField(c?.rate ?? ""),
escapeField(c?.amount ?? ""),
escapeField(c?.currency ?? ""),
escapeField(c?.affiliateUserId ?? ""),
escapeField(c?.affiliate?.name ?? ""),
escapeField(c?.affiliate?.email ?? ""),
```

### New user-facing my-commissions hook (frontend)

```typescript
// useAffiliates.ts — new hook
export const useGetMyCommissions = (query?: {
  page?: number; limit?: number; tier?: number;
  sortBy?: string; sortOrder?: "asc" | "desc";
}) => {
  return useQuery<{ data: CommissionEntry[]; meta: any }, Error>({
    queryKey: ["myCommissions", query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", (query?.page || 1).toString());
      params.append("limit", (query?.limit || 20).toString());
      if (query?.tier) params.append("tier", query.tier.toString());
      if (query?.sortBy) params.append("sortBy", query.sortBy);
      if (query?.sortOrder) params.append("sortOrder", query.sortOrder);
      const url = `${ENDPOINTS.affiliate.myCommissions}?${params.toString()}`;
      const response = await apiClient.get(url);
      if (!response.data.success) throw new Error(response.data.message);
      return { data: response.data.data || [], meta: response.data.meta || {} };
    },
    ...adminListQueryOptions,
  });
};
```

---

## Open Questions

1. **MT5 login (trading account number) availability**
   - What we know: `payment.programId` is populated when the backend joins program. The `program._id` references the MT5 program/account. `mt5Login` IS on `PaymentData` type and populated during enrichment.
   - What's unclear: In the user-facing `getMyCommissions` service, when we join `AffiliateCommission → Payment → program`, does `program.mt5Login` exist on the model? Or is it on a separate `FundedAccount` document?
   - Recommendation: Check `Program` model for `mt5Login` field at implementation time. If not present, show challengeType+accountSize as "Trading Account" proxy and note that MT5 login is shown as "—" until account is assigned.

2. **Bulk order IDs query string length limit**
   - What we know: The proposed bulk endpoint uses `?orderIds=id1,id2,...` as a query string.
   - What's unclear: With 2000+ payments, this URL could exceed browser/nginx query string limits (~8KB).
   - Recommendation: Use POST body instead of GET query string for the bulk lookup: `POST /affiliates/admin/commissions/bulk-by-orders` with `{ orderIds: [...] }`.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `pft-dashboard/src/hooks/usePayments.ts:250–343` — full export function, current columns, file-saver usage
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx:375–429` — CommissionLink component, commissionsByOrder call, response shape
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentContainer.tsx:8,43,241–255` — export trigger, useExportPaymentsCsv usage
- `pft-dashboard/src/app/(dashboard)/_components/modules/users/affiliates/AffiliatesContainer.tsx:1316–1521,1871–1924` — Payout History, Referrals tabs, Withdrawal History
- `pft-dashboard/src/hooks/useAffiliates.ts:34–50,602–645` — Referral type, CommissionEntry type, all hooks
- `pft-dashboard/src/lib/api/config.ts:151–165,390–435` — all affiliate endpoint URLs
- `pft-backend/src/app/modules/Affiliate/affiliate.routes.ts` — all affiliate routes, auth guards
- `pft-backend/src/app/modules/Affiliate/affiliate.service.ts:191–260,447–637` — getCommissionsByOrderId, getReferrals, getAdminUserCommissions full implementations
- `pft-backend/src/app/modules/Affiliate/affiliate.model.ts:1–261` — Referral, AffiliateData, AffiliateWithdrawal, AffiliateCommission schemas
- `pft-backend/src/app/modules/Payment/payment.service.modular.ts:1825–1928` — skipEnrichment logic, bulk-fetch pattern
- `pft-dashboard/src/app/(dashboard)/journal/utils/journalExport.ts` — second usage of file-saver saveAs pattern

---

## Metadata

**Confidence breakdown:**
- Item 1 (CSV export): HIGH — full code path traced end-to-end
- Item 2 (clarification): HIGH — both sections confirmed same data source, same hook, same collection
- Item 3 (Purchase Report): HIGH for data model, MEDIUM for MT5 login field (one open question)
- Backend bulk endpoint pattern: HIGH — MongoDB pattern well-established in codebase
- MT5 login field in commission context: MEDIUM — needs check at implementation time

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stable codebase, no external dependencies)
