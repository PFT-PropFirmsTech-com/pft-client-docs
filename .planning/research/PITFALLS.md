# Pitfalls Research

**Domain:** Partner S2S postback / clickid passthrough in a prop-firm funnel
**Researched:** 2026-07-01
**Confidence:** HIGH — all pitfalls grounded in direct codebase inspection of `pft-backend/src/app/modules/Tracking/` and `Admin/ConversionWebhook/`, corroborated by known project history (JPY/USD bug, PAP funnel bypasses, multi-brand per-DB separation).

---

## Critical Pitfalls

### Pitfall 1: clickid Not Persisted Beyond the Request Boundary

**What goes wrong:**
The partner's clickid (e.g. `sub1=<clickid>` appended to the landing URL) is read from the incoming request by `enrichClickIds()` at dispatch time. That enrichment reads from `req.cookies` and `req.query` only. For `signup_completed` this works because the signup request is still in scope. But `purchase_completed` is emitted from payment gateway callbacks — NOWPayments, Stripe webhooks, PayPal webhooks — which carry no browser cookies and no original query string. The clickid is gone. The S2S postback for the conversion fires with no clickid, the partner network cannot attribute it, and the commission is lost.

The current `PaymentAttribution` subdoc on the Payment model (`fbc`, `fbclid`, `gclid`, `ttclid`, `msclkid`, `li_fat_id`) stores ad-platform IDs captured at checkout creation time, but there is no `partnerClickId` field and the conversion webhook adapter (`destinations/conversion-webhook.ts`) does not read from `payment.attribution` at all — it only has access to the tracking payload, which in a gateway callback context has no `req`.

**Why it happens:**
The existing enrichment design is correct for ad-platform pixels (Meta CAPI, Google Ads) because those networks use their own first-party cookies (`_fbc`, `_gclid`). Partner S2S tracking uses a custom parameter that has no cookie-based fallback — it only exists in the landing URL the partner appended it to. Developers treat it like a gclid and assume enrichment handles it; it does not.

**How to avoid:**
Store `partnerClickId` on two durable documents at first-touch:
1. On the User document at registration — so signup postback can read it.
2. On the Payment document at checkout creation — so purchase postback can read it even from a gateway callback where `req` is unavailable.

The conversion webhook adapter must be updated to load `partnerClickId` from the Payment or User document when the payload does not carry it. Do not rely solely on the `enrichClickIds()` middleware path for partner clickids.

**Warning signs:**
- Partner dashboard shows registrations with no corresponding conversions.
- `ConversionWebhookDeliveryLog` shows `purchase_completed` events dispatched but partner reports 0% attribution.
- `payload.gclid` is populated (cookie survived) but the S2S clickid field is empty.

**Phase to address:** Phase 1 (data model) — add `partnerClickId` to User and Payment schemas before writing any postback dispatch logic.

---

### Pitfall 2: Dual Dispatch Path — ConversionWebhookEventsService and TrackingEvents Both Active

**What goes wrong:**
The codebase has two independent dispatch paths that both reach the same `conversionWebhook` destination:

1. **Legacy path** (`Admin/ConversionWebhook/conversion-webhook-events.service.ts`): `ConversionWebhookEventsService.onChallengePassed()`, `onKYCCompleted()`, etc. These call `ConversionWebhookService.dispatch()` directly. `buildPayload()` generates a fresh `crypto.randomUUID()` on every call (line 101 of `conversion-webhook.service.ts`), so two invocations produce two distinct eventIds — both are delivered to the partner with no dedup.

2. **Tracking path** (`Tracking/destinations/conversion-webhook.ts`): routes through `dispatch()` → `reserveLogRow()` → compound unique-index dedup on `TrackingEventLog`. This path IS idempotent.

If both paths remain active for the same lifecycle event, the partner receives a double postback on every occurrence. A Stripe webhook retry or idempotent re-processing of a funding queue entry is enough to trigger this.

