---
phase: 03-competition-system
plan: 03
type: execute
wave: 3
depends_on: ["03-02"]
files_modified:
  # pft-backend (nested git repo, branch main-2026)
  - pft-backend/src/app/modules/Competition/competition.service.ts
  - pft-backend/src/app/modules/Competition/competition.controller.ts
  - pft-backend/src/app/modules/Competition/competition.routes.ts
  # pft-dashboard (separate repo, branch main-2026)
  - pft-dashboard/src/middleware.ts
  - pft-dashboard/src/lib/api/config.ts
  - pft-dashboard/src/hooks/usePublicCompetition.ts
  - pft-dashboard/src/app/competitions/layout.tsx
  - pft-dashboard/src/app/competitions/page.tsx
  - pft-dashboard/src/app/competitions/[id]/page.tsx
  - pft-dashboard/src/components/public-competition/PublicCompetitionContainer.tsx
  - pft-dashboard/src/components/public-competition/CompetitionCountdown.tsx
  - pft-dashboard/src/components/public-competition/PublicCompetitionRankingsTable.tsx
autonomous: false
---

<objective>
Build the public competition surface: a backend public list endpoint + a public masked rankings endpoint (rank by baseline DELTA), and the public dashboard pages (list, detail with prize pool, live countdown, live rankings). This surface INHERITS all Phase 2 security guarantees verbatim: universal name masking ("John D."), never email/full lastName, opt-out respected, auth/anon cache bucketing.

This plan satisfies COMP-04 (public competition page: prize pool, countdown, live rankings by % growth from start). It depends on 03-02 because rankings read CompetitionEntry.baselineValueGrowth (the activation snapshot) to compute live delta.

Purpose: Expose competitions to the public without leaking PII, using the same vetted masking + cache-bucket pattern as Phase 2's /leaderboard/public.
Output: public backend endpoints, public /competitions pages, countdown + masked rankings components, middleware allowlist.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-competition-system/3-CONTEXT.md
@.planning/phases/03-competition-system/3-RESEARCH.md
@.planning/phases/03-competition-system/03-01-SUMMARY.md
@.planning/phases/03-competition-system/03-02-SUMMARY.md

# Backend masking + public-endpoint clone sources (CRITICAL — security pattern)
@pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard.controller.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts

