# CRM-08 Dual-Dispatch Audit + Dedup Verification

**Date:** 2026-07-01
**Phase:** 11-wire-emits-dedup
**Plan:** 11-03
**Status:** CONFIRMED — no double-fire risk; dedup is end-to-end sound

---

## 1. Scope (CRM-08)

Two independent server-side dispatch paths exist in the backend:

| Path | Module | Protocol | Purpose |
|------|--------|----------|---------|
| **Legacy** | `ConversionWebhookEventsService` | HTTP POST via `dispatchConversionWebhook` | Lifecycle webhooks: KYC / challenge / payout (GTM / analytics partners) |
| **Tracking** | `TrackingService.dispatch()` + adapters | Pluggable adapter registry (Meta CAPI, GA4, partnerPostback, etc.) | Partner/attribution events: signup / purchase / pap payment |

The question: can both paths fire for the same event, producing a double-fire to a downstream partner?

This audit re-examines the code at post-11-02 state (commits 8e2f7509, 44deb3d4, 644ccd39, 982ba9a1 on main-2026) with fresh grep evidence.

---

## 2. Legacy Path Event Surface

### 2a. Methods on ConversionWebhookEventsService

File: `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook-events.service.ts`

```
grep -n "static " conversion-webhook-events.service.ts
```

Output (live, 2026-07-01):

```
10:  static onChallengePassed(params: { ... }): void
33:  static onChallengeFailed(params: { ... }): void
56:  static onPayoutCompleted(params: { ... }): void
77:  static onKYCCompleted(params: { ... }): void
88:  static onAccountFunded(params: { ... }): void
110:  static async dispatchFromWorker(input: ...): Promise<void>
```

**Event strings dispatched (via `dispatchConversionWebhook({ event: ... })`):**

| Method | event string |
|--------|-------------|
| `onChallengePassed` | `"ChallengePassed"` |
| `onChallengeFailed` | `"ChallengeFailed"` |
| `onPayoutCompleted` | `"PayoutCompleted"` |
| `onKYCCompleted` | `"KYCCompleted"` |
| `onAccountFunded` | `"AccountFunded"` |
| `dispatchFromWorker` | caller-supplied (rule-checker lifecycle) |

**The service has NO `signupCompleted`, `purchaseCompleted`, or `papPaymentCompleted` method.**

### 2b. Call-Site Table (fresh grep evidence)

```
grep -rn "ConversionWebhookEventsService\." pft-backend/src --include="*.ts" | grep -v __tests__
```

Output:

```
pft-backend/src/app/modules/Kyc/kyc.service.ts:649:
    ConversionWebhookEventsService.onKYCCompleted({ ... })

pft-backend/src/app/modules/Withdrawals/withdrawal.service.ts:2409:
    ConversionWebhookEventsService.onPayoutCompleted({ ... })

pft-backend/src/app/modules/Withdrawals/withdrawal.service.ts:2835:
    ConversionWebhookEventsService.onPayoutCompleted({ ... })

pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.controller.ts:90:
    ConversionWebhookEventsService.dispatchFromWorker({ ... })

pft-backend/src/app/services/passed/passed.service.ts:106:
    ConversionWebhookEventsService.onChallengePassed({ ... })
```

**Total call sites: 5** (4 callers + 1 internal controller relay).

| File | Line | Method | Trigger |
|------|------|--------|---------|
| `Kyc/kyc.service.ts` | 649 | `onKYCCompleted` | KYC approval |
| `Withdrawals/withdrawal.service.ts` | 2409 | `onPayoutCompleted` | Withdrawal completion (primary path) |
| `Withdrawals/withdrawal.service.ts` | 2835 | `onPayoutCompleted` | Withdrawal completion (secondary path) |
| `Admin/ConversionWebhook/conversion-webhook.controller.ts` | 90 | `dispatchFromWorker` | Rule-checker HTTP callback |
| `services/passed/passed.service.ts` | 106 | `onChallengePassed` | Challenge pass event |

None of these files import or call `TrackingEvents.signupCompleted`, `TrackingEvents.purchaseCompleted`, or `TrackingEvents.papPaymentCompleted`.

---

## 3. Overlap Analysis

### Tracking path events (Phase 11 wired)

