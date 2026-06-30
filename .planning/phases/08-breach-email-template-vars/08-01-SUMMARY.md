---
phase: 08-breach-email-template-vars
plan: 01
subsystem: email/messaging
tags: [email-templates, breach-emails, rule-breached, per-brand-migration, ops-script]
requires:
  - pft-backend templateAutoCreator seed (the only auto-creation gate for messagetemplates docs)
provides:
  - Seeded rule_breached template body that interpolates the rule-checker's exact ban_reason line
  - Extended rule_breached.variables registry (3 -> 20 entries) so admins discover the populated breach fields in the editor
  - Per-brand one-off migration script that union-merges variables on existing messagetemplates docs and conditionally overwrites the body
affects:
  - XPIPS rule_breached emails (ticket cmr0ufshl00obny0kz3zk1uju)
  - Funding Optimal rule_breached emails (ticket cmqv8nmco006fny0kdrvlcugw)
  - Any brand whose admin had never customised the rule_breached body (auto-overwrite via sync script)
tech-stack:
  added: []
  patterns:
    - Strict-equality body-overwrite gate via exported OLD_RULE_BREACHED_BODY constant (preserves admin customisations)
    - Union-merge of variables array (never shrinks an existing registry)
    - --dry-run flag on a CLI migration that prints intended payload without DB writes
key-files:
  created:
    - pft-backend/src/scripts/migrations/sync-rule-breached-template-vars.ts
  modified:
    - pft-backend/src/app/services/email/templateAutoCreator.service.ts
decisions:
  - Single-brace `{varname}` interpolation (matches SimpleEmailTemplateService.replaceVariables, NOT Mustache)
  - Variables array union-merged in BOTH seed and sync script - never shrinks (preserves admin-added vars)
  - Body overwrite gated on strict equality with OLD_RULE_BREACHED_BODY (per-doc decision, per-brand outcome)
  - Inline NEW_BODY + NEW_VARIABLES in sync script, import only OLD_RULE_BREACHED_BODY (decouples script boot chain from heavy DEFAULT_TEMPLATES object)
  - Other 3 breach templates (funded_account_breach / leverage_exceeded_breach / inactivity_breach) deliberately UNTOUCHED - verified already render the reason
  - Ops verification DEFERRED to post-deploy (matches 04-04 / 05-01 / 06-01 / 07-02 convention)
metrics:
  duration: ~12 min
  completed: 2026-06-30
---

# Phase 8 Plan 01: Breach Email Template Vars Summary

One-liner: Patched the seeded `rule_breached` email body to interpolate `{ban_reason}` + 4 other breach fields, extended the variables registry from 3 to 20 entries, and shipped a per-brand `sync-rule-breached-template-vars` migration that union-merges existing brand DB docs while preserving admin customisations.

## What Changed

### Seed file: `pft-backend/src/app/services/email/templateAutoCreator.service.ts`

- Added top-of-file exported constant `OLD_RULE_BREACHED_BODY` carrying the previous seeded body string verbatim. Doc comment notes it's consumed by the migration script for strict-equality body-overwrite detection and must rotate in lockstep if the seed body ever changes again.
- Replaced `rule_breached.body` with a new body that interpolates (all single-brace syntax per `SimpleEmailTemplateService.replaceVariables`):
  - `{first_name}` (greeting)
  - `{account_id}` + `{program_name}` (account/program identification)
  - `{breach_date}` (when)
  - `{ban_reason}` (THE headline — the exact rule-checker reason string like "Tick-based breach: Equity $959.68 < Floor $960")
  - `{breach_type_label}` (human label)
  - `{current_equity}` (equity at breach moment)
  - `{breach_limit}` (the limit that was breached)
  - `{support_email}` (mailto link)
  - `{dashboard_url}` (deep link)
  - `{site_name}` (sign-off)
