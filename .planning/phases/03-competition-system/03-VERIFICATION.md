---
phase: 03-competition-system
verified: 2026-06-29T00:00:00Z
status: human_needed
score: 22/22 must-haves verified (code); 4 live-UI items deferred to human
human_verification:
  - test: "Admin /admin/competitions UI — create, edit-while-draft, enable/disable, view results"
    expected: "Form creates draft; edit/delete blocked once non-draft; Enable enrolls; Results podium + standings render for ended competition"
    why_human: "Visual/interactive UI; app not deployed (03-01/03-04 human checkpoints DEFERRED)"
  - test: "Public /competitions list + /competitions/[id] detail page"
    expected: "Prize pool, live countdown ticking, masked rankings ('John D.') table renders for anon and logged-in"
    why_human: "Live rendering + countdown timer behavior; app not deployed (03-03 human checkpoint DEFERRED)"
  - test: "Auth vs anon richer-stat leak on live deployment"
    expected: "Anonymous never receives baseline/current stat fields cached for a logged-in viewer"
    why_human: "Requires live cache layer + two concurrent requests; code-level keyExtra bucket verified but runtime behavior needs deployed cache"
  - test: "Enrollment / winner accuracy against a populated Leaderboard collection"
    expected: "Funded non-opted-out accounts enrolled with real baselines; delta ranking and winners correct"
    why_human: "Leaderboard collection is MT5-cron-gated (empty in non-prod); needs production data to validate end-to-end numbers"
---

# Phase 3: Competition System Verification Report

**Phase Goal:** Admins can run monthly prize pool competitions that auto-enroll eligible traders; public competition pages show live rankings and results.
**Verified:** 2026-06-29
**Status:** human_needed (all CODE verified; live-UI/runtime items deferred per phase instructions — app not deployed)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status     | Evidence |
| -- | --------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1  | Admin can create competition (name, dates, 1st/2nd/3rd prize pool)                            | ✓ VERIFIED | createCompetition + createCompetitionSchema (prizePool min 1, endDate>startDate); CompetitionFormModal (226 lines) |
| 2  | New competition appears in 'draft' status                                                     | ✓ VERIFIED | model default status "draft"; create forces status:"draft" (service:38) |
| 3  | Admin can edit fields while draft                                                              | ✓ VERIFIED | updateCompetition draft-only guard (service:67-69) |
| 4  | Admin can enable (draft→active) / disable (active→draft)                                       | ✓ VERIFIED | activateCompetition + deactivateCompetition with status guards |
| 5  | Editing/deleting non-draft rejected by backend                                                | ✓ VERIFIED | update + remove throw BAD_REQUEST when status !== "draft" |
| 6  | /admin/competitions visible to admin + backOffice                                             | ✓ VERIFIED | routes Auth(admin,backOffice); sidebar-config:664; super-admin seed:311 |
| 7  | On activate, all funded non-opted-out accounts auto-enrolled with baseline snapshot           | ✓ VERIFIED | enrollParticipants reads Leaderboard (programStage "funded"), $nin opted-out, insertMany baselineValueGrowth; called by activate() (service:340) |
| 8  | Enrollment reuses Leaderboard collection (no fresh MT5 traversal); activation-only            | ✓ VERIFIED | Leaderboard.find by fundedProgramIds; idempotency guard; no mid-competition rolling enrollment |
| 9  | Cron auto-transitions competitions without MT5 work                                           | ✓ VERIFIED | CompetitionCronService.start (setInterval, isRunning guard); tickTransitions; NOT MT5-gated (server.ts:398) |
| 10 | Public rankings expose masked names only ('John D.'), never email/full lastName               | ✓ VERIFIED | toPublicRankingDTO builds displayName from firstName + lastInitial; interface forbids email/lastName; DTO never spreads raw user |
| 11 | Opted-out traders re-filtered at query time on public rankings                                | ✓ VERIFIED | getPublicRankings User.distinct leaderboardOptOut → $nin (service:251-255) |
| 12 | Anon never gets richer-stat payload cached for logged-in viewer                               | ✓ VERIFIED | route keyExtra auth/anon bucket (routes:31-34); controller optional Bearer decode gates includeRicherStats |
| 13 | Live rank = current valueGrowthPercentage − baselineValueGrowth (delta from activation)        | ✓ VERIFIED | getPublicRankings delta = current − baseline; sort desc by delta (service:297-308) |
| 14 | Public page shows prize pool, live countdown, rankings table                                  | ✓ VERIFIED (code) / human (live) | PublicCompetitionContainer + CompetitionCountdown + PublicCompetitionRankingsTable; pages outside (dashboard) group |
| 15 | Close determines top 3 by final delta                                                         | ✓ VERIFIED | closeAndDetermineWinners delta ranking; slice(0, prizePool.length) |
| 16 | Only ONE process determines winners — CAS gate                                                 | ✓ VERIFIED | findOneAndUpdate({_id,status:"active"},{status:"closing"}); claimed===null no-op (service:401-413) |
| 17 | BANNED/VIOLATED disqualified                                                                   | ✓ VERIFIED | DISQUALIFIED_LB_STATUS set + userBanned + programBanned filters (service:467-515) |
| 18 | Top 3 = 3 distinct users (dedupe to best account per user)                                     | ✓ VERIFIED | bestByUser map keyed by userId, keeps highest delta (service:513-520) |
| 19 | Winner snapshot recorded; admin views results                                                 | ✓ VERIFIED | winners[] snapshot written; getAdminResults; CompetitionResults.tsx (259 lines) wired |
| 20 | Both cron + admin trigger go through same CAS gate                                             | ✓ VERIFIED | cron closeIfDue → closeAndDetermineWinners; admin determineWinners → closeAndDetermineWinners |
| 21 | brandId OMITTED everywhere (negative check)                                                    | ✓ VERIFIED | grep brandId in Competition module → NONE |
| 22 | CompetitionEntry is a SEPARATE collection (not embedded)                                       | ✓ VERIFIED | competitionEntry.model.ts standalone model("CompetitionEntry") |

