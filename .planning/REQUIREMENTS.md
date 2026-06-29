# Requirements: PFT WhiteLabel — Leaderboard & Competitions

**Defined:** 2026-06-28
**Core Value:** Funded traders rank and compete in monthly prize pool competitions

## v1 Requirements

### Pre-Work

- [ ] **PRE-01**: `Math.random()` floatingPL replaced with deterministic `0` fallback in MT5 fallback path so rankings don't shuffle during MT5 downtime
- [ ] **PRE-02**: `leaderboardOptOut: Boolean` field added to User model with default `false` and migration applied

### Public Leaderboard

- [ ] **LB-01**: Anonymous user can view public leaderboard page showing top funded traders with masked PII (first name + last initial, no email)
- [ ] **LB-02**: Logged-in trader can view full leaderboard with account size, % growth, trading days, and profit factor visible
- [ ] **LB-03**: Trader can toggle opt-out from their profile settings to hide themselves from leaderboard and competitions
- [ ] **LB-04**: Public leaderboard supports filtering by account size and challenge type, and sorting by % growth, win rate, and profit factor

### Competition System

- [ ] **COMP-01**: Admin can create a competition with name, start date, end date, and prize pool breakdown (1st/2nd/3rd place amounts)
- [ ] **COMP-02**: Admin can enable/disable a competition and edit it while in draft status
- [ ] **COMP-03**: All funded traders who have not opted out are automatically enrolled when a competition goes active
- [ ] **COMP-04**: Public competition page shows prize pool, countdown timer, and live rankings sorted by % profit growth from competition start
- [ ] **COMP-05**: Competition close determines top 3 winners by final % profit growth, records winner snapshot, and surfaces results in admin view
- [ ] **COMP-06**: Admin can view competition results (winners, final standings) after competition ends

## v2 Requirements

### Notifications & Social

- **NOTIF-01**: Winners receive email notification when competition ends with their prize amount
- **NOTIF-02**: Traders receive notification when a new competition goes active

### Enhanced Competition

- **COMP-07**: Competition history page showing past competitions and their winners
- **COMP-08**: Hall of fame — all-time leaderboard of competition winners across brands

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated prize disbursement | Complex payout flow; admin manual for v1 |
| Real-time WebSocket leaderboard | Cron refresh sufficient; adds infra complexity |
| Per-competition ranking metric selection | % profit growth locked for fairness |
| Mobile app leaderboard | Web-first |
| Cross-brand competition (traders from multiple brands compete) | Per-brand DB isolation; v2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRE-01 | Phase 1 | Complete |
| PRE-02 | Phase 1 | Complete |
| LB-01 | Phase 2 | Code complete (human-verify) |
| LB-02 | Phase 2 | Code complete (human-verify) |
| LB-03 | Phase 2 | Code complete (human-verify) |
| LB-04 | Phase 2 | Code complete (human-verify) |
| COMP-01 | Phase 3 | Code complete (human-verify) |
| COMP-02 | Phase 3 | Code complete (human-verify) |
| COMP-03 | Phase 3 | Code complete (human-verify) |
| COMP-04 | Phase 3 | Code complete (human-verify) |
| COMP-05 | Phase 3 | Code complete (human-verify) |
| COMP-06 | Phase 3 | Code complete (human-verify) |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-28*
*Last updated: 2026-06-28 — roadmap created, traceability complete*