- Replaced `rule_breached.variables` with the union of the old 3-entry array (`user_name`, `rule_name`, `company_name`) + 17 new entries: `ban_reason, breach_date, breach_type, breach_type_label, current_equity, current_balance, floating_pnl, breach_level, breach_value, breach_limit, account_id, program_name, account_type, dashboard_url, support_email, site_name, first_name`. Old entries kept (union, never shrunk). Final count: 20.
- Diff scope: 1 file, +33/-2, ONLY the `rule_breached` entry + the new constant.

### Sync script: `pft-backend/src/scripts/migrations/sync-rule-breached-template-vars.ts` (NEW, 161 lines)

Per-brand one-off migration following the established `backfill-free-challenge-coupons.ts` pattern. Behaviour:

1. Reads `DATABASE_URL` (or `MONGODB_URI` fallback) — exits 1 if missing.
2. Parses `--dry-run` flag via `process.argv.includes`.
3. Connects via mongoose.
4. `messagetemplates.findOne({ event: "rule_breached" })`:
   - `null` -> logs "no template, skipping (auto-creator will create on boot)" + exits 0.
   - found -> computes new variables = `unionVariables(existing, NEW_VARIABLES)`; decides body overwrite by `existing.body.trim() === OLD_RULE_BREACHED_BODY.trim()`.
5. If body is admin-customised (no strict match) -> logs an explicit warning to ops, leaves body untouched, still union-extends variables.
6. If `--dry-run` -> prints intended `$set` payload as one-line JSON and writes nothing.
7. Else -> `updateOne({ _id }, { $set: { variables, body?, updatedAt } })`.
8. One-line summary log: `[sync-rule-breached] DB=<dbName> variables: <old>-><new> body: updated|preserved [(dry-run)]`.

Decoupling decision: `OLD_RULE_BREACHED_BODY` is imported from the service file (single light constant). `NEW_BODY` + `NEW_VARIABLES` are inlined as top-level constants with a sync-with comment to avoid pulling the full `DEFAULT_TEMPLATES` object + mongoose model graph into a CLI one-off.

Header docblock includes the exact ops invocation pattern (dry-run first, then live, switch `DATABASE_URL` per brand).

## Untouched Breach Templates (verified zero-diff)

These 3 already render the reason in their bodies + already carry the relevant variables. Touching them risks regressions for zero gain:

- `funded_account_breach` (templateAutoCreator line ~391)
- `leverage_exceeded_breach` (~856)
- `inactivity_breach` (~753)

Verified via `git diff` — these blocks have zero changes.

## Verification Run

- `git branch --show-current` -> `main-2026` BEFORE each commit (per MEMORY.md hard rule).
- Pre-edit `git fetch origin main-2026` discovered 1 incoming commit `6840097a` (device-gate ACTIVE-funnel count fix — zero overlap with email templates). Fast-forwarded `1a7aa01e..6840097a` clean before editing.
- Post-Task-1 `git diff` confirmed: only `rule_breached` + new `OLD_RULE_BREACHED_BODY` constant changed. Other 3 breach templates byte-identical.
- Scoped tsc on the new sync script (`npx tsc --noEmit --esModuleInterop --target es2020 --module commonjs --moduleResolution node --skipLibCheck`) reports the pre-existing `Types.ObjectId` typing error in `message-templates.model.ts` (baseline noise, pulled transitively via the import) — ZERO new errors at any line of `sync-rule-breached-template-vars.ts`. Full project tsc not run (MEMORY.md `reference_backend_tsc_oom.md`).
- Post-Task-2: `git rev-parse HEAD == origin/main-2026` -> IN-SYNC.

## Commits

| # | Hash       | Files                                                                 | Lines     | Push state                |
| - | ---------- | --------------------------------------------------------------------- | --------- | ------------------------- |
| 1 | `62175f4f` | `pft-backend/src/app/services/email/templateAutoCreator.service.ts`   | +33/-2    | PUSHED `6840097a..62175f4f` |
| 2 | `20ec2680` | `pft-backend/src/scripts/migrations/sync-rule-breached-template-vars.ts` (NEW) | +161/-0 | PUSHED `62175f4f..20ec2680` |

