# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-29)

**Core value:** Funded traders rank and compete in monthly prize pool competitions
**Current focus:** v1.0 milestone complete — planning next milestone (`/gsd:new-milestone`)

## Current Position

Phase: 04-affiliate-reporting — Plan 03 complete (of 4)
Plan: 04-03 complete; next: 04-04
Status: In progress
Last activity: 2026-06-30 — Completed 04-03-PLAN.md (affiliate columns in admin Payment History CSV)

Progress: v1.0 [██████████] 100% (10/10 shipped) · Phase 04 [████████░░] 75% (3/4 plans)

**Open across milestone (post-deploy):** live human-verify checklists for Phases 2 & 3 (anon masking, opt-out timing, competition close, cache isolation) — run after main-2026 deploy. Tracked in phase SUMMARYs.

04-03: Admin Payment History CSV export now ships affiliate commission columns (pft-dashboard main-2026). `ENDPOINTS.admin.affiliate.bulkCommissionsByOrders` added next to existing `commissionsByOrder` per-order lookup, pointing at Plan 04-01's `POST /affiliates/admin/commissions/bulk-by-orders`. `useExportPaymentsCsv` inserts ONE bulk POST `{orderIds: payments.map(p._id)}` (NOT N+1 per-row GETs — would also blow URL-length limit) between the lean payment fetch (skipEnrichment=true UNCHANGED) and the row-map; merges results client-side. CSV grew 19→25 columns: + Commission Rate (%) / Amount (USD) / Currency / Affiliate User ID / Affiliate Name / Affiliate Email at the tail (original 19 untouched). For MLM payments with multi-tier entries, lowest tier (tier 1 = direct referrer) wins per row via `.sort((a,b)=>(a.tier??1)-(b.tier??1))[0]`. Commission fetch wrapped in try/catch → `commByOrder={}` on failure, affiliate columns render empty but CSV still downloads (graceful degrade, no broken export). 2 atomic commits pft-dashboard main-2026: 97783483 (endpoint wiring) + 6566f16d (hook columns); PUSHED to origin; NOT deployed. No deviations. Verifies post-deploy: Network tab shows exactly 1 bulk-by-orders POST per export; CSV has 25 cols; payments with no commission show empty strings not "undefined".

04-01: Affiliate reporting backend endpoints (pft-backend main-2026). Two new routes for the Phase 4 affiliate-reporting UI work. `POST /affiliates/admin/commissions/bulk-by-orders` (Auth admin/backOffice/sales) — one `AffiliateCommission.find({orderId:{$in}})` query grouped into `Record<orderId, entry[]>` for the admin Payment History CSV export (unblocks Plan 03). `GET /affiliates/my-commissions` (Auth `userRole.user` ONLY — security-critical, no admin/backOffice/sales so the service can never be silently changed to accept an override userId) — paginated commission rows scoped to `req.user._id`, batched Payment join via `Promise.all` (not sequential await in .map, matches getAdminUserCommissions perf), surfaces `payment.mt5Login` when set; unblocks Plan 04 Purchase Report UI. Service funcs: `getCommissionsBulkByOrders(orderIds)` + `getMyCommissions(userId, {page,limit,tier,sortBy,sortOrder})` inserted between `getCommissionsByOrderId` and `selectLevelIndexByThreshold` in affiliate.service.ts; controllers + exports in `AffiliateController`. No deviations — plan was surgical and executed exactly as written. Pre-existing tsc errors (esModuleInterop config, Request.user typing across all controllers) NOT touched — they affect every controller, not the new code. Commits: pft-backend e136636c (service) + 63f7d44a (controller+routes), PUSHED to origin/main-2026; NOT deployed. Routes go live when main-2026 deploys.

03-04: Competition close + winner determination (COMP-05 + COMP-06). pft-backend (main-2026 2e914996): closeAndDetermineWinners(id) = THE single winner-write path — CAS gate findOneAndUpdate({_id,status:"active"},{status:"closing"},{new:true}); null => no-op return (already claimed / not active) — the ONLY guard against double winner determination. Ranks by final delta = current valueGrowthPercentage (Leaderboard collection) − baselineValueGrowth. Disqualifies THREE ban sources: Leaderboard.status in {BANNED,VIOLATED} + programs[].isBanned + top-level User.isBanned. Dedupe-by-user Map (best delta per user) => top N = N distinct users. Persists finalValueGrowth+delta on ALL entries (bulkWrite) for standings; marks winning entries rank+isWinner; writes winners[] snapshot; status->ended. Prize disbursement MANUAL (record-only, no payout/MT5). determineWinners(id) admin entry: ended/closing returns existing winners (idempotent, no recompute), active routes through CAS, else 400. getAdminResults(id): full-identity winners + full standings (populate firstName/lastName/email, sort delta desc) — NOT the public masked DTO. closeIfDue() cron hook now delegates to closeAndDetermineWinners (replaces 03-02 placeholder). Routes POST /:id/determine-winners + GET /admin/:id/results (Auth admin/backOffice). pft-dashboard (main-2026 1d1ececc): config determineWinners+adminResults endpoints; CompetitionAdmin{Winner,Standing,Results} full-name types; useDetermineWinners mutation + useCompetitionResults query; CompetitionResults.tsx (winners podium mirror of WeeklyPrizeWinners + full standings table, full names, in Dialog); CompetitionsTable "Determine winners" btn (past-end active, CAS-safe) + "Results" btn (ended); CompetitionContainer results modal + handler. Both PUSHED; NOT deployed. human-verify checklist in 03-04-SUMMARY.md (deferred — app not deployed).

