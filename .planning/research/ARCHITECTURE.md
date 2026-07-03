# Architecture Research

**Domain:** Tracking/destinations dispatch integration — wiring `purchase_failed` tracking events into existing Payment failure/expiry code paths (v1.4 milestone)
**Researched:** 2026-07-03
**Confidence:** HIGH (all findings verified directly against source files in `pft-backend` @ branch `main-2026`; no training-data assumptions used)

## Correction to milestone brief assumptions

The milestone brief assumed file paths like `src/services/tracking/`, `src/models/Payment.model.ts`, `src/jobs/expirePendingPayments.job.ts`, `src/controllers/stripeWebhook.controller.ts` — **none of these exist**. The actual module lives under `src/app/modules/Tracking/` and `src/app/modules/Payment/`, following this codebase's modular-by-domain layout (`src/app/modules/<Domain>/<domain>.{model,interface,service,controller}.ts`). All findings below are from the real files, read directly.

**Bigger correction:** `purchase_failed` is **already a fully-registered, fully-wired event** in the tracking catalog (`EVENT_NAMES`, `DEFAULT_EVENT_TOGGLES`, `EVENT_MAPPING`, and a `TrackingEvents.purchaseFailed()` helper all already exist). There is **no separate `purchase_expired` event** — the codebase's existing design uses a single `purchase_failed` event name for both failure and expiry outcomes (mirroring `IPayment.status` having distinct `failed`/`expired` string values, but the tracking layer intentionally collapses them into one tracking event, differentiated via the `errorCode` field). **The only actual gap is that `TrackingEvents.purchaseFailed()` is never called from any Payment code path** — it was scaffolded (v1.3 or earlier) but never wired to a real call site. This milestone is close to 100% "add call sites," ~0% "add new event type."

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Payment status transition sites                  │
│  (webhook handlers, NOWPayments callback, hourly cron)                │
├──────────────────────────────────────────────────────────────────────┤
│  stripe-webhook   fanbasis-webhook   callback.service   cron.service  │
│  .service.ts      .service.ts        .ts (NOWPayments/  .ts (hourly   │
│  (Stripe)         (FanBasis)         Paysafe generic)   stale sweep)  │
│       │                │                    │                  │      │
│       │ payment.status=│"failed"/"expired"; await payment.save()│      │
│       ▼                ▼                    ▼                  ▼      │
├──────────────────────────────────────────────────────────────────────┤
│           TrackingEvents.purchaseFailed(args)  ← NEW CALL SITES        │
│           (src/app/modules/Tracking/tracking.events.service.ts)       │
│           already exists, fires eventName:"purchase_failed"           │
├──────────────────────────────────────────────────────────────────────┤
│                    dispatch() — tracking.service.ts                   │
│  (UNCHANGED — settings lookup, enrichment, sampling, per-destination   │
│   per-event toggle check, dedup via TrackingEventLog, fan-out)         │
├──────────────────────────────────────────────────────────────────────┤
│  metaCapi(off)  googleAds(off)  ga4(on)  klaviyo(on)  conversionWebhook│
│                                                        (off)  ...      │
│  partnerPostback → hits generic "event not mapped" fallback → skipped │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File | Responsibility | Change needed for this milestone |
|-----------|------|-----------------|-----------------------------------|
| Event catalog | `src/app/modules/Tracking/tracking.interface.ts` | Defines `EVENT_NAMES` (includes `"purchase_failed"` at line 20), `ITrackingEventPayload` shape (`errorCode`, `reason` fields already present) | NONE — already has `purchase_failed` registered |
| Default toggles | `src/app/modules/Tracking/tracking.constants.ts` | `DEFAULT_EVENT_TOGGLES.purchase_failed` (line 42): `ga4:true, klaviyo:true`, all else false; `EVENT_MAPPING.purchase_failed` (line 122): `ga4:"purchase_failed"`, `fbEvent:"PurchaseFailed"`, `fbStandard:false`, `klaviyo:"Purchase Failed"` | NONE — already fully mapped |
| Typed helper | `src/app/modules/Tracking/tracking.events.service.ts` | `TrackingEvents.purchaseFailed(args, req?)` (lines 96-105) — accepts `userId, email, invoiceId, value, currency, errorCode` | NONE required to compile/work — helper exists, ready to call. **Optionally** extend `args` with `programId`/`accountSize`/`paymentMethod`/`eventId` for parity with `purchaseCompleted`'s richer payload, but not required for this milestone |
| Dispatcher | `src/app/modules/Tracking/tracking.service.ts` | `dispatch()` — settings load/cache, click-id/user-data/request enrichment, sampling, per-destination `destinationAcceptsEvent()` check, dedup reserve via `TrackingEventLog`, `Promise.allSettled` fan-out | NONE — fully generic over `eventName`, zero special-casing |
| Klaviyo adapter | `src/app/modules/Tracking/destinations/klaviyo.ts` | Looks up `EVENT_MAPPING[payload.eventName].klaviyo` → `"Purchase Failed"` metric, POSTs to Klaviyo Events API | NONE — generic, already resolves `purchase_failed` → `"Purchase Failed"` |
| Partner postback adapter | `src/app/modules/Tracking/destinations/partner-postback.ts` | Only branches on `signup_completed` / `purchase_completed` / `pap_payment_completed`; anything else hits the `else` fallback (lines 74-81) returning `status:"skipped", error:"event not mapped: purchase_failed"` | NONE — safe no-op by construction, verified in source |
| Meta CAPI / GA4 / conversionWebhook adapters | `src/app/modules/Tracking/destinations/{meta-capi,ga4-measurement,conversion-webhook}.ts` | Not fully re-verified line-by-line this pass, but the architecture pattern (table-driven via `EVENT_MAPPING`, no event-name special-casing observed in Klaviyo/partner-postback) is consistent across adapters | Should be NONE; recommend a quick grep sanity-check during implementation for any code that special-cases `eventName === "purchase_completed"` the way partner-postback does |
| Payment model / status enum | `src/app/modules/Payment/payment.interface.ts` (line 109) | `status: "pending" \| "completed" \| "failed" \| "cancelled" \| "expired" \| "partially_paid" \| "processing" \| "capturing"` | NONE — enum already has both `failed` and `expired` |
| Purchase-completed emit helper | `src/app/modules/Payment/utils/trackingPurchaseEmit.ts` | `emitTrackingPurchaseCompleted(payment)` — the actual pattern to mirror: PAP-skip guard, FTD `isFirstPurchase` count, `eventId: "purchase:<paymentId>"`, wrapped in try/catch, called via `void emitTrackingPurchaseCompleted(payment)` (fire-and-forget) | Pattern to replicate for the failure case (see Pattern 1 below) |

