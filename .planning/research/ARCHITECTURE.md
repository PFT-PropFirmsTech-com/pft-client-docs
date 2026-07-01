# Architecture Research: CRM Partner S2S Postback (v1.3)

**Domain:** S2S conversion postback — partner click-ID capture, persistence, and GET postback firing via existing tracking infrastructure
**Researched:** 2026-07-01
**Confidence:** HIGH — based on direct code reads of all named files

---

## Existing Tracking Infrastructure (Verified)

### Dispatch Framework

```
Business event (e.g. registration / payment complete)
         |
         v
TrackingEvents.signupCompleted() / .purchaseCompleted()
  [ tracking.events.service.ts:38 / :61 ]
         |
         v
dispatch(payload, { req }) — tracking.service.ts:150
         |
   enrichClickIds()         enrichUserData()      enrichRequestContext()
   [enrichment/click-ids.ts:10]  [user-data.ts]     [request-context.ts]
         |
         v
   destinationAcceptsEvent() per destination  [tracking.service.ts:66]
         |
    +----+------------------------------------------+
    |  conversionWebhook adapter                    |
    |  [destinations/conversion-webhook.ts:34]      |
    |  EVENT_NAME_MAP (lines 19-25):                |
    |    phase_passed      -> ChallengePassed        |
    |    account_breached  -> ChallengeFailed        |
    |    payout_completed  -> PayoutCompleted        |
    |    kyc_verified      -> KYCCompleted           |
    |    account_funded    -> AccountFunded          |
    |  NOTE: signup_completed and                   |
    |  purchase_completed are NOT in this map       |
    |  -> adapter returns "skipped" for both        |
    +-----------------------------------------------+
         |
         v
ConversionWebhookService.deliverPayload()
  [Admin/ConversionWebhook/conversion-webhook.service.ts:113]
  POST JSON to webhookUrl with HMAC signature header
```

### Key Config Location

`TrackingSettings` collection (`tracking_settings`) — one active doc per environment (production / staging / development). Destination sub-doc at `destinations.conversionWebhook` holds `{ enabled, webhookUrl, webhookSecret }` — from `tracking.model.ts:74-80` and `tracking.interface.ts:116-119`. This is the per-brand config location (per-DB isolation, no brandId field needed).

### Current Click-ID Enrichment

`enrichClickIds` (`enrichment/click-ids.ts:10-40`) reads: Meta `_fbc`/`_fbp`, `gclid`, `ttclid`, `msclkid`, `li_fat_id` — from request cookies and query string, merged onto the payload. There is no `partnerClickId` / `aff_click_id` / generic partner param. This file must be extended.

---

## Critical Gap: signup_completed and purchase_completed Are Not Wired

**Finding (HIGH confidence):** `TrackingEvents.signupCompleted()` is defined at `tracking.events.service.ts:38` but is never called anywhere in the codebase. Same for `TrackingEvents.purchaseCompleted()` at line 61.

- Registration completion fires `FacebookPixelService.trackStandardEvent("CompleteRegistration", ...)` at `auth.service.ts:1021` — a direct legacy path that bypasses the tracking dispatcher entirely.
- Purchase completion fires `emitPurchaseCompletedWebhook(payment)` at `payment.service.modular.ts:1499` (free/coupon path) and the post-save hook fires Prometheus metrics only (`payment.model.ts:337`). The `emitPurchaseCompletedWebhook` helper calls `SalesWebhookDispatcher.purchaseCompleted()` — which routes to the SalesWebhook system (a separate webhook-config collection), not the tracking dispatch system.
- The Tracking dispatcher's `purchase_completed` event has no call site and the `conversionWebhook` adapter has no mapping for it.
- `tracking.constants.ts:29,40` shows `conversionWebhook: true` for both events — meaning the dispatcher will route them to the adapter, which immediately returns "skipped" because neither event is in `EVENT_NAME_MAP`.

**Consequence:** Both `signup_completed` and `purchase_completed` must be wired as new call sites as part of this milestone before the postback can fire.

---

## Integration Design

### 1. Where the Partner Click ID Is Captured and Persisted

