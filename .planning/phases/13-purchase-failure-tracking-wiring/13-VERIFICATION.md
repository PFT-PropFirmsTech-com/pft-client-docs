---
phase: 13-purchase-failure-tracking-wiring
verified: 2026-07-03T11:21:33Z
status: human_needed
score: 5/5 must-haves verified (code-level); live Klaviyo visibility deferred to post-deploy human check
human_verification:
  - test: "Let a payment sit past the 1-hour pending expiry threshold (or trigger the hourly cron manually) and confirm the resulting purchase_failed fires reach Klaviyo's dashboard as a 'Purchase Failed' event with a populated reason property."
    expected: "Event appears in Klaviyo Metrics > Purchase Failed with error_code/reason populated (e.g. checkout_expired)."
    why_human: "Requires a live/staging deploy with a real Klaviyo private key configured and observing the Klaviyo dashboard/API — not verifiable from static code analysis."
  - test: "Trigger a real Stripe payment_intent.payment_failed webhook (test mode) and a checkout.session.expired webhook; confirm each produces exactly one Klaviyo 'Purchase Failed' event."
    expected: "One event per webhook, reason=card_declined / checkout_expired respectively."
    why_human: "Requires live Stripe test webhook delivery and Klaviyo dashboard inspection."
  - test: "Resend (redeliver) the same Stripe/PayPal/FanBasis webhook via the gateway's dashboard retry feature and confirm no duplicate 'Purchase Failed' event appears in Klaviyo for the same payment."
    expected: "Second delivery is deduplicated (dispatcher's isDuplicate/reserveLogRow honors the stable purchase_failed:<paymentId> eventId); Klaviyo shows only one event."
    why_human: "Dedup mechanism is code-verified (see below) but end-to-end redelivery behavior against the live Klaviyo Events API needs a real webhook replay to confirm no visible duplicate lands in the dashboard."
  - test: "Confirm the two internal PAP supersede/dedup status:'expired' writes in payment.service.modular.ts (sibling-supersede line ~1451, stale free-PAP-attempt supersede line ~2696-2704) never produce a visible Klaviyo event during normal PAP double-click/retry traffic."
    expected: "No 'Purchase Failed' event in Klaviyo correlated with these internal bookkeeping transitions."
    why_human: "Code confirms zero emit calls at these sites (structural guarantee), but confirming zero *live* Klaviyo noise from real PAP traffic patterns is a production-observation task, deferred per project convention (all human-verify deferred until main-2026 deploys)."
---

# Phase 13: Purchase Failure Tracking Wiring Verification Report

**Phase Goal:** Every genuine customer-facing failed/expired/cancelled payment reaches Klaviyo with a usable failure reason, exactly once, while internal bookkeeping status flips stay silent.
**Verified:** 2026-07-03T11:21:33Z
**Status:** human_needed (all automated/code-level checks pass; live Klaviyo dashboard visibility requires post-deploy human check per project convention)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hourly expiry cron fires `purchase_failed`, visible in Klaviyo | ✓ VERIFIED (code) / ? human_needed (live visibility) | `cron.service.ts` fires `emitTrackingPurchaseFailed(payment, failedCode)` inside the existing `stalePayments` loop; no second query; branches on `processingIdSet` membership not stale status string. Klaviyo `EVENT_MAPPING.purchase_failed.klaviyo = "Purchase Failed"` and `klaviyo: true` gate (tracking.constants.ts:42,122). |
| 2 | Any real gateway webhook (Stripe, FanBasis, PayPal, NOWPayments/crypto) fires `purchase_failed` same as cron path | ✓ VERIFIED | Stripe: 2 emits (`handlePaymentIntentFailed`, `handleCheckoutSessionExpired`). FanBasis: 3 emits (`handlePaymentFailed`, `handlePaymentExpired`, `handlePaymentCanceled`). PayPal: 1 emit (`handleCaptureDenied`). NOWPayments/crypto + Paysafe: both route through `PaymentService.handleCallback` → `handleNonCompletedPayment`, which emits once for `failed`/`expired` (confirmed `handlePaysafeCallback` at payment.controller.ts:354 calls `handleCallback`). |
| 3 | Klaviyo "Purchase Failed" event carries populated `errorCode`/`reason` property | ✓ VERIFIED | `klaviyo.ts` `buildProperties()` has `set("reason", payload.reason); set("error_code", payload.errorCode);` (lines 37-38). `purchaseFailed` helper in `tracking.events.service.ts` accepts both `reason` and `errorCode` and passes them through `fire()` which spreads args into payload (no drop). `emitTrackingPurchaseFailed` util always populates both `errorCode` and `reason` from the normalized code. |
| 4 | Resending the same gateway webhook does not produce a duplicate Klaviyo event | ✓ VERIFIED (code) / ? human_needed (live confirmation) | Every emit uses stable `eventId: purchase_failed:<paymentId>` (verified in `trackingPurchaseFailedEmit.ts`). Dispatcher (`tracking.service.ts`) honors explicit `payload.eventId` (does not fall back to minute-bucketed deterministic id when present), pre-checks `isDuplicate(payload.eventId!, destination)`, and reserves a log row before calling the adapter — a redelivered webhook with the same paymentId produces the same eventId and is deduplicated before reaching Klaviyo. |
| 5 | The two internal PAP dedup/race-guard `status: "expired"` writes in `payment.service.modular.ts` never fire `purchase_failed` | ✓ VERIFIED | `grep -c emitTrackingPurchaseFailed payment.service.modular.ts` = 0. Confirmed both sites (line 1451 sibling-supersede via `updateOne`, lines 2696-2704 stale free-PAP-attempt supersede via `updateMany`) are bulk internal writes with no hydrated doc and no emit call — excluded structurally, not by a guard. |

