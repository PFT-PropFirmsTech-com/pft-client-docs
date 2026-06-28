# Roadmap: PFT WhiteLabel — Leaderboard & Competitions

## Overview

This milestone adds a public-facing funded trader leaderboard and a monthly competition system to the existing admin-only leaderboard infrastructure. Phase 1 fixes two pre-conditions (a non-deterministic ranking bug and a missing schema field) that must land before anything goes public. Phase 2 opens the leaderboard to the internet with masked PII, opt-out control, and filtering. Phase 3 builds the full competition system on top of the leaderboard foundation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Pre-Work** - Fix Math.random() floatingPL bug and add leaderboardOptOut field to User model
- [ ] **Phase 2: Public Leaderboard** - Open leaderboard to anonymous and logged-in traders with PII masking and opt-out
- [ ] **Phase 3: Competition System** - Admin competition management, auto-enrollment, public competition pages, and winner determination

## Phase Details

### Phase 1: Pre-Work
**Goal**: Data integrity and schema prerequisites are in place so public rankings are deterministic and opt-out is enforceable
**Depends on**: Nothing (first phase)
**Requirements**: PRE-01, PRE-02
**Success Criteria** (what must be TRUE):
  1. Leaderboard rankings do not shuffle during MT5 downtime (floatingPL returns 0, not Math.random())
  2. User model has `leaderboardOptOut: Boolean` field with `default: false` and migration has applied to all existing users
  3. Querying `{ leaderboardOptOut: false }` correctly excludes only users who have opted out
**Plans**: 2 plans

Plans:
- [ ] 01-01-fix-floating-pl.md — Replace Math.random() floatingPL with deterministic 0 in leaderboard.service.ts (PRE-01)
- [ ] 01-02-add-leaderboard-opt-out.md — Add leaderboardOptOut field to User schema and TUser interface (PRE-02)

### Phase 2: Public Leaderboard
**Goal**: Any visitor can view a public leaderboard with masked trader identities; logged-in traders see full stats and can opt out
**Depends on**: Phase 1
**Requirements**: LB-01, LB-02, LB-03, LB-04
**Success Criteria** (what must be TRUE):
  1. An anonymous visitor can open the public leaderboard URL and see top funded traders with first name + last initial only (no email, no account details)
  2. A logged-in trader sees account size, % growth, trading days, and profit factor in the full leaderboard view
  3. A trader can toggle "Hide me from leaderboard" in profile settings and immediately disappear from the public leaderboard
  4. The public leaderboard supports filtering by account size and challenge type, and sorting by % growth, win rate, and profit factor
**Plans**: 4 plans

Plans:
- [ ] 02-01-public-endpoint-masked-dto.md — Backend GET /leaderboard/public with toPublicDTO() masking, funded-only + opt-out filters, optional-token richer stats (LB-01/LB-02 backend)
- [ ] 02-02-public-page-and-components.md — Public /leaderboard page + slim components; masked anon view and richer logged-in view from one endpoint (LB-01, LB-02)
- [ ] 02-03-opt-out-toggle.md — "Hide me from leaderboard" toggle in Settings via existing PATCH /users/:id (LB-03)
- [ ] 02-04-filters-and-sorting.md — Account-size/challenge-type filters + sort by % growth/win rate/profit factor on public page (LB-04)

### Phase 3: Competition System
**Goal**: Admins can run monthly prize pool competitions that auto-enroll eligible traders; public competition pages show live rankings and results
**Depends on**: Phase 2 (leaderboardOptOut field from LB-03 required for enrollment logic)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06
**Success Criteria** (what must be TRUE):
  1. Admin can create a competition with name, start/end dates, and 1st/2nd/3rd prize amounts, and the competition appears in draft status before going active
  2. When a competition goes active, all funded traders who have not opted out are automatically enrolled
  3. A public competition page shows the prize pool, a live countdown timer, and trader rankings sorted by % profit growth from the competition start date
  4. When a competition ends, the top 3 winners are determined by final % profit growth, the winner snapshot is recorded, and admin can view final standings and results
  5. Admin can enable/disable a competition and edit it while it remains in draft status
**Plans**: TBD

Plans:
- [ ] 03-01: Competition and CompetitionEntry models + admin create/edit/enable-disable UI (COMP-01, COMP-02)
- [ ] 03-02: Auto-enrollment cron/trigger on competition activation + baseline snapshot (COMP-03)
- [ ] 03-03: Public competition page — prize pool, countdown, live rankings (COMP-04)
- [ ] 03-04: Competition close — winner determination, CAS close pattern, results surface in admin (COMP-05, COMP-06)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Pre-Work | 2/2 | ✓ Complete | 2026-06-29 |
| 2. Public Leaderboard | 0/4 | Planned | - |
| 3. Competition System | 0/4 | Not started | - |