## Recommended Project Structure

No new folders needed. This is a call-site-addition milestone within the existing structure:

```
src/app/modules/
├── Tracking/
│   ├── tracking.events.service.ts     # purchaseFailed() ALREADY EXISTS here — no edit needed
│   ├── tracking.interface.ts          # purchase_failed ALREADY in EVENT_NAMES — no edit needed
│   ├── tracking.constants.ts          # purchase_failed ALREADY in toggles+mapping — no edit needed
│   └── destinations/                  # all adapters generic — no edit needed
├── Payment/
│   ├── payment.interface.ts           # status enum already has failed/expired — no edit needed
│   ├── utils/
│   │   ├── trackingPurchaseEmit.ts         # existing purchaseCompleted pattern to MIRROR
│   │   └── trackingPurchaseFailedEmit.ts   # NEW — recommended shared helper (see Pattern 1)
│   └── services/
│       ├── stripe-webhook.service.ts       # MODIFY — call sites in handlePaymentIntentFailed + handleCheckoutSessionExpired (+ optional security-mismatch branches)
│       ├── fanbasis-webhook.service.ts     # MODIFY — call sites in handlePaymentFailed + handlePaymentExpired
│       ├── callback.service.ts             # MODIFY — 1 call site in handleNonCompletedPayment (covers NOWPayments; verify Paysafe routing too)
│       └── cron.service.ts                 # MODIFY — call site(s) in checkAndExpirePendingPayments (covers both the expired and stuck-processing/failed branches)
```

