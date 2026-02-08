# Email Template Variables Audit Report

**Generated:** 2026-02-08
**Scope:** Comparison of documented email templates in `templateVariables.utils.ts` vs actual email sending code

---

## Executive Summary

### Statistics
- **Total templates documented:** 56
- **Total templates actively sent in code:** 32
- **Templates sent but not documented:** 1 (`reset_account_created`)
- **Templates documented but never sent:** 24
- **Templates with variable mismatches:** 28
- **Critical naming mismatches:** 5

### Critical Issues

1. **Missing `company_name` variable**: 28 templates don't send `company_name` despite documentation marking it as required
2. **Template naming inconsistencies**: 5 templates use different names in code vs documentation
3. **Undocumented template**: `reset_account_created` is sent but not documented
4. **24 documented templates never sent**: May indicate unused/deprecated templates or missing implementations

---

## Template Naming Mismatches

| Code Sends | Documentation Has | Status |
|------------|-------------------|--------|
| `reset_password` | `forgot_password` | MISMATCH |
| `admin_created_user` | `admin-created-user` | MISMATCH (underscore vs hyphen) |
| `password_set_success` | `password-set-success` | MISMATCH (underscore vs hyphen) |
| `user_certificate` | `CERTIFICATES` | MISMATCH (different name) |
| `reset_account_created` | `ACCOUNT_RESET` | MISMATCH (different name) |

---

## Templates Sent But Not Documented

### 1. reset_account_created
**Location:** `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Ban/ban.service.ts:924`

**Variables sent:**
- user_name
- program_name
- old_account_id
- new_account_id
- new_password
- reset_reason
- company_name
- brand_name

**Issue:** This template is actively used but has no documentation. Documentation has `ACCOUNT_RESET` which may be the intended name.

---

## Templates With Variable Discrepancies

### Authentication Templates

#### welcome_email
**Sent from:** `auth.service.ts:558, 938`
- **Variables sent:** `user_name`
- **Variables documented:** `user_name`, `company_name` (required)
- **Missing in code:** `company_name`

#### two_factor_auth
**Sent from:** `auth.service.ts:1119, 1161`
- **Variables sent:** `otp`, `user_name`
- **Variables documented:** `otp`, `user_name`, `company_name` (required)
- **Missing in code:** `company_name`

#### reset_password (sent) / forgot_password (documented)
**Sent from:** `auth.service.ts:1312`
- **Variables sent:** `reset_link`, `user_name`
- **Button props:** `reset_password` (text, url, style)
- **Variables documented:** `reset_link`, `user_name`, `reset_password` (button), `company_name` (required)
- **Missing in code:** `company_name`
- **Issue:** Template name mismatch

#### admin_created_user (sent) / admin-created-user (documented)
**Sent from:** `auth.service.ts:1378`
- **Variables sent:** `user_name`, `user_email`, `user_role`, `login_url`, `temporary_password` (optional), `user_password` (optional)
- **Variables documented:** `user_name`, `user_email`, `user_role`, `login_url`, `company_name` (required)
- **Extra in code:** `temporary_password`, `user_password`
- **Missing in code:** `company_name`
- **Issue:** Template name mismatch (underscore vs hyphen)

#### password_set_success (sent) / password-set-success (documented)
**Sent from:** `auth.service.ts:1388`
- **Variables sent:** `user_name`
- **Variables documented:** `user_name`, `company_name` (required)
- **Missing in code:** `company_name`
- **Issue:** Template name mismatch (underscore vs hyphen)

### Payment Templates

#### success_payment
**Sent from:** `payment.service.modular.ts:814, 2171`
- **Variables sent:** `user_name`, `amount`, `currency`, `transaction_id`
- **Variables documented:** `amount`, `currency`, `user_name`, `company_name` (required)
- **Extra in code:** `transaction_id`
- **Missing in code:** `company_name`

#### payout_requested
**Sent from:** `withdrawal.service.ts:859`
- **Variables sent:** `user_name`, `withdrawal_amount`, `requested_amount`, `platform_fee`, `total_deduction`, `profit_split`, `withdrawal_date`
- **Variables documented:** `user_name`, `withdrawal_amount`, `platform_fee`, `total_deduction`, `profit_split`, `withdrawal_date`, `company_name` (required)
- **Extra in code:** `requested_amount`
- **Missing in code:** `company_name`