03-03: Public competition surface (COMP-04). pft-backend (main-2026 a27eb855): competition.service listPublic() (active/ended only, public-safe projection) + getPublicRankings() (delta = current valueGrowthPercentage from Leaderboard − entry.baselineValueGrowth, sorted desc, masked via toPublicRankingDTO cloned from leaderboard.service toPublicDTO — displayName "John D.", NEVER email/lastName) + opt-out re-filter (User.distinct $nin at query time so opt-out AFTER enrollment vanishes); controller publicList/publicRankings with optional Bearer decode (anon never throws, valid token => includeRicherStats only, never identity); routes public GET "/" cacheResponse(30) + GET "/:id/rankings" cacheResponse(15, scope:user, keyExtra auth/anon) — MANDATORY bucket (route has no Auth). pft-dashboard (main-2026 133edad3): middleware isCompetitionsPath allowlist (mirror isLeaderboardPath); config publicList/publicRankings endpoints; usePublicCompetition hook (no auth branching, staleTime matches backend TTL); app/competitions/ list + [id] detail OUTSIDE (dashboard); PublicCompetitionContainer (prize pool + countdown + rankings, richer cols display-only) + CompetitionCountdown (date-fns + setInterval, cleaned on unmount) + PublicCompetitionRankingsTable (masked, slim, grep-clean). Deviation: theme.classes.bgWhite doesn't exist (under theme.colors) → used bgGray50. No separate public detail endpoint — detail page filters the public list by id. Stale/empty Leaderboard (non-prod, MT5_CRONS_ENABLED off) → current falls back to baseline → delta 0 (graceful). Both PUSHED; NOT deployed. human-verify checklist in 03-03-SUMMARY.md (deferred — app not deployed).

