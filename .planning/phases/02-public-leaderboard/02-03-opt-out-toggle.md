---
phase: 02-public-leaderboard
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - pft-dashboard/src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx
  - pft-dashboard/src/hooks/useUsers.ts
  - pft-dashboard/src/types/index.ts
autonomous: false

must_haves:
  truths:
    - "Logged-in trader sees a 'Hide me from leaderboard' toggle in Settings"
    - "Toggle reflects the trader's current leaderboardOptOut value on load"
    - "Toggling it persists via PATCH /users/:id with { leaderboardOptOut: boolean }"
    - "After opting out, the trader disappears from the public leaderboard near-immediately (within cache TTL)"
  artifacts:
    - path: "pft-dashboard/src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx"
      provides: "opt-out Switch wired to current user + update mutation"
      contains: "leaderboardOptOut"
  key_links:
    - from: "SettingsContainer opt-out Switch"
      to: "PATCH /users/:id"
      via: "useUpdateUser mutation with { id: currentUser._id, userData: { leaderboardOptOut } }"
      pattern: "leaderboardOptOut"
    - from: "Switch initial state"
      to: "currentUser.leaderboardOptOut"
      via: "useCurrentUser() value seeds the toggle"
      pattern: "currentUser.*leaderboardOptOut"
---

<objective>
Add a "Hide me from leaderboard" opt-out toggle to the trader Settings page. The backend already supports this fully — `leaderboardOptOut` is on the User schema (Phase 1) and `PATCH /users/:id` already allows self-update of it (it is NOT in the sensitive-strip list; the service does a raw findByIdAndUpdate). So this plan is almost entirely frontend: a Switch in `SettingsContainer.tsx`, seeded from the current user, persisting via the existing `useUpdateUser` mutation. The query-time opt-out filter built in 02-01 (`User.distinct("_id", { leaderboardOptOut: true })` → `$nin`) with the ≤15s cache makes the trader disappear from the public view near-immediately.

Purpose: Satisfies LB-03. Independent of the public endpoint internals — can run in Wave 1 in parallel with 02-01.
Output: Opt-out Switch in Settings, wired to existing PATCH self-update. pft-dashboard repo.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-public-leaderboard/2-CONTEXT.md

# Frontend repo pft-dashboard
@pft-dashboard/src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx
@pft-dashboard/src/hooks/useUsers.ts
@pft-dashboard/src/hooks/useAuth.ts
@pft-dashboard/src/components/ui/switch.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Allow leaderboardOptOut in useUpdateUser payload + current-user type</name>
  <files>pft-dashboard/src/hooks/useUsers.ts, pft-dashboard/src/types/index.ts</files>
  <action>
  1. `src/hooks/useUsers.ts` (`useUpdateUser`, ~line 131): the mutation's `userData` is a `Partial<{...}>` allow-list of fields. Add `leaderboardOptOut?: boolean;` to that inline type so TypeScript permits sending it. The backend already accepts it (raw findByIdAndUpdate, not in sensitive strip — confirmed in research), so no backend change is needed. Do NOT widen this to `any`.
  2. `src/types/index.ts` (or wherever the `User` / current-user type lives): add `leaderboardOptOut?: boolean;` to the User type so `currentUser.leaderboardOptOut` typechecks. If the type is named differently (e.g. `IUser`, `CurrentUser`), add it there. Find it with `grep -rn "firstName" src/types | head`.
  </action>
  <verify>
  `cd pft-dashboard && grep -n "leaderboardOptOut" src/hooks/useUsers.ts src/types/index.ts`.
  `cd pft-dashboard && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "useUsers\|types/index" | head`.
  </verify>
  <done>
  useUpdateUser accepts leaderboardOptOut in its typed payload, and the User type carries leaderboardOptOut?: boolean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add opt-out Switch to SettingsContainer wired to current user + update mutation</name>
  <files>pft-dashboard/src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx</files>
  <action>
  In `SettingsContainer.tsx` (already imports `useUpdateUser`, `useAuth`, `useCurrentUser`, and renders Cards):

  1. Import `Switch` from `@/components/ui/switch`.
  2. Add local state `const [optOut, setOptOut] = useState(false);` and seed it in the existing `useEffect(... [currentUser])` block: `if (currentUser) setOptOut(Boolean(currentUser.leaderboardOptOut));` (add alongside the existing contactForm seeding — do not remove that).
  3. Add a handler:
     ```typescript
     const handleOptOutToggle = async (next: boolean) => {
       const prev = optOut;
       setOptOut(next); // optimistic
       try {
         await updateUser.mutateAsync({
           id: (currentUser as any)._id || (currentUser as any).id,
           userData: { leaderboardOptOut: next },
         });
       } catch {
         setOptOut(prev); // revert on failure
       }
     };
     ```
     Use whichever id field the rest of this file uses for the current user (`currentUser._id` is standard here — confirm against how changePassword/contact update reference the user).
  4. Render a new Card section "Leaderboard Privacy" with a labeled row: a description ("Hide me from the public leaderboard and competitions") and `<Switch checked={optOut} onCheckedChange={handleOptOutToggle} disabled={updateUser.isPending} />`. Match the styling/Card pattern already used for the password and contact sections in this file (CardHeader/CardTitle/CardContent, theme classes).
  5. Optional nicety: show a small inline confirmation/spinner using `updateUser.isPending` consistent with the file's existing status UX.

  Note for verification: since the public endpoint caches per request for ≤15s (02-01), the trader disappears from the public view within ~15s of opting out — this satisfies "immediately disappear" per the CONTEXT lock. No cache-bust call required.
  </action>
  <verify>
  `cd pft-dashboard && grep -n "leaderboardOptOut\|onCheckedChange\|Switch" "src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx"`.
  `cd pft-dashboard && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "SettingsContainer" | head`.
  `cd pft-dashboard && npx eslint "src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx" 2>&1 | head`.
  </verify>
  <done>
  Settings shows a "Hide me from leaderboard" toggle seeded from currentUser.leaderboardOptOut, persisting via PATCH /users/:id with optimistic UI + revert on error.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Opt-out toggle in trader Settings, wired to the existing PATCH /users/:id self-update, combined with the 02-01 query-time opt-out filter.</what-built>
  <how-to-verify>
  1. Log in as a trader who currently appears on /leaderboard. Note their masked name in the public list.
  2. Go to Settings → toggle "Hide me from leaderboard" ON. Confirm the toggle persists (reload Settings — it stays ON).
  3. Within ~15s, refresh /leaderboard (incognito/logged-out is the cleanest test) and confirm the trader is GONE from the public list.
  4. Toggle it back OFF, wait ~15s, refresh /leaderboard, confirm the trader reappears.
  </how-to-verify>
  <resume-signal>Type "approved" or describe the issue (e.g. toggle didn't persist, trader still visible after 30s).</resume-signal>
</task>

</tasks>

<verification>
- Switch present in SettingsContainer, seeded from currentUser.leaderboardOptOut.
- Toggling sends PATCH /users/:id { leaderboardOptOut } via useUpdateUser.
- Opted-out trader excluded from /leaderboard/public (via 02-01 $nin filter) within cache TTL.
</verification>

<success_criteria>
- Trader toggles "Hide me from leaderboard" in Settings and the choice persists.
- Within the cache window the trader disappears from the public leaderboard; toggling off restores them.
</success_criteria>

<output>
After completion, create `.planning/phases/02-public-leaderboard/02-03-SUMMARY.md`.
Commit frontend changes in the pft-dashboard repo. Include the Co-Authored-By trailer.
</output>
