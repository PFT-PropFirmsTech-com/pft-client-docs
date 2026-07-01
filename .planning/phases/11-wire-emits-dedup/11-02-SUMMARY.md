---
phase: 11-wire-emits-dedup
plan: 02
subsystem: payments
tags: [crm, tracking, partner-postback, purchase-completed, pap, usd-normalization, ftd, dedup]

# Dependency graph
requires:
  - phase: 11-01
    provides: ITrackingEventPayload + purchaseCompleted/papPaymentCompleted arg types carry partnerClickId/isFirstPurchase/eventId
  - phase: 10-03
    provides: Payment attribution.partnerClickId persisted at checkout creation (req=null safe)
provides:
  - emitTrackingPurchaseCompleted util with PAP-skip guard, FTD flag, USD normalization, stable eventId
  - purchase_completed fires at every standard completion (free-$0 + paid callback + paid stripe + fanbasis)
  - pap_payment_completed carries usdAmount (not billed JPY), partnerClickId, stable eventId at all three PAP sites
  - Exactly one conversion-eligible event per PAP purchase guaranteed
affects:
  - 12 (partnerPostback adapter needs purchase_completed/pap_payment_completed with isFirstPurchase + partnerClickId)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PaymentLike loose-typing pattern for tracking utils (mirrors salesWebhookEmit.ts)"
    - "PAP-skip guard: if (payAfterPass === true && currentProgramId) return — prevents double-count in shared util"
    - "FTD detection: countDocuments({ userId, status:'completed' }) === 1 (after status flip is persisted)"
    - "Stable dedup key: purchase:<paymentId> / pap:<paymentId> (overrides minute-bucketed deterministicEventId)"
    - "Skip-when-absent partnerClickId: ...(partnerClickId ? { partnerClickId } : {})"

key-files:
  created:
    - pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts
  modified:
    - pft-backend/src/app/modules/Payment/payment.service.modular.ts
    - pft-backend/src/app/modules/Payment/services/callback.service.ts
    - pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts
    - pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts

key-decisions:
  - "fanbasis DOES provision PAP funded-legs (deferPapFundedLegIfNeeded compliance gate, then assignProgramToUser with payAfterPass fields) → papPaymentCompleted added in ensureProgramAssigned when payAfterPass && currentProgramId"
  - "FTD count === 1 (not === 0): payment status is flipped to 'completed' and persisted BEFORE the completion side-effects run at all three standard call sites"
  - "Standard purchase emit in stripe-webhook goes in processPaymentCompletion after final payment.save() (line ~698) — this single function is called from both handleCheckoutSessionCompleted and handlePaymentIntentSucceeded, avoiding two call sites"
  - "Fanbasis emitTrackingPurchaseCompleted added to both new-payment and retry (already-completed+unassigned) paths — stable eventId deduplicates in the tracking layer anyway"

patterns-established:
  - "All purchase tracking emits are fire-and-forget: void emitTrackingPurchaseCompleted(payment) — never await, never let tracking block payment"
  - "PAP guard in shared util + PAP-specific emit at the PAP block = exactly one conversion event per purchase type"

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 11 Plan 02: purchaseCompleted/papPaymentCompleted Wiring Summary

**purchase_completed now fires at every standard payment-completion path (free/$0 + paid callback/stripe/fanbasis) carrying partnerClickId, usdAmount, FTD flag, and a stable dedup eventId; all papPaymentCompleted calls switched from billed payAfterPassRemainingPrice to usdAmount + currency:USD, with exactly one conversion-eligible event per PAP purchase guaranteed**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-01T11:38:00Z
- **Completed:** 2026-07-01T11:58:15Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- New `emitTrackingPurchaseCompleted(payment)` util with PAP-skip guard, FTD detection (countDocuments===1), attribution.partnerClickId source, currency:USD normalization, stable `purchase:<paymentId>` eventId
- Wired at all four standard completion sites: free-$0 (`payment.service.modular.ts:1512`), paid callback (`callback.service.ts:725`), paid stripe (`stripe-webhook.service.ts:708`), fanbasis (`fanbasis-webhook.service.ts:382`)
- Fixed both existing `papPaymentCompleted` calls (callback:866, stripe:511) + added fanbasis PAP call: all now use `usdAmount` (not billed `payAfterPassRemainingPrice`), `currency:"USD"`, stable `pap:<paymentId>` eventId, and conditional `partnerClickId` from `payment.attribution`

## Task Commits

