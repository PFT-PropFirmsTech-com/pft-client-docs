---
phase: 13-purchase-failure-tracking-wiring
plan: 03
subsystem: payments
tags: [klaviyo, purchase-tracking, stripe, fanbasis, paypal, webhooks]

# Dependency graph
requires:
  - phase: 13-01
    provides: emitTrackingPurchaseFailed(payment, errorCode?) shared util
provides:
  - purchase_failed emit wired at Stripe's 2 genuine decline/expiry handlers
  - purchase_failed emit wired at FanBasis's 3 genuine failed/expired/cancelled handlers
  - purchase_failed emit wired at PayPal's 1 genuine capture-denied handler
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget emit call placed immediately after payment.save(), never before persistence"
    - "Security/fraud-guard failed-status branches deliberately left unwired to avoid mislabeling defenses as lost sales"

key-files:
  modified:
    - pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts
    - pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts
    - pft-backend/src/app/modules/Payment/services/paypal-webhook.service.ts

key-decisions:
  - "Left all currency/amount-mismatch security-guard failed branches unwired across all 3 gateways (Stripe x4, FanBasis x2, PayPal x7) — these are fraud/integrity defenses, not genuine customer declines, and firing purchase_failed there would corrupt Klaviyo segment quality"
  - "PayPal uses normalized 'card_declined' code, not the raw declineReason gateway string, to avoid leaking processor-response detail into a third-party marketing platform"

# Metrics
duration: 8 min
completed: 2026-07-03
---

# Phase 13 Plan 03: Explicit Gateway Purchase-Failure Wiring Summary

**Wired `emitTrackingPurchaseFailed` into exactly 6 genuine customer-facing failure/expiry/cancel webhook handlers across Stripe, FanBasis, and PayPal — leaving 13 internal security/fraud-guard branches deliberately silent**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-03T11:09:00Z (approx)
- **Completed:** 2026-07-03T11:17:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Stripe: `handlePaymentIntentFailed()` now fires `purchase_failed` with `"card_declined"`, and `handleCheckoutSessionExpired()` fires with `"checkout_expired"` — both immediately after their existing `payment.save()`.
- FanBasis: `handlePaymentFailed()` fires `"gateway_failed"`, `handlePaymentExpired()` fires `"checkout_expired"`, `handlePaymentCanceled()` fires `"cancelled"` — all three after their `payment.save()`.
- PayPal: `handleCaptureDenied()` fires `"card_declined"` after its `payment.save()` — the one genuine decline handler among 8 `status = "failed"` writes in the file.
- Confirmed via exact `grep -c` counts that no security/validation-guard branch was accidentally wired: Stripe 2/2, FanBasis 3/3, PayPal 1/1.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Stripe + FanBasis failure/expiry/cancel handlers** - `77b0f3fe` (feat)
2. **Task 2: Wire PayPal capture-denied handler** - `b6042d66` (feat)

**Plan metadata:** (pending — recorded below)

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts` - `emitTrackingPurchaseFailed` import + 2 emit calls (payment-intent-failed, checkout-session-expired)
- `pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts` - `emitTrackingPurchaseFailed` import + 3 emit calls (failed, expired, canceled)
- `pft-backend/src/app/modules/Payment/services/paypal-webhook.service.ts` - `emitTrackingPurchaseFailed` import + 1 emit call (capture-denied)

## Decisions Made
- Deliberately left unwired: Stripe's 4 currency/amount-mismatch security branches (inside `handleCheckoutSessionCompleted`/`handlePaymentIntentSucceeded`), FanBasis's 2 amount/currency-mismatch branches (inside `handlePaymentSuccess`), and PayPal's 7 other `status = "failed"` writes (order-validation/duplicate-capture/amount-mismatch guards across `handleOrderApproved`, `handleCaptureCompleted`, `handleOrderCompleted`) — all are internal fraud/integrity defenses inside otherwise-succeeding flows, not genuine customer declines. Firing `purchase_failed` there would mislabel a security event as a lost sale and corrupt Klaviyo segment quality.
- PayPal's emit uses the normalized `"card_declined"` code rather than the raw `declineReason` extracted from the gateway payload, per the util's documented closed-vocabulary contract (avoids leaking processor-response strings into Klaviyo).

## Deviations from Plan

None - plan executed exactly as written. All call-site line numbers, handler names, and error codes matched the plan's specification precisely.

## Issues Encountered
- Scoped `tsc --noEmit --skipLibCheck` on the three touched files surfaces the same pre-existing, unrelated errors documented in 13-01's summary (missing `esModuleInterop`/`downlevelIteration` flags in ad-hoc invocation, affecting transitively-imported modules like `Intercom/*`, `utils/logger.ts`, `config/index.ts`, and — new in this plan's PayPal file — two `MapIterator` iteration errors on lines 36/42 of `paypal-webhook.service.ts` inside pre-existing in-memory dedup/lock-cleanup code untouched by this plan). Confirmed via `git diff` that these lines were not modified by this plan and via targeted `grep` that zero errors are attributed to lines this plan changed. No fix applied (out of scope, pre-existing tooling condition).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 (Purchase-Failure Tracking Wiring) is now code-complete across all three plans: 13-01 (foundation util), 13-02 (cron/callback generic coverage), 13-03 (explicit gateway coverage — this plan).
- Every genuine customer-facing purchase-flow terminal failure — abandoned-checkout sweep, generic provider-agnostic callback path, and now Stripe/FanBasis/PayPal explicit gateway declines/expiries/cancellations — reaches Klaviyo as `purchase_failed` with a normalized `reason`/`error_code`, fired exactly once, after persistence.
- No blockers. Live verification (webhook fires actually reaching Klaviyo in a real gateway sandbox) is deferred to the next main-2026 deploy per project-wide convention — consistent with all other v1.0-v1.3 milestones awaiting the same gate.

---
*Phase: 13-purchase-failure-tracking-wiring*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts
- FOUND: pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts
- FOUND: pft-backend/src/app/modules/Payment/services/paypal-webhook.service.ts
- FOUND commit: 77b0f3fe (Task 1)
- FOUND commit: b6042d66 (Task 2)