**Why it happens:**
The Tracking adapter wraps the old `ConversionWebhookService.deliverPayload()` method, giving the impression the old delivery is guarded. It is not: the old path bypasses the `TrackingEventLog` dedup table entirely.

**How to avoid:**
For each event that will emit an S2S postback, pick one dispatch path and disable the other. The Tracking path (with `TrackingEventLog` dedup) is the correct long-term path. Legacy `ConversionWebhookEventsService` static methods that overlap must be removed or gated once the Tracking path covers those events. Audit with: `grep -rn "ConversionWebhookEventsService\." pft-backend/src` to find all call sites.

**Warning signs:**
- Partner dashboard shows 2x registration or conversion counts compared to internal metrics.
- `ConversionWebhookDeliveryLog` shows two `success` entries per user/event with different `eventId` values within seconds of each other.

**Phase to address:** Phase 1 (dispatch architecture) — establish which path owns each event before adding any new postback calls.

---

### Pitfall 3: PAP and Free-Trial Funnels Bypass the Normal Purchase Path

**What goes wrong:**
Partner S2S tracking typically expects: click → signup postback → purchase postback. In this platform:

- **PAP free signup** (`pap_free_signup`): the trader pays nothing upfront. The signup is tracked but there is no `purchase_completed`. The PAP payment later (`pap_payment_completed`) is a separate event — currently disabled for `conversionWebhook` in `tracking.constants.ts` line 59 (`conversionWebhook: false`). If the partner contract counts "conversion" as a purchase, PAP traders will never be counted.
- **Free trial / free challenge**: `free_trial_signup` and `free_challenge_signup` are enabled for `conversionWebhook` by default (lines 44–46 of `tracking.constants.ts`), so they fire registration postbacks. But they have $0 value. If the partner network interprets the conversion as a sale, $0 events can trigger fraud filters or commission rejection.
- **PAP funded-leg payment**: the funded-leg payment currently provisions the funded account immediately after payment, skipping the KYC/funded-stage approval gate (documented in `project_pap_funded_kyc_bypass.md`). If an `account_funded` postback fires here, it fires before KYC completes — a partner expecting KYC-gated conversions sees incorrect attribution timing.

**Why it happens:**
Postback integration is typically designed around the happy-path direct-purchase funnel and bolted onto alternate paths inconsistently. The multiple account-acquisition paths (direct purchase, PAP, free trial, free challenge) each have subtly different state machines.

**How to avoid:**
Explicitly define which events map to "registration postback" and "conversion postback" in the partner contract, then trace every funnel path:
- Direct purchase: `signup_completed` → `purchase_completed`
- PAP: `signup_completed` (or `pap_free_signup`) → `pap_payment_completed` (must be enabled for `conversionWebhook`)
- Free trial/challenge: `signup_completed` only, or a custom lead event with $0 value; confirm partner accepts $0-value conversions
- Funded path: fire `account_funded` postback only after KYC gate clears, not at payment time

For the PAP case specifically: if the partner pays CPA on funded accounts, the postback event should be `account_funded`, not `pap_payment_completed`, because the KYC/funded-queue gate is what confirms the account is real.

**Warning signs:**
- Partner reports conversion numbers that don't match challenge purchase + PAP payment numbers.
- $0-value conversion events rejected by partner network.
- `pap_payment_completed` events never appearing in partner dashboard even though internal logs show them dispatched.

**Phase to address:** Phase 1 (event mapping spec) — document the exact event-to-postback mapping per funnel type before implementation.

---

### Pitfall 4: Refund/Chargeback Fires Conversion Then Never Cancels It

**What goes wrong:**
`purchase_completed` fires a conversion postback. If the payment is later refunded (PayPal `PAYMENT.CAPTURE.REFUNDED`, Oxapay `refunded` status) or charged back, no cancellation postback is sent to the partner. The partner pays commission on a sale that was returned. At scale this is a material fraud vector — one class of prop-firm fraud is buying a challenge, triggering the commission, then immediately requesting a refund.

