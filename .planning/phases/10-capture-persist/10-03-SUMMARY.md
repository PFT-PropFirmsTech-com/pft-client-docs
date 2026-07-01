---
phase: 10-capture-persist
plan: 03
subsystem: payments
tags: [crm, partner-tracking, attribution, payment, mongo, typescript]

# Dependency graph
requires:
  - phase: 10-capture-persist/10-02
    provides: partnerClickId on User doc (TUser + TRegisterUser + UserSchema) — the authoritative source this plan reads

provides:
  - partnerClickId?: string on PaymentAttribution interface
  - partnerClickId: String in Payment schema attribution subdocument
  - Standard checkout Payment.create persists attribution.partnerClickId from user.partnerClickId (mergedAttribution, skip-when-absent)
  - PAP funded-leg Payment.create persists attribution.partnerClickId from user.partnerClickId (skip-when-absent, undefined not {})

affects:
  - phase 11 (Tracking Events) — reads Payment.attribution.partnerClickId to send S2S postbacks after gateway callbacks
  - phase 12 (S2S Postback) — partnerClickId on Payment doc is the durable carry through req=null gateway/webhook paths

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skip-when-absent: only set attribution.partnerClickId when user.partnerClickId is truthy; undefined (not empty string) leaves field unset in Mongo"
    - "Server-authoritative override: mergedAttribution spreads client attribution then overlays server user.partnerClickId, so client cannot forge the partner clickid"
    - "PAP funded-leg attribution: set attribution field only for partnerClickId (no ad-platform ids available on PAP path); existing standard checkout ad-platform ids (fbc/gclid/etc) untouched"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Payment/payment.interface.ts
    - pft-backend/src/app/modules/Payment/payment.model.ts
    - pft-backend/src/app/modules/Payment/payment.service.modular.ts

key-decisions:
  - "mergedAttribution pattern: spread client attribution first, then overlay user.partnerClickId — preserves existing fbc/gclid/ttclid/etc from client body while ensuring server value is authoritative for partnerClickId"
  - "PAP funded-leg gets attribution field added (was previously absent) — attribution object contains only partnerClickId (no ad-platform ids on PAP path)"
  - "Scoped tsc produced only pre-existing project-wide errors (esModuleInterop, missing packages) — no new errors from our changes; rely on CI for full project typecheck"
  - "(user as any).partnerClickId cast used to avoid TS narrowing issues with existing user type shape before TUser extension landed in 10-02"

patterns-established:
  - "Payment attribution carry: any new tracking field on User doc → add to PaymentAttribution interface + attribution schema subdoc + persist at BOTH create sites (standard + PAP) using same skip-when-absent guard"

# Metrics
duration: 3min
completed: 2026-07-01
---

# Phase 10 Plan 03: Payment Attribution partnerClickId Persistence Summary

**`attribution.partnerClickId` persisted from authoritative User doc at BOTH Payment.create sites (standard checkout + PAP funded-leg), enabling req=null gateway/webhook callbacks to resolve partner clickid off the Payment doc**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-01T10:09:39Z
- **Completed:** 2026-07-01T10:12:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `partnerClickId?: string` to `PaymentAttribution` interface in payment.interface.ts
- Added `partnerClickId: String` to the attribution subdocument schema in payment.model.ts
- Standard checkout: builds `mergedAttribution` from `user.partnerClickId` (server-authoritative) and passes it to `Payment.create` — existing fbc/gclid/ttclid/msclkid/li_fat_id attribution fields preserved untouched
- PAP funded-leg: added `attribution` field to `Payment.create` (previously absent) populated only when `user.partnerClickId` is truthy; `undefined` otherwise (skip-when-absent, not `{}`)
- Committed + pushed to `main-2026` as `4a079169`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add partnerClickId to PaymentAttribution interface + attribution schema subdoc** - part of `4a079169` (feat)
2. **Task 2: Populate attribution.partnerClickId from user.partnerClickId at BOTH create sites** - part of `4a079169` (feat)
3. **Task 3: Commit + push Payment partnerClickId persistence to main-2026** - `4a079169` (feat)

**Plan metadata:** (docs commit below, separate)

## Verification Results

All plan verification greps passed:

```
payment.interface.ts:23:  partnerClickId?: string;
payment.model.ts:257:      partnerClickId: String, // Partner S2S tracking click id (from the buyer's User doc)
payment.service.modular.ts:311:      const mergedAttribution = (user as any)?.partnerClickId
payment.service.modular.ts:312:        ? { ...(attribution || {}), partnerClickId: (user as any).partnerClickId }
payment.service.modular.ts:535:          attribution: mergedAttribution,
payment.service.modular.ts:2771:        attribution: (user as any)?.partnerClickId ? { partnerClickId: (user as any).partnerClickId } : undefined,
```

- Standard checkout: `mergedAttribution` built at line 311-313, referenced at line 535 inside `Payment.create`
- PAP funded-leg: `attribution` added at line 2771 inside PAP `Payment.create` (was previously absent)
- Commit HEAD `4a079169` == `origin/main-2026` — clean push

## Files Created/Modified
- `pft-backend/src/app/modules/Payment/payment.interface.ts` — `partnerClickId?: string` added to `PaymentAttribution` interface after `li_fat_id`, with comment distinguishing it from ad-platform ids
- `pft-backend/src/app/modules/Payment/payment.model.ts` — `partnerClickId: String` added to attribution subdocument type definition after `li_fat_id`
- `pft-backend/src/app/modules/Payment/payment.service.modular.ts` — `mergedAttribution` computed after user resolution at line 311; standard `Payment.create` now uses `attribution: mergedAttribution`; PAP `Payment.create` now includes `attribution: user?.partnerClickId ? { partnerClickId: ... } : undefined`

## Decisions Made
- `mergedAttribution` spread pattern: `{ ...(attribution || {}), partnerClickId: user.partnerClickId }` — client-sent ad-platform ids preserved, server-side partnerClickId overlaid as authoritative
- PAP funded-leg: only `partnerClickId` in the attribution object (no ad-platform ids available on that path) — distinct minimal form vs standard checkout
- `(user as any)` cast: PAP `user` is typed from `User.findById(userId)` which returns the full Mongoose doc; standard checkout `user` is typed from `UserService.createOrUpdateUser`. Cast avoids TS narrowing issues with the `partnerClickId` field added in 10-02 — CI will validate the full type chain
- Pre-existing tsc errors (esModuleInterop, missing prom-client/mqtt/libphonenumber-js packages) are project-wide and unrelated to our changes; relied on CI per plan constraint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — pre-existing project-wide tsc errors (esModuleInterop, missing packages) appeared in scoped tsc output as expected; all are unrelated to our changes and pre-dated this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CRM-03 complete: `attribution.partnerClickId` is now stored on Payment docs at checkout creation time for both standard and PAP flows
- Phase 11 (Tracking Events / `signupCompleted` + `purchaseCompleted` callers) can now read `payment.attribution.partnerClickId` directly when building S2S postback payloads — the value survives even when gateway callbacks run with `req=null`
- No blockers for Phase 11 or Phase 12

---
*Phase: 10-capture-persist*
*Completed: 2026-07-01*
