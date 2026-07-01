---
phase: 11-wire-emits-dedup
plan: "03"
subsystem: tracking
tags: [crm, partner-tracking, dedup, audit, conversion-webhook, idempotency]

# Dependency graph
requires:
  - phase: 11-01
    provides: signupCompleted wired with stable signup:<userId> eventId
  - phase: 11-02
    provides: purchaseCompleted/papPaymentCompleted wired with stable purchase:<paymentId>/pap:<paymentId> eventIds
provides:
  - Written audit (11-DEDUP-AUDIT.md) proving ConversionWebhookEventsService and Tracking dispatch paths are disjoint
  - Documented dedup contract: (eventId, destination) compound unique index + two-phase reserve protocol
  - Minute-bucket caveat recorded: deterministicEventId default is cross-minute unsafe; Phase 11 explicit stable keys fix it
  - Forward-looking Phase 12 guarantee: partnerPostback destination inherits the same stable-key dedup
affects:
  - 12-partner-postback (audit closes CRM-08; Phase 12 can proceed with dedup guarantee in place)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable eventId scheme: signup:<userId> / purchase:<paymentId> / pap:<paymentId> — overrides minute-bucketed deterministicEventId for cross-minute idempotency"
    - "Dedup is per-(eventId, destination): same eventId dispatched to two destinations = two independent log rows (never cross-contaminate)"
    - "deterministicEventId minute-bucket is safe only for browser<>server same-minute dedup; gateway webhook retries require explicit stable key"

key-files:
  created:
    - .planning/phases/11-wire-emits-dedup/11-DEDUP-AUDIT.md
  modified: []

key-decisions:
  - "Legacy ConversionWebhookEventsService event surface {ChallengePassed,ChallengeFailed,PayoutCompleted,KYCCompleted,AccountFunded,dispatchFromWorker} is fully disjoint from Tracking path events {signup_completed,purchase_completed,pap_payment_completed} — confirmed by live grep at post-11-02 HEAD; no guard or refactor needed"
  - "deterministicEventId is minute-bucketed by design (browser<>server convergence) — Phase 11 explicit stable keys are required, not optional, for cross-minute retry dedup"

patterns-established:
  - "CRM-08 audit pattern: re-grep at execution time (not plan-time snapshot), produce evidence table with file:line, record explicit disjoint verdict"

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 11 Plan 03: CRM-08 Dual-Dispatch Audit + Dedup Verification Summary

**Fresh grep confirms legacy ConversionWebhookEventsService (5 lifecycle-only call sites) and Tracking dispatch (signup/purchase/pap) are disjoint event surfaces with zero double-fire risk; stable explicit eventIds (signup:userId, purchase:paymentId, pap:paymentId) make all Phase 11 emits idempotent across minute-boundary retries via the (eventId, destination) compound unique index**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T12:10:00Z
- **Completed:** 2026-07-01T12:18:00Z
- **Tasks:** 2 (Tasks 1 + 2 committed together as single audit artifact)
- **Files modified:** 1 created

## Accomplishments

- Re-grepped `ConversionWebhookEventsService.*` at post-11-02 HEAD: 5 call sites, all lifecycle-only (`onKYCCompleted`, `onPayoutCompleted` x2, `onChallengePassed`, `dispatchFromWorker`) — zero signup/purchase/pap coverage
- Documented the full static method surface (6 methods) with grep evidence — no `signupCompleted`, `purchaseCompleted`, or `papPaymentCompleted` method exists
- Documented the two-phase dedup protocol: `isDuplicate` pre-check + `reserveLogRow` (11000 on conflict = deduped) with `(eventId, destination)` compound unique index
- Recorded the minute-bucket caveat on `deterministicEventId` and confirmed all Phase 11 emit sites pass explicit stable keys (verified by grep against live code)
- Recorded Phase 12 forward-looking guarantee: same stable keys dedup `partnerPostback` destination automatically

## Task Commits

1. **Tasks 1+2: CRM-08 audit doc (legacy surface + dedup mechanism)** - `8540f5a` (docs)

## Files Created/Modified

- `.planning/phases/11-wire-emits-dedup/11-DEDUP-AUDIT.md` — 259-line evidence-backed audit with grep tables, disjoint verdict, dedup contract, minute-bucket caveat, stable-eventId confirmation, and Phase 12 forward guarantee

## Decisions Made

No new implementation decisions — this plan is audit-only. The audit confirmed existing decisions from 11-01/11-02 are correct and sufficient:
- Stable eventId scheme is the right approach (minute-bucket default insufficient for gateway retries)
- No architectural change to `ConversionWebhookEventsService` or the Tracking dispatcher is needed to prevent double-fire

## Deviations from Plan

None — plan executed exactly as written. The fresh grep produced no surprises: the legacy service surface and Tracking surface were disjoint as expected, so the audit issued a clean "no double-fire" verdict rather than flagging a blocker.

## Issues Encountered

None. The Stripe webhook service has `eventId: event.id` on two logger context lines (21 and 48 inside `handleWebhook`) — these are Stripe event IDs in logger.info/logger.error fields, not tracking eventId values. The actual tracking dispatch at line 708 goes through `emitTrackingPurchaseCompleted(payment)` which sets `purchase:<payment._id>`. Documented explicitly in the audit to prevent future confusion.

## User Setup Required

None — audit doc only, no external service configuration required.

## Next Phase Readiness

- CRM-08 is closed. Phase 12 (partnerPostback adapter) has the documented dedup guarantee it needs.
- Phase 12 can add the `partnerPostback` destination adapter with confidence that:
  - `signup_completed` arrives with `partnerClickId` (when user came via tracked link) and stable `signup:<userId>` eventId
  - `purchase_completed` / `pap_payment_completed` arrive with `isFirstPurchase` flag + stable payment-doc eventId
  - The `(eventId, destination="partnerPostback")` log row prevents double-send on gateway webhook retries
- No blockers for Phase 12.

## Self-Check: PASSED

- FOUND: .planning/phases/11-wire-emits-dedup/11-DEDUP-AUDIT.md (259 lines, 11 mentions of ConversionWebhookEventsService)
- FOUND: commit 8540f5a (audit doc)
- VERIFIED: `grep -n "deterministicEventId|eventId, destination|purchase:|pap:|signup:"` in audit returns all required dedup elements
- VERIFIED: Audit contains explicit "disjoint" and "no double-fire" verdict language

---
*Phase: 11-wire-emits-dedup*
*Completed: 2026-07-01*
