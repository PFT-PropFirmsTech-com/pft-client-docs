---
phase: 14-klaviyo-language-property
verified: 2026-07-03T12:48:07Z
status: human_needed
score: 5/5 must-haves verified (code-complete); live Klaviyo visibility pending post-deploy human check
---

# Phase 14: Klaviyo Language Property Verification Report

**Phase Goal:** Every Klaviyo-bound event carrying an email also carries the client's
language as a profile/event property, derived from real user data via a defined
fallback order, and the existing stray `Language: ja` profile property is confirmed
superseded (not left as stale one-off data).

**Verified:** 2026-07-03T12:48:07Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stored `preferredLanguage` produces matching Klaviyo `Language` property (not hardcoded/English-only) | ✓ VERIFIED | `deriveUserLanguage` step 1 returns `normalizeLanguage(user.preferredLanguage)` for any non-empty stored value, including explicit `"en"`. Tested `{preferredLanguage:"ja-JP"}`→`"ja"` and `{preferredLanguage:"en"}`→`"en"` under project's actual CommonJS/ts-node runtime. |
| 2 | No stored pref but phone region / address country → best-effort via defined source order | ✓ VERIFIED | `deriveUserLanguage` steps 2–3 use `validatePhone()` (existing libphonenumber-js wrapper) then `country`/`countryCode` via closed `COUNTRY_TO_LANGUAGE`/`COUNTRY_NAME_TO_ISO2` maps. Tested JP phone (`+819012345678`→`"ja"`), `country:"Japan"`→`"ja"`, `countryCode:"JP"`→`"ja"` under real project module system (ts-node/CommonJS, matching production `swc`/`ts-node-dev`). |
| 3 | None of the sources present → property OMITTED, never a placeholder default | ✓ VERIFIED | `deriveUserLanguage` returns `undefined` (not `"en"`) when nothing resolves — confirmed for unmapped country (`"France"`) and empty/null user. `enrichUserData` sets `payload.language = payload.language ?? deriveUserLanguage(u) ?? undefined` (no default injected). `klaviyo.ts` guards both writes on presence: `if (payload.language) profileAttributes.Language = ...` and `set("language", payload.language)` (the `set()` helper itself skips `undefined`/`null`/`""`). |
| 4 | Source order applied consistently across every Klaviyo-bound event carrying an email, not just purchases | ✓ VERIFIED | `deriveUserLanguage` is invoked exactly once, inside `enrichUserData()` (`tracking/enrichment/user-data.ts`), which `tracking.service.ts` `dispatch()` calls unconditionally at line 164 whenever `payload.userId` is set — before fan-out to any destination adapter. `klaviyoAdapter` is only ever invoked via this central `dispatch()`/`Promise.allSettled` fan-out (registered once in `destinations/index.ts`); no other call site sends directly to Klaviyo, bypassing enrichment. |
| 5 | Existing `Language: ja` on live profile confirmed produced by this implementation going forward / documented stale, no mystery second code path | ✓ VERIFIED (code-level); live confirmation is human/post-deploy | `14-KLAV09-FINDING.md` sweep independently reproduced: zero non-adapter Klaviyo profile-attribute writers in `pft-backend/src`; zero `_learnq`/browser Klaviyo identify calls in `pft-dashboard`/`pft-web`/`My-Forex-Firm-Web`; the only `profileAttributes.Language` writer in the entire backend is `destinations/klaviyo.ts:83`, added by this phase. Conclusion (stale pre-existing data, no second code path) is well-supported. Confirming that the *live* profile's `Language` value actually gets overwritten/refreshed on its next event requires a post-deploy Klaviyo dashboard check — flagged as human verification, not a gap. |

