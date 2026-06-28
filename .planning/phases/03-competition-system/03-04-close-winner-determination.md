---
phase: 03-competition-system
plan: 04
type: execute
wave: 4
depends_on: ["03-02", "03-03"]
files_modified:
  # pft-backend (nested git repo, branch main-2026)
  - pft-backend/src/app/modules/Competition/competition.service.ts
  - pft-backend/src/app/modules/Competition/competition.controller.ts
  - pft-backend/src/app/modules/Competition/competition.routes.ts
  # pft-dashboard (separate repo, branch main-2026)
  - pft-dashboard/src/lib/api/config.ts
  - pft-dashboard/src/hooks/useCompetitions.ts
  - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionResults.tsx
  - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx
autonomous: false

must_haves:
  truths:
    - "Closing a competition determines top 3 winners by final % growth DELTA from baseline"
    - "Only ONE process determines winners — the CAS gate (active->closing) prevents double winner determination"
    - "BANNED/VIOLATED accounts are disqualified from winners even if their delta ranks high"
    - "Top 3 winners are 3 DISTINCT users (per-account entries deduped to each user's best account)"
    - "A winner snapshot is recorded on the competition and surfaced in admin results"
    - "Both the cron (at endDate) and an admin on-demand trigger go through the same CAS gate"
  artifacts:
    - path: "pft-backend/src/app/modules/Competition/competition.service.ts"
      provides: "closeAndDetermineWinners(id) — CAS active->closing, delta ranking, disqualify banned/violated, dedupe-by-user, write winners + status ended"
      contains: "findOneAndUpdate"
    - path: "pft-backend/src/app/modules/Competition/competition.routes.ts"
      provides: "POST /:id/determine-winners admin trigger (Auth admin/backOffice) -> same CAS path"
      contains: "determine-winners"
    - path: "pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionResults.tsx"
      provides: "Admin winners + final standings view (mirror WeeklyPrizeWinners.tsx)"
      min_lines: 40
  key_links:
    - from: "competition.service.ts closeAndDetermineWinners"
      to: "Competition.findOneAndUpdate({_id,status:'active'},{status:'closing'})"
      via: "atomic CAS claim before any winner write"
      pattern: "findOneAndUpdate.*closing|status.*active.*closing"
    - from: "competition.service.ts (cron tickTransitions closeIfDue)"
      to: "closeAndDetermineWinners"
      via: "cron at endDate calls the same CAS-guarded method as the admin trigger"
      pattern: "closeAndDetermineWinners|closeIfDue"
    - from: "pft-dashboard/.../CompetitionContainer.tsx"
      to: "CompetitionResults"
      via: "render results for ended competitions"
      pattern: "CompetitionResults"
---

<objective>
Implement competition close: a CAS-guarded winner-determination routine that ranks entries by final % growth delta, disqualifies banned/violated accounts, dedupes per-account entries to each user's best account (so top 3 = 3 distinct users), records a winner snapshot, and an admin view of winners + final standings. Wire both the cron (at endDate) and an admin on-demand trigger through the same CAS gate.

This plan satisfies COMP-05 (winner determination + snapshot) and COMP-06 (admin results view). It depends on 03-02 (baseline + cron dispatcher) and 03-03 (the public surface / shared service file).

Purpose: Determine winners exactly once, fairly (banned excluded, distinct users), and surface them.
Output: closeAndDetermineWinners() CAS routine, determine-winners admin endpoint, cron close hook, CompetitionResults admin UI.
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
@.planning/phases/03-competition-system/03-02-SUMMARY.md
@.planning/phases/03-competition-system/03-03-SUMMARY.md

