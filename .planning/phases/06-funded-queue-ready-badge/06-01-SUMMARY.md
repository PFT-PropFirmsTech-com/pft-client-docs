---
phase: 06-funded-queue-ready-badge
plan: 01
subsystem: pft-backend FundedProgressionQueue + pft-dashboard admin sidebar
tags: [sidebar, badge, funded-queue, deferred-to-remote, no-new-commits]
status: closed-by-remote
completed: 2026-06-30
dependency-graph:
  requires: [funded_queue_settings.manualApprovalEnabled toggle, existing useAdminSidebarPending pattern, FundedProgressionQueue.reason field]
  provides: [admin sidebar red dot on /admin/funded-queue when KYC+contract approved entries are pending]
  affects: [Trading Cult ops triage flow — ticket cmqt9rtjl002rny0kkawu1c6y]
tech-stack:
  added: []
  patterns: [extend-existing-stats-endpoint, react-query shared cache key]
key-files:
  remote-created: []
  remote-modified:
    - pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.controller.ts (commit c8340316, +9/-1)
    - pft-dashboard/src/hooks/useAdminSidebarPending.ts (commit 73810f47, +30/-1)
    - pft-dashboard/src/hooks/useFundedQueue.ts (commit 73810f47, +2)
  this-plan-created: []
  this-plan-modified: []
decisions:
  - "DEFER to remote (Rule 4 — different architectural shape already deployed-pending). Remote shipped between plan-write and plan-execute. Both repos fast-forwarded; ZERO new commits from this plan."
metrics:
  duration: ~10 min (research + fast-forward + summary; no code written)
  commits: 0
---

# Phase 6 Plan 01: Funded Queue Ready Badge Summary

One-liner: **Plan superseded by remote — another dev shipped a different-shape fix for the same ticket between plan-write and plan-execute; deferred per `feedback_rebase_when_remote_already_fixed.md` convention. Both repos fast-forwarded to remote; no new commits.**

## Execution Outcome

**Status:** Closed by remote (Rule 4 — defer).

Per the memory `feedback_rebase_when_remote_already_fixed.md` and the 04.1-01 precedent in STATE.md, I always `git fetch origin main-2026` BEFORE editing in case the bug is already fixed by another shape. It was:

- `pft-backend` HEAD was `63f7d44a`, origin/main-2026 had advanced to `c8340316` — including `c8340316 feat(funded-queue): expose eligibleManualApproval count in stats` (Author: abu jobayer via Claude Opus 4.8, 2026-06-30 21:11 +0600, ~minutes before this execution started).
- `pft-dashboard` HEAD was `60e9b37c`, origin/main-2026 had advanced to `73810f47` — including `73810f47 feat(sidebar): red dot on Funded Queue when entries await manual approval` (same author/timestamp).

Both commits target ticket `cmqt9rtjl002rny0kkawu1c6y` and ship a working sidebar red dot for the same operational goal. Action: fast-forwarded both nested repos to `origin/main-2026` and produced this deferral SUMMARY. No new commits authored.

## Remote vs Plan — Architectural Differences

