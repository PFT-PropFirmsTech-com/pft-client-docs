# Breach Detection

How an account is breached, what happens at that moment, and what staff can do afterwards. Which rules apply to an account depends on its **program**: each rule is set per program, and most are off until you switch them on.

## What can breach an account

**Loss limits** (always part of a challenge program):

- **Daily drawdown**: loss within one trading day.
- **Maximum drawdown**: overall loss, either static or trailing, depending on the program's drawdown model.

**Other rules** (each is a program setting, off by default):

- Challenge time limit
- Minimum trade duration, mandatory stop loss, mandatory take profit
- Maximum lot size, maximum risk per trade, hedging, trade size and lot size consistency
- Maximum open loss per symbol
- No holding positions over the weekend
- Inactivity

For the trade-level rules your firm chooses the action: a **warning**, a **warning first and a breach if repeated**, or an **immediate breach**. Warnings go to the trader by email. Stop loss and take profit have a grace period after opening a trade (2 minutes by default, configurable), and minimum trade duration can spare a trade the broker closed on a stop loss (see below).

Staff can also breach an account by hand.

## How the loss limits work

All three are measured in money, from fixed anchors:

- **Daily drawdown.** At the start of each trading day (midnight in your trading timezone) the system takes a baseline: the settled end-of-day balance. The daily floor is that baseline minus the program's starting balance times the daily percentage. The account breaches when equity goes below the floor, including a dip that recovered later in the day. Programs using the trailing daily type take the highest balance or equity seen at any end of day as the baseline, and it only moves up.
- **Maximum drawdown, static.** Floor = starting balance minus starting balance times the maximum percentage. After a payout the floor is re-anchored to the post-payout balance.
- **Maximum drawdown, trailing.** Floor = the highest equity the account has ever reached times (1 minus the trailing percentage). The floor rises as equity rises and never falls.

The **drawdown model** of the program decides what combines: *standard* (daily plus static maximum), *trailing* (trailing maximum, no daily limit) or *hybrid* (daily plus trailing).

## Minimum trade duration and stop losses

The minimum trade duration rule can treat a trade the broker closed on a stop loss in four ways: count it as a violation (default), exempt it if it lost money, exempt every stop-closed trade, or spare only stops the trader never moved (with a window, 20 seconds by default). Exempting winners that closed on a trailing stop lets short winning trades through, which is the behaviour the rule exists to catch. Existing programs are unchanged until you choose.

## What happens at a breach

1. Trading on the MT5 account is disabled, pending orders are cancelled and open positions are closed. The trader stays logged in but cannot trade.
2. The account is marked breached and the reason is recorded.
3. A snapshot of the account and a record in the audit log are saved.
4. The trader gets a breach email (a different one for challenge and funded accounts) and, if configured, a Rebound offer. A breach webhook is sent if you use webhooks.
5. A breach is skipped while a payout is being processed on the account.

The MT5 login is disabled automatically some days after a breach (about 7 by default; the exact value is a deployment setting).

## What the trader sees

The account page shows "Account evaluation failed" with the reason, plus the Reset and Rebound panels when they apply. The breach snapshot is for staff only.

## What staff can do

In the admin menu:

- **Breach Logs**: the audit trail, with CSV export. Entries are kept for a year by default, and staff can edit a breach reason.
- **Trading Rules Monitor** and **Account Parameter Overrides**: see and override rule values on one account.
- **Account Disable Queue**: MT5 accounts waiting to be disabled, by MT5 group.
- **Manual breach** and **unbreach** on an account. Unbreach can reset the day (daily) or the whole account (complete).

Traders can buy a replacement account where you enable it: see [Paid Reset](/admin/paid-reset).

## Related

- [Trading & Monitoring](/admin/trading-monitoring)
- [Pass & Progression](/admin/pass-progression)
