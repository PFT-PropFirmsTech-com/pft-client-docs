# Phase 9: PAP Funded Queue State Label - Research

**Researched:** 2026-07-01
**Domain:** pft-backend (payment service enrichment) + pft-dashboard (admin payments UI)
**Confidence:** HIGH (all findings sourced from direct codebase reads)

---

## Summary

The admin payment list already has a partial foundation: the user-facing payment history (`getPaymentHistory`) enriches each row with a `fundedDeferral` field via a `paymentId`-keyed batch join against `FundedProgressionQueue`. The `PaymentData` TypeScript type in the dashboard already declares `fundedDeferral?: { reason, status, kycApproved, contractApproved }`. The admin-facing `getPaymentHistoryAdmin` does NOT yet run this enrichment — it stops after affiliate/referral joins. The dashboard admin `PaymentsTable` and `PaymentDetailsContainer` both gate on `payment.programAssigned === false` but do NOT yet read `fundedDeferral` at all.

The implementation is therefore a narrow, low-risk addition: (1) copy the `paymentId`-keyed `fundedDeferral` enrichment into `getPaymentHistoryAdmin`, and (2) update the two admin UI components to branch on `fundedDeferral` presence when `programAssigned === false`.

**Primary recommendation:** Option A — enrich the existing `getPaymentHistoryAdmin` response server-side. The join pattern is already proven in the codebase, is a single `$in` query batched for the whole page (not N+1), and costs nothing in extra round-trips. Option B (separate endpoint) adds a round-trip per payment row on every page load and has no offsetting advantage.

---

## Decision: Backend Join Shape

### Option A — Enrich existing admin payments response (RECOMMENDED)

**How:** In `getPaymentHistoryAdmin` (pft-backend `payment.service.modular.ts`, the `enriched` block at ~line 2044), add the same `paymentId`-keyed `FundedProgressionQueue` batch join that already runs in `getPaymentHistory` (~lines 1778–1803).

**Cost analysis:**
- Admin list defaults to `limit=10`, paginated. One extra Mongo `find` per page, keyed by up to 10 payment `_id`s. Negligible cost.
- Queue collection is indexed on `{ paymentId }` (implicit via `_id` field on the doc, stored on queue as a ref). The join uses `{ paymentId: { $in: pageIds } }`. Fast.
- No N+1 — one query per page, same as the existing affiliate join.
- `skipEnrichment=true` (CSV export path) should also skip the queue join — consistent with how it skips affiliate lookups.

**Exact insertion point:** `payment.service.modular.ts`, inside `getPaymentHistoryAdmin`, after the `codeToAffiliate`/`refCodeToAffiliate`/`orderTier1Affiliate` blocks and before `history.map(...)` at ~line 2044. Mirror the pattern from lines 1778–1803.

**Option B — Separate GET endpoint:** Rejected. Would fire N requests (one per row) from the dashboard on every page load; introduces a second route + auth surface for no architectural benefit.

---

## Exact Rendering Sites

### PaymentsTable (`ProgramAssignmentBadge` component)

**File:** `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx`

**Line 223 — guard predicate:**
```tsx
if (payment.status !== "completed" || payment.programAssigned !== false) {
  return null;
}
```

**Lines 234–235 — label:**
```tsx
<span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
  Program Not Assigned
</span>
```

**Lines 243–290 — Retry button**
**Lines 271–300 — Mark Done button**

Both buttons are inside `ProgramAssignmentBadge`, which returns `null` when the guard at line 223 does not match. The component is passed `onRetry`, `onMarkAssigned`, `isRetrying`, `isMarking` props.

### PaymentDetailsContainer

**File:** `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payment-details/PaymentDetailsContainer.tsx`

**Line 578 — guard predicate:**
```tsx
{payment.status === "completed" && payment.programAssigned === false && (
  // ... "Action Required: Program Not Assigned" card with Retry + Mark as Done
)}
```

**Lines 630 + 639 — handlers:**
```tsx
onClick={handleRetryAssignment}   // calls useRetryProgramAssignment() → POST /:id/retry-assignment
onClick={handleMarkAssigned}      // calls useMarkProgramAssigned() → POST /:id/mark-assigned
```