### Structure Rationale

- No new files are strictly required — every integration point is a small addition (1-5 lines) inside an existing function, right after the existing `payment.status = "failed"/"expired"; await payment.save();` line.
- A new shared helper (`trackingPurchaseFailedEmit.ts`) is recommended for consistency: it mirrors `emitTrackingPurchaseCompleted`'s shape (accepts a loose `PaymentLike`, builds the args, wraps in try/catch, fire-and-forget) so all 5+ call sites use one function instead of hand-rolling `TrackingEvents.purchaseFailed({...})` inline everywhere. This avoids drift in field-mapping (e.g. always using `usdAmount`/`"USD"` consistently, mirroring the "never billed currency" rule already enforced by `emitTrackingPurchaseCompleted` to guard against the known JPY-as-USD bug class documented in project memory).

## Architectural Patterns

### Pattern 1: Shared `emitTrackingPurchaseFailed()` helper mirroring `emitTrackingPurchaseCompleted()`

**What:** A single utility function (new file `src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts`) that every failure/expiry call site invokes, instead of calling `TrackingEvents.purchaseFailed()` directly.

**When to use:** Any place `payment.status` is set to `"failed"` or `"expired"` and then persisted via `payment.save()` / `updateOne()` / `updateMany()`.

**Trade-offs:** Slightly more indirection than calling `TrackingEvents.purchaseFailed()` directly at each site, but it centralizes the "never billed currency, always `usdAmount`" rule and a consistent dedup `eventId` convention in one place — matching how `emitTrackingPurchaseCompleted` already centralizes that logic for the success path. Given this codebase already has that pattern for completed purchases, using the same shape for failures keeps the two code paths symmetric and easy to review together.

**Example (mirroring existing `emitTrackingPurchaseCompleted` exactly):**
```typescript
// src/app/modules/Payment/utils/trackingPurchaseFailedEmit.ts
import { TrackingEvents } from "../../Tracking/tracking.events.service";

interface PaymentLike {
  _id?: unknown;
  userId?: unknown;
  billingInfo?: { email?: string | null } | null;
  usdAmount?: number | null;
  invoice?: string | null;
  status?: string | null; // "failed" | "expired" at call time
}

/**
 * Emit a `purchase_failed` tracking event for a payment that just transitioned
 * to "failed" or "expired". Fire-and-forget, fully swallowed.
 *
 * eventId = "purchase_failed:<paymentId>:<status>" — distinct from the
 * "purchase:<paymentId>" key used by emitTrackingPurchaseCompleted, so a
 * payment that fails then later succeeds on retry never has its dedup
 * key collide with the eventual purchase_completed event.
 */
export async function emitTrackingPurchaseFailed(
  payment: PaymentLike | null | undefined,
  errorCode?: string,
): Promise<void> {
  if (!payment?._id) return;
  try {
    TrackingEvents.purchaseFailed({
      userId: payment.userId != null ? String(payment.userId) : undefined,
      email: payment.billingInfo?.email ?? undefined,
      invoiceId: payment.invoice ?? undefined,
      value: payment.usdAmount ?? undefined,   // normalized USD; never billed currency
      currency: "USD",
      errorCode: errorCode ?? payment.status ?? undefined, // "failed" | "expired" | specific reason
    });
  } catch {
    // last-resort safety net — tracking must never surface to callers
  }
}
```

Call sites then become a single line right after the existing `payment.save()`:
```typescript
payment.status = "expired";
await payment.save();
void emitTrackingPurchaseFailed(payment, "checkout_expired");
```

### Pattern 2: Fire immediately after persistence, never before