| Event | Emitter | Where wired |
|-------|---------|-------------|
| `signup_completed` | `TrackingEvents.signupCompleted()` | `auth.service.ts:659` (one-step) + `auth.service.ts:1047` (OTP) |
| `purchase_completed` | `emitTrackingPurchaseCompleted()` util | `payment.service.modular.ts:1512`, `callback.service.ts:725`, `stripe-webhook.service.ts:708`, `fanbasis-webhook.service.ts:382` (+ retry path) |
| `pap_payment_completed` | `TrackingEvents.papPaymentCompleted()` | `callback.service.ts:866`, `stripe-webhook.service.ts:511`, `fanbasis-webhook.service.ts:265` |

### Legacy path events

`ChallengePassed`, `ChallengeFailed`, `PayoutCompleted`, `KYCCompleted`, `AccountFunded`

### Intersection

```
{signup_completed, purchase_completed, pap_payment_completed}
    ∩
{ChallengePassed, ChallengeFailed, PayoutCompleted, KYCCompleted, AccountFunded}
    = ∅  (empty set)
```

The two event surfaces are **completely disjoint**. No event name appears in both paths.

---

## 4. Verdict: No Double-Fire — No Code Change Required

The legacy `ConversionWebhookEventsService` fires **only** trader-lifecycle events (KYC, payout, challenge pass/fail, account funded). The Tracking path's Phase 11 events (`signup_completed`, `purchase_completed`, `pap_payment_completed`) do not exist anywhere in the legacy service or any of its 5 call sites.

**Conclusion:** Zero double-fire risk between the two dispatch paths. No refactor or guard needed.

> If a future PR adds a `signupCompleted` or `purchaseCompleted` method to `ConversionWebhookEventsService`, it would create a double-fire risk. The naming divergence (legacy: CamelCase events / Tracking: snake_case events) helps distinguish the two, but is not a substitute for keeping them disjoint.

---

## 5. Dedup Mechanism + Retry Idempotency

### 5a. The (eventId, destination) unique log

The Tracking dispatcher (`tracking.service.ts`) implements a two-phase dedup protocol before each adapter send:

1. **Pre-check** (`isDuplicate`): `TrackingEventLog.findOne({ eventId, destination })` — returns true if status is `"sent"` or `"deduplicated"`. If true, skip the adapter entirely.
2. **Reserve** (`reserveLogRow`): `TrackingEventLog.create({ eventId, eventName, destination, status:"pending", ... })` inside a try/catch on `err.code === 11000`. The `TrackingEventLog` collection has a compound unique index on `(eventId, destination)`. If a concurrent in-flight dispatch already reserved the row, the insert throws error code 11000 → treated as deduplicated.

The dedup states (`sent`, `pending`, `deduplicated`, `failed`, `skipped`) are managed by `dedup.service.ts`:
- `markSent` — normal success path
- `markFailed` — allows future retry (failed rows are NOT suppressed on next attempt)
- `markDeduplicated` — idempotent drop
- `markSkipped` — adapter declined (disabled / no config); prevents permanent `pending` pollution

**Key property:** dedup is **per-(eventId, destination)**. The same eventId sent to two different destinations creates two independent log rows and two independent sends. When Phase 12 adds the `partnerPostback` destination, it gets its own row and its own dedup — fully isolated from any Meta CAPI or GA4 row for the same eventId.

### 5b. The deterministicEventId default and its minute-bucket caveat

When a caller does NOT supply `payload.eventId`, `tracking.service.ts` falls back to:

```ts
// tracking.service.ts ~line 170-175
const eventId =
  payload.eventId ??
  deterministicEventId(
    payload.userId || payload.anonId || payload.email || "anon",
    payload.eventName,
    payload.eventTime ? new Date(payload.eventTime).getTime() : Date.now(),
  );
```

`deterministicEventId` (from `enrichment/hash.ts`) is:

```ts
export function deterministicEventId(user, eventName, timestampMs): string {
  const minute = Math.floor(timestampMs / 60000);  // bucket by MINUTE
  return sha256(`${user}|${eventName}|${minute}`);
}
```

**The critical caveat:** the default eventId is minute-bucketed. A gateway webhook retry arriving **more than 1 minute after** the original dispatch generates a DIFFERENT eventId (different minute bucket) → the dedup log does not suppress it → a duplicate send occurs.

**This is why Phase 11 passes explicit stable eventIds at every signup/purchase/PAP site.**

### 5c. Stable eventId confirmation — grep evidence

#### signup_completed (Phase 11-01)

```
grep -n "eventId" pft-backend/src/app/modules/Auth/auth.service.ts
```

Output:
```
657:  // eventId is stable per-user so repeat calls dedup without minute-bucket collision.
662:      eventId: `signup:${String(createdUser._id)}`,

1045:  // eventId is stable per-user so a repeat OTP submit dedups to one signup_completed.
1050:      eventId: `signup:${String((registeredUser as any)?._id)}`,
```

