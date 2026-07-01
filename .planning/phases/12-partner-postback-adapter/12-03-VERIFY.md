# 12-03 Verification Results — partnerPostback Adapter Behavioral Verification (CRM-07 / CRM-09)

Verifies Phase 12 success criteria (SC1-4) at the code level via a stubbed-fetch
behavioral harness against `partnerPostbackAdapter.send()`, plus a whole-chain
scoped typecheck. SC5 (live Trading Cult postback test) is captured below as a
DEFERRED post-deploy checkpoint, per project convention (post-deploy human-verify
is not a phase blocker).

## 1. Behavioral Harness — 10/10 PASS

Throwaway script `pft-backend/scripts/_tmp_verify_partner_postback.ts` (deleted
after run, per plan preflight — Phase 12 ships no permanent test). Ran via
`npx ts-node --transpile-only scripts/_tmp_verify_partner_postback.ts`. Imported
`partnerPostbackAdapter` directly, stubbed `global.fetch` as a call-recorder
returning queued `{ok,status}` responses (or throwing to simulate a network
failure), and constructed a fake `ctx.settings.destinations.partnerPostback`
config (cast as any). Captured stdout:

```
PASS [1] partnerClickId absent -> skipped, fetch not called
PASS [2] enabled:false -> skipped, fetch not called
PASS [3] empty registrationUrl -> skipped, fetch not called
PASS [4] registration GET: fetch once, exact url, method GET, result sent
PASS [5] purchase_completed isFirstPurchase:false -> skipped (FTD gate), fetch not called
PASS [6] conversion GET (purchase_completed): fetch once, exact url, result sent
PASS [7] conversion GET (pap_payment_completed): fetch once, exact url, payout=150, result sent
PASS [8] ENCODING: url contains clickid=a%2Bb%3Dc%2Fd and decodeURIComponent round-trips to original (SC4)
PASS [9] RETRY: 503 then 200 -> fetch called twice, result sent
warn: partner-postback adapter failed for signup_completed: simulated fetch timeout
PASS [10] FAILURE: fetch throws -> status failed, no throw escapes
---
10/10 PASS
```

(The `warn:` line is the adapter's own `logger.warn` call inside the caught
`catch` block for case 10 — expected output, not an error.)

### Case-by-case detail

| # | Case | Assertion | Result |
|---|------|-----------|--------|
| 1 | `partnerClickId` absent | `{status:"skipped"}`, fetch NOT called | PASS |
| 2 | `enabled:false` | `{status:"skipped"}`, fetch NOT called | PASS |
| 3 | empty `registrationUrl` for `signup_completed` | `{status:"skipped"}`, fetch NOT called | PASS |
| 4 | `signup_completed` + clickid `"ABC123"` | fetch ONCE, `url === "https://partner.test/reg?clickid=ABC123&goal=registration"`, method GET, result `"sent"` | PASS |
| 5 | `purchase_completed` + clickid + `isFirstPurchase:false` | `{status:"skipped"}` (FTD gate), fetch NOT called | PASS |
| 6 | `purchase_completed` + clickid + `isFirstPurchase:true` + `value:99` | fetch ONCE, `url === ".../conv?clickid=ABC123&goal=conversion&payout=99&currency=USD"`, result `"sent"` | PASS |
| 7 | `pap_payment_completed` + clickid + `isFirstPurchase:true` + `value:150` | same conversion shape, `payout=150` | PASS |
| 8 | ENCODING — clickid `"a+b=c/d"` on signup | url contains `clickid=a%2Bb%3Dc%2Fd`; `decodeURIComponent("a%2Bb%3Dc%2Fd") === "a+b=c/d"` (round-trips to original — SC4) | PASS |
| 9 | RETRY — conversion first fetch returns 503, second returns 200 | fetch called TWICE, result `"sent"` | PASS |
| 10 | FAILURE — fetch throws (simulated timeout) | `{status:"failed"}`, no throw escapes the adapter | PASS |

No adapter bug found — all 10 assertions passed on the first run with zero
code changes required to `partner-postback.ts`.

## 2. Whole-Chain Scoped Typecheck — 0 errors in Tracking files

Command used (see note below on tsc invocation): a temporary `tsconfig`
override (`extends: "./tsconfig.json"`, `incremental:false`, `include:[]`,
explicit `files:` list of the 7 target files) run via
`npx tsc --noEmit --skipLibCheck -p <override>`, then deleted after the run
(not committed — throwaway, like the harness script).

Target files:
```
src/app/modules/Tracking/tracking.interface.ts
src/app/modules/Tracking/tracking.constants.ts
src/app/modules/Tracking/tracking.model.ts
src/app/modules/Tracking/tracking.validation.ts
src/app/modules/Tracking/tracking.service.ts
src/app/modules/Tracking/destinations/index.ts
src/app/modules/Tracking/destinations/partner-postback.ts
```

**Result: 0 errors in all 7 target files** (confirmed via
`grep -E "Tracking/(tracking\.interface|tracking\.constants|tracking\.model|tracking\.validation|tracking\.service|destinations/index|destinations/partner-postback)\.ts"`
against the tsc output — zero matches).

