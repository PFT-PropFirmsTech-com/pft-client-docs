# Phase 1: Pre-Work - Research

**Researched:** 2026-06-29
**Domain:** pft-backend — Leaderboard service bug fix + Mongoose User model field addition
**Confidence:** HIGH

## Summary

This phase has two completely independent changes. The first is a one-line bug fix in `leaderboard.service.ts` line 647: `Math.random() * 200 - 100` must become `0`. The second is adding `leaderboardOptOut: Boolean` (default `false`) to the User model + interface. Both are low-risk, self-contained, and require no DB migration script — Mongoose schema defaults handle new fields for existing documents automatically.

The Math.random() bug lives exclusively in `calculatePerformanceMetricsFromTrades`, which is the fallback path invoked when MT5 is down or returns invalid account info. The primary MT5 path already uses `accountInfo.floating || 0` (line 456), so the fix is strictly about making the fallback consistent with that. The random value is used only to compute `equity` within the fallback return; it does not affect sorting or persistence — the Leaderboard collection stores `floatingPL: { type: Number, default: 0 }` in its own model, and the cron refresh calls `calculatePerformanceMetrics` which already falls back correctly to `0` in its error handler (line 500). The only remaining exposure is during live refresh when the fallback path is hit (not the error handler).

The `leaderboardOptOut` field does not yet exist anywhere in the codebase — not in `auth.model.ts`, `auth.interface.ts`, or anywhere in the Leaderboard module. The pattern to follow is identical to `whatsappOptOut` which was added at the top-level `UserSchema` with `{ type: Boolean, default: false }` and as `whatsappOptOut?: boolean` in `TUser`. No migration script is needed: Mongoose returns the schema default for documents that predate the field.

