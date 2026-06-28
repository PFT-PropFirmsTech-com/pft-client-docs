# Research Summary — Leaderboard & Competitions v1.0

## Executive Summary

Additive milestone — no new npm packages needed. Existing infra (Redis, nodemailer, node-cron, precomputed Leaderboard collection, admin UI components) covers everything. Work is new routes, new models, new pages.

**Two critical pre-conditions before public launch:**
1. Fix `Math.random()` floatingPL bug in `leaderboard.service.ts:647` — produces non-deterministic rankings during MT5 downtime
2. Add `leaderboardOptOut: Boolean` to User schema + opt-out enforcement in all public queries

## Stack Additions

None required. All libraries present:
- Countdown: `date-fns` + `setInterval` (installed)
- Animations: `framer-motion` (installed)
- Cron: `node-cron` (installed)
- Cache: existing `cacheResponse` Redis middleware
- Email: existing `sendEmail` service + MessageTemplates admin UI

## Feature Table Stakes

| Feature | Priority | Complexity |
|---------|----------|------------|
| Public leaderboard (anonymous preview, masked PII) | Must | Low — reuse existing components |
| Trader opt-out toggle in profile | Must | Low |
| Competition creation (admin: name, dates, prize pool) | Must | Medium |
| Competition auto-enrollment (funded, non-opted-out) | Must | Low |
| Competition ranked by % profit growth from start date | Must | Medium |
| Public competition page with countdown + rankings | Must | Medium |
| Competition close + winner determination | Must | Medium |
| Prize pool display (1st/2nd/3rd) | Must | Low |
| Competition history page | Should | Low |

## Architecture Decisions

- **New public API endpoint:** `GET /leaderboard/public` — no auth, PII stripped via `toPublicDTO()`
- **New Next.js route group:** `(public)` — outside `(dashboard)` auth layout; add paths to `isPublicPath` in middleware
- **`leaderboardOptOut` field:** Boolean on User model (`default: false`), query with `{ leaderboardOptOut: false }`
- **Competition model:** `Competition` collection with `brandId`, status state machine (`draft → active → ended → archived`)
- **CompetitionEntry:** Separate collection (not embedded) — competition participants at 10k+ hit 16MB BSON limit if embedded
- **CAS close pattern:** `findOneAndUpdate({ _id, status: "active" }, { $set: { status: "closing" } })` prevents double winner determination
- **Baseline snapshot:** Record each participant's `valueGrowthPercentage` at competition start; rank by delta from baseline

## Critical Pitfalls

| Risk | Severity | Phase |
|------|----------|-------|
| PII leak on public endpoint (email in populate projection) | CRITICAL | Phase 1 |
| `Math.random()` floatingPL bug causes rank shuffles | HIGH | Pre-work |
| Concurrent competition close race condition | HIGH | Phase 2 |
| 400-pair cron cap truncates competition scoring | HIGH | Phase 2 |
| Missing `brandId` on models | MEDIUM | Phase 1 |
| Banned/violated accounts winning competitions | MEDIUM | Phase 2 |

## Watch Out For

- Copy-paste admin controller to public route → **email leaks**
- Competition close triggered twice (cron + admin button) → **double prize grants**
- Using `Leaderboard` collection for competition snapshots → **stale/truncated competition data**
- `{ $ne: true }` for opt-out before migration is complete → **opted-out users still appear**
