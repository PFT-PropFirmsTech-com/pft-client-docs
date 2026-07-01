---
phase: 10-capture-persist
verified: 2026-07-01T10:16:32Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to the deployed brand landing at GET /api/tracking/track?clickid=ABC123"
    expected: "Browser receives 302 redirect + Set-Cookie: _partner_clickid=ABC123 (raw, no encoding). Confirm with DevTools Network tab."
    why_human: "Cookie behavior, correct encoding, and actual HTTP response headers require a live deployed environment."
  - test: "After visiting the tracking link, complete registration on the dashboard"
    expected: "The /auth/register request body includes partnerClickId: 'ABC123' (visible in Network tab). After OTP verify, MongoDB User doc has partnerClickId: 'ABC123'."
    why_human: "OTP round-trip field survival and actual DB document state require runtime + DB inspection."
  - test: "That registered user completes a standard checkout"
    expected: "The Payment document in MongoDB has attribution.partnerClickId: 'ABC123' at creation time (before any gateway callback)."
    why_human: "Requires live payment flow and DB read to confirm."
  - test: "That registered user completes a PAP funded-leg payment"
    expected: "The PAP Payment document in MongoDB has attribution.partnerClickId: 'ABC123'."
    why_human: "Requires live PAP funded-leg flow and DB read."
  - test: "Register a new user without visiting any tracking link"
    expected: "The User document in MongoDB has NO partnerClickId field (not null, not empty string — field absent)."
    why_human: "Skip-when-absent confirmation requires DB inspection of the created document."
  - test: "Confirm the partner-facing URL convention with infra/brand config"
    expected: "Brand landing domain rewrites /track?clickid= to /api/tracking/track?clickid= (infra config, not code). Partners should be given the full /api/tracking/track path, or the rewrite must be confirmed."
    why_human: "The code exposes /api/tracking/track; bare /track is an infra rewrite — needs config verification per brand."
---

# Phase 10: Capture + Persist — Verification Report

