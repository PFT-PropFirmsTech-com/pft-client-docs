# Phase 11 Research: Wire Emits + Dedup (CRM-04/05/06/08)

**Derived from** `.planning/research/ARCHITECTURE.md` + `PITFALLS.md`, **plus fresh code investigation 2026-07-01 that CORRECTS two milestone-research assumptions** (noted below). All anchors verified against live pft-backend on main-2026.

## Phase scope

Wire the tracking events that carry the partner clickid to their real emit sites so Phase 12's `partnerPostback` adapter has something to fire on. NO adapter, NO config, NO postback HTTP in this phase (Phase 12). This phase produces the EVENTS (with `partnerClickId` + `usdAmount` + `currency=USD` + an FTD signal) and ensures they don't double-fire.

## CORRECTIONS to milestone research (read carefully)

1. **`partnerClickId` comes from the PAYMENT DOC, not a `User.findById` lookup.** Phase 10 (CRM-03) already persisted `partnerClickId` on `payment.attribution.partnerClickId` precisely so the completion paths (which run with `req=null`) can read it synchronously. Do NOT add an async User lookup at purchase sites — read `payment.attribution?.partnerClickId`. For the SIGNUP event, read `user.partnerClickId` off the just-registered user doc (already in scope).

2. **`papPaymentCompleted` is NOT unwired — it already fires at 2 sites.** `TrackingEvents.papPaymentCompleted({...})` is already called at `callback.service.ts:854` and `stripe-webhook.service.ts:507`. Phase 11 THREADS `partnerClickId` + normalized `usdAmount` into those existing calls — it does not create them. (The milestone research said "PAP path unwired"; that was about the conversionWebhook ROUTING flag `pap_payment_completed: conversionWebhook:false`, which Phase 12 flips to `partnerPostback:true`.) The one currently-zero-caller PAP concern: the papPaymentCompleted call at :854 passes `value: payment.payAfterPassRemainingPrice` — that is the BILLED amount (can be JPY!). Phase 11 must switch it to `usdAmount` (guards the JPY-as-USD bug).

## Emit sites (verified anchors)

