---
phase: 03-competition-system
plan: 02
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  # pft-backend (nested git repo, branch main-2026)
  - pft-backend/src/app/modules/Competition/competition.service.ts
  - pft-backend/src/app/modules/Competition/competition.cron.ts
  - pft-backend/src/server.ts
autonomous: true

must_haves:
  truths:
    - "When a competition transitions draft->active, every funded non-opted-out account gets one CompetitionEntry"
    - "Each CompetitionEntry records a baselineValueGrowth snapshot taken AT activation"
    - "Funded set + opt-out filtering reuse the existing Leaderboard-collection logic (not a fresh MT5 traversal)"
    - "A competition cron transitions competitions automatically without doing MT5 work"
    - "Traders who become funded mid-competition are NOT rolled in (enrollment is activation-only)"
  artifacts:
    - path: "pft-backend/src/app/modules/Competition/competition.service.ts"
      provides: "enrollParticipants(competitionId) — writes one CompetitionEntry per funded account with baselineValueGrowth from Leaderboard.performance.valueGrowthPercentage; hooked into activate()"
      contains: "baselineValueGrowth"
    - path: "pft-backend/src/app/modules/Competition/competition.cron.ts"
      provides: "CompetitionCronService static class (start/stop, isRunning guard, setInterval) calling tickTransitions()"
      contains: "setInterval"
    - path: "pft-backend/src/server.ts"
      provides: "CompetitionCronService.start() registered after the leaderboard cron block; NOT gated on MT5_CRONS_ENABLED"
      contains: "CompetitionCronService"
  key_links:
    - from: "pft-backend/src/app/modules/Competition/competition.service.ts"
      to: "Leaderboard collection"
      via: "funded + opt-out query mirroring leaderboard.service.ts:288-297"
      pattern: "programStage.*funded|leaderboardOptOut"
    - from: "competition.service.ts enrollParticipants"
      to: "CompetitionEntry"
      via: "insertMany one entry per funded account with baselineValueGrowth"
      pattern: "CompetitionEntry"
    - from: "pft-backend/src/server.ts"
      to: "CompetitionCronService.start"
      via: "cron registration after LeaderboardCronService block (~line 391)"
      pattern: "CompetitionCronService.start"
---

<objective>
On competition activation (draft->active), auto-enroll all funded, non-opted-out trading accounts and snapshot each one's baseline % growth. Add a lightweight competition cron that auto-transitions competitions (e.g. flips a competition active once startDate passes / marks it for close at endDate — close logic itself lands in 03-04).

This plan satisfies COMP-03 (auto-enroll funded non-opted-out traders at activation + baseline snapshot). It extends competition.service.ts from 03-01 and registers the cron in server.ts.

Purpose: Produce the per-account CompetitionEntry rows with an activation baseline. The baseline written here is the SAME field read at close (03-04) for delta ranking — they must reference the identical field name.
Output: enrollParticipants() service method wired into activate(); CompetitionCronService; cron registered in server.ts.
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