**What:** Every existing `purchaseCompleted`/`papPaymentCompleted` call site fires the tracking event only after `payment.save()` resolves — never before, never coupled to a risk of rollback.

**When to use:** All new call sites.

**Trade-offs:** None — straightforward consistency rule. Following it avoids tracking a status transition that never actually got persisted (e.g. if `save()` throws downstream of setting `.status` in memory).

### Pattern 3: `void` fire-and-forget, never `await`

**What:** All existing tracking calls in webhook/callback code use `void emitTrackingPurchaseCompleted(payment)` or bare `TrackingEvents.papPaymentCompleted({...})` without awaiting — the helper's internal `fireAndForget()` (in `tracking.events.service.ts`) already does `dispatch(...).catch(logger.warn)`.

**When to use:** All new call sites — do not `await` the tracking call inside the webhook handler's critical path.

**Trade-offs:** A tracking dispatch failure is fully invisible to the webhook response (by design — "tracking failures must never affect business operations" per the code comment at the top of `tracking.events.service.ts`). This is correct for this domain.

## Data Flow

### Real call sites where Payment.status → "failed" / "expired" happens today

| # | File | Function | Status set | Trigger | Volume estimate |
|---|------|----------|-----------|---------|------------------|
| 1 | `src/app/modules/Payment/services/cron.service.ts` | `CronService.checkAndExpirePendingPayments()` (runs hourly via `setInterval` in `src/server.ts` ~line 298, plus once on startup) | `"expired"` (pending >1hr) via `updateMany` (line 35); `"failed"` (processing stuck >10min) via `updateMany` (line 43) | Hourly cron sweep, provider-agnostic (catches Stripe/Paysafe/NOWPayments/FanBasis/any payment method whose webhook never arrives) | **Highest — this is the catch-all for every abandoned/stuck checkout across all payment providers**, since it's the only path that doesn't depend on a specific webhook firing |
| 2 | `src/app/modules/Payment/services/stripe-webhook.service.ts` | `handlePaymentIntentFailed()` (lines 304-339) | `"failed"` (line 325) | Stripe webhook `payment_intent.payment_failed` | Medium — real-time explicit decline signal from Stripe |
| 2b | same file | `handleCheckoutSessionExpired()` (lines 344-390) | `"expired"` (line 376) | Stripe webhook `checkout.session.expired` | Medium — explicit Stripe-native session-timeout signal |
| 2c | same file | `handleCheckoutSessionCompleted()` / `handlePaymentIntentSucceeded()` security-mismatch branches | `"failed"` (lines 103, 132, 245, 272) | Currency/amount mismatch detected during otherwise-successful-looking webhook (fraud/manipulation defense) | Low volume but security-relevant — worth tracking too |
| 3 | `src/app/modules/Payment/services/fanbasis-webhook.service.ts` | `handlePaymentFailed()` (lines 419-431) | `"failed"` (line 423) | FanBasis webhook (explicit failure event) | Medium |
| 3b | same file | `handlePaymentExpired()` (lines 433-444) | `"expired"` (line 440) | FanBasis webhook (explicit expiry event) — **note: FanBasis DOES send an explicit expiry webhook**, contradicting the milestone brief's assumption that it has none | Medium |
| 3c | same file | Security-mismatch branches (lines 320, 332) | `"failed"` | Amount/currency manipulation defense | Low volume |
| 4 | `src/app/modules/Payment/services/callback.service.ts` | `handleCallback()` → `handleNonCompletedPayment()` (lines 805-812) | Generic — receives whatever `newStatus` NOWPayments/crypto callback reported (`"failed"` or `"expired"`) | NOWPayments/crypto callback with non-"completed" status | Lower volume (crypto-specific), but **already has a unified failed+expired handler** — the natural integration point for this provider |
| 5 | `src/app/modules/Payment/services/paysafe.service.ts` | `mapStatus()` (line 929) maps Paysafe's own status vocabulary to `"waiting"\|"confirmed"\|"expired"\|"failed"` | Feeds into `payment_status`-style field (line 964) consumed downstream — **not yet confirmed** whether Paysafe routes through `callback.service.ts`'s generic handler or has its own separate webhook controller that sets `payment.status` directly | Unconfirmed — needs a follow-up grep for the Paysafe webhook controller/route during implementation to confirm which handler ultimately calls `payment.save()` |