**i18n:** Neither admin component uses i18n (`t()`). Labels are hardcoded English strings. The user-facing `PaymentHistoryContainer` uses `t("paymentHistory.fundedHoldKyc")` etc. — admin UI can use hardcoded strings to match existing admin-component convention.

---

## fundedprogressionqueues Schema

**File:** `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.interface.ts` and `.model.ts`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | indexed |
| `programId` | ObjectId | the funded program to provision |
| `mt5AccountId` | string | unique compound index with userId |
| `nextStageProgramId` | ObjectId? | same as programId for PAP entries |
| `challengeType` | string | |
| `currentStage` | string | |
| `payAfterPass` | boolean | true on all PAP-funded-leg entries |
| `paymentId` | ObjectId? | **the join key** — the remaining-leg payment's `_id` |
| `reason` | enum | `"kyc_pending" \| "contract_pending" \| "both_pending" \| "manual_approval_pending"` |
| `status` | enum | `"pending" \| "processing" \| "completed" \| "failed" \| "rejected"` |
| `kycApproved` | boolean | |
| `contractApproved` | boolean | |
| `retryCount` | number | |
| `maxRetries` | number | default 3 |
| `processedAt` | Date? | |
| `failedAt` | Date? | |
| `rejectedAt` | Date? | |
| `rejectedBy` | ObjectId? | |

**Indexes:**
- `{ userId: 1, status: 1 }` — useful for per-user pending lookup
- `{ userId: 1, mt5AccountId: 1 }` — unique constraint
- `{ status: 1, createdAt: 1 }` — cron worker

**Queue-gated statuses:** `"pending"` and `"processing"`. Both should surface the label. `"completed"`, `"failed"`, `"rejected"` mean the account was issued, failed permanently, or was manually rejected — not a current hold.

**Reason values and their meaning:**
- `"kyc_pending"` — KYC not approved
- `"contract_pending"` — contract not signed
- `"both_pending"` — neither KYC nor contract
- `"manual_approval_pending"` — both done, awaiting final admin review

---

## PAP Funded-Leg Predicate

**What identifies a "PAP funded-leg" payment row:**

Backend model fields (both present on the Payment document):
- `payAfterPass: true` — this payment is part of a PAP flow
- `payAfterPassRemainingPayment: true` — this is the funded/remaining leg (not the initial $0 or small deposit leg)

The initial leg has `payAfterPass: true` and `payAfterPassRemainingPayment: false` (default). Only the remaining leg creates a queue entry.

**IMPORTANT:** The `payAfterPassRemainingPayment` field is NOT in the `PaymentData` TypeScript interface in `usePayments.ts`. It is present on backend docs and flows through as untyped JSON. The backend service should filter to only query queue entries keyed by `paymentId` — no filtering on `payAfterPassRemainingPayment` is needed on the service side because only remaining-leg payments have queue entries created for them (the initial leg does not call `enqueuePayAfterPassFundedLeg`). The queue enrichment keyed by `paymentId` is naturally scoped.

**Edge cases:**
- A PAP initial-leg payment (`payAfterPassRemainingPayment: false`) will never have a queue entry, so the `paymentIdToDeferral` lookup returns nothing → `fundedDeferral` absent → no badge. Safe by design.
- Non-PAP payments (`payAfterPass: false`) also have no queue entries → same outcome.
- The concrete example payment `6a2c08b1ab4caef5631099a2` has `payAfterPassRemainingPayment=true`, `programAssigned=true` (misleading — field was set before the queue was created or was patched), and matches queue entry `6a2c0a5615385fe987c37953` by `paymentId`. This confirms the join must be by `paymentId`, NOT by checking `programAssigned`.

---

## Label Mapping

From the existing `getFundedHoldLabel` logic in `PaymentHistoryContainer.tsx` (user-facing, proven):

| Queue state | kycApproved | contractApproved | Admin label |
|-------------|-------------|------------------|-------------|
| pending/processing | false | false | "Awaiting KYC & Contract" |
| pending/processing | false | true | "Awaiting KYC" |
| pending/processing | true | false | "Awaiting Contract" |
| pending/processing | true | true | "In Funded Queue" (manual_approval_pending) |