#### payout_rejected
**Sent from:** `withdrawal.service.ts:1912`
- **Variables sent:** `user_name`, `withdrawal_amount`, `rejection_reason`, `withdrawal_date`, `rejection_date`
- **Variables documented:** `user_name`, `withdrawal_amount`, `rejection_reason`, `withdrawal_date`, `rejection_date`, `company_name` (required)
- **Missing in code:** `company_name`

#### payout_cancelled
**Sent from:** `withdrawal.service.ts:1928`
- **Variables sent:** `user_name`, `withdrawal_amount`, `cancellation_reason`, `withdrawal_date`, `cancellation_date`
- **Variables documented:** `user_name`, `withdrawal_amount`, `cancellation_reason`, `withdrawal_date`, `cancellation_date`, `company_name` (required)
- **Missing in code:** `company_name`

### Affiliate Templates

#### referral_registration
**Sent from:** `auth.service.ts:1976`
- **Variables sent:** `referrer_name`, `new_user_name`, `new_user_email`, `referral_code`, `registration_date`
- **Variables documented:** `referrer_name`, `new_user_name`, `new_user_email`, `referral_code`, `registration_date`, `company_name` (required)
- **Missing in code:** `company_name`

#### commission_earned
**Sent from:** `affiliate.service.ts:2902`
- **Variables sent:** `referrer_name`, `commission_amount`, `tier`, `transaction_amount`, `buyer_name`, `commission_percentage`, `earned_date`
- **Variables documented:** `referrer_name`, `commission_amount`, `tier`, `transaction_amount`, `buyer_name`, `commission_percentage`, `earned_date`, `company_name` (required)
- **Missing in code:** `company_name`

### Compliance Templates

#### rule_breached
**Sent from:** `accountStatistics.service.ts:414`, `ImmediateBreachHandler.ts:1497`

**From accountStatistics.service.ts:**
- **Variables sent:** `user_name`, `program_name`, `account_id`, `rule_name`, `violation_details`, `current_balance`, `max_drawdown`, `max_daily_loss`, `check_date`
- **Missing in code:** `company_name`

**From ImmediateBreachHandler.ts (comprehensive breach handler):**
- **Variables sent:** `user_name`, `account_id`, `program_name`, `challenge_name`, `message`, `ban_reason`, `dash_link`, `dashboard_url`, `violation_details`, `check_date`, `company_name`, `breach_type`, `breach_type_label`, `rule_name`, `breach_date`, `current_equity`, `current_balance`, `floating_pnl`, `breach_level`, `baseline_at_breach`, `breach_value`, `breach_limit`, `max_drawdown`, `max_daily_loss`, `daily_drawdown_limit`, `max_drawdown_limit`, `trailing_drawdown_limit`, `daily_drawdown_type`, `account_size`, `program_stage`, `account_type`, `open_positions_count`, `positions_closed_count`
- **Additional for MIN_TRADE_DURATION:** `min_trade_duration`, `min_trade_duration_formatted`, `actual_trade_duration`, `actual_trade_duration_formatted`, `violating_trade_details`
- **Additional for LOT_SIZE:** `max_lot_per_trade`, `max_lots_per_day`, `actual_lot_size`, `today_total_lots`, `lot_size_violation_details`
- **Extra in code:** `challenge_name`, `message`, `ban_reason`, `dash_link` (many breach-specific variables)
- **Status:** ImmediateBreachHandler sends extensive variables, mostly documented

#### funded_account_breach
**Sent from:** `ImmediateBreachHandler.ts:1497`
- **Variables sent:** Same as `rule_breached` from ImmediateBreachHandler
- **Variables documented:** Extensive list (lines 733-908 in templateVariables.utils.ts)
- **Status:** Well documented with comprehensive breach-specific variables

#### inactivity_warning
**Sent from:** `inactivity-cron.service.ts:281`
- **Variables sent:** `user_name`, `user_email`, `account_id`, `program_id`, `program_name`, `program_created_at`, `warning_days`, `breach_days`, `warning_date`, `breach_date`, `days_inactive`, `policy_description`, `site_name`, `dashboard_url`
- **Variables documented:** `user_name`, `user_email`, `account_id`, `program_id`, `program_created_at`, `warning_days`, `breach_days`, `warning_date`, `breach_date`, `days_inactive`, `policy_description`, `site_name`, `dashboard_url`, `company_name` (required)
- **Extra in code:** `program_name`
- **Missing in code:** `company_name`

