# Requirements: PFT WhiteLabel v1.2 — PAP Funded Queue State Label

**Defined:** 2026-07-01
**Core Value:** Support sees the actual PAP funded-queue state instead of a generic "Program Not Assigned" warning, so a compliance gate stops being mistaken for a technical failure.

## v1.2 Requirements

Requirements for milestone v1.2 (in progress). Each maps to a roadmap phase.

### PAP Funded Queue UX

- [ ] **PAP-01**: Admin payments view shows the real `fundedprogressionqueues` state for PAP funded-leg rows — `Awaiting KYC` / `Awaiting Contract` / `In Funded Queue` — when a queue entry exists in `pending`/`processing` for the payment's user + funded programId. The generic "Program Not Assigned" label + Retry/Mark Done buttons render only when there is genuinely no queue entry (the pre-PAP failure case).

## v1.3 / Future Requirements

Deferred to a future milestone. Tracked but not in the current roadmap.

### PAP Funded Queue UX (deferred)

- **PAP-02**: Retry button suppress/relabel for PAP funded legs — either hide the payment-level `POST /api/payments/:id/retry-assignment` button (only increments `payment.retryCount`, doesn't touch the queue) or repoint it at `POST /api/funded-queue/:id/retry` (queue-level, actionable). Depends on PAP-01 label taxonomy being locked first.
- **PAP-03**: Refresh queue `reason` field alongside flag sync in `FundedProgressionQueueService.processQueueForUser` so `reason: "both_pending"` doesn't linger after `contractApproved` flips true.

### Carried from v1.0

- Winner email notifications on competition close
- Competition history / hall of fame view
- Automated prize disbursement (MT5 credit + payout)

### Admin panel polish

- Broader admin-panel anchor refactor for open-in-new-tab / copy-link (DEV cmqztddis)

## Out of Scope

Explicitly excluded from v1.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-approve KYC to bypass the gate | Compliance requirement — human review is the correct behaviour |
| Client-facing status message on the trader dashboard | Trader already sees KYC pending in the KYC widget; admin UX is the pain point |
| Multi-tier queue state (e.g. queue position number) | Cosmetic — no observed support pain, adds query overhead |
| Real-time push of queue state changes | Existing 5-min cron + on-KYC-approve auto-release is sufficient |
| Rework of the queue `reason` enum values | Scope creep — Item 3 (PAP-03) is the smaller version of this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAP-01 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 1 total
- Mapped to phases: 1
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 after initial definition*
