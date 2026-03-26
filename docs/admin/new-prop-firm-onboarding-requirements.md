# New prop firm onboarding requirements

Use this checklist when a new prop firm starts onboarding. You must collect all
required items before technical setup begins.

## 1) Brand identity

Share your complete brand package so we can configure UI, communication, and
certificate output correctly.

- Brand name, short name, and tagline
- Primary color (hex), and optional secondary or accent colors
- Logo, favicon, and social share image (`1200x630`)
- Website URL
- Cloudflare access shared with `info@propfirmstech.com`
- Support email
- Privacy Policy, Terms, and Refund Policy (URL or full text)
- Brand font (Google Fonts or custom font files)
- Certificate styling preferences (font size and certificate layout references)

## 2) Feature toggles

Define which features you want active at launch so we can configure project
flags before go-live.

- Programs List (Check section 4.)
- Pay After Pass (`PAP`) on or off
- Affiliate Program on or off
- Payment gateways to enable:
  Stripe, PayPal, PayGate, NowPayments, OxaPay, Paytiko, or Paysagi

## 3) Backend configuration

Provide the credentials and policies required for platform integrations and
automation services.

- Broker (`MT5 Manager API`) credentials:
  host, port, login, password, and server group
- SMTP provider credentials (for example Postmark, SendGrid, or Zoho)
- Payment provider keys (Stripe, PayPal, crypto providers, and others in use)
- Cloudinary account access (or confirm we should set it up using your email)
- Optional inactivity policy (maximum inactive days before action)

## 4) Programs (challenges)

Start with your initial FX program list. You only need to provide names and
core rules first, and we will structure the full program configuration.

For each program, send:

- Program name (for example `Instant`)
- Account sizes and prices (for example `5k - $59`, `10k - $89`, ... `200k - $799`)
- Consistency rule (for example `25%`)
- Total drawdown (for example `5%`)
- Profit split (for example `50%`)
- Any launch constraints or notes

## 5) Additional assets

Send supporting assets that are needed for customer communication and site
polish.

### Email settings

Provide your email configuration package so we can manage email layouts and
message templates from day one.

- Confirm the **Layouts** and **Templates** sets you want active at launch
- Share base header and footer brand assets for email layouts
- Share layout-level content preferences (voice, legal footer, CTA style)
- Share template-specific placeholders and dynamic tokens requirements

Layout overview reference (expected list):

1. `FO - Approved Trader`
2. `FO - KYC Reminder`
3. `FO - Phase 3 Passed`
4. `FO - Phase 2 Passed`
5. `FO - Phase 1 Passed`
6. `FO - Withdrawal Request Submitted`
7. `FO - Signed Contract Requested`
8. `FO - Approved Account Breach`
9. `FO - Reward Confirmed`
10. `FO - Reward Requested`
11. `FO - Withdrawal Approved`
12. `FO - Reward Approved`
13. `FO - Reward Cancelled`
14. `FO - Reward Rejected`
15. `FO - Withdrawal Rejected`
16. `FO - Withdrawal Completed`
17. `FO - Reset Password Requested`
18. `FO - Payout Requested`
19. `FO - KYC Validation`
20. `FO - Mt5 Error Alert`
21. `FO - Congratulation`
22. `FO - Inactivity Warning`
23. `FO - KYC Submited`
24. `FO - Contract Approved`
25. `FO - Contract Rejected`
26. `FO - Contract Pending`
27. `FO - KYC Pending`
28. `FO - Admin Created User`
29. `FO - Certificate of Achievement`
30. `FO - Commission Earn`
31. `FO - KYC Approved`
32. `FO - KYC Rejected`
33. `FO - KYC Requested`
34. `FO - Reward Cancelled`
35. `FO - Funded Validation`
36. `FO - Funded Account Achieved`
37. `FO - 2FA Verification Code`
38. `FO - Referral Registration`
39. `FO - Challenge Passed`
40. `FO - Program Progression`
41. `FO - Password Set Successful`
42. `FO - Challenge Not Passed`
43. `FO - Payout Approved`
44. `FO - Withdrawal Approved`
45. `FO - Payment Successfull`
46. `FO - Welcome`
47. `FO - New Trading Account`
48. `FO - Inactivity Breach`
49. `FO - Rule Breached`

### Other assets

- Optional platform download links


## Handover format

Submit everything in one shared onboarding document (Google Doc, Notion page,
or spreadsheet) with sections matching this page. This reduces back-and-forth
and lets implementation start immediately.
