# 04-02 SUMMARY — Ticket clarification reply (Payout vs Withdrawal History)

**Status:** ✓ Complete
**Date:** 2026-06-30
**Wave:** 1
**Type:** human-action (no code)

## What shipped

Posted a clarification reply on ticket [cmqqchwh500bspi0kxw23o2rl](https://portal.propfirmstech.com/admin/tickets/cmqqchwh500bspi0kxw23o2rl) (Trading Cult) explaining that **Payout History** (Affiliate Overview page) and **Withdrawal History** (Withdrawals page) display **identical data** from the same source (`AffiliateWithdrawal` collection via `useGetWithdrawals` hook) — the distinction is purely UI placement, not data.

Reply also flagged that the other two items in the ticket (Payment History CSV export with affiliate columns, and the new per-purchase Purchase Report) are in active development and will be updated as they ship.

## Files modified

None. This is a ticket-reply-only plan (`files_modified: []` in frontmatter).

## must_haves satisfied

- ✓ Ticket cmqqchwh500bspi0kxw23o2rl has a reply explaining that Payout History and Withdrawal History are the same data in two UI contexts (comment id `cmr0hsfj300h3ny0kpmx9qeng`).

## Ticket status

**Kept at IN_PROGRESS** (not moved to WAITING_CLIENT) because items 1 (CSV export) and 3 (Purchase Report) from the same ticket are still being built in Waves 2 and 3. Status flip + final reply happen once all three items ship.

## Deviations from plan

The plan's resume-signal instructed "Set ticket status to WAITING_CLIENT after posting" — overridden because the same ticket covers two more in-flight items. Flipping to WAITING_CLIENT now would be misleading and force the client to either confirm partial work or re-open it for the remaining items. Status will be set to WAITING_CLIENT after 04-04 ships.

## Sources

- Research: `.planning/phases/04-affiliate-reporting/04-RESEARCH.md` — Item 2 section (both sections confirmed identical via shared `useGetWithdrawals` hook in `AffiliatesContainer.tsx`)
