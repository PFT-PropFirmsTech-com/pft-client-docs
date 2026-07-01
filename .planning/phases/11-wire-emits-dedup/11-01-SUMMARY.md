---
phase: 11-wire-emits-dedup
plan: "01"
subsystem: tracking
tags: [crm, partner-tracking, tracking-events, auth, typescript]

# Dependency graph
requires:
  - phase: 10-capture-persist
    provides: partnerClickId persisted on User doc (CRM-02) and Payment.attribution (CRM-03)
provides:
  - ITrackingEventPayload.partnerClickId + isFirstPurchase fields on tracking interface
  - signupCompleted/purchaseCompleted/papPaymentCompleted arg types extended with partnerClickId + isFirstPurchase + eventId
  - TrackingEvents.signupCompleted wired at both registration-completion sites in auth.service.ts
affects:
  - 11-02 (purchaseCompleted/papPaymentCompleted wiring — type surface ready)
  - 12-partner-postback (consumes signup_completed partnerClickId + isFirstPurchase gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "skip-when-absent spread: ...( x ? { partnerClickId: x } : {} ) — never emit empty string"
    - "stable eventId scheme: signup:<userId> — overrides minute-bucketed deterministicEventId for cross-minute dedup"
    - "fire() spreads args into payload — eventId flows through without dispatcher change"
    - "FTD signal via isFirstPurchase boolean flag, not event suppression — Phase 12 enforces once-per-user at send"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Tracking/tracking.interface.ts
    - pft-backend/src/app/modules/Tracking/tracking.events.service.ts
    - pft-backend/src/app/modules/Auth/auth.service.ts

key-decisions:
  - "eventId passthrough requires NO dispatcher change — fire() already spreads args into payload; eventId just needed to be a typed field on the arg type"
  - "OTP registeredUser carries partnerClickId without projection fix — findByIdAndUpdate({ new: true }).toObject() returns the full user doc including Phase 10 partnerClickId field"
  - "FTD expressed as isFirstPurchase boolean on shared events (not event suppression) — purchase_completed / pap_payment_completed fire on every purchase; Phase 12 gates postback on isFirstPurchase=true"

patterns-established:
  - "Partner field extension pattern: add to ITrackingEventPayload interface + extend each relevant helper arg type (3 helpers for purchase path)"
  - "Registration event fire-and-forget: no .catch needed (signupCompleted is internally fire-and-forget), placed immediately after FacebookPixelService CompleteRegistration call"

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 11 Plan 01: Wire Emits + Dedup Summary

**signup_completed wired at both registration paths with stable userId-derived eventId and skip-when-absent partnerClickId; shared type surface (partnerClickId/isFirstPurchase/eventId) landed on ITrackingEventPayload and purchase helper signatures for plan 11-02**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-01T11:35:00Z
- **Completed:** 2026-07-01T11:50:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `ITrackingEventPayload` with `partnerClickId?` (raw partner S2S click-id) and `isFirstPurchase?` (FTD signal) with design notes baked in
- Extended `signupCompleted`, `purchaseCompleted`, and `papPaymentCompleted` helper arg types with `partnerClickId`, `isFirstPurchase` (purchase only), and `eventId` — the `fire()` spread already carries these through, no dispatcher change needed
- Wired `TrackingEvents.signupCompleted()` at both registration-completion sites: one-step (~:659) and two-step OTP (~:1047), each with stable `eventId=signup:<userId>` for cross-minute dedup and skip-when-absent `partnerClickId`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend tracking payload + helper signatures** - `8e2f7509` (feat)
2. **Task 2: Wire signupCompleted at both registration sites** - `44deb3d4` (feat)

## Files Created/Modified

- `pft-backend/src/app/modules/Tracking/tracking.interface.ts` - Added `partnerClickId?` + `isFirstPurchase?` to `ITrackingEventPayload` with inline design notes on FTD / multi-destination sharing
- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` - Extended `signupCompleted`, `purchaseCompleted`, `papPaymentCompleted` arg types; added `eventId` passthrough comments confirming no dispatcher change needed
- `pft-backend/src/app/modules/Auth/auth.service.ts` - Imported `TrackingEvents`; added `signupCompleted` call at one-step registration (~:659) and two-step OTP completion (~:1047)

## Decisions Made

- **No dispatcher change needed:** The `fire()` helper at tracking.events.service.ts line ~238 already does `{ eventName, ...(args as Partial<ITrackingEventPayload>) }` — the spread carries `eventId` from args into the payload automatically. Adding `eventId?` as a typed field on each helper arg type was sufficient.
- **OTP `registeredUser` carries `partnerClickId` without any projection fix:** `registeredUser` comes from `findByIdAndUpdate({ new: true }, { ..., $unset: {...} }).toObject()` — it returns the full user document including the Phase 10 `partnerClickId` field. No `.select()` fix was needed.
- **FTD as boolean flag, not suppression:** `purchase_completed` and `pap_payment_completed` are shared multi-destination events consumed by Meta CAPI, GA4, Klaviyo on every purchase. Suppressing them for repeat purchases would break these destinations. The `isFirstPurchase` boolean lets Phase 12's partnerPostback gate the conversion send without affecting other destinations.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

```
grep -n "partnerClickId|isFirstPurchase" src/app/modules/Tracking/tracking.interface.ts
225:  partnerClickId?: string;
237:  isFirstPurchase?: boolean;   (+ inline text mentions)

grep -c "signupCompleted" src/app/modules/Auth/auth.service.ts
2   (2 call sites; import line counted separately)

grep -n "signupCompleted|TrackingEvents" src/app/modules/Auth/auth.service.ts
30: import { TrackingEvents } from "../Tracking/tracking.events.service";
659: TrackingEvents.signupCompleted({
1047: TrackingEvents.signupCompleted({

Scoped tsc (tracking files): CLEAN — no errors in tracking.interface.ts or tracking.events.service.ts
(Pre-existing errors in intercom.service.ts / logger.ts / dotenv unrelated)
```

## Issues Encountered

None. Pre-existing tsc errors (intercom module, crypto default import, dotenv ESM) showed in scoped check output but none are in the three modified files — confirmed by filtering `grep -E "tracking\.interface|tracking\.events"` → empty, i.e., clean.

## Next Phase Readiness

- Plan 11-02 can now add `partnerClickId` + `isFirstPurchase` to `purchaseCompleted` / `papPaymentCompleted` call sites without a TypeScript error — the shared type surface is landed
- Phase 12 (partnerPostback adapter) has the event payload fields it needs: `partnerClickId` rides on `signup_completed`, and `isFirstPurchase` gates the conversion postback on `purchase_completed` / `pap_payment_completed`
- No blockers for 11-02

## Self-Check: PASSED

- FOUND: pft-backend/src/app/modules/Tracking/tracking.interface.ts
- FOUND: pft-backend/src/app/modules/Tracking/tracking.events.service.ts
- FOUND: pft-backend/src/app/modules/Auth/auth.service.ts
- FOUND: commit 8e2f7509 (Task 1)
- FOUND: commit 44deb3d4 (Task 2)

---
*Phase: 11-wire-emits-dedup*
*Completed: 2026-07-01*
