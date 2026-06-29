# Milestones

## v1.0 — Leaderboard & Competitions (Shipped: 2026-06-29)

**Delivered:** Public funded-trader leaderboard (masked PII, opt-out, filters/sort) + monthly prize-pool competition system (admin CRUD, auto-enrollment, public pages with countdown, CAS-gated winner determination) for all white-label brands.

**Phases completed:** 1-3 (10 plans total)

**Key accomplishments:**
- Public `/leaderboard` — anonymous masked view + richer logged-in stats from one endpoint; universal "John D." masking, email never exposed; auth/anon cache bucketing prevents stat leakage
- Trader opt-out toggle (Settings) + query-time exclusion from leaderboard and competitions
- Funded-only leaderboard with account-size/challenge-type filters and % growth / win rate / profit factor sorting
- Full competition system: admin create/edit/enable-disable (draft-gated), auto-enrollment of funded non-opted-out accounts with baseline snapshot, public competition pages (prize pool + countdown + live delta rankings)
- CAS-gated competition close (atomic active→closing) with BANNED/VIOLATED disqualification + dedupe-to-best-account-per-user (top 3 = distinct users) + admin results view
- Leaderboard surfaced across all brands (admin nav + user nav + Super Admin per-brand toggle) — was previously hardcoded to a single brand

**Stats:**
- ~43 files across 3 repos (~4,400 LOC: pft-backend ~1,516, pft-dashboard ~2,864, pfr-super-admin)
- 3 phases, 10 plans
- 2 days (2026-06-28 → 2026-06-29)

**Git range:** pft-backend `fix(01-01)` (364dadc0) → `feat(03-04)` (2e914996); pft-dashboard `feat(02-03)` (b96474dd) → `feat(03-04)` (1d1ececc). All on main-2026.

**Caveat:** Code-complete + pushed; live human-verify checklists (Phases 2 & 3) pending a main-2026 deploy.

**What's next:** v2 candidates — winner email notifications, competition history + hall of fame, automated prize disbursement.

---