| Dimension | Plan (06-01) | Remote (c8340316 / 73810f47) | Verdict |
|---|---|---|---|
| Backend endpoint | New `GET /funded-queue/ready-count` returning `{count, manualApprovalEnabled}` | Extends existing `GET /funded-queue/stats` aggregate response to include `eligibleManualApproval: number` | Remote is cheaper — no new route, no new controller, reuses existing auth + cache |
| Count source | LIVE-COMPUTE via `Kyc.find` + `Contract.find` joins on pending userIds (research §Pitfall 1 was explicit: stored flags lag 5-min cron) | STORED `reason: "manual_approval_pending"` field via `countDocuments({status:"pending", reason:"manual_approval_pending"})` | Plan's Pitfall 1 warned exactly against this. Remote shipped it anyway — accepts the 5-min cron-lag tradeoff (dot can be up to 5min stale on a freshly-approved KYC). Acceptable for "needs handling" sidebar dot; not a correctness defect. |
| Toggle gating | Service short-circuits `count: 0` when `funded_queue_settings.manualApprovalEnabled === false` (research §Pitfall 3 — brand-without-manual-approval auto-processes; dot would flicker) | NO toggle gate. Count fires regardless of brand setting. | Functional gap on auto-process brands — could light a dot on rows that are about to vanish on the next cron pass. LOW operational risk on TC (manualApprovalEnabled=true) but a real regression on auto-process brands. Recommend follow-up DEV ticket; do NOT fix in this plan (deferring shape == respecting deployed contract). |
| Parent inheritance | `adminPendingForHref` branch covers BOTH `/admin/funded-queue` leaf AND `/admin/programs` parent | Branch covers ONLY `/admin/funded-queue` leaf | Remote's commit message claims "Program Management parent via existing submenu inheritance" — meaning the parent inherits because the SidebarSubmenu component auto-propagates dots from children. This is also viable; the plan's explicit `/admin/programs` branch was belt-and-suspenders. No defect. |
| Cache key reuse | New `["admin", "fundedQueueReadyCount"]` query key — independent cache | Reuses `["funded-queue-stats"]` key shared with the existing Funded Queue page's `useFundedQueueStats` hook | Remote is more efficient — one network request serves both surfaces, single cache entry. Cleaner design than plan. |
| Cadence | `SIDEBAR_STATS_STALE_MS` / `SIDEBAR_STATS_REFETCH_MS` (5min) | Same 5min constants | Match. |
| Auth | `Auth(userRole.admin, userRole.backOffice)` on new route | Inherits existing `/funded-queue/stats` auth (already admin+backOffice) | Match — BackOffice still works. |
| Dashboard field name | `pendingFundedManualApproval` | `pendingFundedApproval` | Naming difference only. |

**Net assessment:** Remote shipped a leaner, cache-sharing variant. Two real differences from plan are the toggle-gate omission and the stored-field staleness — both acceptable for "advisory dot" UX; not deal-breakers. Per Rule 4 + 04.1-01 precedent, defer.

## Deviations from Plan

- **None authored by this execution.** Plan was NOT executed — fast-forwarded to remote instead.
- The two observable functional differences (toggle gate, stored-vs-live compute) are remote's design decisions, not deviations from my work.

## Self-Check: PASSED

Verification (commits referenced exist on local + remote):

```
cd pft-backend && git log --oneline -2
  c8340316 (HEAD -> main-2026, origin/main-2026) feat(funded-queue): expose eligibleManualApproval count in stats
  97e775a8 feat(affiliate): expose usdAmount in my-commissions for USD purchase display

cd pft-dashboard && git log --oneline -2
  73810f47 (HEAD -> main-2026, origin/main-2026) feat(sidebar): red dot on Funded Queue when entries await manual approval
  60e9b37c feat(affiliates): sum CSV commissions across MLM tiers
```

Both nested repos on `main-2026` (NOT `main`); both even with origin; both protected files (SidebarItem / SidebarSubmenu / sidebar-config / NotificationsProvider) UNTOUCHED by remote per the diffs above; no commits to `pfr-super-admin` or `pft-rule-checker`.

## Deferred Human-Verify Checklist

