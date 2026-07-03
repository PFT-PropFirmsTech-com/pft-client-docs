# Stack Research: v1.4 Klaviyo Purchase-Failure Coverage Gap

**Domain:** Wiring a missing tracking-event call into an existing dispatch framework — bugfix/coverage milestone on an existing white-label prop-trading backend
**Researched:** 2026-07-03
**Confidence:** HIGH — all findings from direct file reads of the live codebase (pft-backend, branch `main-2026`); zero training-data assumptions

---

## Executive Finding: Zero New Dependencies, Zero Catalog Changes — Pure Call-Site Wiring

The entire `purchase_failed` event — catalog entry, per-destination default toggle, Klaviyo metric name mapping, GA4/Meta mapping, and a fully-typed `TrackingEvents.purchaseFailed()` helper — **already exists and is dead code**. It has **zero real callers** anywhere in the repo. This exactly mirrors the v1.3 finding for `signupCompleted`/`purchaseCompleted` (helper built, call sites not wired at every completion path) — the same defect class, now on the failure side of the funnel.

No new library, schema field, dispatcher route, or adapter change is needed. This is purely: call `TrackingEvents.purchaseFailed(...)` (or a new small wrapper util that mirrors the existing `emitTrackingPurchaseCompleted` pattern) from the payment-gateway code paths that currently flip `Payment.status` to `"failed" | "expired" | "cancelled"` without ever notifying the Tracking module.

---

## What Already Exists (DO NOT REBUILD)

### 1. Event catalog entry — `purchase_failed` is fully defined

File: `pft-backend/src/app/modules/Tracking/tracking.interface.ts:20`
`"purchase_failed"` is a member of `EVENT_NAMES` / `EventName` — the same union type the dispatcher, Mongoose schema (`eventName: { enum: EVENT_NAMES } `), and every adapter key off of. Nothing to add here.

### 2. Default per-destination toggle map — already has Klaviyo ON by default

File: `pft-backend/src/app/modules/Tracking/tracking.constants.ts:42`
```ts
purchase_failed: { metaCapi: false, googleAds: false, ga4: true, klaviyo: true, conversionWebhook: false, getResponse: false, intercom: false, partnerPostback: false },
```
Klaviyo is `true` by default for `purchase_failed`. This is exactly the UI checkbox the ticket screenshot shows under "Purchase funnel" — it is not a dead config key, it's a live default that simply has never been triggered because nothing calls `dispatch()` with `eventName: "purchase_failed"` in production code.

### 3. Event name mapping (GA4 / Meta / Klaviyo) — already defined

File: `pft-backend/src/app/modules/Tracking/tracking.constants.ts:122`
```ts
purchase_failed: { ga4: "purchase_failed", fbEvent: "PurchaseFailed", fbStandard: false, klaviyo: "Purchase Failed" },
```
Klaviyo metric name `"Purchase Failed"` is already the mapped value the adapter will send. No new metric name needs to be invented or approved with the client — it is baked into shipped code from Phase 10-12 (v1.3).

### 4. Typed helper — already built, has an `errorCode` field, zero callers

File: `pft-backend/src/app/modules/Tracking/tracking.events.service.ts:96-105`
```ts
purchaseFailed(args: {
  userId?: string;
  email?: string;
  invoiceId?: string;
  value?: number;
  currency?: string;
  errorCode?: string;
}, req?: Request) {
  fire("purchase_failed", args, req);
},
```
Confirmed via repo-wide grep: `TrackingEvents.purchaseFailed` and the raw string `"purchase_failed"` appear **only** inside the Tracking module's own definition files (`tracking.constants.ts`, `tracking.events.service.ts`, `tracking.interface.ts`, `tracking.validation.ts`). No `.ts` file outside the Tracking module invokes it. This is the confirmed dead-helper finding the quality gate asked about — same shape as the v1.3 `signupCompleted`/`purchaseCompleted` pre-wiring gap.

### 5. Klaviyo adapter — fully event-name-generic, no per-event code

File: `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts`
The adapter looks up `EVENT_MAPPING[payload.eventName]?.klaviyo` (line 66) and sends whatever metric name comes back. There is no `if (eventName === "purchase_completed")` special-casing anywhere in this file — it already handles `purchase_failed` correctly the instant the dispatcher is called with that event name. **Do not touch this file.**

