# Trading & Monitoring

How accounts are watched while traders trade, and how the objectives are measured.

## How monitoring works

- The platform receives account and trade events from the MT5 gateway as they happen. The rule engine checks drawdown on each equity update.
- Trade-level rules (stop loss, take profit, lot size, minimum duration and similar) are evaluated on a loop of about 30 seconds.
- The dashboard shows an account live only while someone has that account open. The trader's browser connects directly to the rule engine for live balance, equity, positions and rule progress.
- Day boundaries use your firm's trading timezone (midnight there), not UTC.

## Objectives and how they are measured

- **Profit target**: measured on **balance**, so only closed profit counts (balance minus starting balance). Floating profit does not. Profit targets apply to challenge stages, not to funded accounts.
- **Minimum trading days**: a trading day is a day with at least one closed trade. If the program also sets a minimum profit percentage per day, only days that reach it count as qualifying. The default minimum is one day.
- **Daily and maximum drawdown**: see [Breach Detection](/admin/breach-detection).
- **Time limit**, **inactivity**: per program.

Every number above is a program setting, so two programs on your platform can differ. Purchased add-ons can change rule values for one account, and staff can override values per account from **Account Parameter Overrides**.

## What the trader sees

Each objective card on the account page shows Passed, Failed, Ongoing or Upcoming. Margin usage has its own card with colour bands at 50% and 80%. Rule warnings arrive by email.

## What staff see

- **Trading Rules Monitor**: current rule state of an account.
- **Account Parameter Overrides**: change a rule value for one account.
- **MT5 Accounts** and **Account Disable Queue**: every MT5 account, filterable, with bulk actions.

## Related

- [Breach Detection](/admin/breach-detection)
- [Pass & Progression](/admin/pass-progression)
