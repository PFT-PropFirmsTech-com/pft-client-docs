# Trustpilot Reviews

Invite traders to review your firm on Trustpilot after good moments, such as a completed payout.

## Where to set it up

In the admin menu, **External Services → Trustpilot Reviews**. The **Review Funnel** sits under the same menu.

## Events that can trigger an invitation

Purchase completed, payout completed, payout approved, challenge passed, funded account achieved, funded validation, program progression, support ticket resolved, free trial claimed and free challenge claimed. Switch on only the ones you want.

> **What fires today.** Invitations are sent for payout completed, free trial, free challenge and support resolved. Events whose email is sent by the rule engine (pass, funded, validation, progression) do not add an invitation in the current version. Test with a real event before relying on one.

## Invitation method

Choose the method in the settings. **BCC** is the recommended one: your normal event email is copied to Trustpilot's invitation address.

## Settings and defaults

- **Cooldown**: 30 days between invitations to the same trader.
- **Delay**: 24 hours.
- **Minimum payout**: $100 for payout events.

With the BCC method these three do **not** gate the copy: it is added whenever the event is enabled. The delay only sets the send time for API invitations. If invitations arrive too often, switch the event off or move to API invitations.

## Related

- [Email Flows](/admin/email-flows)
