# Stack Research: v1.3 CRM Partner Tracking (S2S Postbacks)

**Domain:** S2S postback firing + partner click-ID capture — extension of existing white-label prop-trading backend
**Researched:** 2026-07-01
**Confidence:** HIGH — all findings from direct file reads of the live codebase; zero training-data assumptions

---

## Executive Finding: Zero New Dependencies Required

Every building block needed for S2S GET postbacks with macro substitution already exists in the codebase. The work is purely additive TypeScript inside the existing module tree. No `npm install` required.

---

## HTTP Client Already in Use

**Client: native `fetch` (Node.js built-in, no package)**

Evidence — `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.service.ts` line 148:

```typescript
const response = await fetch(webhookUrl, {
  method: "POST",
  headers,
  body,
  signal: AbortSignal.timeout(15000),
});
```

`axios` is present in `pft-backend/package.json` (`"axios": "^1.9.0"`) but it is NOT imported anywhere in the Tracking or ConversionWebhook module trees. Do not introduce `axios` into this path. Use native `fetch` + `AbortSignal.timeout(15000)` for the GET postback call — same timeout pattern, same error-handling shape (`ok`, `statusCode`, `error`, `durationMs` return).

---

## Macro/Template Substitution

**Approach: inline `String.prototype.replace()` — no new dependency**

`sprintf-js` (`"sprintf-js": "^1.1.3"`) is in `package.json` but is not used anywhere in the Tracking or ConversionWebhook modules. Do not pull it in. The S2S GET URL template format uses curly-brace tokens (`{clickid}`, `{goal}`, `{payout}`), not `%s` printf syntax. The correct implementation is a two-line inline helper:

```typescript
// Lives inside the new adapter/helper file — no import needed
function expandMacros(
  urlTemplate: string,
  vars: { clickid: string; goal: string; payout: string }
): string {
  return urlTemplate
    .replace("{clickid}", encodeURIComponent(vars.clickid))
    .replace("{goal}", encodeURIComponent(vars.goal))
    .replace("{payout}", encodeURIComponent(vars.payout));
}
```

Partner postback URL example: `https://partner.example.com/postback?clickid={clickid}&goal={goal}&payout={payout}`. Curly-brace tokens are unambiguous (not valid URL characters in path/query values) and safe to replace with a single-pass `.replace()`.

---

## Recommended Stack (Additive Only)

### Core Technologies — No Changes

| Technology | Version in package.json | Role in S2S postbacks | Why |
|------------|------------------------|----------------------|-----|
| Node.js built-in `fetch` | Runtime >=20.9.0 (already enforced via `engines` in package.json) | GET postback HTTP call | Already the HTTP client used by `deliverPayload()` at line 148; zero new dep |
| TypeScript | `^5.9.2` | New adapter file + model field additions | Existing language |
| Mongoose | `^8.4.4` | `partnerClickId` field on User schema; optional postback config fields on `ConversionWebhookSettings` | Schema-flexible; no migration script required |
| `AbortSignal.timeout()` | Node 20+ built-in | 15-second hard timeout on GET | Same pattern as `conversion-webhook.service.ts` line 152 |

### Supporting Libraries — Already Present, No New Installs

| Library | package.json version | Use in S2S | Notes |
|---------|---------------------|------------|-------|
| `winston` (via `logger`) | `^3.17.0` | Log failed postbacks via `logger.warn` / `logger.error` | Same import used throughout all modules |
| `zod` | `^3.23.8` | Validate any new config fields in admin update endpoint | Already used for validation schemas in this codebase |
| `crypto` (Node built-in) | package.json entry `"crypto": "^1.0.1"` wraps built-in | Not needed — S2S GET postbacks require no signature headers | Contrast: existing `conversionWebhook` POST uses HMAC; GET postbacks don't |

---

## Installation

```bash
# No new packages. Zero npm/yarn installs required.
```

---

## Reusable Building Blocks

### 1. `IDestinationAdapter` interface
**`pft-backend/src/app/modules/Tracking/destinations/base.ts` lines 27–37**

`send(payload, ctx): Promise<IDispatchResult>` is the correct extension point. A new file `destinations/partner-postback.ts` implementing this interface is registered via `registerAdapter()` in `destinations/index.ts` (follows the pattern at lines 14–18). No changes to the central dispatcher.

### 2. `ConversionWebhookService.deliverPayload()` — pattern to clone, not call
**`conversion-webhook.service.ts` lines 113–171**

Shows the full pattern: build URL, call `fetch` with `AbortSignal.timeout`, capture `{ ok, statusCode, error, durationMs }`. The new S2S GET postback helper replicates this shape for a GET request (no body, no Content-Type header). Do NOT call `deliverPayload()` itself — it always POSTs JSON and always reads the stored `webhookUrl`, neither of which applies.

### 3. `dispatchConversionWebhook()` fire-and-forget wrapper
**`conversion-webhook.dispatch.ts` lines 5–13**

```typescript
export function dispatchConversionWebhook(input): void {
  ConversionWebhookService.dispatch(input).catch((err) => {
    logger.error("Conversion webhook dispatch error", { ... });
  });
}
```