**Primary recommendation:** Fix line 647 with `const floatingPL = 0;` and add `leaderboardOptOut?: boolean` to `TUser` interface plus `leaderboardOptOut: { type: Boolean, default: false }` to `UserSchema`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongoose | (project's existing version) | ODM for MongoDB schema + model | Already in use throughout the backend |
| ts-node | ^10.9.2 | Run TypeScript scripts directly | Used by all existing migration scripts |

No new dependencies needed for either change.

## Architecture Patterns

### User Model Field Addition Pattern
New top-level boolean fields follow this exact pattern (from `whatsappOptOut` as precedent):

**auth.model.ts — UserSchema:**
```typescript
leaderboardOptOut: {
  type: Boolean,
  default: false,
},
```

**auth.interface.ts — TUser interface:**
```typescript
leaderboardOptOut?: boolean;
```

The field is added as optional (`?`) in the interface because existing documents won't have it until they are touched. The schema `default: false` ensures any new schema reads return `false` for old documents.

### Migration Script Pattern
All existing migration scripts in `src/scripts/migrations/` follow this structure:
- Standalone TypeScript file, run with `npx ts-node src/scripts/migrations/<name>.ts`
- Reads `DATABASE_URL` from `.env`
- Supports `DRY_RUN=true` env var for safe preview
- Idempotent: skips docs that already have the value
- Connects via `mongoose.connect()`, disconnects in `finally`

**For `leaderboardOptOut`:** No migration script is needed. The `default: false` in the schema means Mongoose returns `false` when the field is absent. Existing users do not need to be backfilled — `false` is the correct default (users are opted-in by default, i.e., they appear on the leaderboard).

### FloatingPL in the Codebase
There are exactly three `floatingPL` return sites in `leaderboard.service.ts`:
1. **Line 456** — primary MT5 path: `accountInfo.floating || 0` (correct, deterministic)
2. **Line 500** — error-handler fallback: hardcoded `floatingPL: 0` (correct)
3. **Line 647** — `calculatePerformanceMetricsFromTrades` fallback: `Math.random() * 200 - 100` (the bug)

The fix must only touch line 647. Lines 456 and 500 are already correct.

### Anti-Patterns to Avoid
- **Do not add a DB migration script for `leaderboardOptOut`**: Mongoose schema defaults handle this. Adding an unnecessary migration creates deployment complexity and risk.
- **Do not change `equity` calculation logic beyond the floatingPL fix**: Line 648 (`const equity = currentBalance + floatingPL`) is correct; with `floatingPL = 0`, equity simply equals balance in the fallback path, which is the right behavior during MT5 downtime.
- **Do not touch lines 456 or 500**: Only line 647 is the bug. The other two sites are already correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Boolean field with default on existing docs | Write a backfill migration | Mongoose schema default | Mongoose returns the schema default for fields absent from stored docs |
| Opt-out field placement | Per-program subdoc field | Top-level UserSchema field | Opt-out is a user preference, not per-account |

## Common Pitfalls

### Pitfall 1: Adding leaderboardOptOut to the programs subdoc instead of top-level UserSchema
**What goes wrong:** If added inside the programs array subdoc (like `isBanned`, `isPassed`), it would need to be set per-account, which makes no sense for a user preference. Leaderboard opt-out is a user-level preference.
**How to avoid:** Add to the top-level `UserSchema` fields, not inside the `programs` subdoc. Follow the `whatsappOptOut` pattern at lines 266-271 of `auth.model.ts`.

### Pitfall 2: Forgetting to add to TUser interface
**What goes wrong:** TypeScript won't complain when reading the field but callers in the Leaderboard service (future phase) that read `user.leaderboardOptOut` will get a type error.
**How to avoid:** Always add the field to both `auth.model.ts` (schema) and `auth.interface.ts` (TUser) together.

### Pitfall 3: Confusing the three floatingPL sites
**What goes wrong:** Touching lines 456 or 500 unnecessarily, or missing that the bug is only on line 647.
**How to avoid:** The bug comment on line 646 reads `// Mock floating PL (in real implementation, this would come from open positions)` — this is the only mock/random site. Lines 456 and 500 are already deterministic.

### Pitfall 4: Thinking `equity` needs separate fixing
**What goes wrong:** `equity = currentBalance + floatingPL` on line 648 looks like it might need changing too.
**How to avoid:** It does not. Setting `floatingPL = 0` makes `equity = currentBalance`, which is the correct deterministic fallback. The line itself is fine.

## Code Examples

### PRE-01: The exact fix

```typescript
// File: pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts
// Line 646-648 — BEFORE:
// Mock floating PL (in real implementation, this would come from open positions)
const floatingPL = Math.random() * 200 - 100;
const equity = currentBalance + floatingPL;

// AFTER:
// No open-position data available in trade-history fallback path; use 0
const floatingPL = 0;
const equity = currentBalance + floatingPL;
```

### PRE-02: UserSchema addition (auth.model.ts)

```typescript
// Add near whatsappOptOut (lines 266-271) as a group or near end of top-level fields.
// Follow the same pattern:
leaderboardOptOut: {
  type: Boolean,
  default: false,
},
```

### PRE-02: TUser interface addition (auth.interface.ts)

```typescript
// Add near whatsappOptOut (lines 170-171):
leaderboardOptOut?: boolean;
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Mock random floatingPL in fallback | Deterministic 0 fallback | Rankings are stable during MT5 downtime |
| Field absent from model | Field present with default: false | Leaderboard filter feature unblocked |

## Open Questions

1. **Should `leaderboardOptOut` be exposed via any existing User API endpoint immediately?**
   - What we know: The field is needed by future leaderboard phases. This phase only adds the schema field.
   - What's unclear: Whether PRE-02 includes wiring it to any existing GET/PATCH user endpoints, or whether that is a later-phase task.
   - Recommendation: Pre-work scope is schema-only. Leave endpoint wiring to the phase that reads the field.

2. **Does the Leaderboard collection's `generateAndStoreLeaderboardData` cron need to respect `leaderboardOptOut` during batch refresh?**
   - What we know: The cron (line 846+) queries `User.find()` without checking any opt-out flag. Users who opted out would still appear in the Leaderboard collection.
   - What's unclear: Whether filtering opted-out users from the cron is in-scope for this pre-work phase or a later phase.
   - Recommendation: Pre-work phase only adds the field. Enforcement in the cron refresh belongs to a later leaderboard phase.

## Sources

### Primary (HIGH confidence)
- Direct code reading: `/pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` — all three floatingPL sites verified at lines 456, 500, 647
- Direct code reading: `/pft-backend/src/app/modules/Auth/auth.model.ts` — UserSchema structure, `whatsappOptOut` pattern at lines 266-271
- Direct code reading: `/pft-backend/src/app/modules/Auth/auth.interface.ts` — TUser interface, confirmed `leaderboardOptOut` absent
- Direct code reading: `/pft-backend/src/scripts/migrations/` — migration script pattern (backfill-xp-cost-at-claim.ts, backfill-free-challenge-coupons.ts)
- grep scan: confirmed `leaderboardOptOut` not present anywhere in codebase

## Metadata

**Confidence breakdown:**
- Bug location and fix: HIGH — read the exact lines, comment confirms it is a mock/placeholder
- floatingPL scope: HIGH — grep confirmed only 3 sites in the leaderboard service, none elsewhere in the leaderboard module
- User model pattern: HIGH — read whatsappOptOut as direct precedent
- No migration needed: HIGH — Mongoose default behavior is well-established; confirmed by existing fields using same pattern
- Open questions: MEDIUM — scope boundary questions that the planner should clarify in task descriptions

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable codebase area, low churn)
