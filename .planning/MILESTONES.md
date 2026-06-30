# Milestones

## v1.1 — Affiliate Reporting (Shipped: 2026-06-30)

**Delivered:** Three affiliate reporting enhancements requested by Trading Cult (ticket cmqqchwh500bspi0kxw23o2rl) — affiliate commission columns in the admin Payment History CSV export, a clarification reply on Payout vs Withdrawal History, and a new per-purchase Purchase Report card with per-tier tabs and CSV export on the affiliate's own Overview page.

**Phases completed:** 4 (1 phase, 4 plans — ad-hoc)

**Key accomplishments:**
- New backend `POST /affiliates/admin/commissions/bulk-by-orders` (admin/backOffice/sales) — one `$in` MongoDB query keyed by orderId, unblocks any bulk export use case
- New backend `GET /affiliates/my-commissions` — Auth `userRole.user` ONLY, scoped to `req.user._id` (IDOR-resistant), batched Payment join via `Promise.all`, surfaces `payment.mt5Login`
- Admin Payment History CSV grew 19 → 25 columns (Commission Rate %, Commission Amount, Commission Currency, Affiliate User ID, Affiliate Name, Affiliate Email) via a single bulk POST — `skipEnrichment=true` preserved on the base fetch, graceful degrade if the commission fetch fails
- New "Purchase Report" card on Affiliate Overview below "Your Referrals" — per-tier tabs for MLM/Hybrid (Tier 1/2/3) or flat table for Standard, 8 cols + Export CSV per tier, `PurchaseReportTable` at module scope (no inside-render component), single non-conditional `useGetMyCommissions` hook keyed on the active tab
- Ticket cmqqchwh clarification reply posted explaining Payout History == Withdrawal History (same `useGetWithdrawals` hook, same `AffiliateWithdrawal` collection — distinction is purely UI placement); status held IN_PROGRESS until items 1 + 3 deploy

**Stats:**
- 8 files across 2 repos (~549 LOC: pft-backend ~191, pft-dashboard ~358)
- 1 phase, 4 plans, 7 atomic code commits
- Same day (2026-06-30, ~28 min execution wall time)

**Git range:** pft-backend `feat(affiliate) e136636c` → `63f7d44a`; pft-dashboard `feat(payments-export) 97783483` → `feat(affiliate-report) 35337a41`. All on main-2026.

**Caveat:** Code-complete + pushed; live human-verify checklist (6 items on TradingCult — 22 real commission rows across tiers 1/2/3) deferred until next main-2026 deploy. Final WAITING_CLIENT flip on ticket cmqqchwh after deploy.

**What's next:** v1.2 candidates — sprint/archive ticket-portal roadmap (Phases 2 & 3), broader anchor-link refactor across admin panel (DEV ticket cmqztddis), v1.0 deploy + run pending Phase 2/3 human-verify checklists.

---

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