**Score:** 5/5 truths verified at code level. Live Klaviyo dashboard confirmation is deferred as human-verify (post main-2026 deploy), consistent with project convention — not counted as a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts` | Shared fire-and-forget emitter | ✓ VERIFIED | 80 lines (min 30), exports `emitTrackingPurchaseFailed`, uses `usdAmount`+`"USD"`, stable `purchase_failed:<paymentId>` eventId, populates `errorCode`+`reason`, fully try/catch swallowed. Wired (imported/used) at 6 call sites. |
| `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` | `purchaseFailed` extended with `reason`+`eventId` | ✓ VERIFIED | Lines 96-109: args object includes `reason?: string` and `eventId?: string` with doc comments; `fire("purchase_failed", args, req)` unchanged (spreads args). |
| `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts` | `buildProperties` promotes `reason`+`errorCode` | ✓ VERIFIED | Lines 37-38: `set("reason", payload.reason); set("error_code", payload.errorCode);` — table-driven, no event-name special-casing. |
| `pft-backend/src/app/modules/Payment/services/cron.service.ts` | emit inside `stalePayments` loop | ✓ VERIFIED | Import + `processingIdSet` + `emitTrackingPurchaseFailed(payment, failedCode)` inside existing loop; single `Payment.find(` call preserved. |
| `pft-backend/src/app/modules/Payment/services/callback.service.ts` | emit in `handleNonCompletedPayment` failed/expired branch | ✓ VERIFIED | Line 812, inside existing `if (status === "failed" || status === "expired")` block, after notification call. |
| `pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts` | emit in 2 genuine handlers | ✓ VERIFIED | Exactly 2 emits (lines 329, 382), both after `payment.save()`; 4 security-mismatch `status="failed"` branches (lines 104,133,246,273) deliberately unwired. |
| `pft-backend/src/app/modules/Payment/services/fanbasis-webhook.service.ts` | emit in 3 genuine handlers | ✓ VERIFIED | Exactly 3 emits (lines 428,446,459), all after `payment.save()`; 2 security-mismatch branches (lines 321,333) unwired. |
| `pft-backend/src/app/modules/Payment/services/paypal-webhook.service.ts` | emit in `handleCaptureDenied` only | ✓ VERIFIED | Exactly 1 emit (line 539), after `payment.save()`; 7 other `status="failed"` validation/integrity-guard sites unwired. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `trackingPurchaseFailedEmit.ts` | `TrackingEvents.purchaseFailed` | direct call w/ eventId+errorCode+reason | ✓ WIRED | Call present, all fields populated, awaited internally, wrapped in try/catch. |
| `klaviyo.ts` buildProperties | `payload.reason` / `payload.errorCode` | `set()` calls | ✓ WIRED | Both `set()` calls present and reachable for every event (not purchase_failed-gated). |
| `cron.service.ts` | `emitTrackingPurchaseFailed` | call inside `stalePayments` loop, branch on id-set | ✓ WIRED | Confirmed no stale-status-string branching; `processingIdSet` built pre-update. |
| `callback.service.ts` | `emitTrackingPurchaseFailed` | call inside failed/expired branch of `handleNonCompletedPayment` | ✓ WIRED | Confirmed Paysafe routes through same handler via `handleCallback`. |
| `stripe-webhook.service.ts` | `emitTrackingPurchaseFailed` | after `payment.save()` in 2 handlers | ✓ WIRED | Confirmed placement post-save in both handlers; security branches untouched. |
| `fanbasis-webhook.service.ts` | `emitTrackingPurchaseFailed` | after `payment.save()` in 3 handlers | ✓ WIRED | Confirmed placement post-save; security branches untouched. |
| `paypal-webhook.service.ts` | `emitTrackingPurchaseFailed` | after `payment.save()` in `handleCaptureDenied` | ✓ WIRED | Confirmed placement post-save; other 7 sites untouched. |
| `tracking.service.ts` dispatcher | dedup (`isDuplicate`/`reserveLogRow`) | honors explicit `payload.eventId` | ✓ WIRED | Confirmed dispatcher does not overwrite an explicit `eventId` with the minute-bucketed deterministic fallback; dedup check happens before adapter send. |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|-----------------|
| KLAV-01 (every real failed/expired/cancelled payment fires purchase_failed across cron/Stripe/FanBasis/PayPal/NOWPayments) | ✓ SATISFIED | None — all 5 named call-site families wired, confirmed by grep + read. |
| KLAV-02 (event carries reason/error-code, adapter promotes not drops) | ✓ SATISFIED | None. |
| KLAV-03 (stable, retry-safe eventId per payment) | ✓ SATISFIED | None — `purchase_failed:<paymentId>` confirmed, dispatcher dedup confirmed to honor it. |
| KLAV-04 (internal dedup/race-guard status flips stay silent) | ✓ SATISFIED | None — zero emit calls at both named sites in `payment.service.modular.ts`. |

### Anti-Patterns Found

None. Scanned all 8 touched files for TODO/FIXME/placeholder/stub patterns and empty-implementation patterns — zero matches. No `if (eventName === "purchase_failed")` special-casing introduced anywhere in the dispatcher or adapters (table-driven `set()` promotion only, as required).

### Scoped TypeScript Compilation

Ran `npx tsc --noEmit --skipLibCheck` scoped to all 8 files touched across the three plans. Errors surfaced are exclusively pre-existing, unrelated noise from transitively-imported files invoked without full tsconfig flags (`esModuleInterop`, `downlevelIteration`) — e.g. `crypto`/`http-status`/`winston` default-import errors in `Intercom`, `logger.ts`, `config/index.ts`, and two pre-existing `MapIterator` `--downlevelIteration` errors in `paypal-webhook.service.ts` at lines 36/42 (unrelated `Map` cleanup code untouched by this phase, confirmed via `git log`/diff — not part of any of the 6 phase-13 commits). Zero errors attributable to the actual lines this phase added or modified.

### Human Verification Required

See YAML frontmatter `human_verification` block. Summary:
1. Cron-driven expiry → live Klaviyo "Purchase Failed" event visibility.
2. Live Stripe test-mode webhook (payment_intent.payment_failed / checkout.session.expired) → single Klaviyo event with correct reason.
3. Webhook redelivery/retry (any gateway) → confirm no duplicate visible in Klaviyo dashboard.
4. PAP internal supersede paths → confirm zero Klaviyo noise under real PAP double-click/retry traffic.

All four are deferred pending main-2026 deploy, per established project convention (all human-verify deferred until deploy). None of these are code gaps — the call graph, dedup mechanism, and exclusion of internal writes are all structurally verified in the codebase.

### Gaps Summary

No code-level gaps found. All 5 ROADMAP success criteria are satisfied by the actual wiring: the shared `emitTrackingPurchaseFailed` util (13-01) correctly extends the Klaviyo pipeline (reason/errorCode promotion, stable eventId, USD-only value), and is wired at every genuine customer-facing failure site across the cron sweep, the generic NOWPayments/Paysafe callback handler, and the explicit Stripe/FanBasis/PayPal webhook handlers (13-02, 13-03) — while carefully leaving unwired both the internal PAP bookkeeping supersede writes and all currency/amount-mismatch security-guard branches across all three gateways. The only remaining verification is observing the actual Klaviyo dashboard post-deploy, which is a human/production task, not a code gap.

---

*Verified: 2026-07-03T11:21:33Z*
*Verifier: Claude (gsd-verifier)*
