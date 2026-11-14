# Registration & Payment

How traders get an account, how checkout and payment work, and what you configure.

## Registration

A trader can register first or simply buy at checkout.

- **Register form**: first name, last name, email, password, optional referral code, and acceptance of the terms. Google sign-in is available too.
- **Verification code**: the emailed code at sign-up and login is a **firm-wide setting**. When it is off, traders register and log in without one. Staff logins always need a code.
- **Buy first**: checkout is public. If the email is new it creates the account and emails a temporary password.

## Checkout

The trader chooses a program and size, add-ons, coupons, then billing details and a payment method, in three steps: Review Package, Payment Details, Confirm Payment.

- **Programs and add-ons** are yours: sizes, prices and add-on kinds (leverage, drawdown, profit split, reset and others) are free per program. See the program editor.
- **Pricing**: tier discounts stack with coupons, and a second stackable coupon is supported. You can set the card-provider product name and description per plan.
- **Pay After Pass** programs charge an initial price, then the remaining price once before funded. See [Pass & Progression](/admin/pass-progression).
- **Breach limits** are shown in the account currency (USD), not the checkout display currency.

## Payment gateways

Gateways are configured under payment configuration. A gateway appears at checkout only when it is **active there and allowed for your firm**. The platform supports several card, PayPal, crypto and local-method providers; two crypto providers cannot both be active. A bank transfer is not a checkout method: staff record those as manual payments.

### Manual payments

From **Payment History** staff can add a manual payment: a form on the left and a live order summary on the right. Use it for transfers received outside checkout.

## After payment

1. The payment is marked successful and the trader gets a success email.
2. The account is created on MT5 and the login details are sent in the new trading account email.
3. Payments can also be pending, expired or partially paid. Retries are grouped in one expandable row in Payment History.

There is no separate payment-failed email.

## Related

- [Master User Flow](/admin/master-user-flow)
- [Email Flows](/admin/email-flows)
