---
phase: 15-klaviyo-purchase-enrichment
plan: 02
subsystem: tracking
tags: [klaviyo, tracking, payments, mongoose, typescript]

# Dependency graph
requires:
  - phase: 15-klaviyo-purchase-enrichment (plan 01)
    provides: "resolveProgramContext(programId) util + widened purchaseCompleted/papPaymentCompleted helper signatures + platform/addons on ITrackingEventPayload"
provides:
  - "emitTrackingPurchaseCompleted enriched with programName/platform/phase/accountSize/challengeType/orderId/addons/couponCode"
  - "New shared emitPapPaymentCompleted(payment) util resolving context from currentProgramId"
  - "All 3 inline PAP completion call sites (stripe-webhook, fanbasis-webhook, callback) converted to the shared util"
affects: [15-verify-work, future-Klaviyo-segment-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget completion emit util calls resolveProgramContext once per emit, builds addons/couponCode with a stale-guard (only forwarded when non-empty/truthy), then spreads them conditionally into the TrackingEvents.* call"
    - "PAP funded-leg context is resolved from Payment.currentProgramId (the program being upgraded into), NOT Payment.programId (the original challenge) — distinct from the standard purchase_completed path"

key-files:
  created:
    - pft-backend/src/app/modules/Payment/utils/emitPapPaymentCompleted.ts
  modified:
    - pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts
    - pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts
    - pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts
    - pft-backend/src/app/modules/Payment/services/callback.service.ts

key-decisions:
  - "PAP program context resolved from currentProgramId, not programId — mirrors the funded-program semantics of the PAP-skip guard already in emitTrackingPurchaseCompleted"
  - "orderId added alongside the pre-existing invoiceId (both set to payment.invoice) rather than replacing it — belt-and-suspenders since Klaviyo's order_id already falls back to invoiceId"
  - "Removed the now-unused TrackingEvents import from all 3 converted service files after confirming (via grep) no other TrackingEvents.* usage remained in each"
  - "fanbasis-webhook's inner try/catch around the inline emit was dropped when converting to the shared util, since emitPapPaymentCompleted is self-guarding (own try/catch) — matches how emitTrackingPurchaseCompleted is already called bare via void elsewhere"

# Metrics
duration: 9min
completed: 2026-07-03
---

# Phase 15 Plan 02: Purchase Completion Enrichment (Standard + PAP) Summary

**Enriched emitTrackingPurchaseCompleted with resolveProgramContext-sourced program fields + commerce context (orderId/addons/stale-guarded couponCode), and factored the 3 hand-maintained inline PAP `pap_payment_completed` call sites into one new shared `emitPapPaymentCompleted(payment)` util with parity to the standard emit.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-03T13:07:00Z (approx, continuing from 15-01)
- **Completed:** 2026-07-03T13:16:51Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- `emitTrackingPurchaseCompleted` now calls `resolveProgramContext(payment.programId)` and forwards `programName`/`platform`/`phase` (from the Program doc), preferring the payment's own `accountSize`/`challengeType` and falling back to the resolved program values.
- Standard completion event now carries commerce context: `orderId` (mirrors `invoiceId`), `addons` (only when `selectedAddons` is non-empty), and `couponCode` (only when non-empty/truthy — stale-coupon guard per SC4, since `Payment.couponCode` defaults to `""`).
- New `pft-backend/src/app/modules/Payment/utils/emitPapPaymentCompleted.ts` — a shared fire-and-forget emitter for the PAP funded-leg `pap_payment_completed` event, resolving program context from `currentProgramId` (the funded program being upgraded into, typically yielding `phase: "funded"`), with the identical addons/couponCode stale-guards as the standard emit.
- All 3 previously hand-maintained inline `TrackingEvents.papPaymentCompleted({...})` blocks (stripe-webhook.service.ts, fanbasis-webhook.service.ts, callback.service.ts) replaced with `void emitPapPaymentCompleted(<payment-in-scope>)`, giving all 3 PAP funded-leg sites enrichment parity from one place. `eventId` stays `pap:<paymentId>` in every site — zero dedup-key change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich emitTrackingPurchaseCompleted with program + commerce context** - `49b182b3` (feat)
2. **Task 2: Create shared emitPapPaymentCompleted util** - `134fc736` (feat)
3. **Task 3: Convert the 3 inline papPaymentCompleted sites to call the shared util** - `94816729` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts` - Calls `resolveProgramContext`, adds `programName`/`platform`/`phase`/`orderId`/`addons`/`couponCode` to the `purchaseCompleted` emit; widened local `PaymentLike` with `selectedAddons`/`couponCode`
- `pft-backend/src/app/modules/Payment/utils/emitPapPaymentCompleted.ts` (new) - Shared fire-and-forget `pap_payment_completed` emitter resolving context from `currentProgramId`, mirroring the standard completion util's shape and guards
- `pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts` - PAP block now calls `void emitPapPaymentCompleted(payment)`; removed now-unused `TrackingEvents` import
- `pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts` - PAP block now calls `void emitPapPaymentCompleted(freshPayment)`; removed now-unused `TrackingEvents` import and its wrapping try/catch (util self-guards)
- `pft-backend/src/app/modules/Payment/services/callback.service.ts` - `handlePayAfterPassNextStage` now calls `void emitPapPaymentCompleted(payment)`; removed now-unused `TrackingEvents` import

## Decisions Made
- PAP program context is sourced from `Payment.currentProgramId` (the funded program being upgraded into), not `programId` (the original challenge) — consistent with the PAP-skip guard semantics already established in `emitTrackingPurchaseCompleted`.
- Kept the pre-existing `invoiceId` field alongside the new `orderId` (both `payment.invoice`) rather than replacing it, since Klaviyo's `order_id` mapping already falls back to `invoiceId` — this is intentionally redundant/safe, not a behavior change.
- Dropped fanbasis-webhook's inner `try/catch` around the emit call when converting to the shared util: `emitPapPaymentCompleted` has its own internal try/catch (matching the fire-and-forget contract of `emitTrackingPurchaseCompleted`, which is likewise called bare via `void` at its call sites without an external wrapper).
- Confirmed via grep that `TrackingEvents` had no other usages in any of the 3 converted service files before removing the import from each.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan only touches internal TypeScript utils/services; no new Klaviyo event/metric names, env vars, or dashboard config.

## Next Phase Readiness
- SC1 (standard purchase program context), SC2 (PAP funded-leg parity incl. phase), and the completion half of SC4 (commerce context, coupon-only-when-used) are satisfied.
- Scoped `tsc --skipLibCheck` across all 5 touched/created files shows zero new errors.
- `eventId` keys unchanged (`purchase:<id>` / `pap:<id>`) — no dedup regression. `value`/`currency` stay `usdAmount`/`"USD"` everywhere — JPY-as-USD guard preserved.
- Plan 15-03 (parallel, disjoint file: `trackingPurchaseFailedEmit.ts`) was untouched by this plan — no file overlap.
- No blockers. Ready for `/gsd:verify-work 15` once plan 15-03 also lands.

---
*Phase: 15-klaviyo-purchase-enrichment*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Payment/utils/emitPapPaymentCompleted.ts
- FOUND: pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts
- FOUND: pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts
- FOUND: pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts
- FOUND: pft-backend/src/app/modules/Payment/services/callback.service.ts
- FOUND commit: 49b182b3
- FOUND commit: 134fc736
- FOUND commit: 94816729
