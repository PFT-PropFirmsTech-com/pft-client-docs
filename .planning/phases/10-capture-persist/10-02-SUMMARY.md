---
phase: 10-capture-persist
plan: 02
subsystem: auth
tags: [mongoose, typescript, crm, partner-tracking, registration]

# Dependency graph
requires:
  - phase: 10-capture-persist/10-01
    provides: partnerClickId forwarded in signup body from dashboard to backend /auth/register

provides:
  - TUser.partnerClickId?: string (typed User document field)
  - TRegisterUser.partnerClickId?: string (typed registration payload field)
  - UserSchema partnerClickId indexed String field (Mongoose persistence)

affects:
  - 10-03 (TrackingSettings schema — reads User.partnerClickId for postback)
  - Phase 11 (event wiring — reads User.partnerClickId from user doc)
  - Phase 12 (S2S postback send — reads User.partnerClickId for macro substitution)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema-first persistence: add field to both TUser (document type) and TRegisterUser (payload type) + UserSchema; payload spread in service handles the rest automatically"
    - "skip-when-absent: no default on schema field; Mongoose strict mode drops undefined from spread — organic signups never get the field"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Auth/auth.interface.ts
    - pft-backend/src/app/modules/Auth/auth.model.ts

key-decisions:
  - "TUser also needs partnerClickId (not just TRegisterUser) because UserSchema is typed with TUser — TS2353 error without it"
  - "No default, no trim, no lowercase — value stored byte-identical per partner echo-back requirement"
  - "index: true on schema field — needed for Phase 11/12 lookups and support queries"
  - "auth.service.ts untouched — initiateRegistration already spreads {...payload} onto new User; schema presence is sufficient"

patterns-established:
  - "CRM field pattern: add to TUser + TRegisterUser + UserSchema (3 places, same file pair)"

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 10 Plan 02: User partnerClickId Schema + Interface Summary

**Indexed `partnerClickId` String field added to `UserSchema` + `TUser` + `TRegisterUser`, enabling automatic persistence of partner click IDs through the two-step OTP registration flow via existing payload spread**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T00:00:00Z
- **Completed:** 2026-07-01T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `partnerClickId?: string` added to `TUser` interface (document type, required for schema typing)
- `partnerClickId?: string` added to `TRegisterUser` interface (payload type, typed at controller)
- `partnerClickId: { type: String, index: true }` added to `UserSchema` in auth.model.ts (no default — skip-when-absent)
- Committed and pushed to `main-2026` (d2992553); HEAD == origin/main-2026

## Task Commits

1. **Task 1: Add partnerClickId to TUser + TRegisterUser interfaces + indexed UserSchema field** - `d2992553` (feat)
2. **Task 2: Commit + push to main-2026** - included in `d2992553`

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `pft-backend/src/app/modules/Auth/auth.interface.ts` - Added `partnerClickId?: string` to both `TUser` (line 315) and `TRegisterUser` (line 346)
- `pft-backend/src/app/modules/Auth/auth.model.ts` - Added `partnerClickId: { type: String, index: true }` to `UserSchema` (line 536)

## Decisions Made

- **TUser also needed the field:** The plan specified adding to `TRegisterUser` only, but `UserSchema` is typed with `TUser`. Scoped tsc caught `TS2353: partnerClickId does not exist in type`. Auto-fixed by also adding to `TUser` (Rule 1 — bug fix). One comment block covers both, each field has its own comment in the interface.
- **auth.service.ts untouched:** Confirmed — `initiateRegistration` at line 721-743 spreads `{...payload}` onto `new User()`; Mongoose now persists `partnerClickId` because the schema field exists. `verifyRegistrationOtp`'s `findByIdAndUpdate` (line 830-840) only touches referralCode/role/isRegistered/$unset — does not clobber `partnerClickId`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added partnerClickId to TUser in addition to TRegisterUser**
- **Found during:** Task 1 verification (scoped tsc)
- **Issue:** `UserSchema` is typed as `Schema<TUser>` — adding a field to the schema without adding it to `TUser` causes `TS2353: Object literal may only specify known properties`. Plan specified only `TRegisterUser`, but `TUser` is equally required.
- **Fix:** Added `partnerClickId?: string` to `TUser` alongside `leaderboardOptOut` (same pattern as the other document-level fields like `preferredLanguage`, `preferredCurrency`)
- **Files modified:** `pft-backend/src/app/modules/Auth/auth.interface.ts`
- **Verification:** Scoped tsc produced no errors from auth.interface.ts or auth.model.ts after fix
- **Committed in:** d2992553 (Task 1/2 combined commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type correctness)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep — same file, same field, required by the Mongoose Schema type constraint.

## Verification Grep Results

```
pft-backend/src/app/modules/Auth/auth.interface.ts:315:  partnerClickId?: string;  (TUser)
pft-backend/src/app/modules/Auth/auth.model.ts:536:    partnerClickId: {          (UserSchema, index: true)
pft-backend/src/app/modules/Auth/auth.interface.ts:346:  partnerClickId?: string;  (TRegisterUser)
```

## Issues Encountered

None beyond the TUser deviation documented above. Scoped tsc exit 1 is from unrelated files (Intercom, logger, config) that were pre-existing — no auth file errors after fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CRM-02 satisfied: `partnerClickId` will be persisted on the User document when a `partnerClickId` body field is present at `/auth/register` (forwarded by plan 10-01's dashboard signup form)
- 10-03 (TrackingSettings schema) can now reference `User.partnerClickId` as the field to read for postbacks
- Phase 11 (event wiring) has the field to read off the user doc for postback emission
- Phase 12 (S2S send) has the byte-identical value to echo back to the partner

---
*Phase: 10-capture-persist*
*Completed: 2026-07-01*
