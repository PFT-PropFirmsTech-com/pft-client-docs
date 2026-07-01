# Phase 10 Research: Capture & Persist (CRM-01/02/03)

**Derived from** the milestone research (`.planning/research/ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `SUMMARY.md` — all HIGH confidence, codebase-grounded). This distills only the Phase-10 slice. Read the milestone research for full rationale.

## Phase scope

Capture an arbitrary partner `clickid` at the tracking-link entry, bridge it (anonymous click → identified account) via a first-party cookie, and persist it **unchanged** on BOTH the User doc (at registration) and the Payment doc (at checkout creation). NO postbacks fire in this phase (Phase 12). NO emit wiring (Phase 11). Pure data-model + capture plumbing.

## Key facts (with anchors)

### The persistence problem (why User AND Payment)
- The user is anonymous at click time; identity exists only after OTP verification (`auth.service.ts:820-953`). A server-set session does not bridge anonymous-click → account. **A first-party cookie set on landing + forwarded as a signup body field is the reliable bridge.**
- `enrichClickIds` (`Tracking/enrichment/click-ids.ts:10-40`) reads ONLY `req.cookies`/`req.query` and covers ad-platform IDs (fbc/gclid/ttclid/msclkid/li_fat_id) — NO generic partner param. Gateway/webhook purchase-completion paths run with **`req = null`**, so the cookie is unavailable at purchase time.
- ∴ persist on the **User doc** (survives to every later event) AND on the **Payment doc** at checkout creation (so a gateway-callback completion can resolve it without `req`). Written once, never mutated.

### CRM-01 — tracking link + cookie
- New `GET /track?clickid=…` route (brand landing domain): read `clickid`, set a first-party cookie `_partner_clickid` (30-day expiry, mirror the `_fbc`/`_gclid` cookie pattern), 302-redirect to the site (default `/`, optional `?redirect=` allowlisted to same-origin paths).
- Frontend (pft-dashboard): on any page load, if `_partner_clickid` cookie present, read it and include `partnerClickId` in the registration request body. (Mirror however `_fbc`/`_gclid` are already forwarded — audit the existing signup payload builder.)
- URL-encoding: store the raw clickid value; do not decode/re-encode destructively. Partner requires it echoed back byte-identical (Phase 12 does `encodeURIComponent` at send).

### CRM-02 — persist on User at registration
- `TRegisterUser` interface (`auth.interface.ts:~320`) gains `partnerClickId?: string`.
- `UserSchema` (`auth.model.ts:~479`) gains `partnerClickId: { type: String, index: true }` (indexed — later lookups + support queries).
- `AuthService.verifyRegistrationOtp` (`auth.service.ts:820`) writes it into the existing `User.findByIdAndUpdate` at **line 830**. Skip-when-absent: only set when the body carried a value (never write empty string / clobber).
- NOTE for two-step registration: confirm the field survives `initiateRegistration` → `verifyRegistrationOtp` (temp/pre-OTP user upsert). If it does not survive the temp-user round-trip, re-forward `partnerClickId` in the OTP-verify body. (Open item flagged in ARCHITECTURE.md — resolve during planning by reading `initiateRegistration`.)

### CRM-03 — persist on Payment at checkout creation
- `PaymentAttribution` interface (`payment.interface.ts:4-17`) currently holds ad-platform IDs only. Add `partnerClickId?: string`.
- Populate it at checkout/payment-doc creation (find the site that builds `attribution` from the request — same place fbc/gclid are captured). Source: the `_partner_clickid` cookie/body if present, else fall back to `user.partnerClickId` (the user is authenticated at checkout, so the user-doc value is available and authoritative).
- Do NOT conflate with ad-platform IDs — `partnerClickId` is a distinct field (PITFALLS.md: never read gclid/ttclid as a proxy).

## Do NOT (this phase)
- Do NOT modify `enrichClickIds` for the partner param yet unless needed for capture (that extension is Phase 11's emit concern). Keep Phase 10 to schema + capture + persist.
- Do NOT wire `signupCompleted`/`purchaseCompleted` (Phase 11).
- Do NOT build the postback adapter or touch `conversionWebhook` (Phase 12).
- No new npm deps.

## Repos / deploy
- pft-backend (route + 2 schema fields + 2 persist sites) + pft-dashboard (cookie read + forward in signup body). Both on `main-2026`. Brand separation is per-DB.

## Verification anchors (for plan must_haves)
- `GET /track?clickid=ABC123` → sets `_partner_clickid=ABC123` cookie + 302 redirect; value unchanged.
- Post-tracking-link registration → `partnerClickId: "ABC123"` on the User doc in DB.
- That user's checkout → `partnerClickId: "ABC123"` (or `attribution.partnerClickId`) on the Payment doc at creation.
- Registration with no tracking link → no `partnerClickId` written (field absent/undefined).

## Open items to resolve in planning (not blockers)
1. Two-step registration temp-user survival of `partnerClickId` (read `initiateRegistration`).
2. Exact checkout-creation site where `attribution` is built (grep for `PaymentAttribution` population / where fbc/gclid land on the payment).
3. Frontend signup payload builder location (where `_fbc`/`_gclid` are already forwarded) to add `partnerClickId` alongside.
