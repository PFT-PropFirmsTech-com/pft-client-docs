# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-03)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. External affiliate partners attribute registrations and conversions via S2S postbacks. Every purchase-flow outcome (not just completed) reaches Klaviyo.
**Current focus:** v1.4 Klaviyo purchase-coverage fix — Phase 13 (Purchase-Failure Tracking Wiring), Plan 01 of 3 complete (foundation util + adapter fix), Plans 02/03 (call-site wiring) remain.

## Current Position

Phase: 13 of 13 (Purchase-Failure Tracking Wiring)
Plan: 01 of 3
Status: In progress
Last activity: 2026-07-03 — Completed 13-01-PLAN.md (emitTrackingPurchaseFailed util + purchaseFailed helper/Klaviyo adapter fix)

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [██████████] 100% (9/9 plans, code-complete + code-level verified) · v1.4 [███░░░░░░░] 33% (1/3)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT) + v1.3: Phase 10 (10-04, full capture→persist path) + Phase 12 (SC5, live Trading Cult postback — ALSO needs Trading Cult's real registrationUrl/conversionUrl configured via `PUT /api/tracking/settings`, not just a deploy).

## Performance Metrics

**Velocity:**
- Total plans completed: 34 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9], v1.3: 9 [10-01/02/03, 11-01/02/03, 12-01/02/03], v1.4: 1 [13-01])
- Average duration: ~6 min

**By Milestone:**

| Milestone | Phases | Plans | Total | Avg/Plan |
|-----------|--------|-------|-------|----------|
| v1.0 | 1-3 | 10 | ~50 min | ~5 min |
| v1.1 | 4 | 4 | ~28 min | ~7 min |
| v1.2 | 4.1, 5-9 | 7 | ~40 min | ~5 min |
| v1.3 | 10-12 | 9 | ~2h50m | ~8 min (incl. research + 3 verify cycles) |
| v1.4 | 13 | TBD | 12 min so far (1 plan) | ~12 min |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. Locked conventions carried forward into v1.4:

- Defer-to-remote (`feedback_rebase_when_remote_already_fixed.md`): fetch origin/main-2026 before editing; if a bug/feature is already closed by a different shape, fast-forward and don't overwrite. Applied 4× across v1.2+v1.3.
- Post-deploy human-verify is DEFERRED for every phase until main-2026 deploys (project-wide convention since Phase 04-04).
- All repos (pft-backend, pft-dashboard, pft-rule-checker) commit to `main-2026`; `main` is deprecated. `git branch --show-current` before every commit.
- Reuse the existing `purchase_failed` event (do not invent `purchase_expired`); differentiate via `errorCode`/`reason` property — locked by v1.4 research, avoids event-taxonomy bloat.
- v1.4 must NOT fire `purchase_failed` from the two internal PAP dedup/supersede `status: "expired"` bookkeeping writes in `payment.service.modular.ts` — those are concurrency guards, not real customer failures.
- Full backend `tsc` OOMs on this machine at both default heap and 8GB (`reference_backend_tsc_oom.md`) — use scoped `--skipLibCheck` on specific files, or a `files`-scoped tsconfig override with `incremental:false` for verification harnesses.

### Pending Todos

1. **Setup free trial Program docs for Funding Optimal** (ops, no code — `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Ticket cmnx4jvry0001mr0kezmxcnnv. BLOCKED on client's Google Ads campaign ending.
2. **v1.5 Margin history enhancement** (per-trade max margin in trade history + daily Used-Margin HWM series, client+admin — `.planning/todos/pending/2026-07-01-v1.4-per-trade-margin-and-daily-hwm.md`). Ticket cmovizb320007qs0k0fue250p (Trading Cult follow-up on shipped Phase 7). Queued as a v1.5 candidate after v1.4 ships.

### Blockers/Concerns

- Every shipped milestone (v1.0 → v1.3) awaits the next main-2026 deploy before any human-verify can run — the single gating event for closing all open verify checklists + their tickets.
- v1.3 specifically also needs Trading Cult's real `registrationUrl`/`conversionUrl` set via `PUT /api/tracking/settings` post-deploy before Phase 12 SC5 can be verified — an external partner-spec dependency, not just a deploy.
- v1.4 Phase 13 implementation must verify (not assume) whether Paysafe routes through `callback.service.ts`'s generic handler or has its own webhook path — flagged by research as a quick grep, not a blocker to starting; still applies to 13-02/13-03.
- `pft-backend/node_modules` was not installed in this working tree (fresh checkout) — `npm install` was run during 13-01 to unblock scoped `tsc` verification. Not a project blocker, just a one-time local-env note for future plans in this repo checkout.

## Session Continuity

Last session: 2026-07-03
Stopped at: Completed 13-01-PLAN.md (emitTrackingPurchaseFailed util + purchaseFailed helper/Klaviyo adapter fix). Plans 13-02/13-03 (call-site wiring) remain.
Resume file: .planning/phases/13-purchase-failure-tracking-wiring/13-02-PLAN.md. Next action: `/gsd:execute-phase 13`.