### Key Data Flow

1. **Cron sweep (highest volume):** `setInterval` in `src/server.ts` → `CronService.checkAndExpirePendingPayments()` runs every 60 minutes (plus once on boot) → bulk `updateMany` on stale `pending`/`processing` payments. This is a **bulk update**, not a per-document loop with hydrated documents — the current code does `Payment.find(...)` to get the stale list (fully hydrated, includes `billingInfo`, `usdAmount`, etc.), then two separate `updateMany` calls (lines 33-38, 41-45), then only iterates the already-fetched `stalePayments` array for logging (lines 48-52). Tracking calls should be added inside this existing logging loop, using the `pendingIds`/`processingIds` splits already computed at lines 27-28 to know which outcome (`"expired"` vs `"failed"`) each payment received — the in-memory `payment.status` on the pre-fetched objects is still the OLD status, so don't branch on it directly; branch on which id-array the payment's `_id` belongs to.
2. **Webhook paths (Stripe, FanBasis):** each handler already hydrates a full `payment` document via `Payment.findOne(...)`, mutates `.status`, and calls `payment.save()` — the tracking call slots in immediately after `save()` with the already-in-scope `payment` variable.
3. **NOWPayments/crypto callback:** `handleNonCompletedPayment(payment, status)` already receives the hydrated `payment` and the resolved `status` string — this is the cleanest single integration point of all 5, since it's already a shared dispatcher for both `"failed"` and `"expired"` outcomes (see the existing `if (status === "failed" || status === "expired")` check at line 809 gating the existing notification logic — the same `if` block is where the tracking call belongs).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (per-brand DB, moderate payment volume) | Adding `void emitTrackingPurchaseFailed(payment, reason)` calls at 5-7 sites is negligible overhead — same pattern as existing `purchaseCompleted`/`papPaymentCompleted` calls which already run at every real completion today |
| Cron sweep at high stale-payment counts | The cron's `for (const payment of stalePayments)` loop is currently sequential logging only; adding a `void emitTrackingPurchaseFailed(...)` call per iteration keeps it non-blocking (fire-and-forget) so it won't slow the loop meaningfully even with hundreds of stale payments per hourly run |
| Klaviyo/Meta/GA4 API volume | `purchase_failed` will likely fire more often than `purchase_completed` in aggregate (abandoned checkouts + real declines are typically more common than completions). For brands with Klaviyo enabled (`ga4:true, klaviyo:true` by default per `DEFAULT_EVENT_TOGGLES.purchase_failed`), this adds meaningful new outbound API call volume. Not a blocker — the existing per-destination dedup + `Promise.allSettled` fan-out already scales with event count, no code change needed to handle it |

### Scaling Priorities

1. **First bottleneck:** None expected from this change alone — it's additive within an already-proven dispatch path.
2. **Second consideration:** If a brand's Klaviyo account has strict Events API rate limits and abandonment/failure rates are high, monitor `TrackingEventLog` `status:"failed"` rows for the `klaviyo` destination post-rollout — an operational concern, not an architectural blocker for this milestone.

## Anti-Patterns

### Anti-Pattern 1: Registering a new `purchase_expired` event name

**What people might do:** Since `IPayment.status` has both `"failed"` and `"expired"` as distinct values, it's tempting to add a matching `"purchase_expired"` entry to `EVENT_NAMES` for a 1:1 mapping.

