# Requirements: PFT WhiteLabel v1.5 — Klaviyo Language & Purchase Enrichment

**Defined:** 2026-07-03
**Core Value:** Trading Cult can segment Klaviyo by client language (JP campaigns) and by what was actually purchased (challenge details on purchase events).

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Language Property

- [x] **KLAV-05**: Every Klaviyo-bound event that carries an email also sets the client's language as a Klaviyo profile property, so JP clients are segmentable (client's stated need; location acceptable as proxy per their follow-up)
- [x] **KLAV-09**: The language value is derived from real user data with a defined source order (e.g. stored user locale/language → phone region → address country), and the `Language: ja` custom property already seen on one live profile is confirmed code-driven or superseded by this implementation — not left as stale one-off data

### Purchase Enrichment

- [ ] **KLAV-06**: Purchase events (`purchase_completed`, `pap_payment_completed`, `purchase_failed`) carry the program context as Klaviyo properties: challenge name, challenge type, account size, platform (MT4/MT5/cTrader), and phase (where applicable)
- [ ] **KLAV-10**: The same purchase events carry the commerce context: order ID, currency, add-ons (if any), and discount/coupon code (if used)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Klaviyo / Tracking Follow-ups

- **KLAV-07**: PAP funded-leg failure tracking — audit whether any `pap_payment_failed` equivalent exists across the 3 PAP gateway call sites; currently 5 completion call sites exist with zero failure equivalents (internal gap from v1.4 research, not client-asked)
- **KLAV-08**: Deeper Paysafe status-mapping verification (routing already confirmed in v1.4 — flows through generic callback)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Frontend language/locale UI (language picker, stored user preference setting) | Client's need is segmentation data in Klaviyo, not a product i18n feature; JA email localization is a separate tracked effort (feat/email-qa-and-ja-localization) |
| New Klaviyo events for enrichment | Enrichment adds properties to EXISTING events — no event-taxonomy change (locked v1.4 convention) |
| Raw gateway/PII-adjacent strings as properties | Locked v1.4 convention — normalized closed vocabularies only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| KLAV-05 | Phase 14 | Complete (code-verified; live Klaviyo check post-deploy) |
| KLAV-09 | Phase 14 | Complete (sweep re-run: no second code path; adapter sole owner) |
| KLAV-06 | Phase 15 | Pending |
| KLAV-10 | Phase 15 | Pending |

**Coverage:**
- v1 requirements: 4 total
- Mapped to phases: 4/4 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-03 after roadmap creation (Phases 14-15)*