Confirmed in codebase: `paypal-webhook.service.ts` handles `PAYMENT.CAPTURE.REFUNDED` and marks the payment as refunded (logs "Payment marked as refunded" at line 579) but dispatches no `TrackingEvents.*` call and no `dispatchConversionWebhook` call in that branch.

**Why it happens:**
Refund events are treated as payment state changes, not as marketing events. The tracking module was designed around forward-only lifecycle events. Nobody adds a "reversal postback" path when building the forward path.

**How to avoid:**
Add a `purchase_reversed` event (or reuse `purchase_failed` with a `reason: "refunded"` property) and emit it from every refund/chargeback handler. The S2S adapter must send a cancellation postback for any event that was previously sent for that `orderId`. Check the partner network's spec for the correct reversal signal — most S2S networks accept a `status=rejected` or `status=reversed` on a second postback to the same clickid/orderId.

If the partner network does not support reversals, document this as a known gap and require manual reconciliation. Do not silently let commissions stand on refunded purchases.

**Warning signs:**
- Partner commission reports show higher revenue than actual net revenue (refunds not subtracted).
- Refund rate in payment provider dashboard does not correspond to any reduction in partner-reported conversions.

**Phase to address:** Phase 2 (reversal postback) — can be deferred past MVP but must be scoped before go-live if the partner contract has a refund clawback clause.

---

### Pitfall 5: Multi-Currency — JPY Amount Sent as Numeric Value Without Currency Guard

**What goes wrong:**
Trading Cult bills Japanese traders in JPY. The platform has a documented history of the PAP funded-leg leaking the raw JPY figure (e.g. ¥356,296) into a USD-denominated field (`project_pap_jpy_charged_as_usd.md`). The same risk applies to S2S postback value fields. If the postback payload uses `payload.value` directly without checking `payload.currency`, the partner network receives "356296" with no currency context — or worse, interprets it as a USD sale of $356,296.

Most partner S2S networks require a `sale_amount` and `currency` pair. If `currency` is omitted or defaults to USD, the number is treated as USD. A ¥10,000 challenge (approximately $65) reported as $10,000 will trigger fraud detection and may result in the account being flagged or commission clawed back en masse.

The `ConversionWebhookEventsService.onPayoutCompleted()` passes `amount` and `currency` explicitly (lines 69–70 of `conversion-webhook-events.service.ts`), which is correct. But `TrackingEvents.purchaseCompleted()` accepts `value?: number` and `currency?: string` as optional fields — a caller that omits `currency` will dispatch the postback without it.

**How to avoid:**
- Make `currency` a required field (not optional) on any postback payload builder that includes `value`/`sale_amount`.
- Add a guard in the S2S adapter: if `value` is set and `currency` is absent, return `status: "skipped"` with a logged error rather than sending a postback with ambiguous currency.
- For JPY specifically: confirm the partner network accepts JPY as a currency code. Some networks only accept USD and will reject or silently redenominate. If USD is required, convert at dispatch time using a live or daily-snapshot rate — not the raw JPY figure.
- When reading from the Payment doc, always use `usdAmount` for USD-denominated partner reporting, or use `currency + paidAmount` as a pair and never split them.

**Warning signs:**
- Unusually large sale values in partner dashboard for JP traders.
- Partner fraud team flags the account for suspicious high-value conversions.
- `currency` field missing from `ConversionWebhookDeliveryLog.payload` entries.

**Phase to address:** Phase 1 (payload schema) — currency must be required in the postback schema before any JP funnel traffic is tracked.

---

### Pitfall 6: ConversionWebhookSettings is a Singleton — No Brand Guard

**What goes wrong:**
`ConversionWebhookService.getSettings()` does `ConversionWebhookSettings.findOne()` with no brand filter. The schema has no `brandId` field. Because the platform uses per-DB separation, this is fine as long as the `conversionWebhook` destination is configured in the correct brand's DB. However, the `TrackingSettings` model (which controls the adapter within the Tracking path) also has no `brandId` — it scopes by `environment` only.

