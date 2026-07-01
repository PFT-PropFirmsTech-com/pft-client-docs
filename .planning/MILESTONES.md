# Milestones

## v1.2 — Ticket Fixes + PAP Queue Label (Shipped: 2026-07-01)

**Delivered:** Six ticket-driven support/ops fixes swept together after v1.1 — affiliate CSV multi-tier commission sum, Daily P&L orphan-close undercount, funded-queue ready badge, used-margin display, breach-email reason vars — capped by the headline v1.2 feature: the PAP funded-queue state label that replaces the misleading "Program Not Assigned" warning on admin payment rows with the real compliance-gate state.

**Phases completed:** 4.1, 5, 6, 7, 8, 9 (7 plans total)

**Key accomplishments:**

- **Phase 9 (PAP Funded Queue State Label, PAP-01):** `getPaymentHistoryAdmin` now batch-joins `FundedProgressionQueue` by `paymentId` and attaches `fundedDeferral` per row; admin PaymentsTable + PaymentDetailsContainer render "Awaiting KYC / Awaiting Contract / Awaiting KYC & Contract / In Funded Queue" and hide Retry/Mark Done on compliance-gated rows, preserving the amber "Program Not Assigned" + buttons for genuine failures. Sparse `{ paymentId: 1 }` index added. (pft-backend `5de7c9f8`, pft-dashboard `5dea14f2`)
- **Phase 8 (Breach Email Vars):** seeded `rule_breached` body now interpolates `{ban_reason}` + 4 breach fields, variables registry grew 3→20, plus a per-brand `sync-rule-breached-template-vars` migration that union-merges without clobbering admin customisations. Closes XPIPS + Funding Optimal "why was I breached?" tickets. (pft-backend)
- **Phase 7 (Used Margin Display):** rule-checker `accountrulestates` gained `currentMarginUsedPercent` + `peakMarginUsedPercent` (Math.max ratchet beside peak-drawdown); new `MarginUsageCard` renders on both client + admin account routes from live socket (current) + accountrulestates (peak). (pft-rule-checker `abede27`, pft-backend `1a7aa01e`, pft-dashboard `1acd03c6`)
- **Phase 5 (Daily P&L Bug):** `mergedFromDeals` emits a synthetic closed row for orphan close deals (open outside the loaded buffer), fixing Daily P&L Calendar undercounting on Trading Cult account 13535. (pft-dashboard)
- **Phase 4.1 (Affiliate CSV Bug):** admin Payment History CSV Commission Amount switched from tier-1-only to SUM across all MLM tiers + "Direct Commission Rate (%)" header (Bug 1, `60e9b37c`); sibling Bugs 2+3 closed by remote hotfixes that landed mid-flight. (pft-dashboard)
- **Phase 6 (Funded Queue Ready Badge):** fully closed by remote — another dev shipped the sidebar red-dot for the same ticket between plan-write and plan-execute; both repos fast-forwarded, zero new commits (defer-to-remote convention). (pft-backend `c8340316`, pft-dashboard `73810f47`)

**Stats:**
- 3 repos touched (pft-backend, pft-dashboard, pft-rule-checker)
- 6 phases, 7 plans; 2 plans closed-by-remote (Phase 6 fully, Phase 4.1 partial) via the `feedback_rebase_when_remote_already_fixed.md` convention
- 2 days (2026-06-30 → 2026-07-01)

**Git ranges (per repo, all on main-2026):** pft-dashboard `60e9b37c` → `5dea14f2`; pft-backend `c8340316` → `5de7c9f8`; pft-rule-checker `abede27` (Phase 7).

**Caveat:** All code-complete + pushed to main-2026; live human-verify DEFERRED across every phase pending the next deploy (Phase 9 diagnostic: NSF payment `6a2c08b1ab4caef5631099a2` → expect "Awaiting KYC"). DEV ticket `cmqbzq6vc007ds50k008tr3du` flips WAITING_CLIENT post-verify.

**What's next:** Deploy main-2026 → run the batched human-verify checklists (v1.0 through v1.2). Then v1.3 candidates — PAP-02 (Retry relabel) + PAP-03 (queue reason staleness); winner emails + competition history + auto prize disbursement (carried from v1.0); Funding Optimal free-trial program setup (ops, no code — pending todo).

---

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
