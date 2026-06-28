---
phase: 01-pre-work
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - pft-backend/src/app/modules/Auth/auth.interface.ts
  - pft-backend/src/app/modules/Auth/auth.model.ts
autonomous: true

must_haves:
  truths:
    - "All existing users have leaderboardOptOut defaulting to false without a migration script"
    - "Querying { leaderboardOptOut: false } correctly excludes opted-out users"
    - "New users get leaderboardOptOut: false on registration (Mongoose schema default)"
  artifacts:
    - path: "pft-backend/src/app/modules/Auth/auth.interface.ts"
      provides: "leaderboardOptOut field on TUser interface"
      contains: "leaderboardOptOut?: boolean"
    - path: "pft-backend/src/app/modules/Auth/auth.model.ts"
      provides: "leaderboardOptOut field on UserSchema"
      contains: "leaderboardOptOut"
  key_links:
    - from: "auth.model.ts UserSchema"
      to: "MongoDB User documents"
      via: "Mongoose schema default: false"
      pattern: "leaderboardOptOut.*default.*false"
    - from: "auth.interface.ts TUser"
      to: "TypeScript consumers"
      via: "optional boolean field"
      pattern: "leaderboardOptOut\\?: boolean"
---

<objective>
Add `leaderboardOptOut: Boolean` to the User model and `TUser` interface so the leaderboard feature can filter out users who do not want to appear in public rankings. Mongoose schema defaults handle existing documents — no migration script needed.

Purpose: Without this field, opt-out cannot be enforced. The leaderboard phase requires `{ leaderboardOptOut: false }` to be a valid, indexed query.
Output: Two file edits. New field in UserSchema with `default: false`. New optional field in TUser interface.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/klev/Code/PFT-WhiteLabel-v2-staging/.planning/PROJECT.md
@/Users/klev/Code/PFT-WhiteLabel-v2-staging/.planning/ROADMAP.md
@/Users/klev/Code/PFT-WhiteLabel-v2-staging/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add leaderboardOptOut to TUser interface</name>
  <files>pft-backend/src/app/modules/Auth/auth.interface.ts</files>
  <action>
    In the `TUser` interface (starts at line 148), add `leaderboardOptOut?: boolean;` after the `preferredCurrency?: string;` field (currently the last field before the closing brace at line 310).

    Insert after line 309 (`preferredCurrency?: string;`):
    ```typescript
      // Leaderboard visibility: if true, user is hidden from all public rankings
      leaderboardOptOut?: boolean;
    ```

    The field is optional (`?`) in the interface because existing documents do not have it set — Mongoose returns `undefined` for missing fields, and `undefined` is falsy (same as `false`) for opt-out checks.
  </action>
  <verify>
    `grep -n "leaderboardOptOut" pft-backend/src/app/modules/Auth/auth.interface.ts`
    Must return exactly 1 match showing `leaderboardOptOut?: boolean`.
  </verify>
  <done>
    `leaderboardOptOut?: boolean` is present in the `TUser` interface block in auth.interface.ts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add leaderboardOptOut to UserSchema</name>
  <files>pft-backend/src/app/modules/Auth/auth.model.ts</files>
  <action>
    In the `UserSchema` definition, add the `leaderboardOptOut` field after `isDeleted` (around line 456-459). Insert after the closing brace of `isDeleted`:

    ```typescript
    leaderboardOptOut: {
      type: Boolean,
      default: false,
    },
    ```

    Place it between `isDeleted` and `isNameLocked` (lines 456-464). The exact insertion point:

    After:
    ```typescript
    isDeleted: {
      type: Boolean,
      default: false,
    },
    ```

    Insert:
    ```typescript
    // Leaderboard visibility: if true, user is excluded from all public rankings
    leaderboardOptOut: {
      type: Boolean,
      default: false,
    },
    ```

    Then before:
    ```typescript
    // Profile locks
    isNameLocked: {
    ```

    The `default: false` means Mongoose returns `false` for ALL existing documents that lack the field — no backfill script needed. New documents also default to `false`.
  </action>
  <verify>
    `grep -n "leaderboardOptOut" pft-backend/src/app/modules/Auth/auth.model.ts`
    Must return exactly 1 match with `default: false`.
  </verify>
  <done>
    `leaderboardOptOut` field with `type: Boolean` and `default: false` is present in UserSchema in auth.model.ts.
  </done>
</task>

</tasks>

<verification>
After both edits:
1. `grep -n "leaderboardOptOut" pft-backend/src/app/modules/Auth/auth.interface.ts` — 1 match in TUser
2. `grep -n "leaderboardOptOut" pft-backend/src/app/modules/Auth/auth.model.ts` — 1 match with default: false
3. TypeScript compile check: `cd pft-backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "auth\.\(interface\|model\)" | head -10` — zero errors expected
4. Opt-out query would work: a filter of `{ leaderboardOptOut: false }` returns users where field is false OR field is absent (Mongoose default treats missing as false)
</verification>

<success_criteria>
`leaderboardOptOut: Boolean` with `default: false` is present in UserSchema. `leaderboardOptOut?: boolean` is present in TUser interface. No TypeScript compile errors on either file. Querying `{ leaderboardOptOut: false }` in leaderboard service will correctly include all non-opted-out users (including existing users without the field set).
</success_criteria>

<output>
After completion, create `.planning/phases/01-pre-work/01-02-SUMMARY.md`
</output>