**Why it's wrong:** The tracking layer already made the deliberate design decision to have a single `purchase_failed` tracking event cover both outcomes — `TrackingEvents.purchaseFailed()`'s existing `errorCode` field is exactly the mechanism for distinguishing failure reasons (pass `"expired"` / `"checkout_expired"` vs `"card_declined"` vs `"currency_mismatch"`). Adding a second event name would require also adding entries to `DEFAULT_EVENT_TOGGLES`, `EVENT_MAPPING`, a Klaviyo settings-UI row (if a distinct UI exists for it), and any Super Admin config key — none of which exist today for "expired" as distinct from "failed," and there's no evidence in the code that this distinction was ever intended at the tracking layer.

**Do this instead:** Reuse `TrackingEvents.purchaseFailed()` for both outcomes, differentiating via the existing `errorCode` field. This requires zero schema/catalog changes and lets Klaviyo flows segment on the `errorCode` property (already carried through `payload.properties`/`buildProperties()` in the Klaviyo adapter) if finer-grained flow branching is wanted later.

### Anti-Pattern 2: Adding event-name-specific branching inside `dispatch()` or the adapters

**What people might do:** Touch `tracking.service.ts`'s `dispatch()` function or add `if (payload.eventName === "purchase_failed")` branches inside `klaviyo.ts`/`meta-capi.ts`/etc.

**Why it's wrong:** The entire point of the `EVENT_MAPPING`/`DEFAULT_EVENT_TOGGLES` table-driven design is that adapters never need to know about specific event names — they look up `EVENT_MAPPING[payload.eventName]` generically. `purchase_failed` already has a row in that table. Touching the dispatcher or an adapter for this milestone would be scope creep into code that doesn't need to change and risks breaking the 25+ other events that share this same generic path.

**Do this instead:** Only touch the 4-5 Payment-module files listed in "Recommended Project Structure" above, plus optionally the new `trackingPurchaseFailedEmit.ts` helper.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Klaviyo | Already wired — `purchase_failed` → `"Purchase Failed"` metric, `klaviyo:true` default-on | No change needed; this is what "already visible in the Klaviyo settings UI" refers to — the settings UI reads `EVENT_MAPPING`/`DEFAULT_EVENT_TOGGLES` generically, so `purchase_failed` shows up automatically once any event is registered, and it already is |
| Meta CAPI / GA4 | Already wired at the mapping-table level (`ga4:true` default-on for `purchase_failed`; `fbEvent:"PurchaseFailed"` but `fbStandard:false` since Meta has no standard "purchase failed" event) | `metaCapi` destination is `false` by default for `purchase_failed` per `DEFAULT_EVENT_TOGGLES` (line 42) — this is an intentional existing default (non-standard custom Meta events are typically withheld to avoid CAPI noise); leave as-is unless product explicitly wants it changed |
| Partner postback | Explicitly does NOT handle `purchase_failed` — falls through to the generic "event not mapped" skip | Confirmed safe no-op; no partner ever receives a postback for a failed/expired purchase, which is almost certainly the desired behavior (partners are paid on conversions, not failures) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Payment services ↔ Tracking module | Direct function call: `TrackingEvents.purchaseFailed({...})` or new `emitTrackingPurchaseFailed(payment, reason)` helper, fire-and-forget | Same boundary/pattern as the existing `purchaseCompleted`/`papPaymentCompleted` integration — no new coupling introduced |
| Cron job ↔ Tracking module | Same direct call pattern, invoked from the existing `stalePayments` loop after the bulk `updateMany` | The cron currently does bulk updates without per-document `.save()` — tracking calls must use the pre-fetched hydrated documents from the initial `Payment.find(...)`, not re-fetch |

## Build Order Recommendation

Ordered by real-world volume/impact, per the quality gate ("build order considers which call sites cover the most real-world volume first"):

