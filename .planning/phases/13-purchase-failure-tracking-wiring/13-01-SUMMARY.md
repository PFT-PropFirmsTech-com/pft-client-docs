---
phase: 13-purchase-failure-tracking-wiring
plan: 01
subsystem: tracking
tags: [klaviyo, purchase-tracking, payment, dedup]

# Dependency graph
requires:
  - phase: 12-partner-postback-crm
    provides: emitTrackingPurchaseCompleted pattern (proven fire-and-forget emit shape) to mirror
provides:
  - Extended TrackingEvents.purchaseFailed() helper accepting reason + eventId
  - Klaviyo adapter buildProperties() promoting reason/error_code into outgoing event properties
  - Shared emitTrackingPurchaseFailed(payment, errorCode?) util for downstream call sites
affects: [13-02, 13-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared fire-and-forget tracking emit util per event type (emitTrackingPurchaseFailed mirrors emitTrackingPurchaseCompleted)"
    - "Table-driven adapter property promotion (buildProperties set() calls) instead of event-name branching"

key-files:
  created:
    - pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts
  modified:
    - pft-backend/src/app/modules/Tracking/tracking.events.service.ts
    - pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts

key-decisions:
  - "eventId namespaced as purchase_failed:<paymentId>, distinct from completion's purchase:<paymentId>, so a fail-then-retry-as-new-payment sequence never collides dedup keys"
  - "No PAP-skip guard on the failed-emit util — genuine PAP funded-leg failures should still fire purchase_failed; only the two internal supersede/dedup bookkeeping writes are excluded, by not calling the util from those sites (deferred to 13-02/13-03)"

patterns-established:
  - "emitTrackingPurchaseFailed(payment, errorCode?): loose PaymentLike interface, usdAmount+USD-only value, fire-and-forget try/catch, stable eventId — the shape every future emit util in this codebase should mirror"

# Metrics
duration: 12 min
completed: 2026-07-03
---

# Phase 13 Plan 01: Purchase-Failure Tracking Foundation Summary

**Shared `emitTrackingPurchaseFailed` util plus `purchaseFailed` helper + Klaviyo adapter fixes so `reason`/`error_code` reach Klaviyo with a USD-normalized value and a stable dedup eventId**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-03T11:00:00Z (approx)
- **Completed:** 2026-07-03T11:12:32Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `TrackingEvents.purchaseFailed()` now accepts optional `reason` and `eventId`, mirroring `purchaseCompleted`'s existing `eventId` convention — no dispatcher change needed since `fire()` already spreads args into the payload.
- Klaviyo adapter's `buildProperties()` now promotes `payload.reason` → `reason` and `payload.errorCode` → `error_code` into the outgoing Klaviyo event properties (previously silently dropped despite existing on the payload type).
- New `emitTrackingPurchaseFailed(payment, errorCode?)` util created at `pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts`, mirroring the proven `emitTrackingPurchaseCompleted` shape: loose `PaymentLike` interface, fire-and-forget try/catch, `usdAmount`+`"USD"`-only value (guards JPY-as-USD), and a stable `purchase_failed:<paymentId>` eventId.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend purchaseFailed helper + promote reason/error_code in Klaviyo adapter** - `c8382daf` (feat)
2. **Task 2: Create shared emitTrackingPurchaseFailed util** - `aa3d6d33` (feat)

**Plan metadata:** (pending — recorded below)

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts` - New shared fire-and-forget emitter for purchase failures
- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` - `purchaseFailed` helper gains `reason` + `eventId` optional args
- `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts` - `buildProperties()` promotes `reason` + `error_code`

## Decisions Made
- Used a distinct eventId namespace (`purchase_failed:<paymentId>`) rather than reusing the completion util's `purchase:<paymentId>` prefix, so a payment that fails and is retried as a new payment document never collides dedup keys across the two event types.
- Deliberately omitted a PAP-skip guard in the new util — unlike completions, a genuinely failed/expired PAP funded-leg payment should still fire `purchase_failed`. The two internal PAP supersede/dedup bookkeeping writes (bulk `updateMany`/`updateOne`, no hydrated doc) are excluded simply by not being wired to call this util — that wiring happens in 13-02/13-03, not via a guard here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules / typescript**
- **Found during:** Task 1 verification
- **Issue:** `npx tsc` failed with "This is not the tsc command you are looking for" — `node_modules` was not installed in `pft-backend/` (fresh checkout), so no local `tsc` binary existed to run the scoped verification command specified in the plan.
- **Fix:** Ran `npm install` in `pft-backend/` to install dependencies from the existing `package-lock.json`.
- **Files modified:** None tracked by git (node_modules is gitignored); no package.json/lockfile changes.
- **Verification:** `npx tsc --noEmit --skipLibCheck <files>` ran successfully afterward.
- **Committed in:** N/A (node_modules not committed; no lockfile drift)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to run the plan's own verification commands. No scope creep — no application code changed as part of this fix.

## Issues Encountered
- Scoped `tsc` (run without the project's `tsconfig.json`, per the plan's literal verify command) surfaces a set of pre-existing, unrelated errors in transitively-imported files (`Intercom/*`, `utils/logger.ts`, `config/index.ts`, `enrichment/hash.ts`) caused by missing `esModuleInterop`/`downlevelIteration` flags that ARE set in the project's actual `tsconfig.json` but not applied when invoking `tsc` directly on file paths. Confirmed via `grep` that no errors are attributed to the three files this plan touched or created. This is a pre-existing condition of the codebase/tooling, not introduced by this plan — documented here for visibility, no fix applied (out of scope).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `emitTrackingPurchaseFailed` is ready for import at real failure call sites — plans 13-02 and 13-03 will wire it into genuine customer-facing failure/expiry paths (gateway declines, checkout expiry, etc.), explicitly excluding the two internal PAP supersede/dedup bookkeeping writes.
- No blockers. Klaviyo adapter and helper changes are backward-compatible (new fields are optional, existing call sites unaffected).

---
*Phase: 13-purchase-failure-tracking-wiring*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts
- FOUND: pft-backend/src/app/modules/Tracking/tracking.events.service.ts
- FOUND: pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts
- FOUND commit: c8382daf (Task 1)
- FOUND commit: aa3d6d33 (Task 2)
