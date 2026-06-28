# Architecture Patterns

**Domain:** Public Leaderboard + Competition System — integration with existing PFT platform
**Researched:** 2026-06-28

---

## Existing Architecture (What Already Exists)

### Leaderboard Module (pft-backend)

| File | Role |
|------|------|
| `leaderboard.model.ts` | Precomputed `Leaderboard` collection — one doc per `{userId, programId}` pair |
| `leaderboard.service.ts` | `LeaderboardService` — read from precomputed collection + cron recompute |
| `leaderboard-cron.service.ts` | `setInterval` every 15 min, calls `generateAndStoreLeaderboardData()` |
| `leaderboard.routes.ts` | All routes gated by `Auth(admin, backOffice)` — no public access today |
| `leaderboard.controller.ts` | Thin controllers wiring service → HTTP |

### Current Auth Gate

All existing leaderboard API routes (`GET /leaderboard`, `/leaderboard/weekly`, `/leaderboard/stats`) require `admin` or `back-office` role via `Auth(userRole.admin, userRole.backOffice)` middleware. There is no `user`-role or unauthenticated path today.

### Dashboard (pft-dashboard)

Admin leaderboard lives at `/(dashboard)/admin/leaderboard/`. The `(dashboard)` group enforces auth via `middleware.ts`: any path not in `isPublicPath` or `isAuthPath` redirects to `/auth/login` if cookies are missing.

Public paths today are: `/auth/*`, `/checkout/*`, `/payment-*`, `/changelog`, `/kyc/verify`, `/free-trial`, `/c/:slug`, `/pap/:slug`. The `/leaderboard` path does not appear in this list — it would fall under protected-by-default.

---

## Recommended Architecture

### Component Boundaries

| Component | New vs Modified | Responsibility | Communicates With |
|-----------|----------------|---------------|-------------------|
| `Competition` model | **NEW** | Stores competition definitions (dates, metric, prizes, status) | `CompetitionEntry`, admin APIs |
| `CompetitionEntry` model | **NEW** | Snapshot of a trader's performance at competition end (or live snapshot for active) | `Competition`, `Leaderboard` |
| `leaderboard.routes.ts` | **MODIFIED** | Add public read endpoint with data masking; add opt-out endpoint for authenticated users | `LeaderboardService` |
| `competition.routes.ts` | **NEW** | Admin CRUD for competitions; public GET active competitions; admin trigger winner determination | `CompetitionService` |
| `competition.service.ts` | **NEW** | State machine transitions, winner determination, snapshot logic | `Leaderboard`, `CompetitionEntry`, `User` |
| `competition.cron.ts` | **NEW** | Scheduled auto-transition: `draft→active` at startDate, `active→ended` at endDate | `CompetitionService` |
| User model (`auth.model.ts`) | **MODIFIED** | Add `leaderboardOptOut: Boolean` field | Leaderboard read path |
| Public dashboard route | **NEW** | `/leaderboard` (outside `(dashboard)`) or new route group `(public)` | Public leaderboard API |
| Admin competition UI | **NEW** | CRUD form, status badge, winner display under `/admin/competitions/` | Competition API |
| Public leaderboard UI | **NEW** | Masked/unmasked display based on auth state | Public + authenticated leaderboard API |

---

## Data Models

### Competition Model

```typescript
interface ICompetition {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  metric: "valueGrowthPercentage" | "totalProfit" | "winRate" | "profitFactor";
  status: "draft" | "active" | "ended" | "archived";
  prizePool: Array<{
    rank: number;          // 1, 2, 3, etc.
    label: string;         // "1st Place"
    amount: number;
    currency: string;      // "USD"
    description?: string;  // "Cash prize" / "Account credit"
  }>;
  winners?: Array<{
    rank: number;
    userId: ObjectId;
    mt5AccountId: string;
    metricValue: number;
    prizeAmount: number;
    determinedAt: Date;
  }>;
  eligibilityCriteria?: {
    minTrades?: number;
    minTradingDays?: number;
    accountTypes?: string[];   // funded, challenge, etc.
  };
  createdBy: ObjectId;         // admin userId
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ status: 1 }`, `{ startDate: 1, endDate: 1 }`, `{ status: 1, endDate: 1 }`.

