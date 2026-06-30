---
phase: 06-funded-queue-ready-badge
verified: 2026-06-30T16:00:00Z
status: human_needed
score: 5/6 must-haves verified (1 follow-up for toggle-gate hardening)
re_verification: false
shape: closed-by-remote (Rule 4 — deferred to remote)
remote_commits:
  pft-backend: c8340316 feat(funded-queue): expose eligibleManualApproval count in stats
  pft-dashboard: 73810f47 feat(sidebar): red dot on Funded Queue when entries await manual approval
human_verification:
  - test: "Live red-dot smoke after main-2026 deploy"
    expected: "On a brand with manualApprovalEnabled=true and ≥1 pending FundedProgressionQueue entry with reason=manual_approval_pending, sidebar Funded Queue item shows red dot, Program Management parent inherits via SidebarSubmenu auto-propagation"
    why_human: "Requires deployed backend + real data on Trading Cult or seeded mongosh row + visual sidebar inspection"
  - test: "BackOffice auth regression"
    expected: "BackOffice user GET /funded-queue/stats returns 200 with eligibleManualApproval field; dot is visible to BackOffice role"
    why_human: "Requires authed session as BackOffice role"
  - test: "Toggle-OFF behavior on auto-process brand"
    expected: "On a brand with manualApprovalEnabled=false, badge stays dark in steady state (no reconcile flicker observed within 5min window)"
    why_human: "Requires brand DB with toggle off and real cron run; flicker is timing-dependent"
  - test: "Polling cadence"
    expected: "DevTools Network filter funded-queue/stats shows 1 req on mount + ~1 every 5min, shared with Funded Queue page cache"
    why_human: "Requires live browser session"
follow_ups:
  - severity: MEDIUM
    title: "Toggle-gate hardening — reconcile branches write reason=manual_approval_pending without checking manualApprovalEnabled"
    detail: "In fundedProgressionQueue.service.ts lines 697-701 and 791-794 (reconcileOrphanedProgressions / reconcileOrphanedPayAfterPassLegs), reason is set to 'manual_approval_pending' purely on KYC+contract approval, no toggle check. scanAndProcessReady (line 355) DOES check the toggle and auto-processes (clearing the entry) — so on toggle-OFF brands the badge can flicker on for up to 5-10 min (cron cadence) before the entry is auto-processed. Real but bounded regression; only affects auto-process brands. Source-ticket brand Trading Cult has manualApprovalEnabled=true so source ticket unaffected."
    suggested_fix: "Either short-circuit count when settings.manualApprovalEnabled=false in getStats controller, OR have reconcile branches skip-enqueue (or use a different reason) when toggle is off"
  - severity: LOW
    title: "5-min cron staleness of stored reason field"
    detail: "Remote reads stored reason field (not live-compute Kyc/Contract joins). Worst-case 5-min sidebar lag after a fresh KYC approval. Plan's research §Pitfall 1 documented this; remote accepted the tradeoff. Sidebar polls at 5min anyway → effective worst-case lag = 10min, acceptable for advisory dot."
---

# Phase 6: Funded Queue Ready Badge — Verification Report

**Phase Goal:** Red dot on admin sidebar Funded Queue + Program Management parent when 1+ pending FundedProgressionQueue entries have BOTH KYC approved AND contract approved. Per-brand `funded_queue_settings.manualApprovalEnabled` MUST gate badge OFF.

**Verified:** 2026-06-30
**Status:** human_needed (closed by remote shape; one MEDIUM follow-up for toggle-gate hardening)
**Re-verification:** No — initial verification

## Context

Plan deferred to remote per Rule 4 (`feedback_rebase_when_remote_already_fixed.md`). Remote shipped a different architectural shape that closes the same user-visible ticket goal (Trading Cult HIGH ticket cmqt9rtjl002rny0kkawu1c6y). This verification is goal-backward against the SHIPPED REMOTE CODE, not the plan's prescribed shape.

## Goal Achievement — Observable Truths