The risk: if Trading Cult's `webhookUrl` is configured in the wrong brand's DB (admin mistake), or if two brands share a staging MongoDB, all those brands' conversion postbacks go to Trading Cult's endpoint. The partner receives conversions from users who never clicked their ad.

**Why it happens:**
The existing webhook infrastructure was built for single-brand use. Per-DB separation is assumed to provide brand separation at the infrastructure level, so no brand guard was added in code.

**How to avoid:**
- Document explicitly: `conversionWebhook.webhookUrl` must only be configured in Trading Cult's DB. Add this as a tooltip in the admin UI.
- Add a `brandSlug` or `PROJECT_ID` assertion in the S2S adapter: before firing, verify `process.env.PROJECT_ID` matches the expected brand identifier. Return `status: "skipped"` with a logged warning if it does not.
- This check is cheap and prevents cross-brand pollution even if someone misconfigures.

**Warning signs:**
- Partner reports conversions from emails that are not Trading Cult users.
- Other brands' admins see unexpected webhook activity in their delivery logs.

**Phase to address:** Phase 1 (brand guard) — add the check before the first deploy.

---

### Pitfall 7: The "Minimal One-Off" Trap — Hardcoding That Blocks Verification and Reuse

**What goes wrong:**
The stated scope is "minimal one-off for the Trading Cult partner." The classic failure mode: the postback URL is hardcoded in application code (not in `ConversionWebhookSettings`), the event mapping is hardcoded to Trading Cult's specific parameter names, and there is no admin UI toggle to disable or test it. This means:
- There is no way to verify a deploy worked without live partner traffic.
- When a second partner is onboarded, the one-off code creates a second one-off alongside the first, and they diverge.
- When Trading Cult changes their postback URL or adds a parameter, it requires a code deploy.

The existing `ConversionWebhookSettings` model with `webhookUrl`, `webhookSecret`, and per-event toggles is the correct abstraction. The S2S clickid postback should extend this model (add `clickidParam` name, `postbackUrlTemplate`) rather than adding a parallel hardcoded system.

**How to avoid:**
- Store the partner postback URL template in `ConversionWebhookSettings` (or a new `PartnerPostbackSettings` collection that follows the same pattern).
- The template should support macro substitution: `{clickid}`, `{sale_amount}`, `{currency}`, `{status}` — so URL changes don't require a code deploy.
- Keep the per-event toggle system: disable postback for specific events via admin UI without touching code.
- Use the existing `ConversionWebhookService.testWebhook()` as the model for a test-postback button that fires without real user data.

**Warning signs:**
- Partner postback URL appears as a string literal in source code.
- No way to send a test postback from the admin panel.
- A partner URL change requires a git commit.

**Phase to address:** Phase 1 (configuration schema) — make the URL a DB-stored template before writing any dispatch logic.

---

### Pitfall 8: No Retry on Partner 5xx — Failed Postback Is Silently Lost

**What goes wrong:**
`ConversionWebhookService.deliverPayload()` makes one HTTP POST with a 15-second timeout (line 152 of `conversion-webhook.service.ts`). If the partner's endpoint returns a 5xx or times out, the result is marked `failed` in `ConversionWebhookDeliveryLog` and nothing else happens. The `TrackingEventLog` also marks it `failed`, which per the dedup service comment ("failed → allow re-attempt") means a retry is permitted — but there is no retry scheduler. The failed event sits in the log forever and the partner never receives the postback.

For a partner paying CPA commissions, a missed postback means a missed payment.

**Why it happens:**
Fire-and-forget dispatch (correct: never block the user request path) is being conflated with fire-and-never-retry. The dedup system already supports retry semantics — `failed` status intentionally allows re-dispatch — but no retry worker was wired up.

**How to avoid:**
Add a cron job that queries `TrackingEventLog` for rows in `status: "failed"` with `destination: "conversionWebhook"` older than 2 minutes and younger than 24 hours, then re-dispatches. Cap at 3–5 attempts. Use exponential backoff (2m, 10m, 60m). The compound unique index on `(eventId, destination)` prevents duplicate inserts; the `failed` path in `isDuplicate()` correctly allows re-dispatch.

