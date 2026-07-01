# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. Trading Cult affiliate partner attributes registrations and conversions via S2S postbacks.
**Current focus:** v1.3 CRM Partner Tracking — Phase 11 complete (11-01, 11-02, 11-03 done); Phase 12 (partnerPostback adapter) is next.

## Current Position

Phase: 11 of 12 (Wire Emits + Dedup) — COMPLETE
Plan: 3/3 (all plans complete)
Status: Phase 11 code-complete + pushed to origin/main-2026 (8e2f7509/44deb3d4/644ccd39/982ba9a1/8540f5a). Verifier 6/6 passed, no Phase-12 scope leak. Ready to plan Phase 12.
Last activity: 2026-07-01 — Phase 11 executed + verified (signup/purchase/PAP emits wired, FTD flag, dedup audit)

**Phase 12 handoff:** Events now FIRE with all partner data: `signup_completed` (eventId `signup:<userId>` + partnerClickId), `purchase_completed` (eventId `purchase:<paymentId>` + partnerClickId + usdAmount + currency:USD + `isFirstPurchase` flag), `pap_payment_completed` (eventId `pap:<paymentId>` + partnerClickId + usdAmount). Phase 12 builds `destinations/partner-postback.ts` (GET + macro), routes these events → partnerPostback:true in tracking.constants, gates the CONVERSION send on `isFirstPurchase===true` (FTD once-per-user), and reads per-brand config from `TrackingSettings.destinations.partnerPostback` (Trading Cult). Free-trial/$0 = registration postback only. Dedup + eventIds already retry-safe (11-DEDUP-AUDIT.md).

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [██████░░░░] 67% (6/9 plans)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT).

## Performance Metrics

**Velocity:**
- Total plans completed: 30 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9], v1.3: 6 [10-01/02/03, 11-01/02/03])
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

Full decision log in PROJECT.md Key Decisions table. v1.3 locked decisions (11-03 additions):
- ConversionWebhookEventsService event surface {ChallengePassed,ChallengeFailed,PayoutCompleted,KYCCompleted,AccountFunded,dispatchFromWorker} is disjoint from Tracking path events {signup_completed,purchase_completed,pap_payment_completed} — confirmed by live grep at post-11-02 HEAD; no guard or refactor needed (CRM-08 closed)
- deterministicEventId is minute-bucketed (Math.floor(ts/60000)) — safe only for browser<>server same-minute dedup; gateway webhook retries a minute+ later need explicit stable eventIds
- Phase 11 stable eventId scheme (signup:<userId>, purchase:<paymentId>, pap:<paymentId>) satisfies CRM-08 cross-minute idempotency requirement

v1.3 locked decisions (11-02 additions):
- fanbasis DOES provision PAP funded-legs (deferPapFundedLegIfNeeded gate + assignProgramToUser with payAfterPass fields) → papPaymentCompleted added in ensureProgramAssigned when payAfterPass && currentProgramId
- FTD count === 1 (not === 0) at all standard sites: status="completed" is persisted before completion side-effects at all call sites
- Stripe emit placed once in processPaymentCompletion (shared by both checkout.session.completed + payment_intent.succeeded) — single call site, stable eventId deduplicates if both events fire
- Free PAP ($0): PAP-skip guard in util + no papPaymentCompleted on free path = zero conversion events for free PAP (correct per locked $0 decision)

v1.3 locked decisions (11-01 additions):
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

1. **Setup free trial Program docs for Funding Optimal** (ops, no code — `.planning/todos/pending/2026-07-01-setup-free-trial-program-docs-for-funding-optimal.md`). Ticket cmnx4jvry0001mr0kezmxcnnv. BLOCKED on client's Google Ads campaign ending.
2. **v1.4 Margin history enhancement** (per-trade max margin in trade history + daily Used-Margin HWM series, client+admin — `.planning/todos/pending/2026-07-01-v1.4-per-trade-margin-and-daily-hwm.md`). Ticket cmovizb320007qs0k0fue250p (Trading Cult follow-up on shipped Phase 7). QUEUED — start as v1.4 AFTER v1.3 completes (Phase 12 + complete-milestone). Both enhancements; research-first.

### Blockers/Concerns

- All v1.0–v1.2 human-verify checklists gated on next main-2026 deploy.
- Phase 12 success criterion 5 (live Trading Cult postback verify) is a post-deploy checkpoint — not a Phase 12 blocker.

## Session Continuity

Last session: 2026-07-01
Stopped at: 11-03 complete — CRM-08 dual-path audit written (8540f5a). Confirmed disjoint event surfaces, stable eventId dedup, minute-bucket caveat. Phase 11 fully complete. Ready for Phase 12 (partnerPostback adapter).
Resume file: .planning/phases/12-partner-postback/ (Phase 12 plan)