# Dashboard public-surface clone sources
@pft-dashboard/src/app/leaderboard/layout.tsx
@pft-dashboard/src/app/leaderboard/page.tsx
@pft-dashboard/src/components/public-leaderboard/PublicLeaderboardContainer.tsx
@pft-dashboard/src/components/public-leaderboard/PublicLeaderboardTable.tsx
@pft-dashboard/src/hooks/usePublicLeaderboard.ts
@pft-dashboard/src/middleware.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Public list + public masked rankings endpoints (pft-backend)</name>
  <files>
    pft-backend/src/app/modules/Competition/competition.service.ts
    pft-backend/src/app/modules/Competition/competition.controller.ts
    pft-backend/src/app/modules/Competition/competition.routes.ts
  </files>
  <action>
    NESTED pft-backend git repo (branch main-2026). Extend the service/controller/routes from 03-01.

    SERVICE — add two methods:
    - listPublic(): return competitions with status in ["active","ended"] only (never draft). Public-safe fields only: name, description, startDate, endDate, prizePool, status, winners (winners are already masked-safe — see Task note; winners exist only post-03-04). NO createdBy, no internal fields.
    - getPublicRankings(competitionId, includeRicherStats): 
        1. Load CompetitionEntry rows for the competition.
        2. For each entry, read the CURRENT valueGrowthPercentage from the Leaderboard collection (same source as enrollment). delta = current − entry.baselineValueGrowth. (LOCKED: rank by DELTA from activation baseline, NOT absolute.)
        3. Sort desc by delta. Assign live rank.
        4. **MASK every row through a toPublicDTO-style mapper** — clone the masking from leaderboard.service.ts:223 (toPublicDTO). displayName = "John D." (first name + last initial). **NEVER email, NEVER full lastName.** Respect opt-out: entries whose user opted out after enrollment must be excluded at query time (re-filter against User.distinct("_id",{leaderboardOptOut:true}) — mirror leaderboard.service.ts:293). richer STAT fields (account size, trading days, etc.) included ONLY when includeRicherStats true; identity stays masked regardless.
    This is the single non-obvious leak vector — the public rankings DTO must be grep-clean of email/lastName.

    CONTROLLER — add publicList and publicRankings handlers. For publicRankings, decode the optional Bearer token EXACTLY like leaderboard.controller.ts getPublicLeaderboard (optional verifyToken; anon never throws; valid token sets includeRicherStats=true). Never branch identity on the token — only richer stats.

    ROUTES — add the PUBLIC routes (NO Auth middleware), with cache bucketing:
      router.get("/", cacheResponse(30), CompetitionController.publicList);
      router.get("/:id/rankings",
        cacheResponse(15, { scope: "user", keyExtra: (req) => (req.headers.authorization ? "auth" : "anon") }),
        CompetitionController.publicRankings);
    **The keyExtra auth/anon bucket is MANDATORY** (Phase 2 STATE.md 02-01): without it the richer logged-in response leaks to anonymous callers because the route has no Auth so scope:"user" alone collapses everyone to "anon". Mirror leaderboard.routes.ts:22-30 exactly.
    Ensure these public routes are ordered so they don't collide with the "/admin" prefixed admin reads from 03-01 (admin reads live under /competitions/admin; public list is bare "/").
  </action>
  <verify>
    cd pft-backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "Competition/" || echo "no Competition type errors"
    grep -n "keyExtra\|authorization.*auth.*anon" src/app/modules/Competition/competition.routes.ts
    grep -niE "email|lastName" src/app/modules/Competition/competition.service.ts | grep -iv "displayName\|first" && echo "REVIEW: email/lastName referenced — confirm not leaked in public DTO" || echo "PASS no email/lastName in service"
    grep -n "delta\|baselineValueGrowth\|toPublic\|John\|displayName" src/app/modules/Competition/competition.service.ts | head
  </verify>
  <done>
    Public GET / lists active/ended competitions (never draft). Public GET /:id/rankings returns delta-ranked (current − baseline), name-masked rows ("John D."), no email/full lastName, opt-out re-filtered, richer stats only on valid token. cacheResponse with auth/anon keyExtra bucket present on the rankings route. Scoped tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Public competition pages + countdown + masked rankings UI + middleware allowlist + hook (pft-dashboard)</name>
  <files>
    pft-dashboard/src/middleware.ts
    pft-dashboard/src/lib/api/config.ts
    pft-dashboard/src/hooks/usePublicCompetition.ts
    pft-dashboard/src/app/competitions/layout.tsx
    pft-dashboard/src/app/competitions/page.tsx
    pft-dashboard/src/app/competitions/[id]/page.tsx
    pft-dashboard/src/components/public-competition/PublicCompetitionContainer.tsx
    pft-dashboard/src/components/public-competition/CompetitionCountdown.tsx
    pft-dashboard/src/components/public-competition/PublicCompetitionRankingsTable.tsx
  </files>
  <action>
    pft-dashboard repo (branch main-2026). Mirror the as-built Phase 2 public leaderboard surface — public pages live at app/competitions/ (a PLAIN folder OUTSIDE the (dashboard) auth group, sibling of app/leaderboard/). Do NOT create a (public) route group; it doesn't exist.

    middleware.ts: add `const isCompetitionsPath = path.startsWith("/competitions");` and add it to the isPublicPath OR-chain right next to isLeaderboardPath (line ~438-448). Without this the page redirects to login.

    lib/api/config.ts: add public endpoints to the competitions ENDPOINTS block from 03-01:
      publicList: "/competitions",
      publicRankings: (id) => `/competitions/${id}/rankings`,

    usePublicCompetition.ts (mirror usePublicLeaderboard.ts — apiClient auto-attaches token; NO auth branching):
      - usePublicCompetitions() -> GET publicList
      - usePublicCompetitionRankings(id) -> GET publicRankings(id), staleTime 15_000 (match backend cache TTL so opt-out reflects promptly).

    app/competitions/layout.tsx: mirror app/leaderboard/layout.tsx (public chrome, no auth gating).
    app/competitions/page.tsx: list active + past competitions (cards) linking to [id].
    app/competitions/[id]/page.tsx: render PublicCompetitionContainer for the id.

    PublicCompetitionContainer.tsx: fetch competition (from list or a detail field) + rankings; render prize pool (1st/2nd/3rd amounts), CompetitionCountdown, PublicCompetitionRankingsTable.

    CompetitionCountdown.tsx: date-fns + setInterval counting down to endDate (already-installed; no new package). Show "Ended" past endDate. Clean up the interval on unmount.

    PublicCompetitionRankingsTable.tsx (mirror PublicLeaderboardTable.tsx — the SLIM masked one, NOT the admin LeaderboardTable which renders email and routes to /admin/users): columns rank, masked displayName, delta % growth (the ranking metric). Richer stat columns render only when the richer fields are present in the response (logged-in), exactly like the Phase 2 table — never a branched fetch. Grep-clean of email/PII/admin routing.
  </action>
  <verify>
    cd pft-dashboard && npx tsc --noEmit 2>&1 | grep -iE "competition" || echo "no competition type errors"
    grep -n "isCompetitionsPath" src/middleware.ts
    test -d "src/app/competitions" && echo "PASS competitions outside (dashboard)" || echo "FAIL wrong location"
    ls "src/app/(dashboard)/competitions" 2>/dev/null && echo "FAIL: competitions wrongly inside (dashboard)" || echo "PASS not in (dashboard)"
    grep -rniE "email|admin/users" src/components/public-competition/ && echo "REVIEW: PII/admin-route reference in public component" || echo "PASS public components grep-clean"
  </verify>
  <done>
    Public /competitions list + /competitions/[id] detail render prize pool, a live date-fns countdown to endDate, and a masked delta-ranked rankings table. Pages live outside (dashboard); /competitions whitelisted in middleware. Public components are grep-clean of email/admin routing (slim masked table cloned from public-leaderboard, not admin). Scoped tsc clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Public competition surface: backend public list + masked delta-ranked rankings endpoints (auth/anon cache-bucketed), and public /competitions pages (prize pool, live countdown, masked live rankings). All built and committed; app deploys before live test (same as Phase 2).
  </what-built>
  <how-to-verify>
    Once the app is deployed from main-2026:
    1. Open /competitions while LOGGED OUT (incognito). Confirm: page loads without a login redirect; an active competition shows prize pool + a ticking countdown + rankings.
    2. Confirm rankings show masked names only ("John D.") — NO email, NO full last name anywhere. View source / network response for the /:id/rankings call and confirm no email field is present.
    3. Open /competitions while LOGGED IN. Confirm richer stat columns appear, but identity is STILL masked ("John D.").
    4. Confirm a trader with leaderboardOptOut=true does NOT appear in the rankings.
    5. Confirm ranking order matches % growth DELTA from competition start (not absolute value).
    NOTE (staging caveat): if MT5_CRONS_ENABLED is off in this environment, the Leaderboard collection is stale/empty so rankings/deltas may be empty — that is expected (Pitfall 2). Verify masking + countdown + page load regardless; verify ranking accuracy only where leaderboard data is live.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (especially any PII leak, missing cache bucketing, or wrong ranking order).</resume-signal>
</task>

</tasks>

<verification>
- Public list returns active/ended only (never draft).
- Public rankings: delta-ranked, masked ("John D."), no email/lastName, opt-out re-filtered, richer stats token-gated.
- Rankings route has cacheResponse auth/anon keyExtra bucket (security — non-negotiable).
- Public pages live outside (dashboard); /competitions whitelisted in middleware.
- Public components grep-clean of PII/admin routing.
- Scoped tsc clean both repos (full-repo tsc OOMs).
</verification>

<success_criteria>
- COMP-04: Public competition page shows prize pool, live countdown, and rankings sorted by % growth delta from competition start, with Phase 2 masking/opt-out/cache-bucket guarantees intact.
</success_criteria>

<output>
After completion, create `.planning/phases/03-competition-system/03-03-SUMMARY.md` (include the human-verify checklist for post-deploy).
Commit backend files to nested pft-backend repo (main-2026): `feat(03-03): public competition list + masked rankings endpoints`.
Commit dashboard files to pft-dashboard (main-2026): `feat(03-03): public competition pages + countdown + masked rankings`.
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>.
</output>