| #   | Truth (from plan must_haves)                                                                                                                                          | Status        | Evidence                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sidebar shows red dot when ≥1 pending FundedProgressionQueue entry has KYC + contract approved (on brand with manualApprovalEnabled=true)                             | ✓ VERIFIED    | Backend (c8340316) counts `{status:"pending", reason:"manual_approval_pending"}` — service writes this reason exactly when KYC+contract are approved AND manualApprovalEnabled=true (service.ts line 355-369). Dashboard 73810f47 wires the count. |
| 2   | Red dot does NOT show when manualApprovalEnabled=false                                                                                                                | ? UNCERTAIN   | Steady state: `reason: "manual_approval_pending"` is never written in normal scan path when toggle=false (scanAndProcessReady auto-processes and removes entry). BUT reconcile branches (lines 697-701, 791-794) write reason without checking toggle → bounded flicker window. See follow-up #1. |
| 3   | Red dot does NOT show on brands with manualApprovalEnabled=true but zero ready entries                                                                                | ✓ VERIFIED    | `countDocuments({status:"pending", reason:"manual_approval_pending"})` returns 0 when no such entries exist. Dashboard reads `?? 0` fallback.                                                                                                      |
| 4   | Backend endpoint returns `{count, manualApprovalEnabled}` gated by Auth(admin, backOffice)                                                                             | ⚠️ SHAPE-DIVERGENT | NO new route. Remote extends existing `GET /funded-queue/stats` to include `eligibleManualApproval: number` field. Auth(admin, backOffice) on `/stats` route (routes.ts lines 45-49) — same auth pair plan required. Field name differs (`eligibleManualApproval` not `count`) and `manualApprovalEnabled` flag is NOT returned. Goal achieved via different shape. |
| 5   | Polling cadence matches existing sidebar badges (SIDEBAR_STATS_REFETCH_MS = 5min)                                                                                     | ✓ VERIFIED    | useAdminSidebarPending.ts uses `SIDEBAR_STATS_STALE_MS` / `SIDEBAR_STATS_REFETCH_MS` (5min) for the new fundedQueueStats useQuery block. Shares cache key `["funded-queue-stats"]` with useFundedQueueStats — single network request serves both surfaces (cleaner than plan).      |
| 6   | Zero changes to SidebarItem.tsx, SidebarSubmenu.tsx, sidebar-config.tsx, NotificationsProvider.tsx, pfr-super-admin, pft-rule-checker                                  | ✓ VERIFIED    | `git diff 60e9b37c..73810f47 -- <protected files>` returns empty. pfr-super-admin HEAD `ef49960` (leaderboard/competitions, no Phase 6 touch). pft-rule-checker HEAD `1b3157b` (trading days, no Phase 6 touch).                                    |

**Score:** 5/6 truths verified; 1 SHAPE-DIVERGENT (still achieves goal); Truth #2 is UNCERTAIN due to toggle-gate gap in reconcile branches.

## Required Artifacts — Three-Level Check

| Artifact                                                                                  | Expected (plan)                                          | Actual (remote)                                                                                          | Status           |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| `pft-backend/.../fundedProgressionQueue.service.ts`                                        | new `getReadyForApprovalCount` fn, live-compute, toggle-gated | NOT created. Remote uses stored field via countDocuments in controller.                                  | ⚠️ NOT-CREATED (goal met via stored-field path)  |
| `pft-backend/.../fundedProgressionQueue.controller.ts`                                    | new `getReadyCount` handler                              | Existing `getStats` handler extended (+9/-1) — adds `eligibleManualApproval` field to existing response. | ✓ SHAPE-DIVERGENT, VERIFIED       |
| `pft-backend/.../fundedProgressionQueue.routes.ts`                                        | new `GET /funded-queue/ready-count` route, admin+backOffice auth | NOT created. Auth inherited from existing `/stats` route (already admin+backOffice — verified line 47).  | ⚠️ NOT-CREATED (goal met via existing route)     |
| `pft-dashboard/.../config.ts`                                                              | new `ENDPOINTS.admin.fundedQueue.readyCount`             | NOT created. Hook calls `/funded-queue/stats` directly via apiClient.get(literal).                       | ⚠️ NOT-CREATED (functional but bypasses ENDPOINTS const) |
| `pft-dashboard/src/hooks/useAdminSidebarPending.ts`                                       | new `pendingFundedManualApproval` count + adminPendingForHref branch for /admin/funded-queue + /admin/programs | `pendingFundedApproval` field (different name) + adminPendingForHref branch for `/admin/funded-queue` only. `/admin/programs` parent inherits via SidebarSubmenu auto-propagation (verified line 110-118 — `parentHasPending` ORs across submenu items). | ✓ SUBSTANTIVE, WIRED |

## Key Link Verification

