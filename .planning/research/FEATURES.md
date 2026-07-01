# Feature Research

**Domain:** CRM Partner S2S Postback Tracking (v1.3 — Trading Cult one-off)
**Researched:** 2026-07-01
**Confidence:** HIGH (grounded in file-level code reading; no web research needed for existing-system claims)

---

## How S2S Postbacks Work (Context for Requirements Author)

A CPA/affiliate network partner sends traffic to your site with a click ID in the URL. You store that click ID server-side, tied to a visitor session and ultimately to a user account. When a conversion event occurs (registration, purchase), your backend fires a GET or POST to the partner's postback URL with the original click ID and any payout data. The partner reconciles their click log and attributes the conversion. The invariant the partner enforces is that **the click ID sent in the postback must exactly match what was in the original tracking link** — any transformation or substitution breaks attribution on their side.

The Trading Cult partner contract:
- **Tracking link:** `https://your-domain.com/track?clickid={clickid}`
- **Store:** the raw `clickid` value, server-side
- **Fire on registration:** `https://partner-domain.com/postback?clickid={stored}&goal=registration`
- **Fire on conversion/sale:** `https://partner-domain.com/postback?clickid={stored}&goal=conversion&payout={amount}`

---

## Feature Landscape

### Table Stakes (Partner Contract Requires These)

All items tagged with EXISTS / MODIFY / NEW and grounded in a specific file.

| Feature | Why Required | Status | Complexity | Code Evidence |
|---------|-------------|--------|------------|---------------|
| **Tracking link endpoint** `GET /track?clickid=X` | Partner sends traffic here; must capture `clickid` before redirecting to site | NEW | LOW | No such route exists. New Express route: read `?clickid`, set a `partner_clickid` cookie (SameSite=Lax, Secure, max-age = attribution window), redirect to home/registration. No auth. |
| **Click ID cookie persistence** | Browser must carry the click ID from landing page through to the registration form post | NEW | LOW | `enrichClickIds` (`enrichment/click-ids.ts:10`) already reads ad-platform click IDs from cookies/query. A `partner_clickid` cookie is not in that list — it is a separate thing served from the tracking link. |
| **`partnerClickId` field on User document** | Click ID must survive from registration to purchase, which may happen days later; cannot rely on cookie | NEW | LOW | `ITrackingEventPayload` has ad-platform IDs (`fbc`, `gclid`, etc.) but no generic `partnerClickId` (`tracking.interface.ts:194-200`). The User model has no attribution storage at all (confirmed: no `attribution` field in User module). Must add `partnerClickId?: string` to User schema. |
| **Click ID capture at registration** | At signup, read `partner_clickid` cookie from request and store in User document | NEW | LOW | `TrackingEvents.signupCompleted` helper exists (`tracking.events.service.ts:38`) and fires with `req?: Request`. The `req` carries cookies. Capture must happen at the registration callsite — but see critical gap below: `signupCompleted` has zero callers. |
| **Registration postback** | Fire to partner URL when registration completes for a user with a stored `partnerClickId` | NEW + MODIFY | MEDIUM | `signup_completed` is default-on for `conversionWebhook` (`tracking.constants.ts:29`). **Critical gap:** `conversionWebhookAdapter` `EVENT_NAME_MAP` (`destinations/conversion-webhook.ts:19-25`) only maps `phase_passed`, `account_breached`, `payout_completed`, `kyc_verified`, `account_funded` — `signup_completed` returns `status: "skipped"` today (`conversion-webhook.ts:50-52`). Also: the existing adapter sends a POST JSON body, not a GET with query params (incompatible wire protocol — see Anti-Features). |
| **Conversion postback with payout value** | Fire to partner URL when a qualifying purchase completes for a user with a `partnerClickId` | NEW | MEDIUM | `purchase_completed` is also absent from `EVENT_NAME_MAP` (`destinations/conversion-webhook.ts:19-25`). The `SalesWebhookDispatcher.purchaseCompleted` path (`salesWebhook.dispatch.ts:72`) fires on payment completion (`payment.service.modular.ts:1499`) but goes to SalesWebhook, not the partner URL. Neither existing path fires a partner postback. |
| **Unchanged click ID guarantee** | Partner's attribution breaks if the click ID is transformed in any way | NEW — IMPLICIT | LOW | Store the raw URL-decoded value from `?clickid=`. No hash, no normalization, no truncation. Pass verbatim in postback query string. |
| **Idempotency — one fire per event per user** | Re-delivery or race conditions must not double-fire the postback | NEW | LOW | Registration: dedup via `TrackingEventLog` exists (`dedup/dedup.service.ts:14`) keyed on `eventId`. Conversion: `SalesWebhookDispatcher.purchaseCompleted` already dedupes on `paymentId` (`salesWebhook.dispatch.ts:91`). The partner postback adapter must plug into one of these dedup paths (or add its own delivery log). |

