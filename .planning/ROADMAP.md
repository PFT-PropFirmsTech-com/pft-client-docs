# Roadmap: PFT WhiteLabel — Leaderboard & Competitions

## Milestones

- ✅ **v1.0 Leaderboard & Competitions** — Phases 1-3, 10 plans (shipped 2026-06-29) → [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Affiliate Reporting** — Phase 4, 4 plans (shipped 2026-06-30, ad-hoc) → [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Ticket Fixes + PAP Queue Label** — Phases 4.1–9, 7 plans (shipped 2026-07-01, human-verify pending deploy) → [archive](milestones/v1.2-ROADMAP.md)

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
