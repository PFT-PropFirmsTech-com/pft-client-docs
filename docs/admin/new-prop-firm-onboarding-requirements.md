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

- Pay After Pass (`PAP`) on or off
- Affiliate Program on or off
- KYC on or off, plus provider choice (In-house or Veriff)
- Special Programs and 3-Step Challenges on or off
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

- Email templates
- Message templates
- Header and footer assets
- Optional platform download links

## 6) Super-admin project setup inputs

The super-admin system also requires project-level configuration values for
environment routing, feature delivery, and white-label isolation.

- Unique `projectId` (slug format) and project display name
- Environment endpoint URLs for `dev`, `staging`, and `production`:
  API, worker, dashboard, and web URLs
- Confirmation of key feature flags:
  `payAfterPassEnabled`, `affiliateProgramEnabled`, `kycEnabled`,
  `withdrawalsEnabled`, and `certificatesEnabled`
- Selected `paymentGateways` list for this project
- Confirmation of dashboard environment mapping:
  `NEXT_PUBLIC_SUPER_ADMIN_URL` and `NEXT_PUBLIC_PROJECT_ID`

## Handover format

Submit everything in one shared onboarding document (Google Doc, Notion page,
or spreadsheet) with sections matching this page. This reduces back-and-forth
and lets implementation start immediately.
