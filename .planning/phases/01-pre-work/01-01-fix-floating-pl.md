---
phase: 01-pre-work
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
autonomous: true

must_haves:
  truths:
    - "Leaderboard rankings do not shuffle between page loads during MT5 downtime"
    - "floatingPL fallback returns exactly 0, not a random value"
    - "equity in the MT5-fallback path equals currentBalance (no random offset)"
  artifacts:
    - path: "pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts"
      provides: "Deterministic floatingPL fallback"
      contains: "const floatingPL = 0;"
  key_links:
    - from: "leaderboard.service.ts line 647"
      to: "floatingPL variable"
      via: "direct assignment"
      pattern: "const floatingPL = 0"
---

<objective>
Replace the `Math.random() * 200 - 100` placeholder with a deterministic `0` fallback on line 647 of leaderboard.service.ts. This is the MT5-offline code path — when live open-position data is unavailable, floating PL should be 0, not a random number that reshuffles the leaderboard on every request.

Purpose: Leaderboard rankings must be stable. A random floatingPL means two traders with identical realized performance rank differently on each page load, which is incorrect and confusing to users.
Output: One-line code change — the mock comment and `Math.random()` expression replaced with `0`.
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
  <name>Task 1: Replace Math.random() floatingPL with deterministic 0</name>
  <files>pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts</files>
  <action>
    At line 646-647, replace the mock floatingPL block with a deterministic 0.

    Current code (lines 646-647):
    ```
      // Mock floating PL (in real implementation, this would come from open positions)
      const floatingPL = Math.random() * 200 - 100;
    ```

    Replace with:
    ```
      // floatingPL is 0 when MT5 is offline — open position data unavailable
      const floatingPL = 0;
    ```

    Line 648 (`const equity = currentBalance + floatingPL;`) remains unchanged — it is correct.

    Do NOT touch lines 456 or 500 — those are already correct per research findings.
  </action>
  <verify>
    Run: `grep -n "floatingPL" pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts`

    Expected output must show `const floatingPL = 0;` at line 647 (line number may shift by 0-1 after edit).
    Must NOT contain `Math.random` anywhere in the file for floatingPL.
  </verify>
  <done>
    `grep "Math.random" pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` returns no matches on the floatingPL line.
    `grep "const floatingPL = 0" pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` returns exactly 1 match.
  </done>
</task>

</tasks>

<verification>
After the edit:
1. `grep -n "Math.random" pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` — must return zero lines referencing floatingPL
2. `grep -n "const floatingPL" pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` — must show `= 0`
3. File must still compile: `cd pft-backend && npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "leaderboard.service" | head -10` (zero errors expected for this file)
</verification>

<success_criteria>
The single Math.random() call on the floatingPL line is replaced with 0. The leaderboard service compiles without TypeScript errors. Rankings no longer shift during MT5 downtime.
</success_criteria>

<output>
After completion, create `.planning/phases/01-pre-work/01-01-SUMMARY.md`
</output>
