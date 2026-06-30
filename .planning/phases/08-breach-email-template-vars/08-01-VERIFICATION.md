---
phase: 08-breach-email-template-vars
verified: 2026-06-30T00:00:00Z
status: human_needed
score: 8/8 static must-haves verified
human_verification:
  - test: "Dry-run sync on XPIPS"
    expected: "[sync-rule-breached] DB=Xpips variables: 3->20 body: updated|preserved (dry-run)"
    why_human: "Requires live XPIPS DATABASE_URL; cannot exercise per-brand mongo from verifier sandbox."
  - test: "Live sync on XPIPS"
    expected: "Same one-line summary without (dry-run); messagetemplates.rule_breached doc updated in place."
    why_human: "Live DB write — requires ops env + sign-off."
  - test: "Dry-run + live sync on Funding Optimal"
    expected: "Same shape against Funding Optimal DB."
    why_human: "Requires live Funding Optimal DATABASE_URL."
  - test: "Trigger or wait for a real breach on XPIPS / Funding Optimal"
    expected: "Delivered breach email renders a 'Reason: ...' line populated with the rule-checker's ban_reason string (e.g. 'Tick-based breach: Equity $4641.09 < Floor $4700')."
    why_human: "End-to-end rendering inside the brand's mail provider — needs real breach event + inbox inspection."
  - test: "Admin editor spot-check rule_breached template"
    expected: "Variables dropdown lists 20 entries including ban_reason, breach_date, breach_type_label, current_equity, breach_limit."
    why_human: "Visual admin UI check inside the deployed brand dashboard."
  - test: "Regress-check other 3 breach templates (funded_account_breach, leverage_exceeded_breach, inactivity_breach)"
    expected: "Bodies + variables unchanged from pre-deploy state."
    why_human: "Visual admin UI check."
  - test: "Reply to source tickets after render confirmed"
    expected: "cmr0ufshl00obny0kz3zk1uju (XPIPS) and cmqv8nmco006fny0kdrvlcugw (Funding Optimal) replied with closure note, status WAITING_CLIENT."
    why_human: "Ticket portal action gated on render confirmation."
---

# Phase 8 Plan 01: Breach Email Template Vars — Verification Report

**Phase Goal:** Surface rule-checker breach reason in user breach emails so XPIPS admins stop fielding "why?" replies (cmr0ufshl00obny0kz3zk1uju) and Funding Optimal clients stop confusing balance vs equity (cmqv8nmco006fny0kdrvlcugw).
**Verified:** 2026-06-30
**Status:** human_needed
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Seeded rule_breached body interpolates {ban_reason} (single-brace) | VERIFIED | `templateAutoCreator.service.ts:366` body string contains `<strong>Reason:</strong> {ban_reason}` |
| 2 | Seeded variables array union-extended (3→20) preserving old entries | VERIFIED | `templateAutoCreator.service.ts:367-388` — first three entries are still `user_name`, `rule_name`, `company_name`; total 20 entries |
| 3 | OLD_RULE_BREACHED_BODY exported at top of file | VERIFIED | `templateAutoCreator.service.ts:12-13` `export const OLD_RULE_BREACHED_BODY = "<h2>Rule Breach Notification</h2><p>Hello {user_name}..."` |
| 4 | Single-brace syntax (matches SimpleEmailTemplateService.replaceVariables) | VERIFIED | Body uses `{ban_reason}`, `{first_name}`, etc. — no `{{ }}` Mustache forms anywhere |
| 5 | Other 3 breach templates untouched (funded_account_breach, leverage_exceeded_breach, inactivity_breach) | VERIFIED | `git diff 1a7aa01e..62175f4f -- templateAutoCreator.service.ts \| grep -E "funded_account_breach\|leverage_exceeded_breach\|inactivity_breach"` returned zero matches |
| 6 | Per-brand sync script has dry-run + union-merge + body strict-equality gate | VERIFIED | `sync-rule-breached-template-vars.ts` — `unionVariables()` 72-90; `bodyOverwrite = existingBody.trim() === OLD_RULE_BREACHED_BODY.trim()` line 124; `DRY_RUN = process.argv.includes("--dry-run")` line 70; null-doc skip with exit returns at line 109-114; one-line summary line 148-152 |
| 7 | Zero rule-checker / dashboard / super-admin changes | VERIFIED | Both commits' `--stat` lists files only under `pft-backend/`; no cross-repo touches |
| 8 | Both source tickets referenced in commit body | VERIFIED | `git show 62175f4f` commit message lists both `cmr0ufshl00obny0kz3zk1uju (XPIPS LOW)` and `cmqv8nmco006fny0kdrvlcugw (Funding Optimal HIGH)` |
| 9 | Live ops sync executed against XPIPS + Funding Optimal DBs and renders confirmed | NEEDS HUMAN | Deferred Task 3 — requires per-brand DATABASE_URL and a real breach event |

