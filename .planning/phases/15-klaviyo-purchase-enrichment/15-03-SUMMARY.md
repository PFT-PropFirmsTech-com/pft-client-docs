---
phase: 15-klaviyo-purchase-enrichment
plan: 03
subsystem: tracking
tags: [klaviyo, tracking, mongoose, typescript]

# Dependency graph
requires:
  - phase: 15-klaviyo-purchase-enrichment
    provides: "resolveProgramContext util + widened purchaseFailed helper signature (15-01)"
provides:
  - "emitTrackingPurchaseFailed enriched with program context (programId/programName/platform/phase/challengeType/accountSize) and commerce context (paymentMethod/orderId/addons/couponCode)"
  - "All 5 failure call sites (cron, stripe, fanbasis, paypal, callback) covered via the single shared util, zero per-site edits"
affects: [15-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "programId-with-currentProgramId fallback for PAP funded-leg failures, resolved through the same resolveProgramContext util as the completion path"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts

key-decisions:
  - "programId preference order: payment.programId (stringified) first, falling back to payment.currentProgramId — ensures PAP funded-leg failures still carry funded-program context"
  - "challengeType/accountSize prefer the payment doc's own denormalized value over resolveProgramContext's Program-lookup value when both exist (payment.challengeType ?? ctx.challengeType), matching the plan's exact field precedence"
  - "No PAP-skip guard added — per the Phase-13 decision, genuine PAP funded-leg failures should still fire purchase_failed; the two internal supersede/dedup bulk-writes remain excluded simply by never calling this util from those sites"

# Metrics
duration: 4min
completed: 2026-07-03
---

# Phase 15 Plan 03: purchase_failed Program + Commerce Enrichment Summary

**Enriched `emitTrackingPurchaseFailed` to resolve and forward program context (programName/platform/phase/challengeType/accountSize) plus commerce context (paymentMethod/orderId/add-ons/couponCode) via the Plan-01 `resolveProgramContext` util, covering all 5 failure call sites through the single shared emitter with zero call-site edits.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-03T15:11:00Z (approx.)
- **Completed:** 2026-07-03T15:15:00Z (approx.)
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `emitTrackingPurchaseFailed` now awaits `resolveProgramContext(programId ?? currentProgramId)` before firing the event, so `purchase_failed` carries the same `programName`/`platform`/`phase`/`challengeType`/`accountSize` context as a completed purchase — satisfying SC3.
- Added commerce context: `paymentMethod`, `orderId` (from `payment.invoice`), stale-guarded `addons` (only when `selectedAddons` is a non-empty array), and stale-guarded `couponCode` (only when non-empty after trim) — satisfying the failure half of SC4.
- PAP funded-leg failures resolve program context from `currentProgramId` when `programId` is absent, so funded-leg failures aren't left context-less.
- Zero call-site edits: cron, stripe-webhook, fanbasis-webhook, paypal-webhook, and callback services all already route through this one util passing the hydrated `payment` doc, so enriching the util alone enriches every failure event across the codebase.
- All pre-existing locked conventions preserved unchanged: `value = payment.usdAmount` / `currency = "USD"` always, normalized closed-vocab `errorCode`/`reason` (no raw gateway strings forwarded), and the stable `purchase_failed:<paymentId>` eventId for retry-safe dedup.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich emitTrackingPurchaseFailed with program + commerce context** - `5294fbd7` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts` - Widened `PaymentLike` interface (programId/currentProgramId/challengeType/accountSize/paymentMethod/couponCode/selectedAddons), imported and called `resolveProgramContext`, added stale-guarded addons/couponCode derivation, and passed the full widened field set into `TrackingEvents.purchaseFailed({...})`

## Decisions Made
- `programId` resolution order is `payment.programId` (stringified) first, falling back to `payment.currentProgramId` — matches the plan's explicit instruction so PAP funded-leg failures (which set `currentProgramId` rather than `programId`) still resolve real program context instead of returning `{}`.
- For `challengeType`/`accountSize`, the payment doc's own denormalized value takes precedence over the `resolveProgramContext` lookup result (`payment.challengeType ?? ctx.challengeType`), per the plan's exact field-by-field spec — this lets a payment-level override win over the Program-model default when both are present.
- No PAP-skip guard was added to the failure util, consistent with the existing code comment and the Phase-13 locked decision: genuine PAP funded-leg failures are still customer-facing failures and should fire `purchase_failed`; only the two internal bulk supersede/dedup writes are excluded, and they already never call this util.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan only touches an internal TypeScript emit util; no new Klaviyo event/metric names, env vars, or dashboard config were introduced.

## Next Phase Readiness
- Both Wave-2 plans (15-02 completion-path enrichment, 15-03 failure-path enrichment) are expected to land against disjoint files in parallel; once both SUMMARYs exist, Phase 15 is ready for `/gsd:verify-work 15`.
- No blockers introduced by this plan. Scoped `tsc --skipLibCheck` on the touched file shows zero errors.
- Live verification (real Klaviyo events showing the new properties on failed/expired/cancelled purchases) remains gated on the next main-2026 deploy, consistent with the project-wide post-deploy human-verify convention.

---
*Phase: 15-klaviyo-purchase-enrichment*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts
- FOUND commit: 5294fbd7