1. **`cron.service.ts` — `CronService.checkAndExpirePendingPayments()` — build first.** This is the provider-agnostic catch-all and, per the existing code (sweeps payments "older than 1 hour" pending, or "processing" stuck >10min), almost certainly the single largest source of both `"expired"` and `"failed"` (stuck-processing) status transitions in production — it catches every payment method's silently-abandoned checkouts, not just ones with an explicit provider webhook. Add the tracking call inside the existing `for (const payment of stalePayments)` loop (line 48), branching on whether the payment's `_id` is in `pendingIds` (→ fire with `errorCode:"expired"`) or `processingIds` (→ fire with `errorCode:"failed"`) — the arrays are already computed at lines 27-28.
2. **`stripe-webhook.service.ts` — build second.** Stripe is very likely the primary card-payment provider (explicit `payment_intent.payment_failed` and `checkout.session.expired` handlers already exist and are well-structured). Add calls in `handlePaymentIntentFailed()` (after line 326) and `handleCheckoutSessionExpired()` (after line 377). Consider also wiring the 4 security-mismatch `"failed"` branches (lines 103, 132, 245, 272) for completeness, though these are lower volume.
3. **`fanbasis-webhook.service.ts` — build third.** Add calls in `handlePaymentFailed()` (after line 425) and `handlePaymentExpired()` (after line 441).
4. **`callback.service.ts` (NOWPayments/crypto) — build fourth.** Add a single call inside `handleNonCompletedPayment()` (inside the existing `if (status === "failed" || status === "expired")` block at line 809) — cleanest, lowest-effort integration point since the generic branch already exists, but crypto is presumably lower volume than card payments.
5. **`paysafe.service.ts` — verify routing, build last.** Before writing any code here, confirm (via the Paysafe webhook controller/route, not yet located in this research pass) whether Paysafe ultimately flows through `callback.service.ts`'s generic `handleNonCompletedPayment` (in which case step 4 already covers it) or has its own separate webhook handler function that sets `payment.status` directly (in which case it needs its own call site, following the same pattern). This ambiguity should be resolved with a quick grep for the Paysafe webhook route/controller before finalizing scope — flagged here rather than guessed at.

## Sources

- Direct code inspection, `pft-backend` branch `main-2026` (2026-07-03), all HIGH confidence (read directly, not inferred):
  - `src/app/modules/Tracking/tracking.events.service.ts` (full file)
  - `src/app/modules/Tracking/tracking.interface.ts` (full file)
  - `src/app/modules/Tracking/tracking.constants.ts` (full file)
  - `src/app/modules/Tracking/tracking.service.ts` (full file — the dispatcher)
  - `src/app/modules/Tracking/destinations/klaviyo.ts` (full file)
  - `src/app/modules/Tracking/destinations/partner-postback.ts` (lines 1-104)
  - `src/app/modules/Tracking/dedup/dedup.service.ts` (partial — confirmed `TrackingEventLog`-backed dedup)
  - `src/app/modules/Payment/payment.interface.ts` (full file — status enum at line 109)
  - `src/app/modules/Payment/utils/trackingPurchaseEmit.ts` (full file — the pattern to mirror)
  - `src/app/modules/Payment/services/stripe-webhook.service.ts` (lines 1-390)
  - `src/app/modules/Payment/services/fanbasis-webhook.service.ts` (lines 280-450)
  - `src/app/modules/Payment/services/callback.service.ts` (lines 1-60, 200-290, 760-960)
  - `src/app/modules/Payment/services/cron.service.ts` (full file)
  - `src/app/modules/Payment/services/paysafe.service.ts` (grep only — `mapStatus` at line 929, webhook routing not fully traced)
  - `src/server.ts` (lines 280-320 — cron scheduling confirmation)
- Not verified in this pass (flag for implementation-time follow-up):
  - Exact Paysafe webhook controller/route file and whether it calls `callback.service.ts` or has independent status-transition logic
  - Meta CAPI / GA4 / conversionWebhook adapter files were not read line-by-line (only Klaviyo and partner-postback were fully verified) — architecture pattern strongly suggests they're equally generic, but a quick sanity grep during implementation is cheap insurance

---
*Architecture research for: Klaviyo/tracking purchase-coverage fix (v1.4 milestone) — pft-backend Tracking + Payment modules*
*Researched: 2026-07-03*
