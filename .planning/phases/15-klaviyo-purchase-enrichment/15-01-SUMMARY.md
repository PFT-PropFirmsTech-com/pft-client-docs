---
phase: 15-klaviyo-purchase-enrichment
plan: 01
subsystem: tracking
tags: [klaviyo, tracking, mongoose, typescript]

# Dependency graph
requires:
  - phase: 14-klaviyo-language-property
    provides: "ITrackingEventPayload.language field + Klaviyo profile Language attribute (built on top of, not replaced)"
provides:
  - "platform?/addons?[] fields on ITrackingEventPayload"
  - "Widened purchaseCompleted/purchaseFailed/papPaymentCompleted arg shapes accepting full program+commerce context"
  - "Klaviyo buildProperties() forwarding platform + addons (addons omitted when empty)"
  - "Shared resolveProgramContext(programId) util returning normalized {programName, platform, challengeType, phase, accountSize}"
affects: [15-02, 15-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lean single-select Program lookup util (fire-and-forget safe, never throws, returns {} on miss/error) as the pattern for turning an ID into denormalized display/segment fields for tracking"

key-files:
  created:
    - pft-backend/src/app/modules/Payment/utils/resolveProgramContext.ts
  modified:
    - pft-backend/src/app/modules/Tracking/tracking.interface.ts
    - pft-backend/src/app/modules/Tracking/tracking.events.service.ts
    - pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts

key-decisions:
  - "addons forwarded as array (not joined string) so Klaviyo can segment on membership; empty/absent array omitted entirely rather than sent as []"
  - "resolveProgramContext lives under Payment/utils (not Tracking) since it's a Program-lookup concern that Payment-side emit utils call — mirrors the existing trackingPurchaseEmit.ts/trackingPurchaseFailedEmit.ts co-location pattern"
  - "purchaseFailed and papPaymentCompleted widened to accept the same program+commerce fields as purchaseCompleted, closing the pre-existing asymmetry called out in the plan (SC3)"

# Metrics
duration: 5min
completed: 2026-07-03
---

# Phase 15 Plan 01: Tracking Payload + Klaviyo Allowlist + resolveProgramContext Foundation Summary

**Widened ITrackingEventPayload/purchase helpers with platform+addons, promoted both into Klaviyo's buildProperties() allowlist, and added a new resolveProgramContext(programId) util for Wave-2 emit utils to source program-context fields from the Program model.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-03T13:08:00Z (approx.)
- **Completed:** 2026-07-03T13:10:13Z
- **Tasks:** 3
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- `ITrackingEventPayload` now carries `platform?: string` and `addons?: string[]` alongside the existing programName/accountSize/challengeType/phase/couponCode/language fields, each with a comment marking it as a normalized (never raw-gateway) value.
- All three purchase-related typed helpers (`purchaseCompleted`, `purchaseFailed`, `papPaymentCompleted`) widened to accept the full program+commerce context. `purchaseFailed` in particular went from a narrow 8-field shape to also accepting `programId/programName/accountSize/challengeType/platform/phase/paymentMethod/orderId/couponCode/addons` — closing the asymmetry with `purchaseCompleted` (plan SC3).
- Klaviyo's `buildProperties()` now forwards `platform` and `addons` into the outgoing event properties, staying table-driven (no event-name branching). `addons` is explicitly omitted when the array is empty or absent so a no-add-on purchase never sends a stray `[]`.
- New `resolveProgramContext(programId)` util (`Payment/utils/resolveProgramContext.ts`) does a lean, single-`.select()` `Program.findById` and returns `{programName, platform, challengeType, phase, accountSize}`, mapping `name || displayName` for the display name and normalizing `accountSize` to a string. Guards missing `programId`, wraps the query in try/catch, and never throws — matching the fire-and-forget contract of the existing `trackingPurchaseEmit.ts`/`trackingPurchaseFailedEmit.ts` call sites that will consume it in Wave 2 (plans 02/03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add platform + addons fields to payload type and widen the 3 purchase helper signatures** - `84aa634b` (feat)
2. **Task 2: Promote platform + addons into the Klaviyo property allowlist** - `a6929260` (feat)
3. **Task 3: Create the shared resolveProgramContext util** - `4a69c3c9` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `pft-backend/src/app/modules/Tracking/tracking.interface.ts` - Added `platform?: string` and `addons?: string[]` to `ITrackingEventPayload`'s domain-specific data block
- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` - Widened `purchaseCompleted`/`purchaseFailed`/`papPaymentCompleted` arg types to accept platform/addons plus the shared program+commerce fields
- `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts` - `buildProperties()` now sets `platform` and `addons` (addons omitted when empty)
- `pft-backend/src/app/modules/Payment/utils/resolveProgramContext.ts` (new) - Exports `resolveProgramContext()` + `ResolvedProgramContext`, a lean fire-and-forget-safe Program lookup

## Decisions Made
- `addons` is forwarded as a real array rather than a joined string, so Klaviyo segments can filter on array membership; an empty/absent array is omitted entirely (never sent as `[]`) to avoid noisy empty properties on the majority of purchases with no add-ons.
- `resolveProgramContext` was placed under `Payment/utils/` (not `Tracking/`) since it's fundamentally a Program-lookup helper that Payment-side purchase emit utils (Wave 2) will call — this mirrors the existing co-location of `trackingPurchaseEmit.ts` and `trackingPurchaseFailedEmit.ts` in the same directory.
- Both `purchaseFailed` and `papPaymentCompleted` were widened symmetrically with `purchaseCompleted` even though the plan's "must haves" only called out `platform`/`addons` explicitly — the plan's own task instructions required the additional `couponCode`/`phase`/`programId`/`programName`/`accountSize`/`challengeType`/`paymentMethod`/`orderId` fields too, so all three helpers now share the same context vocabulary.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan only touches internal TypeScript types/utils; no new Klaviyo event/metric names, env vars, or dashboard config.

## Next Phase Readiness
- Foundation is in place for Wave-2 plans (15-02, 15-03) to call `resolveProgramContext()` from the existing `trackingPurchaseEmit.ts`/`trackingPurchaseFailedEmit.ts`/PAP completion call sites and pass `platform`/`addons` through to the now-widened `TrackingEvents.*` helpers.
- No blockers. All changes are additive and backward-compatible — every new field is optional, so existing call sites compile and behave unchanged until Wave-2 plans start passing the new fields.
- Scoped `tsc --skipLibCheck` across all four touched/created files shows zero errors attributable to this plan's changes.

---
*Phase: 15-klaviyo-purchase-enrichment*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Payment/utils/resolveProgramContext.ts
- FOUND: pft-backend/src/app/modules/Tracking/tracking.interface.ts
- FOUND: pft-backend/src/app/modules/Tracking/tracking.events.service.ts
- FOUND: pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts
- FOUND commit: 84aa634b
- FOUND commit: a6929260
- FOUND commit: 4a69c3c9