Both on `pft-backend` `main-2026`. Zero changes to `pft-rule-checker`, `pft-dashboard`, `pfr-super-admin`.

## Deviations from Plan

None. Plan executed exactly as written. The plan's "optional smoke-test against local nextstagefunded DB" step was skipped per the plan's own "compile-only is sufficient" allowance — scoped tsc passed with zero new errors on the script file.

## Deferred Ops Verification (Task 3 — post-deploy)

Per 04-04 / 05-01 / 06-01 / 07-02 convention, Task 3 is intentionally deferred until `main-2026` deploys.

Checklist for ops once deployed to XPIPS + Funding Optimal backends:

1. **Dry-run sync on XPIPS:**
   ```
   DATABASE_URL="mongodb://xpips_user:...@.../Xpips" \
     npx ts-node src/scripts/migrations/sync-rule-breached-template-vars.ts --dry-run
   ```
   Expect one-line output: `[sync-rule-breached] DB=Xpips variables: 3->20 body: updated|preserved (dry-run)`.

2. **Live sync on XPIPS:** rerun without `--dry-run`.

3. **Repeat for Funding Optimal** with its `DATABASE_URL`.

4. **Trigger a test breach** (staging account) or wait for the next real production breach -> inspect the delivered email -> body should now show `Reason: Tick-based breach: Equity $4641.09 < Floor $4700` (or analogous) on the `Reason:` line.

5. **Admin editor spot-check:** open `rule_breached` template in admin UI -> variables dropdown should now list `ban_reason`, `breach_date`, `breach_type_label`, `current_equity`, `breach_limit`, etc. (20 total).

6. **Regress-check the other 3 breach templates** (`funded_account_breach`, `leverage_exceeded_breach`, `inactivity_breach`) in admin UI -> bodies + variables unchanged from pre-deploy.

7. **Reply to source tickets** once a real breach email renders the reason line:
   - `cmr0ufshl00obny0kz3zk1uju` (XPIPS LOW) -> "Breach email now includes the exact reason line the rule-checker computed. Closing." -> status WAITING_CLIENT.
   - `cmqv8nmco006fny0kdrvlcugw` (Funding Optimal HIGH) -> same.

If the sync script reports "Admin-customised body detected" for a brand, ops must manually edit the body in the admin template editor to add the `{ban_reason}` interpolation — note this on the ticket for tracking.

## Source Tickets

- **PRIMARY:** `cmr0ufshl00obny0kz3zk1uju` (XPIPS LOW) — admin sick of manually replying with the breach reason on every "why was I breached" thread.
- **RELATED (same root cause, different angle):** `cmqv8nmco006fny0kdrvlcugw` (Funding Optimal HIGH) — clients confused why account breached when post-breach balance lands ABOVE the floor (tick-based equity check fires at the dip; positions then close; balance recovers).

Funding Optimal's deeper UX asks (a) display `balance == equity` at the breach moment, (b) force balance display below floor — explicitly OUT OF SCOPE for this phase. Ship Phase 8 first and measure complaint volume before scoping any Phase 9 UX overhaul.

## Self-Check: PASSED

- File `pft-backend/src/app/services/email/templateAutoCreator.service.ts` — exists, modified (verified via `git show 62175f4f --stat`).
- File `pft-backend/src/scripts/migrations/sync-rule-breached-template-vars.ts` — exists (verified via `git show 20ec2680 --stat`).
- Commit `62175f4f` — present on origin/main-2026 (verified via `git push` output `6840097a..62175f4f`).
- Commit `20ec2680` — present on origin/main-2026 (verified via `git push` output `62175f4f..20ec2680`).
- `git rev-parse HEAD == origin/main-2026` -> IN-SYNC.
- `grep "ban_reason" templateAutoCreator.service.ts` -> matches in both body string and variables array.
- `grep "OLD_RULE_BREACHED_BODY" templateAutoCreator.service.ts` -> export present.
- Other 3 breach templates' diff -> empty (verified by reviewing the staged hunks).