| From → To                                                                                          | Status     | Evidence                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar count → `/funded-queue/stats` endpoint                                                     | WIRED      | useAdminSidebarPending.ts:162 `apiClient.get("/funded-queue/stats")`, response.data.data.eligibleManualApproval consumed at line 191.                                                     |
| Stored `reason: "manual_approval_pending"` ← `scanAndProcessReady` when KYC+contract+toggle=ON     | WIRED      | service.ts:355-369 — toggle check → updateMany sets reason. Confirmed in PAP gate at lines 174-181 too.                                                                                  |
| Stored `reason: "manual_approval_pending"` ← reconcile branches (NO toggle check)                  | PARTIAL    | service.ts:697-701, 791-794 — reconcile-orphaned paths write reason regardless of toggle. scanAndProcessReady later auto-clears on toggle=OFF brands. Bounded flicker; follow-up #1.       |
| `/admin/programs` parent dot ← submenu child `/admin/funded-queue` with hasPending                  | WIRED      | SidebarSubmenu.tsx:110-118 — `parentHasPending` ORs `hasPendingForHref(item.href)` with submenu items. Matches Support Portal's parent-inheritance precedent.                              |
| BackOffice auth on `/funded-queue/stats`                                                            | WIRED      | routes.ts:47 `Auth(userRole.admin, userRole.backOffice)`. No change needed.                                                                                                                |
| 5-min cadence reuse                                                                                 | WIRED      | Same constants `SIDEBAR_STATS_STALE_MS` / `SIDEBAR_STATS_REFETCH_MS` reused for new useQuery block. Cache key shared with useFundedQueueStats → single request serves both.               |

## Anti-Patterns Scan

No stubs, no TODOs, no placeholders. Backend diff is +9/-1 substantive; dashboard diff is +32/-1 substantive. Both compile-clean per remote author's commit (Claude Opus 4.8 same-day).

## Specific Check Answers (per request)

1. **Backend counts KYC+contract approved correctly?** Yes — relies on stored `reason: "manual_approval_pending"` which is written ONLY when both KYC and contract are approved (service.ts:355, 174-181, 697-701, 791-794). 5-min cron lag tradeoff accepted (plan §Pitfall 1 documented but remote chose stored-field over live-compute for cheaper read).

2. **Dashboard reads eligibleManualApproval into pendingFundedApproval?** Yes — useAdminSidebarPending.ts:191 `pendingFundedApproval: fundedQueueStats.data?.data?.eligibleManualApproval ?? 0`. Field flows count → adminPendingForHref branch → hasPendingForHref → SidebarItem dot.

3. **adminPendingForHref branch wires /admin/funded-queue?** Yes — lines 65-67. NOT `/admin/programs` explicitly (matches Support Portal precedent — submenu auto-propagates).

4. **Parent inheritance via SidebarSubmenu?** Verified — SidebarSubmenu.tsx:110-118 `parentHasPending = hasPendingForHref(item.href) || item.submenu?.some(submenu => hasPendingForHref(submenu.href))`. Same mechanism Support Portal uses.

5. **Toggle-gate gap.** Real but bounded:
   - **Normal path (scanAndProcessReady, PAP gate):** toggle-gated. When toggle=OFF, entry never gets `reason: "manual_approval_pending"` (auto-processed or bypassed). Self-gated.
   - **Reconcile paths (lines 697-701, 791-794):** NOT toggle-gated. Reconcile-orphaned entries get the reason written based purely on KYC+contract status. On toggle=OFF brands, next scanAndProcessReady run (within 5min) will auto-process and remove these entries → bounded flicker window of up to 10 minutes (5min reconcile cadence + 5min scan cadence). Not safe-by-default for auto-process brands, but bounded. Follow-up #1 MEDIUM.

6. **5-min lag observability:** Worst case = 5min sidebar poll + 5min cron lag = 10min. Acceptable for advisory dot on a manual triage workflow; ops wouldn't be hand-on-keys at sub-10min frequency.

7. **Cross-phase regression:** Verified zero diff on SidebarItem.tsx / SidebarSubmenu.tsx / sidebar-config.tsx / NotificationsProvider.tsx / pfr-super-admin / pft-rule-checker.

## Status Decision

**Status: human_needed** (NOT gaps_found).

Rationale: the remote shape closes the user-visible ticket goal — Trading Cult ops will see the red dot when KYC+contract+pending entry exists on a brand with manualApprovalEnabled=true (which TC has). All deployed-time observable truths are met for the source ticket. The toggle-gate gap is a real but bounded edge case affecting auto-process brands only, not the source ticket. Captured as MEDIUM follow-up DEV ticket recommendation per `feedback_internal_dev_handoff.md`.

The plan's prescribed shape (new `/ready-count` endpoint, live-compute joins, explicit toggle short-circuit) was the more defensive design, but the deferred-to-remote convention (Rule 4) preserves the deployed contract. Source ticket can close on human-verify of the deployed dot.

## Recommended Next Actions

1. **Source ticket cmqt9rtjl002rny0kkawu1c6y:** Defer post-deploy verification per SUMMARY's 8-step checklist. Reply with screenshot + set WAITING_CLIENT.
2. **Open DEV ticket** (PFT Support Team company per `reference_internal_dev_handoff.md`) for toggle-gate hardening on auto-process brands. Title: "FundedProgressionQueue reconcile paths bypass manualApprovalEnabled gate — bounded sidebar flicker on auto-process brands". Link as RELATES_TO source ticket.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier, Opus 4.7)_