**Decision: Store `partnerClickId` on the User document, captured at registration via a body field forwarded from the frontend cookie.**

Rationale:
- The User document (`auth.model.ts:186`) is the natural per-user persistent record, already available at every downstream event emit site by userId lookup.
- The click-to-registration gap is the hardest: the user is anonymous at click time and has an identity only after OTP verification completes (`auth.service.ts:820-953`). A cookie (set on the frontend on landing, forwarded as a body field at signup) is the reliable bridge — no server-side session exists between anonymous click and account creation.
- The click-to-purchase gap is trivially solved: `userId` is known at payment time; look up `user.partnerClickId`.
- `partnerClickId` is written once at registration and read at every subsequent event. It never changes. This satisfies "survives click to registration to purchase."

**Capture flow:**
1. Frontend landing page receives `?clickid=<value>` (or partner param name `?aff_click_id=` etc.) from the partner redirect URL.
2. Frontend stores the raw value in a first-party cookie (e.g. `_partner_clickid`, 30-day expiry, same pattern as `_fbc`/`_gclid`).
3. At registration, the frontend reads the cookie and forwards it as `req.body.partnerClickId`.
4. `TRegisterUser` interface (`auth.interface.ts:320`) gains `partnerClickId?: string`.
5. `UserSchema` (`auth.model.ts:186`) gains `partnerClickId: { type: String, index: true }`.
6. `AuthService.verifyRegistrationOtp` (`auth.service.ts:820`) writes the field to the user document in the `User.findByIdAndUpdate` call at line 830.

**Alternative rejected:** A separate `PartnerClick` collection keyed by session token adds a lookup hop and requires a token threaded through the OTP flow — over-engineered for a one-partner MVP.

### 2. How the Click ID Reaches the Emit Points

**signup_completed:** Add `TrackingEvents.signupCompleted({ userId, email, partnerClickId: registeredUser.partnerClickId })` in the post-OTP block of `auth.service.ts` around line 1020 (after the existing `FacebookPixelService.trackStandardEvent` call). Pass `null` for req — `auth.controller.ts` does not propagate req into the service layer, and the partnerClickId is already on the user doc, not the live request.

**purchase_completed (paid path):** Gateway callbacks (`callback.service.ts`) and Stripe webhooks (`stripe-webhook.service.ts`) do not currently call any `TrackingEvents` for the purchase event. A shared utility — mirroring `emitPurchaseCompletedWebhook` (`payment/utils/salesWebhookEmit.ts:36`) but targeting the tracking system — should be added. It receives the payment doc, does a lightweight `User.findById(payment.userId).select("partnerClickId")`, then calls `TrackingEvents.purchaseCompleted({ ..., partnerClickId })`. This utility is called from all paid-completion paths.

**purchase_completed (free/coupon path):** Called at `payment.service.modular.ts:1499` alongside `emitPurchaseCompletedWebhook`. Add the new tracking utility call there.

**`enrichClickIds` extension (`enrichment/click-ids.ts:10`):** Add reading `_partner_clickid` cookie as a fallback for `payload.partnerClickId`. This handles the case where a request object is available (browser-side events); for server-side-only paths the value comes from the user doc, not the cookie.

### 3. How the S2S GET Postback Is Fired

**Decision: Add a new sibling `partnerPostback` destination adapter. Do NOT modify the existing `conversionWebhook` adapter.**

Rationale for a new adapter:
- The existing `conversionWebhookAdapter` (`destinations/conversion-webhook.ts`) is a POST JSON adapter with HMAC signing. S2S postbacks for CPA networks are GET requests with URL macro substitution (e.g. `https://partner.net/postback?clickid={clickid}&amount={amount}`). These are different transport contracts.
- Adding a GET branch to the existing adapter would put a mode-switch into an adapter that already has a live partner integration, risking silent breaks to existing POST delivery logs and the HMAC signing codepath.
- A new `partnerPostback` adapter registered in `destinations/index.ts:14` alongside `conversionWebhookAdapter` is isolated, testable, and follows the established `IDestinationAdapter` contract (`destinations/base.ts:27`).

