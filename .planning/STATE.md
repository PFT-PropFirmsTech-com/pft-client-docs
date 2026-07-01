# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state instead of a misleading "Program Not Assigned" warning.
**Current focus:** v1.3 CRM Partner Tracking (S2S postbacks) — defining requirements.

## Current Position

Phase: Not started (v1.3 — defining requirements)
Plan: —
Status: v1.3 milestone started — research in progress, then requirements → roadmap. Phase numbering continues from 9 (v1.3 starts at Phase 10).
Last activity: 2026-07-01 — v1.3 CRM Partner Tracking milestone started (ticket cmqt52jdb001dny0kknkou9x0)

Milestone scope decisions (2026-07-01): S2S postbacks first (pull API deferred); minimal one-off for the Trading Cult partner (not a generic multi-partner surface); research-first.

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) — Phases 4.1, 5, 6, 7, 8, 9

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4 — Purchase Report card + admin CSV cols + single-POST network) + v1.2: Phase 4.1 (CSV tier-sum + Direct Commission Rate header), Phase 5 (Daily P&L ~$20 for TC account 13535/2026-06-18), Phase 6 (sidebar dot on TC funded queue — remote shape: `eligibleManualApproval` via /funded-queue/stats), Phase 7 (MarginUsageCard on TC funded account, client + admin routes), Phase 8 (ops sync script per brand XPIPS + Funding Optimal, then verify breach email body), Phase 9 (admin queue-state label vs NSF diagnostic payment 6a2c08b1ab4caef5631099a2 → "Awaiting KYC"; then DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT).

## Performance Metrics

**Velocity:**
- Total plans completed: 28 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9])
- Average duration: ~5 min
- Note: 2 of v1.2's plans were closed-by-remote (Phase 6 fully, Phase 4.1 partial) — near-zero execution time.

**By Milestone:**

| Milestone | Phases | Plans | Total | Avg/Plan |
|-----------|--------|-------|-------|----------|
| v1.0 | 1-3 | 10 | ~50 min | ~5 min |
| v1.1 | 4 | 4 | ~28 min | ~7 min |
| v1.2 | 4.1, 5-9 | 7 | ~40 min | ~5 min |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table (v1.2 rows appended at completion). Locked conventions carried forward:

- Defer-to-remote (`feedback_rebase_when_remote_already_fixed.md`): fetch origin/main-2026 before editing; if a bug is already closed by a different shape, fast-forward and don't overwrite. Applied twice in v1.2.
- Post-deploy human-verify is DEFERRED for every phase until main-2026 deploys (project-wide convention since Phase 04-04).
- All three repos (pft-backend, pft-dashboard, pft-rule-checker) commit to `main-2026`; `main` is deprecated. `git branch --show-current` before every commit.

### Pending Todos

1. **Setup free trial Program docs for Funding Optimal** (ops, no code — see `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Unblocked, next actionable task. Ticket cmnx4jvry0001mr0kezmxcnnv.

### Blockers/Concerns

- Everything shipped this session (v1.0 → v1.2) awaits the next main-2026 deploy before any human-verify can run. This is the single gating event for closing all the open verify checklists + their tickets.

## Session Continuity

Last session: 2026-07-01
Stopped at: v1.2 milestone complete — archived (milestones/v1.2-ROADMAP.md + v1.2-REQUIREMENTS.md), REQUIREMENTS.md deleted, git tag v1.2. Phase 9 code pushed (pft-backend 5de7c9f8, pft-dashboard 5dea14f2).
Resume file: None. Next action: `/gsd:new-milestone` — OR knock out the Funding Optimal free-trial ops todo (no code, no deploy needed).
