---
phase: 13-purchase-failure-tracking-wiring
plan: 02
subsystem: tracking
tags: [klaviyo, purchase-tracking, payment, cron, callback, nowpayments, paysafe]

# Dependency graph
requires:
  - phase: 13-purchase-failure-tracking-wiring
    provides: emitTrackingPurchaseFailed(payment, errorCode?) shared util (13-01)
provides:
  - purchase_failed emit wired into the hourly stale-payment expiry cron (checkAndExpirePendingPayments)
  - purchase_failed emit wired into the generic callback handler (handleNonCompletedPayment), covering both NOWPayments/crypto and Paysafe
affects: [13-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch failure errorCode on pre-fetched id-set membership, not on stale in-memory status string, when a bulk update has already mutated DB state out from under an already-fetched array"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Payment/services/cron.service.ts
    - pft-backend/src/app/modules/Payment/services/callback.service.ts

key-decisions:
  - "Cron fires from the already-fetched stalePayments array only, branching on a processingIdSet built before the two bulk updateMany calls — avoids a second status-keyed query that could re-fire on historically-expired docs"
  - "Callback handler wiring covers Paysafe without a separate call site, since PaymentController.handlePaysafeCallback also calls PaymentService.handleCallback → handleNonCompletedPayment"

patterns-established:
  - "For post-bulk-update loops over a pre-fetched array, build an id Set from the pre-update classification arrays and check membership — never trust payment.status from the array after a bulk write has changed it in the DB"

# Metrics
duration: 8 min
completed: 2026-07-03
---

# Phase 13 Plan 02: Cron + Generic Callback Purchase-Failure Wiring Summary

**Wired `emitTrackingPurchaseFailed` into the hourly stale-payment expiry cron and the generic NOWPayments/Paysafe callback handler, covering the two highest-volume provider-agnostic failure paths with normalized `checkout_expired`/`gateway_failed` error codes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-03T11:15:00Z (approx)
- **Completed:** 2026-07-03T11:23:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `CronService.checkAndExpirePendingPayments()` now fires `purchase_failed` for every stale payment it sweeps, sourced entirely from the already-fetched `stalePayments` array — no second query, no branching on the stale in-memory status string. A `processingIdSet` built from the pre-update `processingIds` array is used for O(1) membership checks to distinguish `checkout_expired` (was pending) from `gateway_failed` (was stuck processing).
- `PaymentService`'s generic `handleNonCompletedPayment(payment, status)` now fires `purchase_failed` inside its existing `failed`/`expired` branch, immediately after the existing notification call. Confirmed this single call site covers both NOWPayments/crypto callbacks and Paysafe callbacks, since Paysafe's webhook controller (`PaymentController.handlePaysafeCallback`) also routes through `PaymentService.handleCallback` → `handleNonCompletedPayment` — resolving the research's open Paysafe-routing question with no separate call site needed.
- Both call sites are fire-and-forget (`void`, never `await`), matching the util's safety contract from 13-01.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire cron expiry sweep (expired + stuck-processing-failed)** - `148f2b93` (feat)
2. **Task 2: Wire generic callback handler (covers NOWPayments/crypto + Paysafe)** - `5fa9d399` (feat)

**Plan metadata:** (recorded below, in parent planning repo)

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/services/cron.service.ts` - Imports `emitTrackingPurchaseFailed`; builds `processingIdSet` before the existing logging loop; fires the emit inside that loop with `checkout_expired`/`gateway_failed` branching on id-set membership.
- `pft-backend/src/app/modules/Payment/services/callback.service.ts` - Imports `emitTrackingPurchaseFailed`; fires it inside `handleNonCompletedPayment`'s existing `if (status === "failed" || status === "expired")` block, after the existing `sendPaymentStatusNotification` call.

## Decisions Made
- No new decisions beyond what 13-01 already locked in. Implementation followed the plan's exact guidance: pre-fetched-array + id-set branching for the cron (to survive the bulk `updateMany` mutating DB state out from under the in-memory `stalePayments` array), and reuse of the existing generic callback branch (already correctly scoped to `failed`/`expired` only, leaving `cancelled` untouched for 13-03 to handle at FanBasis's own site).

## Deviations from Plan

None - plan executed exactly as written. Both call sites matched the plan's described existing code shape precisely (verified via Read before editing), so no bugs, missing critical functionality, or blockers were encountered.

## Issues Encountered

None. Scoped `tsc --noEmit --skipLibCheck` on both target files produced zero errors attributable to `cron.service.ts` or `callback.service.ts` — only the same pre-existing, unrelated errors from transitively-imported files (Intercom module, `logger.ts`, `config/index.ts`) already documented in 13-01's summary and STATE.md as a known tooling artifact (missing `esModuleInterop`/`downlevelIteration` flags when invoking `tsc` directly on file paths vs. the project's real `tsconfig.json`).

Note: this plan ran in parallel with 13-03 (Stripe + FanBasis webhook wiring) in the same `pft-backend` working tree. Files were staged individually (`git add <exact path>`, never `-A`/`.`) at each commit to avoid sweeping the other agent's in-flight, uncommitted changes into these commits. Confirmed via `git status --short` before each commit that only the intended file was staged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two highest-volume, provider-agnostic failure paths (hourly expiry cron; generic NOWPayments+Paysafe callback handler) now emit `purchase_failed` to Klaviyo with a populated `reason`/`error_code`, closing the reported Trading Cult symptom (expired payment producing no Klaviyo signal) at its actual origin.
- Ready for 13-03 (Stripe + FanBasis-specific wiring, including FanBasis's `cancelled` status) — confirmed already complete in parallel (commit `77b0f3fe` visible in `git log`), touching disjoint files (`stripe-webhook.service.ts`, `fanbasis-webhook.service.ts`).
- No blockers.

---
*Phase: 13-purchase-failure-tracking-wiring*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Payment/services/cron.service.ts
- FOUND: pft-backend/src/app/modules/Payment/services/callback.service.ts
- FOUND commit: 148f2b93 (Task 1)
- FOUND commit: 5fa9d399 (Task 2)