**Adapter behavior (`destinations/partner-postback.ts`):**
- `send(payload, ctx)` reads `ctx.settings.destinations.partnerPostback.postbackUrlTemplate`.
- Returns `{ status: "skipped" }` if template is empty or `payload.partnerClickId` is absent.
- Substitutes macros `{clickid}`, `{event}`, `{amount}`, `{currency}`, `{userid}`, `{orderid}` with values from payload.
- Issues an outbound HTTP GET. No body. 15-second timeout.
- Returns `{ status: "sent", responseMeta: { httpStatus } }` on 2xx, `{ status: "failed" }` otherwise.

### 4. Where the Partner's Postback URL Template Lives

**Decision: Add `partnerPostback` as a new destination sub-document in `TrackingSettings`.**

Rationale:
- `TrackingSettings` (`tracking.model.ts:109`) is the per-brand (per-DB) config store for all destinations. Adding a `partnerPostback` destination sub-doc is the minimum-schema-change path.
- The admin configures and enables/disables it via the existing `PUT /api/tracking/settings` endpoint — no new admin routes.
- Per-brand: the Trading Cult DB gets the Trading Cult partner URL; other brands leave it empty and the adapter skips.
- Avoids env vars (not per-brand) and a separate config collection (over-engineered for minimal scope).

**Minimum config shape added to `tracking.interface.ts:116` area:**
```typescript
interface IPartnerPostbackConfig extends IDestinationToggle {
  postbackUrlTemplate: string; // e.g. "https://partner.net/postback?clickid={clickid}&event={event}&amount={amount}"
}
```

Event toggles via `IDestinationToggle.events` map — default `signup_completed: true`, `purchase_completed: true`, all others false.

---

## New vs. Modified Components

### New Components

| File | What | Why New |
|------|------|---------|
| `pft-backend/src/app/modules/Tracking/destinations/partner-postback.ts` | GET postback adapter with macro substitution | Different transport contract from existing POST adapter |
| `pft-backend/src/app/modules/Payment/utils/trackingPurchaseEmit.ts` | Utility to fire TrackingEvents.purchaseCompleted with partnerClickId lookup | Mirrors salesWebhookEmit pattern; keeps emit sites DRY |

### Modified Components

| File | Location | Change |
|------|----------|--------|
| `auth.interface.ts` | TRegisterUser at line 320 | Add `partnerClickId?: string` |
| `auth.model.ts` | UserSchema around line 479 | Add `partnerClickId: { type: String, index: true }` |
| `auth.service.ts` | verifyRegistrationOtp: findByIdAndUpdate at line 830 | Pass `partnerClickId` into the user update |
| `auth.service.ts` | Post-registration block after line 1020 | Add `TrackingEvents.signupCompleted({ userId, email, partnerClickId })` |
| `tracking.interface.ts` | DESTINATIONS const at line 51 | Add `"partnerPostback"` |
| `tracking.interface.ts` | destinations map at line 142 | Add `partnerPostback: IPartnerPostbackConfig` |
| `tracking.interface.ts` | ITrackingEventPayload at line 168 | Add `partnerClickId?: string` |
| `tracking.constants.ts` | DEFAULT_EVENT_TOGGLES at line 23 | Add `partnerPostback` column with `signup_completed: true`, `purchase_completed: true`, all others false |
| `tracking.model.ts` | Around line 74 (destination sub-schemas) | Add `PartnerPostbackConfigSchema` and wire into `destinations` sub-doc |
| `destinations/index.ts` | registerAllAdapters at line 14 | Add `registerAdapter(partnerPostbackAdapter)` |
| `enrichment/click-ids.ts` | enrichClickIds at line 10 | Read `_partner_clickid` cookie fallback; pass through `payload.partnerClickId` |
| `payment.service.modular.ts` | Around line 1499 | Add call to `emitTrackingPurchaseCompleted(payment)` |
| `payment/services/callback.service.ts` | Payment completion site around line 395 | Add call to `emitTrackingPurchaseCompleted(payment)` |
| `payment/services/stripe-webhook.service.ts` | PAP payment completion around line 507 | Add call to `emitTrackingPurchaseCompleted(payment)` if applicable |

