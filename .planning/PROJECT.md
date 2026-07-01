# PFT WhiteLabel — Leaderboard & Competitions + Affiliate Reporting + PAP Queue UX

## What This Is

A white-label prop trading platform (pft-dashboard + pft-backend) that lets brands run funded trader challenges. v1.0 added a public funded-trader leaderboard and a monthly competition system. v1.1 added affiliate reporting enhancements (per-purchase commission visibility for affiliates + affiliate columns in admin payment exports). v1.2 (in progress) replaces the misleading "Program Not Assigned" label on PAP funded-leg payments with the real underlying queue state (`Awaiting KYC` / `Awaiting Contract` / `In Funded Queue`) so support stops clicking a dead Retry button.

## Core Value

Funded traders see where they rank and compete in monthly prize-pool competitions (engagement + brand marketing). Affiliates see exactly which purchases earned them which commissions and can reconcile their earnings per tier; admins can reconcile customer purchases against affiliate payouts directly from the Payment History export. Support and back-office staff see the real reason a PAP funded account has not released (compliance gate, not a system failure) instead of a generic "Not Assigned" warning that invites a useless Retry loop.

## Current Milestone: None — v1.2 shipped 2026-07-01, awaiting next

v1.2 "Ticket Fixes + PAP Queue Label" (Phases 4.1–9, 7 plans) is code-complete + pushed to main-2026; live human-verify deferred pending the next deploy. Full detail: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

Run `/gsd:new-milestone` to define the next one — candidates in **Next Milestone Goals** below.

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
- ✓ Admin PAP funded-leg payment rows show the real `fundedprogressionqueues` state (Awaiting KYC / Awaiting Contract / In Funded Queue), Retry/Mark Done hidden on gated rows, amber "Program Not Assigned" preserved for genuine failures (PAP-01) — v1.2 Phase 9
- ✓ Affiliate CSV Commission Amount sums across all MLM tiers + "Direct Commission Rate (%)" header — v1.2 Phase 4.1
- ✓ Daily P&L Calendar counts orphan-close deals (synthetic closed row) — v1.2 Phase 5
- ✓ Admin sidebar ready-badge on funded queue (KYC+contract approved) — v1.2 Phase 6 (closed by remote)
- ✓ Used-margin display (current + all-time peak %) on client + admin account views — v1.2 Phase 7
- ✓ Breach emails interpolate the rule-checker's exact reason (`{ban_reason}` + fields), variables registry 3→20 + per-brand sync migration — v1.2 Phase 8

<sub>Code-complete + pushed to main-2026 for v1.0, v1.1, and v1.2; live human-verify pending the next deploy unlocks all three.</sub>

### Active

(None — v1.2 shipped. Define the next milestone via `/gsd:new-milestone`.)

Candidate v1.3 / v2 scope: **PAP-02** Retry button suppress/relabel + **PAP-03** queue reason staleness (deferred items 2 + 3 from DEV cmqbzq6vc007ds50k008tr3du, now unblocked — label taxonomy locked by Phase 9); winner email notifications + competition history hall of fame + automated prize disbursement (carried from v1.0); broader admin-panel anchor refactor for new-tab/copy-link (DEV ticket cmqztddis); ticket-portal sprint + archive roadmap (Phases 2 & 3 from .planning/feedback notes); JA email localization completion for Trading Cult; **Funding Optimal free-trial program setup** (ops, no code — pending todo, ticket cmnx4jvry0001mr0kezmxcnnv).

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
| Admin queue-state label gates on `fundedDeferral` presence + status, NOT `programAssigned` | Diagnostic payment shows `programAssigned=true` while queue is pending — the field is unreliable | ✓ Good (v1.2 Phase 9) |
| Mirror the proven user-facing `getPaymentHistory` batch join into the admin path (vs new endpoint) | Reuses a shipped pattern; `PaymentData.fundedDeferral` type already declared — no type change | ✓ Good (v1.2 Phase 9) |
| Margin denominator = `margin/equity*100` (NOT MT5 `marginLevel`); peak is all-time monotonic | Correct "% of account at risk" semantics; peak survives payout/daily/EOD resets | ✓ Good (v1.2 Phase 7) |
| Breach-email body overwrite gated on strict equality with `OLD_RULE_BREACHED_BODY`; variables union-merged | Preserves admin customisations; never shrinks an existing registry | ✓ Good (v1.2 Phase 8) |
| Defer-to-remote: fetch origin/main-2026 before editing; if bug already closed by a different shape, fast-forward | Prevents overwriting a teammate's deployed hotfix (Phase 6 fully, Phase 4.1 Bugs 2+3) | ✓ Good — locked convention (`feedback_rebase_when_remote_already_fixed.md`) |

## Current State

**Shipped:** v1.0 Leaderboard & Competitions (2026-06-29) + v1.1 Affiliate Reporting (2026-06-30) + v1.2 Ticket Fixes + PAP Queue Label (2026-07-01) — all code-complete, pushed to main-2026, live human-verify pending the next deploy (unlocks all three).

**Codebase:** ~4,950 LOC (v1.0/v1.1) plus v1.2's cross-repo ticket fixes across pft-backend, pft-dashboard, pft-rule-checker (7 plans, 2 closed-by-remote). Stack unchanged: Next.js + Node/TS + MongoDB; no new deps. Reusable patterns established: bulk-by-orders POST `$in` (v1.1); `paymentId`-keyed queue batch join mirrored into admin (v1.2).

**Source tickets:** v1.0 = cmqybawiz007zny0k1wliphj7 (XPIPS). v1.1 = cmqqchwh500bspi0kxw23o2rl (Trading Cult). v1.2 = DEV cmqbzq6vc007ds50k008tr3du (PAP-01/Phase 9) + Trading Cult/XPIPS/FO ticket fixes (Phases 4.1–8). All flip WAITING_CLIENT after deploy + verify.

**Open (post-deploy human-verify, all gated on the next main-2026 deploy):** v1.0 Phases 2 & 3 (anon masking, opt-out, competition close, cache isolation); v1.1 Phase 4 (Purchase Report card + admin CSV cols + single-POST); v1.2 Phases 4.1–9 (CSV tier-sum; daily P&L TC acct 13535; funded-queue badge; margin card client+admin; breach-email body per brand XPIPS+FO; PAP queue label NSF payment 6a2c08b1ab4caef5631099a2 → "Awaiting KYC").

## Next Milestone Goals

Define via `/gsd:new-milestone`. Candidates:
- **Ops (no code, actionable now):** Funding Optimal free-trial program setup (ticket cmnx4jvry0001mr0kezmxcnnv — pending todo).
- **v1.3 PAP follow-ups (unblocked by Phase 9):** PAP-02 Retry button suppress/relabel + PAP-03 queue reason staleness.
- **Post-deploy:** run all batched human-verify checklists (v1.0 → v1.2), then admin-panel anchor-link refactor (DEV cmqztddis).
- **v2 substantive:** winner email notifications + competition history + automated prize disbursement (carried from v1.0).

---
*Last updated: 2026-07-01 after v1.2 milestone completion*