**Phase Goal:** The partner `clickid` is captured at the tracking-link entry point, survives in a first-party cookie to the registration form, and is persisted durably on both the User document and the Payment document — so every downstream event emitter can resolve it even from a gateway webhook callback where no browser request exists.
**Verified:** 2026-07-01T10:16:32Z
**Status:** human_needed (code fully verified; live end-to-end verification pending deploy per project convention)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /tracking/track?clickid=ABC123 sets a first-party _partner_clickid cookie (raw, httpOnly:false, 30 days, sameSite:lax) and 302-redirects | VERIFIED | `tracking.controller.ts:219-248` — handler reads query.clickid as string, cookie set with correct options (maxAge 30 days, httpOnly false, sameSite lax, secure env-gated, path /), open-redirect guard on redirect param (starts-with "/" and not "//"), always 302, try/catch fallback |
| 2 | Route is wired at GET /api/tracking/track (public, rate-limited, no auth) | VERIFIED | `tracking.routes.ts:63` — `router.get("/track", apiLimiter, TrackingController.trackRedirect)`; router mounted at `/tracking` in routes/index.ts:193 → full path `/api/tracking/track` |
| 3 | Missing/empty clickid still 302-redirects without setting cookie | VERIFIED | `tracking.controller.ts:224` — `if (clickid && clickid.trim().length > 0)` guard; redirect executes regardless |
| 4 | Dashboard forwards _partner_clickid as partnerClickId in signup body (skip-when-absent) | VERIFIED | `useAuth.ts:289-296` — `const partnerClickId = Cookies.get("_partner_clickid")` then `...(partnerClickId ? { partnerClickId } : {})` conditional spread; no empty-string write. `RegisterCredentials` has `partnerClickId?: string` at `auth.types.ts:45` |
| 5 | partnerClickId on TUser + TRegisterUser interfaces; UserSchema has indexed string field, no default | VERIFIED | `auth.interface.ts:315` (TUser) and `:346` (TRegisterUser); `auth.model.ts:536-539` — `partnerClickId: { type: String, index: true }` — no default, no trim, no required |
| 6 | OTP round-trip does NOT clobber partnerClickId (auth.service.ts NOT edited) | VERIFIED | `auth.service.ts:830-840` — `verifyRegistrationOtp` `findByIdAndUpdate` sets only `referralCode`, `role`, `roleIds`, `isRegistered`, `$unset: otp/otpExpires/otpAttempts` — no write to partnerClickId. `initiateRegistration` spreads `{ ...payload }` → `new User({ ...userData, ... })` at :554-574 and :721-729; Mongoose strict mode persists the field once the schema accepts it |
| 7 | attribution.partnerClickId populated from user.partnerClickId (server-authoritative) at BOTH Payment.create sites | VERIFIED | `payment.service.modular.ts:311-312` — `mergedAttribution` built from `user.partnerClickId` after user resolved at :305, used at `:535`; PAP site `:2771` — `attribution: user?.partnerClickId ? { partnerClickId: user.partnerClickId } : undefined` — user loaded via `User.findById(userId)` at :2427. Neither site reads the request body for partnerClickId |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pft-backend/src/app/modules/Tracking/tracking.controller.ts` | `trackRedirect` handler — sets _partner_clickid cookie, 302 redirect, open-redirect guard | VERIFIED | Lines 219-248 — substantive, wired via routes |
| `pft-backend/src/app/modules/Tracking/tracking.routes.ts` | GET /track wired to trackRedirect with apiLimiter, no auth | VERIFIED | Line 63 — wired, exported as TrackingRoutes |
| `pft-backend/src/app/modules/Auth/auth.interface.ts` | partnerClickId?: string on TUser and TRegisterUser | VERIFIED | Lines 315 (TUser) and 346 (TRegisterUser) |
| `pft-backend/src/app/modules/Auth/auth.model.ts` | Indexed partnerClickId String field, no default | VERIFIED | Lines 536-539 |
| `pft-backend/src/app/modules/Payment/payment.interface.ts` | partnerClickId?: string on PaymentAttribution | VERIFIED | Line 23 |
| `pft-backend/src/app/modules/Payment/payment.model.ts` | partnerClickId String inside attribution subdocument | VERIFIED | Line 257 |
| `pft-backend/src/app/modules/Payment/payment.service.modular.ts` | mergedAttribution at standard create (~:535) + attribution at PAP create (~:2771), both sourced from user.partnerClickId | VERIFIED | Lines 311-313, 535, 2771 — both server-authoritative, skip-when-absent |
| `pft-dashboard/src/hooks/useAuth.ts` | Reads _partner_clickid cookie, conditionally spreads partnerClickId | VERIFIED | Lines 289, 296 |
| `pft-dashboard/src/types/auth.types.ts` | partnerClickId?: string on RegisterCredentials | VERIFIED | Line 45 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tracking.routes.ts:63` | `TrackingController.trackRedirect` | `router.get("/track", apiLimiter, ...)` | WIRED | Confirmed directly. No auth middleware. |
| `routes/index.ts:193` | `TrackingRoutes` | `{ path: "/tracking", route: TrackingRoutes }` | WIRED | Full path `/api/tracking/track` confirmed |
| `useAuth.ts mutationFn` | `_partner_clickid` cookie | `Cookies.get("_partner_clickid")` conditional spread | WIRED | Reads raw value, no decode, no empty-string write |
| `auth.service.ts initiateRegistration` | `UserSchema.partnerClickId` | `new User({ ...userData })` spread — Mongoose strict mode now passes the field | WIRED | Schema field exists; no service edit required or made |
| `auth.service.ts verifyRegistrationOtp` | `partnerClickId` on User doc | findByIdAndUpdate at :830 does NOT write partnerClickId | WIRED (preserved) | Confirmed — OTP update only touches referralCode/role/isRegistered/$unset otp fields |
| `payment.service.modular.ts:311` | `Payment attribution (standard)` | `mergedAttribution = user.partnerClickId ? { ...attribution, partnerClickId } : attribution` used at :535 | WIRED | Server-authoritative; client attribution (fbc/gclid) preserved |
| `payment.service.modular.ts:2427` | `Payment attribution (PAP)` | `User.findById(userId)` → `user.partnerClickId` used at :2771 | WIRED | Server-authoritative; undefined when absent (not {}) |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| SC-1: GET /track?clickid=ABC123 sets _partner_clickid cookie + redirects; value unchanged (raw) | SATISFIED | cookie set raw (no encode/decode), 302 redirect, open-redirect guard on ?redirect |
| SC-2: Registered user after tracking link has partnerClickId on User doc; survives OTP round-trip; no auth.service.ts edit | SATISFIED | Schema field + payload spread path verified; verifyRegistrationOtp does not clobber |
| SC-3: Payment has attribution.partnerClickId at checkout-creation time; server-authoritative; at BOTH standard + PAP create | SATISFIED | Both sites confirmed, neither reads request body for partnerClickId |
| SC-4: Registration without tracking link has no partnerClickId on User doc (skip-when-absent; no default) | SATISFIED | Schema has no default; frontend conditional spread omits field when cookie absent; Mongoose strict mode drops unknown fields |

