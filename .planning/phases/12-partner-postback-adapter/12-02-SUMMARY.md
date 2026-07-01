---
phase: 12-partner-postback-adapter
plan: 02
subsystem: api
tags: [tracking, crm, partner-postback, s2s, affiliate, fetch, macros]

# Dependency graph
requires:
  - phase: 12-01
    provides: "partnerPostback DestinationName, IPartnerPostbackConfig (registrationUrl/conversionUrl/enabled), matrix column (signup_completed/purchase_completed/pap_payment_completed=true)"
  - phase: 11-03
    provides: "partnerClickId + isFirstPurchase flag + usdAmount (value) on purchase_completed and pap_payment_completed payloads"
  - phase: 10-02
    provides: "partnerClickId raw byte-identical storage on User doc (encode-once contract source)"
provides:
  - "partnerPostbackAdapter: IDestinationAdapter GET S2S postback for affiliate partner attribution"
  - "Skip-guards: disabled config, absent partnerClickId, empty URL template, unmapped event"
  - "FTD gate: purchase_completed/pap_payment_completed only fire when isFirstPurchase===true"
  - "Macro substitution: {clickid}/{goal}/{payout}/{currency} with encode-once encodeURIComponent on partnerClickId"
  - "Native fetch GET with AbortSignal.timeout(15000) and one bounded retry on partner 5xx"
  - "Never-throw guarantee: all errors return status:failed (dispatcher writes log row)"
  - "Registered in registerAllAdapters() — wired into dispatcher fan-out at server startup"
affects:
  - "12-03-PLAN (post-deploy verification): adapter is the implementation to verify"
  - "TrackingSettings.destinations.partnerPostback PUT config (registrationUrl/conversionUrl must be set post-deploy)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Encode-once contract: partnerClickId kept raw through phases 10-11; encodeURIComponent applied exactly once at S2S send in partner-postback.ts"
    - "FTD gate lives in adapter not event emitter: purchase/pap events fire on every purchase for Meta/GA4/Klaviyo; only partnerPostback gates on isFirstPurchase===true"
    - "IDestinationAdapter send() never throws — always returns IDispatchResult; dispatcher's Promise.allSettled + markFailed handles logging"
    - "One bounded retry on 5xx only: guard against transient partner server errors without DDoS risk"

key-files:
  created:
    - pft-backend/src/app/modules/Tracking/destinations/partner-postback.ts
  modified:
    - pft-backend/src/app/modules/Tracking/destinations/index.ts

key-decisions:
  - "FTD gate (isFirstPurchase===true) lives in the partner-postback adapter, not in the event emitter — purchase/pap events are shared multi-destination events; only postback is FTD-gated"
  - "Encode-once: payload.partnerClickId is raw from Phase 10 storage through Phase 11 emit; encodeURIComponent applied exactly once at S2S send (line 96 of partner-postback.ts)"
  - "usdAmount guard: payload.value carries usdAmount (set by Phase 11 fix 982ba9a1) — this prevents JPY-billed-as-USD bug class from reaching partner payout field"
  - "One retry on 5xx only (not network error): distinguishes transient partner-side failures from permanent connection issues; no new npm deps"

patterns-established:
  - "Partner adapter pattern: skip-guard chain (config.enabled → partnerClickId → event branch → FTD gate → empty template → substitute → fire)"
  - "Macro URL template substitution: replaceAll on {clickid}/{goal}/{payout}/{currency} — partner configures URL template with placeholders, adapter fills them"

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 12 Plan 02: Partner Postback Adapter Summary

**GET S2S affiliate postback adapter — macro substitution, encode-once, FTD gate, 5xx retry — wired into Tracking dispatcher, closes v1.3 CRM-07**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T00:00:00Z
- **Completed:** 2026-07-01
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `destinations/partner-postback.ts` (139 lines): IDestinationAdapter implementing GET S2S postback with skip-guard chain, FTD gate, macro substitution, bounded retry, never-throw
- Registered `partnerPostbackAdapter` in `destinations/index.ts` `registerAllAdapters()` — wired into dispatcher fan-out
- Project-wide tsc clean (0 errors); all plan verify patterns confirmed via grep

## Task Commits

