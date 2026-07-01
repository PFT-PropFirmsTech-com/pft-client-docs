# PFT WhiteLabel — Leaderboard & Competitions + Affiliate Reporting + PAP Queue UX + CRM Partner Tracking

## What This Is

A white-label prop trading platform (pft-dashboard + pft-backend) that lets brands run funded trader challenges. v1.0 added a public funded-trader leaderboard and a monthly competition system. v1.1 added affiliate reporting enhancements (per-purchase commission visibility for affiliates + affiliate columns in admin payment exports). v1.2 replaced the misleading "Program Not Assigned" label on PAP funded-leg payments with the real underlying queue state, plus 5 ticket-driven fixes. v1.3 lets an external affiliate partner (Trading Cult) attribute registrations and first-sales to their own tracking links via S2S postbacks (clickid → registration → conversion), extending the existing Tracking/destinations dispatch framework with a new partner-facing adapter.

## Core Value

Funded traders see where they rank and compete in monthly prize-pool competitions (engagement + brand marketing). Affiliates see exactly which purchases earned them which commissions and can reconcile their earnings per tier; admins can reconcile customer purchases against affiliate payouts directly from the Payment History export. Support and back-office staff see the real reason a PAP funded account has not released (compliance gate, not a system failure) instead of a generic "Not Assigned" warning that invites a useless Retry loop. External affiliate partners can prove their traffic converts — a `clickid` survives our funnel unchanged and the partner gets an S2S signal the moment it does.

## Current Milestone: None — v1.3 shipped 2026-07-01, awaiting next

v1.3 "CRM Partner Tracking (S2S Postbacks)" (Phases 10-12, 9 plans) is code-complete + code-level verified, pushed to main-2026; live human-verify deferred pending the next deploy AND Trading Cult's real postback URLs (external dependency). Full detail: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

Run `/gsd:new-milestone` to define the next one — candidates in **Next Milestone Goals** below (v1.4 margin-history enhancement is already queued and researched-shape).

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
- ✓ Partner `clickid` captured at `/api/tracking/track`, persisted unchanged on User + Payment (survives `req=null` gateway callbacks) — v1.3 Phase 10
- ✓ `signupCompleted`/`purchaseCompleted` tracking events wired at every real completion path incl. PAP + fanbasis, with retry-safe stable eventIds — v1.3 Phase 11
- ✓ FTD signal (`isFirstPurchase`) on every purchase event without suppressing shared destinations (Meta/GA4/Klaviyo still get every purchase) — v1.3 Phase 11
- ✓ New `partnerPostback` GET adapter — macro substitution (`{clickid}`/`{goal}`/`{payout}`), encode-once, FTD-gated conversion send, per-brand config, disabled by default — v1.3 Phase 12

