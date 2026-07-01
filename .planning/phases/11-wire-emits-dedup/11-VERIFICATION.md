---
phase: 11-wire-emits-dedup
verified: 2026-07-01T12:08:41Z
status: passed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Deploy to staging and trigger a fresh registration, then a paid purchase, then a PAP funded-leg payment."
    expected: "TrackingEventLog documents appear for signup_completed (signup:<userId>), purchase_completed (purchase:<paymentId>), and pap_payment_completed (pap:<paymentId>) with status=sent for each configured destination."
    why_human: "Event-firing correctness requires a live MongoDB + adapter connectivity. Static analysis confirms wiring is complete; runtime proof is inherently post-deploy."
---

# Phase 11: Wire Emits + Dedup Verification Report

**Phase Goal:** Wire the zero-caller `TrackingEvents.signupCompleted`/`.purchaseCompleted` at real callsites (registration + all payment-completion paths incl. PAP), threading `partnerClickId` + `usdAmount` + `currency=USD`; produce an FTD `isFirstPurchase` FLAG on every purchase event (NOT suppression); dual-dispatch audit confirms the legacy path can't double-fire.

**Verified:** 2026-07-01T12:08:41Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `signup_completed` wired at both registration sites with `partnerClickId`, stable `signup:<userId>` eventId, skip-when-absent | VERIFIED | `auth.service.ts:659` (one-step) and `auth.service.ts:1047` (OTP two-step) both call `TrackingEvents.signupCompleted({userId, email, eventId: \`signup:${userId}\`, ...spread-when-truthy})` |
| 2 | `purchase_completed` fires at all standard payment paths with `partnerClickId` from `payment.attribution`, `usdAmount`, `currency:"USD"` | VERIFIED | `emitTrackingPurchaseCompleted` util called at `payment.service.modular.ts:1512`, `callback.service.ts:725`, `stripe-webhook.service.ts:708`, `fanbasis-webhook.service.ts:382` (new) and `:299` (retry); util reads `payment.attribution?.partnerClickId`, emits `value: payment.usdAmount`, `currency: "USD"` |
| 3 | `isFirstPurchase` boolean FTD flag computed via `Payment.countDocuments({userId, status:"completed"})===1`; purchase events NOT suppressed on repeats | VERIFIED | `trackingPurchaseEmit.ts:77-81` — `countDocuments` after status="completed" persist; `isFirstPurchase = completedCount === 1`; util comment explicitly forbids repeat-suppression; event always fires |
| 4 | PAP funded-leg fires exactly ONE partner-conversion-eligible event (`pap_payment_completed` only, never `purchase_completed`) | VERIFIED | `trackingPurchaseEmit.ts:65` — `if (payment.payAfterPass === true && payment.currentProgramId) return;` early-exits before any `purchaseCompleted` emit; PAP blocks then call `TrackingEvents.papPaymentCompleted` directly |
| 5 | All 3 `papPaymentCompleted` callsites use `usdAmount` (not `payAfterPassRemainingPrice`), `partnerClickId` from `attribution`, stable `pap:<paymentId>` eventId | VERIFIED | `callback.service.ts:866-873`, `stripe-webhook.service.ts:511-518`, `fanbasis-webhook.service.ts:260-267` — all three pass `value: payment.usdAmount`, `currency: "USD"`, `eventId: \`pap:${payment._id}\``, `partnerClickId` from `payment.attribution?.partnerClickId` |
| 6 | CRM-08: `ConversionWebhookEventsService` emits only `{ChallengePassed, ChallengeFailed, PayoutCompleted, KYCCompleted, AccountFunded}` — disjoint from signup/purchase; dedup uses stable eventIds | VERIFIED | `conversion-webhook-events.service.ts` has exactly 6 static methods (confirmed by grep), none named signupCompleted/purchaseCompleted/papPaymentCompleted; 5 call sites confirmed disjoint; audit doc `11-DEDUP-AUDIT.md` §3 formalises the empty-set intersection |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/modules/Tracking/tracking.interface.ts` | `partnerClickId?`, `isFirstPurchase?`, `eventId?` on `ITrackingEventPayload` | VERIFIED | Lines 172, 226, 237 — all three fields present with doc comments explaining FTD design and Phase 12 separation |
| `src/app/modules/Tracking/tracking.events.service.ts` | `signupCompleted` with `partnerClickId?`+`eventId?`; `purchaseCompleted`/`papPaymentCompleted` with same | VERIFIED | 273 lines; `signupCompleted` (line 38-54), `purchaseCompleted` (line 75-95), `papPaymentCompleted` (line 107-124) — all accept `partnerClickId?`, `isFirstPurchase?`, `eventId?` |
| `src/app/modules/Payment/utils/trackingPurchaseEmit.ts` | PAP-skip guard, FTD `countDocuments`, `attribution.partnerClickId`, `usdAmount`, `currency:"USD"`, `purchase:<id>` eventId | VERIFIED | 106 lines; all 6 requirements in a single well-documented async function |
| `src/app/modules/Auth/auth.service.ts` | `signupCompleted` at one-step (~:659) and OTP (~:1047) sites | VERIFIED | Both calls present with correct args and inline comments |
| `src/app/modules/Payment/payment.service.modular.ts` | `emitTrackingPurchaseCompleted` at free-$0 path (~:1512) | VERIFIED | Imported at line 3; called at line 1512 with `void` |
| `src/app/modules/Payment/services/callback.service.ts` | `emitTrackingPurchaseCompleted` at paid path (~:725); `papPaymentCompleted` at PAP path (~:866) | VERIFIED | Both present; `emitTrackingPurchaseCompleted` imported line 18, called line 725; `papPaymentCompleted` at line 866 |
| `src/app/modules/Payment/services/stripe-webhook.service.ts` | `emitTrackingPurchaseCompleted` (~:708); `papPaymentCompleted` (~:511) | VERIFIED | Both present; imported line 12, `purchase_completed` at line 708, `pap_payment_completed` at line 511 |
| `src/app/modules/Payment/services/fanbasis-webhook.service.ts` | `emitTrackingPurchaseCompleted` at new (~:382) + retry (~:299) paths; `papPaymentCompleted` (~:265) | VERIFIED | All three calls present; imported line 10, called at lines 299, 382; PAP block at lines 260-271 |
| `.planning/phases/11-wire-emits-dedup/11-DEDUP-AUDIT.md` | CRM-08 audit doc confirming disjoint event surfaces + dedup mechanism | VERIFIED | 260-line audit with live grep evidence, §2 event surface, §3 intersection=empty, §5 dedup mechanism, §5c stable eventId confirmation |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.service.ts` | `TrackingEvents.signupCompleted` | Direct call | WIRED | Both registration paths (one-step:659, OTP:1047) call the helper |
| `emitTrackingPurchaseCompleted` | `TrackingEvents.purchaseCompleted` | Direct call inside util | WIRED | `trackingPurchaseEmit.ts:88` |
| `emitTrackingPurchaseCompleted` | `Payment.countDocuments` | `await` inside util | WIRED | `trackingPurchaseEmit.ts:77`; result used at line 81 to set `isFirstPurchase` |
| `payment.service.modular.ts` | `emitTrackingPurchaseCompleted` | `void` call + import | WIRED | Imported line 3, called line 1512 after payment.save() |
| `callback.service.ts` | `emitTrackingPurchaseCompleted` | `void` call + import | WIRED | Imported line 18, called line 725 after payment.save() |
| `stripe-webhook.service.ts` | `emitTrackingPurchaseCompleted` | `void` call + import | WIRED | Imported line 12, called line 708 inside processPaymentCompletion |
| `fanbasis-webhook.service.ts` | `emitTrackingPurchaseCompleted` | `void` call + import | WIRED | Imported line 10, called at lines 299 (retry) and 382 (new payment) |
| `callback.service.ts` | `TrackingEvents.papPaymentCompleted` | Direct call | WIRED | Line 866, inside PAP next-stage block; fires after `payAfterPassNextStageAssigned=true` saved |
| `stripe-webhook.service.ts` | `TrackingEvents.papPaymentCompleted` | Direct call | WIRED | Line 511 |
| `fanbasis-webhook.service.ts` | `TrackingEvents.papPaymentCompleted` | Direct call | WIRED | Line 260 |
| PAP skip guard | `emitTrackingPurchaseCompleted` early-return | `if (payAfterPass===true && currentProgramId) return` | WIRED | `trackingPurchaseEmit.ts:65` prevents PAP from also emitting `purchase_completed` |
| `ConversionWebhookEventsService` | signup/purchase events | (none — disjoint) | VERIFIED ABSENT | No signup/purchase method on the service; 5 call sites confirmed; event surfaces are disjoint |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | No TODOs, stubs, placeholder returns, or empty handlers found in any Phase 11 file |