### CompetitionEntry Model

```typescript
interface ICompetitionEntry {
  competitionId: ObjectId;
  userId: ObjectId;
  mt5AccountId: string;
  programId: ObjectId;
  snapshotMetric: number;      // value of the competition metric at snapshot time
  snapshotPerformance: {       // full performance snapshot (copy from Leaderboard doc)
    valueGrowthPercentage: number;
    totalProfit: number;
    winRate: number;
    profitFactor: number;
    tradingDays: number;
  };
  rank?: number;               // assigned after winner determination
  snapshotAt: Date;
  isWinner: boolean;
  createdAt: Date;
}
```

Indexes: `{ competitionId: 1, userId: 1 }`, `{ competitionId: 1, snapshotMetric: -1 }`, `{ competitionId: 1, rank: 1 }`.

**Do not embed entries inside the Competition document** — competitions with 10k+ eligible participants would blow the 16MB BSON document limit.

### User Model Change

Add one field to the existing User schema:

```typescript
leaderboardOptOut: { type: Boolean, default: false }
```

This is the simplest approach. A separate collection adds unnecessary joins for a single boolean. Filter `leaderboardOptOut: { $ne: true }` in the public leaderboard query path only (admin view still sees everyone).

---

## API Routes

### New Public Endpoint (pft-backend)

```
GET /leaderboard/public
```

- **Auth:** None required. Uses existing `cacheResponse(45)` middleware.
- **Data masking logic:** The service layer checks if the request has a valid JWT (`req.user`). If yes (authenticated user or admin), return full name + email. If no auth token, mask: `firstName = "A***"`, `lastName = "***"`, email omitted.
- **Filters:** Same as existing `getLeaderboard` minus admin-only fields.
- **Opt-out:** Exclude users where `leaderboardOptOut: true` from results.

Why a separate `/public` route rather than modifying the existing `/` route: the existing route is consumed by the admin panel and returns full PII. Keeping them separate avoids inadvertent data masking regressions in the admin view.

### Competition Endpoints (pft-backend)

```
POST   /competitions                          Auth(admin)
GET    /competitions                          Public (list active/ended only; draft hidden)
GET    /competitions/:id                      Public (if active/ended/archived)
PATCH  /competitions/:id                      Auth(admin) — update meta or status
DELETE /competitions/:id                      Auth(admin) — soft delete / archive
POST   /competitions/:id/determine-winners    Auth(admin) — on-demand trigger
GET    /competitions/:id/entries              Auth(admin) — paginated entries
```

### User Opt-Out Endpoint (pft-backend)

```
PATCH /users/me/leaderboard-opt-out    Auth(user)   body: { optOut: boolean }
```

Piggybacks on the existing User module — no new module needed.

---

## Competition State Machine

```
draft ──────────────────────────────────────────► archived
  │                                                  ▲
  │  (startDate reached, via cron or manual)         │
  ▼                                                  │
active ──(endDate reached, via cron or manual)──► ended ─(admin archives)─►
```

Transitions:

| From | To | Trigger | Side Effect |
|------|----|---------|-------------|
| `draft` | `active` | `startDate <= now` (cron) or admin manual | None |
| `active` | `ended` | `endDate <= now` (cron) or admin manual | Trigger winner determination |
| `ended` | `archived` | Admin manual only | None |
| `draft` | `archived` | Admin manual (cancel) | None |

**No `active → draft` rollback.** Once active, the competition is visible to the public and participants have expectations. Only forward transitions are allowed.

---

## Winner Determination

**Approach: on-demand with cron fallback.** When status transitions `active → ended`, the `CompetitionService.determineWinners(competitionId)` method runs. This same method is also callable by admin via `POST /competitions/:id/determine-winners` at any time after `ended`.

