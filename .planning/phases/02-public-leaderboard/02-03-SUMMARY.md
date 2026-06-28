---
phase: 02-public-leaderboard
plan: 03
subsystem: dashboard-settings
tags: [frontend, settings, leaderboard, privacy, opt-out]
requires:
  - "01-02: leaderboardOptOut on User schema (backend, Phase 1)"
  - "PATCH /users/:id self-update allows leaderboardOptOut (not in sensitive-strip list)"
provides:
  - "Settings UI 'Hide me from leaderboard' opt-out toggle"
  - "leaderboardOptOut typed on dashboard User type + useUpdateUser payload"
affects:
  - "02-01: query-time $nin opt-out filter consumes leaderboardOptOut=true users"
tech-stack:
  added: []
  patterns:
    - "Optimistic Switch toggle with revert-on-error via mutateAsync"
    - "Seed local toggle state from currentUser in useEffect([currentUser])"
key-files:
  created: []
  modified:
    - "pft-dashboard/src/types/user.types.ts"
    - "pft-dashboard/src/hooks/useUsers.ts"
    - "pft-dashboard/src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx"
decisions:
  - "User type lives in src/types/user.types.ts (not src/types/index.ts) — added leaderboardOptOut there"
  - "No backend change: PATCH /users/:id already permits self-update of leaderboardOptOut (raw findByIdAndUpdate)"
  - "Reused EyeOff icon for the Leaderboard Privacy card header (already imported)"
metrics:
  duration: ~6 min
  completed: 2026-06-29
---

# Phase 2 Plan 03: Leaderboard Opt-Out Toggle Summary

Frontend-only "Hide me from leaderboard" Switch in trader Settings, seeded from `currentUser.leaderboardOptOut` and persisted via the existing `PATCH /users/:id` self-update with optimistic UI and revert-on-error.

## What Was Built

- **Type plumbing (Task 1):**
  - Added `leaderboardOptOut?: boolean` to the `User` interface in `src/types/user.types.ts` so `currentUser.leaderboardOptOut` typechecks. (Plan referenced `src/types/index.ts`, but the canonical `User` type — the one returned by `useCurrentUser()` — lives in `user.types.ts`; grep confirmed.)
  - Added `leaderboardOptOut?: boolean` to the inline `userData` allow-list in `useUpdateUser` (`src/hooks/useUsers.ts`) so TypeScript permits sending the field. Did NOT widen to `any`.

- **Settings UI (Task 2):** In `SettingsContainer.tsx`:
  - Imported `Switch` from `@/components/ui/switch`.
  - Added `const [optOut, setOptOut] = useState(false)` and seeded it in the existing `useEffect([currentUser])` block alongside the contact-form seeding: `setOptOut(Boolean(currentUser.leaderboardOptOut))`.
  - Added `handleOptOutToggle(next)` — optimistic `setOptOut(next)`, `updateUser.mutateAsync({ id: currentUser._id || currentUser.id, userData: { leaderboardOptOut: next } })`, revert on failure.
  - Rendered a new "Leaderboard Privacy" Card (CardHeader/CardTitle/CardContent matching the Change Password / Danger Zone pattern) with label "Hide me from leaderboard", description "Hide me from the public leaderboard and competitions", an inline `Loader2` spinner gated on `updateUser.isPending`, and `<Switch checked={optOut} onCheckedChange={handleOptOutToggle} disabled={updateUser.isPending} />`.

## How It Works

The toggle reflects the trader's current `leaderboardOptOut` on load. Toggling sends `PATCH /users/:id { leaderboardOptOut: boolean }` via `useUpdateUser` (which invalidates the `["user", id]` and admin user-list queries on success). Combined with the 02-01 query-time filter (`User.distinct("_id", { leaderboardOptOut: true })` → `$nin`) and its ≤15s request cache, an opted-out trader disappears from the public leaderboard within the cache TTL. No cache-bust call required.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Allow leaderboardOptOut in useUpdateUser payload + User type | b96474dd | src/hooks/useUsers.ts, src/types/user.types.ts |
| 2 | Add opt-out Switch to SettingsContainer | e1628f7f | src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx |

Commits landed in the **pft-dashboard** repo on branch `main-2026`.

## Verification Performed

- `grep` confirmed `leaderboardOptOut` present in all three files and `Switch` / `onCheckedChange` wired in SettingsContainer.
- `npx eslint` on `SettingsContainer.tsx`: clean (no warnings/errors).
- `npx tsc --noEmit`: zero errors in the three edited files (`SettingsContainer.tsx`, `useUsers.ts`, `user.types.ts`). Pre-existing unrelated tsc errors exist in other admin settings files (PnlCardSettingsContainer, SocialProofSettingsContainer, RiskSettingsContainer) — not touched by this plan.

## Deviations from Plan

**1. [Rule 3 - Blocking] User type location differs from plan**
- **Found during:** Task 1
- **Issue:** Plan instructed adding `leaderboardOptOut` to `src/types/index.ts`, but the `User` type returned by `useCurrentUser()` lives in `src/types/user.types.ts` (`index.ts` had no `User`/`firstName` definition).
- **Fix:** Added the field to the actual `User` interface in `user.types.ts`, exactly as the plan's fallback instruction directed ("If the type is named differently... add it there. Find it with grep").
- **Files modified:** `src/types/user.types.ts`
- **Commit:** b96474dd

No other deviations.

## Pending Human-Verify Checkpoint (NOT executed — app not yet deployed)

Task 3 is a `checkpoint:human-verify` (gate=blocking). It was intentionally NOT run because the app isn't deployed; the user performs live verification later. Checklist:

- [ ] Log in as a trader who currently appears on `/leaderboard`. Note their masked name in the public list.
- [ ] Go to Settings → toggle "Hide me from leaderboard" ON. Reload Settings and confirm the toggle stays ON (persisted).
- [ ] Within ~15s, refresh `/leaderboard` (incognito / logged-out is the cleanest test) and confirm the trader is GONE from the public list.
- [ ] Toggle it back OFF, wait ~15s, refresh `/leaderboard`, and confirm the trader reappears.

Resume signal: user types "approved" or describes the issue (e.g. toggle didn't persist, trader still visible after 30s).

Note: requires 02-01 (public endpoint + `$nin` opt-out filter) to be deployed for the disappear/reappear behavior to be observable.

## Self-Check: PASSED

- All 3 modified files exist.
- SUMMARY.md exists.
- Commits b96474dd and e1628f7f exist in pft-dashboard repo.
