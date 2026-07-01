# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. Trading Cult affiliate partner attributes registrations and conversions via S2S postbacks.
**Current focus:** v1.3 CRM Partner Tracking — Phase 10 code-complete; next Phase 11 (Wire Emits + Dedup).

## Current Position

Phase: 10 of 12 (Capture & Persist) — code-complete
Plan: 3/4 (10-01/02/03 shipped; 10-04 deferred post-deploy human-verify)
Status: Phase 10 code-complete + pushed to origin/main-2026; verifier 7/7 static, status human_needed (live verify deferred). Ready to plan Phase 11.
Last activity: 2026-07-01 — Phase 10 executed (backend 09ca7387/d2992553/4a079169, dashboard e111dab1)

**Phase 11 handoff:** `partnerClickId` now lives on the User doc + Payment `attribution` (server-authoritative from user doc). Partner tracking URL = `/api/tracking/track?clickid=…`. Phase 11 reads `user.partnerClickId` at the signup/purchase emit sites (wires the zero-caller `signupCompleted`/`purchaseCompleted`).

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [███░░░░░░░] 33% (3/9 plans)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT).

## Performance Metrics

**Velocity:**
- Total plans completed: 28 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9])
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

Full decision log in PROJECT.md Key Decisions table. v1.3 locked decisions (10-03 additions):
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
Stopped at: 10-03 complete — CRM-03 attribution.partnerClickId on PaymentAttribution interface + Payment schema + both create sites (standard + PAP), pushed to main-2026 (4a079169). Phase 10 complete. Ready for Phase 11 (Tracking Events).
Resume file: .planning/phases/11-tracking-events/ (next phase)