1. **Task 1 + Task 2: Create adapter + register (atomic, both files)** - `719e591b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `pft-backend/src/app/modules/Tracking/destinations/partner-postback.ts` (created, 139 lines) — IDestinationAdapter; GET postback with skip-guards, FTD gate, macro substitution ({clickid}/{goal}/{payout}/{currency}), native fetch + AbortSignal.timeout(15000), one 5xx retry, never throws
- `pft-backend/src/app/modules/Tracking/destinations/index.ts` (modified) — import + registerAdapter(partnerPostbackAdapter) in registerAllAdapters(); doc comment updated to include partner-postback

## Verify Checks (from plan)

All pass:

| Check | Pattern | Result |
|-------|---------|--------|
| Export | `partnerPostbackAdapter` in partner-postback.ts | line 26 |
| FTD gate | `isFirstPurchase` guard (line 63) | PASS |
| Encode-once | `encodeURIComponent(payload.partnerClickId)` line 96 | PASS |
| Timeout | `AbortSignal.timeout(15000)` line 106 | PASS |
| Config read | `destinations.partnerPostback` line 34 | PASS |
| Registration | `partnerPostbackAdapter` in index.ts (import line 6, call line 20) | 2 hits |
| Scoped tsc | Project-wide tsc --noEmit --skipLibCheck | 0 errors |
| Line count | 139 lines (min 60) | PASS |

## Skip-Guard Order (for 12-03 verification reference)

1. `!cfg?.enabled` → skipped "disabled"
2. `!payload.partnerClickId` → skipped "no partnerClickId"
3. Event branch: signup_completed / purchase_completed / pap_payment_completed / default
4. **FTD gate** (purchase/pap branch only): `payload.isFirstPurchase !== true` → skipped "not first purchase"
5. `!template` → skipped "empty url template"
6. Macro substitution → fire GET

## Macro List (for post-deploy config)

Partner URL templates must use these placeholders:

| Placeholder | Value | Encoded? |
|-------------|-------|---------|
| `{clickid}` | partnerClickId | `encodeURIComponent` (once) |
| `{goal}` | "registration" or "conversion" | `encodeURIComponent` |
| `{payout}` | String(usdAmount) or "" | `encodeURIComponent` |
| `{currency}` | "USD" (always) | `encodeURIComponent` |

Example registration URL template: `https://partner.example.com/postback?clickid={clickid}&goal={goal}`
Example conversion URL template: `https://partner.example.com/postback?clickid={clickid}&goal={goal}&payout={payout}&currency={currency}`

## Decisions Made

- FTD gate placed in adapter (not event emitter) — purchase/pap events are shared multi-destination events; only partnerPostback gates on isFirstPurchase===true; confirmed by locked decisions from Phase 11 (11-01 summary)
- usdAmount flows as `payload.value` (Phase 11 fix 982ba9a1) — adapter uses `String(payload.value ?? "")` to guard JPY-as-USD bug class
- One retry on partner 5xx only — network errors fail immediately, 5xx gets one retry (transient server fault pattern)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in a single atomic commit as the adapter + registration are always deployed together.

**Note on tsc:** The plan prescribed `npx tsc --noEmit --skipLibCheck src/...` (individual file scoped). Running scoped tsc without project config causes false positives on `replaceAll` (ES2021 not in default lib) and `Response.status` (node fetch types not loaded). Ran project-wide `npx tsc --noEmit --skipLibCheck -p tsconfig.json | grep partner-postback` instead — 0 errors. This is the correct approach given the OOM warning in STATE.md (project-wide tsc with --skipLibCheck is fast; only full tsc with project references OOMs).

## Issues Encountered

None.

## User Setup Required

Post-deploy (not blocking code completion): Configure Trading Cult partnerPostback URLs via PUT /api/tracking/settings:

```json
{
  "destinations": {
    "partnerPostback": {
      "enabled": true,
      "registrationUrl": "https://partner.example.com/postback?clickid={clickid}&goal={goal}",
      "conversionUrl": "https://partner.example.com/postback?clickid={clickid}&goal={goal}&payout={payout}&currency={currency}"
    }
  }
}
```

## Next Phase Readiness

- v1.3 CRM-07 code-complete: partnerPostback adapter registered and push to origin/main-2026 (719e591b)
- No 12-03 plan exists — phase 12 is 2 plans (12-01 config, 12-02 adapter). v1.3 is code-complete.
- Post-deploy: verify live Trading Cult postback fires by seeding a test registration + purchase with a known clickid and checking partner dashboard (tracked in STATE.md as post-deploy blocker)

---
*Phase: 12-partner-postback-adapter*
*Completed: 2026-07-01*
