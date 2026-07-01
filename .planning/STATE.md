# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Funded traders rank + compete in monthly prize pool competitions. Affiliates see per-purchase commission breakdown. Support sees the actual PAP funded-queue state. Trading Cult affiliate partner attributes registrations and conversions via S2S postbacks.
**Current focus:** v1.3 CRM Partner Tracking — Phase 12 COMPLETE (12-01 config, 12-02 adapter, 12-03 behavioral verification, all done — 12-01/12-02 pushed to origin/main-2026, 12-03 is verification-only with no code change). v1.3 is code-complete AND behaviorally verified at the code level; only the SC5 live-partner post-deploy test remains open.

## Current Position

Phase: 12 of 12 (Partner Postback Adapter) — COMPLETE
Plan: 3/3 complete
Status: Phase 12 code-complete and verified. 12-01 (702b312f): partnerPostback config layer. 12-02 (719e591b): GET adapter registered. 12-03 (b8721f2, docs-only): 10/10 behavioral harness PASS + 0-error whole-chain tsc — proves SC1-4 at code level; SC5 (live Trading Cult postback) recorded DEFERRED post-deploy. v1.3 CRM Partner Tracking fully shipped to origin/main-2026 and verified. Only post-deploy live-partner test remains.
Last activity: 2026-07-01 — Phase 12 plan 03 executed (partnerPostback behavioral verification: stubbed-fetch harness 10/10 PASS + whole-chain scoped tsc 0 errors; 12-03-VERIFY.md + SUMMARY.md written)

**Phase 12 complete (all 3 plans):** 12-01 config layer (702b312f) + 12-02 GET adapter (719e591b) + 12-03 behavioral verification (b8721f2, parent-repo docs commit only — no pft-backend code change, harness found zero adapter bugs). `partnerPostbackAdapter` registered in `registerAllAdapters()`. Skip-guard chain: disabled → no clickid → event branch → FTD gate → empty template → macro subst → fetch GET. Verified via stubbed-fetch harness: skip-guards, registration GET, conversion GET (FTD-gated, payout=usdAmount, currency=USD), encode-once round-trip on URL-special-char clickid, single 5xx retry, never-throws-on-failure — all 10/10 PASS. Post-deploy: set registrationUrl/conversionUrl via PUT /api/tracking/settings with partnerPostback block enabled=true, then run the SC5 live checklist in `.planning/phases/12-partner-postback-adapter/12-03-VERIFY.md` section 4.

Progress: v1.0 [██████████] 100% (10/10) · v1.1 [██████████] 100% (4/4) · v1.2 [██████████] 100% (7/7 code-complete) · v1.3 [██████████] 100% (9/9 plans, code-complete + code-level verified)

**Open post-deploy (all gated on next main-2026 deploy):** v1.0 human-verify (Phases 2 & 3) + v1.1 human-verify (Phase 4) + v1.2: Phase 4.1 (CSV tier-sum), Phase 5 (Daily P&L TC acct 13535), Phase 6 (sidebar dot remote shape), Phase 7 (MarginUsageCard client+admin), Phase 8 (ops sync script XPIPS+FO), Phase 9 (queue-state label NSF payment 6a2c08b1ab4caef5631099a2 → DEV ticket cmqbzq6vc007ds50k008tr3du → WAITING_CLIENT) + v1.3 Phase 12 SC5 (live Trading Cult registration + conversion postback test, per `12-03-VERIFY.md` section 4 checklist — configure PUT /api/tracking/settings, registration test, conversion test w/ FTD gate, brand isolation test).

## Performance Metrics

**Velocity:**
- Total plans completed: 33 (v1.0: 10, v1.1: 4, v1.2: 7 [Phases 4.1/5/6/7/8/9], v1.3: 9 [10-01/02/03, 11-01/02/03, 12-01/02/03])
- Average duration: ~6 min
- Note: 2 of v1.2's plans closed-by-remote (Phase 6 fully, Phase 4.1 partial).

**By Milestone:**