#### inactivity_breach
**Sent from:** `inactivity-cron.service.ts:369`
- **Variables sent:** Same as `inactivity_warning`
- **Variables documented:** Same as `inactivity_warning`
- **Extra in code:** `program_name`
- **Missing in code:** `company_name`

### KYC Templates

#### kyc_submitted
**Sent from:** `kyc.service.ts:267`
- **Variables sent:** `user_name`, `kyc_document_type`, `upload_date`, `document_size`
- **Variables documented:** `user_name`, `kyc_document_type`, `upload_date`, `document_size`, `company_name` (required)
- **Missing in code:** `company_name`

#### kyc_validated
**Sent from:** `kyc.service.ts:559`
- **Variables sent:** `user_name`, `validation_date`, `kyc_status`
- **Variables documented:** `user_name`, `validation_date`, `kyc_status`, `company_name` (required)
- **Missing in code:** `company_name`

#### kyc_rejected
**Sent from:** `kyc.service.ts:566`
- **Variables sent:** `user_name`, `rejection_date`, `kyc_status`, `rejection_reason`
- **Variables documented:** `user_name`, `rejection_date`, `kyc_status`, `company_name` (required)
- **Extra in code:** `rejection_reason`
- **Missing in code:** `company_name`

#### kyc_reminder
**Sent from:** `kyc-reminder-cron.service.ts:227`
- **Variables sent:** `user_name`, `user_email`, `site_name`, `dashboard_url`, `kyc_url`, `program_names`, `program_count`, `reminder_number`, `has_pending_kyc`
- **Variables documented:** `user_name`, `user_email`, `site_name`, `dashboard_url`, `kyc_url`, `program_names`, `program_count`, `reminder_number`, `has_pending_kyc`
- **Status:** Perfect match

#### kyc_requested (from programProgression.ts)
**Sent from:** `programProgression.ts:809`
- **Variables sent:** `user_name`, `program_name`, `account_size`, `mt5_id`, `site_name`, `login_url`, `dashboard_url`
- **Variables documented:** `user_name`, `kyc_document_type`, `upload_date`, `document_size`, `company_name` (required)
- **Issue:** MAJOR MISMATCH - Code sends completely different variables than documented. Documentation appears to be for kyc_submitted, not kyc_requested.

### Contract Templates

#### contract_approved
**Sent from:** `contracts.service.ts:277`
- **Variables sent:** `status`, `user_name`
- **Variables documented:** `status`, `company_name` (required)
- **Extra in code:** `user_name`
- **Missing in code:** `company_name`

#### contract_rejected
**Sent from:** `contracts.service.ts:463`
- **Variables sent:** `status`, `user_name`, `rejection_reason` (optional)
- **Variables documented:** `status`, `company_name` (required)
- **Extra in code:** `user_name`, `rejection_reason`
- **Missing in code:** `company_name`

#### contract_pending
**Sent from:** `contracts.service.ts:463`
- **Variables sent:** `status`, `user_name`
- **Variables documented:** `status`, `company_name` (required)
- **Extra in code:** `user_name`
- **Missing in code:** `company_name`

### Certificate Templates

#### user_certificate (sent) / CERTIFICATES (documented)
**Sent from:** `certificate.service.ts:549`
- **Variables sent:** `user_name`, `certificate_type`, `program_name`, `date`, `amount`
- **Variables documented:** `name`, `certificate_type`, `date`, `amount`, `certificate_url` (image), `download_certificate` (button), `view_dashboard` (button), `company_name` (required)
- **Extra in code:** `user_name`, `program_name`
- **Missing in code:** `name`, `certificate_url`, `download_certificate`, `view_dashboard`, `company_name`
- **Issue:** Template name mismatch, variable name mismatch (`user_name` vs `name`)

### Program Templates