**Warning signs:**
- `ConversionWebhookDeliveryLog` shows `failed` entries that never become `success`.
- Partner dashboard shows gaps in attribution during periods where their endpoint was briefly down.

**Phase to address:** Phase 2 (retry worker) — add after initial dispatch is verified working.

---

### Pitfall 9: GET vs POST, URL-Encoding, and Macro Substitution Errors

**What goes wrong:**
Most partner S2S postback specs use GET with URL parameters (`https://partner.example.com/postback?clickid={clickid}&status=1&amount={amount}`). The existing `ConversionWebhookService.deliverPayload()` sends POST with a JSON body. If the partner expects GET, the postback will be silently ignored — many S2S platforms return 200 on GET even when they receive a POST with the wrong format, making this failure invisible.

URL macro substitution errors are also common: if `{clickid}` contains `+`, `/`, `=`, or other URL-special characters (base64-encoded click IDs are common), they must be `encodeURIComponent()`-ed before substitution. Failure to encode produces a malformed URL or a clickid that is corrupted in transit.

**Why it happens:**
Developers write `url.replace('{clickid}', clickid)` without encoding. The partner's spec may say "GET" on page 3 of a PDF that nobody read past page 1.

**How to avoid:**
- Read the partner's S2S spec carefully and confirm GET vs POST before writing any code.
- If GET: build the URL with `new URL(template)` and `searchParams.set()` — this handles encoding automatically. Do not use string concatenation.
- If POST: confirm the partner accepts JSON (most modern networks do; some expect `application/x-www-form-urlencoded`).
- Test with a real clickid that contains URL-special characters.

**Warning signs:**
- Partner's test endpoint returns 200 but no conversion appears in their dashboard.
- Clickid in partner dashboard is truncated or garbled for certain users.

**Phase to address:** Phase 1 (HTTP client implementation) — validate encoding before any live traffic.

---

### Pitfall 10: Cross-Device / Delayed-Purchase Clickid Loss

**What goes wrong:**
A user clicks a partner ad on mobile, lands on the registration page, but completes signup on desktop 20 minutes later (cross-device). The clickid exists only in the mobile session cookie and URL. The desktop signup request has no cookie and no clickid in the query string. If clickid persistence relies only on `req.cookies` and `req.query` at signup time, the partner postback fires without a clickid.

This is distinct from Pitfall 1 (which covers delayed purchase after signup). Here the gap is between the ad click and the signup itself.

**How to avoid:**
- Pass the clickid from the frontend to the signup API request body explicitly. The landing page should capture the partner clickid from the URL and store it in `localStorage` (survives page navigations and cross-tab, unlike cookies which are domain-scoped). The signup form submission should include it in the request body.
- The backend signup handler should read `partnerClickId` from the request body (not just from cookies) and store it on the User doc.
- Define an attribution window with the partner (typically 30 days for registration, 7 days for conversion). Do not attempt to retroactively attribute signups from before the clickid was captured.

**Warning signs:**
- Mobile-heavy brands show lower attribution rates than desktop-heavy brands.
- Partner clickid appears in landing page analytics but not in signup postback events.