---

### Phase 12 Scope Leak Check

- `src/app/modules/Tracking/destinations/` contains: `base.ts`, `conversion-webhook.ts`, `ga4-measurement.ts`, `index.ts`, `klaviyo.ts`, `meta-capi.ts`
- **No `partnerPostback` adapter file present** — Phase 12 scope is cleanly absent
- The two occurrences of the string `partnerPostback` in source are inside JSDoc comments explaining the Phase 12 boundary — not code

---

### Human Verification Required

#### 1. Live Event Firing — Post-Deploy Smoke Test

**Test:** After deploying to staging: (a) register a new user via the OTP path, (b) complete a paid purchase via Stripe, (c) complete a PAP funded-leg payment.

**Expected:**
- `TrackingEventLog` document exists with `eventName: "signup_completed"`, `eventId: "signup:<userId>"`, `status: "sent"` for at least one configured destination.
- `TrackingEventLog` document exists with `eventName: "purchase_completed"`, `eventId: "purchase:<paymentId>"`, `isFirstPurchase: true` in the payload hash.
- `TrackingEventLog` document exists with `eventName: "pap_payment_completed"`, `eventId: "pap:<papPaymentId>"`.
- No `purchase_completed` log row for the PAP payment (PAP-skip guard active).

**Why human:** Requires a deployed environment with live MongoDB, configured destination credentials, and actual payment gateway callbacks. Static analysis confirms wiring; runtime confirms adapter dispatch and DB write.

