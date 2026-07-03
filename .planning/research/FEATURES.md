# Feature Research

**Domain:** Purchase-outcome tracking for a prop-firm challenge checkout feeding Klaviyo (and other CRM/ads destinations)
**Researched:** 2026-07-03
**Confidence:** HIGH (codebase evidence is direct/authoritative; gateway-status claims verified against Paysafe/Stripe official docs; Klaviyo/Segment ecommerce-taxonomy claims are MEDIUM — community + spec docs, not a single canonical "purchase-failure" standard)

## Codebase Findings (ground truth, not hypothesis)

This is a bugfix milestone, so the most important "research" is what's actually in the repo today:

- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` already defines `TrackingEvents.purchaseFailed({ userId, email, invoiceId, value, currency, errorCode })` (lines 96-105) and it correctly fires `"purchase_failed"`.
- `tracking.constants.ts` already has a full `purchase_failed` entry in both `DEFAULT_EVENT_TOGGLES` (klaviyo: true, ga4: true, others false) and `EVENT_MAPPING` (klaviyo metric name: `"Purchase Failed"`, ga4: `purchase_failed`, fbEvent: `PurchaseFailed` non-standard).
- **The bug: `TrackingEvents.purchaseFailed(...)` is never called anywhere in `Payment/`.** `grep` across `Payment/` and `Tracking/` shows the only reference to `purchaseFailed` in the whole backend is its own definition. Contrast with `purchase_completed`, which is wired via `emitTrackingPurchaseCompleted()` (`Payment/utils/trackingPurchaseEmit.ts`) and called from `stripe-webhook.service.ts`, `fanbasis-webhook.service.ts`, `callback.service.ts` (Paysafe/others), and `payment.service.modular.ts`.
- The actual non-completed-payment handling path is `callback.service.ts` → `handleNonCompletedPayment(payment, status)` (line 805): today it only does `if (status === "failed" || status === "expired") sendPaymentStatusNotification(...)` — an email, never a tracking event. This is the exact code path the Trading Cult ticket (cmqtl47g4004zny0kz54mmz0z) is hitting: an "Expired" payment produces no Klaviyo event because *nothing* on this path fires *any* tracking event, regardless of failed vs expired.
- `Payment.status` enum (payment.model.ts / payment.interface.ts) is already: `"pending" | "completed" | "failed" | "cancelled" | "expired" | "partially_paid" | "processing" | "capturing"` — 8 states, and `expired` is already a first-class, distinct value (not folded into `failed`) at the data-model layer.
- Every gateway adapter already normalizes its own vocabulary down into this shared enum, and **already treats `expired` as genuinely distinct from `failed`/`cancelled` at the mapping layer**, before the value ever reaches `Payment.status`:
  - `paysafe.service.ts:929` — `mapStatus()`: `EXPIRED`/`ABANDONED` → `"expired"`; `FAILED`/`CANCELLED`/`CANCELED`/`ERROR`/`ERRORED`/`DECLINED` → `"failed"`.
  - `paysagi.service.ts`, `upigateway.service.ts`, `oxapay.service.ts`, `confirmo.service.ts` all have the identical shape: a `mapStatus()` that returns `"expired"` as its own branch, separate from `"failed"`.
  - `crypto.service.ts:800` groups `["failed", "refunded", "expired"]` together only for a boolean "is this a dead-end status" check — not for event naming.
- `Tracking/destinations/klaviyo.ts` → `buildProperties()` does NOT currently pass through `errorCode` as a first-class Klaviyo property (it's not in the explicit `set(...)` allow-list). It would only reach Klaviyo if placed in the free-form `payload.properties` bag. This matters for the "reason as event property" requirement below.
- `EVENT_MAPPING.purchase_failed` currently has no `googleAdsSlot` (correct — you don't want an ads conversion pixel firing on a failure) and Klaviyo metric is the Title-Case convention `"Purchase Failed"`, consistent with the rest of the mapping table's naming style (`"Placed Order"`, `"Initiated Purchase"`).

**Implication:** the fix is almost entirely "wire the existing `purchaseFailed()` call at the existing non-completed-payment code path(s)" — not "design a new event/adapter/toggle." The event, its Klaviyo metric name, and its default-on toggle already exist and are already correct in shape. The gap is call-site wiring plus (per below) deciding whether `expired` reuses `purchase_failed` or gets `errorCode`/reason segmentation, and whether `cancelled`/`partially_paid`/`processing`/`capturing` need coverage too.

## Feature Landscape

### Table Stakes (Users Expect These)

Features/behaviors a marketing team assumes exist once "purchase tracking" is wired up. Missing these makes the CRM funnel silently lossy — which is exactly the client-visible symptom in the ticket (an admin sees "Expired" in Payment History but Klaviyo shows nothing).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `purchase_completed` fires on every successful payment | Core conversion signal; already built (v1.3) | LOW (done) | Baseline, not in scope for this milestone |
| A non-completed terminal outcome (`failed`) fires *some* tracking event | Marketers build "recover this failed payment" flows; a checkout with zero signal on failure is a known gap in every ecommerce integration (Shopify/Segment/Klaviyo all treat failed-payment as a trackable event) | LOW | `purchaseFailed()` exists, just needs a call site |
| `expired` (timed-out/abandoned unpaid session) also fires a tracking event | This is the literal client complaint — "Expired" status visibly exists in Payment History with no Klaviyo counterpart | LOW | Same call site as failed; see normalization decision below |
| `cancelled` (user-abandoned at gateway, e.g. Stripe `canceled`, Paysafe `CANCELLED`) also fires a tracking event | Functionally identical marketing use case to expired/failed — "recover this abandoned checkout" flow doesn't care which of the three sub-reasons caused it | LOW | Same call site; already normalized into a distinct `Payment.status` value |
| Failure/expiry event carries a machine-readable **reason** (`errorCode` or normalized `status`) as an event property | Without it, Klaviyo can't segment "declined card" vs "session timed out" vs "user cancelled" into different win-back copy — this is the single highest-leverage property for the flows a marketing team will actually build | LOW-MEDIUM | `purchaseFailed()` payload already has `errorCode?: string`; needs (a) callers to populate it with the normalized status/gateway reason, and (b) `klaviyo.ts buildProperties()` to promote it to a first-class property (currently would silently fall into the generic properties bag or be dropped since it's not in the `set()` allow-list) |
| Idempotent/dedup-safe firing (no duplicate events on gateway webhook retries) | Payment gateways retry webhooks; `purchase_completed` already solved this with `eventId: "purchase:<paymentId>"` | LOW | Reuse the same pattern: `eventId: "purchase-failed:<paymentId>:<status>"` so a status flip (e.g. pending→expired) is still a fresh event, but a retried webhook for the same terminal status is deduped |
| Per-brand admin toggle to enable/disable the event on Klaviyo | Existing `TrackingSettings` UI pattern (screenshot) already has a `purchase_failed` checkbox in the Purchase funnel category | LOW (done) | No new UI needed — the checkbox already exists and defaults to klaviyo:true |
| Fire-and-forget / never blocks or throws into the payment flow | Established pattern for every tracking call site in this codebase (`emitTrackingPurchaseCompleted` explicitly documents "never throws, never blocks") | LOW | Copy the existing `emitTrackingPurchaseCompleted` try/catch wrapper style for a new `emitTrackingPurchaseFailed` helper |

### Differentiators (Nice-to-Have, Not Required for This Ticket)

Features that would improve the win-back/recovery marketing use case beyond just "make the event fire," but are not needed to close the reported bug.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Separate `purchase_expired` Klaviyo metric (distinct from `purchase_failed`) | Lets marketing build a dedicated "abandoned checkout, come finish it" flow with different copy/timing than a genuine "your card was declined" flow | MEDIUM | See explicit recommendation below — **not recommended** as the primary fix; could be a v1.5+ enhancement if the client specifically asks for differentiated messaging |
| `purchase_initiated` reliably paired with a terminal outcome (webhook-driven state-machine visibility) | Lets marketing/analytics compute true "started checkout but never finished" abandonment rate, not just "we got an explicit failure webhook" | MEDIUM-HIGH | `purchase_initiated` already exists (klaviyo:false by default) but is a separate, pre-existing initiative; out of scope for this coverage-gap fix |
| Retry/recovery link embedded in the failed/expired event properties | Lets a Klaviyo flow deep-link the user straight back to the same checkout session | MEDIUM | Requires checkout URL construction logic not currently in the tracking payload shape; defer |
| Gateway-specific decline reason text (not just `errorCode`) surfaced to Klaviyo | Richer segmentation ("insufficient funds" vs "expired card" vs "fraud block") than a coarse status | MEDIUM | Only some gateways (Paysafe `STATUS_REASON`, Stripe `last_payment_error.decline_code`) expose this; would need per-gateway mapping work matching the existing `mapStatus()` pattern |

### Anti-Features (Do Not Build For This Ticket)

| Anti-Feature | Why It Seems Appealing | Why Problematic Here | Alternative |
|--------------|------------------------|----------------------|-------------|
| A brand-new destination-agnostic "purchase outcome" event taxonomy redesign | Feels like the "correct" long-term architecture | This is a coverage-gap bugfix milestone on an already-shipped, working framework (adapters/dispatcher/toggles all work for `purchase_completed`). A taxonomy redesign is out of scope, risks regressing FTD/PAP-skip/dedup logic that v1.3 just hardened, and isn't what the ticket asked for | Reuse the existing `purchase_failed` event/mapping/toggle; only add the missing call sites + reason property |
| Firing tracking events for every intermediate/transient status (`pending`, `processing`, `capturing`, `partially_paid`) | "More coverage is always better" | These are non-terminal states — a payment in `processing` may still become `completed` moments later. Firing `purchase_failed` (or any terminal-sounding event) here would create false "your payment failed" emails while the payment is still in flight | Only fire the failure/expiry event on the actual **terminal** non-success statuses this milestone is scoped to: `failed`, `expired`, `cancelled` |
| Separate Klaviyo metrics for every gateway-specific status string (`EXPIRED` vs `ABANDONED` vs `AUTH_EXPIRED` vs `PAYMENT_HANDLE_EXPIRED`) | Gateways expose many granular sub-statuses | Klaviyo flows are built against metrics, not raw gateway codes; one metric per marketing use-case with the raw code as a *property* is standard practice (this is exactly what the existing gateway `mapStatus()` functions already do — normalize N raw gateway strings into ~5-8 canonical `Payment.status` values) | Normalize at the gateway-mapping layer (already done); pass the raw/normalized code through as `errorCode`, not as a distinct event name |
| Real-time bi-directional sync (reading event delivery status back from Klaviyo) | Feels like closing the loop | Massive scope increase or no clear API for it; Klaviyo Events API returns 202 Accepted with no useful delivery confirmation body (already observed in `klaviyo.ts`) | Rely on existing dispatch-result logging (`status: "sent"/"failed"/"skipped"`) already implemented in the adapter |

## Standard Purchase-Outcome States — Domain Answer

For a payment/checkout funnel feeding a marketing tool like Klaviyo, the canonical purchase lifecycle (drawing on Klaviyo's own "Started Checkout" → "Placed Order" conventions, Segment/RudderStack's ecommerce spec — `Checkout Started` → `Order Completed`/`Payment Failed` — and the reality of gateway webhooks like Stripe/Paysafe) maps to five conceptual outcome buckets:

| Conceptual Outcome | Typical Trigger | Table Stakes or Nice-to-Have | Gateway-status examples seen in this repo |
|---|---|---|---|
| **Initiated** | Checkout session/payment intent created, no outcome yet | Table stakes for funnel *visibility* (drop-off rate), but NOT required for the Klaviyo win-back use case this ticket is about | `purchase_initiated` already exists, klaviyo:false by default (correctly de-scoped — a marketing tool doesn't need every checkout start as a "metric," only conversions/losses) |
| **Completed / Succeeded** | Payment captured/settled | Table stakes — the core conversion event | `Payment.status: "completed"`; Stripe `succeeded`; Paysafe `COMPLETED`/`SUCCESS`/`SETTLED` |
| **Failed** | Payment attempt actively rejected (card declined, processor error, fraud block) | Table stakes | `Payment.status: "failed"`; Stripe transitions to `requires_payment_method` on decline; Paysafe `FAILED`/`DECLINED`/`ERROR`/`ERRORED` |
| **Expired / Abandoned** | User never completed the payment step within the gateway's time window (no explicit decline — just a timeout) | Table stakes **for this ticket specifically** — this is the literal reported gap | `Payment.status: "expired"`; Stripe `PaymentIntent` authorization expiry / auto-cancel after ~7 days uncaptured; Paysafe `EXPIRED`/`ABANDONED` (webhook reasons `AUTH_EXPIRED`, `AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE`) |
| **Cancelled** | User or merchant explicitly cancels before completion | Table stakes (already a distinct `Payment.status`) — same marketing use case as expired | `Payment.status: "cancelled"`; Stripe `canceled`; Paysafe `SETTLEMENT_CANCELLED` webhook |
| **Refunded** | Money returned after a prior completion | Nice-to-have for this milestone — refunds are a *post-completion* reversal, not a purchase-outcome-at-checkout-time state, and are a materially different notification/segmentation use case (e.g. "win-back" copy is wrong for someone who already got their money back) | Not currently a `Payment.status` enum value in this codebase at all (`crypto.service.ts` references `"refunded"` as a string in one boolean-grouping check, but it isn't in the canonical Payment status enum) — building this is a separate initiative, explicitly out of scope here |

**Verdict on table-stakes vs nice-to-have for this milestone:** `failed`, `expired`, and `cancelled` are the three terminal-non-success statuses that already exist in `Payment.status` and all deserve tracking-event coverage — they represent the same marketing intent (recover a lost sale) and are all currently silent. `initiated` is already correctly scoped out of Klaviyo by default. `refunded` is a genuinely different concern (post-purchase reversal) and should not be pulled into this bugfix.

## Event-Name Normalization Decision

**Question:** does `expired` deserve its own `purchase_expired` Klaviyo event, or should it fold into the existing `purchase_failed` event?

**Recommendation: normalize `expired` (and `cancelled`) into the existing `purchase_failed` event, with the specific reason carried as an `errorCode`/`reason` property — do not create a separate `purchase_expired` metric.**

Rationale:

1. **The infrastructure already assumes one event, many reasons.** `purchaseFailed()`'s signature already has `errorCode?: string` — the payload shape was clearly designed to carry a normalized reason string, not to be re-invoked per-gateway-status. Adding a second event name (`purchase_expired`) would mean also adding a second `EVENT_MAPPING` entry, a second `DEFAULT_EVENT_TOGGLES` row, a second UI checkbox, and duplicating the FTD/PAP-skip-guard style code-review the team already went through for `purchase_completed` — all for a distinction Klaviyo segmentation can express via a property filter instead.
2. **Gateways themselves treat "failed" as the parent category with sub-reasons, not as siblings requiring separate downstream events.** Every `mapStatus()` in this codebase (Paysafe, Paysagi, UPI Gateway, OxaPay, Confirmo) already collapses many raw gateway strings into a small canonical status set — that's the established pattern in this repo, and it already puts `expired` and `failed` as two branches of the *same normalization function*, i.e. "kinds of not-completed," not two independent product concepts.
3. **Marketing segmentation is a solved problem with one event + a property, not two events.** In Klaviyo, a flow trigger on "Purchase Failed" metric can immediately branch/filter on a `reason` property (`"expired"` vs `"declined"` vs `"cancelled"`) to send different copy — this is the standard Klaviyo/Segment pattern (comparable to how Klaviyo's own "Placed Order" vs "Ordered Product" split is a known source of confusion precisely because near-duplicate events complicate flow trigger/filter logic, per the Klaviyo community sources below). Two near-identical purchase-failure events sitting seconds apart with overlapping semantics is the antipattern the Klaviyo community explicitly warns about.
4. **Client ask is narrower than "differentiate the message."** The ticket is "we got zero Klaviyo signal for an Expired payment" — the fix that closes the ticket is "fire something," not "fire something with bespoke messaging infrastructure." A single `purchase_failed` event with `errorCode: "expired"` (or `"cancelled"`, `"declined"`, etc.) fully satisfies "every real purchase outcome fires its corresponding event" while leaving the door open for a marketing team to later ask for differentiated flows off the `errorCode` property — no code/schema changes needed if that ask comes later.

**Dependency note — the reason/errorCode property is not optional, it's load-bearing for this recommendation:** if `expired` and `failed` and `cancelled` all fire the identical `purchase_failed` event with no distinguishing property, the normalization becomes a regression from the marketing team's point of view (they lose the ability to tell "card declined" from "user walked away" from "session timed out" — three flows with legitimately different appropriate copy/timing). Concretely this means:
- Every call site that will invoke the new `emitTrackingPurchaseFailed`-style helper (mirroring `emitTrackingPurchaseEmit.ts`'s existing `emitTrackingPurchaseCompleted` pattern) must pass `errorCode` populated from the already-normalized `Payment.status` value (`"expired"`, `"failed"`, `"cancelled"`) or, where available, a more specific gateway reason (Paysafe's `STATUS_REASON`, Stripe's decline_code).
- `klaviyo.ts`'s `buildProperties()` must promote `errorCode` to a first-class property (add a `set("reason", payload.errorCode)` line) rather than relying on the generic free-form `properties` passthrough, so it's guaranteed to arrive as a segmentable Klaviyo property on every send, not just when a caller happens to also populate `payload.properties`.

## Feature Dependencies

```
Payment.status already distinguishes failed/expired/cancelled (done, v1.x)
    └──enables──> emitTrackingPurchaseFailed() helper (new, mirrors emitTrackingPurchaseCompleted pattern)
                       └──requires──> errorCode populated from normalized status at every call site
                                          └──requires──> klaviyo.ts buildProperties() promotes errorCode to first-class property
                                                             └──enables──> Klaviyo flow segmentation by failure reason (nice-to-have, not blocking)

