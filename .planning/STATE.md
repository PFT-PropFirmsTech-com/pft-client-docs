# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-03)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. External affiliate partners attribute registrations and conversions via S2S postbacks. Every purchase-flow outcome (not just completed) reaches Klaviyo, enriched with language and program/commerce context.
**Current focus:** v1.5 Klaviyo Language & Purchase Enrichment (ticket cmqtl47g4004zny0kz54mmz0z) — roadmap created, ready to plan Phase 14 or 15.

## Current Position

Phase: 14 of 15 (Klaviyo Language Property) — ready to plan; Phase 15 (Purchase Enrichment) has no dependency on Phase 14 and can be planned/executed in either order
Plan: — (not yet planned)
Status: Roadmap created, ready to plan
Last activity: 2026-07-03 — v1.5 ROADMAP.md + REQUIREMENTS.md traceability written (Phases 14-15, 4/4 v1 requirements mapped, 0 orphans)

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [██████████] 100% (9/9 plans, code-complete + code-level verified) · v1.4 [██████████] 100% (3/3, code-complete + goal-verified 5/5) · v1.5 [░░░░░░░░░░] 0% (0/0 plans — not yet planned)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT) + v1.3: Phase 10 (10-04, full capture→persist path) + Phase 12 (SC5, live Trading Cult postback — ALSO needs Trading Cult's real registrationUrl/conversionUrl configured via `PUT /api/tracking/settings`, not just a deploy) + v1.4: Phase 13 (4 checks — cron-expired event in Klaviyo, Stripe failure w/ reason, redelivery no-dup, PAP supersede zero-noise).

## Performance Metrics

**Velocity:**
- Total plans completed: 36 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9], v1.3: 9 [10-01/02/03, 11-01/02/03, 12-01/02/03], v1.4: 3 [13-01, 13-02, 13-03])
- Average duration: ~6 min

**By Milestone:**

| Milestone | Phases | Plans | Total | Avg/Plan |
|-----------|--------|-------|-------|----------|
| v1.0 | 1-3 | 10 | ~50 min | ~5 min |
| v1.1 | 4 | 4 | ~28 min | ~7 min |
| v1.2 | 4.1, 5-9 | 7 | ~40 min | ~5 min |
| v1.3 | 10-12 | 9 | ~2h50m | ~8 min (incl. research + 3 verify cycles) |
| v1.4 | 13 | 3 | ~28 min | ~9 min |
| v1.5 | 14-15 | TBD | — | — |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. Locked conventions carried forward into the next milestone:

- Defer-to-remote (`feedback_rebase_when_remote_already_fixed.md`): fetch origin/main-2026 before editing; if a bug/feature is already closed by a different shape, fast-forward and don't overwrite. Applied 4× across v1.2+v1.3.
- Post-deploy human-verify is DEFERRED for every phase until main-2026 deploys (project-wide convention since Phase 04-04).
- All repos (pft-backend, pft-dashboard, pft-rule-checker) commit to `main-2026`; `main` is deprecated. `git branch --show-current` before every commit.
- Payment-status tracking emits ONLY at explicit gateway/cron call sites, never via model hook or status-keyed query (locked v1.4 — internal PAP supersede bulk-writes must stay silent).
- Normalized errorCode vocabulary for third-party tracking (checkout_expired/card_declined/gateway_failed/cancelled), never raw gateway strings (locked v1.4).
- v1.5: properties added to EXISTING events only (no new Klaviyo event/metric names); normalized values only (no raw gateway/PII strings); emits stay at explicit call sites — extends the v1.4 conventions to the two new property clusters (language, purchase enrichment).
- Full backend `tsc` OOMs on this machine at both default heap and 8GB (`reference_backend_tsc_oom.md`) — use scoped `--skipLibCheck` on specific files, or a `files`-scoped tsconfig override with `incremental:false` for verification harnesses.

### Pending Todos

1. **Setup free trial Program docs for Funding Optimal** (ops, no code — `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Ticket cmnx4jvry0001mr0kezmxcnnv. BLOCKED on client's Google Ads campaign ending.
2. **Margin history enhancement** (per-trade max margin in trade history + daily Used-Margin HWM series, client+admin — `.planning/todos/pending/2026-07-01-v1.4-per-trade-margin-and-daily-hwm.md`). Ticket cmovizb320007qs0k0fue250p (Trading Cult follow-up on shipped Phase 7). Queued as a v1.6/v2 candidate after v1.5 ships.

### Blockers/Concerns

- Every shipped milestone (v1.0 → v1.4) awaits the next main-2026 deploy before any human-verify can run — the single gating event for closing all open verify checklists + their tickets.
- v1.3 specifically also needs Trading Cult's real `registrationUrl`/`conversionUrl` set via `PUT /api/tracking/settings` post-deploy before Phase 12 SC5 can be verified — an external partner-spec dependency, not just a deploy.
- v1.5 has no dedicated research refresh — v1.4's `.planning/research/` (ARCHITECTURE/FEATURES/PITFALLS/STACK/SUMMARY) still describes the Tracking module accurately (adapters, dispatcher, event catalog, `klaviyo.ts buildProperties()`) and was used directly as roadmap context. Confirmed during roadmap creation: `preferredLanguage`/`preferredCurrency`/`country`/`phone`/`address` already exist on the User/Auth model; `platform: "MT4"|"MT5"` + `addons` exist on the Program model; `selectedAddons` exists on Payment — no schema gaps block either phase.

## Session Continuity

Last session: 2026-07-03
Stopped at: v1.5 ROADMAP.md created (Phases 14-15) + REQUIREMENTS.md traceability updated, 4/4 v1 requirements mapped, 0 orphans.
Resume file: None. Next action: `/gsd:plan-phase 14` or `/gsd:plan-phase 15` (no ordering dependency between them).