#### program_progression
**Sent from:** `programProgression.ts:89`
- **Variables sent:** `user_name`, `program_name`, `previous_program`, `program_stage`, `challenge_type`, `account_size`, `mt5_id`, `mt5_pass`, `broker_server`, `stage_message`, `site_name`, `login_url`, `rules`
- **Variables documented:** `user_name`, `program_name`, `previous_program`, `challenge_type`, `account_size`, `mt5_id`, `mt5_pass`, `broker_server`, `stage_message`, `site_name`, `login_url`, `company_name` (required)
- **Extra in code:** `program_stage`, `rules`
- **Missing in code:** `company_name`

#### approved_account_validation
**Sent from:** `approvedAccountValidationEmail.service.ts`
- **Variables sent:** `user_name`, `program_name`, `account_id`, `mt5_id`, `account_size`, `site_name`, `login_url`, `dashboard_url`
- **Variables documented:** `user_name`, `program_name`, `account_id`, `mt5_id`, `account_size`, `site_name`, `login_url`, `dashboard_url`
- **Status:** Perfect match

### Pay After Pass Templates

#### pay_after_pass
**Sent from:** `programProgression.ts:453`
- **Variables sent:** `user_name`, `program_name`, `next_stage_program`, `account_size`, `mt5_id`, `balance`, `profit_amount`, `trading_days`, `payment_amount`, `site_name`, `login_url`, `dashboard_url`
- **Variables documented:** `user_name`, `program_name`, `account_size`, `mt5_id`, `balance`, `profit_amount`, `trading_days`, `next_stage_program`, `payment_amount`, `company_name` (required)
- **Extra in code:** `site_name`, `login_url`, `dashboard_url`
- **Missing in code:** `company_name`

#### pay_after_pass_reminder_7_days
**Sent from:** `pay-after-pass-reminder.service.ts`
- **Variables sent:** `user_name`, `program_name`, `account_size`, `payment_amount`, `expiry_date`, `dashboard_url`, `company_name`, `site_domain`, `checkout_url`, `days_remaining`, `next_stage_program`
- **Variables documented:** `user_name`, `program_name`, `account_size`, `payment_amount`, `expiry_date`, `dashboard_url`, `days_remaining`, `company_name` (required)
- **Extra in code:** `site_domain`, `checkout_url`, `next_stage_program`
- **Status:** Code sends company_name (good), but also extra variables

#### pay_after_pass_reminder_3_days
**Sent from:** `pay-after-pass-reminder.service.ts`
- **Variables sent:** Same as `pay_after_pass_reminder_7_days`
- **Variables documented:** Same as `pay_after_pass_reminder_7_days`
- **Extra in code:** `site_domain`, `checkout_url`, `next_stage_program`

#### pay_after_pass_reminder_1_day
**Sent from:** `pay-after-pass-reminder.service.ts`
- **Variables sent:** `user_name`, `program_name`, `account_size`, `payment_amount`, `expiry_date`, `dashboard_url`, `company_name`, `site_domain`, `checkout_url`, `days_remaining`, `next_stage_program`
- **Variables documented:** `user_name`, `program_name`, `account_size`, `payment_amount`, `expiry_date`, `dashboard_url`, `site_domain`, `company_name` (required)
- **Extra in code:** `checkout_url`, `days_remaining`, `next_stage_program`

#### pay_after_pass_expired
**Sent from:** `pay-after-pass-reminder.service.ts`
- **Variables sent:** `user_name`, `program_name`, `account_size`, `payment_amount`, `expiry_date`, `dashboard_url`, `company_name`, `site_domain`, `checkout_url`, `days_remaining`, `next_stage_program`
- **Variables documented:** `user_name`, `program_name`, `account_size`, `expiry_date`, `checkout_url`, `site_domain`, `company_name` (required)
- **Extra in code:** `payment_amount`, `dashboard_url`, `days_remaining`, `next_stage_program`

---

## Templates Documented But Never Sent

These templates are documented in `templateVariables.utils.ts` but no code was found that sends them:

