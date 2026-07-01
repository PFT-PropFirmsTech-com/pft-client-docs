---
phase: 12-partner-postback-adapter
plan: 01
subsystem: api
tags: [tracking, crm, partner-postback, typescript, mongoose, zod]

# Dependency graph
requires:
  - phase: 11-wire-emits-dedup
    provides: "signup_completed/purchase_completed/pap_payment_completed events fired with partnerClickId + isFirstPurchase + stable eventIds"
provides:
  - "partnerPostback as a DestinationName (DESTINATIONS tuple)"
  - "IPartnerPostbackConfig interface (registrationUrl + conversionUrl + IDestinationToggle fields)"
  - "ITrackingSettings.destinations.partnerPostback typed field"
  - "PartnerPostbackConfigSchema mongoose sub-schema (disabled + empty-URL defaults)"
  - "PUT /api/tracking/settings validation accepts partnerPostback block (no silent strip)"
  - "DEFAULT_EVENT_TOGGLES matrix: partnerPostback column, true only for signup_completed/purchase_completed/pap_payment_completed"
affects:
  - 12-02-partner-postback-adapter

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "destinationBase<T>() reuse pattern for new destinations: schema + events toggle map + disabled default"
    - "Zod validation block mirrors conversionWebhook pattern (url().optional().or(literal('')))"
    - "partnerPostback: false for all free/$0 events enforces locked S2S fraud-filter decision at config layer"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Tracking/tracking.interface.ts
    - pft-backend/src/app/modules/Tracking/tracking.constants.ts
    - pft-backend/src/app/modules/Tracking/tracking.model.ts
    - pft-backend/src/app/modules/Tracking/tracking.validation.ts

key-decisions:
  - "No Trading Cult URLs hardcoded — registrationUrl/conversionUrl default empty string; set via PUT /api/tracking/settings post-deploy"
  - "partnerPostback: false for all free_trial_signup, free_challenge_signup, pap_free_signup (locked: $0 events = registration postback only via signup_completed, never conversion)"
  - "No toJSON masking entry for partnerPostback — URLs are not credentials"
  - "Matrix row completeness enforced at compile time: TS2741 fires if any EventName row omits partnerPostback"

patterns-established:
  - "New destination = 4 files: DESTINATIONS tuple + interface + model sub-schema + validation block — plan 12-02 adapter uses this shape"

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 12 Plan 01: Partner Postback Config Summary

**`partnerPostback` added as a first-class DestinationName with IPartnerPostbackConfig (registrationUrl + conversionUrl), PartnerPostbackConfigSchema (disabled + empty-URL defaults), PUT validation block, and matrix column true only for the three conversion-eligible events**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T00:00:00Z
- **Completed:** 2026-07-01
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `partnerPostback` registered in DESTINATIONS tuple — `DestinationName` type includes it automatically; dispatcher + `destinationAcceptsEvent()` gate recognize it with zero other code changes
- `IPartnerPostbackConfig` interface mirrors `IConversionWebhookConfig` shape but with `registrationUrl`/`conversionUrl` instead of webhook fields; extends `IDestinationToggle` for `enabled`/`useGtm`/`events`
- `PartnerPostbackConfigSchema` via `destinationBase<T>()` with `enabled: false` default + empty-string URL defaults — no brand fires until admin explicitly configures
- `upsertTrackingSettingsValidation` extended with `partnerPostback` block — without this, zod strips unknown keys and `PUT /api/tracking/settings` silently drops the config
- Matrix column set: `partnerPostback: true` on exactly `signup_completed`, `purchase_completed`, `pap_payment_completed`; `false` for all 31 other events including all free/$0 events

## Task Commits

All tasks committed in a single atomic commit (all four files are one logical unit):

1. **Task 1: DESTINATIONS + IPartnerPostbackConfig + ITrackingSettings.destinations** - `702b312f` (feat)
2. **Task 2: DEFAULT_EVENT_TOGGLES matrix column (type + all 34 rows)** - `702b312f` (feat)
3. **Task 3: PartnerPostbackConfigSchema + upsertTrackingSettingsValidation block** - `702b312f` (feat)

**Commit:** `702b312f` pushed to `origin/main-2026`

## Files Created/Modified
- `pft-backend/src/app/modules/Tracking/tracking.interface.ts` — `"partnerPostback"` in DESTINATIONS (line 59); `IPartnerPostbackConfig` interface (line 122–127); `partnerPostback: IPartnerPostbackConfig` in `ITrackingSettings.destinations` (line 161)
- `pft-backend/src/app/modules/Tracking/tracking.constants.ts` — `partnerPostback: boolean` added to row type; all 34 event rows updated (3 true, 31 false)
- `pft-backend/src/app/modules/Tracking/tracking.model.ts` — `IPartnerPostbackConfig` imported; `PartnerPostbackConfigSchema` defined; registered under `destinations`
- `pft-backend/src/app/modules/Tracking/tracking.validation.ts` — `partnerPostback` block added to `upsertTrackingSettingsValidation.body.destinations`

## Verification Results

All plan <verify> checks passed:

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| `grep -c "partnerPostback: true" tracking.constants.ts` | 3 | 3 | PASS |
| `grep -c "partnerPostback:" tracking.constants.ts` | 35 | 35 | PASS |
| `grep -n "PartnerPostbackConfigSchema" tracking.model.ts` | 2 hits | 2 (def + registration) | PASS |
| `grep -n "partnerPostback" tracking.validation.ts` | 1 hit | 1 | PASS |
| Scoped tsc across all 4 files | 0 errors | 0 errors | PASS |

## Decisions Made
- No Trading Cult-specific URLs hardcoded — config is brand-neutral; actual URL templates set via `PUT /api/tracking/settings` after deploy
- `partnerPostback: false` for all free-program events (`free_trial_signup`, `free_challenge_signup`, `pap_free_signup`) — locked decision: $0 events must not fire S2S conversion postback (fraud-filter risk); registration signal comes via `signup_completed: true`
- No `toJSON` masking for `partnerPostback` — URL templates are not credentials (unlike `webhookSecret`, `accessToken`, etc.)
- Single commit for all four files — they form one atomic config-layer unit; splitting would leave type/schema/validation temporarily inconsistent

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required at this stage. Trading Cult URL templates are set post-deploy via `PUT /api/tracking/settings` (admin UI or direct API call).

## Next Phase Readiness

Plan 12-02 can now:
- Import `IPartnerPostbackConfig` from `tracking.interface.ts` for typed config access
- Reference `"partnerPostback"` as a `DestinationName` for the adapter registration
- Read `settings.destinations.partnerPostback.registrationUrl` / `conversionUrl` / `enabled`
- The dispatcher's `destinationAcceptsEvent("partnerPostback", eventName)` gate already works — it reads the matrix column just added

No blockers for 12-02.

---
*Phase: 12-partner-postback-adapter*
*Completed: 2026-07-01*
