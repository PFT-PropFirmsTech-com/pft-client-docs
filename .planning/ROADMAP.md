# Roadmap: PFT WhiteLabel — Leaderboard & Competitions

## Milestones

- ✅ **v1.0 Leaderboard & Competitions** — Phases 1-3, 10 plans (shipped 2026-06-29) → [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Affiliate Reporting** — Phase 4, 4 plans (shipped 2026-06-30, ad-hoc) → [archive](milestones/v1.1-ROADMAP.md)

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

### Active (ad-hoc, post-v1.1)

### Phase 5: Daily Profit Display Bug — Account 13535

**Goal:** Fix the dashboard Daily P&L Calendar widget so it reports correct daily profit per account/day. Root cause (per RESEARCH.md): `mergedFromDeals` in `pft-dashboard/src/hooks/useTradingDashboardData.ts` silently drops orphan CLOSE deals (close whose matching open isn't in the loaded buffer). Account 13535 / 2026-06-18: dropped -$34.69 orphan → reports $54.85 ("+$55") instead of true $20.16. Fix: emit a synthetic closed row for orphan closes.

**Depends on:** Phase 4 (none functionally, but sequenced after v1.1 ship)
**Plans:** 1 plan

Plans:
- [ ] 05-01-PLAN.md — Patch mergedFromDeals orphan-close branch + add regression test

**Details:**
- Source ticket: [cmquy9bqo005pny0kw6j0lr71](https://portal.propfirmstech.com/admin/tickets/cmquy9bqo005pny0kw6j0lr71) (Trading Cult, URGENT)
- Reported: dashboard +$55 for 2026-06-18; MT5 confirms $9.90 closed PnL same day (Daily Reports view + History view both)
- Client profile: https://dash.tradingcult.com/admin/users/6a324ed5cebf12f7fc6a6dff/programs/69d4ba4c2e185783d4eca5ed/account/13535
- Bug-debug phase, not feature work — likely candidates: `tradehistories` daily aggregation, `dailysnapshots` timezone bucketing, swap/commission inclusion, hedge-leg double-count

### Phase 6: Funded Queue — KYC+Contract-Approved Badge

**Goal:** Add a red-dot notification badge on the admin sidebar (Program Management → Funded Queue) that lights up when there are pending funded-queue entries where BOTH KYC AND contract are already approved — i.e. accounts truly ready for admin "Force Process" review. Helps the ops team triage the queue without scanning every row.

**Depends on:** Phase 4 (none functionally — sequential)
**Plans:** 0 plans (run `/gsd:plan-phase 6` to break down)

Plans:
- [ ] TBD — run `/gsd:plan-phase 6`

**Details:**
- Source ticket: [cmqt9rtjl002rny0kkawu1c6y](https://portal.propfirmstech.com/admin/tickets/cmqt9rtjl002rny0kkawu1c6y) (Trading Cult, HIGH)
- Trigger logic: any `FundedProgressionQueue` entry with status=pending AND KYC=approved AND contract=approved → badge on.
- UI: sidebar dot on the existing Funded Queue nav item (Program Management section), brand-themed.
- Likely scope: small read endpoint (`GET /funded-queue/ready-count` or extend existing) + dashboard hook + sidebar badge component.

### Phase 7: Used Margin Display — Client + Backoffice

**Goal:** Surface a margin-usage metric (% of account balance) on both the client portal account view and the admin/backoffice account view, with a graphical representation. Tracks "all-in" / high-risk trading behaviour — one of the most common breach causes per Trading Cult.

**Depends on:** Phase 4 (none functionally — sequential)
**Plans:** 0 plans (run `/gsd:plan-phase 7` to break down)

Plans:
- [ ] TBD — run `/gsd:plan-phase 7`

**Details:**
- Source ticket: [cmovizb320007qs0k0fue250p](https://portal.propfirmstech.com/admin/tickets/cmovizb320007qs0k0fue250p) (Trading Cult, BACKLOG)
- Two metrics requested: (a) current margin used / equity %, (b) HIGHEST margin used % during account life (peak risk).
- Bob already pointed Trading Cult at an existing risk-insights section (screenshot) — also need to enable that view for the backoffice role.
- Scope: backend margin-usage tracking (live + historical peak from MT5 deals/positions), client account view widget, admin account view widget, role-permission enable.
- Larger phase — likely 3-4 plans (data source, backend endpoint, client UI, admin UI).

### Next milestone

(None yet — run `/gsd:new-milestone` to define v1.2 / v2.0.)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Pre-Work | v1.0 | 2/2 | ✓ Complete | 2026-06-29 |
| 2. Public Leaderboard | v1.0 | 4/4 | ✓ Complete (human-verify pending deploy) | 2026-06-29 |
| 3. Competition System | v1.0 | 4/4 | ✓ Complete (human-verify pending deploy) | 2026-06-29 |
| 4. Affiliate Reporting | v1.1 | 4/4 | ✓ Complete (human-verify pending deploy) | 2026-06-30 |
| 5. Daily Profit Display Bug | ad-hoc | 0/1 | Planned | — |
| 6. Funded Queue Ready Badge | ad-hoc | 0/0 | Not planned | — |
| 7. Used Margin Display | ad-hoc | 0/0 | Not planned | — |