Replicate this fire-and-forget `.catch()` pattern for the new postback calls. S2S failures must never propagate to the caller.

### 4. `TrackingEvents` event helpers — the two call sites
**`tracking.events.service.ts` lines 38–39 (`signupCompleted`) and 62–75 (`purchaseCompleted`)**

These are the correct places to add the S2S registration and sale postback fires respectively. Both already exist and route through the Tracking dispatcher to all destinations. The simplest implementation invokes the postback directly from these helpers rather than adding a new `DestinationName` entry (see Alternatives below).

### 5. Per-brand config — `ConversionWebhookSettings` schema
**`conversion-webhook.model.ts` lines 18–35**

Add optional partner postback fields directly to the existing schema:
- `partnerPostbackEnabled: { type: Boolean, default: false }`
- `registrationPostbackUrl: { type: String, default: "" }`
- `salePostbackUrl: { type: String, default: "" }`

This avoids a new collection and new admin UI surface. For the v1.3 one-partner MVP, config can be seeded directly into the DB or via env vars without admin UI.

### 6. `ConversionWebhookDeliveryLog` — reuse for postback delivery logs
**`conversion-webhook.model.ts` lines 50–73**

TTL-indexed collection (30-day auto-expiry). Reuse by writing partner postback delivery records with synthetic event names `"PartnerRegistration"` and `"PartnerSale"`. Same `{ ok, statusCode, error, durationMs }` struct maps directly.

---

## `partnerClickId` Capture Path

### What is NOT already there
`enrichment/click-ids.ts` captures `fbclid`, `gclid`, `ttclid`, `msclkid`, `li_fat_id` for ad platforms only. There is no `clickid` query parameter handling anywhere in the codebase. The `TRegisterUser` interface (`auth.interface.ts` line 320) has no attribution or partner-click fields. The User Mongoose schema (`auth.model.ts`) has no `partnerClickId`, `utmSource`, or similar attribution storage.

### What must be added (minimal surface)

**User model** (`auth.model.ts`, near `referralCode` at line 479):
```typescript
partnerClickId: { type: String },
```

**Registration interface** (`auth.interface.ts`, `TRegisterUser` at line 320):
```typescript
partnerClickId?: string;
```

**Auth service** (`auth.service.ts`, `initiateRegistration()` user-create block): persist `partnerClickId` from `req.body` to the new user document field.

**Tracking payload** (`tracking.interface.ts`, `ITrackingEventPayload` at line 168):
```typescript
partnerClickId?: string;
```

**Do NOT modify** `enrichment/click-ids.ts` — its purpose is ad-platform-specific cookie formats. `partnerClickId` is a plain query string captured once at signup and persisted, not enriched from cookies on every event.

The `partnerClickId` lookup flow at postback time: read from User document by `userId` (one `User.findById().select('partnerClickId')` call inside the postback adapter), not from live request context.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Native `fetch` for GET call | `axios` (already in package.json) | `axios` is not used in this module tree; importing it creates inconsistency and adds an unnecessary dep boundary. Native `fetch` with `AbortSignal.timeout` is the established pattern in this code. |
| Inline `String.replace()` for macro substitution | `sprintf-js` (already in package.json) | `sprintf-js` uses `%s` printf syntax, not `{key}` curly-brace syntax. Adapting it adds more code than the two-line replace. No benefit. |
| Direct fire from `TrackingEvents` helpers | New `DestinationName` + `IDestinationAdapter` registered in the dispatcher | A full adapter adds Tracking settings DB toggles, dedup index, delivery log via the dispatcher, and a new `DestinationName` literal. For one partner with no admin toggle UI yet, the overhead is unjustified. Use a direct fire with its own try/catch and delivery log write. Promote to a full adapter when multi-partner UI is built. |
| Add postback config fields to existing `ConversionWebhookSettings` | New `PartnerPostbackSettings` collection | One additional collection means one more DB query path, a new model file, a new service, and eventually new admin UI. Unnecessary for one-partner MVP scope. |
| No retry on GET failure | Retry with exponential backoff | S2S postbacks are best-effort by industry convention. Partners do not expect guaranteed delivery. Retry risks duplicate conversion credits on the partner side. Log and move on (same as existing `conversionWebhook` behavior). |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `axios` for the GET postback | Inconsistency — `conversionWebhook` already uses native `fetch`; mixing clients in the same module confuses future readers | `fetch` + `AbortSignal.timeout(15000)` |
| `node-fetch` or any fetch polyfill | Node runtime is already pinned to >=20.9.0 which ships native `fetch` | Native `fetch` |
| `sprintf-js` for URL macro substitution | Wrong token syntax for curly-brace S2S format; a two-line `replace()` is simpler | Inline `String.prototype.replace()` |
| New `PartnerPostbackSettings` Mongoose model/collection | Over-engineering for one partner | Add 3 optional fields to `ConversionWebhookSettings` schema |
| Retry logic with backoff | Risks duplicate conversion credits on partner side; S2S is best-effort | Log failure, write delivery log, return |
| Admin UI for partner postback config in v1.3 | Scope is a minimal one-off for Trading Cult; building UI adds frontend work not in scope | Env var or direct DB seed for the postback URL templates |
| Storing `partnerClickId` in a cookie from the backend | Backend has no cookie-write surface at the tracking call sites (service layer, not controller) | Frontend captures `?clickid=` param, sends in registration body; backend persists to User doc |
| `encodeURIComponent` inside `expandMacros` only | The `clickid` value from the partner may already be URL-encoded by their system — double-encoding corrupts it | Encode only if the value is confirmed raw. Default to encoding once; document the assumption. |

