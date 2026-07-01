# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. External affiliate partners attribute registrations and conversions via S2S postbacks.
**Current focus:** Planning next milestone (v1.3 complete). Candidates: v1.4 margin-history enhancement (queued, research-shaped) or the Funding Optimal free-trial ops todo (blocked on client).

## Current Position

Phase: — (v1.3 milestone complete; no active phase)
Plan: Not started
Status: v1.3 milestone complete — archived, tagged. Ready to plan next milestone via `/gsd:new-milestone`.
Last activity: 2026-07-01 — v1.3 "CRM Partner Tracking (S2S Postbacks)" (Phases 10-12) complete

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [██████████] 100% (9/9 plans, code-complete + code-level verified)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT) + v1.3: Phase 10 (10-04, full capture→persist path) + Phase 12 (SC5, live Trading Cult postback — ALSO needs Trading Cult's real registrationUrl/conversionUrl configured via `PUT /api/tracking/settings`, not just a deploy).

## Performance Metrics

**Velocity:**
- Total plans completed: 33 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9], v1.3: 9 [10-01/02/03, 11-01/02/03, 12-01/02/03])
- Average duration: ~6 min

**By Milestone:**

| Milestone | Phases | Plans | Total | Avg/Plan |
|-----------|--------|-------|-------|----------|
| v1.0 | 1-3 | 10 | ~50 min | ~5 min |
| v1.1 | 4 | 4 | ~28 min | ~7 min |
| v1.2 | 4.1, 5-9 | 7 | ~40 min | ~5 min |
| v1.3 | 10-12 | 9 | ~2h50m | ~8 min (incl. research + 3 verify cycles) |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. Locked conventions carried forward into the next milestone:

- Defer-to-remote (`feedback_rebase_when_remote_already_fixed.md`): fetch origin/main-2026 before editing; if a bug/feature is already closed by a different shape, fast-forward and don't overwrite. Applied 4× across v1.2+v1.3.
- Post-deploy human-verify is DEFERRED for every phase until main-2026 deploys (project-wide convention since Phase 04-04).
- All repos (pft-backend, pft-dashboard, pft-rule-checker) commit to `main-2026`; `main` is deprecated. `git branch --show-current` before every commit.
- New external-partner integrations: build a dedicated destination adapter (mirror `IDestinationAdapter`), don't force-fit an existing one with the wrong wire protocol. Dedup + delivery-log come free from the Tracking dispatcher.
- Full backend `tsc` OOMs on this machine at both default heap and 8GB (`reference_backend_tsc_oom.md`) — use scoped `--skipLibCheck` on specific files, or a `files`-scoped tsconfig override with `incremental:false` for verification harnesses.

### Pending Todos

1. **Setup free trial Program docs for Funding Optimal** (ops, no code — `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Ticket cmnx4jvry0001mr0kezmxcnnv. BLOCKED on client's Google Ads campaign ending.
2. **v1.4 Margin history enhancement** (per-trade max margin in trade history + daily Used-Margin HWM series, client+admin — `.planning/todos/pending/2026-07-01-v1.4-per-trade-margin-and-daily-hwm.md`). Ticket cmovizb320007qs0k0fue250p (Trading Cult follow-up on shipped Phase 7). Ready to start as v1.4 via `/gsd:new-milestone`. Both enhancements; research-first.

### Blockers/Concerns

- Every shipped milestone (v1.0 → v1.3) awaits the next main-2026 deploy before any human-verify can run — the single gating event for closing all open verify checklists + their tickets.
- v1.3 specifically also needs Trading Cult's real `registrationUrl`/`conversionUrl` set via `PUT /api/tracking/settings` post-deploy before Phase 12 SC5 can be verified — an external partner-spec dependency, not just a deploy.

## Session Continuity

Last session: 2026-07-01
Stopped at: v1.3 milestone complete — archived (milestones/v1.3-ROADMAP.md + v1.3-REQUIREMENTS.md), REQUIREMENTS.md deleted, PROJECT.md fully evolved, ROADMAP.md collapsed. Git tag v1.3 pending.
Resume file: None. Next action: `/gsd:new-milestone` for v1.4 — OR knock out the Funding Optimal free-trial ops todo once unblocked.
