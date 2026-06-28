# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Funded traders rank and compete in monthly prize pool competitions
**Current focus:** Phase 1 complete → Phase 2 (Public Leaderboard) next

## Current Position

Phase: 2 of 3 (Public Leaderboard)
Plan: 02 of 4 in current phase
Status: In progress
Last activity: 2026-06-29 — Completed 02-02-public-page-and-components.md (auto tasks; human-verify checkpoint deferred — app not deployed)

Progress: [███░] 75% (Phase 2: 02-01 + 02-02 + 02-03 done; 02-04 pending)

02-02: Public leaderboard UI complete — /leaderboard page outside (dashboard) auth group, middleware-whitelisted; usePublicLeaderboard hook + slim PublicLeaderboardContainer/Table consuming GET /leaderboard/public; masked displayName only, richer columns (Account Size, Trading Days) conditional on logged-in fields; no PII/admin routing (grep clean). Committed pft-dashboard main-2026 (def211e8, f75af977); not deployed. Filter/sort slot reserved for 02-04.

02-01: Public endpoint GET /leaderboard/public complete — masked DTO (no PII), funded-only + opt-out filters, optional-token richer stats, auth/anon cache buckets. Committed pft-backend main-2026 (9399ecc9, 586949ca); not deployed.

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~3 min
- Total execution time: <1 hour

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture: toPublicDTO() serializer built in same phase as LB-01 (Phase 2) — prevents PII leak
- Architecture: CompetitionEntry as separate collection (not embedded) — avoids 16MB BSON limit at 10k+ participants
- Architecture: CAS close pattern for competition close — prevents double winner determination
- Architecture: Baseline snapshot per participant at competition start — rank by delta, not absolute value
- 01-01: floatingPL MT5-offline fallback is deterministic 0 (not random) — keeps leaderboard ranks stable across requests
- 01-02: leaderboardOptOut added via Mongoose `default: false` — no migration; `{ leaderboardOptOut: false }` is now a safe filter
- Repo split: backend code commits land in nested `pft-backend` repo on `main-2026`; `.planning/` docs live in parent repo
- 02-03: dashboard `User` type lives in `src/types/user.types.ts` (not `index.ts`); `leaderboardOptOut` added there + to `useUpdateUser` payload allow-list
- 02-03: opt-out is frontend-only — `PATCH /users/:id` already self-updates `leaderboardOptOut` (raw findByIdAndUpdate, not in sensitive-strip)
- 02-01: public masking is UNIVERSAL (anon + logged-in get "John D."); valid Bearer token unlocks only richer STAT fields, never identity
- 02-01: public cache MUST bucket auth vs anon via `keyExtra` (route has no Auth, so `req.user` undefined → scope:user alone collapses all to "anon" and leaks richer stats)
- 02-01: funded-only forced in service; opt-out applied query-time via `User.distinct` + `userId $nin`, merged field-wise with search `$in` through new `extraMatch` param on `getLeaderboard`
- 02-02: public UI types added to existing `src/types/leaderboard.types.ts` (re-exported via `@/types`), not a new `leaderboard.ts`
- 02-02: logged-in vs anon is DISPLAY-only — richer columns rendered from presence of richer stat fields in the response (apiClient auto-attaches token); never a branched fetch
- 02-02: dedicated slim public components built (admin `LeaderboardTable` not reusable — renders email + pushes /admin/users); public surface is grep-clean of PII/admin routing
- 02-02: `/leaderboard` whitelisted in middleware via `isLeaderboardPath` OR-clause; page lives outside `(dashboard)` auth group

### Pending Todos

None yet.

### Blockers/Concerns

- PRE-01/PRE-02 must land before Phase 2 work — do not skip
- leaderboardOptOut schema default landed (01-02) — `{ leaderboardOptOut: false }` is now safe; schema must deploy from `main-2026` before leaderboard service relies on it at runtime
- 02-01 public endpoint committed on `pft-backend` main-2026 but NOT deployed; it reads `leaderboardOptOut` at runtime, so 01-02 schema + 02-01 code must both ship from main-2026 before the endpoint goes live

## Session Continuity

Last session: 2026-06-29
Stopped at: Phase 2 plan 02-02 (public page + components) auto tasks complete + committed in pft-dashboard (def211e8, f75af977). human-verify checkpoint NOT run (app not deployed) — checklist recorded in 02-02-SUMMARY.md for later live verification.
Resume file: .planning/phases/02-public-leaderboard/02-02-SUMMARY.md (human-verify checklist) — or proceed with 02-04 (filters + sort UI into the reserved PublicLeaderboardContainer slot).
Pending human-verify checklists: 02-02-SUMMARY.md + 02-03-SUMMARY.md (both await live deploy).