Pattern: `signup:<userId>` — stable across time for a given user. A repeat OTP submit (or duplicate auth callback) for the same user always hashes to the same eventId → one signup_completed send per (userId, destination).

#### purchase_completed (Phase 11-02, standard path)

`emitTrackingPurchaseCompleted` util (`Payment/utils/trackingPurchaseEmit.ts`):

```ts
eventId: `purchase:${String(payment._id)}`,  // stable dedup key across retries
```

Pattern: `purchase:<paymentId>` — a MongoDB ObjectId is globally unique and immutable. Stripe firing both `checkout.session.completed` AND `payment_intent.succeeded` for the same payment → both calls pass the same paymentId → same eventId → deduplicated at the log. Note: the `eventId: event.id` on lines 21/48 of `stripe-webhook.service.ts` are Stripe event IDs used only in logger.info / logger.error context fields; they are NOT passed to the tracking dispatcher.

Wired at (confirmed by grep):
- `payment.service.modular.ts:1512` — free/$0 path
- `callback.service.ts:725` — paid callback path
- `stripe-webhook.service.ts:708` — paid Stripe path (inside `processPaymentCompletion`, called by both checkout.session.completed and payment_intent.succeeded)
- `fanbasis-webhook.service.ts:382` — fanbasis new-payment path
- `fanbasis-webhook.service.ts:299` — fanbasis retry path (already-completed; stable eventId deduplicates)

#### pap_payment_completed (Phase 11-02, PAP path)

```
grep -n "eventId.*pap:\|pap:.*eventId" pft-backend/src/app/modules/Payment/services/*.ts
```

Output:
```
fanbasis-webhook.service.ts:265:  eventId: `pap:${String(freshPayment._id)}`,  // stable dedup key
callback.service.ts:871:          eventId: `pap:${String(payment._id)}`,       // stable dedup key
stripe-webhook.service.ts:516:    eventId: `pap:${String(payment._id)}`,       // stable dedup key
```

Pattern: `pap:<paymentId>` — same paymentId as the PAP funded-leg payment doc. A retried PAP webhook always references the same payment doc → same eventId → one send per (paymentId, destination).

### 5d. Stable eventId scheme summary

| Event | EventId pattern | Dedup scope |
|-------|----------------|-------------|
| `signup_completed` | `signup:<userId>` | One per (user, destination) — repeat OTP submits collapse |
| `purchase_completed` | `purchase:<paymentId>` | One per (payment doc, destination) — webhook retry / dual-event collapse |
| `pap_payment_completed` | `pap:<paymentId>` | One per (PAP payment doc, destination) — PAP webhook retry collapse |

All three patterns are stable across time and cross-minute-boundary safe. They do not rely on `deterministicEventId` and are immune to the minute-bucket gap.

### 5e. Forward-looking guarantee (Phase 12)

When Phase 12 adds the `partnerPostback` destination:
- The SAME stable eventIds (`signup:<userId>`, `purchase:<paymentId>`, `pap:<paymentId>`) apply.
- Each gets its own `(eventId, destination="partnerPostback")` log row.
- A retried PAP webhook cannot double-send the conversion postback — the `pap:<paymentId>` row for `partnerPostback` will be `sent` on the first delivery.
- The FTD once-per-user gate (`isFirstPurchase === true`) is a separate Phase 12 concern enforced in the adapter — it complements but does not replace the dedup log.

---

## 6. Final CRM-08 Verdict

**CRM-08 is satisfied.**

**(a) No legacy/Tracking double-fire:** The legacy `ConversionWebhookEventsService` exposes only `{onChallengePassed, onChallengeFailed, onPayoutCompleted, onKYCCompleted, onAccountFunded, dispatchFromWorker}` — confirmed by live grep. None of its 5 call sites invoke `signupCompleted`, `purchaseCompleted`, or `papPaymentCompleted`. The event surfaces are disjoint. No refactor needed.

**(b) Gateway-retry / repeat-OTP idempotency:** Phase 11 passes explicit stable eventIds at every wired site — `signup:<userId>`, `purchase:<paymentId>`, `pap:<paymentId>` — confirmed by live grep. The `(eventId, destination)` compound unique index on `TrackingEventLog` collapses duplicate dispatches to one send even when retries arrive minutes or hours apart (bypassing the minute-bucket `deterministicEventId` default). The dedup guarantee extends to Phase 12's `partnerPostback` destination automatically.

No open dedup risks. No code changes required by this audit.
