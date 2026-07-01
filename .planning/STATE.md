# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state instead of a misleading "Program Not Assigned" warning.
**Current focus:** v1.2 milestone — Phase 9: PAP Funded Queue State Label

## Current Position

Phase: 9 of 9 (PAP Funded Queue State Label)
Plan: 0/1 — ready to plan
Status: v1.2 roadmap created — Phase 9 defined, awaiting plan-phase
Last activity: 2026-07-01 — v1.2 milestone initialized; Phase 9 roadmapped

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · Phase 4.1 [██████████] 100% (1/1) · Phase 5 [██████████] 100% (1/1) · Phase 6 [██████████] 100% (1/1) · Phase 7 [██████████] 100% (2/2) · Phase 8 [██████████] 100% (1/1) · v1.2 Phase 9 [░░░░░░░░░░] 0% (0/1)

**Open post-deploy:** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4 — Purchase Report card + admin CSV cols + single-POST network) + Phase 4.1 (CSV tier-sum + Direct Commission Rate header) + Phase 5 (Daily P&L ~$20 for TC account 13535/2026-06-18) + Phase 6 (sidebar dot on TC funded queue — remote shape: `eligibleManualApproval` field via /funded-queue/stats) + Phase 7 (MarginUsageCard on TC funded account, both client + admin routes) + Phase 8 (ops sync script per brand XPIPS + Funding Optimal, then verify breach email body). All gated on next main-2026 deploy.

## Performance Metrics

**Velocity:**
- Total plans completed: 21 (v1.0: 10, v1.1: 4, Phase 4.1: 1, Phase 5: 1, Phase 6: 1, Phase 7: 2, Phase 8: 1, v1.2: 0)
- Average duration: ~5 min
- Total execution time: <2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 (1-3) | 10 | ~50 min | ~5 min |
| v1.1 (4) | 4 | ~28 min | ~7 min |
| ad-hoc (4.1-8) | 7 | ~35 min | ~5 min |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. Recent decisions affecting Phase 9:

- PAP funded queue gate (reference_pap_funded_queue_gate.md): "Program Not Assigned" on PAP funded legs = queue held on KYC/contract gate, NOT a system failure; Retry only bumps `payment.retryCount` (useless); correct action is approve pending KYC → auto-release. Phase 9 surfaces this in the UI.
- Phase 9 scope is PAP funded-leg rows ONLY — non-PAP rows get no queue lookup and no layout change.
- Retry/Mark Done suppression (Item 2 from DEV cmqbzq6vc007ds50k008tr3du) included in Phase 9 success criteria; button relabel deferred to v1.3 (depends on label taxonomy locked by Phase 9).
- PAP-02 (Retry suppress/relabel) and PAP-03 (queue reason staleness) explicitly deferred to v1.3 — not in scope here.

### Pending Todos

1. Setup free trial Program docs for Funding Optimal (ops, no code — see `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Deferred until after v1.2 Phase 9.

v1.2 Phase 9 is the active task — run `/gsd:plan-phase 9`.

### Blockers/Concerns

- Phase 9 backend join: two valid shapes — enrich existing payment response OR separate lookup endpoint. Plan-phase must pick one and document the decision.
- All prior phases (4.1 through 8) await the next main-2026 deploy before human-verify can run.

## Session Continuity

Last session: 2026-07-01
Stopped at: v1.2 roadmap created — ROADMAP.md + STATE.md written, REQUIREMENTS.md traceability confirmed (PAP-01 → Phase 9 already present).
Resume file: None — next action is `/gsd:plan-phase 9`.