**`status=processing`:** No distinct label needed. It means the cron picked up the entry and is attempting provisioning right now — but if KYC/contract flags are still false, the cron will re-queue it. Use the same kyc/contract logic regardless of `pending` vs `processing`.

The `reason` field is a denormalised snapshot of the reason at enqueue time. Use `kycApproved`/`contractApproved` live flags for the label (they are updated by KYC/contract webhooks), not `reason`.

---

## Retry / Mark Done Suppression

**Current rendering (PaymentsTable `ProgramAssignmentBadge`):** Both buttons are rendered inside the same component that shows the label. The simplest suppression is to replace the current hardcoded "Program Not Assigned" label + buttons with a branch:

- If `payment.fundedDeferral` exists AND status is `pending` or `processing` → show queue-state label; suppress Retry + Mark Done buttons entirely (or hide them).
- If `payment.fundedDeferral` is absent (or status is `completed`/`failed`/`rejected`) → show existing "Program Not Assigned" + Retry + Mark Done as today.

This satisfies success criteria #3 ("hidden OR inert") and #4 (no queue entry → existing behaviour).

**PaymentDetailsContainer:** Same branch on `payment.fundedDeferral`. Replace the "Action Required: Program Not Assigned" card with a "Funded Account On Hold" informational card when `fundedDeferral` is present + active. No Retry or Mark Done in the queue-gated case.

**`programAssigned` field caveat (critical):** The concrete diagnostic case shows `programAssigned=true` on the payment even though the queue is pending. The `deferPapFundedLegIfNeeded` function sets `programAssigned=false` on deferral, but in this specific case `retryCount=7` suggests the field may have been toggled by earlier retry attempts. Do NOT gate the new label on `programAssigned === false`. Gate it solely on `fundedDeferral` presence with active status. The existing `programAssigned === false` guard on the outer card can remain as-is — the new inner branch just augments it.

---

## Cache Considerations

### Server-side (cacheResponse middleware)
Route: `GET /api/payments/history-admin` uses `cacheResponse(30)` — **30-second Redis TTL**.

The cache key includes all query params (stableQuery). When a KYC admin approves a KYC for a user, the queue's `kycApproved` field updates, but the admin payment list cache for that page will serve stale `fundedDeferral` data for up to 30 seconds. This is acceptable: KYC approval is a rare event and 30 seconds of lag is invisible in practice. No cache invalidation changes are needed.

Bypass is available via `?noCache=1` or `?fresh=1` for immediate checks.

### Client-side (React Query)
`usePayments` uses `adminListQueryOptions` → `staleTime: 5 * 60 * 1000` (5 minutes) + `refetchOnWindowFocus: false`. After a Retry or Mark Done mutation, `invalidateAdminPayments()` is called, which invalidates `["admin-payments"]` — this already handles cache invalidation on mutations. No changes needed here.

---

## Common Pitfalls

### Pitfall 1: `programAssigned` field unreliability
**What goes wrong:** Gating the queue-state label on `programAssigned === false` misses cases where the field was not updated atomically (e.g., retryCount=7 on the diagnostic payment, or `programAssigned` was set true by an earlier retry before being re-queued).
**How to avoid:** Gate on `fundedDeferral` presence + active status. Treat `programAssigned` as a loose hint for the outer card, not as the source of truth for queue state.

### Pitfall 2: Multiple queue entries per payment
**What goes wrong:** A payment could theoretically have more than one queue entry if there were retry/re-enqueue cycles.
**How to avoid:** The user-facing implementation already handles this: `.sort({ createdAt: -1 })` + "first wins" logic in the loop. Mirror this exactly. Most recent entry wins.

### Pitfall 3: `paymentId` not indexed on FundedProgressionQueue
**What goes wrong:** The `$in` query by `paymentId` could be slow without an index.
**Verification needed:** The schema declares indexes on `{ userId, status }`, `{ userId, mt5AccountId }`, and `{ status, createdAt }`. There is no explicit index on `paymentId`. With small page sizes (10 payments → at most 10 queue docs to scan), this is fast today. If the queue grows large, a `{ paymentId: 1 }` sparse index would help. The planner should note this as a follow-up, not a blocker.

