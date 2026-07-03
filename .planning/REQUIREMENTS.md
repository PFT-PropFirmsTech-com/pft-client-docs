# Requirements: PFT WhiteLabel v1.4 — Klaviyo Purchase-Coverage Fix

**Defined:** 2026-07-03
**Core Value:** Trading Cult can see every real purchase outcome (not just completed) in Klaviyo, so failed/expired attempts feed marketing segments same as completions do.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Purchase Failure Tracking

- [x] **KLAV-01**: Every real customer-facing failed/expired/cancelled payment fires the existing `purchase_failed` tracking event so it reaches Klaviyo, matching the coverage `purchase_completed` already has (cron expiry job, Stripe, FanBasis, PayPal, NOWPayments/crypto call sites)
- [x] **KLAV-02**: The `purchase_failed` event carries a reason/error-code property visible in Klaviyo (adapter's `buildProperties()` must promote `errorCode`/`reason`, not drop it)
- [x] **KLAV-03**: The `purchase_failed` event uses a stable, retry-safe eventId per payment (mirrors `purchase:<paymentId>` pattern) so a resent gateway webhook doesn't double-fire the event
- [x] **KLAV-04**: Internal dedup/race-guard status flips (e.g. the two non-customer-facing `expired` writes in `payment.service.modular.ts` that clean up duplicate/superseded PAP payment docs) never fire `purchase_failed` — no false "purchase failed" events for customers whose purchase actually succeeded

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Klaviyo Follow-ups (same source ticket cmqtl47g4004zny0kz54mmz0z)

- **KLAV-05**: Client language (or geo-location as proxy) sent as a Klaviyo profile/event property for JP segmentation — verify whether the `Language: ja` custom property already seen on one profile is code-driven or stale/one-off
- **KLAV-06**: Purchase event enriched with challenge name, challenge type, account size, platform (MT4/MT5/cTrader), phase, add-ons, order ID, currency, discount code for marketing segmentation
- **KLAV-07**: PAP funded-leg failure tracking — audit whether any `pap_payment_failed` equivalent exists across the 3 PAP gateway call sites (fanbasis, stripe, callback); currently 5 completion call sites exist with zero failure equivalents
- **KLAV-08**: Confirm Paysafe webhook routing and status mapping before wiring `purchase_failed` into that gateway (flagged unverified by architecture research)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Separate `purchase_expired` event (distinct from `purchase_failed`) | Normalizing expired/cancelled/failed into one existing `purchase_failed` event + a `reason` property avoids Klaviyo event-taxonomy bloat and matches how gateways already normalize their own statuses into one Payment.status enum |
| New tracking event catalog / dispatcher / adapter architecture | `purchase_failed` is already fully built (catalog, toggles, Klaviyo mapping, typed helper) — this milestone only wires existing call sites, no framework change needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| KLAV-01 | Phase 13 | Complete (code-verified; live Klaviyo check post-deploy) |
| KLAV-02 | Phase 13 | Complete (code-verified; live Klaviyo check post-deploy) |
| KLAV-03 | Phase 13 | Complete (code-verified; redelivery check post-deploy) |
| KLAV-04 | Phase 13 | Complete (code-verified; PAP-traffic check post-deploy) |

**Coverage:**
- v1 requirements: 4 total
- Mapped to phases: 4/4 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-03 after roadmap creation (Phase 13 covers all 4 v1 requirements)*
