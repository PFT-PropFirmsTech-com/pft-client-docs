# Requirements: PFT WhiteLabel v1.3 — CRM Partner Tracking (S2S Postbacks)

**Defined:** 2026-07-01
**Core Value:** A Trading Cult affiliate partner can attribute registrations and conversions to their own traffic by passing a `clickid` through our funnel unchanged and receiving S2S postbacks (with clickid + goal + payout) on registration and first sale.

**Source ticket:** cmqt52jdb001dny0kknkou9x0 (Trading Cult Pro)
**Research:** `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/PITFALLS)

## Scope decisions (locked 2026-07-01)

- **S2S postbacks only** — pull API (partner alternative B) deferred.
- **Minimal one-off for the Trading Cult partner** — config-driven per-brand, NOT a generic multi-partner admin UI.
- **Conversion = FTD** — fire the conversion postback once, on the user's first completed purchase (across standard challenge AND PAP funded-leg purchases).
- **Payout value = `usdAmount`** (normalized USD, `currency=USD` always) — guards the known JPY-billed-as-USD bug class.
- **PAP counts as a conversion** — the currently-unwired `pap_payment_completed` path must emit so PAP first-purchases fire.
- Free-trial / free-challenge ($0) = **registration postback only**, never a $0 conversion postback (S2S fraud-filter risk).

## v1.3 Requirements

### Click ID Capture & Persistence

- [ ] **CRM-01**: A partner tracking-link entry (`GET /track?clickid=…`, brand landing domain) captures the arbitrary partner `clickid`, sets it in a first-party cookie, and redirects to the site so the clickid survives to the registration step.
- [ ] **CRM-02**: The partner `clickid` is persisted **unchanged** on the User document at registration (`verifyRegistrationOtp`), so it survives from click → registration.
- [ ] **CRM-03**: The partner `clickid` is persisted on the Payment document at checkout creation, so a later purchase completed via a gateway/webhook callback (where `req = null`, no cookie) can still resolve the clickid.

### Registration Postback

- [ ] **CRM-04**: When a user completes registration, an S2S GET postback fires to the partner's registration URL template with `goal=registration` + the user's `clickid` (no payout). Fires once per user; skipped when the user has no partner `clickid`.

### Conversion Postback

- [ ] **CRM-05**: On a user's **first** completed purchase (FTD — first across standard challenge purchases AND PAP funded-leg purchases), an S2S GET conversion postback fires with `goal=conversion` + `clickid` + `payout=<usdAmount>` + `currency=USD`. Later purchases by the same user do NOT fire again.
- [ ] **CRM-06**: The PAP funded-leg payment-completion path (currently not wired to any conversion webhook) emits the purchase event carrying the partner `clickid` + `usdAmount`, so PAP first-purchases are eligible for the conversion postback.

### Postback Delivery

- [ ] **CRM-07**: A new `partnerPostback` destination adapter sends a GET request built by substituting `{clickid}` / `goal` / `{payout}` macros into the configured URL template (URL-encoded), fire-and-forget with a timeout, bounded retry/backoff on partner 5xx, and a delivery-log record — reusing native `fetch` (no new deps) and the existing `IDestinationAdapter` contract.
- [ ] **CRM-08**: Each postback event (registration, conversion) fires **at most once** per user even under retries / gateway webhook re-delivery — deduped via the existing `TrackingEventLog`, and the legacy dual-dispatch path is audited so it cannot double-fire the same event.

### Configuration

- [ ] **CRM-09**: The partner's registration + conversion postback URL templates live in the per-brand `TrackingSettings.destinations.partnerPostback` config (Trading Cult DB only), with an enable/disable toggle; nothing partner-specific is hardcoded, and no other brand fires postbacks unless configured.

## v1.4 / Future Requirements

Deferred. Tracked, not in this roadmap.

### Partner Tracking

- **CRM-10**: Refund / chargeback reversal postback — fire a `goal=refund` (or negative-payout) postback when a first-purchase is later refunded/charged back (no reversal path exists today; partner commissions currently stand on refunds).
- **CRM-11**: Pull API (partner alternative B) — partner-authenticated endpoint to retrieve clickid / event / status / payout.
- **CRM-12**: Generic multi-partner postback config (admin UI, per-partner templates + goal mappings) — build when a 2nd partner appears.

## Out of Scope (v1.3)

| Feature | Reason |
|---------|--------|
| Pull API | Postbacks satisfy the partner now; API is their alternative, not both (→ CRM-11) |
| Generic multi-partner admin UI | Only one partner today; premature abstraction (→ CRM-12) |
| Refund/chargeback reversal postback | No reversal path exists today; scope + partner contract call (→ CRM-10) |
| Every-purchase conversions | FTD chosen — one conversion per acquired user |
| Reusing the existing `conversionWebhook` adapter | Wrong event map + wrong wire protocol (POST+JSON+HMAC vs GET+macro) — new adapter instead |

## External dependency (non-blocking — config-driven)

Partner's exact postback spec (macro param names beyond `clickid`/`goal`/`payout`, GET confirmation, whether they want an order/transaction id). The adapter is template-driven, so the URL is set at config time in Phase 12 without code changes.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRM-01 | Phase 10 | Pending |
| CRM-02 | Phase 10 | Pending |
| CRM-03 | Phase 10 | Pending |
| CRM-04 | Phase 11 | Pending |
| CRM-05 | Phase 11 | Pending |
| CRM-06 | Phase 11 | Pending |
| CRM-07 | Phase 12 | Pending |
| CRM-08 | Phase 11 | Pending |
| CRM-09 | Phase 12 | Pending |

**Coverage:**
- v1.3 requirements: 9 total
- Mapped to phases: 9 (provisional — roadmapper finalizes)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 after initial definition*
