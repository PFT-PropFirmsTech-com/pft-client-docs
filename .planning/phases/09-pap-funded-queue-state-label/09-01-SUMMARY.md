---
phase: 09-pap-funded-queue-state-label
plan: 01
subsystem: payments
tags: [mongodb, batch-join, react, lucide-react, fundedprogressionqueue, pap, admin-ui]

# Dependency graph
requires:
  - phase: reference_pap_funded_queue_gate
    provides: "Documented the queue-gate pattern; established that fundedDeferral is the correct source of truth, not programAssigned"
provides:
  - "getPaymentHistoryAdmin enriched with fundedDeferral per row via paymentId-keyed $in batch join"
  - "Sparse index on FundedProgressionQueue.paymentId (auto-built on next boot)"
  - "Admin PaymentsTable ProgramAssignmentBadge branches on fundedDeferral — Awaiting KYC / Awaiting Contract / Awaiting KYC & Contract / In Funded Queue badge with Retry+Mark Done hidden"
  - "Admin PaymentDetailsContainer Action Required card branches on fundedDeferral — Funded Account On Hold informational card (no buttons) vs existing amber Program Not Assigned + buttons"
  - "Shared getQueueStateLabel helper in _shared/paymentQueueLabel.ts"
affects: [PAP-02-retry-relabel, PAP-03-queue-staleness, ticket-cmqbzq6vc007ds50k008tr3du]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "paymentId-keyed FundedProgressionQueue $in batch join (mirror of user-facing getPaymentHistory pattern)"
    - "IIFE (() => { ... })() inside JSX for multi-return branching without extracting a new component"
    - "_shared/ directory for admin-scoped cross-component utilities"

key-files:
  created:
    - pft-dashboard/src/app/(dashboard)/_components/modules/admin/_shared/paymentQueueLabel.ts
  modified:
    - pft-backend/src/app/modules/Payment/payment.service.modular.ts
    - pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.model.ts
    - pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx
    - pft-dashboard/src/app/(dashboard)/_components/modules/admin/payment-details/PaymentDetailsContainer.tsx

key-decisions:
  - "Extracted getQueueStateLabel to _shared/paymentQueueLabel.ts rather than inlining in PaymentsTable.tsx — avoids any import-direction confusion as admin module grows, even though no circular dep existed today"
  - "Used IIFE pattern (() => { ... })() inside JSX to branch between two different card JSX trees without creating a new named component — keeps the branch logic co-located with the guard it gates on"
  - "Named admin batch join variable adminPaymentIdToDeferral to avoid shadowing the user-facing paymentIdToDeferral declared 250 lines above in the same function scope (getPaymentHistory vs getPaymentHistoryAdmin are separate function bodies but tsc scoped lint picked it up)"
  - "skipEnrichment=true returns early at line 1954 before the new batch join block — CSV export path naturally excluded without any additional guard needed"

patterns-established:
  - "Pattern: admin $in batch join for FundedProgressionQueue follows user-facing pattern verbatim — same .select(), same .sort({createdAt:-1}), same first-wins loop"
  - "Pattern: admin components use hardcoded EN strings (no i18n t()) — confirmed by research and enforced here"

# Metrics
duration: 5min
completed: 2026-07-01
---

# Phase 09 Plan 01: PAP Funded Queue State Label Summary

**Admin payment views now show real queue state (Awaiting KYC / Awaiting Contract / In Funded Queue) for PAP funded-leg rows held in FundedProgressionQueue, hiding the misleading amber "Program Not Assigned" + Retry/Mark Done buttons on compliance-gated rows while preserving the original warning UI for genuine system failures.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-01T07:08:18Z
- **Completed:** 2026-07-01T07:13:22Z
- **Tasks:** 2 executed + 1 deferred (Task 3: post-deploy human-verify)
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- Backend `getPaymentHistoryAdmin` now batch-joins `FundedProgressionQueue` by `paymentId` (one `$in` per page, same proven pattern as the user-facing `getPaymentHistory`), attaching `fundedDeferral` to each row; CSV export (`skipEnrichment=true`) skips the join
- `FundedProgressionQueue` schema gets a sparse `{ paymentId: 1 }` index (auto-built on next boot, handles pre-PAP entries lacking `paymentId`)
- Admin `PaymentsTable` `ProgramAssignmentBadge` and `PaymentDetailsContainer` both branch: queue-state label present → blue informational badge/card, no Retry/Mark Done; absent → existing amber warning + buttons unchanged

## Task Commits

1. **Task 1: Backend enrichment + sparse index** - `5de7c9f8` (fix)
   - `pft-backend/src/app/modules/Payment/payment.service.modular.ts` — admin batch join added at line 2044 (before `enriched = history.map`)
   - `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.model.ts` — sparse paymentId index added