---

### Open Decisions That Requirements Must Pin Before Implementation Starts

These are not optional — the wrong default causes partner disputes or bad data.

#### Decision 1: Conversion = First Purchase Only (FTD) or Every Purchase?

**Recommendation: First purchase only (FTD model).** Standard in CPA/affiliate networks. Prop-firm traders repurchase repeatedly after breaches; firing on every purchase would inflate the partner's commission count and may get the integration flagged as fraudulent.

**Implementation impact:** Requires a check at conversion postback time: "is this the user's first completed payment?" This is a DB query (`Payment.countDocuments({ userId, status: 'completed' }) === 1`) at the point the postback fires. No existing flag captures this today.

#### Decision 2: Payout Value = Which Amount Field?

**Recommendation: `usdAmount`** — the normalised USD figure already on the Payment document (`payment.interface.ts:102`). This is what the existing UTM analytics and sales ticker use for cross-currency reporting. Amount resolution in `salesWebhookEmit.ts:38` is: `paidAmount ?? totalPrice ?? amount` for the charged amount and `usdAmount` separately.

The Payment model carries:
- `paidAmount` — actual collected amount in billed currency
- `totalPrice` — listed price before discounts in billed currency
- `usdAmount` — normalised USD (use this for the postback `payout` param)
- `amount` — raw provider field (unreliable, avoid)

If the partner's tracking system is currency-native (e.g. they bill in JPY), send `paidAmount` and also include a `currency` param. **Must be confirmed with the partner contract.**

#### Decision 3: Attribution Window (Cookie TTL)

**Recommendation: 30 days** (`max-age=2592000`). Standard industry default for prop-firm funnels where visitors deliberate before registering. The User-level `partnerClickId` has no expiry — stored at registration, persists until explicitly nulled or a retention policy clears it.

#### Decision 4: Behaviour When a User Registers Without a Click ID

**Recommendation: Silent skip.** No `partner_clickid` cookie present at registration → do not store anything → do not fire registration postback or conversion postback for that user.

---

### Differentiators (Nice-to-Have, Not in Scope for v1.3)

| Feature | Value Proposition | Status | Complexity | Notes |
|---------|-------------------|--------|------------|-------|
| Goal-name mapping config | Different partners use different `goal=` param names | DEFER | LOW | Hardcode `goal=registration` and `goal=conversion` for now. Config table is a one-line change when a second partner needs different names. |
| Payout source configurability | Some partners want sale price, others a fixed commission, others a percentage | DEFER | LOW | Hardcode `usdAmount` for v1.3. Add a config knob when a second partner has different requirements. |
| Per-brand partner config via admin UI | Multiple brands can each have their own partner URL | DEFER | MEDIUM | v1.3 is Trading Cult only. Use env var or brand-settings constant. The per-DB model handles brand isolation automatically. |
| Attribution-window configurability | Cookie TTL and user-record expiry are configurable | DEFER | LOW | Hardcode 30-day cookie for v1.3. |
| Delivery retry with backoff | If partner postback URL returns 5xx, retry up to N times | DEFER | MEDIUM | Log failures; let ops retry manually for single partner. The `ConversionWebhookDeliveryLog` pattern (`Admin/ConversionWebhook/conversion-webhook.service.ts:173`) can be reused when retry is needed. |

---

### Anti-Features (Explicitly Do Not Build)

