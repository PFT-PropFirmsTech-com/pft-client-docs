# Paid Reset of a Breached Account

Let traders buy their way back onto a program after a breach. Paying issues a **replacement account** on the same program. The breached account stays breached and keeps its history.

## Turn it on

Open the program in the program editor, go to the **Pricing** section and switch on **Allow paid reset after a breach**. Then set:

- **Reset price**. Must be greater than 0. A program with resets on and no price cannot be saved.
- **Currency**. Defaults to USD. Traders see the price in this currency.
- **Max resets per trader**. How many times one trader can buy a reset on this program. `0` means unlimited.

Resets are set **per program**, independent of Pay After Pass. Programs without the switch never show the offer.

## What the trader sees

On a breached account of that program the trader sees "Reset your account for" followed by the price, with a **Reset** button and, if a limit is set, how many resets are left. See [Reset a Breached Account](/client/reset-breached-account) for the trader's view.

## Rules the system enforces

- Only a **breached** account is offered a reset. Passed and frozen accounts are not.
- **One reset per breach.** Once a breached account has been replaced it is not offered again.
- The per-trader limit counts completed resets on that program.
- While a payment is in progress the account is reserved. An abandoned checkout releases the reservation after about 30 minutes, or immediately when the gateway reports a failure or expiry.

## When a payment is taken but no account appears

The trader sees "Your reset payment was received and your new account is being set up." If provisioning fails, the reset is recorded as **paid but not provisioned** and nothing is refunded automatically. A retry runs the normal account assignment again and does not issue a second account for the same payment.

## Related

- [Withdrawal Flow](/admin/withdrawal-flow)