# Clone sources for enrollment query + cron
@pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard-cron.service.ts
@pft-backend/src/server.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: enrollParticipants + baseline snapshot, hooked into activate() (pft-backend)</name>
  <files>pft-backend/src/app/modules/Competition/competition.service.ts</files>
  <action>
    NESTED pft-backend git repo (branch main-2026). Extend the service created in 03-01.

    Add `enrollParticipants(competitionId)`:
    - Source the funded, non-opted-out set from the precomputed Leaderboard collection — REUSE the exact pattern at leaderboard.service.ts:288-297 (do NOT re-derive funded from raw User docs; "funded" is NOT an accountType — Pitfall 1 in 3-RESEARCH.md). Concretely:
        const optedOut = await User.distinct("_id", { leaderboardOptOut: true });
        const fundedProgramIds = await Program.distinct("_id", { programStage: "funded" });
        const rows = await Leaderboard.find({
          programId: { $in: fundedProgramIds },
          ...(optedOut.length ? { userId: { $nin: optedOut } } : {}),
        }).select("userId programId mt5AccountId performance.valueGrowthPercentage").lean();
      (Match the actual field/collection names in leaderboard.model.ts / leaderboard.service.ts — confirm mt5AccountId field name there.)
    - For each row write ONE CompetitionEntry: { competitionId, userId, programId, mt5AccountId, baselineValueGrowth: row.performance.valueGrowthPercentage ?? 0, snapshotAt: now }. Use insertMany.
    - **Per-account, not per-user** (LOCKED): one entry per funded account. Dedupe-to-best-user happens later at winner determination (03-04), NOT here.
    - **Idempotency:** if CompetitionEntry rows already exist for this competition, do not double-insert (guard: skip enrollment if count > 0, or use an upsert keyed on {competitionId, programId}). Enrollment is a one-time activation snapshot.

    Modify `activate(id)` (added in 03-01) so that after flipping status draft->active it calls enrollParticipants(id) within the same flow. Order: set status active, then enroll. (Acceptable for a monthly competition; no transaction required, but make enrollment idempotent per above so a retry is safe.)

    **Activation-only enrollment (LOCKED, Pitfall 6):** Do NOT add any rolling/mid-competition enrollment. Funded traders who appear after activation are intentionally excluded (no baseline exists for them). Add a code comment noting this is deliberate.

    Add a code comment near the Leaderboard query noting the MT5_CRONS_ENABLED dependency (Pitfall 2): in non-prod the Leaderboard collection is stale/empty because the leaderboard refresh cron is gated on MT5_CRONS_ENABLED (server.ts:386), so enrollment may produce zero/stale baselines in staging. This is expected; the competition transition cron itself is not MT5-gated.
  </action>
  <verify>
    cd pft-backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "Competition/" || echo "no Competition type errors"
    grep -n "enrollParticipants\|baselineValueGrowth\|programStage.*funded\|leaderboardOptOut" src/app/modules/Competition/competition.service.ts | head
    grep -n "insertMany\|CompetitionEntry" src/app/modules/Competition/competition.service.ts | head
  </verify>
  <done>
    activate() enrolls one CompetitionEntry per funded non-opted-out account with baselineValueGrowth snapshot from the Leaderboard collection. Enrollment is idempotent and activation-only (no rolling enrollment). Funded + opt-out logic mirrors leaderboard.service.ts (no raw-User funded re-derivation). Scoped tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: CompetitionCronService + register in server.ts (pft-backend)</name>
  <files>
    pft-backend/src/app/modules/Competition/competition.cron.ts
    pft-backend/src/server.ts
  </files>
  <action>
    NESTED pft-backend git repo (branch main-2026).

    competition.cron.ts — mirror the static-class shape of leaderboard-cron.service.ts (private syncInterval, isRunning guard, start()/stop()). The tick interval is ~5 min. The tick body calls a new service method CompetitionService.tickTransitions() — it does NO MT5 work, only reads/writes Competition status.

    Add `tickTransitions()` to competition.service.ts:
    - Auto-activate: find competitions where status === "draft" AND startDate <= now, then call activate() on each (which enrolls). NOTE: admins can also activate manually via the 03-01 activate endpoint; both paths go through activate()/enrollParticipants() so enrollment stays idempotent.
    - Mark-for-close: find competitions where status === "active" AND endDate <= now. The actual CAS close + winner determination lands in 03-04 — for THIS plan, just log/flag them (or call a placeholder CompetitionService.closeIfDue() that 03-04 fully implements). Do NOT implement winner determination here. Keep tickTransitions a thin dispatcher so 03-04 can fill in the close path without restructuring the cron.

    server.ts:
    - Import CompetitionCronService at top alongside the other cron imports (near the LeaderboardCronService import).
    - Register `CompetitionCronService.start()` immediately AFTER the leaderboard cron block (~line 391). **Do NOT gate it on config.MT5_CRONS_ENABLED** — the competition ticker does no MT5 work (it reads the already-precomputed Leaderboard collection). Add the logger.info line ("✅ Competition cron started"). Add a comment noting that winner accuracy still depends on the leaderboard cron (MT5-gated) populating the Leaderboard collection.
  </action>
  <verify>
    cd pft-backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "Competition/|server.ts" || echo "no scoped type errors"
    grep -n "CompetitionCronService" src/server.ts
    grep -n "MT5_CRONS_ENABLED" src/server.ts | sed -n '1,8p'
    grep -n "tickTransitions\|setInterval\|isRunning" src/app/modules/Competition/competition.cron.ts src/app/modules/Competition/competition.service.ts | head
  </verify>
  <done>
    CompetitionCronService exists (static class, start/stop, isRunning guard, ~5-min setInterval) and is registered in server.ts after the leaderboard cron block, NOT behind MT5_CRONS_ENABLED. tickTransitions auto-activates due drafts (enrolling) and flags due-active competitions for close (close implemented in 03-04, not here). Scoped tsc clean.
  </done>
</task>

</tasks>

<verification>
- enrollParticipants writes one CompetitionEntry per funded non-opted-out account, baseline from Leaderboard.valueGrowthPercentage.
- activate() triggers enrollment; enrollment idempotent + activation-only.
- CompetitionCronService registered in server.ts, NOT MT5-gated.
- Funded/opt-out logic reuses leaderboard.service.ts pattern (no raw-User funded derivation).
- Scoped tsc clean (do NOT run full-repo tsc — OOMs).
</verification>

<success_criteria>
- COMP-03: On draft->active, all funded non-opted-out accounts auto-enrolled with an activation baseline snapshot. Mid-competition funded traders are NOT rolled in.
</success_criteria>

<output>
After completion, create `.planning/phases/03-competition-system/03-02-SUMMARY.md`.
Commit to nested pft-backend repo (main-2026): `feat(03-02): activation auto-enroll + baseline snapshot + competition cron`.
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>.
</output>