### CRM-04 — signup_completed (ZERO callers today → wire it)
Registration completes at TWO sites in `auth.service.ts`, each already firing a FacebookPixel `CompleteRegistration`:
- One-step (2FA-disabled) path: ~`auth.service.ts:650`.
- Two-step OTP path: ~`auth.service.ts:1020-1022`.
Add `TrackingEvents.signupCompleted({ userId, email, /* + partnerClickId */ })` next to each (fire-and-forget, mirror the FacebookPixel call). **NOTE:** the `signupCompleted` signature today is `{ userId, email?, source? }` — it has NO `partnerClickId`. Phase 11 must extend `ITrackingEventPayload` + the `signupCompleted` arg type to carry `partnerClickId`, and read it from the registered user doc (`user.partnerClickId`). Skip-when-absent (don't pass empty).

### CRM-05/CRM-06 — purchase_completed (standard) + papPaymentCompleted (PAP)
- **Standard purchases (PAID + free):** the single shared emit utility `emitPurchaseCompletedWebhook(payment)` (`Payment/utils/salesWebhookEmit.ts`) is called from BOTH standard completion points:
  - PAID standard: Payment **post-save hook** `payment.model.ts:338` (`paymentSchema.post("save", ...)`).
  - Free $0: explicit call at `payment.service.modular.ts:1507`.
  Cleanest wiring: emit `TrackingEvents.purchaseCompleted({...})` from the SAME utility (or a sibling `trackingPurchaseEmit(payment)` called at the same 2 sites), reading `payment.attribution?.partnerClickId`, `payment.usdAmount`, `currency:"USD"`. `purchaseCompleted` today already has `value`/`currency` fields but NO `partnerClickId` — extend its arg type + `ITrackingEventPayload`.
- **PAP funded-leg:** thread `partnerClickId` (from `payment.attribution`) + `value: payment.usdAmount` into the existing `papPaymentCompleted` calls at `callback.service.ts:854` and `stripe-webhook.service.ts:507` (and check `fanbasis-webhook.service.ts` ~:200 for a third PAP path). Extend the `papPaymentCompleted` arg type + payload to carry `partnerClickId`.

### CRM-05 — FTD (first-purchase) signal — DESIGN CORRECTION
**The ROADMAP SC#3 wording ("a second payment does NOT produce a second purchase_completed event") is imprecise and must NOT be implemented literally.** `purchase_completed` is a SHARED multi-destination event (Meta CAPI, GA4, Klaviyo all consume it and NEED every purchase). Suppressing it on the 2nd purchase would break those integrations.
Correct design: `purchase_completed` / `pap_payment_completed` fire on EVERY purchase (unchanged for other destinations). FTD is expressed as an **`isFirstPurchase: boolean` flag on the payload**, computed at emit time (`Payment.countDocuments({ userId, status: "completed" })` before/at this completion === 0 → first). **The "conversion postback fires once per user" guarantee (CRM-05 "later purchases do NOT fire again") is ENFORCED in Phase 12** — the `partnerPostback` conversion send is gated on `isFirstPurchase === true`. Phase 11 only produces the signal.

### CRM-08 — dedup + dual-path audit
- **Per-payment dedup:** `Tracking/dedup/dedup.service.ts` (`TrackingEventLog`) dedups events. Use a stable dedupe key = `paymentId` (purchase) / `userId` (signup) so provider-webhook retries / duplicate saves resolve to ONE event. `emitPurchaseCompletedWebhook` already dedups the SalesWebhook on payment id — mirror that.
- **Dual-path audit (low risk, confirmed):** the legacy `ConversionWebhookEventsService` fires ONLY lifecycle events — `onKYCCompleted` (`kyc.service.ts:649`), `onPayoutCompleted` (`withdrawal.service.ts:2409/2835`), `onChallengePassed` (`passed.service.ts:106`) + `dispatchFromWorker`. It does NOT handle signup_completed or purchase_completed. So the new Tracking-path signup/purchase events do NOT overlap the legacy path → no double-fire. The audit's job is to CONFIRM this (grep the legacy call sites, document that none emit signup/purchase) — not a refactor.

## Open items to resolve in planning (flag, resolve by reading)
1. **PAP double-emit guard:** does the Payment post-save hook (`payment.model.ts:338` → emitPurchaseCompletedWebhook) ALSO fire for PAP funded-leg payment saves? If yes, a PAP purchase could emit BOTH `purchase_completed` (post-save) AND `pap_payment_completed` (callback:854) → the partner would see two conversions for one PAP sale. The plan must ensure exactly ONE partner-conversion-eligible event per PAP purchase (either the tracking purchase emit skips PAP payments, or Phase 12 only maps ONE of the two events to partnerPostback). Read emitPurchaseCompletedWebhook's guards + the post-save hook conditions.
2. **Third PAP path:** confirm whether `fanbasis-webhook.service.ts:200` has a papPaymentCompleted call to thread too (grep showed the provisioning comment, verify the event call).
3. **FTD count timing:** `countDocuments({userId, status:"completed"})` must be evaluated at the right moment (this payment already flipped to completed? then === 1 means first; if before flip, === 0). Pin the exact ordering relative to the status update.
4. **signupCompleted at BOTH registration paths** (one-step :650 + two-step :1020) — wire both, or a shared completion point.

## Do NOT (this phase)
- NO `partnerPostback` adapter, NO `destinations/partner-postback.ts`, NO config, NO outbound HTTP (Phase 12).
- Do NOT suppress `purchase_completed` on repeat purchases (breaks Meta/GA4) — FTD is a flag, enforced at Phase 12.
- Do NOT touch the existing SalesWebhook / FacebookPixel / Meta-CAPI behavior — ADD alongside.
- No new npm deps. main-2026 both. No brandId.

## Verification anchors (for plan must_haves)
- `signup_completed` fires once per registration (both one-step + OTP paths) carrying `partnerClickId` when the user has one; dedupes on a second OTP submit.
- `purchase_completed` fires on first standard purchase carrying `partnerClickId` + `usdAmount` + `currency:"USD"` + `isFirstPurchase:true`; a 2nd purchase fires again with `isFirstPurchase:false` (NOT suppressed).
- `pap_payment_completed` fires for a PAP funded-leg carrying `partnerClickId` + `usdAmount` (not billed JPY); exactly one partner-conversion-eligible event per PAP purchase.
- TrackingEventLog shows no duplicate event for the same paymentId under retry.
- Audit doc: legacy ConversionWebhookEventsService emits only KYC/payout/challenge — no overlap with signup/purchase.
