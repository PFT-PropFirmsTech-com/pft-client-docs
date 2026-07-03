# Project Research Summary

**Project:** PFT WhiteLabel — v1.4 Klaviyo Purchase-Coverage Fix
**Domain:** Bugfix/coverage milestone — wiring a missing tracking-event call into an existing, already-shipped dispatch framework (pft-backend Tracking + Payment modules)
**Researched:** 2026-07-03
**Confidence:** HIGH

## Executive Summary

This is not a "build a feature" milestone — it's a coverage-gap bugfix on a tracking framework that already fully supports the missing case. All four researchers independently confirmed the same ground truth: `purchase_failed` is a complete, live event in the Tracking module — registered in `EVENT_NAMES`, given default per-destination toggles (`klaviyo: true`, `ga4: true`), mapped to a Klaviyo metric name (`"Purchase Failed"`), and exposed via a fully-typed `TrackingEvents.purchaseFailed()` helper — but it has **zero real callers** anywhere in the codebase. The dispatcher and every adapter (Klaviyo, GA4, partner-postback) are event-name-generic and require no changes. The entire fix is additive call-site wiring: invoke the existing helper (via a new small `emitTrackingPurchaseFailed()` util mirroring the proven `emitTrackingPurchaseCompleted()` pattern) from the ~5-7 places where gateway webhooks or the hourly expiry cron flip `Payment.status` to `"failed"`, `"expired"`, or `"cancelled"`.

The recommended approach is deliberately narrow: reuse the existing `purchase_failed` event (do not invent `purchase_expired` — this would triple the file-sync surface across `tracking.interface.ts`/`tracking.constants.ts` for no marketing benefit, since Klaviyo flows can filter on a `reason`/`errorCode` property instead of needing a second event name), differentiate outcomes via the already-defined `errorCode` field, and wire only genuine customer-facing terminal failures — not the internal PAP-concurrency-guard code paths that also happen to set `status: "expired"` for bookkeeping reasons unrelated to a real failed purchase.

The key risks are all subtle, repo-specific correctness traps rather than unknowns: (1) omitting a stable `eventId` on the new calls, which silently degrades dedup to a 60-second bucket and risks duplicate Klaviyo events on webhook retries; (2) firing the new event generically off any `status → "expired"` write, which would falsely flag two known internal PAP dedup/supersede paths (`payment.service.modular.ts` lines ~1451 and ~2704) as failed purchases even though the underlying purchase succeeded; (3) reintroducing the JPY-as-USD bug class (previously fixed for `purchase_completed`) because expired/failed payments are structurally more likely to hit the model's un-converted `usdAmount` fallback than completed payments were; and (4) the Klaviyo adapter's `buildProperties()` currently drops `errorCode`/`reason` on the floor — the fields exist on the payload type but are not in the adapter's allowlist, so they must be explicitly added or the "reason" data marketers need never reaches Klaviyo at all. A related, easy-to-miss scope gap: PAP funded-leg payment failures have no equivalent to the existing `pap_payment_completed` event and are fragmented across per-gateway handlers — a fix scoped only to the "main flow" will silently miss PAP failures.

## Key Findings

### Recommended Stack

No new dependencies, packages, or version changes of any kind. This is 100% additive TypeScript inside the existing `pft-backend` module tree on `main-2026`. All four research files agree: the Tracking module's catalog (`tracking.interface.ts`), toggle/mapping tables (`tracking.constants.ts`), dispatcher (`tracking.service.ts`), and Klaviyo adapter (`destinations/klaviyo.ts`) are complete and untouched by this work.

