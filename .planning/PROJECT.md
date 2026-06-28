# PFT WhiteLabel — Leaderboard & Competitions

## What This Is

A white-label prop trading platform (pft-dashboard + pft-backend) that lets brands run funded trader challenges. This milestone adds a public-facing funded trader leaderboard and a monthly competition system — giving traders visibility and brands a marketing / engagement tool.

## Core Value

Funded traders can see where they rank and compete in monthly prize pool competitions, driving engagement and brand differentiation.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Public funded trader leaderboard (anonymous preview + full view for logged-in)
- [ ] Trader opt-out from leaderboard visibility
- [ ] Monthly competition system with admin-managed prize pools
- [ ] Competition ranking by % profit growth
- [ ] Opt-out by default (all funded traders shown, can hide)
- [ ] Admin UI to create/manage competitions
- [ ] Public competition page per brand

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
| % profit growth as ranking metric | Levels playing field across account sizes | — Pending |
| Opt-out model (shown by default) | Maximizes leaderboard population, traders can hide | — Pending |
| Public preview + full for logged-in | Marketing value (public) + privacy (limited anonymous view) | — Pending |

---
*Last updated: 2026-06-28 — Milestone v1.0 started*