# Clone sources
@pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
@pft-dashboard/src/app/(dashboard)/_components/modules/admin/leaderboard/WeeklyPrizeWinners.tsx
@pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: CAS close + winner determination (disqualify + dedupe-by-user) (pft-backend)</name>
  <files>
    pft-backend/src/app/modules/Competition/competition.service.ts
    pft-backend/src/app/modules/Competition/competition.controller.ts
    pft-backend/src/app/modules/Competition/competition.routes.ts
  </files>
  <action>
    NESTED pft-backend git repo (branch main-2026). Extend the service/controller/routes.

    Add `closeAndDetermineWinners(competitionId)`:
    1. **CAS GATE (LOCKED, Pitfall 4):** 
         const claimed = await Competition.findOneAndUpdate(
           { _id: competitionId, status: "active" },
           { $set: { status: "closing" } },
           { new: true });
         if (!claimed) return; // another process already claimed it, or not active — no-op
       Only the process that flips active->closing proceeds. This is the ONLY place winners are written. Both the cron and the admin trigger call THIS method, so both are gated.
    2. Load all CompetitionEntry rows for the competition.
    3. For each entry read the CURRENT valueGrowthPercentage from the Leaderboard collection (same source as enrollment/rankings). finalValueGrowth = current; delta = current − baselineValueGrowth. Persist finalValueGrowth + delta on each entry.
    4. **DISQUALIFY banned/violated (LOCKED, 3-CONTEXT.md + Pitfall 3):** exclude any entry whose current Leaderboard.status is "BANNED"/"VIOLATED", OR whose User program isBanned===true. A blown/violated account cannot win even if delta ranks high. Confirm the exact Leaderboard status field + the User program isBanned path (auth.model.ts:308) when implementing.
    5. **DEDUPE-BY-USER (LOCKED, Pitfall 5):** a user may have multiple funded accounts → multiple entries. Collapse to each user's BEST entry (highest delta) so one human cannot occupy two prize slots. After dedupe, the candidate list has at most one entry per user.
    6. Sort remaining candidates desc by delta. Take top N where N = competition.prizePool.length (typically 3). Top 3 MUST be 3 DISTINCT users (guaranteed by step 5).
    7. Mark winning CompetitionEntry rows: rank + isWinner=true. Write the Competition.winners[] snapshot: for each winner { rank, userId, mt5AccountId, baselineValueGrowth, finalValueGrowth, deltaValueGrowth, prizeAmount: matching prizePool[rank].amount, determinedAt: now }.
    8. Set Competition.status = "ended".
    **Prize disbursement is MANUAL (LOCKED):** record winners only. NO payout, NO MT5 provisioning.
    **Idempotency:** because the CAS only matches status "active", a second call (cron + admin both firing) returns at step 1 (claimed === null) and is a safe no-op. The admin trigger after a competition is already "ended" must also no-op (status not "active") — return the existing winners rather than recomputing.

    Wire the cron: in tickTransitions/closeIfDue (from 03-02) replace the placeholder so competitions with status "active" AND endDate <= now call closeAndDetermineWinners(id).

    CONTROLLER: add determineWinners handler (catchAsync + sendResponse) calling closeAndDetermineWinners; return the competition with winners.

    ROUTES: add
      router.post("/:id/determine-winners", Auth(userRole.admin, userRole.backOffice), CompetitionController.determineWinners);
    This is the admin safety-valve trigger — goes through the SAME CAS gate as the cron.
  </action>
  <verify>
    cd pft-backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "Competition/" || echo "no Competition type errors"
    grep -n "findOneAndUpdate" src/app/modules/Competition/competition.service.ts | grep -i "closing\|active"
    grep -niE "BANNED|VIOLATED|isBanned" src/app/modules/Competition/competition.service.ts
    grep -n "determine-winners" src/app/modules/Competition/competition.routes.ts
    grep -niE "dedupe|best|distinct user|Map<.*user|byUser" src/app/modules/Competition/competition.service.ts | head
  </verify>
  <done>
    closeAndDetermineWinners CAS-claims active->closing before any winner write; both cron and POST /:id/determine-winners route through it. Winners ranked by delta, banned/violated disqualified, per-account entries deduped to each user's best account (top 3 = distinct users). winners[] snapshot recorded; status set to ended; no payout. Idempotent (double-trigger safe). Scoped tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Admin results view — winners + final standings (pft-dashboard)</name>
  <files>
    pft-dashboard/src/lib/api/config.ts
    pft-dashboard/src/hooks/useCompetitions.ts
    pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionResults.tsx
    pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx
  </files>
  <action>
    pft-dashboard repo (branch main-2026).

    lib/api/config.ts: add to the competitions ENDPOINTS block:
      determineWinners: (id) => `/competitions/${id}/determine-winners`,

    useCompetitions.ts: add useDetermineWinners() mutation (POST determineWinners(id), invalidate ["competitions"]). The admin list already returns winners[] on each competition (from 03-01 getById/list), so results can render from existing data; add a dedicated fetch only if needed.

    CompetitionResults.tsx (mirror WeeklyPrizeWinners.tsx — it already renders 1st/2nd/3rd): given a competition, render the winners[] podium (rank, masked-or-admin name, finalValueGrowth, delta, prizeAmount) plus a final-standings list. This is the ADMIN surface — admin may show full identity here (it is behind Auth(admin/backOffice)); do NOT reuse the public masked DTO. Pull names from the winners snapshot / a populated admin field.

    CompetitionContainer.tsx (from 03-01): for competitions with status "ended", surface CompetitionResults (e.g. an expandable row, a "View results" action, or a results modal). For competitions with status "active" whose endDate has passed, optionally expose a "Determine winners now" button calling useDetermineWinners (admin safety valve) — it routes through the CAS gate so it's safe even if the cron already fired.
  </action>
  <verify>
    cd pft-dashboard && npx tsc --noEmit 2>&1 | grep -iE "competition" || echo "no competition type errors"
    grep -n "CompetitionResults" src/app/\(dashboard\)/_components/modules/admin/competitions/CompetitionContainer.tsx
    grep -n "determine-winners\|determineWinners" src/lib/api/config.ts src/hooks/useCompetitions.ts
  </verify>
  <done>
    Admin can view winners (podium) + final standings for ended competitions (CompetitionResults cloned from WeeklyPrizeWinners). A "Determine winners now" admin trigger is available for past-end active competitions, routing through the CAS-guarded endpoint. Scoped tsc clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Competition close: CAS-guarded winner determination (delta-ranked, banned/violated disqualified, deduped to distinct users), winner snapshot, admin results view, and an admin on-demand "determine winners" trigger. Built + committed; app deploys before live test.
  </what-built>
  <how-to-verify>
    Once deployed from main-2026, with a competition that has enrolled entries (needs live Leaderboard data — see staging caveat below):
    1. Let a competition reach endDate (or click "Determine winners now"). Confirm admin results show a top-3 podium with prize amounts.
    2. Confirm the top 3 are 3 DISTINCT users (no single trader in two slots) even if one trader had multiple funded accounts.
    3. Confirm a banned/violated account does NOT appear in winners even if its growth was high.
    4. Confirm ranking is by % growth DELTA from competition start (final − baseline), not absolute.
    5. Trigger "determine winners" twice (and/or let cron + button both fire). Confirm winners are recorded ONCE (no duplicates) — CAS gate holds.
    STAGING CAVEAT: if MT5_CRONS_ENABLED is off, the Leaderboard collection is stale/empty so deltas may all be 0 / no eligible winners — that is the expected Pitfall 2 behavior. Verify the CAS no-double-write + disqualify + distinct-user logic wherever live leaderboard data exists; verify idempotency regardless.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (especially duplicate winners, a banned winner, or same user in two slots).</resume-signal>
</task>

</tasks>

<verification>
- closeAndDetermineWinners CAS-claims active->closing before any winner write.
- Cron + admin trigger both route through the CAS method (no second write path).
- Banned/violated disqualified; per-account entries deduped to each user's best (top 3 distinct users).
- winners[] snapshot recorded; status ended; no payout/provisioning.
- Admin results view renders winners + standings.
- Scoped tsc clean both repos (full-repo tsc OOMs).
</verification>

<success_criteria>
- COMP-05: On close, top 3 winners determined by final % growth delta; banned/violated excluded; distinct users; snapshot recorded; determined exactly once (CAS).
- COMP-06: Admin views winners + final standings after end.
</success_criteria>

<output>
After completion, create `.planning/phases/03-competition-system/03-04-SUMMARY.md` (include post-deploy human-verify checklist).
Commit backend files to nested pft-backend repo (main-2026): `feat(03-04): CAS close + winner determination`.
Commit dashboard files to pft-dashboard (main-2026): `feat(03-04): admin competition results view`.
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>.
</output>
