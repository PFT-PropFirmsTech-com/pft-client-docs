---
created: 2026-06-30T16:53:32.202Z
title: Payment History customer link goes to [object Object] (regression)
area: ui
files:
  - pft-dashboard/src/app/(dashboard)/_components/modules/admin/payments-history/PaymentsTable.tsx:613-635
  - pft-dashboard/src/hooks/usePayments.ts:12
  - pft-dashboard/src/app/(dashboard)/admin/users/[id]/page.tsx
ticket: cmquhk6f9005dny0kgrlbemsy
ticket_status: REOPENED by client 2026-06-30 08:18 (TC Pro Support)
---

## Problem

Client (Trading Cult Pro Support) reopened ticket cmquhk6f9005dny0kgrlbemsy reporting:

> "I can see clickable link in Payment History page but it doesn't go to clients profile. undefined undefined's Profile https://dash.tradingcult.com/admin/users/[object%20Object]"

**Root cause (from URL pattern + page title):** The fix I shipped earlier today as commit `4a345ff3` (`feat(admin): link Payment History customer name to client profile`) on pft-dashboard main-2026 wraps the customer name in `<Link href={`/admin/users/${payment.userId}`}>`. The `Payment.userId` TYPE in `src/hooks/usePayments.ts:12` says `userId: string` — but at runtime on Trading Cult `payment.userId` is being delivered as a **populated user object** (likely `{ _id, email, firstName, lastName, ... }`), not the string the type claims.

Template-string interpolation of an object → `[object Object]` → href becomes `/admin/users/[object Object]` (URL-encoded as `[object%20Object]`).

Downstream effect: the `/admin/users/[id]` page receives `[object Object]` as the param, fails to find a matching user → user data is null → page title renders `${user?.firstName} ${user?.lastName}'s Profile` → `undefined undefined's Profile`.

**Why my static check missed it:** I trusted the declared type `userId: string` without verifying the runtime shape against live data. Type was lying.

## Solution

Two-line fix in `PaymentsTable.tsx:613-635` — resolve the userId defensively:

```typescript
const userIdStr =
  typeof payment.userId === "string"
    ? payment.userId
    : (payment.userId as any)?._id;

{userIdStr ? (
  <Link href={`/admin/users/${userIdStr}`} className="...">
    {payment.billingInfo.firstName} {payment.billingInfo.lastName}
  </Link>
) : (
  <p className="...">{payment.billingInfo.firstName} {payment.billingInfo.lastName}</p>
)}
```

**Better fix (separate, larger scope):** correct the `Payment.userId` type in `src/hooks/usePayments.ts:12` to reflect the actual runtime shape — likely a discriminated union `string | { _id: string; ... }` — and audit every other consumer (there are at least 10 per earlier grep — fraud-check, user-LTV, affiliate links, etc.) to handle both. The CSV export `useExportPaymentsCsv` references `p._id` not `p.userId`, but other `router.push` call-sites might have the same bug.

**Verification on live DB:** read one payment doc from TradingCult Mongo, confirm whether `payment.userId` is a string ObjectId or a populated user document. The earlier MongoDB inspection in this session showed `userId: "69fdcb5e51825bf0357f465a"` (string) at the persistence layer — so the population happens in the backend enrichment step. Find which payment-list endpoint populates userId and decide: (a) strip the populate, (b) fix all dashboard consumers, or (c) both (return `userId` as string ObjectId AND a separate `user: {...}` populated field).

**Ticket workflow:** post acknowledgement on cmquhk6f9005dny0kgrlbemsy (reopened bug, regression apology, fix queued for next deploy), set IN_PROGRESS. Same scope as the Phase 4.1 retroactive-audit pattern — this is a regression in the original (pre-v1.1) fix, not a v1.1 bug.

## Notes

- ALSO check the other 9 `router.push` / `<Link>` call-sites in the same file that interpolate `payment.userId`:
  - fraud-check `useFraudCheck`
  - user-LTV `/admin/users/${payment.userId}#user-ltv`
  - All other places I grepped earlier for the v1.1 audit
- The pft-dashboard tsc didn't catch this because `string` template-interpolated with an object compiles fine — TypeScript trusts the declared type. Real runtime/integration tests would have caught it; there are none in pft-dashboard. Same gap as Phase 4 bug 3 (`Number("5k")` NaN).
- Pattern: "type lies" — runtime shape diverges from declared TS type. Worth a memory note alongside `feedback_rebase_when_remote_already_fixed.md`.
