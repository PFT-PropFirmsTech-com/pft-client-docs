# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Funded traders rank and compete in monthly prize pool competitions
**Current focus:** Phase 3 (Competition System) in progress — 03-01 foundation done

## Current Position

Phase: 3 of 3 (Competition System)
Plan: 01 of N in current phase
Status: In progress
Last activity: 2026-06-29 — Completed 03-01-competition-models-and-admin-crud.md (3 auto tasks; committed + pushed all 3 repos)

Progress: [████] 100% (Phase 2 done) | Phase 3: 03-01 done

03-01: Competition foundation across 3 repos. pft-backend (main-2026): Competition model (draft|active|closing|ended|archived state machine, prizePool[], winners[] subdoc, locked valueGrowthPercentage metric, NO per-brand field) + SEPARATE CompetitionEntry collection + zod validation + admin CRUD (service/controller/routes) gated Auth(admin,backOffice), draft-only edit/delete guards, activate(draft→active)/deactivate(active→draft, blocked once entries exist), registered /competitions; admin reads under /competitions/admin (bare / + /:id/rankings reserved for 03-03). pft-dashboard (main-2026): competition.types + competitions ENDPOINTS + useCompetitions hooks + /admin/competitions page (table + Coupon-pattern modal, Edit/Delete disabled non-draft, Enable/Disable toggle) + sidebar entry. pfr-super-admin (main): /admin/competitions pagePermissions seed. Commits: pft-backend 2d7b8949 + 2a360a99, pft-dashboard 9e63857b, pfr-super-admin 69d3669. All PUSHED. activate() is the 03-02 enrollment hook point.

02-04: Public leaderboard filters + sort complete — new PublicLeaderboardFilters (account-size + challenge-type selects sourced from data.filters.available*, sort-by % growth / win rate / profit factor + asc/desc toggle) lifted into PublicLeaderboardContainer state → usePublicLeaderboard params (page resets to 1 on change). LB-04 vs 02-01 contradiction RESOLVED: un-stripped challengeType in getPublicLeaderboard controller (option a) — safe because service forces programStage="funded" AFTER spreading caller filters, so challengeType only narrows within funded. Funded-only/masking/PII guarantees untouched; grep clean. Committed pft-dashboard main-2026 (74172f4b hook+types, 9f1cf5a0 filters+container) + pft-backend main-2026 (7e0acf28 controller); not deployed. human-verify checklist in 02-04-SUMMARY.md.

02-02: Public leaderboard UI complete — /leaderboard page outside (dashboard) auth group, middleware-whitelisted; usePublicLeaderboard hook + slim PublicLeaderboardContainer/Table consuming GET /leaderboard/public; masked displayName only, richer columns (Account Size, Trading Days) conditional on logged-in fields; no PII/admin routing (grep clean). Committed pft-dashboard main-2026 (def211e8, f75af977); not deployed. Filter/sort slot reserved for 02-04.

02-01: Public endpoint GET /leaderboard/public complete — masked DTO (no PII), funded-only + opt-out filters, optional-token richer stats, auth/anon cache buckets. Committed pft-backend main-2026 (9399ecc9, 586949ca); not deployed.

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (Phase 2: 02-01–02-04; Phase 3: 03-01)
- Average duration: ~5 min
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
- Architecture (Phase 3 REVERSAL): OMIT brandId on Competition — zero existing models carry it; multi-brand is per-DB separation. Supersedes earlier "brandId from day one" note.
- Phase 3 decisions: disqualify BANNED/VIOLATED at close; per-account entry deduped to best account per user at win (top 3 = distinct users); rank by valueGrowthPercentage delta from activation baseline
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
- 02-04: LB-04 challengeType filter IS supported — resolved the 02-01 strip vs LB-04 contradiction by un-stripping challengeType in the public controller (option a). Safe because `getPublicLeaderboard` service spreads caller filters then sets `programStage: "funded"` AFTER → challengeType only narrows within funded, never widens. masking/toPublicDTO path untouched
- 02-04: public filter/sort is container-owned state feeding usePublicLeaderboard (single source of truth); PublicLeaderboardFilters is presentational. Radix Select "All" uses a `__all__` sentinel (empty-string item values disallowed). Filter/sort change resets page→1
- 02-04: challengeType dropdown options come from `Program.distinct("challengeType")` (all programs) — a listed type with no funded traders yields an empty table (cosmetic, no leak); could later narrow to funded-present types

### Pending Todos

None yet.

### Blockers/Concerns

- PRE-01/PRE-02 must land before Phase 2 work — do not skip
- leaderboardOptOut schema default landed (01-02) — `{ leaderboardOptOut: false }` is now safe; schema must deploy from `main-2026` before leaderboard service relies on it at runtime
- 02-01 public endpoint committed on `pft-backend` main-2026 but NOT deployed; it reads `leaderboardOptOut` at runtime, so 01-02 schema + 02-01 code must both ship from main-2026 before the endpoint goes live

## Session Continuity

Last session: 2026-06-29
Stopped at: Phase 3 plan 03-01 (competition models + admin CRUD + UI + pagePermissions seed) COMPLETE — all 3 auto tasks committed AND pushed (pft-backend main-2026 2d7b8949/2a360a99, pft-dashboard main-2026 9e63857b, pfr-super-admin main 69d3669).
Resume file: proceed to Phase 3 plan 03-02 (enrollment + baseline snapshot — hooks into Competition activate()). 03-03 = public list/rankings; 03-04 = winner determination.
Pending human-verify checklists: 02-02-SUMMARY.md + 02-03-SUMMARY.md + 02-04-SUMMARY.md (all await live deploy).