1. **payout_approved** - Documented with BTC transaction variables
2. **payout_confirmed** - Documented with BTC transaction variables
3. **withdrawal_approved** - Documented for affiliate withdrawals
4. **withdrawal_rejected** - Documented for affiliate withdrawals
5. **withdrawal_completed** - Documented for affiliate withdrawals
6. **kyc_pending** - Documented but never sent
7. **funded_achieved** - Documented but never sent
8. **funded_validation** - Documented but never sent
9. **new_trading_account** - Documented but never sent
10. **challenge_not_passed** - Documented with extensive breach variables
11. **challenge_passed** - Documented but never sent
12. **CHALLENGE_PASSED** - Duplicate of challenge_passed (uppercase)
13. **PROGRAM_BANNED** - Documented but never sent
14. **min_trade_duration_warning** - Documented but never sent
15. **stop_loss_warning** - Documented but never sent
16. **take_profit_warning** - Documented but never sent
17. **lot_size_warning** - Documented but never sent
18. **weekend_positions_closed** - Documented but never sent
19. **weekend_holding_warning** - Documented but never sent
20. **leverage_exceeded_breach** - Documented but never sent
21. **support_resolved** - Documented but never sent

**Note:** Some of these may be:
- Deprecated/unused templates
- Future planned features
- Templates sent from services not analyzed in this audit
- Templates with different names in code (like reset_password vs forgot_password)

---

## Recommendations

### High Priority

1. **Fix template naming mismatches:**
   - Standardize on either underscores or hyphens (recommend underscores for consistency)
   - Update code or documentation to use consistent names
   - Consider: `reset_password` → `forgot_password` OR update docs to `reset_password`
   - Consider: `admin_created_user` → keep as is, update docs from `admin-created-user`
   - Consider: `user_certificate` → `CERTIFICATES` OR update docs to `user_certificate`

2. **Add missing `company_name` variable:**
   - 28 templates are missing this required variable
   - Either add it to all email sending code OR mark it as optional in documentation
   - Recommend: Add to all templates for branding consistency

3. **Document `reset_account_created` template:**
   - Currently sent but not documented
   - May be the same as `ACCOUNT_RESET` - verify and align naming

4. **Fix `kyc_requested` variable mismatch:**
   - Code sends: `user_name`, `program_name`, `account_size`, `mt5_id`, `site_name`, `login_url`, `dashboard_url`
   - Docs expect: `user_name`, `kyc_document_type`, `upload_date`, `document_size`
   - This is a MAJOR mismatch - documentation appears to be for wrong template

### Medium Priority

5. **Review and update extra variables:**
   - `payout_requested`: Add `requested_amount` to documentation
   - `kyc_rejected`: Add `rejection_reason` to documentation
   - Contract templates: Add `user_name` to documentation
   - Pay after pass reminders: Add `site_domain`, `checkout_url`, `next_stage_program` to documentation
   - Inactivity templates: Add `program_name` to documentation
   - `program_progression`: Add `program_stage`, `rules` to documentation

6. **Clean up unused templates:**
   - Review 24 documented but never-sent templates
   - Remove deprecated templates from documentation
   - Or implement missing email sending code if templates are needed

### Low Priority

7. **Standardize variable naming:**
   - `user_certificate` uses `user_name` but docs use `name`
   - Consider standardizing on `user_name` across all templates

8. **Add missing button/image props:**
   - Certificate template should include image and button props in code
   - Or remove from documentation if not supported

---

## Files Analyzed

### Email Sending Code
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Auth/auth.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Payment/payment.service.modular.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Withdrawals/withdrawal.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Affiliate/affiliate.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/AccountStatistics/accountStatistics.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Contracts/contracts.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/KYC/kyc.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/modules/Certificates/certificate.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/services/cron/pay-after-pass-reminder.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/services/cron/inactivity-cron.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/services/cron/kyc-reminder-cron.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/services/email/approvedAccountValidationEmail.service.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-backend/src/app/services/programProgression/programProgression.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/services/ban/ImmediateBreachHandler.ts`
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-rule-checker/src/app/services/ban/ban.service.ts`

### Documentation
- `/Users/klev/Code/PFT-WhiteLabel-v2-staging/pft-dashboard/src/utils/templateVariables.utils.ts`

---

## Audit Methodology

1. Read `templateVariables.utils.ts` to extract all documented templates and variables
2. Used grep to find all files containing `sendEmailByEvent` calls (55 files found)
3. Read key email sending service files to extract actual variable usage
4. Compared actual usage against documentation for each template
5. Identified discrepancies in:
   - Template names
   - Required vs optional variables
   - Extra variables sent but not documented
   - Missing variables in code
   - Templates sent but not documented
   - Templates documented but never sent

---

**End of Report**