---

## Data Flow

### Click to Registration to Postback

```
Partner ad click -> frontend landing page (?clickid=ABC123)
  |
  Set cookie: _partner_clickid=ABC123 (30-day, first-party)
  |
  User fills signup form
  POST /api/auth/register
  body: { ...fields, partnerClickId: "ABC123" }  <- read from cookie by frontend JS
  |
  AuthService.initiateRegistration() stores partnerClickId on temp (unregistered) user doc
  (OTP email sent)
  |
  POST /api/auth/register/verify-otp
  AuthService.verifyRegistrationOtp() [auth.service.ts:820]
    -> User.findByIdAndUpdate(..., { partnerClickId: "ABC123", isRegistered: true, ... })
                                                               [line ~830]
  |
  TrackingEvents.signupCompleted({ userId, email, partnerClickId: "ABC123" })
  [auth.service.ts ~1020 -- NEW CALL SITE]
  |
  dispatch(payload) -> partnerPostback adapter
    payload.partnerClickId = "ABC123"
    resolves template: https://partner.net/postback?clickid=ABC123&event=signup_completed
    HTTP GET (fire-and-forget)
    -> 200 OK -> status: "sent"
```

### Purchase to Postback

```
Payment gateway callback / Stripe webhook
  -> callback.service.ts: payment.status = "completed" (~line 395)
  |
  emitTrackingPurchaseCompleted(payment)  [NEW utility]
    -> User.findById(payment.userId).select("partnerClickId")
    -> TrackingEvents.purchaseCompleted({ userId, value, currency, partnerClickId })
  |
  dispatch(payload) -> partnerPostback adapter
    resolves template: https://partner.net/postback?clickid=ABC123&event=purchase_completed&amount=99
    HTTP GET
```

---

## Dependency-Ordered Build Sequence

