# Roadmap: PFT WhiteLabel — Leaderboard & Competitions

## Milestones

- ✅ **v1.0 Leaderboard & Competitions** — Phases 1-3, 10 plans (shipped 2026-06-29) → [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Affiliate Reporting** — Phase 4, 4 plans (shipped 2026-06-30, ad-hoc) → [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Ticket Fixes + PAP Queue Label** — Phases 4.1–9, 7 plans (shipped 2026-07-01, human-verify pending deploy) → [archive](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 CRM Partner Tracking (S2S Postbacks)** — Phases 10-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Leaderboard & Competitions (Phases 1-3) — SHIPPED 2026-06-29</summary>

- [x] Phase 1: Pre-Work (2/2 plans) — deterministic floatingPL + leaderboardOptOut schema
- [x] Phase 2: Public Leaderboard (4/4 plans) — masked public endpoint, page, opt-out toggle, filters/sort
- [x] Phase 3: Competition System (4/4 plans) — models + admin CRUD, enrollment + baseline, public pages, CAS close + winners

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Affiliate Reporting (Phase 4, ad-hoc) — SHIPPED 2026-06-30</summary>

- [x] Phase 4: Affiliate Reporting Enhancements (4/4 plans) — backend bulk+my-commissions endpoints, ticket clarification reply, Payment History CSV affiliate columns, Purchase Report card with per-tier tabs + CSV export. Source ticket: [cmqqchwh500bspi0kxw23o2rl](https://portal.propfirmstech.com/admin/tickets/cmqqchwh500bspi0kxw23o2rl) (Trading Cult).

Full detail: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Ticket Fixes + PAP Queue Label (Phases 4.1–9) — SHIPPED 2026-07-01</summary>

Six ticket-driven support/ops fixes swept in after v1.1, plus the headline PAP funded-queue state label (PAP-01). All code-complete + pushed to main-2026; live human-verify deferred pending deploy. Two plans closed-by-remote (Phase 6 fully, Phase 4.1 Bugs 2+3) via the defer-to-remote convention.

- [x] Phase 4.1: Affiliate Reporting Bug Fixes — INSERTED (1/1) — CSV Commission Amount → SUM across MLM tiers + "Direct Commission Rate (%)" header (`60e9b37c`); Bugs 2+3 closed by remote.
- [x] Phase 5: Daily Profit Display Bug (1/1) — `mergedFromDeals` emits synthetic orphan-close rows; Trading Cult acct 13535 corrected.
- [x] Phase 6: Funded Queue Ready Badge (1/1) — closed by remote (`c8340316` + `73810f47`); sidebar red dot on KYC+contract-approved pending.
- [x] Phase 7: Used Margin Display (2/2) — rule-checker current+peak MarginUsedPercent + `MarginUsageCard` on client + admin routes (`1a7aa01e`, `1acd03c6`, rule-checker `abede27`).
- [x] Phase 8: Breach Email Template Vars (1/1) — `rule_breached` body interpolates `{ban_reason}`, variables 3→20, per-brand sync migration.
- [x] Phase 9: PAP Funded Queue State Label — PAP-01 (1/1) — admin payments show real queue state instead of "Program Not Assigned"; batch join + sparse index (`5de7c9f8`, `5dea14f2`); verifier 9/9.

Full detail: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### 🚧 v1.3 CRM Partner Tracking (S2S Postbacks)

**Milestone Goal:** A Trading Cult affiliate partner can attribute registrations and conversions to their own traffic — a partner `clickid` is captured at landing, persisted through signup and purchase, and fires S2S GET postbacks (with clickid + goal + payout) on registration and first sale (FTD only). Backend-heavy (pft-backend) + small pft-dashboard cookie-capture piece. Source ticket: cmqt52jdb001dny0kknkou9x0.

**Hidden prerequisites made explicit:**
- `TrackingEvents.signupCompleted()` and `.purchaseCompleted()` are defined but have ZERO callers today — Phase 11 must wire both as new call sites.
- The existing `conversionWebhook` adapter is NOT reusable (wrong event map + POST/JSON/HMAC vs required GET/macro) — Phase 12 builds a new `partnerPostback` adapter.

#### Phase 10: Capture & Persist

**Goal:** The partner `clickid` is captured at the tracking-link entry point, survives in a first-party cookie to the registration form, and is persisted durably on both the User document and the Payment document — so every downstream event emitter can resolve it even from a gateway webhook callback where no browser request exists.

**Depends on:** Nothing (first v1.3 phase; builds on existing User/Payment schema patterns)

**Requirements:** CRM-01, CRM-02, CRM-03

**Success Criteria** (what must be TRUE when Phase 10 completes):
1. A GET request to `/track?clickid=ABC123` sets a `_partner_clickid` first-party cookie and redirects to the site; the clickid value is unchanged in the cookie.
2. A user who registers after visiting a tracking link has `partnerClickId: "ABC123"` stored on their User document in the DB (verified via the post-registration user record).
3. A payment created by that user has `partnerClickId: "ABC123"` stored on the Payment document (verified at checkout-creation time, before any gateway callback fires).
4. A user who registers without a tracking link has no `partnerClickId` field on their User document (skip-when-absent behavior confirmed).

**Plans:** 4 plans (3 autonomous code plans in Wave 1 + 1 deferred live-verify checkpoint in Wave 2)

Plans:
- [x] 10-01: `GET /track` route + `_partner_clickid` cookie (backend `09ca7387`) + pft-dashboard cookie-read + forward as `partnerClickId` in signup body (`e111dab1`) (CRM-01) — [wave 1] ✓
- [x] 10-02: `partnerClickId` on User interface + indexed schema field; persists via existing registration payload spread, survives OTP round-trip — no auth.service.ts edit (backend `d2992553`) (CRM-02) — [wave 1] ✓
- [x] 10-03: `partnerClickId` on Payment `attribution` interface+schema; persist from authoritative `user.partnerClickId` at standard checkout AND PAP funded-leg creation (backend `4a079169`) (CRM-03) — [wave 1] ✓
- [ ] 10-04: DEFERRED post-deploy live human-verify of the full capture→persist path (CRM-01/02/03) — [wave 2, gated on next main-2026 deploy]

Note: partner-facing tracking URL is `/api/tracking/track?clickid=…` (mounted under existing tracking router). A prettier `/track` requires a brand-landing infra rewrite — config/verify detail, not code.

#### Phase 11: Wire Emits + Dedup

**Goal:** The two tracking helpers that have zero callers today (`TrackingEvents.signupCompleted()` and `.purchaseCompleted()`) are wired at their real call sites — registration completion and all payment-completion paths including the PAP path — threading `partnerClickId` + `usdAmount` + `currency=USD` through each; an FTD (first-purchase) FLAG is produced on every purchase event; and a dual-dispatch audit ensures the legacy `ConversionWebhookEventsService` path cannot double-fire the same event.

**Depends on:** Phase 10 (partnerClickId must be on User + Payment docs before emit sites can read it)

**Requirements:** CRM-04, CRM-05, CRM-06, CRM-08

**Success Criteria** (what must be TRUE when Phase 11 completes):
1. After a user completes registration (one-step OR two-step OTP), the `signup_completed` tracking event fires carrying the user's `partnerClickId` when present; a repeat submission for the same user dedups to one event (stable `signup:<userId>` eventId).
2. After a user's completed payment (standard challenge or PAP funded-leg), a purchase event fires carrying `partnerClickId`, `usdAmount`, and `currency: "USD"` — resolved from `payment.attribution.partnerClickId` (works in a `req=null` gateway callback).
3. Each purchase event carries an `isFirstPurchase` boolean FTD flag (computed via `Payment.countDocuments({userId, status:"completed"})`). `purchase_completed` / `pap_payment_completed` are NOT suppressed on repeat purchases (Meta/GA4/Klaviyo consume every purchase) — the once-per-user conversion guarantee is enforced in Phase 12 by gating the partner conversion send on `isFirstPurchase === true`.
4. A PAP funded-leg completion fires exactly ONE partner-conversion-eligible event (`pap_payment_completed`, using `usdAmount` not the billed `payAfterPassRemainingPrice`) and does NOT also fire `purchase_completed` for the same payment (`emitTrackingPurchaseCompleted` early-returns for PAP legs). A free $0 purchase produces no conversion-eligible event.
5. Retries are idempotent: purchase/PAP emits pass a stable `purchase:<paymentId>` / `pap:<paymentId>` eventId so gateway-webhook re-delivery collapses to one event (the default `deterministicEventId` only dedups within a minute).
6. A dual-dispatch audit of `ConversionWebhookEventsService` confirms it fires only KYC/payout/challenge lifecycle events — disjoint from the new Tracking signup/purchase events, so no double-fire.

**Plans:** 3 plans (11-01 in Wave 1 = shared type extension + signup wiring; 11-02 + 11-03 in Wave 2, parallel — disjoint files)

Plans:
- [x] 11-01: Extend `ITrackingEventPayload` + helper signatures with `partnerClickId`/`isFirstPurchase`/stable `eventId`; wire `TrackingEvents.signupCompleted()` at both registration-completion sites (backend `8e2f7509`+`44deb3d4`) (CRM-04) — [wave 1] ✓
- [x] 11-02: `emitTrackingPurchaseCompleted` utility (attribution.partnerClickId + usdAmount + FTD flag + PAP-skip + stable eventId) wired at 4 standard completion sites; `papPaymentCompleted` at 3 sites switched to usdAmount (JPY bug) + partnerClickId + stable eventId; fanbasis DOES provision PAP → wired there too (backend `644ccd39`+`982ba9a1`) (CRM-05, CRM-06) — [wave 2] ✓
- [x] 11-03: CRM-08 dual-dispatch audit — legacy `ConversionWebhookEventsService` (6 methods, KYC/payout/challenge only) confirmed disjoint from signup/purchase/pap; stable eventIds make retries idempotent → `11-DEDUP-AUDIT.md` (`8540f5a`) (CRM-08) — [wave 2] ✓

#### Phase 12: partnerPostback Adapter + Config + Verify

**Goal:** A new `partnerPostback` GET adapter fires to the partner's configured URL template with `{clickid}` / `goal` / `{payout}` macro substitution (URL-encoded), fire-and-forget with timeout and a delivery-log record; the per-brand `TrackingSettings.destinations.partnerPostback` config for Trading Cult stores the registration + conversion URL templates with an enable toggle; no other brand fires postbacks unless configured.

**Depends on:** Phase 11 (emit events must fire before the adapter can receive them)

**Requirements:** CRM-07, CRM-09

**Success Criteria** (what must be TRUE when Phase 12 completes):
1. A `destinations/partner-postback.ts` adapter exists, implements `IDestinationAdapter`, and is registered in `destinations/index.ts`; it returns `status: "skipped"` when `partnerClickId` is absent or the URL template is empty.
2. When a `signup_completed` event fires for a user with a `partnerClickId`, the adapter issues a GET request to the configured registration URL template with `{clickid}` URL-encoded in the query string and `goal=registration`; a delivery-log record is written.
3. When a `purchase_completed` / `pap_payment_completed` event fires for a user with a `partnerClickId` AND `isFirstPurchase === true`, the adapter issues a GET request to the configured conversion URL template with `{clickid}` URL-encoded, `goal=conversion`, and `payout=<usdAmount>` + `currency=USD`; a delivery-log record is written. Repeat purchases (`isFirstPurchase:false`) do NOT send the conversion postback.
4. A `partnerClickId` value containing URL-special characters (e.g. `+`, `=`, `/`) is correctly `encodeURIComponent`-ed before substitution — the partner receives the exact original value.
5. [POST-DEPLOY CHECKPOINT — deferred] Trading Cult live traffic: a test registration via a partner tracking link produces a delivery-log entry with `status: "sent"` and the partner's tracking system shows the registration event.

**Plans:** TBD

Plans:
- [ ] 12-01: `TrackingSettings.destinations.partnerPostback` config shape + model + interface (CRM-09) + Trading Cult DB seed
- [ ] 12-02: `destinations/partner-postback.ts` adapter — GET fetch, `expandMacros()`, `encodeURIComponent`, skip guards (incl. `isFirstPurchase` gate for conversion), delivery log, fire-and-forget wrapper (CRM-07)
- [ ] 12-03: Register adapter + end-to-end integration verify (registration postback + conversion postback + URL-special-char clickid test)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Pre-Work | v1.0 | 2/2 | ✓ Complete | 2026-06-29 |
| 2. Public Leaderboard | v1.0 | 4/4 | ✓ Complete (human-verify pending deploy) | 2026-06-29 |
| 3. Competition System | v1.0 | 4/4 | ✓ Complete (human-verify pending deploy) | 2026-06-29 |
| 4. Affiliate Reporting | v1.1 | 4/4 | ✓ Complete — audit gaps closed by Phase 4.1 | 2026-06-30 |
| 4.1. Affiliate Reporting Bug Fixes (INSERTED) | v1.2 | 1/1 | ✓ Complete (human-verify pending deploy) | 2026-06-30 |
| 5. Daily Profit Display Bug | v1.2 | 1/1 | ✓ Complete (human-verify pending deploy) | 2026-06-30 |
| 6. Funded Queue Ready Badge | v1.2 | 1/1 | ✓ Complete (closed by remote) | 2026-06-30 |
| 7. Used Margin Display | v1.2 | 2/2 | ✓ Complete (human-verify pending deploy) | 2026-06-30 |
| 8. Breach Email Template Vars | v1.2 | 1/1 | ✓ Complete (ops sync + verify pending deploy) | 2026-06-30 |
| 9. PAP Funded Queue State Label | v1.2 | 1/1 | ✓ Complete (human-verify pending deploy) | 2026-07-01 |
| 10. Capture & Persist | v1.3 | 3/4 | ✓ Complete (code; 10-04 human-verify pending deploy) | 2026-07-01 |
| 11. Wire Emits + Dedup | v1.3 | 3/3 | ✓ Complete (code; live event-firing verify post-deploy) | 2026-07-01 |
| 12. partnerPostback Adapter + Config + Verify | v1.3 | 0/3 | Not started | - |