### 6. Dispatcher (`tracking.service.ts`) — fully generic, no event-name branching

Confirmed via grep: no `switch`/`if (eventName === ...)` logic keyed on specific event names in the dispatch path. It routes any `EventName` through the per-destination toggle map from `tracking.constants.ts`. **Do not touch this file.**

### 7. Reference pattern to mirror — `emitTrackingPurchaseCompleted`

File: `pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts`
This is the existing wrapper util that gateway/webhook services import and call fire-and-forget after flipping `payment.status = "completed"`. It:
- Takes a loosely-typed `PaymentLike` (works with hydrated Mongoose docs across all gateways)
- Reads `usdAmount`, `billingInfo.email`, `programId`, `accountSize`, `challengeType`, `paymentMethod`, `invoice`, `attribution.partnerClickId` off the Payment doc
- Wraps the whole thing in try/catch so tracking failures never break payment flow
- Uses a stable `eventId` (`purchase:<paymentId>`) for dedup

**This is the pattern to copy for a new `emitTrackingPurchaseFailed(payment, reason?)` util**, not a from-scratch design. Same file conventions, same defensive try/catch, same "fire-and-forget, swallow everything" contract.

---

## What's Actually Missing: The Call Sites (this IS the v1.4 work)

`Payment.status` enum (confirmed at `pft-backend/src/app/modules/Payment/payment.model.ts:109` / `payment.interface.ts:109`):
```ts
status: "pending" | "completed" | "failed" | "cancelled" | "expired" | "partially_paid" | "processing" | "capturing"
```

Every place `status` is set to `"failed"`, `"expired"`, or `"cancelled"` was enumerated. They fall into two buckets:

### Bucket A — genuine customer-facing purchase failures (NEED the new tracking call)

| File | Line(s) | Gateway | What happens | Tracking call today |
|------|---------|---------|---------------|----------------------|
| `Payment/services/stripe-webhook.service.ts` | 344 `handleCheckoutSessionExpired` | Stripe | `checkout.session.expired` webhook → `payment.status = "expired"` (line 376) | **None** |
| `Payment/services/stripe-webhook.service.ts` | 304 `handlePaymentIntentFailed` | Stripe | `payment_intent.payment_failed` webhook → `payment.status = "failed"` (line 325) | **None** |
| `Payment/services/stripe-webhook.service.ts` | 103, 132, 245, 272, 325 | Stripe | Security-check failures (currency/amount mismatch) inline → `status = "failed"` | **None** |
| `Payment/services/fanbasis-webhook.service.ts` | `handlePaymentFailed` (~418-423) | Fanbasis | `status = "failed"` | **None** |
| `Payment/services/fanbasis-webhook.service.ts` | `handlePaymentExpired` (~435-440) | Fanbasis | `status = "expired"` | **None** |
| `Payment/services/fanbasis-webhook.service.ts` | `handlePaymentCanceled` (~445-450) | Fanbasis | `status = "cancelled"` | **None** |
| `Payment/services/fanbasis-webhook.service.ts` | `handlePaymentSuccess` amount/currency mismatch (~309, 325) | Fanbasis | Security-check failure → `status = "failed"` | **None** |
| `Payment/services/callback.service.ts` | `handleNonCompletedPayment` (line 805) | NOWPayments/crypto/generic callback | Already branches on `status === "failed" \|\| status === "expired"` and calls `sendPaymentStatusNotification` (line 809-811) | **None** — this is the single cleanest choke point, already invoked for every non-completed terminal status in this gateway's flow |
| `Payment/services/paypal-webhook.service.ts` | lines 272, 287, 349, 440, 455, 534, 641, 656 | PayPal | Multiple inline `payment.status = "failed"` on capture/verification failure | **None** |

**Highest-priority fix for the Trading Cult ticket:** `stripe-webhook.service.ts::handleCheckoutSessionExpired` (line 344-386). Trading Cult's complaint is specifically an **EXPIRED** purchase not reaching Klaviyo, and Stripe Checkout is the standard card-payment gateway; `checkout.session.expired` is the canonical "customer abandoned checkout" event. Confirm Trading Cult's active gateway via its `PaymentConfig` doc before assuming Stripe-only, but this handler is the most direct match to the reported symptom.

