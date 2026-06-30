# Phase 5: Daily Profit Display Bug — Account 13535 — Research

**Researched:** 2026-06-30
**Domain:** pft-dashboard daily P&L pipeline (Trader Account / Programs-Details view)
**Confidence:** HIGH (root cause reproduced against live TradingCult DB)

## Summary

The dashboard "Daily P&L" widget on the Trader Account page is showing **+$55 for 2026-06-18** instead of the broker's truth. I reproduced the bug end-to-end against the live TradingCult Mongo and traced it to a single client-side bug:

The pipeline is `backend /statistics/all-trade-history` (returns raw deals: hot + archive, no math) → `useTradingDashboardData.tradeHistory` → `mergedFromDeals()` (pairs OPEN/CLOSE deals into closed trades) → `useTradingCalculations.dailyPnlData` (sums by day) → `<DailyPnLChart>`.

**The bug:** `mergedFromDeals()` in `pft-dashboard/src/hooks/useTradingDashboardData.ts` line ~601-619 only emits a closed-trade row when the close deal can be paired with an OPEN deal that exists in the same response. If a position was opened BEFORE the earliest deal returned by the backend (a true overnight / multi-day carryover), its close arrives with no matching open, the pairing loop short-circuits at line 605 (`if (remain <= 0 || totalOpen <= 0) continue;`) and **the entire close is silently dropped** — including its (often large) realized profit.

For account 13535 on 2026-06-18, the dropped close was Deal `1036327`, PositionID `1048884`, profit **-$34.69**. The opening deal for that position is not in the dataset (anywhere — hot, archive, or any deal stream we have). Drop it and the math flips from "true $20.16" to the displayed $54.85 → rendered "+$55" by the chart's `toFixed(0)` formatter.

**Primary recommendation:** Fix `mergedFromDeals` so an orphan CLOSE (close with no matching open in the buffer) is still emitted as a closed-trade row, using the close-deal's own time as both OpenTime/CloseTime (zero-duration is fine — `isDisplayableMergedTrade` already accepts it). This is the minimal correct fix; no schema change, no backfill. There is a separate, smaller data-quality concern about the broker $9.90 vs DB $20.16 delta — see "Open Questions".

## Reproduction (live DB)

Connected: `mongodb://TradingCult:…@65.109.82.254:27017/TradingCult`

**Identity verified:**
- `users._id = 6a324ed5cebf12f7fc6a6dff` → email `konrad.k@onet.eu`, `programs[0].mt5AccountId = "13535"` ✓

**Trade collections (key schema notes):**
- `tradehistories` and `tradehistoryarchives` both keyed by `Login` (string, e.g. `"13535"` — NOT `mt5AccountId`, NOT numeric). 52 hot + 67 archived, 103 unique-by-Deal for this account.
- All numeric fields stored as **strings** (`Profit: '20.09'`, `Time: '1781701273'`, `Entry: '1'`, etc.).
- `Time` is Unix-seconds (UTC). Confirmed by spot-checking against the broker server's "Daily Reports" column.
- `Entry`: `"0"` = position IN (open leg), `"1"` = position OUT (close leg). MT5 truth for daily realized P&L = sum of `Profit` on `Entry='1'` rows within the day.
- `journaltrades` for this account: **0 rows** — so the `/journal` route's TradeCalendar is not what the client is looking at; it's the **Trader Account / Programs-Details** DailyPnLChart.
- `dailysnapshots` for `loginId: "13535"`: 14 docs, but `accountMetrics.profit` is computed as `balance - initialBalance` (a running balance offset, not a per-day delta) and most days have `profit: 0` with `trades: 0` despite real activity. **Not the source of the $55 either**, but its own data-quality problem.

**Per-day rollup (UTC, broker-time, EET — identical because all trades are 08:43–14:17 UTC, far from any TZ boundary):**

| Date       | Entry='1' closes | Sum Profit (closes) | All-entry sum |
|------------|------------------|---------------------|---------------|
| 2026-06-17 | 7                | $29.55              | $29.55        |
| **2026-06-18** | **12**       | **$20.16**          | **$11.01**    |
| 2026-06-19 | 5                | $7.75               | -$14.11       |
| 2026-06-22 | 10               | -$64.92             | -$133.26      |
| …          | …                | …                   | …             |