**Core technologies:**
- Existing `TrackingEvents.purchaseFailed()` helper (`tracking.events.service.ts:96-105`) — already accepts `{userId, email, invoiceId, value, currency, errorCode}`; call it, don't rebuild it
- New `emitTrackingPurchaseFailed(payment, errorCode?)` util (mirrors `Payment/utils/trackingPurchaseEmit.ts`'s `emitTrackingPurchaseCompleted`) — fire-and-forget wrapper, try/catch, stable `eventId`
- No new library, schema field, dispatcher route, or adapter change required

### Expected Features

Three terminal non-success `Payment.status` values already exist and are currently silent to Klaviyo: `failed`, `expired`, `cancelled`. All three represent the same marketing "recover this lost sale" use case and should reuse the single existing `purchase_failed` event, differentiated by an `errorCode`/`reason` property.

**Must have (table stakes):**
- Wire `purchase_failed` at genuine customer-facing `failed`/`expired`/`cancelled` call sites (Bucket A: Stripe, FanBasis, PayPal webhooks; NOWPayments/crypto generic callback; the hourly expiry cron)
- Populate `errorCode` on every call with the normalized status (minimum bar) or a richer gateway reason where cheaply available
- Promote `errorCode`/`reason` to a first-class Klaviyo property in `klaviyo.ts`'s `buildProperties()` (currently silently dropped)
- Stable, retry-safe `eventId` (e.g. `purchase_failed:<paymentId>`) mirroring the `purchase_completed` dedup pattern
- Exclude Bucket B internal housekeeping (PAP sibling-supersede, free-$0-PAP stale-attempt supersede, coupon-race resets) — these are concurrency guards, not real failures

**Should have (competitive, not blocking this ticket):**
- Audit PAP funded-leg gateway handlers for a `pap_payment_failed`-equivalent (mirrors the already-distinct `pap_payment_completed` event) — flagged by Pitfalls research as a likely silent scope gap if not deliberately addressed
- Richer per-gateway decline-reason text (Paysafe `STATUS_REASON`, Stripe `decline_code`) beyond the coarse normalized status

**Defer (v2+):**
- A separate `purchase_expired` Klaviyo metric — not recommended at all; property-level filtering already covers the need
- Refund tracking event — `refunded` isn't even in the current `Payment.status` enum; genuinely separate initiative
- `purchase_initiated` → terminal-outcome funnel/abandonment-rate analytics

### Architecture Approach

No new components, folders, or structural changes. This is a call-site-addition milestone layered onto the existing modular-by-domain structure (`src/app/modules/<Domain>/<domain>.{model,interface,service,controller}.ts`). The dispatcher and adapters are fully table-driven over `EventName` and require zero event-name-specific branching — that pattern must be preserved, not violated.

**Major components:**
1. **Payment webhook/cron handlers** (`stripe-webhook.service.ts`, `fanbasis-webhook.service.ts`, `paypal-webhook.service.ts`, `callback.service.ts`, `cron.service.ts`) — the only files that need edits; each gets 1-6 new one-line calls right after existing `payment.status = "..."; await payment.save()` sites
2. **New `emitTrackingPurchaseFailed()` util** (`Payment/utils/trackingPurchaseFailedEmit.ts`) — mirrors the proven `emitTrackingPurchaseCompleted()` shape; centralizes safe USD-amount extraction, try/catch, and eventId convention in one place instead of duplicating it per gateway
3. **Tracking dispatcher + Klaviyo/GA4/partner-postback adapters** — untouched except one small addition to `klaviyo.ts`'s `buildProperties()` to promote `errorCode`/`reason` into the outgoing property set

### Critical Pitfalls

1. **Missing explicit `eventId` breaks retry-safety silently** — the dispatcher's fallback dedup key is minute-bucketed; without a stable `eventId: "purchase_failed:<paymentId>"` on every new call, webhook retries or delayed redeliveries can produce duplicate Klaviyo "Purchase Failed" events. Must be part of the same PR/review checklist as the first call site, not a follow-up.
2. **Generic "any status → expired" hook fires false failures for successful PAP purchases** — `payment.service.modular.ts` sets `status: "expired"` at two internal-bookkeeping sites (sibling-supersede double-click guard at ~line 1451; free-$0-PAP stale-attempt supersede at ~line 2704) that are NOT customer failures. A naive implementation (e.g., a Mongoose hook watching for `status === "expired"`) will misfire here. Fire explicitly only from genuine customer-facing failure paths (cron TTL expiry, gateway webhook failures) and explicitly exclude these two sites.
3. **JPY-as-USD bug reintroduction, likely at a higher rate than the original** — `payment.model.ts`'s `pre("validate")` hook backfills `usdAmount` with an un-converted raw fallback (`amount ?? totalPrice ?? 0`) whenever a real converted value is missing. Expired/failed payments are structurally more likely to never have reached the FX-conversion step than completed payments were. Must reuse the existing normalized-USD-amount pattern and add a JPY-specific test case, not trust `usdAmount` blindly.
4. **`errorCode`/`reason` fields exist on the payload type but are silently dropped by the Klaviyo adapter** — `buildProperties()` only maps a fixed allowlist of fields into Klaviyo `properties`; `reason`/`errorCode` are not in that allowlist today. Without this fix, the entire "differentiate failure reasons" value proposition silently fails to reach Klaviyo even though the code compiles and appears correct.
5. **PAP funded-leg failure paths have no tracking equivalent and may be missed entirely** — `pap_payment_completed` required deliberate per-gateway wiring in v1.3 (no shared completion function exists); the same fragmentation almost certainly applies to failures. A fix scoped only to the "main flow" will leave PAP funded-leg declines/timeouts completely untracked. Requires its own explicit audit sub-task, not folding into the main-flow fix.

## Implications for Roadmap

Based on research, this milestone is small and well-bounded enough that it likely fits as a **single phase** (or two tightly-scoped phases if the PAP audit is separated out for clean review). Suggested structure:

### Phase 1: Core purchase-failure/expiry tracking wiring
**Rationale:** This is the actual ticket-closing work — the highest-volume, most direct fix for the reported Trading Cult symptom (Expired payment produces no Klaviyo signal). All research agrees on scope and shape; no architectural unknowns remain.
**Delivers:** New `emitTrackingPurchaseFailed()` util; call sites added in priority order — (1) `cron.service.ts` expiry sweep (highest volume, provider-agnostic catch-all), (2) `stripe-webhook.service.ts` (`handleCheckoutSessionExpired`, `handlePaymentIntentFailed`), (3) `fanbasis-webhook.service.ts` (`handlePaymentFailed`, `handlePaymentExpired`), (4) `callback.service.ts` (`handleNonCompletedPayment` — single call covers both failed+expired for NOWPayments/crypto), (5) `paypal-webhook.service.ts` inline failure sites; plus the `klaviyo.ts buildProperties()` addition to promote `errorCode`/`reason`.
**Addresses:** Table-stakes features from FEATURES.md — wiring `failed`/`expired`/`cancelled` outcomes, `errorCode` population, retry-safe `eventId`, Klaviyo property promotion.
**Avoids:** Pitfalls 1 (eventId), 2 (Bucket-B exclusion), 3 (JPY fallback), 4 (Klaviyo property mapping), 5 from PITFALLS.md (multi-file event-name drift — avoided entirely by reusing `purchase_failed`, not inventing a new event name).

### Phase 2 (optional, recommend as a distinct reviewable unit): PAP funded-leg failure audit
**Rationale:** PITFALLS.md and STACK.md both flag this as a distinct, easy-to-miss scope gap structurally similar to how `pap_payment_completed` needed separate per-gateway wiring in v1.3. Bundling it into Phase 1 risks it being silently skipped since it doesn't share a code path with the main-flow cron/webhook fix.
**Delivers:** Explicit audit of `fanbasis-webhook.service.ts`, `stripe-webhook.service.ts`, `callback.service.ts` for PAP-detection-guarded failure branches (`payment.payAfterPass && payment.currentProgramId`); decision on whether PAP failures reuse `purchase_failed` + a `payAfterPass` property flag, or need a new `pap_payment_failed` event name (mirroring the existing completed/failed split); wiring of whatever call sites are found.
**Addresses:** Differentiator-tier feature from FEATURES.md (PAP funded-leg parity with the completed-purchase tracking that already exists).
**Avoids:** Pitfall 4 from PITFALLS.md (PAP funded-leg failure paths silently uncovered); must also avoid misclassifying a PAP funded-leg payment stuck behind a KYC/contract gate (a known, separate hold state per project memory) as a failed/expired payment — the trigger condition must be strictly `Payment.status` transitioning to `failed`/`expired`, never a downstream queue-hold state.

### Phase Ordering Rationale

- Phase 1 must come first: it's the direct ticket-closing fix, has zero open design questions across all four research files, and establishes the `emitTrackingPurchaseFailed()` pattern/eventId convention that Phase 2 will reuse.
- Phase 2 is separated rather than folded in because it requires its own audit (grep across 3 gateway files for a completion-vs-failure branch asymmetry) and its own scope decision (reuse `purchase_failed` vs. new event name) — bundling it risks either scope creep in Phase 1's review or the PAP gap being silently dropped if reviewers assume "the main flow covers everything."
- Both phases explicitly avoid touching the dispatcher (`tracking.service.ts`) or any adapter's event-name branching logic — this is a hard architectural boundary the pitfalls research calls out as an anti-pattern to resist even under review pressure to "just special-case it in the adapter."

### Research Flags

Needs research: None flagged as needing `/gsd:research-phase` — all four researchers reached HIGH confidence via direct code reads with no unresolved architectural questions.

One item flagged for **implementation-time verification, not full research**: whether Paysafe routes through `callback.service.ts`'s generic `handleNonCompletedPayment` or has its own separate webhook handler that sets `payment.status` directly (ARCHITECTURE.md, item 5 in Build Order Recommendation) — resolve via a quick grep before finalizing Phase 1 scope, not a blocker to starting.

Standard patterns (skip research-phase):
- **Phase 1:** Directly mirrors the already-proven, already-shipped `emitTrackingPurchaseCompleted` pattern from v1.3 — same file conventions, same fire-and-forget contract, same dedup approach.
- **Phase 2:** Same mirroring pattern applied to a different (already-identified) set of call sites; no new architectural pattern needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all findings from direct file reads of the live `main-2026` codebase, not inference |
| Features | HIGH (codebase evidence); MEDIUM for external ecommerce-taxonomy framing | Codebase findings (event catalog, gaps, call sites) are direct/authoritative. Klaviyo/Segment "standard purchase-outcome taxonomy" claims are MEDIUM — community/spec docs, not one canonical standard, but used only to validate (not drive) the recommendation |
| Architecture | HIGH | All key files read in full; dispatcher/adapter genericity confirmed directly, not assumed. One unresolved item (Paysafe routing) explicitly flagged rather than guessed at |
| Pitfalls | HIGH | Grounded in direct reads of the actual v1.3 code plus this repo's project memory (PAP bug history); pitfalls are repo-specific findings (e.g., the two internal `status: "expired"` bookkeeping sites), not generic advice |

**Overall confidence:** HIGH

### Gaps to Address

- **Paysafe webhook routing not fully traced:** confirm during Phase 1 implementation whether Paysafe flows through the generic `callback.service.ts` handler (already covered) or needs its own call site.
- **PAP funded-leg failure branch existence is unconfirmed, only strongly suspected:** Phase 2's audit step must actually locate (or confirm the absence of) a per-gateway "PAP payment declined" branch before deciding whether new call sites or a new event name are needed — treat this as an open question to resolve in that phase, not a pre-decided fact.
- **Whether gateways populate `payment.errorMessage` with a usable failure reason today** is asserted as "field exists" but not verified as "actually populated on failure paths" — worth a quick spot-check before relying on it as the `reason` source in Phase 1.

## Sources

### Primary (HIGH confidence)
- Direct code reads, `pft-backend` repo, branch `main-2026` (2026-07-03): `Tracking/tracking.interface.ts`, `Tracking/tracking.constants.ts`, `Tracking/tracking.events.service.ts`, `Tracking/tracking.service.ts`, `Tracking/destinations/klaviyo.ts`, `Tracking/destinations/partner-postback.ts`, `Tracking/dedup/dedup.service.ts`, `Tracking/enrichment/hash.ts`, `Payment/utils/trackingPurchaseEmit.ts`, `Payment/payment.model.ts`, `Payment/payment.interface.ts`, `Payment/payment.service.modular.ts`, `Payment/services/{stripe-webhook,fanbasis-webhook,paypal-webhook,callback,cron,paysafe,paysagi,upigateway,oxapay,confirmo,crypto,stranded-reconcile}.service.ts`, `src/server.ts` (cron scheduling)
- Ticket cmqtl47g4004zny0kz54mmz0z (Trading Cult, Klaviyo purchase-coverage gap) — project context
- Project memory (`MEMORY.md`): PAP double XP bug, PAP funded KYC bypass, PAP JPY charged as USD, PAP funded queue gate gotcha — used to corroborate PAP funded-leg edge-case risk

### Secondary (MEDIUM confidence)
- [Stripe: Payment status updates / PaymentIntent lifecycle](https://docs.stripe.com/payments/payment-intents/verifying-status) — verified gateway status vocabulary, official docs
- [Paysafe Developer: Configure Webhooks / Payment Status](https://developer.paysafe.com/en/api-docs/payments-api/configure-webhooks/) — PAYMENT_HANDLE_EXPIRED/FAILED, STATUS_REASON schema, official docs
- [Segment: Spec V2 Ecommerce Events](https://segment.com/docs/connections/spec/ecommerce/v2/) — Checkout Started/Order Completed funnel conventions, official spec (doesn't define a canonical "Payment Failed" event itself)

### Tertiary (LOW confidence)
- Klaviyo Community forum posts on near-duplicate event antipatterns (manually-triggered checkout/placed-order/ordered-product confusion; abandoned-cart-after-purchase bug reports) — used only to support the "one event + property, not two events" recommendation, not as a primary source of fact

---
*Research completed: 2026-07-03*
*Ready for roadmap: yes*