**Second-priority:** `callback.service.ts::handleNonCompletedPayment` (line 805) — this is a single function already called for both `"failed"` and `"expired"` on the crypto/generic-callback gateway path, making it the cheapest single-call-site fix per gateway (one call covers two statuses at once, exactly like the existing `sendPaymentStatusNotification` call it sits next to).

### Bucket B — internal/idempotency housekeeping, NOT customer-facing failures (do NOT wire tracking here)

| File | Line | What it actually is |
|------|------|----------------------|
| `Payment/payment.service.modular.ts:1224` | Rollback of an orphaned `pending` row when gateway session creation itself throws before any checkout UI was shown to the user | No real purchase attempt reached the customer — firing `purchase_failed` here would be noise |
| `Payment/payment.service.modular.ts:1318` | Coupon-usage-limit race: `processing → failed` reset inside a `catch` on a concurrent free-payment coupon claim | Internal concurrency guard, not a gateway-reported failure |
| `Payment/payment.service.modular.ts:1451` | PAP funded-leg sibling-request dedup: marks a duplicate in-flight attempt `"expired"` after a sibling request already completed the same funded provisioning | Superseded duplicate, not a failed purchase — the sibling's `purchase_completed` (or `pap_payment_completed`) already fired |
| `Payment/payment.service.modular.ts:1564` | Free-payment `processing → failed` reset in the outer catch after `processFreePayment` throws | Same as 1318 — internal reset so retries aren't blocked |
| `Payment/payment.service.modular.ts:2704` | Free $0-PAP stale pending/processing rows superseded by a new attempt (crash recovery) | Explicitly "supersede stale attempts to allow retry" — not a terminal customer failure |

These five sites should be left alone. Wiring `purchase_failed` into them would fire false-positive "purchase failed" emails/flows in Klaviyo for cases that are actually internal retries or already-successful duplicate-request cleanup — a new bug class, not a fix.

---

## Recommended Implementation Shape

### New util (mirror `trackingPurchaseEmit.ts`)

Create `pft-backend/src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts` exporting `emitTrackingPurchaseFailed(payment, errorCode?)`:
- Same `PaymentLike` shape as the completed-emit util (reuse/import if convenient, or duplicate the same minimal interface — the existing file already documents that it intentionally avoids coupling to the full `IPayment` type)
- Calls `TrackingEvents.purchaseFailed({ userId, email, invoiceId, value, currency, errorCode })` — the helper signature already supports exactly these fields, no interface change needed
- Wrap in try/catch, fire-and-forget (`void emitTrackingPurchaseFailed(payment, ...)`), matching the `emitTrackingPurchaseCompleted` contract exactly
- No `eventId` dedup requirement was specified for `purchase_failed` in the existing helper signature (unlike `purchaseCompleted`/`papPaymentCompleted` which take an `eventId` for retry-safe dedup) — if gateways can re-send failure webhooks (Stripe/PayPal retry on non-2xx), consider whether the dispatcher's existing minute-bucketed `deterministicEventId` fallback is sufficient, or whether `errorCode`-bearing helper should also accept an optional `eventId` for parity. This is a design call for planning, not a blocker — the field is easy to add to the existing helper args object since it's a plain object literal, not a rigid schema.

### Call sites to add (Bucket A only)

1. `stripe-webhook.service.ts::handleCheckoutSessionExpired` — after `payment.status = "expired"; await payment.save();` (line 376-377)
2. `stripe-webhook.service.ts::handlePaymentIntentFailed` — after `payment.status = "failed"; await payment.save();` (line 325-326)
3. `stripe-webhook.service.ts` inline security-check failures (lines 103, 132, 245, 272) — same pattern, each already has `payment.status = "failed"; await payment.save();` immediately followed by `return`
4. `fanbasis-webhook.service.ts::handlePaymentFailed`, `handlePaymentExpired`, `handlePaymentCanceled` — one call each, after the existing `await payment.save()`
5. `callback.service.ts::handleNonCompletedPayment` (line 805-812) — single call inside the existing `if (status === "failed" || status === "expired")` branch, right next to the existing `sendPaymentStatusNotification` call
6. `paypal-webhook.service.ts` — the 8 inline `payment.status = "failed"` sites

### What NOT to touch