**Phase to address:** Phase 1 (frontend clickid capture) alongside backend User doc storage.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode postback URL in code | Ship faster, no admin UI needed | URL change = deploy; second partner = second hardcode; no test button | Never — store in `ConversionWebhookSettings` |
| Fire postback only from `signup_completed`, skip PAP/free paths | Simpler mapping | PAP traders never attributed; partner data wrong | Only if partner contract explicitly excludes PAP and free programs |
| Omit `currency` from postback, assume USD | Less code | JPY amounts appear as inflated USD; fraud flags from partner | Never — always send currency code |
| Skip retry worker, mark failed and move on | No cron complexity | Silent missed postbacks; lost commissions | Acceptable in v1 only if monitored and manually retried |
| Use `ConversionWebhookEventsService` legacy path for new events | Reuses existing code | Bypasses dedup; double-fires on retry; no idempotency | Never — use Tracking path with dedup |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Partner S2S endpoint | Send POST when spec requires GET | Read spec; use GET + `URL.searchParams` for macro substitution |
| Partner S2S endpoint | Omit `clickid` when it is empty/null — send postback anyway | Return `status: "skipped"` — never send postback without a valid clickid; the partner cannot attribute it and it may pollute their fraud scoring |
| Partner S2S endpoint | Treat HTTP 200 as success | Some networks return 200 for all requests; check the response body for an `"ok"` or error field per partner spec |
| Partner S2S endpoint | Use same postback URL for registration and conversion | Registration and conversion are typically separate postback calls with different `status` values; confirm per partner spec |
| `ConversionWebhookSettings` | Configure in wrong brand's DB | Assert `PROJECT_ID` matches expected brand slug before dispatch |
| `PaymentAttribution` | Read `gclid`/`ttclid` as proxy for partner clickid | Partner clickid is a separate field (`sub1`, `clickid`, etc.) — do not conflate with ad-platform click IDs |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Postback on user request path (synchronous) | Signup or purchase hangs for 15 seconds on partner 5xx | Always use fire-and-forget (`fireAndForget` pattern already in `tracking.events.service.ts`) | Immediately at first partner timeout |
| Loading `ConversionWebhookSettings` from DB on every dispatch | DB hit per postback; slow dispatch at volume | Apply same 30-second in-process cache pattern used in `TrackingSettings.loadSettings()` | At approximately 50 purchases/minute without caching |
| `TrackingEventLog` full-collection scan for retry worker | Retry cron slows down as log grows | Add compound index on `(destination, status, createdAt)` before shipping retry worker | At approximately 100K log rows |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging `partnerClickId` in plaintext to application logs | Click IDs are attribution tokens; full exposure enables click injection attacks and may be PII in some jurisdictions | Truncate or omit clickid from debug logs; store only in the structured DB field |
| Accepting partner postback URL from user-supplied input without validation | SSRF — malicious admin configures postback URL pointing to internal services | The existing `isHttpsUrl()` check is present; additionally add a private IP range blocklist before saving to settings |
| Firing postback before payment is confirmed | Partner receives conversion that may never complete | Only dispatch postbacks from the confirmed-payment callback handler, never from `purchase_initiated` |
| Sending postback without clickid and using a placeholder value | Partner double-counts on placeholder collisions | Return `status: "skipped"` when clickid is absent — do not substitute empty string or a constant |

---

## "Looks Done But Isn't" Checklist