1. **Task 1: Create emitTrackingPurchaseCompleted util + wire standard sites** - `644ccd39` (feat)
2. **Task 2: Fix papPaymentCompleted + fanbasis PAP/standard wiring** - `982ba9a1` (fix)

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts` - New util: PAP-skip guard, FTD count, USD normalization, stable eventId, fire-and-forget
- `pft-backend/src/app/modules/Payment/payment.service.modular.ts` - Import + call at free-$0 site (line 1512, after emitPurchaseCompletedWebhook)
- `pft-backend/src/app/modules/Payment/services/callback.service.ts` - Import + call at paid standard site (line 725, after payment.save()); fix papPaymentCompleted (line 866) with usdAmount/currency/eventId/partnerClickId
- `pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts` - Import + call at paid standard site (line 708, end of processPaymentCompletion after final save); fix papPaymentCompleted (line 511) same fields
- `pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts` - Import both TrackingEvents + emitTrackingPurchaseCompleted; add papPaymentCompleted in ensureProgramAssigned (line 260); add emitTrackingPurchaseCompleted in handlePaymentSuccess at new-payment path (line 382) and retry path (line 299)

## Decisions Made

### Fanbasis PAP decision (plan required explicit documentation)
Fanbasis DOES provision PAP funded-legs. Evidence: `ensureProgramAssigned` calls `FundedProgressionQueueService.deferPapFundedLegIfNeeded` (the same compliance gate used by callback/stripe for PAP KYC gating), then calls `ProgramService.assignProgramToUser` with `payAfterPass: freshPayment.payAfterPass`, `payAfterPassRemainingPrice`, etc. A PAP funded-leg CAN pass the compliance gate and be provisioned inline via fanbasis. **Branch taken: fanbasis IS a PAP funded-leg provider → papPaymentCompleted added in `ensureProgramAssigned` when `freshPayment.payAfterPass && freshPayment.currentProgramId`.**

### FTD count per site (plan required explicit documentation)
All three standard call sites (`payment.service.modular.ts`, `callback.service.ts`, `stripe-webhook.service.ts`) persist `status:"completed"` to the database BEFORE the completion side-effects run:
- `payment.service.modular.ts`: `updateOne({ status:"completed" })` runs before `emitPurchaseCompletedWebhook` → count `=== 1` correct
- `callback.service.ts`: `payment.save()` at line 717 persists `programAssigned=true` but `status` was already set to `"completed"` earlier (line 395/413 in the callback flow) → count `=== 1` correct
- `stripe-webhook.service.ts`: `payment.status = "completed"; await payment.save()` at lines 137-139 / 277-278 runs before `processPaymentCompletion` → count `=== 1` correct in all cases

**Decision: `countDocuments === 1` used at all sites.** No per-site `=== 0` exceptions needed.

### Stripe single finalize point
Both `handleCheckoutSessionCompleted` (line 192) and `handlePaymentIntentSucceeded` (line 281) call `processPaymentCompletion(payment)` as the single canonical finalize function. **The emit was placed once at the end of `processPaymentCompletion` (after the final `payment.save()` at line 698)**, not at each of the two callers. This avoids two call sites and the stable eventId deduplicates the rare case where both Stripe events fire for the same payment.

### Free PAP produces no conversion event (confirmed correct)
On the free-$0 path (`payment.service.modular.ts`), a free/100%-coupon PAP funded-leg calls `markPayAfterPassNextStageAssigned` but does NOT fire `papPaymentCompleted`. The util's PAP-skip guard then also filters out `purchase_completed` for it. Result: free PAP produces ZERO conversion-eligible events. This matches the locked decision ("$0 = registration postback only, no conversion postback — S2S fraud-filter risk").

## Deviations from Plan

None — plan executed exactly as written. The fanbasis investigation resulted in the "fanbasis DOES provision PAP funded-legs" branch (plan documented both branches; the implementation took the correct one).

## Issues Encountered

**Scoped tsc on trackingPurchaseEmit.ts**: Exited with errors, but ALL errors were in pre-existing unrelated files (Intercom, logger, config, metrics — pre-existing `TS1192`/`TS2307` issues). Zero errors from `trackingPurchaseEmit.ts` itself. This matches the known `reference_backend_tsc_oom.md` pattern — scoped tsc cannot be fully isolated because tsconfig pulls in all project files; CI is the authoritative typecheck.

## Verification Results

All plan verification checks passed:

```
emitTrackingPurchaseCompleted defined in trackingPurchaseEmit.ts: PASS
emitTrackingPurchaseCompleted imported + called in payment.service.modular.ts: PASS
emitTrackingPurchaseCompleted imported + called in callback.service.ts: PASS
emitTrackingPurchaseCompleted imported + called in stripe-webhook.service.ts: PASS
emitTrackingPurchaseCompleted imported + called in fanbasis-webhook.service.ts: PASS (two call sites: new-payment + retry)
PAP-skip guard (payAfterPass && currentProgramId → return): PASS (line 65 of util)
isFirstPurchase via countDocuments === 1: PASS
currency:"USD": PASS
attribution?.partnerClickId: PASS
stable eventId purchase:<paymentId>: PASS
papPaymentCompleted value switched to usdAmount (callback, stripe, fanbasis): PASS
payAfterPassRemainingPrice NOT used as value in any papPaymentCompleted: PASS (grep returned empty)
stable pap:<paymentId> eventId on all three papPaymentCompleted sites: PASS
Scoped tsc on util: pre-existing unrelated errors only — util itself compiles clean
```

## Next Phase Readiness
- Phase 12 (partnerPostback adapter) can now consume `purchase_completed` and `pap_payment_completed` events with `partnerClickId` + `usdAmount` + `currency:"USD"` + `isFirstPurchase` flag
- Phase 12 gates postback on `isFirstPurchase === true` to enforce once-per-user conversion guarantee
- All commits pushed to origin/main-2026 (644ccd39, 982ba9a1)

---
*Phase: 11-wire-emits-dedup*
*Completed: 2026-07-01*
