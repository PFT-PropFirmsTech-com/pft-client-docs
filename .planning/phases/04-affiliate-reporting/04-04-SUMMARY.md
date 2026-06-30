---
phase: 04-affiliate-reporting
plan: 04
subsystem: affiliate-dashboard-ui
tags: [affiliate, commissions, react-query, csv-export, ui, mlm]

# Dependency graph
requires:
  - phase: 04-affiliate-reporting/04-01
    provides: GET /affiliates/my-commissions endpoint (Auth userRole.user, scoped to req.user._id)
provides:
  - Purchase Report card on the Affiliate Overview page (per-purchase commission breakdown)
  - useGetMyCommissions React Query hook + MyCommissionEntry type
  - Per-tier Export CSV for the logged-in affiliate
affects: [future affiliate analytics widgets that need per-purchase data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope table component to avoid re-declaring on every parent render"
    - "Single non-conditional useQuery keyed on derived tier (from controlled Tabs value) instead of branched hook calls"
    - "Inline Intl currency formatter when row currency varies (commission row currency may differ from component currencySettings)"

key-files:
  created: []
  modified:
    - pft-dashboard/src/lib/api/config.ts
    - pft-dashboard/src/hooks/useAffiliates.ts
    - pft-dashboard/src/app/(dashboard)/_components/modules/users/affiliates/AffiliatesContainer.tsx
    - pft-dashboard/messages/en.json

key-decisions:
  - "Single hook + derived tier (from purchaseReportTab) — keeps hook order stable across MLM/Standard variants; no conditional useQuery"
  - "PurchaseReportTable declared at module scope (above AffiliateContainer) to dodge the React 'component-inside-component' re-mount footgun"
  - "Export CSV uses limit=0 to fetch all rows for the active tier (backend convention for unbounded export), separate from the paged in-card view"
  - "Translation keys added to messages/en.json ONLY — ja.json falls back to the key string (matches 02-02 / 03-03 / 03-04 convention; JA localisation is out of phase scope)"
  - "Mixed-currency rendering: row currency may differ from the component-scope currencySettings, so the table uses an inline Intl formatter keyed off r.currency / r.payment.currency rather than reusing the closure-bound formatCurrency"

patterns-established:
  - "Module-scope sub-components in large container files (avoid render-time re-creation of components)"
  - "Tier-tab mirror: per-tier views in commission/affiliate widgets reuse the Referrals tabs pattern (defaultValue='tier-1', tigerTab + tabHoverTeal + tabActiveTeal theme classes)"

# Metrics
duration: ~8min
completed: 2026-06-30
---

# Phase 04 Plan 04: Purchase Report UI Summary

**Affiliate Overview now ships a Purchase Report card below 'Your Referrals' — per-purchase commission breakdown (Client Name / Email / Trading Account # / Product / Date / Purchase Amount / Commission % / Commission Amount), MLM tier tabs for Hybrid/MLM affiliates, flat table for Standard affiliates, Export CSV per active tier.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-30T10:27:00Z
- **Completed:** 2026-06-30T10:34:18Z
- **Tasks:** 2/2 code tasks executed; Task 3 (human-verify) deferred (per objective)
- **Files modified:** 4

## Accomplishments
- Added `ENDPOINTS.affiliate.myCommissions = "/affiliates/my-commissions"` pointing at the route shipped by phase 04-01.
- Added `MyCommissionEntry` type + `useGetMyCommissions` React Query hook in `src/hooks/useAffiliates.ts`. Hook accepts `{ page, limit, tier, sortBy, sortOrder }`, returns `{ data, meta }`, staleTime 30s.
- Rendered a new "Purchase Report" card in `AffiliatesContainer.tsx` inside the `showOverview` branch, between the existing "Your Referrals" card (line ~1494) and "Payout History" card (line ~1703). NOT rendered on the Withdrawals view.
- For Hybrid / MLM affiliates (`hasMlmCommissionTiers`) renders `Tier 1 / 2 / 3 ...` Tabs using the same `tigerTab + tabHoverTeal + tabActiveTeal` classes as the Referrals tabs — the controlled `purchaseReportTab` state drives the `activePurchaseTier` query param so each tab shows that tier's commission rows.
- For Standard affiliates renders a flat `PurchaseReportTable` (no tabs).
- Empty state (Receipt lucide icon) when the affiliate has zero commission records — uses the same `EmptyState` component as the Referrals empty state.
- "Export CSV" button next to the card header — calls `apiClient.get(ENDPOINTS.affiliate.myCommissions?page=1&limit=0[&tier=N])` to pull ALL rows for the active tier and emits `purchase-report[-tier-N]-YYYY-MM-DD.csv` via `file-saver`. UTF-8 BOM prepended so Excel renders correctly.
- 9-column CSV: Client Name, Client Email, Trading Account #, Product, Date (ISO), Purchase Amount, Commission %, Commission Amount, Commission Currency. (1 extra column vs the 8-column on-screen table — currency is collapsed inline into the amount columns on screen but exported as a dedicated field.)
- Translation keys added to `messages/en.json`:
  - 11 new keys under `dashboard.affiliates.*` (`purchaseReport`, `purchaseReportDescription`, `noPurchaseReportData`, `purchaseReportEmptyDescription`, `purchaseReportExportFailed`, `clientName`, `clientEmail`, `tradingAccount`, `product`, `purchaseAmount`, `commissionPct`, `commissionAmount`, `date`)
  - 1 new key under root `common.*` (`exportCsv`)

## Task Commits

Each task was committed atomically inside pft-dashboard on `main-2026`:

1. **Task 1: useGetMyCommissions hook + endpoint config** — `fc6e4361` (feat)
2. **Task 2: Purchase Report card + CSV export + translation keys** — `35337a41` (feat)

Both commits pushed to `origin/main-2026`:
```
6566f16d..35337a41  main-2026 -> main-2026
```

## Files Created/Modified
- `pft-dashboard/src/lib/api/config.ts` — added `myCommissions` entry inside `ENDPOINTS.affiliate`, after `mlmTree`
- `pft-dashboard/src/hooks/useAffiliates.ts` — added `MyCommissionEntry` interface (before `CreateManualCommissionRequest`); added `useGetMyCommissions` hook at end of file
- `pft-dashboard/src/app/(dashboard)/_components/modules/users/affiliates/AffiliatesContainer.tsx`:
  - Added imports: `useGetMyCommissions`, `MyCommissionEntry`, `apiClient` (`@/lib/api/client`), `ENDPOINTS` (`@/lib/api/config`), `saveAs` (`file-saver`)
  - Added module-scope `formatPurchaseRowCurrency`, `formatPurchaseRowProduct`, `PurchaseReportTable` (above `AffiliateContainer`)
  - Added state inside `AffiliateContainer`: `purchaseReportTab`, `purchaseReportPage`
  - Added hook call + `exportPurchaseReportCsv` async helper after `referralsByTier` derivation
  - Inserted Purchase Report JSX card between Referrals Table and Payout History inside the `showOverview && (...)` branch
- `pft-dashboard/messages/en.json` — added `common.exportCsv` and 13 `dashboard.affiliates.*` keys (purchase report titles, columns, empty state, export-failed toast)

## Decisions Made
- **Single hook, derived tier:** chose to drive the hook off a derived `activePurchaseTier = Number(purchaseReportTab.replace("tier-", ""))` instead of one hook per tier. Keeps hook order stable, avoids re-render storms.
- **Module-scope `PurchaseReportTable`:** declaring the table inside `AffiliateContainer` would create a new component identity every render — React would unmount/remount the whole subtree on each state change. Module scope fixes this and also makes the component a clean unit testable later.
- **Mixed-currency rendering:** `formatPurchaseRowCurrency` is inline and accepts `(amount, currency)`. The container-scope `formatCurrency` is locked to a single `currencyCode` derived from `activeSettings`. Commission rows can carry a different currency (e.g. JPY payment → USD commission), so we format each row by its own currency code with a `try/catch` fallback to `<number> <CODE>` for invalid codes.
- **CSV limit=0 = unbounded:** backend convention from `useExportPaymentsCsv` (Plan 04-03) — `limit=0` returns the full set. Per spec.
- **Translation parity:** only `en.json` updated. `ja.json` will fall back to the key string for these keys. Same convention as phases 02-02 / 03-03 / 03-04 (JA localisation tracked separately under `feat/email-qa-and-ja-localization`).
- **Used `tc("exportCsv")` for the button label** — `tc` namespace is root `common` (line 2 of en.json), and `common.exportCsv` was missing. Added the key to root `common`, not to `dashboard.common`, because `tc` is already wired to root.

## Deviations from Plan

**Deviation 1 — `theme.classes.buttonSecondary` does not exist (Rule 3 — blocking).**
- **Found during:** Task 2 tsc verification.
- **Issue:** Plan specified `className={theme.classes.buttonSecondary}` for the Export CSV button. The theme object has `buttonPrimary`, `buttonOutlinePrimary`, `buttonOutlineSecondary`, `buttonOutlineTeal`, but no plain `buttonSecondary` — tsc TS2551.
- **Fix:** Used `theme.classes.buttonOutlinePrimary` (matches the "outline" Button variant the plan specified, and matches usage elsewhere in the same file).
- **Files modified:** `AffiliatesContainer.tsx` (line ~1661).
- **Commit:** `35337a41` (fixed before commit, not a separate commit).

**Deviation 2 — `useTranslations` return type incompatible with the prop signature in `PurchaseReportTableProps` (Rule 1 — bug / type error).**
- **Found during:** Task 2 tsc verification.
- **Issue:** Initial typing `t: (key: string, opts?: Record<string, unknown>) => string` rejected next-intl's `Translator<Record<string, any>, "dashboard">` return — Translator is invariant on its generics.
- **Fix:** Relaxed `t: any` (with eslint-disable comment + JSDoc explaining why). The alternative — re-deriving `Translator<Record<string, any>, "dashboard">` — would tightly couple this presentational table to the dashboard namespace and break reuse.
- **Files modified:** `AffiliatesContainer.tsx` (PurchaseReportTableProps).
- **Commit:** `35337a41` (fixed before commit).

**Deviation 3 — Added `common.exportCsv` key to root `common` instead of "if it doesn't exist, add it" (Rule 3 — blocking).**
- **Found during:** Task 2 translation step.
- **Issue:** The plan said "Reuse `common.exportCsv` if it exists. If not, add it with value 'Export CSV'." Root `common` did NOT have `exportCsv`, but a sibling `dashboard.common.exportCsv` did (line 1907 of en.json). I'm using `tc` which is `useTranslations("common")` → root common.
- **Fix:** Added `exportCsv` key to root `common` block. Existing `dashboard.common.exportCsv` is unchanged (used by other features).
- **Files modified:** `messages/en.json`.
- **Commit:** `35337a41`.

**Deviation 4 — `purchaseReportPage` is currently set-less (no `setPurchaseReportPage` consumer) (Rule 3 — intentional minimalism).**
- **Found during:** Task 2 wiring.
- **Issue:** The plan declared a pagination state `purchaseReportPage` (Record<string,number>), but the in-card UI does not currently render page controls (the existing Referrals card doesn't either — Phase 4 scope is "card + tabs + export", not paginated UI). Declaring the setter unused triggers a tsc/eslint warning.
- **Fix:** Kept the read state `purchaseReportPage` (so the hook can resume page-1 reads and future pagination wiring lands cleanly), dropped the setter from destructuring. The hook's `page` param still reads from `purchaseReportPage[purchaseReportTab] || 1`.
- **Files modified:** `AffiliatesContainer.tsx` (state declaration).
- **Commit:** `35337a41`.

## Issues Encountered
- Project-wide tsc reports 259 lines of errors but none in the files I touched. All errors trace to pre-existing issues in `.next/types`, `scripts/migration/*`, and unrelated admin pages (`CheckoutEditorContainer`, `checkout-editor`, etc.). No new errors introduced by this plan.
- ja.json is structurally parallel to en.json but is NOT updated. Per spec ("add to en/default at minimum and leave others to fall back"), this is intentional — at runtime JA users will see the raw key (`affiliates.purchaseReport`) rather than English fallback. JA team owns localisation under the separate `feat/email-qa-and-ja-localization` branch.

## User Setup Required

None for code execution. Backend `GET /affiliates/my-commissions` already shipped to pft-backend main-2026 in Plan 04-01 (commits `e136636c` + `63f7d44a`).

## Verification (post-deploy, deferred — DEFERRED PER OBJECTIVE)

Per the orchestrator's explicit instruction ("DO NOT actually start the dev server / wait for user"), the human-verify checklist below is queued for post-deploy. Matches the convention used in 02-02 / 03-03 / 03-04 SUMMARYs.

Run after the next main-2026 dashboard deploy on a brand where commission rows exist (TradingCult has 22 commission rows across tiers 1/2/3 — confirmed live):

1. Log in to the dashboard as an affiliate user with existing commissions (TradingCult test affiliate).
2. Navigate to `/affiliates` (Affiliate Overview).
3. Scroll past "Your Referrals" — confirm the "Purchase Report" card renders BELOW it and ABOVE "Payout History".
4. **MLM/Hybrid affiliate:** confirm `Tier 1 / Tier 2 / Tier 3` tabs render. Switching tabs should refetch (Network: a new `GET /affiliates/my-commissions?page=1&limit=20&tier={N}` call) and show only that tier's commissions.
5. **Standard affiliate:** confirm a flat table (no tabs) renders.
6. Confirm 8 columns populate with sensible data:
   - Client Name (buyer.name or "—")
   - Client Email (buyer.email or "—")
   - Trading Account # (payment.mt5Login or "—")
   - Product (e.g. "twoStep $5,000" or "—")
   - Date (locale date string)
   - Purchase Amount (currency-formatted; uses paidAmount fallback totalPrice)
   - Commission % (e.g. "20%" or "—")
   - Commission Amount (currency-formatted in row's own currency, NOT the brand currency)
7. Click "Export CSV". Confirm:
   - File downloads as `purchase-report-tier-N-YYYY-MM-DD.csv` (or `purchase-report-YYYY-MM-DD.csv` for Standard).
   - File opens cleanly in Excel (UTF-8 BOM preserved).
   - 9 columns total: 8 visible + Commission Currency as the 9th.
   - Date column is ISO 8601 (`2026-06-30T14:23:01.000Z`).
   - Row count matches the active tier's total (limit=0 = unbounded).
8. Confirm the Purchase Report card does NOT render on the Withdrawals page (`/affiliates/withdrawals` or wherever `view="withdrawals"` is set).
9. Confirm empty-state renders for an affiliate with zero commissions ("No commission records yet" + helper text).
10. Confirm the export-failed toast triggers if the backend route 401s/500s (can be tested by temporarily killing the backend session before clicking Export CSV).

## Static / Structural Verification (executed)

- `grep "myCommissions" config.ts` → present
- `grep "useGetMyCommissions|MyCommissionEntry" useAffiliates.ts` → both present
- `grep "purchaseReport|PurchaseReport|useGetMyCommissions" AffiliatesContainer.tsx` → 34 hits across imports, types, state, hook call, export fn, JSX
- Project tsc (`tsc --noEmit --skipLibCheck -p tsconfig.json`) → no errors in any of the 4 modified files (all 259 reported errors are pre-existing, unrelated paths)
- Verified Purchase Report JSX lives at lines 1648-1701 of AffiliatesContainer.tsx, fully INSIDE the `showOverview && (...)` block which spans 929-1715
- Verified Purchase Report sits BETWEEN Referrals Table (line 1494) and Payout History (line 1703)
- Module-scope `PurchaseReportTable` declared at line 190 — outside the AffiliateContainer function which begins at line 256

## Next Phase Readiness

- Phase 04 is now feature-complete pending the live human-verify pass.
- **Open across milestone (post-deploy):** Phase 4 plan 04 human-verify checklist above + carry-over Phase 2 & 3 human-verify checklists (anon masking, opt-out timing, competition close, cache isolation). All gated on the next main-2026 deploy.

## Self-Check

Verifying claims against filesystem and git.

- FOUND: `pft-dashboard/src/lib/api/config.ts` — `myCommissions: "/affiliates/my-commissions",` present in `ENDPOINTS.affiliate`
- FOUND: `pft-dashboard/src/hooks/useAffiliates.ts` — `MyCommissionEntry` interface + `useGetMyCommissions` hook export both present
- FOUND: `pft-dashboard/src/app/(dashboard)/_components/modules/users/affiliates/AffiliatesContainer.tsx` — `PurchaseReportTable` at module scope + JSX inside showOverview block
- FOUND: `pft-dashboard/messages/en.json` — `common.exportCsv` + `affiliates.purchaseReport` + 12 sibling affiliate keys
- FOUND commit: `fc6e4361` (Task 1 — hook + endpoint)
- FOUND commit: `35337a41` (Task 2 — UI card + CSV + translations)
- FOUND push: `6566f16d..35337a41 main-2026 -> main-2026` (pushed to `origin/main-2026`)
- DEFERRED (per objective): live human-verify pass (dev server not started, awaiting deploy)

## Self-Check: PASSED

---
*Phase: 04-affiliate-reporting*
*Completed: 2026-06-30*