Why not a pure cron: a standalone "determine winners" cron would run on a schedule that may not align with competition end times. The transition hook is more deterministic. The admin on-demand trigger exists as a safety valve if the cron missed or the admin wants to re-run after data corrections.

**Determination algorithm:**

```
1. Query Leaderboard collection for all active entries where:
   - userId NOT in leaderboardOptOut=true
   - Meets competition.eligibilityCriteria (minTrades, minTradingDays)
   - programId NOT a free trial
2. Sort by competition.metric descending
3. Deduplicate by userId (take best-performing account per user)
4. Take top N (N = prizePool.length)
5. Bulk-insert CompetitionEntry documents with rank + isWinner=true
6. Insert remaining entries with isWinner=false (for audit/display)
7. Set competition.winners[] array and competition.status = "ended" (if not already)
8. (Optional future: trigger notification to winners)
```

**Idempotency:** Before inserting, delete any existing `CompetitionEntry` docs for this `competitionId` where `snapshotAt` matches the current run. This makes re-runs safe.

---

## Public Dashboard Route (pft-dashboard)

### Route Group Strategy

Add a new route group `(public)` alongside the existing `(dashboard)` group:

```
src/app/
  (dashboard)/          ← requires auth cookies (existing)
  (public)/             ← no auth required (new)
    leaderboard/
      page.tsx          ← public leaderboard
      layout.tsx
    competitions/
      page.tsx          ← list active competitions
      [id]/
        page.tsx        ← competition detail + live rankings
```

The `(public)` group gets its own `layout.tsx` with brand header/footer but no auth guard. It does not go inside `(dashboard)` because the middleware redirects any non-public path without cookies to `/auth/login`.

**Add to `middleware.ts` `isPublicPath` check:**

```typescript
const isLeaderboardPath = path.startsWith("/leaderboard");
const isCompetitionsPath = path.startsWith("/competitions");
const isPublicPath =
  isAuthPath || isCheckoutPath || ... ||
  isLeaderboardPath ||
  isCompetitionsPath;
```

### Auth-Aware Data Masking in UI

The public leaderboard page uses `getServerSession` or reads the `accessToken` cookie server-side. If the cookie is present, pass an `Authorization` header to the backend public endpoint — the backend then returns unmasked data. If no cookie, no header — backend returns masked data. This keeps masking logic in one place (backend) and avoids a separate "masked" API.

---

## Data Flow

```
Cron (every 15 min)
  └─► LeaderboardService.generateAndStoreLeaderboardData()
        └─► Leaderboard collection (upsert per userId+programId)

Competition Cron (every 5 min — lightweight state check only)
  └─► CompetitionService.tickTransitions()
        └─► Competition.find({ status: "draft", startDate: { $lte: now } })
              └─► transition to "active"
        └─► Competition.find({ status: "active", endDate: { $lte: now } })
              └─► transition to "ended"
              └─► CompetitionService.determineWinners()

Public API GET /leaderboard/public
  └─► reads Leaderboard collection (with optOut exclusion + data masking)

Admin API GET /competitions/:id/entries
  └─► reads CompetitionEntry collection (indexed on competitionId)

Admin trigger POST /competitions/:id/determine-winners
  └─► CompetitionService.determineWinners()
        └─► reads Leaderboard collection
        └─► writes CompetitionEntry collection
        └─► updates Competition.winners[]
```

---

## Build Order (Dependency-First)

1. **Backend: User model opt-out field** — unblocks all opt-out logic downstream; one-line schema change + migration-safe (default false)
2. **Backend: Public leaderboard endpoint** — `GET /leaderboard/public` with masking. Unblocks public UI work. Can reuse 100% of existing `LeaderboardService.getLeaderboard()` with an `isPublic` flag.
3. **Backend: Competition + CompetitionEntry models** — no service logic yet; just the schemas. Lets frontend types be generated.
4. **Backend: CompetitionService + competition.routes.ts** — CRUD + state machine + winner determination.
5. **Backend: Competition cron** — register alongside existing `LeaderboardCronService.startCronJob()` in app bootstrap.
6. **Frontend: middleware.ts public path additions** — unblocks all public page work.
7. **Frontend: `(public)` route group + public leaderboard page** — wire to `GET /leaderboard/public`.
8. **Frontend: Admin competitions UI** — `/(dashboard)/admin/competitions/` CRUD + winner display.
9. **Frontend: Public competitions pages** — `/competitions/` list + `/competitions/[id]/` detail.