Matches 04-04 / 05-01 / 04.1-01 convention — DEFERRED until next `main-2026` deploy. Verify the REMOTE shape (not the plan's shape):

1. **Backend probe — stats endpoint now carries `eligibleManualApproval`:**
   ```bash
   curl -H "Authorization: Bearer <admin-token>" https://<brand-backend>/api/v1/funded-queue/stats
   # Expect: {"success":true,"data":{"counts":{...}, "total":N, "eligibleManualApproval":M}}
   ```
   `M` = pending entries with `reason === "manual_approval_pending"`.

2. **Synthetic seed on non-prod brand (Option B from plan, adapted):**
   ```js
   // mongosh against the brand DB. Remote uses STORED reason field, not live-compute,
   // so seeding KYC+Contract alone is NOT enough — must wait for or fake the scan cron.
   const entry = db.fundedprogressionqueues.findOne({ status: "pending" });
   db.kycs.updateOne({ userId: entry.userId }, { $set: { status: "approved" } });
   db.contracts.updateOne({ userId: entry.userId, fileType: "contract" }, { $set: { status: "approved" } });
   // Then either wait ≤5min for scanAndProcessReady cron to flip reason, or force it:
   db.fundedprogressionqueues.updateOne({ _id: entry._id }, { $set: { reason: "manual_approval_pending", kycApproved: true, contractApproved: true } });
   ```
   Hard-refresh admin dashboard → red dot expected on Funded Queue sidebar item ≤5min later. NOTE: the cron-dependence is exactly the staleness Pitfall 1 warned about — verify the dot lags ≤5min behind a fresh KYC approval, not instantly.

3. **Toggle-OFF regression check (remote does NOT gate by `manualApprovalEnabled`):**
   On a brand with `funded_queue_settings.manualApprovalEnabled === false` AND `eligibleManualApproval > 0`, the dot WILL light (per remote shape). Confirm with ops whether this is acceptable. If not, open a follow-up DEV ticket to add the gate.

4. **Empty-queue brand:** With `manualApprovalEnabled: true` but zero entries matching, sidebar stays dark. `eligibleManualApproval: 0`.

5. **BackOffice auth regression:** Log in as BackOffice (not admin) → `/funded-queue/stats` returns 200, not 403. Sidebar dot visible. (Remote inherits existing auth pair on `/stats`, which already supports BackOffice — no change.)

6. **Network cadence:** DevTools → Network → filter `funded-queue/stats` → exactly 1 request on mount, 1 request ~every 5min. (Remote reuses the same shared cache key as the Funded Queue page itself, so navigating to that page should NOT re-fire if already cached.)

7. **Zero-diff check on protected files:**
   ```bash
   cd pft-dashboard && git diff 60e9b37c..73810f47 -- \
     src/components/ui/sidebar/SidebarItem.tsx \
     src/components/ui/sidebar/SidebarSubmenu.tsx \
     src/lib/config/sidebar-config.tsx \
     src/providers/NotificationsProvider.tsx
   # Expected: empty (verified — remote only touches useAdminSidebarPending.ts + useFundedQueue.ts)
   ```

8. **Program Management parent inheritance:** Open admin sidebar with `eligibleManualApproval > 0`; collapse Program Management submenu → confirm parent shows red dot via SidebarSubmenu's existing auto-propagation. If parent does NOT inherit, open a follow-up DEV ticket (plan flagged this as belt-and-suspenders worth keeping).

## Open Follow-ups

- **(MEDIUM) Toggle-gate missing in remote shape.** On brands with `funded_queue_settings.manualApprovalEnabled === false`, the sidebar dot can flicker on entries the cron is about to auto-process. Decide with ops: acceptable, or open DEV ticket to add `manualApprovalEnabled` short-circuit in the new `eligibleManualApproval` count path. (TC has `manualApprovalEnabled: true`, so source-ticket brand is unaffected — this is a regression for auto-process brands only.)
- **(LOW) Stored-field 5-min staleness.** The dot can lag up to 5min behind a freshly-approved KYC because remote reads stored `reason` field synced by `scanAndProcessReady` cron. Plan's research §Pitfall 1 documented this; remote accepted the tradeoff. Re-evaluate if ops report "approved an account, dot didn't appear" tickets.
- **(LOW) Parent inheritance via submenu auto-propagation only.** Confirm in live verify that `/admin/programs` parent dot inherits as remote's commit message claims. If not, the plan's explicit `adminPendingForHref` branch on `/admin/programs` is the trivial fix — open DEV ticket if needed.
- **(LOW — carried from plan §Open Questions Q3)** Ops to confirm a real "Japhet-style" account exists on TC live where KYC+contract are approved AND a pending queue entry persists. Current TC live DB had zero such rows at research time.

## Deploy State

- Both commits already PUSHED to `origin/main-2026` by the remote author. NOT deployed yet.
- Will go live on next `main-2026` deploy of pft-backend (carries `c8340316`) + pft-dashboard (carries `73810f47`).
- No coordination required between the two repos — backend ships the new field as optional (`eligibleManualApproval?: number`) and dashboard reads with `?? 0` fallback, so either side can deploy first without breaking the other.

## Ticket Workflow

- Source ticket `cmqt9rtjl002rny0kkawu1c6y` (Trading Cult HIGH).
- Post-deploy: screenshot of the lit sidebar dot on TC admin → reply to ticket → set status `WAITING_CLIENT`.
- Do NOT post the toggle-gate gap or cron-staleness caveats on the client ticket (per `feedback_ticket_internal_notes.md` — internal-only). Capture them on a DEV ticket if pursued.
