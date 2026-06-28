# Phase 3 Context — Competition System

## Decisions (LOCKED — honor exactly)

- **OMIT brandId.** This REVERSES the earlier milestone-level note ("add brandId from day one"). Research confirmed ZERO existing backend models carry a brandId — multi-brand is pure per-database separation. Competition + CompetitionEntry rely on per-brand DB isolation like every other model. Do NOT add a brandId field.
- **Disqualify banned/violated at close.** Winner determination excludes any entry whose account status is BANNED or VIOLATED (and User isBanned). A blown/violated account cannot take prize money, even if final % growth ranks high.
- **Per-account entry, dedupe-by-user at win.** Write one CompetitionEntry per funded account on enrollment. At winner determination, collapse to each user's BEST account so a single trader cannot occupy multiple top-3 prize spots. The top 3 winners must be 3 distinct users.
- **Ranking metric = % profit growth from competition START.** Baseline-delta: at activation, snapshot each participant's `performance.valueGrowthPercentage` (from the precomputed Leaderboard collection). Live/final rank = currentValueGrowthPercentage − baselineValueGrowthPercentage. NOT absolute value.
- **CAS close pattern.** `Competition.findOneAndUpdate({ _id, status: "active" }, { $set: { status: "closing" } })` — only the process that flips active→closing proceeds to determine winners. Prevents double winner / double prize. Cron AND admin on-demand trigger both go through this gate.
- **Prize disbursement is MANUAL admin.** Winner determination only RECORDS winners + surfaces them in admin. No automated payout, no MT5 provisioning. Out of scope.
- **Public competition surface inherits ALL Phase 2 security guarantees.** Universal name masking ("John D."), NEVER expose email/full lastName, respect leaderboardOptOut, auth/anon cache bucketing. Reuse toPublicDTO-style masking. This is a hard security requirement, not optional.

## Claude's Discretion

- Exact schema field names (within the locked semantics above)
- Where winners are recorded (Competition subdoc vs CompetitionEntry flags) — pick the cleaner one
- Cron tick interval (5-min suggested) and exact registration form
- Admin form UX (research says mirror Coupon module: useState + Input/type="date", NOT react-hook-form)
- Public competition route path (app/competitions/ suggested, sibling to app/leaderboard/)

## Deferred (out of scope this phase)

- Automated prize payout / MT5 provisioning of prize accounts
- Per-competition configurable ranking metric (% growth is locked)
- Cross-brand competitions
- Email notifications to winners (that's v2 NOTIF-01)
- Competition history / hall of fame (v2 COMP-07/08)

## Implementation Notes (from 3-RESEARCH.md — verified file:line)

- **"funded" is NOT an accountType.** programs[].accountType enum = [live, demo, banned, passed] (auth.model.ts:288-293). Funded = populated `Program.programStage === "funded"`. Enroll/baseline source = the precomputed Leaderboard collection, queried like `getPublicLeaderboard` already does (yields funded + opt-out-filtered set AND performance.valueGrowthPercentage in one query). REUSE that logic — do not re-derive funded status from raw User docs.
- **Cron registration:** pft-backend/src/server.ts:387, right after `LeaderboardCronService.startCronJob()`. Import alongside server.ts:24. Competition ticker does NO MT5 work so it need NOT be behind `config.MT5_CRONS_ENABLED` — but note leaderboard scoring data IS gated by MT5_CRONS_ENABLED (server.ts:386), so competition rankings are stale/empty in non-prod environments. Flag in plan.
- **Clone targets:** Coupon backend module (CRUD + zod `validateRequest` + `Auth` + `catchAsync`/`sendResponse`) for Competition module. Coupon admin UI (CouponFormModal + CouponCodesTable, useState + Input/type="date") for admin competition management. WeeklyPrizeWinners.tsx for winners display. toPublicDTO + auth/anon cache bucket for public endpoint.
- **No new npm packages** — date-fns (countdown), framer-motion, canvas-confetti all present.
- **Public page:** app/competitions/ (plain folder outside (dashboard), mirror app/leaderboard/). Middleware allowlist: add `isCompetitionsPath` mirroring middleware.ts:438 isLeaderboardPath.
- **pagePermissions (cross-repo):** new /admin/competitions admin route needs a sidebar entry AND a Super Admin pagePermissions seed in pfr-super-admin/lib/sidebar-routes.ts (per memory reference_page_visibility_permissions). Cross-repo task — call it out as its own task or note in the admin plan.
- **Repos:** pft-backend = nested git repo, branch main-2026 (Competition module + cron + endpoints). pft-dashboard = separate repo, main-2026 (admin UI + public page). pfr-super-admin = separate (pagePermissions seed). Commit to correct repo.
- Full-repo tsc OOMs — scoped/skip.