03-02: Activation auto-enroll + baseline snapshot + competition cron (pft-backend main-2026). enrollParticipants() writes ONE CompetitionEntry per funded (Program.programStage==="funded") non-opted-out account, baselineValueGrowth snapshot = Leaderboard.performance.valueGrowthPercentage; reuses leaderboard.service funded+opt-out query (no raw-User derivation); idempotent (skip if entries exist) + activation-only (no rolling enrollment). activate() now enrolls after draft→active flip. tickTransitions() = thin date dispatcher: due drafts → activate (enroll), due-active → closeIfDue() placeholder (03-04 fills CAS close + winners). CompetitionCronService (static class, isRunning guard, 5-min setInterval) registered server.ts:398 AFTER leaderboard cron block, NOT gated on MT5_CRONS_ENABLED. CAVEAT: cron not MT5-gated but the Leaderboard data it reads IS (leaderboard refresh gated MT5_CRONS_ENABLED) → enrollment/rankings stale/empty in non-prod. Deviation: User imported as default from ../Auth/auth.model (../User/user.model empty). Commit pft-backend 8dec4e3a, PUSHED; not deployed. 03-04 replaces closeIfDue() body.

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
- 03-03: public competition rankings reuse the EXACT Phase 2 security trio — toPublicRankingDTO masking (clone of leaderboard toPublicDTO, displayName only), opt-out re-filter (User.distinct $nin at query time), and the auth/anon cacheResponse keyExtra bucket on the no-Auth `/:id/rankings` route. All three are mandatory and grep-verified clean of email/lastName
- 03-03: live competition rank = current valueGrowthPercentage (read from the Leaderboard collection, keyed userId+programId) − entry.baselineValueGrowth (the activation snapshot). LOCKED delta, not absolute. No live Leaderboard row → current falls back to baseline → delta 0
- 03-03: no separate PUBLIC competition DETAIL endpoint — the `/competitions/[id]` page sources meta from the public LIST endpoint (filter by id) and rankings from `/:id/rankings`. Public list + rankings are both gated to status in [active, ended] (never draft)
- 03-03: `theme.classes.bgWhite` does NOT exist (it lives under `theme.colors`); use `theme.classes.bgGray50` for card backgrounds
- 03-03: `/competitions` pages live OUTSIDE `(dashboard)` (sibling of `/leaderboard`), whitelisted via `isCompetitionsPath` in middleware; public competition types added to existing `competition.types.ts` (imported directly via `@/types/competition.types` — competition.types is NOT re-exported from `@/types/index`)
- 03-04: the CAS active->closing flip (`findOneAndUpdate({_id,status:"active"},{status:"closing"},{new:true})`) is the ONLY guard against double winner determination; cron `closeIfDue` + admin `POST /:id/determine-winners` both call `closeAndDetermineWinners` so there is exactly ONE winner-write path. A null CAS result (already claimed / not active) is a safe no-op
- 03-04: winner disqualification checks THREE ban sources — Leaderboard.status in {BANNED,VIOLATED}, programs[].isBanned, AND top-level User.isBanned (strict superset of the plan's named sources)
- 03-04: `finalValueGrowth` + `delta` are persisted on ALL CompetitionEntry rows at close (not just winners) so the admin standings table renders the full board; dedupe-by-user keeps each user's highest-delta eligible entry → top N = N distinct users
- 03-04: admin results read their OWN full-identity data (firstName/lastName/email via populate) through `GET /admin/:id/results` + `getAdminResults` — NEVER the public masked `toPublicRankingDTO`. `determineWinners` on an already-ended/closing competition returns existing winners WITHOUT recompute (idempotent)
- 04-01: `/affiliates/my-commissions` is locked to `Auth(userRole.user)` ONLY. Admin/backOffice/sales deliberately excluded — service derives userId from `req.user._id`, so adding admin roles would either show admins only their own commissions (confusing UX) or, worse, set up a silent privilege-bypass regression if the service is later refactored to accept an override userId. Route file carries a comment documenting this so it doesn't get "fixed" later
- 04-01: bulk-by-IDs lookup pattern — `POST` with `{ orderIds: string[] }` body, returns `Record<orderId, entry[]>` from a single `$in` query; caller pivots client-side. Avoids N round-trips when admin exports hundreds of payments
- 04-01: paginated-with-Payment-join pattern uses `Promise.all` over `Payment.findById` calls (NOT sequential await in `.map`) — matches `getAdminUserCommissions` perf; sequential await across page-size rows is the regression to guard against in code review

### Pending Todos

None yet.

### Blockers/Concerns

- PRE-01/PRE-02 must land before Phase 2 work — do not skip
- leaderboardOptOut schema default landed (01-02) — `{ leaderboardOptOut: false }` is now safe; schema must deploy from `main-2026` before leaderboard service relies on it at runtime
- 02-01 public endpoint committed on `pft-backend` main-2026 but NOT deployed; it reads `leaderboardOptOut` at runtime, so 01-02 schema + 02-01 code must both ship from main-2026 before the endpoint goes live
- 03-03 public competition endpoints committed on `pft-backend` main-2026 (a27eb855) but NOT deployed; they read `leaderboardOptOut` + the Leaderboard collection at runtime — 01-02 schema + 03-02 enrollment + 03-03 endpoints must all ship from main-2026 before the public competition surface goes live
- 03-03 rankings depend on a fresh Leaderboard collection for the live `current` value; in non-prod where `MT5_CRONS_ENABLED` is off the collection is stale/empty, so deltas read 0 (expected, not a bug)
- 03-04 winner determination committed on `pft-backend` main-2026 (2e914996) but NOT deployed; the CAS close + winner snapshot only runs once the competition module ships from main-2026. It reads the Leaderboard collection for the final `current` value — in non-prod where `MT5_CRONS_ENABLED` is off, deltas read 0 / no eligible winners (expected Pitfall 2; CAS + disqualify + distinct-user logic still verifiable wherever live data exists, idempotency verifiable regardless)

## Session Continuity

Last session: 2026-06-29
Stopped at: Phase 3 plan 03-04 (CAS close + winner determination — COMP-05 + COMP-06) COMPLETE — this is the FINAL plan of the competition phase. 2 auto tasks committed AND pushed (pft-backend main-2026 2e914996, pft-dashboard main-2026 1d1ececc). Task 3 was a human-verify checkpoint, intentionally DEFERRED (app not deployed) — checklist recorded in 03-04-SUMMARY.md. Phase 3 (and all roadmap phases) now complete pending deploy + live verification.
Resume file: no further plans queued. Next action = deploy main-2026 (all three: pft-backend, pft-dashboard, rule-checker) and run the pending human-verify checklists below against live data.
Pending human-verify checklists: 02-02-SUMMARY.md + 02-03-SUMMARY.md + 02-04-SUMMARY.md + 03-03-SUMMARY.md + 03-04-SUMMARY.md (all await live deploy).