2. **Task 2: Dashboard queue-state branching** - `5dea14f2` (fix)
   - `pft-dashboard/src/app/(dashboard)/_components/modules/admin/_shared/paymentQueueLabel.ts` — new shared helper (created)
   - `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx` — Clock icon import + getQueueStateLabel branch in ProgramAssignmentBadge
   - `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payment-details/PaymentDetailsContainer.tsx` — getQueueStateLabel branch in Action Required card

3. **Task 3: Post-deploy human-verify** — DEFERRED (see below)

## Files Created/Modified

- `pft-backend/src/app/modules/Payment/payment.service.modular.ts` — `adminPaymentIdToDeferral` block inserted before `enriched = history.map(...)` at ~line 2044; `fundedDeferral` field added to the returned object alongside `couponAffiliate` / `referralAffiliate`
- `pft-backend/src/app/modules/FundedProgressionQueue/fundedProgressionQueue.model.ts` — `fundedProgressionQueueSchema.index({ paymentId: 1 }, { sparse: true })` added after existing three indexes
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/_shared/paymentQueueLabel.ts` — pure `getQueueStateLabel(deferral)` function; returns `"Awaiting KYC & Contract"` / `"Awaiting KYC"` / `"Awaiting Contract"` / `"In Funded Queue"` / `null`
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx` — added `Clock` to lucide-react imports; added `getQueueStateLabel` import; `ProgramAssignmentBadge` now checks `queueLabel` first and returns blue hold badge (no buttons) or falls through to existing amber warning + buttons
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/payment-details/PaymentDetailsContainer.tsx` — added `getQueueStateLabel` import; Action Required section uses IIFE to branch: `queueLabel` truthy → "Funded Account On Hold" blue card (Clock icon, descriptive hold text, no buttons); falsy → existing amber "Action Required: Program Not Assigned" card unchanged

### Files NOT touched (confirmed)

- `pft-dashboard/src/hooks/usePayments.ts` — `fundedDeferral` field was already declared (diff: empty)
- `pft-dashboard/src/app/(dashboard)/_components/modules/users/payment-history/PaymentHistoryContainer.tsx` — user-facing history unchanged (diff: empty)
- `pft-rule-checker` — no changes
- `pfr-super-admin` / any brand-backend-only branch — no changes

## Backend Change: Exact Insertion Point

**File:** `pft-backend/src/app/modules/Payment/payment.service.modular.ts`

**Insertion point:** Immediately before `const enriched = history.map(...)` at ~line 2044 in `getPaymentHistoryAdmin`. The `skipEnrichment=true` branch returns early at line 1954 — the new block is after that early return, so CSV export naturally skips the queue join without any additional guard.

**Pattern mirrored:** Lines 1778–1798 (user-facing `getPaymentHistory` batch join), adapted with source array `history` (not `result.data`), and named `adminPageIds` / `adminPaymentIdToDeferral` to avoid shadowing.

## Dashboard Change: getQueueStateLabel Location Decision

**Decision: Extracted to `_shared/paymentQueueLabel.ts`** (not inlined in PaymentsTable.tsx).

Rationale: No circular dependency exists today between PaymentsTable and PaymentDetailsContainer, but the `_shared/` pattern keeps future admin utilities cleanly separated from component files, is consistent with the repo's module organization, and removes any ambiguity about import direction. Both files import from `../_shared/paymentQueueLabel`.

**Icons imported (new):** `Clock` added to `PaymentsTable.tsx` lucide-react imports. `PaymentDetailsContainer.tsx` already had `Clock` in its imports.

## Verification Results

All plan verification checks passed:

| Check | Result |
|---|---|
| `paymentIdToDeferral\|adminPaymentIdToDeferral` hits in backend | 8 (user-facing 4 + admin 4) |
| `fundedDeferral` hits in backend | 3 (user-facing 1 + admin comment 1 + admin field 1) |
| `paymentId: 1` sparse index in model | Present line 40 |
| `getQueueStateLabel` hits in admin/ | 5 (definition + import + 2 usages + comment) |
| `fundedDeferral` hits in admin files | Both PaymentsTable and PaymentDetailsContainer |
| `Program Not Assigned` still in PaymentsTable | 1 (fallback path preserved) |
| `Program Not Assigned\|Action Required` in PaymentDetailsContainer | 2 (fallback path preserved) |
| `git diff HEAD~1 -- usePayments.ts` | Empty (type unchanged) |
| `git diff HEAD~1 -- PaymentHistoryContainer.tsx` | Empty (user-facing untouched) |
| backend `origin/main-2026` commit subject | `fix(09-01): attach fundedDeferral to admin payments + index queue.paymentId` |
| dashboard `origin/main-2026` commit subject | `fix(09-01): render fundedDeferral queue state on admin payment views` |
| backend diff line count | 29 additions (~30 as expected) |

**Scoped tsc:** Both repos show only pre-existing infrastructure errors (esModuleInterop, missing path alias resolution, `--jsx` flag not set in scoped invocation). Zero new errors introduced by this change. CI is the authority per MEMORY.md `reference_backend_tsc_oom.md`.

## Task 3: Post-Deploy Human-Verify (DEFERRED)

Status: **DEFERRED — code complete, awaiting main-2026 deploy** (matches phases 04.1 / 05-01 / 06-01 / 07-02 / 08-01 convention).

**Diagnostic case for verification:**
- User: `misabih1989@gmail.com` (userId `6a249e9b9886435ab02e710e`)
- Payment: `6a2c08b1ab4caef5631099a2` (`payAfterPassRemainingPayment=true`, `programAssigned=true` — misleading field)
- Queue entry: `6a2c0a5615385fe987c37953` (`status=pending`, `kycApproved=false`, `contractApproved=true`)
- **Expected label:** `"Awaiting KYC"` (kycApproved=false wins)

**Post-deploy verification checklist:**
- [ ] DevTools Network: `GET /api/payments/history-admin` row for `6a2c08b1ab4caef5631099a2` contains `fundedDeferral.kycApproved=false, contractApproved=true, status="pending"`
- [ ] Admin payments table shows blue "Awaiting KYC" badge on diagnostic row; no Retry/Mark Done buttons
- [ ] Admin payment detail view (`/admin/payments/6a2c08b1ab4caef5631099a2`) shows "Funded Account On Hold" blue card with KYC hold text; no Retry/Mark Done buttons
- [ ] Fallback: PAP row with `programAssigned=false` and NO queue entry still shows amber "Program Not Assigned" + Retry/Mark Done
- [ ] Regression: Non-PAP completed rows unaffected
- [ ] Regression: User-facing `/payment-history` still renders existing `getFundedHoldLabel` labels unchanged
- [ ] Optional DB: `db.fundedprogressionqueues.getIndexes()` shows `{ paymentId: 1 }` sparse index
- [ ] Ticket: Reply on `cmqbzq6vc007ds50k008tr3du`, set WAITING_CLIENT per feedback_ticket_status_workflow.md

## Decisions Made

- `getQueueStateLabel` extracted to `_shared/paymentQueueLabel.ts` (not inlined in PaymentsTable) for clean cross-file sharing without import direction ambiguity
- Admin batch join variable named `adminPaymentIdToDeferral` to avoid shadowing user-facing `paymentIdToDeferral` declared in same file ~250 lines above
- IIFE pattern used in PaymentDetailsContainer JSX to branch between two full JSX trees without extracting a new named component
- `skipEnrichment=true` guard: naturally excluded — the early return at line 1954 precedes the new block; no additional `if (!skipEnrichment)` wrapper needed

## Deviations from Plan

None — plan executed exactly as written. The `_shared/paymentQueueLabel.ts` extraction was explicitly offered as an option in the plan ("If the import path is awkward or introduces a circular dep, MOVE getQueueStateLabel to a new small file..."). No circular dependency forced it, but the extraction was chosen for clean organization (recorded as a decision, not a deviation).

## Explicit Out of Scope (per plan)

- **PAP-02** (Retry button relabel/suppress) — deferred to v1.3
- **PAP-03** (queue reason staleness) — deferred to v1.3

## Cross-Links

- ROADMAP.md: Phase 9 (PAP Funded Queue State Label)
- DEV Ticket: `cmqbzq6vc007ds50k008tr3du` (PAP funded queue gate)
- MEMORY.md: `reference_pap_funded_queue_gate.md`
- pft-backend commit: `5de7c9f8` (origin/main-2026)
- pft-dashboard commit: `5dea14f2` (origin/main-2026)

## Issues Encountered

None — pre-flight remote grep confirmed no overlap, both repos were on main-2026 with clean working trees, and the pattern being mirrored (user-facing batch join) was already well-established in the codebase.

## Next Phase Readiness

- Phase 9 is code-complete and pushed to both repos; deploys via next main-2026 push
- Task 3 (human-verify against NSF) remains open pending the deploy
- All prior phase post-deploy tasks (4.1 through 8) also remain open pending the same deploy
- v1.3 scope: PAP-02 (Retry button relabel) + PAP-03 (queue reason staleness) — both depend on taxonomy locked by this phase

---
*Phase: 09-pap-funded-queue-state-label*
*Completed: 2026-07-01*
