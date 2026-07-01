# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. Trading Cult affiliate partner attributes registrations and conversions via S2S postbacks.
**Current focus:** v1.3 CRM Partner Tracking — Phase 11 in progress (11-01 complete; next 11-02 purchaseCompleted/papPaymentCompleted wiring).

## Current Position

Phase: 11 of 12 (Wire Emits + Dedup) — in progress
Plan: 1/3 (11-01 complete; 11-02 next)
Status: 11-01 complete + pushed to origin/main-2026 (8e2f7509, 44deb3d4). Shared type surface landed; signupCompleted wired.
Last activity: 2026-07-01 — 11-01 executed (8e2f7509 tracking types, 44deb3d4 auth wiring)

**Phase 11 handoff:** `partnerClickId` now lives on the User doc + Payment `attribution` (server-authoritative from user doc). Partner tracking URL = `/api/tracking/track?clickid=…`. Phase 11 reads `user.partnerClickId` at the signup/purchase emit sites. 11-01 wired signupCompleted (zero→2 callers). 11-02 must wire purchaseCompleted/papPaymentCompleted.

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [████░░░░░░] 44% (4/9 plans)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT).

## Performance Metrics

**Velocity:**
- Total plans completed: 29 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9], v1.3: 4 [10-01/02/03, 11-01])
- Average duration: ~5 min
- Note: 2 of v1.2's plans closed-by-remote (Phase 6 fully, Phase 4.1 partial).

**By Milestone:**

| Milestone | Phases | Plans | Total | Avg/Plan |
|-----------|--------|-------|-------|----------|
| v1.0 | 1-3 | 10 | ~50 min | ~5 min |
| v1.1 | 4 | 4 | ~28 min | ~7 min |
| v1.2 | 4.1, 5-9 | 7 | ~40 min | ~5 min |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. v1.3 locked decisions (11-01 additions):
- eventId passthrough requires NO dispatcher change — fire() spreads args into payload; adding eventId as a typed field on helper arg types is sufficient
- OTP registeredUser carries partnerClickId without projection fix — findByIdAndUpdate({ new: true }).toObject() returns full doc
- FTD as isFirstPurchase boolean flag (not event suppression) — purchase_completed/pap_payment_completed fire on every purchase; Phase 12 gates postback on isFirstPurchase=true

v1.3 locked decisions (10-03 additions):
- mergedAttribution pattern: spread client attribution (fbc/gclid/etc) then overlay user.partnerClickId — preserves ad-platform ids, server-authoritative for partner clickid
- PAP funded-leg attribution: only partnerClickId in the object (no ad-platform ids on PAP path); undefined (not {}) when absent — skip-when-absent for Mongo field omission
- Payment attribution.partnerClickId now stored at checkout creation time → survives req=null gateway/webhook callbacks in Phase 11/12

v1.3 locked decisions (10-02 additions):
- TUser also needs partnerClickId (not just TRegisterUser) — UserSchema is typed with TUser; TS2353 without it
- No default/trim/lowercase on partnerClickId schema field — byte-identical storage required for partner echo-back
- CRM field pattern: add to TUser + TRegisterUser + UserSchema (3 places, same auth file pair)

v1.3 locked decisions (10-01 additions):
- `_partner_clickid` cookie: `httpOnly:false` (required so js-cookie browser-side can read it for signup forward)
- Raw-value passthrough contract: backend `/track` sets raw, dashboard forwards raw, Phase 12 encodes once at S2S send
- Open-redirect guard on `?redirect=`: must start with `/` but NOT `//` (blocks protocol-relative hijack)
- `trackRedirect` is sync (no async/DB); error path still 302-redirects to `/` — tracking never breaks a landing click
- Skip-when-absent on dashboard: `...(partnerClickId ? { partnerClickId } : {})` — empty string never sent

v1.3 base locked decisions:
- Conversion = FTD only (one postback per acquired user, not per purchase)
- Payout = `usdAmount` with `currency=USD` always (guards JPY-as-USD bug class)
- PAP purchases count as conversions — `pap_payment_completed` path must be wired
- Free-trial/$0 = registration postback only (no $0 conversion postback — S2S fraud-filter risk)
- Minimal one-off for Trading Cult: config in `TrackingSettings.destinations.partnerPostback`, no generic admin UI
- New `partnerPostback` adapter (NOT reusing `conversionWebhook` — wrong protocol: POST/JSON/HMAC vs GET/macro)
- `signupCompleted` + `purchaseCompleted` have ZERO callers today — Phase 11 must wire both

### Pending Todos

1. **Setup free trial Program docs for Funding Optimal** (ops, no code — `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Ticket cmnx4jvry0001mr0kezmxcnnv.

### Blockers/Concerns

- All v1.0–v1.2 human-verify checklists gated on next main-2026 deploy.
- Phase 12 success criterion 5 (live Trading Cult postback verify) is a post-deploy checkpoint — not a Phase 12 blocker.

## Session Continuity

Last session: 2026-07-01
Stopped at: 11-01 complete — CRM-04 type surface (ITrackingEventPayload + helper arg types) + signupCompleted wired at both registration sites, pushed to main-2026 (44deb3d4). Phase 11 in progress. Ready for 11-02 (purchaseCompleted/papPaymentCompleted wiring).
Resume file: .planning/phases/11-wire-emits-dedup/11-02-PLAN.md