**Phase A: Click ID capture and persistence** (must be first — nothing can fire without the stored ID)
1. Add `partnerClickId` to `TRegisterUser` interface and `UserSchema`.
2. Write `partnerClickId` in `verifyRegistrationOtp` at the findByIdAndUpdate call.
3. Pass `partnerClickId` through `initiateRegistration` (the two-step OTP path stores it on the pre-verified user doc so it's available at OTP completion).
4. Frontend: set `_partner_clickid` cookie on landing; forward in signup body (parallel frontend work).
5. Verification: manual test registration with `partnerClickId` in body; confirm field on user doc.

**Phase B: Wire the emit points** (depends on Phase A — the stored value must exist before emitting)
6. Add `partnerClickId?: string` to `ITrackingEventPayload`.
7. Extend `enrichClickIds` with cookie fallback.
8. Add `TrackingEvents.signupCompleted()` call in `auth.service.ts:1020` block.
9. Implement `trackingPurchaseEmit.ts` utility (DB lookup + TrackingEvents.purchaseCompleted call).
10. Add utility call to `payment.service.modular.ts:1499` (free path) and `callback.service.ts` / `stripe-webhook.service.ts` (paid paths).

**Phase C: New adapter and config** (depends on Phase B for integration tests that exercise end-to-end flow)
11. Add `"partnerPostback"` to DESTINATIONS, interface shape, constants table, and model schema.
12. Implement `partner-postback.ts` adapter (GET, macro substitution, skip if no clickid or no template).
13. Register adapter in `destinations/index.ts`.
14. Configure `postbackUrlTemplate` in TrackingSettings for Trading Cult's brand DB.

**Phase D: End-to-end verification**
15. Test signup with `?clickid=TEST123` -> confirm User doc field, confirm GET fires with clickid in URL.
16. Test paid purchase -> confirm GET fires with amount macro resolved.
17. Confirm existing `conversionWebhook` POST deliveries are unaffected.
18. Confirm `conversionWebhook` still returns "skipped" for signup/purchase events (not "failed").

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reading the Click ID Only from the Request Cookie at Fire Time

**What people do:** Skip persisting to User doc; instead read `_partner_clickid` cookie off the request at dispatch time via `enrichClickIds`.

**Why it's wrong:** `purchase_completed` fires from gateway webhook callbacks (`callback.service.ts`) and potentially cron-adjacent provisioning paths that have no request object. `req` is `null` at those sites. `enrichClickIds` at `click-ids.ts:14` explicitly guards `(req?.cookies as ...) || {}` — produces nothing without a request. The clickid is silently lost and no postback fires.

**Do this instead:** Persist to User doc at registration. Fetch from DB at purchase emit time.

### Anti-Pattern 2: Adding a GET Mode to the Existing conversionWebhook Adapter

**What people do:** Add a `method: "GET"` branch and `postbackUrlTemplate` field to `conversion-webhook.ts`.

**Why it's wrong:** The adapter already has a live POST integration with HMAC signing. Adding a GET branch creates a mode-switch, complicates the `deliverPayload` / `signBody` codepath, and conflates two different downstream contracts. A delivery log failure for one partner could shadow the other.

**Do this instead:** New `partnerPostback` adapter as a separate destination.

### Anti-Pattern 3: Wiring purchase_completed Only from the Free-Payment Path

**What people do:** Add the TrackingEvents call only at `payment.service.modular.ts:1499`.

**Why it's wrong:** That block is the free (zero-amount, 100%-coupon) path only. Real paid completions flow through `callback.service.ts` (all payment gateways) and `stripe-webhook.service.ts` (Stripe PAP). Those paths do not call `payment.service.modular.ts:1499`.

**Do this instead:** A shared utility called from all three completion sites.

### Anti-Pattern 4: Using `conversionWebhookAdapter` EVENT_NAME_MAP for signup/purchase

**What people do:** Add `signup_completed: "SignupCompleted"` and `purchase_completed: "PurchaseCompleted"` to the existing `EVENT_NAME_MAP` in `conversion-webhook.ts:19-25`.

**Why it's wrong:** That adapter sends POST JSON to the existing ConversionWebhook partner URL (which already has a live contract). Injecting new events into that POST stream changes the partner's event set without their agreement and bypasses the GET/macro transport the new partner requires.

**Do this instead:** The new `partnerPostback` adapter handles these events independently.

---

## Sources

- `pft-backend/src/app/modules/Tracking/tracking.service.ts` (dispatch framework — direct read)
- `pft-backend/src/app/modules/Tracking/destinations/index.ts` (adapter registry — direct read)
- `pft-backend/src/app/modules/Tracking/destinations/base.ts` (adapter contract — direct read)
- `pft-backend/src/app/modules/Tracking/destinations/conversion-webhook.ts` (POST adapter, EVENT_NAME_MAP — direct read)
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.service.ts` (direct read)
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.interface.ts` (direct read)
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.model.ts` (direct read)
- `pft-backend/src/app/modules/Tracking/tracking.constants.ts` (event toggles — direct read)
- `pft-backend/src/app/modules/Tracking/enrichment/click-ids.ts` (direct read)
- `pft-backend/src/app/modules/Tracking/tracking.interface.ts` (payload + config shapes — direct read)
- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` (call sites confirmed absent — direct read)
- `pft-backend/src/app/modules/Auth/auth.service.ts` (registration flow — direct read)
- `pft-backend/src/app/modules/Auth/auth.model.ts` (UserSchema — direct read)
- `pft-backend/src/app/modules/Auth/auth.interface.ts` (TRegisterUser — direct read)
- `pft-backend/src/app/modules/Payment/payment.service.modular.ts` (free payment emit — direct read)
- `pft-backend/src/app/modules/Payment/payment.model.ts` (post-save hook — direct read)
- `pft-backend/src/app/modules/Payment/services/callback.service.ts` (paid completion — direct read)
- `pft-backend/src/app/modules/Payment/utils/salesWebhookEmit.ts` (pattern reference — direct read)
- `pft-backend/src/app/modules/SalesWebhook/salesWebhook.dispatch.ts` (confirmed separate system — direct read)
- `pft-backend/src/app/modules/Affiliate/clickEvent.model.ts` (confirmed not applicable — direct read)

---
*Architecture research for: CRM Partner S2S Postback (v1.3)*
*Researched: 2026-07-01*
