# Email Flows

The platform sends an email for each **event** (a payment, a pass, a breach, a payout decision). Each event has a **template** stored for your firm, so you can change the wording, translate it and choose the layout.

## How it fits together

- **Events** are fixed by the platform. Templates for them are created for you.
- **Templates** are yours: subject, body, language versions and layout. Edit them in your email templates.
- **Sending** uses the one active SMTP configuration your admin sets under Email Management → Email Configuration.
- A **suppression list** keeps traders who unsubscribed or bounced from being emailed.

## Events, by group

**Account**: welcome, account created by staff, password set, verification code, password reset.

**Purchase and accounts**: payment success, new trading account (with login details), free trial and free challenge ready, replacement account after a reset, Rebound offer.

**Progress**: phase 1, 2 and 3 passed, challenge passed or not passed, funded account achieved, funded validation, program progression, certificates (stage, funded, payout).

**Breach and rules**: account breached (challenge and funded versions), inactivity warning and breach (also for free challenges), minimum trade duration, stop loss, take profit and lot size warnings, weekend holding warning and positions closed, leverage exceeded.

**Pay After Pass**: notice, reminders 7, 3 and 1 day before, and expiry.

**Verification**: KYC requested, submitted, validated, rejected, reminder; contract requested, approved, rejected.

**Payouts**: requested, approved, confirmed, rejected, cancelled (and the older withdrawal versions).

**Other**: support ticket resolved, referral registration and commission earned, allocation limit warnings.

Some events exist as templates but are not sent in the current flow, for example KYC pending.

## Tips

- Approval and confirmation emails for a payout are sent together at approval.
- A trader's verification code is valid for 10 minutes, and a password reset link for 1 hour.
- Some events can add a Trustpilot invitation: see [Trustpilot Reviews](/admin/trustpilot-reviews).

## Related

- [Master User Flow](/admin/master-user-flow)
- Trader view: [Email Notifications](/client/email-notifications)