**Score:** 22/22 truths verified at code level. 4 live-UI/runtime aspects deferred to human (app not deployed).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| pft-backend Competition/competition.model.ts | ✓ VERIFIED | 5-state status enum, prizePool[], winners[], NO brandId |
| pft-backend competitionEntry.model.ts | ✓ VERIFIED | separate collection, baselineValueGrowth required, delta/rank/isWinner |
| pft-backend competition.routes.ts | ✓ VERIFIED | Auth(admin,backOffice) on all mutations; public GET / + /:id/rankings with keyExtra; determine-winners; admin results |
| pft-backend competition.service.ts (721 lines) | ✓ VERIFIED | enroll + public masking + CAS close + getAdminResults + cron transitions |
| pft-backend competition.controller.ts | ✓ VERIFIED | optional Bearer decode → includeRicherStats |
| pft-backend competition.cron.ts | ✓ VERIFIED | static class, setInterval, isRunning guard |
| pft-backend server.ts | ✓ VERIFIED | CompetitionCronService.start() after leaderboard cron, NOT MT5-gated (line 398) |
| pft-backend routes/index.ts | ✓ VERIFIED | { path: "/competitions", route: CompetitionRoutes } (line 129) |
| pft-dashboard admin competitions UI (Container/Table/Modal/Results) | ✓ VERIFIED | all substantive (172/197/226/259 lines), wired to useCompetitions |
| pft-dashboard public-competition (Container/Countdown/RankingsTable) | ✓ VERIFIED | masked displayName only; countdown + rankings wired |
| pft-dashboard app/competitions/* | ✓ VERIFIED | OUTSIDE (dashboard) auth group; list + [id] detail + layout |
| pft-dashboard middleware.ts | ✓ VERIFIED | isCompetitionsPath allowlisted as public path |
| pft-dashboard lib/api/config.ts | ✓ VERIFIED | full admin + public competitions ENDPOINTS block |
| pft-dashboard sidebar-config.tsx | ✓ VERIFIED | /admin/competitions nav entry |
| pfr-super-admin sidebar-routes.ts | ✓ VERIFIED | /admin/competitions pagePermissions seed (line 311) |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| routes/index.ts | CompetitionRoutes | ✓ WIRED | registered at /competitions |
| activate() | enrollParticipants | ✓ WIRED | called on draft→active (service:340) |
| enrollParticipants | Leaderboard + CompetitionEntry | ✓ WIRED | reads funded set, insertMany with baseline |
| server.ts | CompetitionCronService.start | ✓ WIRED | line 398, not MT5-gated |
| public rankings route | auth/anon cache bucket | ✓ WIRED | keyExtra by Authorization header |
| public rankings service | masked displayName | ✓ WIRED | toPublicRankingDTO, no email/lastName |
| cron + admin trigger | closeAndDetermineWinners | ✓ WIRED | single CAS write path |
| CompetitionContainer | CompetitionResults | ✓ WIRED | rendered for ended; useCompetitionResults → adminResults |
| public pages | /competitions backend | ✓ WIRED | usePublicCompetition → publicList/publicRankings endpoints |

### Requirements Coverage

| Requirement | Status | Note |
| ----------- | ------ | ---- |
| COMP-01 (create) | ✓ SATISFIED | |
| COMP-02 (enable/disable + edit draft) | ✓ SATISFIED | |
| COMP-03 (auto-enroll funded non-opted-out) | ✓ SATISFIED (code); accuracy needs live Leaderboard data | |
| COMP-04 (public page: prize/countdown/delta rankings) | ✓ SATISFIED (code); live UI human-deferred | |
| COMP-05 (winner determination + snapshot) | ✓ SATISFIED | |
| COMP-06 (admin results view) | ✓ SATISFIED | |

### Security Inheritance (Phase 2 guarantees)

| Guarantee | Status | Evidence |
| --------- | ------ | -------- |
| Universal name masking ('John D.' only) | ✓ VERIFIED | toPublicRankingDTO; lastName read server-side ONLY to compute initial, never output; interface bans email/lastName |
| Opt-out re-filtered at query time | ✓ VERIFIED | getPublicRankings $nin leaderboardOptOut |
| Auth/anon cache bucket (keyExtra) | ✓ VERIFIED | routes:31-34 keyExtra; controller token gate |
| brandId omitted (negative) | ✓ VERIFIED | grep returns NONE in module |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| competition.service.ts:658,673 | "placeholder" in comment | ℹ️ Info | Stale doc wording; actual closeIfDue calls closeAndDetermineWinners (verified) — no functional stub |
| CompetitionFormModal.tsx:143,153,204 | "placeholder" attr | ℹ️ Info | Legitimate HTML input placeholders, not stubs |

No blocker or warning anti-patterns. No empty-return / unimplemented handlers.

### Gaps Summary

No code gaps. All 22 must-haves are implemented, substantive, and wired across all three repos (pft-backend main-2026, pft-dashboard main-2026, pfr-super-admin main). The phase goal is achieved at the code level.

Per phase instructions, the 03-03/03-04 human-verify checkpoints are DEFERRED because the app is not deployed. Four items require human verification on a live deployment with a populated Leaderboard collection: admin UI interactions, public page rendering/countdown, runtime auth/anon cache isolation, and enrollment/winner numeric accuracy. These are runtime/visual concerns, not code defects.

---

_Verified: 2026-06-29_
_Verifier: Claude (gsd-verifier)_