### Pitfall 4: `skipEnrichment=true` on CSV export path
**What goes wrong:** Adding the queue join to the full enrichment path but not the `skipEnrichment=true` early-return branch is correct (CSV export doesn't need this label), but the code structure must ensure the `FundedProgressionQueue` import doesn't execute on the `skipEnrichment` branch.
**How to avoid:** The dynamic import `await import("../FundedProgressionQueue/fundedProgressionQueue.model")` should stay inside the non-skipEnrichment path. The existing pattern in the user-facing history (which only runs in the normal path) is the template.

### Pitfall 5: Dashboard `PaymentData` type missing `payAfterPassRemainingPayment`
**What goes wrong:** The TypeScript type doesn't declare `payAfterPassRemainingPayment`. This is fine — the backend join is by `paymentId` so no filtering on this field is needed in frontend code. No type change needed for this field.
**What does need a type change:** `PaymentData.fundedDeferral` is already declared in the type. No new type additions required for the backend field. The field just needs to be populated by `getPaymentHistoryAdmin` now.

### Pitfall 6: Cache key encompasses fundedDeferral changes
**What goes wrong:** After KYC approval, the admin refreshing the payment list sees stale `fundedDeferral` data for up to 30 seconds (server TTL) + up to 5 minutes (React Query staleTime, but only if they don't navigate away).
**Acceptable:** Queue state changes are driven by admin actions (KYC approval), after which the admin will typically navigate to verify. The `?noCache=1` bypass is available. No change needed.

---

## Architecture Patterns

### Server-side enrichment pattern (existing, proven)

The `getPaymentHistory` (user-facing) already implements the exact pattern to mirror:

```typescript
// Batch join: payment._id → FundedProgressionQueue.paymentId
const paymentIdToDeferral: Record<string, {...}> = {};
const pageIds = result.data.map((p: any) => String(p._id));
if (pageIds.length > 0) {
  const { FundedProgressionQueue } = await import("../FundedProgressionQueue/fundedProgressionQueue.model");
  const queueEntries = await FundedProgressionQueue.find({ paymentId: { $in: pageIds } })
    .select("paymentId reason status kycApproved contractApproved createdAt")
    .sort({ createdAt: -1 })
    .lean();
  for (const e of queueEntries) {
    const key = String((e as any).paymentId);
    if (!paymentIdToDeferral[key]) {   // most recent wins (sorted desc)
      paymentIdToDeferral[key] = {
        reason: (e as any).reason,
        status: (e as any).status,
        kycApproved: !!(e as any).kycApproved,
        contractApproved: !!(e as any).contractApproved,
      };
    }
  }
}

// Then in the .map():
fundedDeferral: paymentIdToDeferral[String(p._id)] || undefined,
```

Source: `payment.service.modular.ts` lines 1778–1803 (user-facing `getPaymentHistory`).

The admin `getPaymentHistoryAdmin` already uses `.lean()` (line 1944: `Payment.find(...).lean()`), so `p.toObject ? p.toObject() : p` pattern is not needed — spread directly.

### Label derivation pattern (existing, proven)

```typescript
// Active queue states only:
function getQueueStateLabel(deferral: { status: string; kycApproved: boolean; contractApproved: boolean } | undefined): string | null {
  if (!deferral) return null;
  if (deferral.status !== "pending" && deferral.status !== "processing") return null;
  if (!deferral.kycApproved && !deferral.contractApproved) return "Awaiting KYC & Contract";
  if (!deferral.kycApproved) return "Awaiting KYC";
  if (!deferral.contractApproved) return "Awaiting Contract";
  return "In Funded Queue";
}
```

Source: Mirrors `getFundedHoldLabel` in `PaymentHistoryContainer.tsx` lines 77–86, adapted for admin (no i18n, hardcoded EN strings match admin convention).

---

## Rollout Risk Assessment

| Dimension | Risk | Notes |
|-----------|------|-------|
| Data migration | None | All data lives in existing collections |
| Rule-checker changes | None | Zero changes to pft-rule-checker |
| Brand-specific behaviour | None | Deploys via main-2026 to all brands |
| Backward compatibility | None | `fundedDeferral` absent = existing UI; present = new label. Graceful degradation is built in. |
| Non-PAP rows | None | No queue entry → `fundedDeferral` undefined → no change |
| Auth/access | None | Admin + backOffice + sales already on `history-admin`; no new endpoints |

---

## Test Strategy

**Backend unit test** (add to payment service tests or a dedicated file):
1. Mock `FundedProgressionQueue.find` to return an entry with `paymentId` matching one payment in the page → assert that payment's `fundedDeferral` is populated.
2. Mock returns no entries → assert `fundedDeferral` is `undefined` on all rows.
3. Mock returns two entries for same `paymentId` (different `createdAt`) → assert most-recent wins.

**Frontend:** No test infra in pft-dashboard (confirmed per Phase 5 memory). Manual only.

**Integration/manual:** NSF DB has the exact diagnostic case:
- Payment `6a2c08b1ab4caef5631099a2` → should show "Awaiting KYC" (kycApproved=false, contractApproved=true)
- Retry + Mark Done should be hidden on this row

---

## Open Questions

1. **`paymentId` index on FundedProgressionQueue**
   - What we know: No explicit index on `paymentId` in the schema.
   - What's unclear: Whether the collection is large enough for this to matter at page-size=10.
   - Recommendation: Add `{ paymentId: 1 }` sparse index in the same migration/commit. Low risk, zero downside.

2. **`status=processing` label distinction**
   - What we know: `processing` means the cron is actively attempting provisioning.
   - What's unclear: Whether admins would find a distinct "Processing" label useful vs. "In Funded Queue" / "Awaiting KYC".
   - Recommendation: Use the same kyc/contract-flag-based label for both `pending` and `processing`. If both flags are true and it's processing, "In Funded Queue" is correct.

3. **PaymentDetailsContainer: queue-gated card design**
   - What we know: The existing "Action Required" card has Retry + Mark Done.
   - What's unclear: Whether to fully replace the card body or add a new conditional block.
   - Recommendation: Show a different informational card body (without Retry/Mark Done) when `fundedDeferral` is active. Keep outer guard `programAssigned === false` unchanged.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `pft-backend/src/app/modules/Payment/payment.service.modular.ts` — `getPaymentHistoryAdmin` (lines 1845–2074) and `getPaymentHistory` enrichment (lines 1772–1810)
- `pft-backend/src/app/modules/Payment/payment.model.ts` — `payAfterPass`, `payAfterPassRemainingPayment` fields
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.interface.ts` — full schema
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.model.ts` — indexes
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.service.ts` — `enqueuePayAfterPassFundedLeg`, `deferPapFundedLegIfNeeded`
- `pft-backend/src/app/modules/Payment/payment.routes.ts` — route `GET /history-admin` with `cacheResponse(30)`
- `pft-dashboard/src/hooks/usePayments.ts` — `PaymentData` type (already has `fundedDeferral`), `usePayments` hook
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx` — `ProgramAssignmentBadge` component (lines 214–303)
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payment-details/PaymentDetailsContainer.tsx` — "Program Not Assigned" card (lines 577–658)
- `pft-dashboard/src/app/(dashboard)/_components/modules/users/payment-history/PaymentHistoryContainer.tsx` — `getFundedHoldLabel` (lines 77–86)
- `pft-dashboard/src/lib/queries/adminCache.ts` — staleTime=5min, `invalidateAdminPayments`
- `pft-backend/src/app/middlewares/cacheResponse.ts` — TTL-only, no explicit invalidation
- `pft-dashboard/messages/en.json` — existing funded hold i18n keys (user-facing, not admin)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly
- Architecture: HIGH — enrichment pattern exists in codebase, copy-paste with minor edits
- Pitfalls: HIGH — `programAssigned` unreliability confirmed by diagnostic case data in DEV ticket
- Cache behavior: HIGH — middleware code read directly

**Research date:** 2026-07-01
**Valid until:** Stable (no external dependencies; all changes are within this repo)