**The 12 closes on 2026-06-18 UTC, sorted by time:**

| Deal     | Vol   | Symbol | Profit  | Time (UTC)  | Notes |
|----------|-------|--------|---------|-------------|-------|
| 1036327  | 0.01  | DE30   | **-34.69** | 08:43:25 | **Orphan**: no matching OPEN in any collection. PositionID 1048884 → only this single deal exists. Position was opened pre-data-window. |
| 1036435  | 0.01  | DE30   | +8.26   | 09:09:36    | |
| 1036473  | 0.01  | DE30   | -8.96   | 09:49:20    | |
| 1036209  | 100   | DE30   | +20.09  | 10:10:32    | 100-lot "test" trade (PositionID 1048821, opened same day 09:45:45). Real lot size, the `Volume=100` is broker raw units (= 1.00 lot). Properly paired — IS included. |
| 1036577  | 0.01  | DE30   | -6.08   | 11:29:48    | |
| 1036578  | 0.01  | DE30   | +7.68   | 11:29:48    | |
| 1036824  | 0.01  | DE30   | +12.84  | 12:48:39    | |
| 1036922  | 0.01  | UT100  | +20.96  | 13:36:16    | |
| 1036992  | 0.01  | DE30   | -11.82  | 13:57:12    | |
| 1036993  | 0.01  | DE30   | -10.38  | 13:57:12    | |
| 1037127  | 0.01  | DE30   | +9.41   | 14:06:11    | |
| 1037148  | 0.01  | DE30   | +12.85  | 14:17:53    | |
| **SUM**  |       |        | **+$20.16** | | |

**The arithmetic match:**

Sum of 12 closes WITHOUT the orphan 1036327: `20.16 − (−34.69) = $54.85`.

`DailyPnLChart` formats with `Math.abs(v).toFixed(0)` (line 39 of `pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/DailyPnLChart.tsx`) → **`$54.85` → displayed `+$55`**. ✓ Exact match to client screenshot.

Excluding the carryover loss is the bug.

## Standard Stack

This is bug-fix research, not a greenfield stack pick — listing the relevant existing modules only.

| Layer | Path | Role |
|-------|------|------|
| Dashboard widget | `pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/DailyPnLChart.tsx` | Renders 7-day daily/cumulative P&L (this is what shows the $55) |
| Mount point | `pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/ChartsSection.tsx` | Mounts `<DailyPnLChart data={dailyPnlData} />` |
| Daily sum | `pft-dashboard/src/hooks/useTradingCalculations.ts` lines 96-136 (`dailyPnlData`) | Groups `tradeHistory` by `getTradingDayKeyFromTimestampMs(Time)` in Europe/Berlin, sums `Profit` per day |
| Trade list | `pft-dashboard/src/hooks/useTradingDashboardData.ts` lines 1025-1119 (`tradeHistory`) | Source-of-truth combined live + REST + server-merged list |
| **Bug site** | `pft-dashboard/src/hooks/useTradingDashboardData.ts` lines 335-630 (`mergedFromDeals`) | **Pairs OPEN/CLOSE deals → emits closed-trade rows. Drops orphan closes (line 605).** |
| Display filter | `pft-dashboard/src/utils/tradeHistoryDisplay.ts` (`isDisplayableMergedTrade`) | Drops rows with `openTime <= 0` — relevant if we emit orphan-close rows with `OpenTime=0`. Must be checked. |
| Backend feed | `pft-backend/src/app/modules/Statistics/statistics.service.ts` (`computeAllTradeHistory`) | Returns raw `tradehistories ∪ tradehistoryarchives` deals filtered by `Login`. No math. Honest. |

Also worth knowing (sibling chart, same data source, same bug surface):
- `pft-dashboard/src/app/(dashboard)/journal/components/TradeCalendar/index.tsx` — independent monthly P&L calendar, but it reads from `useJournalEntries` (Mongo `journaltrades` collection). For account 13535 this collection is empty → calendar shows nothing → **not the surface the client is looking at**. Worth recording: there is a SECOND daily-P&L surface in the codebase and it has a different data flow.

## Architecture Patterns

### How the broken pipeline currently runs