| Feature | Why It Seems Attractive | Why Wrong for v1.3 | What to Do Instead |
|---------|------------------------|---------------------|-------------------|
| Generic multi-partner admin UI | "We'll need more partners" | Premature generalisation; adds a DB collection, admin CRUD, validation, and dashboard UI for one config row. Partners come one at a time. | Hardcode the one partner's URL in env/brand settings. Extract to admin UI only when a second partner is onboarded. |
| Reuse the existing `conversionWebhook` destination adapter | It already exists and fires for some events | Two problems: (1) the `EVENT_NAME_MAP` (`destinations/conversion-webhook.ts:19-25`) does not include `signup_completed` or `purchase_completed`; and (2) the delivery path sends a POST with a JSON body and HMAC signature headers (`conversion-webhook.service.ts:128-152`) — the partner expects a GET request with query params (`?clickid=X&goal=Y&payout=Z`). Forcing this would require hacking the adapter's wire protocol and polluting the shared webhook settings with partner-specific config. | Write a thin, separate `partnerPostbackService` that fires a GET to the partner URL with the correct query params. Keep it isolated from the general-purpose webhook infrastructure. |
| Cookie-only click ID propagation (no DB storage) | Simpler — fewer schema changes | Cookies expire (30 days), get cleared by the user, or may not reach the server at purchase callback time (which can come from a payment provider's async webhook, not a browser request). | Store `partnerClickId` on the User document at registration. Read from User (not cookie) at purchase time. |
| Fire conversion postback on every purchase | Maximises event count | CPA networks attribute one conversion per user (FTD model). Double-firing for repurchases inflates commissions and can get the integration flagged as fraudulent by the partner. | Gate conversion postback on first purchase only (FTD check). |
| Hash or encode the click ID before storage | "Security / data hygiene" | The partner's tracking system requires the exact raw click ID to reconcile attribution on their side. Any transformation breaks their lookup. | Store and transmit the raw URL-decoded value verbatim. |
| Pull API for partner | Avoids postback plumbing | Explicitly deferred per milestone context. More complex; requires partner to poll us; postbacks are the industry-standard pattern for CPA networks. | Postbacks first; pull API in a later milestone if partner requests it. |

---

## Key Implementation Gaps (Grounded in Code)

These are not features — they are code facts that constrain implementation and must inform the roadmap estimate.

**Gap 1: `signupCompleted` helper has zero callers.**
`TrackingEvents.signupCompleted` is defined at `tracking.events.service.ts:38` but a global search finds no callers anywhere in `pft-backend/src`. The `signup_completed` event never actually fires today. The postback milestone must also wire the registration callsite.

**Gap 2: `conversionWebhookAdapter` silently skips `signup_completed` and `purchase_completed`.**
The `EVENT_NAME_MAP` (`destinations/conversion-webhook.ts:19-25`) maps only five events: `phase_passed`, `account_breached`, `payout_completed`, `kyc_verified`, `account_funded`. Both events needed for the partner postback fall through to `status: "skipped"` at line 50-52. The existing adapter cannot be used as-is.

**Gap 3: The existing `conversionWebhook` adapter sends POST JSON, not GET query params.**
The partner postback protocol is `GET https://partner-domain.com/postback?clickid=X&goal=Y&payout=Z`. The `deliverPayload` method (`conversion-webhook.service.ts:128-152`) sends `POST` with `Content-Type: application/json`, `X-Webhook-Signature`, and a JSON body. These are incompatible wire protocols requiring a separate delivery function.

**Gap 4: `purchase_completed` in the SalesWebhook path does not hook a partner postback.**
`emitPurchaseCompletedWebhook` (`payment.service.modular.ts:1499` calling `salesWebhookEmit.ts:40`) routes through `SalesWebhookService` to all configured SalesWebhook records. It carries `amount`, `usdAmount`, `currency` and is deduped on `paymentId`. This is the right trigger point to hook — but it needs a new branch that reads the `userId`, looks up the user's `partnerClickId`, and fires the partner GET postback separately.

**Gap 5: No `partnerClickId` field on the User model.**
`PaymentAttribution` (`payment.interface.ts:4-19`) covers ad-platform click IDs but not a generic partner click ID. The User model has no attribution storage. A new `partnerClickId?: string` field is required.

---

## Feature Dependencies

```
[Tracking link endpoint GET /track?clickid=X]
    └──produces──> [partner_clickid cookie in browser]
                        └──read at registration──> [partnerClickId stored on User doc]
                                                        ├──fires──> [Registration postback (GET)]
                                                        └──read at purchase──> [Conversion postback (GET)]
                                                                                    └──guarded by──> [FTD check]
                                                                                    └──includes──> [payout=usdAmount]

[Idempotency]
    └──gates both──> [Registration postback] AND [Conversion postback]

[signupCompleted caller wiring]
    └──prerequisite for──> [Registration postback]
```

### Dependency Notes

- **Tracking link endpoint is the entry point** — nothing downstream works without it. No upstream dependencies.
- **User model change is a prerequisite for everything** — `partnerClickId` must exist on the User document before registration capture, registration postback, or conversion postback can work.
- **`signupCompleted` must be wired at the registration callsite** — the helper exists but is never called. Registration postback cannot piggyback on a non-firing event.
- **FTD check must be decided before conversion postback is implemented** — it affects whether the check happens at the `emitPurchaseCompletedWebhook` callsite or in the partner postback service itself.
- **Payout amount field must be decided before conversion postback is implemented** — it affects which Payment field is read when constructing the postback URL.

---

## MVP Definition

### Launch With (v1.3)

- [ ] `GET /track` endpoint — reads `?clickid`, sets `partner_clickid` cookie (30-day, Secure, SameSite=Lax), redirects to homepage
- [ ] `partnerClickId?: string` field added to User model / schema
- [ ] Click ID capture at registration — read `partner_clickid` cookie from request, write to User document at signup
- [ ] Wire `TrackingEvents.signupCompleted` caller at registration callsite (prerequisite — currently has zero callers)
- [ ] Registration postback service — when `signup_completed` fires for a user with a `partnerClickId`, fire `GET {partnerUrl}?clickid={id}&goal=registration`
- [ ] Conversion postback service (FTD-gated) — on first `purchase_completed` for a user with a `partnerClickId`, fire `GET {partnerUrl}?clickid={id}&goal=conversion&payout={usdAmount}`
- [ ] Idempotency — registration deduped on `eventId`; conversion deduped on `paymentId`
- [ ] Delivery log — new `PartnerPostbackLog` collection (or reuse `ConversionWebhookDeliveryLog` pattern) with: `userId`, `clickId`, `goal`, `payoutAmount`, `status`, `httpStatus`, `error`, `firedAt`
- [ ] Partner URL config — env var `PARTNER_POSTBACK_URL` (or brand settings constant); not a DB admin UI

### Hardcoded for v1.3 (Not Configurable)

- Partner URL: env var / brand constant
- Goal names: `goal=registration`, `goal=conversion`
- Payout field: `usdAmount`
- Attribution window: 30-day cookie
- Scope: Trading Cult brand DB only
- Conversion definition: FTD only (first completed payment per user)

### Add After Second Partner is Onboarded (v1.x)

- [ ] Config table for goal-name mapping per partner
- [ ] Payout source configurability
- [ ] Admin UI for partner URL config

### Future (v2+)

- [ ] Generic multi-partner admin UI
- [ ] Pull API for partner reporting
- [ ] Retry with exponential backoff

---

## Feature Prioritization Matrix

| Feature | Partner Value | Implementation Cost | Priority |
|---------|--------------|---------------------|----------|
| Tracking link endpoint | HIGH | LOW | P1 |
| `partnerClickId` on User model | HIGH | LOW | P1 |
| Wire `signupCompleted` callsite | HIGH | LOW | P1 — unblocks registration postback |
| Registration postback (GET) | HIGH | MEDIUM | P1 |
| Conversion postback with FTD check | HIGH | MEDIUM | P1 |
| Idempotency / dedup | HIGH | LOW | P1 |
| Delivery log | MEDIUM | LOW | P1 |
| Admin config UI for partner URL | LOW | MEDIUM | P3 — hardcode for v1.3 |
| Retry / backoff | LOW | MEDIUM | P3 — defer |

---

## Sources

All EXISTS claims grounded in code reads at:

- `pft-backend/src/app/modules/Tracking/tracking.constants.ts:29, 40` — default-on toggles for `signup_completed` and `purchase_completed` on `conversionWebhook` destination
- `pft-backend/src/app/modules/Tracking/destinations/conversion-webhook.ts:19-25` — `EVENT_NAME_MAP` (the critical gap — neither `signup_completed` nor `purchase_completed` is present)
- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts:38` — `signupCompleted` helper definition (confirmed zero callers in codebase)
- `pft-backend/src/app/modules/Tracking/tracking.interface.ts:168-250` — `ITrackingEventPayload` full field list; ad-platform click IDs at lines 194-200; no `partnerClickId`
- `pft-backend/src/app/modules/Tracking/dedup/dedup.service.ts:14` — dedup via `eventId` + unique index on `TrackingEventLog`
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.service.ts:128-152` — POST JSON delivery protocol (incompatible with partner GET/query-param protocol)
- `pft-backend/src/app/modules/Payment/payment.interface.ts:4-19, 100-196` — `PaymentAttribution` (no `partnerClickId`), `IPayment` fields including `paidAmount`, `totalPrice`, `usdAmount`, `amount`
- `pft-backend/src/app/modules/Payment/utils/salesWebhookEmit.ts:38` — amount resolution order: `paidAmount ?? totalPrice ?? amount`; `usdAmount` also available
- `pft-backend/src/app/modules/SalesWebhook/salesWebhook.dispatch.ts:72-93` — `purchaseCompleted` dispatch with `dedupeKey: paymentId`; carries `amount`, `usdAmount`, `currency`
- `pft-backend/src/app/modules/Payment/payment.service.modular.ts:1499` — `emitPurchaseCompletedWebhook` callsite (the correct trigger hook for conversion postback)

---

*Feature research for: v1.3 CRM Partner Tracking — S2S Postbacks (Trading Cult one-off)*
*Researched: 2026-07-01*