---

## Key Files to Modify or Create

| File | Action | Detail |
|------|--------|--------|
| `Auth/auth.interface.ts` | Modify | Add `partnerClickId?: string` to `TRegisterUser` (line 320 block) |
| `Auth/auth.model.ts` | Modify | Add `partnerClickId: { type: String }` to `UserSchema` (near `referralCode` at line 479) |
| `Auth/auth.service.ts` | Modify | Persist `partnerClickId` in `initiateRegistration()` user create; add S2S registration postback fire after `verifyRegistrationOtp()` resolves (line 955+ block) |
| `Tracking/tracking.interface.ts` | Modify | Add `partnerClickId?: string` to `ITrackingEventPayload` (line 168 block) |
| `Admin/ConversionWebhook/conversion-webhook.model.ts` | Modify | Add 3 optional fields to `conversionWebhookSettingsSchema`: `partnerPostbackEnabled`, `registrationPostbackUrl`, `salePostbackUrl` |
| `Admin/ConversionWebhook/conversion-webhook.interface.ts` | Modify | Add matching fields to `IConversionWebhookSettings` and `IConversionWebhookSettingsUpdate` |
| `Admin/ConversionWebhook/partner-postback.ts` | Create | `fetchGetPostback(urlTemplate, vars): Promise<{ok, statusCode, error, durationMs}>` helper; `expandMacros()` inline; delivery log write |
| `Payment/services/callback.service.ts` or stripe equivalent | Modify | Add S2S sale postback fire-and-forget after purchase confirmed |

**Do NOT modify:**
- `Tracking/enrichment/click-ids.ts` — ad-platform IDs only
- `Tracking/destinations/index.ts` — no new adapter registration needed for MVP
- `Tracking/tracking.service.ts` — central dispatcher is not changed

---

## Sources

All HIGH confidence — read directly from live source files, no WebSearch:

- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.service.ts` — HTTP client (`fetch` line 148), `AbortSignal.timeout` (line 152), timeout value (15000ms), error shape, delivery log pattern
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.dispatch.ts` — fire-and-forget `.catch()` wrapper
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.model.ts` — config schema + delivery log schema with TTL index
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook.interface.ts` — payload + settings contracts
- `pft-backend/src/app/modules/Admin/ConversionWebhook/conversion-webhook-events.service.ts` — typed event helper pattern
- `pft-backend/src/app/modules/Tracking/destinations/base.ts` — `IDestinationAdapter` interface
- `pft-backend/src/app/modules/Tracking/destinations/conversion-webhook.ts` — adapter implementation example
- `pft-backend/src/app/modules/Tracking/destinations/index.ts` — adapter registration pattern
- `pft-backend/src/app/modules/Tracking/tracking.service.ts` — dispatcher, enrichment pipeline, `loadSettings` cache
- `pft-backend/src/app/modules/Tracking/tracking.events.service.ts` — `signupCompleted` (line 38) + `purchaseCompleted` (line 62) fire sites
- `pft-backend/src/app/modules/Tracking/tracking.interface.ts` — `ITrackingEventPayload` full field list (confirmed no `partnerClickId` today)
- `pft-backend/src/app/modules/Tracking/tracking.constants.ts` — `signup_completed` and `purchase_completed` both have `conversionWebhook: true` default
- `pft-backend/src/app/modules/Tracking/enrichment/click-ids.ts` — confirmed ad-platform only, no generic `clickid` param
- `pft-backend/src/app/modules/Auth/auth.interface.ts` — `TRegisterUser` (line 320, confirmed no `partnerClickId`)
- `pft-backend/src/app/modules/Auth/auth.model.ts` — User schema (confirmed no `partnerClickId`, `utmSource`, or attribution fields)
- `pft-backend/src/app/modules/Auth/auth.service.ts` — `verifyRegistrationOtp()` post-registration block (line 955+) where side effects fire
- `pft-backend/src/app/modules/Auth/auth.controller.ts` — `req` is available at the register endpoint; `req.body` flows into `initiateRegistration()`
- `pft-backend/package.json` — confirmed: `fetch` is Node built-in (no package entry); `axios@^1.9.0` present but unused in Tracking/ConversionWebhook; `sprintf-js@^1.1.3` present but unused in these modules; `zod@^3.23.8` and `winston@^3.17.0` available for use

---
*Stack research for: S2S partner postback tracking (v1.3 CRM Partner Tracking)*
*Researched: 2026-07-01*