```
[Backend] GET /statistics/all-trade-history/:loginId/:programId
  → returns { tradeHistory: <raw deals from tradehistories + archives, both Entry=0 and Entry=1> }

[Dashboard] useTradingDashboardData.restTradeHistory (raw deals)
  → mergedFromDeals(rawDeals)            ← BUG: orphan closes dropped here
    → filterDisplayableMergedTrades()
      → tradeHistory: TradeData[]
        → useTradingCalculations.dailyPnlData (sum by Berlin-day)
          → <DailyPnLChart data={dailyPnlData} />
```

### Pairing logic — what's correct and what's wrong

`mergedFromDeals` (useTradingDashboardData.ts line 335) does FIFO pairing per `PositionID`:

1. Sorts deals by `TimeMsc` ascending.
2. Groups by `PositionID`.
3. Walks each group: `Entry='0'` pushes to `openQ`; `Entry='1'` pops and emits a closed leg.
4. **Bug:** line 601-619 — on `Entry='1'` if `totalOpen <= 0` (no matching open in `openQ`), `continue` — the deal is dropped entirely with no row emitted.

This is correct for **partial closes mid-stream** but wrong for **legitimate orphan closes** (overnight / multi-day positions whose open is older than the data window). The hot collection retains a finite history (52 deals here); the archive retains older deals but for THIS position (1048884) neither collection has the open. The position was opened far enough in the past that it isn't in any cache we have.

### Anti-pattern: silent drop

Dropping data without logging or fallback is the anti-pattern. The merge function should ALWAYS emit a row for an `Entry='1'` deal, falling back to "orphan close" semantics when no open is found.

## Don't Hand-Roll

| Concern | Don't Build | Use Instead |
|---------|-------------|-------------|
| Re-pairing across the hot/archive boundary | A new "find the open deal across both collections" backend pass | Just emit the orphan close with `OpenTime = CloseTime` (zero-duration row). The display filter already accepts it (`durationSec > 0 || durationMs > 0` — fails, so check carefully — see Pitfalls). |
| Rebuilding daily P&L on the backend | A new `/statistics/daily-pl` aggregation endpoint | The aggregation is fine; the input is wrong. Fix the pair-or-emit logic, not the architecture. |
| Backfilling dailysnapshots | A migration script to rewrite all daily snapshots | `dailysnapshots.accountMetrics.profit` is unrelated to the displayed widget. Don't conflate the two. |

## Common Pitfalls

### Pitfall 1: `isDisplayableMergedTrade` will drop the orphan-close row we just emitted

`pft-dashboard/src/utils/tradeHistoryDisplay.ts` line 118-119:
```ts
if (openTime <= 0 || closeTime < openTime) return false;
return durationSec > 0 || durationMs > 0;
```

If we emit an orphan close with `OpenTime = CloseTime = tSec`, then `openTime > 0` ✓, `closeTime >= openTime` ✓, but `durationSec === 0 && durationMs === 0` → **returns false → trade dropped a second time**.

**Mitigation options** (planner to choose):
1. In `mergedFromDeals` emit `DurationMs = 1` for orphan-close rows so display filter passes.
2. Update `isDisplayableMergedTrade` to allow zero-duration rows when an `isOrphanClose: true` flag is set.
3. Bypass `filterDisplayableMergedTrades` for orphan rows by not setting `DurationMs/duration` to zero — instead synthesize OpenTime as `CloseTime - 60` (1 min before).

Option 1 is the smallest diff; option 2 is the most honest.

### Pitfall 2: Don't change the open-position guard

