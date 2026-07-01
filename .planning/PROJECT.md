# PFT WhiteLabel — Leaderboard & Competitions + Affiliate Reporting + PAP Queue UX

## What This Is

A white-label prop trading platform (pft-dashboard + pft-backend) that lets brands run funded trader challenges. v1.0 added a public funded-trader leaderboard and a monthly competition system. v1.1 added affiliate reporting enhancements (per-purchase commission visibility for affiliates + affiliate columns in admin payment exports). v1.2 (in progress) replaces the misleading "Program Not Assigned" label on PAP funded-leg payments with the real underlying queue state (`Awaiting KYC` / `Awaiting Contract` / `In Funded Queue`) so support stops clicking a dead Retry button.

## Core Value

Funded traders see where they rank and compete in monthly prize-pool competitions (engagement + brand marketing). Affiliates see exactly which purchases earned them which commissions and can reconcile their earnings per tier; admins can reconcile customer purchases against affiliate payouts directly from the Payment History export. Support and back-office staff see the real reason a PAP funded account has not released (compliance gate, not a system failure) instead of a generic "Not Assigned" warning that invites a useless Retry loop.

## Current Milestone: v1.2 PAP Funded Queue State Label

**Goal:** Replace the misleading "Program Not Assigned" warning on PAP funded-leg payment rows with the actual `fundedprogressionqueues` state, so support stops mistaking a KYC compliance gate for a technical failure.

**Target features:**
- Real queue-state label ("Awaiting KYC" / "Awaiting Contract" / "In Funded Queue") when a `fundedprogressionqueues` entry exists in `pending`/`processing` for the payment's user + funded programId (Item 1 from DEV cmqbzq6vc007ds50k008tr3du)

**Explicitly deferred (not in v1.2):**
- Retry button suppress/relabel (Item 2) — depends on final label taxonomy from Item 1
- Queue `reason` field staleness fix (Item 3) — cosmetic backend-only, low priority

## Requirements

### Validated

- ✓ Public funded trader leaderboard (anonymous masked preview + richer logged-in stats) — v1.0
- ✓ Trader opt-out from leaderboard/competition visibility — v1.0
- ✓ Monthly competition system with admin-managed prize pools — v1.0
- ✓ Competition ranking by % profit growth (delta from activation baseline) — v1.0
- ✓ Opt-out by default (all funded traders shown, can hide) — v1.0
- ✓ Admin UI to create/manage competitions — v1.0
- ✓ Public competition page per brand (prize pool + countdown + live rankings) — v1.0
- ✓ Leaderboard surfaced across all brands (admin + user nav + Super Admin per-brand toggle) — v1.0
- ✓ Affiliate commission columns in admin Payment History CSV export (rate, amount, currency, user ID, name, email) — v1.1
- ✓ Per-purchase commission visibility for affiliates (Purchase Report card, per-tier tabs, CSV export per tier) — v1.1
- ✓ Bulk-by-orders backend endpoint (POST, admin-gated) — v1.1
- ✓ User-scoped my-commissions backend endpoint (Auth user only, scoped to req.user._id, IDOR-resistant) — v1.1
- ✓ Ticket cmqqchwh Payout-vs-Withdrawal clarification — v1.1 (no code)

<sub>Code-complete + pushed to main-2026 for both v1.0 and v1.1; live human-verify pending the next deploy unlocks both.</sub>

### Active

- [ ] **PAP-01**: Admin payments view shows the actual `fundedprogressionqueues` state ("Awaiting KYC" / "Awaiting Contract" / "In Funded Queue") for PAP funded-leg rows, replacing the misleading generic "Program Not Assigned" warning when a queue entry exists in `pending`/`processing`.

Candidate v1.3 / v2 scope: PAP Retry button suppress/relabel + queue reason staleness (deferred items 2 + 3 from DEV cmqbzq6vc007ds50k008tr3du); winner email notifications + competition history hall of fame + automated prize disbursement (carried from v1.0); broader admin-panel anchor refactor for new-tab/copy-link (DEV ticket cmqztddis); ticket-portal sprint + archive roadmap (Phases 2 & 3 from .planning/feedback notes); JA email localization completion for Trading Cult.

### Out of Scope

- Real-time WebSocket leaderboard updates — cron refresh is sufficient for v1
- Per-competition custom ranking metric — % profit growth locked for all competitions
- Mobile app — web-first
- Multi-tier commission row in CSV export — lowest-tier (tier 1) only, per row; full MLM breakdown can use the new bulk endpoint directly if needed later

## Context

