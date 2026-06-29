# PFT WhiteLabel — Leaderboard & Competitions

## What This Is

A white-label prop trading platform (pft-dashboard + pft-backend) that lets brands run funded trader challenges. This milestone adds a public-facing funded trader leaderboard and a monthly competition system — giving traders visibility and brands a marketing / engagement tool.

## Core Value

Funded traders can see where they rank and compete in monthly prize pool competitions, driving engagement and brand differentiation.

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

<sub>Code-complete + pushed to main-2026; live human-verify pending deploy.</sub>

### Active

(None — v1.0 shipped. Define next milestone via `/gsd:new-milestone`.)

Candidate v2 scope: winner email notifications, competition history + hall of fame, automated prize disbursement.

### Out of Scope

- Real-time WebSocket leaderboard updates — cron refresh is sufficient for v1
- Per-competition custom ranking metric — % profit growth locked for all competitions
- Mobile app — web-first

## Context

- Existing admin-only leaderboard already built (Leaderboard collection, cron precompute, filters/sorting)
- Backend: Node.js/TypeScript, MongoDB/Mongoose, MT5 integration
- Frontend: Next.js dashboard (pft-dashboard), per-brand white-label
- All brands deploy from main-2026
- Reference competitors: FXIFY, Funding Pips — both have public competition pages
- Ticket: cmqybawiz007zny0k1wliphj7 (XPIPS, PM voice message 2026-06-28)

## Constraints

- **Tech stack**: Next.js + Node.js/TypeScript + MongoDB — no new DBs
- **Deployment**: main-2026 ships all brands simultaneously
- **MT5**: Leaderboard data comes from precomputed collection (no direct MT5 queries on request path)

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

## Current State

**Shipped:** v1.0 Leaderboard & Competitions (2026-06-29) — code-complete, pushed to main-2026, live human-verify pending deploy.

**Codebase:** ~4,400 LOC added across pft-backend (Competition + public Leaderboard modules, cron), pft-dashboard (public /leaderboard + /competitions pages, admin competition UI, opt-out toggle, nav), pfr-super-admin (route/permission seeds). Stack unchanged: Next.js + Node/TS + MongoDB; no new deps.

**Source ticket:** cmqybawiz007zny0k1wliphj7 (XPIPS) — status IN_PROGRESS, progress comment posted.

## Next Milestone Goals

Define via `/gsd:new-milestone`. Candidates: winner email notifications (NOTIF-01/02), competition history + hall of fame (COMP-07/08), automated prize disbursement.

---
*Last updated: 2026-06-29 after v1.0 milestone*