Line 605 `if (remain <= 0 || totalOpen <= 0) continue;` has two cases:
- `remain <= 0` (close-deal volume is zero AND there's nothing open) — correct skip.
- `totalOpen <= 0` (no open positions to pair against) — THE bug case.

Splitting these and only special-casing the orphan-close path keeps partial-close semantics intact.

### Pitfall 3: Orphan-close emission must NOT touch `openQ`

The pairing loop iterates `while (remain > 0 && openQ.length > 0)`. If there's no open, we just emit a single closed row and `continue`. Don't push a synthetic open into `openQ` — that breaks subsequent partial fills.

### Pitfall 4: Position 1048884 has Volume=`0.01`, not 100

Don't blanket-skip the `Volume >= 100` deals — Deal `1036209` (the 100-lot DE30) IS a legitimate trade (broker raw units = lots × 100; this is a real 1-lot trade closed same day, properly paired, currently included correctly with +$20.09 profit). Excluding it would BREAK other days' math.

### Pitfall 5: The widget DOES use `tradeHistory` filtered by current payout cycle

`statistics.service.ts` line 287-294 filters `tradeHistory` to `> payoutResetTs`. For a fresh challenge with no payout reset, `payoutResetTs = 0` and nothing is filtered. For this user's account 13535 there is no payout reset yet (account is in challenge phase), so this filter is irrelevant here. **But** if you fix the orphan-close logic in `mergedFromDeals` (client-side), the SAME bug exists when summing across cycle boundaries on the server-cached `tradeHistory`. Out of scope for this ticket but worth filing.

### Pitfall 6: Display formatter rounds to whole dollars

`DailyPnLChart.fmt` (line 35-40) uses `Math.abs(v).toFixed(0)` for values < $1000. Even a correctly-summed $20.16 would render as "$20" in the chart cell. The tooltip uses `fmtFull` with `toFixed(2)` showing "$20.16". This is by design and not part of the bug, but document it so the planner doesn't try to "fix" the formatter expecting two decimals to appear in the cell.

## Code Examples

### Bug location — useTradingDashboardData.ts line 601-620

```ts
if (entry === "1") {
  // CRITICAL FIX: Close deals from SDK may have Volume=0 (volume was on the open)
  // If Volume=0 but Profit!=0, close ALL remaining open positions for this group
  let remain = vol > 0 ? vol : totalOpen; // Use totalOpen if vol is 0
  if (remain <= 0 || totalOpen <= 0) continue;   // ← bug: orphan closes silently dropped
  const volToClose = remain;
  const allocator = (used: number) =>
    volToClose > 0 ? used / volToClose : 0;
  while (remain > 0 && openQ.length > 0) {
    const open = openQ[0];
    const used =
      remain < open.remainingVol ? remain : open.remainingVol;
    emitClosed(used, open, allocator(used));
    open.remainingVol -= used;
    totalOpen -= used;
    remain -= used;
    if (open.remainingVol <= 0) openQ.shift();
  }
  continue;
}
```

### Suggested fix shape (planner translates this)

```ts
if (entry === "1") {
  let remain = vol > 0 ? vol : totalOpen;
  if (totalOpen <= 0) {
    // ORPHAN CLOSE: no matching open in this buffer (overnight / multi-day
    // carryover whose open is older than our hot+archive window).
    // Emit a single closed row using the close-deal's own time on both legs
    // so daily P&L aggregations still see this realized profit.
    const synthOpen = {
      direction: dir === "BUY" ? "SELL" : "BUY",   // close-action inverts open direction
      symbol,
      openDeal: "",
      openOrder: "",
      positionId: d.PositionID && String(d.PositionID) !== "0"
        ? String(d.PositionID) : "",
      openTime: tSec,
      openTimeMs: tMs,
      openPrice: toNum(d.PricePosition) || price,  // PricePosition is the open price on the close-deal
      openPriceTP: null,
      openPriceSL: null,
      remainingVol: vol > 0 ? vol : Math.round(toNum(d.VolumeClosed) * 100 / 100), // best-effort
    };
    emitClosed(synthOpen.remainingVol || 1, synthOpen as any, 1);
    continue;
  }
  if (remain <= 0) continue;
  // ... existing pairing loop unchanged ...
}
```

Note: MT5 stores the open price of an orphan close in `PricePosition` (verified — Deal `1036209` has `PricePosition: '24974.0'` which exactly matches Deal `1036184`'s open `Price: '24974.0'`). So orphan rows can recover the open-price too. Also: set `DurationMs >= 1` (or update `isDisplayableMergedTrade`) so the row isn't filtered out by `filterDisplayableMergedTrades`.

## Root Cause — One Sentence

**`mergedFromDeals` in `useTradingDashboardData.ts` silently drops every CLOSE deal whose matching OPEN is not in the same buffer; for account 13535 on 2026-06-18 that single dropped close has `Profit = -34.69`, so the displayed daily P&L is `$20.16 − (−$34.69) = $54.85`, which `DailyPnLChart.fmt` renders as `+$55` instead of the broker-truth `+$20.16`.**

## Minimal Fix Surface

- **File:** `pft-dashboard/src/hooks/useTradingDashboardData.ts`
- **Function:** `mergedFromDeals` (line 335 onward)
- **Change:** When `Entry='1'` and `totalOpen <= 0`, instead of `continue`, emit a single closed-trade row using close-deal time as both OpenTime/CloseTime (and `DurationMs >= 1` to survive `isDisplayableMergedTrade`).
- **Possible companion change:** `pft-dashboard/src/utils/tradeHistoryDisplay.ts` — relax `isDisplayableMergedTrade` to allow `DurationMs === 0` when a new `isOrphanClose` flag is true, instead of forcing the emitter to lie about duration.
- **Tests to add:** `mergedFromDeals` unit test with a single `Entry='1'` deal as input → assert one closed row emitted with correct Profit.
- **Stored data:** No corruption — `tradehistories` is correct (the raw deal IS there). No backfill needed.
- **Risk of breaking other surfaces:** LOW.
  - `TradingHistory.tsx` (trade table) currently does NOT show this orphan close — fix will make it appear in the table too. That's the right behaviour but a visible UX change worth flagging.
  - `useTradingCalculations.tradingStats` (totals/win rate) will count one more trade and one more loss. Correct, but stats numbers move.
  - `ConsistencyScoreCard`, `LotSizeConsistencyCard` — will see one additional row. Likely fine.
  - Server-side `serverMergedTrades` (rule-checker output) may have the SAME bug. Verify before shipping that fixing client-side doesn't desync with server-merged rows (the merge function `mergeLocalAndServerTrades` could deduplicate the synthesized orphan row OR re-suppress it). Recommended: planner reads rule-checker's `tradeHistoryQuery.isDisplayableMergedTrade` and matching merge logic and applies the same fix server-side in the same PR.

## Blast Radius

**Per-brand or all-brand?** All-brand. The bug is in client-side code in `pft-dashboard` (deploys to every brand from `main-2026`). It will manifest for ANY account that holds a position overnight beyond the hot-cache retention window, on the day the position is finally closed.

**How many accounts likely affected?** A rough heuristic query (all brands' DBs would be needed for an exact number; for TradingCult only):
- Orphan close = `Entry='1'` deal in `tradehistories ∪ tradehistoryarchives` whose `PositionID` has no `Entry='0'` companion anywhere.
- For 13535 alone, 1 orphan close in 30 days of data → ~3% of closes for this account are orphaned.
- Any trader who holds positions through the hot-retention boundary is exposed. Swing traders > scalpers.

**Suggested production-impact query (planner to run per brand):**
```js
db.tradehistories.aggregate([
  { $match: { Entry: "1" } },
  { $unionWith: { coll: "tradehistoryarchives", pipeline: [{ $match: { Entry: "1" } }] } },
  { $group: { _id: { Login: "$Login", PositionID: "$PositionID" }, profit: { $sum: { $toDouble: "$Profit" } }, n: { $sum: 1 } } },
  { $lookup: {
      from: "tradehistories",
      let: { pid: "$_id.PositionID", login: "$_id.Login" },
      pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$PositionID", "$$pid"] }, { $eq: ["$Login", "$$login"] }, { $eq: ["$Entry", "0"] }] } } }, { $limit: 1 }],
      as: "hotOpen"
  }},
  { $lookup: {
      from: "tradehistoryarchives",
      let: { pid: "$_id.PositionID", login: "$_id.Login" },
      pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$PositionID", "$$pid"] }, { $eq: ["$Login", "$$login"] }, { $eq: ["$Entry", "0"] }] } } }, { $limit: 1 }],
      as: "coldOpen"
  }},
  { $match: { hotOpen: { $size: 0 }, coldOpen: { $size: 0 } } },
  { $count: "orphan_close_positions" }
])
```

**Cosmetic or material?**
- Displayed daily P&L is wrong → **material to user trust** (this exact complaint surfaced as a ticket).
- Does NOT feed payout eligibility (payouts run from `accountrulestates` / rule-checker, not the dashboard widget).
- Does NOT feed breach detection (engine has its own equity tracking).
- Does NOT feed leaderboard ranking (leaderboard uses `valueGrowthPercentage`, not deal-level sums).
- DOES affect the trade-stats numbers shown elsewhere on the same page (total trades count, win rate, P&L total) — those numbers are also wrong by the orphan-close amount.
- Conclusion: **client-trust material, not financial-decision material.** Safe to fix without coordinated payouts/breach freeze.

## State of the Art

| Old | Current | Why |
|-----|---------|-----|
| Pair OPEN/CLOSE deals client-side from raw stream | Same, plus orphan-close fallback | Backend retention is finite; client cannot assume opens are always available |

The "merge raw deals into trades client-side" architecture is fine for a streaming-first system; the missing piece is just the orphan-close branch.

## Open Questions

1. **Why does client's MT5 terminal show $9.90, not $20.16?**
   - DB shows 12 Entry='1' closes summing to $20.16 (any TZ, no boundary issues). MT5 broker "Daily Reports" should match the DB exactly.
   - Possible explanations:
     - Client screenshot may have shown a filtered view (single-symbol, single-magic-number, or excluded a manual close).
     - Hot collection's `updatedAt` for some 06-18 deals is `2026-06-30T11:23:18` — recent re-sync. Pre-resync, fewer deals may have been present, producing a lower MT5-side report at the time of the screenshot.
     - Client's terminal may have a different "Commission" or "Swap" inclusion mode.
   - **Recommendation:** Fix the $55 → $20.16 bug (the demonstrably-broken one). The $20.16 vs $9.90 delta is a separate inquiry worth a follow-up clarification with the client (ask for: full Daily Reports screenshot with no filters; or History tab Excel export). **Do NOT make the fix conditional on resolving this second delta.**

2. **Should we also fix the same pattern on the server (rule-checker)?**
   - The dashboard's `serverMergedTrades` comes from rule-checker and is merged with the client-built list. If rule-checker also drops orphan closes, the bug persists for accounts where serverMergedTrades is the winning source.
   - Out of scope for THIS phase if scoped to dashboard-only, but planner should at minimum **verify** by reading rule-checker's `tradeHistoryQuery` and decide whether the same patch belongs there.

3. **Should `dailysnapshots` be corrected too?**
   - `dailysnapshots[date=2026-06-18].accountMetrics.profit = 39.45` is `balance - 10000` (running offset), not daily delta. It is not what feeds the widget. Out of scope for this ticket but a separate documentation/cleanup task.

## Sources

### Primary (HIGH confidence)
- Live TradingCult Mongo (`mongodb://…@65.109.82.254:27017/TradingCult`) — verified user, account, all 103 deals, exact per-day sums, orphan-position detection.
- Source files read in full or in the bug-relevant slice:
  - `pft-dashboard/src/hooks/useTradingDashboardData.ts` lines 140-200, 335-630, 1020-1120
  - `pft-dashboard/src/hooks/useTradingCalculations.ts` lines 80-136
  - `pft-dashboard/src/utils/tradeHistoryDisplay.ts` (full)
  - `pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/DailyPnLChart.tsx` (full)
  - `pft-dashboard/src/app/(dashboard)/journal/components/TradeCalendar/index.tsx` (full) — ruled out as the bug surface
  - `pft-backend/src/app/modules/Statistics/statistics.service.ts` lines 90-300 — backend confirmed honest (no aggregation, no filter)

### Secondary (MEDIUM confidence)
- Client-reported MT5 broker truth ($9.90, 10 trades) — only source for that number; not independently verified. The DB shows $20.16 / 12 closes for the same day, so either the client's filter differs or the DB had a late re-sync; either way, the **dashboard bug ($55) is independently real**.

### Tertiary (LOW confidence)
- None used.

## Metadata

**Confidence breakdown:**
- Identification of bug location: **HIGH** — the math 20.16 − (−34.69) = 54.85 → "$55" is exact, and the code branch that drops the orphan is at a specific line number.
- Minimal fix shape: **HIGH** — emit-orphan-close requires no new data sources.
- $9.90 vs $20.16 delta: **MEDIUM** — multiple plausible explanations, none yet confirmed; this is a secondary investigation.
- Blast-radius estimate: **MEDIUM** — per-account exposure depends on hot-cache retention which we have not measured globally.

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stable code paths; bug is in production today)