**Score:** 5/5 truths verified at the code level; criterion 5's live-profile confirmation is inherently a post-deploy observation (Klaviyo dashboard), consistent with this project's standing "live Klaviyo visibility = post-deploy human-verify" convention.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pft-backend/src/app/utils/language.util.ts` | `deriveUserLanguage(user)` → `'ja'\|'en'\|undefined`, omit-when-unknown | ✓ VERIFIED | Exported function present (line 92), closed `COUNTRY_TO_LANGUAGE`/`COUNTRY_NAME_TO_ISO2` maps present, `normalizeLanguage`/`isNonDefaultLanguage`/`isBlankHtml` untouched (still default to `"en"`). Wired: imported in `enrichment/user-data.ts`. |
| `pft-backend/src/app/modules/Tracking/enrichment/user-data.ts` | Sets `payload.language` from loaded User doc | ✓ VERIFIED | `.select()` extended with `preferredLanguage countryCode` (no extra query, same `findById`); `deriveUserLanguage` imported and called; caller-precedence pattern (`payload.language ?? deriveUserLanguage(u) ?? undefined`) matches existing field conventions. |
| `pft-backend/src/app/modules/Tracking/tracking.interface.ts` | `language?: string` field on `ITrackingEventPayload` | ✓ VERIFIED | Line 274: `language?: string;` with explanatory comment at line 272. |
| `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts` | `Language` set on profile attributes AND event properties when present | ✓ VERIFIED | Line 83: `if (payload.language) profileAttributes.Language = payload.language;` (profile, capital-L key matching the stray live property). Line 39 in `buildProperties()`: `set("language", payload.language);` (event property, lowercase, gated by the `set()` helper's undefined/null/empty guard). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `enrichment/user-data.ts` | `utils/language.util.ts` | `deriveUserLanguage(user)` call | ✓ WIRED | Import present, called with the `.lean()`-loaded user doc containing `preferredLanguage`/`phone`/`country`/`countryCode`. |
| `destinations/klaviyo.ts` | `payload.language` | `profileAttributes.Language = payload.language` when defined | ✓ WIRED | Presence-gated write confirmed at line 83; also mirrored into event `properties.language` via `buildProperties()`. |
| `tracking.service.ts dispatch()` | `enrichUserData` | Already-called when `payload.userId` set | ✓ WIRED | Confirmed at line 164: `if (payload.userId) { payload = await enrichUserData(payload); }`, executed before the `Promise.allSettled` adapter fan-out at line 196. No dispatcher change was needed or made. |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| KLAV-05 (language as segmentable Klaviyo profile property on every email-bearing event) | ✓ SATISFIED | Centralized derivation + presence-gated profile/event writes confirmed in code; applies to all events dispatched with a resolvable `userId`, independent of event type. |
| KLAV-09 (defined source order + confirmed code ownership of stray live property) | ✓ SATISFIED (code); live overwrite confirmation is human/post-deploy | Sweep independently reproduced empty (see truth 5); finding doc accurately documents the state of the codebase at verification time. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | No TODO/FIXME/placeholder/stub patterns, no empty-implementation returns, no console.log-only handlers in any of the 4 touched files. |

### Scoped Typecheck

`npx tsc --noEmit --skipLibCheck` run against all 4 touched files simultaneously: zero
errors attributed to `language.util.ts`, `enrichment/user-data.ts`, `destinations/klaviyo.ts`,
or `tracking.interface.ts`. The only errors surfaced are pre-existing, out-of-scope,
transitively-imported errors in `Intercom/intercom-queue.service.ts`, `Intercom/intercom.service.ts`,
`utils/logger.ts`, and `config/index.ts` — matching the documented convention exactly.

### Behavioral Verification (derivation logic)

Ran the 8 documented cases from the plan's verify steps against the actual
`deriveUserLanguage` implementation, using the project's real module system
(`ts-node --transpile-only` with `module: commonjs`, matching production's
`ts-node-dev`/`swc` — NOT a bare `tsx`/ESM harness, which produces a spurious
`libphonenumber-js` metadata-interop error unrelated to the actual code):

```
PASS stored ja-JP: got "ja", expected "ja"
PASS stored explicit en: got "en", expected "en"
PASS JP phone only: got "ja", expected "ja"
PASS Japan country name: got "ja", expected "ja"
PASS ISO countryCode JP: got "ja", expected "ja"
PASS unmapped France country / empty: got undefined, expected undefined
PASS empty user: got undefined, expected undefined
PASS null user: got undefined, expected undefined
```

All 8/8 pass. (Note for future verifiers: testing this file with `tsx` directly
produces a false failure on the phone-fallback case due to an ESM/CommonJS
metadata-loading mismatch in how `libphonenumber-js` is bundled — always test
Tracking-module code with `ts-node --transpile-only -O '{"module":"commonjs"}'`
or via the project's actual `ts-node-dev` dev script, not `tsx`.)

### Human Verification Required

#### 1. Live Klaviyo profile `Language` overwrite/confirmation

**Test:** After the next `main-2026` deploy, trigger any email-bearing tracked event
(e.g. a purchase or signup) for the specific live Klaviyo profile that currently shows
the stray `Language: ja` custom property, where that user's `preferredLanguage`/`phone`/
`country` data resolves to `"ja"` via `deriveUserLanguage`.
**Expected:** The profile's `Language` property in the Klaviyo dashboard is
written/refreshed with value `"ja"` by the Events API call from this adapter (visible via
Klaviyo's profile activity/API log correlating to the event `unique_id`), confirming this
code path is now the sole active source for that key rather than a differently-cased
duplicate property.
**Why human:** Requires live Klaviyo dashboard access and a real production deploy —
cannot be observed from the codebase alone.

#### 2. New JP user (no stored preference) end-to-end Klaviyo property

**Test:** After deploy, have a test user with a JP phone number or JP address country
(and no `preferredLanguage` set) trigger any email-bearing tracked event.
**Expected:** Klaviyo profile shows `Language: ja` and the corresponding event carries a
`language: "ja"` custom property, without any explicit stored locale.
**Why human:** Requires live Klaviyo account visibility and a real triggered event;
cannot be confirmed from static code alone.

#### 3. Omission case in production

**Test:** After deploy, trigger an email-bearing event for a user with no
`preferredLanguage`, an unmapped-country phone/address (e.g. US, France, Germany), and
confirm in Klaviyo.
**Expected:** The event fires successfully but the `Language` profile attribute and
`language` event property are absent (not set to `"en"` or any placeholder) for that event.
**Why human:** Verifying an *absence* of a property in Klaviyo's UI/API requires live
account access.

### Gaps Summary

No gaps found. All 5 must-have observable truths, all 4 required artifacts (existence +
substantive + wired), and all 3 key links are verified directly against the live
`main-2026` code (commits `58567207`, `f86d1ba3`). The scoped typecheck is clean for
every touched file, and the derivation logic was independently re-executed (not just
read) against 8 cases covering all 3 fallback sources plus the omission path, all
passing under the project's real module-resolution settings. The KLAV-09 sweep commands
were independently re-run (not just trusted from the finding doc) and reproduced
identical empty results, supporting the "no hidden second code path" conclusion.

The only remaining items are inherently un-verifiable from static code — they require a
live Klaviyo dashboard after the next deploy, consistent with this project's standing
post-deploy human-verify convention for Klaviyo-facing changes. These are recorded as
human-verification items, not gaps, per the phase's own SUMMARY which already flagged
live verification as deploy-gated.

---

*Verified: 2026-07-03T12:48:07Z*
*Verifier: Claude (gsd-verifier)*