The compile did surface 13 pre-existing `error TS...` lines, all in
`src/app/modules/Intercom/intercom.service.ts`, which TypeScript pulls into
the program graph transitively (unrelated Intercom-destination model
resolution, not an import from any of the 7 Tracking files or their direct
enrichment/auth dependencies). Confirmed via `git diff` that
`Intercom/intercom.service.ts` is **byte-identical** between the pre-Phase-12
commit (`982ba9a1`) and current HEAD — this file was never touched by 12-01,
12-02, or 12-03. Pre-existing, unrelated to Phase 12, not a regression.

**Note on tsc invocation:** the plan's literal command
(`npx tsc --noEmit --skipLibCheck src/...` with bare file args, no `-p`)
reproduces the exact false-positive pattern 12-02 already documented
(`replaceAll` ES2021-lib / `esModuleInterop` errors) because passing bare
files drops the project's `tsconfig.json` compiler options entirely. Per
12-02's precedent, a project-config-aware invocation is required. Unlike
12-02 (`-p tsconfig.json` filtered via `grep`), a bare project-wide
`--skipLibCheck` compile OOM-crashed on this machine at both default and
`--max-old-space-size=8192` (matches `reference_backend_tsc_oom.md` — full
tsc crashes even at 8GB), so a scoped-`files` override tsconfig (correct
compiler options, much smaller file graph, `incremental:false` to avoid a
poisoned `.tsbuildinfo`) was used instead. Net effect is identical to the
plan's intent: proves the 7 Tracking files typecheck cleanly together with
correct compiler settings.

## 3. Success-Criteria Mapping

| SC | Description | Proven by |
|----|--------------|-----------|
| SC1 | Adapter registered + skips on absent clickid / empty url / disabled config | Harness cases 1, 2, 3 (skip-guards) + `destinations/index.ts` registration confirmed in whole-chain tsc (0 errors, adapter imports resolve) |
| SC2 | Registration GET fires with `goal=registration` + encoded clickid, no payout | Harness case 4 |
| SC3 | Conversion GET fires with `goal=conversion` + `payout=usdAmount` + `currency=USD`, gated on FTD (`isFirstPurchase===true`) | Harness cases 5 (gate skip), 6, 7 (both conversion event types) |
| SC4 | URL-special-char clickid (`+`, `=`, `/`) reaches the partner exactly via `encodeURIComponent` | Harness case 8 |
| CRM-09 | Config disabled-by-default (no Trading Cult URLs hardcoded) | 12-01 schema defaults — `registrationUrl`/`conversionUrl` default to `""`, `enabled` defaults false (verified in 12-01-SUMMARY.md, unchanged since) |

SC1-4 are proven at the code level. CRM-09's disabled-by-default guarantee
was already verified in 12-01 and is unchanged (confirmed no drift via the
whole-chain tsc + harness using the same `IPartnerPostbackConfig` shape).

## 4. SC5 — DEFERRED Live Trading Cult Postback Checkpoint

**Status: DEFERRED (post-deploy).** Not executed. Not a Phase 12 blocker —
matches the convention of every prior v1.3 phase (10-04, 11-03, etc.): code
correctness is proven pre-deploy via harness/tsc; live-system verification
against a real partner endpoint happens after the next `main-2026` deploy,
once Trading Cult's real registration + conversion URL templates are known.

Checklist to run post-deploy:

1. **Configure** (Trading Cult DB only, via existing admin endpoint):
   `PUT /api/tracking/settings` with body:
   ```json
   {
     "destinations": {
       "partnerPostback": {
         "enabled": true,
         "registrationUrl": "<partner registration template with {clickid}/{goal}>",
         "conversionUrl": "<partner conversion template with {clickid}/{goal}/{payout}/{currency}>"
       }
     }
   }
   ```
   Confirm 200 and that a follow-up `GET /api/tracking/settings` shows the
   saved URLs (they are NOT masked — they are not secrets).

2. **Registration test:** visit a partner tracking link
   `GET /api/tracking/track?clickid=TESTCLICK123`, complete a registration
   (one-step or OTP). Expect: a `TrackingEventLog` row for
   `destination:"partnerPostback"`, `eventName:"signup_completed"`,
   `status:"sent"`; and the partner's dashboard shows the registration with
   clickid `TESTCLICK123`.

3. **Conversion test:** same user completes their FIRST purchase (standard
   challenge OR PAP funded-leg). Expect: a `partnerPostback` log row for
   `purchase_completed`/`pap_payment_completed`, `status:"sent"`, and the
   partner sees `goal=conversion` with `payout` = the USD amount (NOT a JPY
   figure). A second purchase by the same user must NOT produce a conversion
   `partnerPostback` row (FTD gate).

4. **Brand isolation:** confirm a non-Trading-Cult brand (partnerPostback
   still disabled) fires ZERO `partnerPostback` log rows.

**Resume signal:** type "approved" once the live registration + conversion
postbacks land in the partner system (or describe the failure). This
checkpoint does not block Phase 12 completion or milestone v1.3 code-complete
status.

## Summary

- Behavioral harness: **10/10 PASS**.
- Whole-chain scoped tsc: **0 errors** in all 7 Tracking target files
  (13 pre-existing, unrelated errors in `Intercom/intercom.service.ts`,
  confirmed byte-identical since before Phase 12 started).
- SC1-4: proven at code level.
- SC5: **DEFERRED** — post-deploy live checklist recorded above.
- No adapter bug found; zero code changes needed.
- Milestone **v1.3 CRM Partner Tracking is code-complete**.