- `tracking.service.ts` (dispatcher) — already fully generic
- `tracking.constants.ts` — catalog/mapping/defaults already complete for `purchase_failed`
- `destinations/klaviyo.ts` — already event-name-agnostic
- `tracking.events.service.ts` — `purchaseFailed()` helper already exists with the right field shape (only touch if adding an optional `eventId` param for dedup parity, additive-only)
- Payment/service.modular.ts Bucket-B internal housekeeping status flips (see above — false-positive risk)
- Super-admin per-brand destinations config UI/schema — the `purchase_failed` checkbox already exists per the ticket screenshot; this is a backend call-site gap, not a config-schema gap

---

## Installation

No new packages. No `npm install` required — every dependency (native `fetch`, Mongoose, the Tracking module itself) is already in place and unchanged by this milestone.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|---|---|---|
| Small `emitTrackingPurchaseFailed` util mirroring the existing completed-emit pattern, called from each gateway's failure handler | Add the tracking call inline at each of the ~15 status-flip sites without a shared util | Duplicates the email/value/currency field-extraction logic 6+ times across gateways; the existing codebase convention (proven by `trackingPurchaseEmit.ts`) is a single shared emit util per event type, imported by each gateway service |
| Wire only Bucket A (genuine customer failures) | Wire tracking at every `status = "failed"/"expired"/"cancelled"` site including internal housekeeping (Bucket B) | Would fire spurious `purchase_failed` events (and Klaviyo flows/emails) for internal retry resets and superseded-duplicate cleanup that were never customer-visible failures |
| Reuse the existing `purchase_failed` event name/catalog entry | Introduce a new event name (e.g. `purchase_expired` distinct from `purchase_failed`) | The catalog, Klaviyo mapping, and default toggles were already built in v1.3 around a single `purchase_failed` covering failed/expired/cancelled outcomes uniformly (mirrors `errorCode` as the differentiator field, not separate event types) — inventing a second event type would require new catalog/mapping/toggle entries the ticket's UI screenshot doesn't show existing, and isn't necessary since `errorCode` can carry `"expired"`/`"cancelled"`/`"failed"` as the differentiator |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| Rebuilding the Klaviyo adapter or dispatcher to "support" purchase_failed | They already fully support it — this would be wasted, risky churn on working shipped code | Only add the missing caller-side `emitTrackingPurchaseFailed(...)` invocations |
| A blanket "wire tracking at every status-flip site" sweep without bucketing | Confirmed 5 internal-housekeeping sites in `payment.service.modular.ts` are not real customer failures | Bucket A/B split above — only touch the 6 gateway webhook files with genuine customer-facing terminal outcomes |

## Version Compatibility

Not applicable — no new packages, no version changes. All work is additive TypeScript within the existing `pft-backend` module tree on `main-2026`.

## Sources

- Direct file reads, `pft-backend` repo, branch `main-2026` (confirmed via `git branch --show-current`), 2026-07-03:
  - `src/app/modules/Tracking/tracking.constants.ts`
  - `src/app/modules/Tracking/tracking.events.service.ts`
  - `src/app/modules/Tracking/tracking.interface.ts`
  - `src/app/modules/Tracking/destinations/klaviyo.ts`
  - `src/app/modules/Payment/utils/trackingPurchaseEmit.ts`
  - `src/app/modules/Payment/payment.model.ts` / `payment.interface.ts` (status enum)
  - `src/app/modules/Payment/services/stripe-webhook.service.ts`
  - `src/app/modules/Payment/services/fanbasis-webhook.service.ts`
  - `src/app/modules/Payment/services/callback.service.ts`
  - `src/app/modules/Payment/services/paypal-webhook.service.ts`
  - `src/app/modules/Payment/services/cron.service.ts`
  - `src/app/modules/Payment/services/stranded-reconcile.service.ts` (confirmed out of scope)
  - `src/app/modules/Payment/payment.service.modular.ts` (Bucket B sites)
  - Repo-wide grep confirming zero external callers of `TrackingEvents.purchaseFailed` / `"purchase_failed"` outside the Tracking module's own definition files
- Ticket cmqtl47g4004zny0kz54mmz0z (Trading Cult, Klaviyo purchase-coverage gap) — project context provided by orchestrator

---
*Stack research for: v1.4 Klaviyo purchase-failure tracking coverage*
*Researched: 2026-07-03*
