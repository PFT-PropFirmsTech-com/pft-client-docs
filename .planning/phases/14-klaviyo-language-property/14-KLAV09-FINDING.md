# KLAV-09 Finding: Stray live `Language: ja` Klaviyo profile property

**Date:** 2026-07-03
**Phase:** 14-klaviyo-language-property, Plan 01, Task 3
**Requirement:** KLAV-09 — confirm the pre-existing `Language: ja` custom property observed
on one live Klaviyo profile is not produced by a second/hidden code path, and establish
code ownership of the `Language` profile property going forward.

## Sweep commands run and results

All three sweeps were run from the repo root (`PFT-WhiteLabel-v2-staging/`), covering
`pft-backend` (server) and every frontend repo present in the working tree
(`pft-dashboard`, `pft-web`, `My-Forex-Firm-Web`).

### Sweep 1 — backend: any Klaviyo profile-attribute writer other than our adapter

```
grep -rniE "klaviyo" pft-backend/src | grep -iE "language|phone_number_region|profileAttributes|profile" | grep -vi "destinations/klaviyo.ts"
```

Output (only this phase's own doc comments — no other code path):

```
pft-backend/src/app/utils/language.util.ts:73: * Derive a user's Klaviyo-segmentable language from real user data, using a
pft-backend/src/app/modules/Tracking/tracking.interface.ts:272:  // Derived Klaviyo profile language (ISO 639-1, e.g. 'ja'/'en').
```

Both hits are comments/field declarations added by this plan's Tasks 1-2, not a second
Klaviyo writer. No other `profileAttributes`/profile-mutation code exists anywhere in
`pft-backend/src` outside `destinations/klaviyo.ts`.

### Sweep 2 — browser-side Klaviyo identify / `_learnq` across all frontends

```
grep -rniE "_learnq|klaviyo|phone_number_region" pft-dashboard pft-web My-Forex-Firm-Web 2>/dev/null | grep -iE "language|_learnq|identify|phone_number_region"
```

Output: **empty** (no matches). Confirmed all three frontend directories exist and were
searched (`pft-dashboard`, `pft-web`, `My-Forex-Firm-Web`). There is no Klaviyo onsite JS
snippet, `_learnq` push, or `klaviyo.identify()` call anywhere in any frontend repo in this
working tree.

### Sweep 3 — confirm the only writer of a Klaviyo `Language` profile key

```
grep -rn "profileAttributes.Language" pft-backend/src
```

Output (single hit — the line added by this plan's Task 2):

```
pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts:83:      if (payload.language) profileAttributes.Language = payload.language;
```

### Supplementary check — any other Klaviyo API call site in the backend

```
grep -rniE "a\.klaviyo\.com|klaviyo-api-key" pft-backend/src | grep -vi "destinations/klaviyo.ts"
```

Output: **empty**. `destinations/klaviyo.ts` is the sole integration point with the
Klaviyo API anywhere in `pft-backend` (no profiles-API script, no list-import script, no
admin one-off endpoint).

## Conclusion

The stray live `Language: ja` custom property was **not produced by any code path in any
repo** present in this working tree (`pft-backend`, `pft-dashboard`, `pft-web`,
`My-Forex-Firm-Web`) prior to this phase:

- No server-side Klaviyo profile-attribute writer existed anywhere except the single
  adapter file, and that file (pre-Task-2) never set a `Language` key.
- No browser-side Klaviyo onsite JS (`_learnq`, `klaviyo.identify()`, etc.) exists in any
  frontend repo.

The most plausible explanations are external to this codebase: a manual edit in the
Klaviyo dashboard, a one-off CSV/list import, or Klaviyo's own onsite tracking snippet
installed directly in Klaviyo (not present in any of our repos) — none of which this
sweep can observe further, and none of which constitute a hidden code path in our systems.

## Ownership statement (going forward)

As of this phase, `pft-backend/src/app/modules/Tracking/destinations/klaviyo.ts`
(`profileAttributes.Language = payload.language`, added in Task 2 of this plan) is the
**sole code source** of the Klaviyo `Language` profile property going forward. Because
it uses the exact same `Language` key (capital L) as the pre-existing stray value, the
next email-bearing tracked event for that profile will **overwrite/confirm** the existing
`ja` value in place — not create a duplicate, differently-cased property.

No data migration is required. The stray value is harmless and will be reconciled
naturally the next time that profile's user triggers any Klaviyo-bound tracking event
with a resolvable language (via `enrichUserData` → `deriveUserLanguage`).

This satisfies success criterion 5 of Phase 14 Plan 01.
