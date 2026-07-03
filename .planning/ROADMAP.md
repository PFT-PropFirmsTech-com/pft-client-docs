# Roadmap: PFT WhiteLabel — Leaderboard & Competitions

## Milestones

- ✅ **v1.0 Leaderboard & Competitions** — Phases 1-3, 10 plans (shipped 2026-06-29) → [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Affiliate Reporting** — Phase 4, 4 plans (shipped 2026-06-30, ad-hoc) → [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Ticket Fixes + PAP Queue Label** — Phases 4.1–9, 7 plans (shipped 2026-07-01, human-verify pending deploy) → [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 CRM Partner Tracking (S2S Postbacks)** — Phases 10-12, 9 plans (shipped 2026-07-01, live-verify pending deploy + partner config) → [archive](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 Klaviyo Purchase-Coverage Fix** — Phase 13, 3 plans (shipped 2026-07-03, live Klaviyo verify pending deploy) → [archive](milestones/v1.4-ROADMAP.md)
- 🚧 **v1.5 Klaviyo Language & Purchase Enrichment** — Phases 14-15 (in progress)

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

<details>
<summary>✅ v1.3 CRM Partner Tracking (S2S Postbacks) (Phases 10-12) — SHIPPED 2026-07-01</summary>

A Trading Cult affiliate partner can attribute registrations and conversions to their own traffic via a partner `clickid` captured at landing, persisted through signup + purchase (survives `req=null` gateway callbacks), firing S2S GET postbacks on registration and first sale (FTD). All code-complete + pushed to main-2026, code-level verified (behavioral harness + whole-chain tsc); live human-verify deferred pending deploy + Trading Cult's real postback URLs.

- [x] Phase 10: Capture & Persist (3/4 — 10-04 deferred) — `/api/tracking/track?clickid=…` → cookie → persisted on User (`d2992553`) + Payment attribution incl. PAP (`4a079169`).
- [x] Phase 11: Wire Emits + Dedup (3/3) — signupCompleted/purchaseCompleted wired at every real completion path incl. PAP + fanbasis (`8e2f7509`, `644ccd39`, `982ba9a1`); JPY-as-USD bug fixed; stable-eventId dedup audited (`8540f5a`).
- [x] Phase 12: partnerPostback Adapter + Config + Verify (3/3) — new GET adapter w/ macro substitution + FTD gate (`719e591b`), per-brand config (`702b312f`), 10/10 behavioral harness pass.

Full detail: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

<details>
<summary>✅ v1.4 Klaviyo Purchase-Coverage Fix (Phase 13) — SHIPPED 2026-07-03</summary>

- [x] Phase 13: Purchase-Failure Tracking Wiring (3/3 plans) — `purchase_failed` (existing zero-caller scaffold) wired at cron sweep + Stripe/FanBasis/PayPal/crypto+Paysafe callback; Klaviyo adapter promotes `reason`/`error_code`; stable `purchase_failed:<paymentId>` dedup; internal PAP supersede-writes silent. Verifier 5/5; 4 live-Klaviyo checks post-deploy. Source ticket cmqtl47g4004zny0kz54mmz0z (Trading Cult).

Full detail: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)

</details>

### Phase 13.1: Password Length DOS Fix (INSERTED)

**Goal:** Server-side max password length enforced on registration (all brands) before bcrypt hashing, closing external DOS report.
**Depends on:** Phase 13
**Requirements:** SEC-01 (ad hoc — external report umer@barhamsec.com, target app.xpips.com /auth/register)
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 13.1 to break down)

**Details:**
[To be added during planning]

### 🚧 v1.5 Klaviyo Language & Purchase Enrichment (In Progress)

**Milestone Goal:** Trading Cult can segment Klaviyo by client language (JP campaigns) and by what was actually purchased (challenge details on purchase events). Source ticket: cmqtl47g4004zny0kz54mmz0z (Trading Cult Pro) — 2 further asks from the same v1.4 ticket.

Extends the existing Tracking module (dispatcher, event catalog, `klaviyo.ts` `buildProperties()`) with new profile/event properties. No new event names — properties added to existing events only. Two independent data paths (user-profile-derived language vs. payment/program-join purchase context) run as parallel phases with no functional dependency between them, only a shared-file touch in `tracking.interface.ts`/`klaviyo.ts`.

#### Phase 14: Klaviyo Language Property

**Goal**: Every Klaviyo-bound event carrying an email also carries the client's language as a profile/event property, derived from real user data via a defined fallback order, and the existing stray `Language: ja` profile property is confirmed superseded (not left as stale one-off data).
**Depends on**: Nothing (extends existing Tracking framework from v1.3/v1.4; independent of Phase 15)
**Requirements**: KLAV-05, KLAV-09
**Success Criteria** (what must be TRUE):
  1. A user with a stored language/locale preference produces a Klaviyo event/profile property reflecting that value (not hardcoded, not English-only)
  2. A user with no stored language preference but a phone region or address country still produces a best-effort language/locale property, per a defined source-order (stored locale → phone region → address country)
  3. A user with none of the above sources present emits with the property omitted (never a placeholder/guessed default that misrepresents real data)
  4. The derivation source order is applied consistently across every Klaviyo-bound event that carries an email (not just purchase events)
  5. The pre-existing `Language: ja` value seen on one live Klaviyo profile is confirmed either produced by this implementation going forward, or documented as stale/superseded pre-existing data (not a mystery second code path)

**Plans:** 1 plan
Plans:
- [ ] 14-01-PLAN.md — deriveUserLanguage util (stored locale → phone region → address country, omit-when-unknown) + central enrichUserData wiring + Klaviyo profile/event Language property + KLAV-09 stray-property finding doc

#### Phase 15: Klaviyo Purchase Enrichment

**Goal**: `purchase_completed`, `pap_payment_completed`, and `purchase_failed` events carry full program and commerce context as Klaviyo properties, so Trading Cult can segment by what was actually purchased.
**Depends on**: Nothing (extends the same 3 existing events' call sites from v1.3/v1.4; independent of Phase 14)
**Requirements**: KLAV-06, KLAV-10
**Success Criteria** (what must be TRUE):
  1. A completed standard purchase's Klaviyo event carries challenge name, challenge type, account size, and platform (MT4/MT5/cTrader) as properties
  2. A completed PAP funded-leg purchase's Klaviyo event carries the same program-context properties as a standard purchase, including phase where applicable
  3. A failed/expired/cancelled purchase's Klaviyo event (wired in v1.4) also carries the same program-context properties, not just the existing `reason`/`error_code`
  4. Every one of the 3 purchase events carries commerce context: order ID, currency, and — when present — add-ons and the discount/coupon code actually used (never a raw gateway string, and never left populated as a stale value from an unrelated purchase)
  5. All new properties are normalized closed-vocabulary or ID/string values only — no raw gateway/PII-adjacent strings, and no new Klaviyo event/metric names introduced

Plans: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 4.1 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 13.1 → 14 → 15

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
| 12. partnerPostback Adapter + Config + Verify | v1.3 | 3/3 | ✓ Complete (code-verified; SC5 live-partner test post-deploy) | 2026-07-01 |
| 13. Purchase-Failure Tracking Wiring | v1.4 | 3/3 | ✓ Complete (code-verified 5/5; live Klaviyo verify pending deploy) | 2026-07-03 |
| 13.1. Password Length DOS Fix (INSERTED) | urgent | 0/TBD | Not started | - |
| 14. Klaviyo Language Property | v1.5 | 0/TBD | Not started | - |
| 15. Klaviyo Purchase Enrichment | v1.5 | 0/TBD | Not started | - |

_Next: `/gsd:plan-phase 14` (or 15 — no dependency order between them)._