<sub>Code-complete + pushed to main-2026 for v1.0 through v1.3; live human-verify pending the next deploy unlocks all four (v1.3 additionally needs Trading Cult's real postback URLs configured post-deploy).</sub>

### Active

(None — v1.3 shipped. Define the next milestone via `/gsd:new-milestone`.)

Candidate v1.4 / v2 scope: **v1.4 margin-history enhancement** — per-trade max used margin in trade history + daily Used-Margin High-Water-Mark series, client+admin (ticket cmovizb320007qs0k0fue250p, Trading Cult follow-up on shipped Phase 7, both enhancements in scope — see `.planning/todos/pending/2026-07-01-v1.4-per-trade-margin-and-daily-hwm.md`); **CRM-10/11/12** refund-reversal postback + pull API + generic multi-partner config (v1.3 follow-ups, deferred until a 2nd partner needs them); **PAP-02** Retry button suppress/relabel + **PAP-03** queue reason staleness (deferred items 2 + 3 from DEV cmqbzq6vc007ds50k008tr3du, unblocked since Phase 9); winner email notifications + competition history hall of fame + automated prize disbursement (carried from v1.0); broader admin-panel anchor refactor for new-tab/copy-link (DEV ticket cmqztddis); ticket-portal sprint + archive roadmap (Phases 2 & 3 from .planning/feedback notes); JA email localization completion for Trading Cult; **Funding Optimal free-trial program setup** (ops, no code — pending todo, ticket cmnx4jvry0001mr0kezmxcnnv, blocked on client's Google Ads campaign ending).

### Out of Scope

- Real-time WebSocket leaderboard updates — cron refresh is sufficient for v1
- Per-competition custom ranking metric — % profit growth locked for all competitions
- Mobile app — web-first
- Multi-tier commission row in CSV export — lowest-tier (tier 1) only, per row; full MLM breakdown can use the new bulk endpoint directly if needed later

## Context

- v1.0: existing admin-only leaderboard already built; added public surface + competition system; ~4,400 LOC across 3 repos
- v1.1: extended affiliate module (already had `getCommissionsByOrderId` per-order endpoint, MLM tiers, AffiliateCommission collection); added one bulk endpoint + one user-scoped endpoint + UI surfaces; ~549 LOC across 2 repos
- v1.3: extended the existing Tracking/destinations dispatch framework (already had meta-capi/ga4/klaviyo/conversionWebhook adapters + dedup + delivery-log) with a new partner-facing GET adapter; discovered 2 "wired" tracking helpers (`signupCompleted`/`purchaseCompleted`) had zero real callers; ~535 LOC across 2 repos
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
| `partnerClickId` persisted on BOTH User doc AND Payment `attribution` | Purchase-completion paths run with `req=null` (gateway/webhook callbacks) — no cookie available there; the Payment doc makes it resolvable server-side | ✓ Good (v1.3 Phase 10) |
| FTD = `isFirstPurchase` flag on every purchase event, NOT event suppression | `purchase_completed`/`pap_payment_completed` are shared multi-destination events (Meta/GA4/Klaviyo need every purchase); the once-per-user conversion gate lives in the partner adapter instead | ✓ Good (v1.3 Phase 11) |
| New `partnerPostback` adapter instead of reusing `conversionWebhook` | Wrong wire protocol (POST/JSON/HMAC vs required GET/macro) + wrong event map | ✓ Good (v1.3 Phase 12) |
| Stable eventIds (`signup:<userId>`, `purchase:<paymentId>`, `pap:<paymentId>`) passed explicitly to every emit | Default `deterministicEventId` is minute-bucketed — insufficient for gateway-webhook retries arriving minutes later | ✓ Good (v1.3 Phase 11) |
| Minimal one-off config for Trading Cult (`TrackingSettings.destinations.partnerPostback`), not a generic multi-partner UI | Only one partner today; build reusable only when a 2nd partner appears | ✓ Good — locked (v1.3), applies to any future single-partner integration |

## Current State

**Shipped:** v1.0 Leaderboard & Competitions (2026-06-29) + v1.1 Affiliate Reporting (2026-06-30) + v1.2 Ticket Fixes + PAP Queue Label (2026-07-01) + v1.3 CRM Partner Tracking (2026-07-01) — all code-complete, pushed to main-2026, live human-verify pending the next deploy (unlocks all four; v1.3 additionally needs Trading Cult's real postback URLs configured post-deploy).

**Codebase:** ~4,950 LOC (v1.0/v1.1) plus v1.2's cross-repo ticket fixes (7 plans) plus v1.3's partner-tracking extension (~535 LOC, 9 plans across pft-backend + pft-dashboard). Stack unchanged: Next.js + Node/TS + MongoDB; no new deps across any milestone. Reusable patterns established: bulk-by-orders POST `$in` (v1.1); `paymentId`-keyed queue batch join mirrored into admin (v1.2); new destination-adapter pattern for external partner integrations, dedup/delivery-log inherited free from the dispatcher (v1.3).

**Source tickets:** v1.0 = cmqybawiz007zny0k1wliphj7 (XPIPS). v1.1 = cmqqchwh500bspi0kxw23o2rl (Trading Cult). v1.2 = DEV cmqbzq6vc007ds50k008tr3du (PAP-01/Phase 9) + Trading Cult/XPIPS/FO ticket fixes (Phases 4.1–8). v1.3 = cmqt52jdb001dny0kknkou9x0 (Trading Cult Pro). All flip WAITING_CLIENT after deploy + verify.

**Open (post-deploy human-verify, all gated on the next main-2026 deploy):** v1.0 Phases 2 & 3 (anon masking, opt-out, competition close, cache isolation); v1.1 Phase 4 (Purchase Report card + admin CSV cols + single-POST); v1.2 Phases 4.1–9 (CSV tier-sum; daily P&L TC acct 13535; funded-queue badge; margin card client+admin; breach-email body per brand XPIPS+FO; PAP queue label NSF payment 6a2c08b1ab4caef5631099a2 → "Awaiting KYC"); v1.3 Phase 10 (10-04, full capture→persist path) + Phase 12 (SC5, live Trading Cult postback — ALSO needs Trading Cult's real registrationUrl/conversionUrl set via `PUT /api/tracking/settings`, not just a deploy).

## Next Milestone Goals

Define via `/gsd:new-milestone`. Candidates:
- **v1.4 Margin history enhancement (queued, research-shaped):** per-trade max used margin in the dashboard trade history + a daily Used-Margin High-Water-Mark series, client + admin — Trading Cult follow-up on the shipped Phase 7 MarginUsageCard (ticket cmovizb320007qs0k0fue250p, client confirmed Phase 7 works + requested this 2026-07-01). Both enhancements in scope; research-first (per-trade margin capture in the rule-checker is the open question). See `.planning/todos/pending/2026-07-01-v1.4-per-trade-margin-and-daily-hwm.md`.
- **v1.3 follow-ups (deferred by design):** CRM-10 refund/chargeback reversal postback, CRM-11 pull API, CRM-12 generic multi-partner config — build when a 2nd partner needs them.
- **Ops (no code, blocked on client):** Funding Optimal free-trial program setup (ticket cmnx4jvry0001mr0kezmxcnnv — pending todo, waiting on client's Google Ads campaign to end).
- **PAP follow-ups (unblocked since Phase 9):** PAP-02 Retry button suppress/relabel + PAP-03 queue reason staleness.
- **Post-deploy:** run all batched human-verify checklists (v1.0 → v1.3), configure Trading Cult's partnerPostback URLs, then admin-panel anchor-link refactor (DEV cmqztddis).
- **v2 substantive:** winner email notifications + competition history + automated prize disbursement (carried from v1.0).

---
*Last updated: 2026-07-01 after v1.3 CRM Partner Tracking milestone completion*