---

### Summary

Phase 11 is fully implemented. All six success criteria are satisfied by direct code inspection:

1. Both auth.service.ts registration paths call `TrackingEvents.signupCompleted` with stable `signup:<userId>` eventId and conditional `partnerClickId` spread.
2. `emitTrackingPurchaseCompleted` is imported and called at all four standard payment-completion paths (free/$0, callback, Stripe, Fanbasis) plus the Fanbasis retry path, sourcing `partnerClickId` from `payment.attribution`, emitting `usdAmount` as value and hardcoding `currency:"USD"`.
3. FTD flag is `countDocuments({userId, status:"completed"})===1`; util comment and design explicitly forbid repeat-purchase suppression.
4. PAP funded-legs are protected by the `if (payAfterPass===true && currentProgramId) return` guard in the util, firing exactly one `pap_payment_completed` event via direct `TrackingEvents.papPaymentCompleted` calls in the three webhook handlers.
5. All three `papPaymentCompleted` callsites pass `value: payment.usdAmount`, `currency:"USD"`, `eventId: \`pap:${payment._id}\``, and conditional `partnerClickId` from `payment.attribution`.
6. The `ConversionWebhookEventsService` event surface (`ChallengePassed`, `ChallengeFailed`, `PayoutCompleted`, `KYCCompleted`, `AccountFunded`) is provably disjoint from the Phase 11 tracking events; stable eventIds make all three event types retry-idempotent regardless of minute-boundary.

No Phase 12 adapter, config, or outbound HTTP code is present. The only `partnerPostback` references are in doc comments demarcating the Phase 12 boundary.

---

_Verified: 2026-07-01T12:08:41Z_
_Verifier: Claude (gsd-verifier)_