---

### Anti-Patterns Found

None. No TODOs, stubs, empty returns, or placeholder patterns in any of the Phase 10 modified files.

---

### Phase 11/12 Scope Check

No postback sending, conversion dispatch, or S2S transmission logic was added in Phase 10 files. The `conversionWebhook` references present in the Tracking module are pre-existing infrastructure (event dispatch system). The `partnerClickId` field is captured and stored only — no emission path added. Phase boundary is clean.

---

### Tracking URL Note (Not a Code Gap)

The code exposes the route at `/api/tracking/track`. The success criterion's wording uses the bare path `/track?clickid=…` — this refers to a brand landing domain rewrite (infra config), not a code-level path. This is documented in the plan constraints: "The brand landing domain rewrites/points its bare `/track?clickid=` at this (infra concern, not code)." Partners should be given the full `/api/tracking/track` path directly OR the infra rewrite must be confirmed per brand. This is a deployment/partner-onboarding note, not a code defect.

---

### Human Verification Required

#### 1. Cookie set correctly on live deployment

**Test:** Send `GET /api/tracking/track?clickid=ABC123` on the deployed brand domain (e.g. `https://brand.example.com/api/tracking/track?clickid=ABC123`).
**Expected:** HTTP 302 response with `Set-Cookie: _partner_clickid=ABC123; Path=/; Max-Age=2592000; SameSite=Lax; Secure` (Secure in prod). Value `ABC123` is byte-identical to input — not URL-encoded.
**Why human:** Cookie headers, secure flag behavior, and actual HTTP response require a live deployment with browser or curl.

#### 2. Registration captures partnerClickId in signup body and User doc

**Test:** After the above tracking link visit, complete a new user registration in the dashboard. Inspect the POST `/auth/register` body in DevTools and then read the MongoDB User document for that user.
**Expected:** Request body includes `"partnerClickId": "ABC123"`. After OTP verify, `db.users.findOne({ email: "..." }).partnerClickId === "ABC123"`.
**Why human:** OTP round-trip field survival and actual DB document state require runtime + DB access.

#### 3. Standard checkout writes attribution.partnerClickId

**Test:** With the registered user above, complete a standard challenge checkout.
**Expected:** `db.payments.findOne({ userId: ... }).attribution.partnerClickId === "ABC123"` — present at Payment creation time (before gateway callback).
**Why human:** Requires live checkout flow and DB read of the created Payment document.

#### 4. PAP funded-leg checkout writes attribution.partnerClickId

**Test:** With a PAP-eligible user who has `partnerClickId` on their User doc, trigger the funded-leg payment.
**Expected:** `db.payments.findOne({ userId: ..., type: /pap/ }).attribution.partnerClickId === "ABC123"`.
**Why human:** Requires PAP funded-leg scenario and live DB inspection.

#### 5. Organic registration leaves partnerClickId absent on User doc

**Test:** Register a new user WITHOUT visiting any tracking link (no `_partner_clickid` cookie in browser).
**Expected:** `db.users.findOne({ email: "..." })` document has no `partnerClickId` key at all (not null, not `""`).
**Why human:** Requires DB inspection to confirm true field absence vs null vs empty string.

#### 6. Infra rewrite confirmation per brand

**Test:** Confirm with the infra team or brand config that the brand landing domain routes bare `/track?clickid=` to `/api/tracking/track?clickid=` (or that partners are given the full `/api/tracking/track` URL directly).
**Why human:** This is a deployment/nginx/CDN config concern, not a code concern. Each brand may have different routing.

---

### Gaps Summary

No code gaps found. All 7 observable truths are verified by static inspection. The 4 success criteria are satisfied at the code level. Live end-to-end verification (Plan 10-04) is intentionally deferred per project convention and is correctly classified as `autonomous: false` in the plan frontmatter.

---

_Verified: 2026-07-01T10:16:32Z_
_Verifier: Claude (gsd-verifier)_