**Score:** 8/8 static must-haves verified; 1 truth deferred to human.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `pft-backend/src/app/services/email/templateAutoCreator.service.ts` | Patched rule_breached entry + OLD_RULE_BREACHED_BODY export | VERIFIED | Modified at commit `62175f4f`, +33/-2; lines 12-13 export constant, lines 364-389 rule_breached entry contains ban_reason in both body and variables |
| `pft-backend/src/scripts/migrations/sync-rule-breached-template-vars.ts` | One-off per-brand sync script | VERIFIED | Created at commit `20ec2680`, 161 lines; reads DATABASE_URL/MONGODB_URI fallback, exits 1 if missing; imports OLD_RULE_BREACHED_BODY from service; inlines NEW_BODY + NEW_VARIABLES per documented decoupling decision |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `templateAutoCreator.service.ts rule_breached.body` | SimpleEmailTemplateService.replaceVariables `args.ban_reason` | single-brace `{ban_reason}` | WIRED | Body literal `{ban_reason}` present at service.ts:366 — engine matches `\{(\w+)\}` per research |
| `sync-rule-breached-template-vars.ts` | `messagetemplates` collection | `findOne({event:"rule_breached"})` + `updateOne` | WIRED | Lines 106-114 (find), 142-145 (updateOne with $set) |
| `sync-rule-breached-template-vars.ts` | OLD_RULE_BREACHED_BODY constant | named import for strict-equality gate | WIRED | Line 35 `import { OLD_RULE_BREACHED_BODY } from "../../app/services/email/templateAutoCreator.service"`; consumed on line 124 |

### Variables Array Audit (Truth 2 detail)

Count: 20. Old preserved: `user_name`, `rule_name`, `company_name`. New added: `ban_reason`, `breach_date`, `breach_type`, `breach_type_label`, `current_equity`, `current_balance`, `floating_pnl`, `breach_level`, `breach_value`, `breach_limit`, `account_id`, `program_name`, `account_type`, `dashboard_url`, `support_email`, `site_name`, `first_name`. Matches plan Task 1 list exactly.

### Body Interpolation Audit (Truth 1 detail)

Single-brace tokens in body: `{first_name}`, `{account_id}`, `{program_name}`, `{breach_date}`, `{ban_reason}`, `{breach_type_label}`, `{current_equity}`, `{breach_limit}`, `{support_email}` (×2 — mailto + label), `{dashboard_url}` (×2 — href + label), `{site_name}`. ≥4-of-list minimum from spec exceeded (11 distinct vars present).

### Anti-Patterns Scanned

| File | Pattern | Result |
| ---- | ------- | ------ |
| `templateAutoCreator.service.ts` | TODO/FIXME/placeholder | None in the modified hunk |
| `sync-rule-breached-template-vars.ts` | `return null`, empty handlers, console.log-only stubs | None; script has real mongoose writes + structured exits |
| `sync-rule-breached-template-vars.ts` | Mustache `{{...}}` in NEW_BODY | None — single-brace only |

### Commits & Push State

| # | Hash | File | Lines | Push |
| - | ---- | ---- | ----- | ---- |
| 1 | `62175f4f` | `pft-backend/src/app/services/email/templateAutoCreator.service.ts` | +33/-2 | pushed to origin/main-2026 |
| 2 | `20ec2680` | `pft-backend/src/scripts/migrations/sync-rule-breached-template-vars.ts` | +161 | pushed to origin/main-2026 |

`git rev-parse HEAD` == `git rev-parse origin/main-2026` == `20ec2680055076c65fbdb1cee96d4b9dc37ea4d6` — in sync.

### Convention Adherence

- No test infrastructure added (matches Phase 5 / 4.1 / 6 / 7 convention). VERIFIED.
- Task 3 (live ops sync + render confirmation + ticket replies) deferred to post-deploy human verification (matches 04-04 / 05-01 / 06-01 / 07-02 convention). VERIFIED.

### Gaps Summary

No code gaps. Every static must-have is satisfied in the actual codebase: seed body interpolates ban_reason with single-brace tokens, variables array union-extended to 20, OLD_RULE_BREACHED_BODY exported and consumed by the sync script via named import, sync script implements DATABASE_URL gating + --dry-run + null-skip + union-merge + strict-equality body overwrite + one-line summary log, other 3 breach templates byte-identical in the diff, both source tickets named in the commit body, both commits pushed to origin/main-2026, zero cross-repo edits.

Remaining work is all human-gated post-deploy ops verification (per-brand sync against XPIPS + Funding Optimal live DBs, render confirmation on a real breach, admin-editor spot-check, ticket replies). See `human_verification` block in frontmatter.

---

_Verified: 2026-06-30 by Claude (gsd-verifier)_