purchase_failed event/mapping/toggle (already exists, v1.3)
    └──reused-by──> expired outcome (no new event needed — see normalization decision)
    └──reused-by──> cancelled outcome (no new event needed)

eventId dedup pattern (established by purchase_completed: "purchase:<paymentId>")
    └──must-be-mirrored-by──> new failed/expired eventId scheme (e.g. "purchase-failed:<paymentId>:<status>")
                                   └──prevents──> duplicate Klaviyo events on gateway webhook retries
```

### Dependency Notes

- **New failed/expired emit helper requires `errorCode` at every call site:** without this, the normalization decision (one event, many reasons) silently degrades into "one event, no reasons," which loses the exact information a marketing team needs to act on the difference between the three terminal non-success states. This is the single most important requirement to carry into implementation planning.
- **`klaviyo.ts` property promotion is a small, isolated, low-risk change:** adding one `set("reason", payload.errorCode)` line to `buildProperties()` — does not touch the dispatcher, other adapters, or the toggle system.
- **Dedup/eventId must be mirrored, not reused verbatim:** unlike `purchase_completed` (which fires once per payment, ever), a single payment could plausibly transition through more than one non-success status over its life in rare edge cases (e.g. `pending` → webhook retry storms) — the eventId scheme should include the status being reported so a legitimate status change still produces a fresh, non-deduped event, while retried webhooks for the *same* status stay deduped.

## MVP Definition (This Milestone Only)

### Launch With (v1.4 — closes the ticket)

- [ ] Wire `TrackingEvents.purchaseFailed(...)` into the actual non-completed-payment code path (`callback.service.ts handleNonCompletedPayment`, plus the equivalent branch in `stripe-webhook.service.ts` / `fanbasis-webhook.service.ts` if they have their own non-completed handling, mirroring how `purchase_completed` is wired at multiple call sites) — for `status ∈ {failed, expired, cancelled}`.
- [ ] Populate `errorCode` on every call with the normalized `Payment.status` value (minimum bar) or richer gateway reason where cheaply available.
- [ ] Promote `errorCode` → `reason` as a first-class Klaviyo property in `klaviyo.ts buildProperties()`.
- [ ] Add a stable, retry-safe `eventId` (status-scoped) mirroring the `purchase_completed` dedup pattern.
- [ ] Verify the existing `purchase_failed` admin toggle checkbox actually gates this new call site correctly (it should, since it reuses the existing event name/dispatcher — but confirm end-to-end once wired).

### Add After Validation (v1.4.x, only if requested)

- [ ] Richer gateway-specific decline reason text (Paysafe `STATUS_REASON`, Stripe `decline_code`) beyond the coarse normalized status, if the client wants finer segmentation than "expired/failed/cancelled."
- [ ] Differentiated Klaviyo flow copy/timing keyed on the `reason` property (this is a Klaviyo-side flow-building task, not a code change).

### Future Consideration (v2+, explicitly out of scope)

- [ ] A distinct `purchase_expired` event/metric — only revisit if a future client ask specifically requires Klaviyo-side event-level (not property-level) differentiation, e.g. because a single flow trigger genuinely cannot express the needed logic via a property filter.
- [ ] Refund tracking event (`purchase_refunded` or similar) — genuinely separate initiative; `refunded` isn't even in the current `Payment.status` enum.
- [ ] `purchase_initiated` → terminal-outcome funnel-completion analytics (true abandonment-rate reporting) — separate initiative from "make Klaviyo receive the event."

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Wire `purchase_failed` at `failed`/`expired`/`cancelled` call sites | HIGH | LOW | P1 |
| `errorCode`/reason property populated + promoted in Klaviyo adapter | HIGH | LOW | P1 |
| Retry-safe status-scoped `eventId` | MEDIUM | LOW | P1 |
| Richer per-gateway decline-reason text | MEDIUM | MEDIUM | P2 |
| Separate `purchase_expired` Klaviyo metric | LOW (property filter already covers the need) | MEDIUM | P3 |
| Refund tracking event | MEDIUM | MEDIUM-HIGH (new status + full destination coverage) | P3 |

## Sources

- Direct codebase inspection (HIGH confidence, authoritative for this repo):
  - `pft-backend/src/app/modules/Tracking/tracking.events.service.ts`
  - `pft-backend/src/app/modules/Tracking/tracking.constants.ts`
  - `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts`
  - `pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts`
  - `pft-backend/src/app/modules/Payment/services/callback.service.ts`
  - `pft-backend/src/app/modules/Payment/services/paysafe.service.ts`
  - `pft-backend/src/app/modules/Payment/payment.model.ts`, `payment.interface.ts`
  - `pft-backend/src/app/modules/Payment/services/{paysagi,upigateway,oxapay,confirmo,crypto,stripe-webhook,fanbasis-webhook}.service.ts`
- [Stripe: Payment status updates](https://docs.stripe.com/payments/payment-intents/verifying-status) — PaymentIntent status enum (MEDIUM confidence, verified via official docs)
- [Stripe: How Payment Intents and Setup Intents work](https://docs.stripe.com/payments/paymentintents/lifecycle) — expiry/auto-cancel behavior
- [Paysafe Developer: Configure Webhooks](https://developer.paysafe.com/en/api-docs/payments-api/configure-webhooks/) — PAYMENT_HANDLE_EXPIRED, PAYMENT_HANDLE_FAILED, PAYMENT_FAILED, SETTLEMENT_CANCELLED as distinct webhook events with STATUS_REASON detail (MEDIUM-HIGH, official docs)
- [Paysafe Developer: Payment Status](https://docs.paysafe.com/api/embedded-wallets/webhooks/schemas/payment-status) — status/reason schema
- [Segment: Spec V2 Ecommerce Events](https://segment.com/docs/connections/spec/ecommerce/v2/) — Checkout Started / Order Completed funnel conventions (MEDIUM, official spec but doesn't define a canonical "Payment Failed" event itself)
- [Klaviyo Community: manually trigger checkout started, placed order, ordered product event](https://community.klaviyo.com/marketing-30/manually-trigger-checkout-started-placed-order-ordered-product-event-5906) — evidence for the near-duplicate-event antipattern (LOW-MEDIUM, community forum)
- [Klaviyo Community: A customer received an abandoned cart email after ordering](https://community.klaviyo.com/marketing-30/a-customer-received-an-abandoned-cart-email-after-ordering-why-this-happens-and-how-to-fix-it-393) — evidence for why near-duplicate/overlapping events cause flow-filtering bugs (LOW-MEDIUM, community forum)

---
*Feature research for: Klaviyo purchase-coverage fix (v1.4 milestone)*
*Researched: 2026-07-03*