- v1.0: existing admin-only leaderboard already built; added public surface + competition system; ~4,400 LOC across 3 repos
- v1.1: extended affiliate module (already had `getCommissionsByOrderId` per-order endpoint, MLM tiers, AffiliateCommission collection); added one bulk endpoint + one user-scoped endpoint + UI surfaces; ~549 LOC across 2 repos
- Backend: Node.js/TypeScript, MongoDB/Mongoose, MT5 integration
- Frontend: Next.js dashboard (pft-dashboard), per-brand white-label
- All brands deploy from main-2026
- Reference competitors (v1.0): FXIFY, Funding Pips — both have public competition pages
- Source tickets: v1.0 = cmqybawiz007zny0k1wliphj7 (XPIPS); v1.1 = cmqqchwh500bspi0kxw23o2rl (Trading Cult)

## Constraints

- **Tech stack**: Next.js + Node.js/TypeScript + MongoDB — no new DBs
- **Deployment**: main-2026 ships all brands simultaneously
- **MT5**: Leaderboard data comes from precomputed collection (no direct MT5 queries on request path)
- **Auth model**: user-scoped endpoints MUST derive userId from `req.user._id` and never accept an override (post-v1.1 decision; locked)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| % profit growth as ranking metric | Levels playing field across account sizes | ✓ Good — delta from activation baseline |
| Opt-out model (shown by default) | Maximizes leaderboard population, traders can hide | ✓ Good |
| Public preview + full for logged-in | Marketing value (public) + privacy (limited anonymous view) | ✓ Good — names masked for ALL; token unlocks stats only |
| Universal name masking + auth/anon cache buckets | Prevent PII/stat leakage to anonymous viewers | ✓ Good |
| OMIT brandId (per-DB brand separation) | No existing model carries it; reversed the earlier "brandId from day one" note | ✓ Good |
| CompetitionEntry separate collection + CAS close gate | Avoid 16MB BSON limit; prevent double winner determination | ✓ Good |
| Disqualify BANNED/VIOLATED + dedupe-best-per-user at close | Fair winners; top 3 = distinct users; blown accounts can't win | ✓ Good |
| Manual prize disbursement (v1) | Automated payout/MT5 provisioning deferred | — Pending (v2) |
| Bulk export endpoints use POST body, not GET querystring | 2000+ IDs exceed URL length limits at nginx/browser | ✓ Good (v1.1 set the pattern) |
| User-scoped affiliate endpoints: `Auth(userRole.user)` only, never admin/backOffice escalation | IDOR-resistance + correct UX (admins shouldn't see their "own" commissions on a user surface) | ✓ Good — locked, applies to any future user-surface endpoints |
| Lowest-tier (tier 1) commission picked per payment for CSV row | Deterministic single-row-per-payment in CSV; full breakdown still available via bulk endpoint | ✓ Good |
| `skipEnrichment=true` preserved on base payment fetch; commission data joined via separate bulk call | Keeps existing CSV export performance unchanged on hundreds of rows | ✓ Good |
| Commission fetch failure inside export degrades to empty affiliate columns | Never break the existing 19-column export over a downstream failure | ✓ Good |
| `PurchaseReportTable` at module scope (not inside render) | Prevents accidental component remount on every parent render | ✓ Good |
| Ticket replies that ship partial work keep status IN_PROGRESS (not WAITING_CLIENT) | Avoid forcing client to confirm partial work mid-flight | ✓ Good (v1.1 codified this for 04-02) |

## Current State

**Shipped:** v1.0 Leaderboard & Competitions (2026-06-29) + v1.1 Affiliate Reporting (2026-06-30) — both code-complete, pushed to main-2026, live human-verify pending the next deploy (unlocks both).

**Codebase:** ~4,950 LOC added cumulatively across pft-backend, pft-dashboard, pfr-super-admin. Stack unchanged: Next.js + Node/TS + MongoDB; no new deps. Reusable bulk-by-orders pattern (POST body, single `$in` query) established in v1.1 for any future export use case.

**Source tickets:** v1.0 = cmqybawiz007zny0k1wliphj7 (XPIPS, IN_PROGRESS, progress comment posted). v1.1 = cmqqchwh500bspi0kxw23o2rl (Trading Cult, IN_PROGRESS pending deploy; clarification reply posted, final WAITING_CLIENT flip after deploy).

**Open across both milestones (post-deploy):** live human-verify checklists for v1.0 Phases 2 & 3 (anon masking, opt-out timing, competition close, cache isolation) + v1.1 Phase 4 (Purchase Report card visual + Export CSV downloads + Network panel single-POST + showOverview-only scoping + 6 admin CSV cols populated). All deferred until main-2026 deploys.

## Next Milestone Goals

Define via `/gsd:new-milestone`. Candidates:
- v1.2 lightweight: deploy + run all pending human-verify checklists (v1.0 + v1.1), broader admin-panel anchor-link refactor (DEV ticket cmqztddis)
- v2 substantive: winner email notifications + competition history + automated prize disbursement (carried from v1.0)

---
*Last updated: 2026-07-01 after starting v1.2 milestone*