| Milestone | Phases | Plans | Total | Avg/Plan |
|-----------|--------|-------|-------|----------|
| v1.0 | 1-3 | 10 | ~50 min | ~5 min |
| v1.1 | 4 | 4 | ~28 min | ~7 min |
| v1.2 | 4.1, 5-9 | 7 | ~40 min | ~5 min |
| v1.3 | 10-12 | 9 | ~70 min | ~8 min |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. v1.3 locked decisions (12-03 additions):
- Full project-wide `tsc` (bare or `--skipLibCheck`) OOM-crashes on this machine at BOTH default heap and `--max-old-space-size=8192` — stronger confirmation of `reference_backend_tsc_oom.md`; scoped verification tasks should use a `files`-scoped tsconfig override (`extends` the real tsconfig for correct compiler options, `incremental:false` to avoid a poisoned `.tsbuildinfo`) rather than assume project-wide `--skipLibCheck` is safe
- SC5 (live Trading Cult postback) is a DEFERRED post-deploy checkpoint, not a Phase 12 blocker — behavioral proof at the code level (stubbed-fetch harness + whole-chain tsc) is sufficient to mark v1.3 code-complete
- Throwaway verification harnesses (test scripts, tsconfig overrides) are never committed — run once, capture output into the VERIFY.md doc, delete immediately

v1.3 locked decisions (12-02 additions):
- FTD gate lives in adapter (not event emitter): purchase_completed/pap_payment_completed fire on every purchase for Meta/GA4/Klaviyo; only partnerPostback skips non-FTD via isFirstPurchase===true in partner-postback.ts
- Encode-once contract enforced at adapter (line 96 of partner-postback.ts): payload.partnerClickId stored raw through phases 10-11; encodeURIComponent applied exactly once at S2S send
- usdAmount guard: payload.value carries usdAmount (Phase 11 fix 982ba9a1); String(payload.value ?? "") prevents JPY-as-USD bug reaching partner payout field
- One retry on 5xx only (not network error): distinguishes transient partner-server faults from permanent connection issues; no new npm deps

v1.3 locked decisions (12-01 additions):
- No Trading Cult URLs hardcoded in config defaults — registrationUrl/conversionUrl default to empty string; set via PUT /api/tracking/settings post-deploy (brand-neutral config)
- partnerPostback: false for all free_trial_signup/free_challenge_signup/pap_free_signup — $0 events must not fire S2S conversion postback (fraud-filter risk); registration signal from signup_completed: true
- No toJSON masking for partnerPostback URLs — URL templates are not credentials (unlike webhookSecret/accessToken)
- 4-file atomic commit pattern for new destination: DESTINATIONS tuple + interface + model sub-schema + validation block must ship together or TS types are inconsistent

v1.3 locked decisions (11-03 additions):
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
- Phase 12 success criterion 5 (live Trading Cult postback verify) is a post-deploy checkpoint — not a Phase 12 blocker. Code-level proof (10/10 behavioral harness PASS + 0-error whole-chain tsc) is complete; only the live-partner-endpoint test remains, gated on next main-2026 deploy + Trading Cult providing real URL templates. Checklist recorded in `.planning/phases/12-partner-postback-adapter/12-03-VERIFY.md` section 4.

## Session Continuity

Last session: 2026-07-01
Stopped at: 12-03 complete — partnerPostback behavioral verification (b8721f2, parent-repo docs commit, no pft-backend code change). Stubbed-fetch harness 10/10 PASS (skip-guards, FTD gate, registration/conversion GET shapes, encode-once round-trip, 5xx retry, never-throws). Whole-chain scoped tsc: 0 errors across all 7 Tracking files. 12-03-VERIFY.md + 12-03-SUMMARY.md written. v1.3 CRM Partner Tracking is code-complete AND code-level verified — 9/9 plans across Phases 10-12 done.
Resume file: None — v1.3 is complete (code + verification). Next: v1.4 margin history enhancement (see Pending Todos), OR post-deploy human-verify sweep for v1.0/v1.1/v1.2/v1.3 (v1.3's only remaining item is the SC5 live Trading Cult postback checklist in 12-03-VERIFY.md section 4), OR /gsd:complete-milestone for v1.3.
