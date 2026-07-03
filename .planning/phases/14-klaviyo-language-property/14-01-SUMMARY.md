---
phase: 14-klaviyo-language-property
plan: 01
subsystem: tracking
tags: [klaviyo, tracking, language, i18n, libphonenumber-js, enrichment]

# Dependency graph
requires: []
provides:
  - "deriveUserLanguage() — omit-when-unknown language derivation (stored locale -> phone region -> address country)"
  - "language field on ITrackingEventPayload, set centrally in enrichUserData"
  - "Klaviyo profile property Language + mirrored event property language"
  - "KLAV-09 finding: stray live Language:ja confirmed not produced by any second code path"
affects: [15-purchase-enrichment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Omit-when-unknown derivation sibling function (deriveUserLanguage) alongside an always-defaults-to-en function (normalizeLanguage) in the same util module — same domain, deliberately different guess-vs-omit semantics for different consumers"
    - "Centralized per-event enrichment in enrichUserData() as the single point where derived (not just passthrough) user properties are computed, so every Klaviyo-bound event benefits without dispatcher changes"

key-files:
  created:
    - .planning/phases/14-klaviyo-language-property/14-KLAV09-FINDING.md
  modified:
    - pft-backend/src/app/utils/language.util.ts
    - pft-backend/src/app/modules/Tracking/enrichment/user-data.ts
    - pft-backend/src/app/modules/Tracking/tracking.interface.ts
    - pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts

key-decisions:
  - "deriveUserLanguage is a NEW sibling function, not a modification of normalizeLanguage — normalizeLanguage's always-en-default behavior is relied on elsewhere and must not change"
  - "Phone/country fallback uses a closed COUNTRY_TO_LANGUAGE map (JP only) — unmapped countries fall through to omission rather than defaulting to en, per success criterion 3"
  - "Klaviyo profile key is capitalized `Language` (matching the pre-existing stray live property) so this code becomes the de-facto owner/overwriter of that exact key, not a duplicate differently-cased property"

patterns-established:
  - "Derivation utils that must never guess return `T | undefined`, not a defaulted value — keep them named/documented distinctly from their always-default siblings"

# Metrics
duration: 3min
completed: 2026-07-03
---

# Phase 14 Plan 01: Klaviyo Language Property Summary

**New `deriveUserLanguage()` util (stored locale -> phone region -> address country, omit-when-unknown) wired into the Tracking module's central `enrichUserData()` so every Klaviyo-bound event carries a `Language` profile property, plus a KLAV-09 sweep confirming no hidden second code path ever wrote that property.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-03T14:41:00+02:00 (approx, per commit timestamps)
- **Completed:** 2026-07-03T14:42:49+02:00
- **Tasks:** 3 completed
- **Files modified:** 4 (3 code files touched across 2 commits, 1 finding doc)

## Accomplishments
- `deriveUserLanguage()` added to `language.util.ts`: first-resolving-wins fallback order (stored `preferredLanguage` → phone region via existing `validatePhone()` → address `country`/`countryCode`), returns `undefined` (never a guessed "en") when nothing resolves. Verified against 6 cases including explicit stored "en", JP phone, "Japan" full-name country, ISO `countryCode: "JP"`, and the unmapped/empty omission case.
- `language` field added to `ITrackingEventPayload`; `enrichUserData()` (the single centralized enrichment point that already runs for every event with a `userId`) now loads `preferredLanguage`/`countryCode` (no extra query — same `findById`) and sets `payload.language` via `deriveUserLanguage`, honoring any caller-supplied value first.
- Klaviyo adapter sets `profileAttributes.Language` (capital L, matching the existing live property key) on the profile object, and mirrors it as a lowercase `language` event property in `buildProperties()` — both gated on presence, so nothing is emitted when derivation yields `undefined`.
- KLAV-09 sweep re-run and recorded: no server-side Klaviyo profile-attribute writer exists anywhere in `pft-backend` outside `destinations/klaviyo.ts`; no browser-side `_learnq`/Klaviyo identify call exists in `pft-dashboard`, `pft-web`, or `My-Forex-Firm-Web`. Finding doc written establishing this phase's adapter line as the sole going-forward owner of the `Language` key.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deriveUserLanguage() derivation util** - `58567207` (feat)
2. **Task 2: Wire language into central enrichment + payload type + Klaviyo profile/event props** - `f86d1ba3` (feat)
3. **Task 3: KLAV-09 finding doc** - documentation only, committed with plan metadata (no pft-backend code change)

**Plan metadata:** committed alongside this SUMMARY + STATE.md update (see final commit).

_Note: Task 3 produced only a planning document (`.planning/...`), not a pft-backend source change, so it has no separate pft-backend commit — it is committed with this plan's metadata commit in the parent repo._

## Files Created/Modified
- `pft-backend/src/app/utils/language.util.ts` - Adds `deriveUserLanguage()`, `COUNTRY_TO_LANGUAGE`/`COUNTRY_NAME_TO_ISO2` closed maps, `mapCountryToLanguage()` helper; imports `validatePhone` from `./phone`
- `pft-backend/src/app/modules/Tracking/enrichment/user-data.ts` - Extends `.select()` with `preferredLanguage countryCode`; sets `payload.language` via `deriveUserLanguage`
- `pft-backend/src/app/modules/Tracking/tracking.interface.ts` - Adds `language?: string` to `ITrackingEventPayload`
- `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts` - Sets `profileAttributes.Language` when present; mirrors `language` in `buildProperties()`
- `.planning/phases/14-klaviyo-language-property/14-KLAV09-FINDING.md` - Sweep commands + output + ownership conclusion for KLAV-09

## Decisions Made
- Used a static `import { validatePhone } from "./phone"` in `language.util.ts` rather than a lazy `require()` — no circular-import risk exists (`phone.ts` has zero sibling imports), so a normal ES import is cleaner and correctly typed.
- Kept `normalizeLanguage()` completely untouched; `deriveUserLanguage()` reuses it only for the stored-locale branch, per the plan's explicit instruction not to modify existing "always defaults to en" callers' behavior.

## Deviations from Plan

None - plan executed exactly as written. The only implementation-level judgment call (static import vs. the plan's suggested lazy require for `validatePhone`) is a strict improvement with identical runtime behavior, not a functional deviation, and is noted above under Decisions Made rather than as a Rule 1-4 deviation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (Existing Klaviyo `privateKey` config, already required by the pre-existing adapter, is unchanged.)

## Next Phase Readiness
- Phase 14 (Klaviyo Language Property) is now code-complete for its single plan. No further plans exist under `14-klaviyo-language-property/`.
- Live verification (confirming a real JP-phone/no-locale user actually produces `Language: ja` on the next tracked event, and that the stray profile's value gets overwritten/confirmed) is gated on the next `main-2026` deploy, consistent with the project-wide post-deploy human-verify convention.
- Phase 15 (Purchase Enrichment) has no dependency on this phase and can be planned/executed independently.

---
*Phase: 14-klaviyo-language-property*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: .planning/phases/14-klaviyo-language-property/14-KLAV09-FINDING.md
- FOUND: pft-backend/src/app/utils/language.util.ts
- FOUND: pft-backend/src/app/modules/Tracking/enrichment/user-data.ts
- FOUND: pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts
- FOUND: pft-backend/src/app/modules/Tracking/tracking.interface.ts
- FOUND commit: 58567207 (Task 1)
- FOUND commit: f86d1ba3 (Task 2)