---

## Modified vs New — Explicit List

### Modified (pft-backend)

| File | Change |
|------|--------|
| `modules/Auth/auth.model.ts` | Add `leaderboardOptOut: Boolean` field |
| `modules/Leaderboard/leaderboard.routes.ts` | Add `GET /public` route (no auth middleware) |
| `modules/Leaderboard/leaderboard.service.ts` | Add `getPublicLeaderboard(query, isAuthenticated)` method with opt-out filter + masking |
| `app.ts` or bootstrap file | Register `CompetitionCronService.start()` alongside existing leaderboard cron |

### New (pft-backend)

| File | Purpose |
|------|---------|
| `modules/Competition/competition.model.ts` | Competition schema |
| `modules/Competition/competitionEntry.model.ts` | CompetitionEntry schema |
| `modules/Competition/competition.interface.ts` | TypeScript interfaces |
| `modules/Competition/competition.service.ts` | State machine + winner determination |
| `modules/Competition/competition.controller.ts` | HTTP handlers |
| `modules/Competition/competition.routes.ts` | Route definitions |
| `modules/Competition/competition.cron.ts` | Lightweight transition ticker |

### Modified (pft-dashboard)

| File | Change |
|------|--------|
| `src/middleware.ts` | Add `isLeaderboardPath` and `isCompetitionsPath` to `isPublicPath` |
| `src/app/(dashboard)/admin/` | Add `competitions/` page folder |

### New (pft-dashboard)

| File | Purpose |
|------|---------|
| `src/app/(public)/layout.tsx` | Public layout (no auth, brand header/footer) |
| `src/app/(public)/leaderboard/page.tsx` | Public leaderboard with auth-aware masking |
| `src/app/(public)/leaderboard/layout.tsx` | Metadata |
| `src/app/(public)/competitions/page.tsx` | Active/past competitions list |
| `src/app/(public)/competitions/[id]/page.tsx` | Competition detail + live rankings |
| `src/app/(dashboard)/admin/competitions/page.tsx` | Admin competition management |
| `src/app/(dashboard)/_components/modules/admin/competitions/` | Admin UI components |
| `src/app/(public)/_components/leaderboard/` | Public leaderboard components (reuse admin components where possible) |

---

## Reuse Opportunities

The admin leaderboard already has `LeaderboardTable`, `LeaderboardSearchAndSort`, `LeaderboardStats`, `LeaderboardPagination` components. The public leaderboard page should reuse these components directly, passing a `masked` prop that controls whether name/email is rendered in full or truncated. Do not duplicate these components — extend them.

---

## Scalability Considerations

| Concern | Now | At scale |
|---------|-----|----------|
| Public leaderboard reads | `cacheResponse(45)` on backend is sufficient | Add CDN edge caching header if traffic spikes |
| CompetitionEntry inserts at `ended` | Bulk insert once per competition — fine | No concern; not a write-hot path |
| Winner determination query | Reads full `Leaderboard` collection — fine at current scale | Add `{ leaderboardOptOut: 1 }` index on User if filter becomes slow |
| Competition cron overhead | Lightweight — one `find` per status per tick | Run less frequently (every 10 min) if many competitions exist |

---

## Sources

- Direct codebase inspection: `pft-backend/src/app/modules/Leaderboard/` (all files)
- Direct codebase inspection: `pft-dashboard/src/app/(dashboard)/admin/leaderboard/`
- Direct codebase inspection: `pft-dashboard/src/middleware.ts` lines 430–483
- Direct codebase inspection: `pft-backend/src/app/modules/Auth/auth.utils.ts` (role enum)
- Confidence: HIGH — based on direct source inspection, not training data assumptions