- [ ] **clickid storage on User doc:** `partnerClickId` field exists in the User schema and is populated during signup from request body (not only from cookies)
- [ ] **clickid storage on Payment doc:** `partnerClickId` field exists in the Payment model and is stored at checkout creation, so gateway callbacks can still find it
- [ ] **PAP funnel coverage:** explicit decision recorded in event-mapping spec about whether `pap_payment_completed` should be enabled for `conversionWebhook` (currently `false` in `tracking.constants.ts`)
- [ ] **Free program coverage:** confirmed with partner whether `free_trial_signup`/`free_challenge_signup` postbacks should fire (they are currently `conversionWebhook: true` by default)
- [ ] **Refund path checked:** every payment refund/chargeback handler (`paypal-webhook.service.ts`, `oxapay.service.ts`, `stripe-webhook.service.ts`) verified to emit a reversal postback or explicitly documented as out of scope
- [ ] **Currency field required:** all postback builders that include `value` have `currency` as a required (non-optional) field
- [ ] **Brand guard present:** `PROJECT_ID` assertion in S2S adapter returns `status: "skipped"` with logged warning on mismatch
- [ ] **Test button works:** admin panel "Send test postback" button fires a synthetic postback with a fake clickid and confirms partner endpoint returns 200
- [ ] **Dual-path audit complete:** `ConversionWebhookEventsService.*` call sites confirmed non-overlapping with `TrackingEvents.*` call sites for the same events

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| clickid not persisted, missed postbacks | MEDIUM | Query `ConversionWebhookDeliveryLog` for entries where postback was dispatched but no clickid in payload; cross-reference with Payment `attribution` subdoc; manually re-fire for affected records once field is added |
| Double postbacks sent | HIGH | Partner must void duplicate commissions manually; audit `ConversionWebhookDeliveryLog` for pairs with same userId + event + timestamp proximity; disable legacy path immediately |
| JPY sent as USD to partner | HIGH | Contact partner to void inflated conversions; fix currency guard; re-fire corrected postbacks; same recovery pattern as `project_pap_jpy_charged_as_usd.md` incident |
| Refund not canceled at partner | MEDIUM | Export refunded payment IDs; manually send reversal postbacks via admin tool or one-off script; negotiate chargeback with partner if commission was already paid |
| Postback firing to wrong brand's partner endpoint | HIGH | Disable `conversionWebhook` in affected DB immediately; audit partner dashboard for misattributed conversions; add brand guard before re-enabling |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| clickid not persisted (gateway callback) | Phase 1 — data model | `partnerClickId` present on User and Payment docs in DB after test purchase via gateway callback |
| Dual dispatch path double-fire | Phase 1 — architecture | Audit shows only one dispatch path per event; `ConversionWebhookDeliveryLog` shows exactly one entry per userId + event |
| PAP/free-trial funnel bypass | Phase 1 — event mapping spec | Written spec doc mapping each funnel path to exactly one postback event, reviewed before any code is written |
| Refund/chargeback no reversal | Phase 2 — reversal postback | Refund a test payment; confirm partner dashboard shows the conversion canceled |
| Multi-currency JPY as USD | Phase 1 — payload schema | `currency` is required; JP test purchase shows `currency: "JPY"` in delivery log |
| No brand isolation guard | Phase 1 — brand guard | Temporarily set wrong `PROJECT_ID` in test env; confirm postback is skipped with log warning |
| Minimal one-off hardcoding | Phase 1 — configuration schema | URL changeable from admin panel without code deploy; test button fires synthetic postback |
| No retry on 5xx | Phase 2 — retry worker | Simulate partner 5xx; verify retry cron re-fires within expected window |
| GET vs POST / URL encoding | Phase 1 — HTTP client | Send test postback with clickid containing `+`, `/`, `=`; confirm partner receives correct value |
| Cross-device clickid loss | Phase 1 — frontend capture | Test signup from different browser after landing page visit; confirm clickid present in delivery log |

---

## Sources

- Codebase (HIGH): `pft-backend/src/app/modules/Tracking/dedup/dedup.service.ts` — dedup semantics; `failed` status intentionally allows re-attempt
- Codebase (HIGH): `pft-backend/src/app/modules/Tracking/enrichment/click-ids.ts` — clickid enrichment reads `req.cookies` and `req.query` only; no fallback to User/Payment doc
- Codebase (HIGH): `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.service.ts` line 101 — `buildPayload()` generates `crypto.randomUUID()` per call, bypassing dedup
- Codebase (HIGH): `pft-backend/src/app/modules/Tracking/tracking.constants.ts` line 59 — `pap_payment_completed` is `conversionWebhook: false`
- Codebase (HIGH): `pft-backend/src/app/modules/Payment/services/paypal-webhook.service.ts` — refund handler has no tracking dispatch
- Codebase (HIGH): `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.service.ts` line 152 — `AbortSignal.timeout(15000)`, one attempt only, no retry
- Project history (HIGH): `project_pap_jpy_charged_as_usd.md` — JPY billed as USD precedent
- Project history (HIGH): `project_pap_funded_kyc_bypass.md` — PAP funded-leg skips KYC gate
- Project history (HIGH): `reference_per_brand_databases.md` — per-DB brand separation; brand guard is documentation-level only, not code-level

---

*Pitfalls research for: partner S2S postback / clickid passthrough — Trading Cult CRM Partner Tracking (v1.3)*
*Researched: 2026-07-01*
