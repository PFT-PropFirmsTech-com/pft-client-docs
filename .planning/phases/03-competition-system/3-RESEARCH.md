# Phase 3: Competition System - Research

**Researched:** 2026-06-29
**Domain:** Backend Mongoose modules + cron + admin CRUD UI + public masked surface (PFT WhiteLabel platform)
**Confidence:** HIGH — based on direct source inspection of the actual codebase, not training data

## Summary

Phase 3 is **additive and pattern-driven**. Everything needed already exists in the codebase: a precomputed `Leaderboard` collection that carries `performance.valueGrowthPercentage` per `{userId, programId}` pair, a cron registration site in `server.ts`, an established admin CRUD module shape (model + interface + validation(zod) + service + controller + routes), an admin table+modal UI pattern (CouponFormModal / CouponCodesTable / Container), a public masked endpoint pattern (`GET /leaderboard/public` + `toPublicDTO`), and a middleware allowlist mechanism for public pages. **No new npm packages are required** — `date-fns`, `framer-motion`, `canvas-confetti`, `react-hook-form`, `zod`, `react-day-picker`, `@radix-ui/react-dialog`, `sonner`, `node`-side `node-cron`/`setInterval` are all present.

The single most important technical correction to surface to the planner: **"funded" is NOT an `accountType` value.** The User `programs[].accountType` enum is `["live", "demo", "banned", "passed"]` (auth.model.ts:288-293). Funded status is determined by the **populated `Program.programStage === "funded"`** (user-dashboard.service.ts:210; leaderboard.service.ts:288). Therefore the cleanest enrollment + baseline source is the **precomputed `Leaderboard` collection** queried exactly the way `getPublicLeaderboard` already does (force `programStage: "funded"`, exclude opt-outs). This single source gives both the enrollment set AND the baseline `valueGrowthPercentage` in one shot.

**Primary recommendation:** Build a `Competition` module mirroring the Coupon module conventions (zod validation via `validateRequest`, `Auth(userRole.admin, userRole.backOffice)`, thin `catchAsync` controllers + `sendResponse`). Drive enrollment, baseline snapshot, and final ranking off the existing `Leaderboard` collection's `performance.valueGrowthPercentage`. Register a `CompetitionCronService.start()` next to `LeaderboardCronService.startCronJob()` at `server.ts:387`. Mirror the public masking surface (`toPublicDTO`, token-gated richer stats, auth/anon cache buckets) for the public competition rankings — the same no-email / universal-mask / opt-out rules carry over verbatim.

---

## User Constraints

> No CONTEXT.md exists for this phase yet. The constraints below are LOCKED milestone-level architecture decisions from `.planning/research/ARCHITECTURE.md`, `.planning/research/SUMMARY.md`, and `.planning/STATE.md`. Research THESE deeply; do NOT propose alternatives.

### Locked Decisions (milestone architecture)

- `Competition` + `CompetitionEntry` are **SEPARATE Mongoose collections**. `CompetitionEntry` is NOT embedded (16MB BSON limit at 10k+ participants).
- `brandId` field on `Competition` (indexed) "from day one" per milestone notes — **see Open Question #1**: no other model in the entire backend carries `brandId` (multi-brand is pure per-DB separation). Flagged for planner decision.
- Status state machine: `draft → active → ended/closing → archived`.
- **CAS close pattern:** `Competition.findOneAndUpdate({ _id, status: "active" }, { $set: { status: "closing" } })` — only the winning process proceeds to winner determination. Prevents double winner / double prize.
- **Baseline snapshot per participant at competition START:** record each participant's `valueGrowthPercentage` (or balance) at start; rank by **DELTA from baseline**, not absolute value.
- Winner determination triggers on state transition (active→ended) via a competition cron (5-min ticker, registered same place as `LeaderboardCronService`) PLUS an admin on-demand trigger `POST /competitions/:id/determine-winners` as safety valve.
- Prize disbursement is **MANUAL admin** (out of scope: automated payout). Winner determination just records winners + surfaces in admin.
- Competition ranked by **% profit growth** (locked metric, NOT configurable per competition).

### Carry-forward Phase 2 security guarantees (NON-NEGOTIABLE on any public surface)

- **Universal masking:** every public trader name is `"John D."` via `toPublicDTO` — never full last name, never email (leaderboard.service.ts:223-266). Anonymous AND logged-in both get masked identity; a valid Bearer token unlocks only richer STAT fields, never identity (STATE.md 02-01).
- **No email / no PII** ever in a public DTO or populate projection.
- **Opt-out enforcement:** exclude `leaderboardOptOut: true` users at query time (auth.model.ts:461; leaderboard.service.ts:293).
- **Auth vs anon cache buckets:** any public route with no `Auth()` middleware MUST bucket cache via `keyExtra` (leaderboard.routes.ts:24-27) — otherwise richer logged-in responses leak to anonymous callers.
- **Funded-only:** public surfaces force `programStage: "funded"` AFTER spreading caller filters (leaderboard.service.ts:288).

### Already built (Phase 1 + 2, committed on `main-2026`, NOT yet deployed)

- `leaderboardOptOut` on User schema; deterministic `floatingPL`.
- `GET /leaderboard/public`, `getPublicLeaderboard` service, `toPublicDTO`. Public `/leaderboard` page + slim components in dashboard.
- `LeaderboardService.getLeaderboard` does filtering/sorting/pagination; `Leaderboard` precomputed collection refreshed by cron (`generateAndStoreLeaderboardData`, capped 400 pairs/run).

---

## Standard Stack

### Backend (pft-backend, branch `main-2026`)

No new packages. Use existing module conventions:

| Concern | Use | Source reference |
|---------|-----|------------------|
| Validation | `zod` schemas + `validateRequest` middleware | Coupon.validation.ts; Coupon.route.ts:4,17 |
| Auth gating | `Auth(userRole.admin, userRole.backOffice)` | leaderboard.routes.ts:32; auth.utils.ts:3-8 |
| Controller | `catchAsync` + `sendResponse` (thin handlers) | Coupon.controller.ts:1-15 |
| Models | `mongoose` `Schema`/`model`, `{ timestamps: true }` | Coupon.model.ts:5 |
| Caching | `cacheResponse(ttl, { scope, keyExtra })` | leaderboard.routes.ts:24-27 |
| Cron | static class with `setInterval` + start/stop, registered in `server.ts` | leaderboard-cron.service.ts |
| Route registration | add entry to `src/app/routes/index.ts` array | routes/index.ts:127 |

### Dashboard (pft-dashboard, branch `main-2026`)

No new packages. All present (verified in `package.json`):

| Concern | Use | Version |
|---------|-----|---------|
| Countdown timer | `date-fns` + `setInterval` | 4.1.0 |
| Confetti on winner reveal | `canvas-confetti` | 1.9.4 |
| Animations | `framer-motion` | 12.7.4 |
| Modal/dialog | `@radix-ui/react-dialog` via `@/components/ui/dialog` | 1.1.10 |
| Forms | local `useState` (dominant admin pattern) OR `react-hook-form` + `@hookform/resolvers` + `zod` | rhf 7.55, resolvers 5.0.1 |
| Date input | `<Input type="date">` (dominant admin pattern) OR `react-day-picker` | rdp 9.11.1 |
| Toasts | `sonner` | 2.0.3 |
| Data fetching | `@tanstack/react-query` (`useQuery`/`useMutation`) + `apiClient` | — |

**Form library note:** The admin CRUD codebase is MIXED. The closest analog (CouponFormModal.tsx) uses **local `useState` + plain `@/components/ui/input` + `type="date"`**, NOT react-hook-form. Only a couple of admin modals use react-hook-form (DuplicateProgramModal, onboarding BrandingStep). **Recommendation:** mirror CouponFormModal (useState + Input + type="date" + type="number" for money). Don't introduce react-hook-form just for this — it would diverge from the file you're cloning.

---

## Architecture Patterns

### Recommended Backend Module Structure (mirror Leaderboard + Coupon)

```
pft-backend/src/app/modules/Competition/
├── competition.model.ts            # Competition schema
├── competitionEntry.model.ts       # CompetitionEntry schema (SEPARATE collection)
├── competition.interface.ts        # ICompetition, ICompetitionEntry, DTOs
├── competition.validation.ts       # zod create/update schemas
├── competition.service.ts          # state machine, enrollment, baseline, winner determination, public DTO
├── competition.controller.ts       # catchAsync + sendResponse handlers
├── competition.routes.ts           # admin CRUD + public GET + determine-winners
└── competition.cron.ts             # 5-min ticker (mirror leaderboard-cron.service.ts)
```

Register routes at `routes/index.ts` (add `{ path: "/competitions", route: competitionRoutes }` next to line 127).

### Pattern 1: Cron registration (EXACT site)

The competition cron registers at **`pft-backend/src/server.ts:387`**, immediately after `LeaderboardCronService.startCronJob()`:

```typescript
// server.ts ~387 (inside startCronJobs(), after the leaderboard block)
// Competition cron is a LIGHTWEIGHT state ticker (find()/transition only) — it
// does NOT recompute MT5 metrics, so it should NOT be gated on MT5_CRONS_ENABLED
// (unlike the leaderboard cron at :386). It reads the already-precomputed
// Leaderboard collection.
CompetitionCronService.start();
logger.info("✅ Competition cron started");
```

Import at the top of server.ts alongside the other cron imports (server.ts:24 is `LeaderboardCronService`). Mirror the static-class shape of `leaderboard-cron.service.ts` (private `syncInterval`, `isRunning` guard, `start()`/`stop()`), but the body calls `CompetitionService.tickTransitions()` instead of `generateAndStoreLeaderboardData()`.

> **Decision flag for planner:** the leaderboard cron is gated behind `config.MT5_CRONS_ENABLED` (server.ts:386). Because that flag is OFF outside production, the `Leaderboard` collection is NOT refreshed in non-prod — so competitions in staging will see stale/empty leaderboard data. The competition transition cron itself should run regardless (it does no MT5 work), but winner accuracy depends on the leaderboard cron running. Note this dependency.

### Pattern 2: Enrollment + baseline from the Leaderboard collection (NOT live MT5)

The funded, non-opted-out set is exactly what `getPublicLeaderboard` already computes. Reuse that logic rather than re-querying MT5:

```typescript
// Enrollment source = precomputed Leaderboard collection, funded-only, opt-out excluded.
// Mirror leaderboard.service.ts:288-297.
const optedOut = await User.distinct("_id", { leaderboardOptOut: true });
const fundedProgramIds = await Program.distinct("_id", { programStage: "funded" });
const entries = await Leaderboard.find({
  programId: { $in: fundedProgramIds },
  ...(optedOut.length ? { userId: { $nin: optedOut } } : {}),
}).select("userId programId mt5AccountId performance.valueGrowthPercentage").lean();
// For each entry → write ONE CompetitionEntry with baselineValueGrowth = performance.valueGrowthPercentage
```

**Why Leaderboard collection, not live MT5:** (1) `valueGrowthPercentage` is already computed and is the locked ranking metric; (2) consistency — final ranking reads the same field from the same collection, so delta math is apples-to-apples; (3) live MT5 enumeration would re-implement `generateAndStoreLeaderboardData` and could disagree with the public leaderboard the user sees. The trade-off: enrollment/baseline is only as fresh as the last leaderboard cron run (≤15 min). For a monthly competition this is negligible.

### Pattern 3: CAS close (locked) — winner determination

```typescript
// Only ONE process wins the CAS and proceeds. Cron AND admin button both call this.
const claimed = await Competition.findOneAndUpdate(
  { _id: competitionId, status: "active" },
  { $set: { status: "closing" } },
  { new: true },
);
if (!claimed) return; // another process already claimed it (or not active) — no-op

// 1. Read current Leaderboard rows for all CompetitionEntry userIds in this competition
// 2. delta = currentValueGrowthPercentage − entry.baselineValueGrowth
// 3. (optional) disqualify banned/violated — see Pitfall 3
// 4. sort desc by delta, take top N = prizePool.length
// 5. write rank + isWinner=true on winning CompetitionEntry docs; record finalValueGrowth + delta
// 6. set Competition.winners[] snapshot + status = "ended"
```

### Pattern 4: Public masked competition rankings (mirror leaderboard/public)

```typescript
// competition.routes.ts — PUBLIC route, NO Auth(), MUST bucket cache auth vs anon.
router.get(
  "/:id/rankings",
  cacheResponse(15, { scope: "user", keyExtra: (req) => (req.headers.authorization ? "auth" : "anon") }),
  getPublicCompetitionRankings,
);
```

The rankings DTO MUST go through a masking function identical in spirit to `toPublicDTO` (leaderboard.service.ts:223): `displayName` = `"John D."`, NO email, richer stats only on valid token (decode via `verifyToken` in controller exactly like leaderboard.controller.ts getPublicLeaderboard). Rank by delta, but the public payload exposes the same masked shape.

### Recommended Project Structure (dashboard)

```
pft-dashboard/src/
├── middleware.ts                                   # ADD isCompetitionsPath to isPublicPath (line ~448)
├── app/
│   ├── competitions/                               # PUBLIC pages (sibling of app/leaderboard/, OUTSIDE (dashboard))
│   │   ├── layout.tsx                              # mirror app/leaderboard/layout.tsx
│   │   ├── page.tsx                                # list active/past competitions
│   │   └── [id]/page.tsx                           # detail: prize pool + countdown + live rankings
│   └── (dashboard)/admin/competitions/
│       └── page.tsx                                # thin Suspense wrapper → container (mirror coupon-codes/page.tsx)
├── app/(dashboard)/_components/modules/admin/competitions/
│   ├── CompetitionContainer.tsx
│   ├── CompetitionsTable.tsx                       # mirror CouponCodesTable.tsx
│   ├── CompetitionFormModal.tsx                    # mirror CouponFormModal.tsx (useState + Input + type=date/number)
│   └── CompetitionResults.tsx                      # winners + final standings (can mirror WeeklyPrizeWinners.tsx)
├── components/public-competition/                  # mirror components/public-leaderboard/
│   ├── PublicCompetitionContainer.tsx
│   ├── CompetitionCountdown.tsx                    # date-fns + setInterval
│   └── PublicCompetitionRankingsTable.tsx          # mirror PublicLeaderboardTable.tsx (masked)
├── hooks/
│   ├── useCompetitions.ts                          # admin useQuery/useMutation (mirror useKycReminderSettings.ts)
│   └── usePublicCompetition.ts                     # mirror usePublicLeaderboard.ts (apiClient auto-attaches token)
└── lib/api/config.ts                               # ADD competitions ENDPOINTS block near :128
```

**Note:** Phase 2 placed the public leaderboard at `app/leaderboard/` (a plain folder OUTSIDE the `(dashboard)` group), NOT in a `(public)` route group as the milestone ARCHITECTURE.md originally proposed. **Follow the as-built Phase 2 convention** — put public competition pages at `app/competitions/` as a sibling of `app/leaderboard/`. Do NOT create a `(public)` group; it doesn't exist.

### Anti-Patterns to Avoid

- **Re-using the admin `LeaderboardTable` for the public competition page** — it renders email and routes to `/admin/users` (STATE.md 02-02). Build slim public components like `public-leaderboard/` did.
- **Embedding entries in the Competition doc** — locked decision; 16MB BSON cap at 10k+ participants.
- **Ranking by absolute `valueGrowthPercentage`** — must rank by DELTA from baseline (locked).
- **A public route without `keyExtra` cache bucketing** — leaks richer logged-in stats to anon (STATE.md 02-01).
- **Treating `accountType: "funded"` as a query filter** — that enum value does NOT exist (auth.model.ts:290). Use `Program.programStage === "funded"`.
- **Triggering winner determination without the CAS guard** — double prize.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Funded + opt-out enumeration | New MT5 traversal | `Leaderboard` collection query forcing `programStage:"funded"` + `$nin` opt-out (leaderboard.service.ts:288-297) | Already computed, already the locked metric source |
| % growth metric | New MT5 perf calc | `Leaderboard.performance.valueGrowthPercentage` (leaderboard.model.ts:58) | Single source of truth; consistent with public leaderboard |
| Name masking | New string logic | Clone `toPublicDTO` (leaderboard.service.ts:223) | Phase 2 already vetted no-email/universal-mask rules |
| Token-gated richer stats on a no-Auth route | New auth flow | Clone the optional `verifyToken` decode (leaderboard.controller.ts getPublicLeaderboard) | Anon never throws; valid token unlocks stats only |
| Cache auth/anon isolation | New cache keying | `cacheResponse(15, { scope:"user", keyExtra })` (leaderboard.routes.ts:24) | Prevents stat leak |
| Admin CRUD scaffolding | New module shape | Clone Coupon module (model/interface/validation/service/controller/routes) | Matches house conventions, `validateRequest`, `Auth`, `sendResponse` |
| Admin table + create/edit modal | New UI | Clone `CouponCodesTable.tsx` + `CouponFormModal.tsx` + `CouponCodeContainer.tsx` | Established radix Dialog + useState pattern |
| Winners display | New UI | `WeeklyPrizeWinners.tsx` already renders 1st/2nd/3rd | Direct reuse for COMP-05/06 |
| Countdown | New timer math | `date-fns` + `setInterval` | Installed; used elsewhere |

**Key insight:** This phase is ~90% cloning. The `Leaderboard` collection + `getPublicLeaderboard` + `toPublicDTO` + Coupon CRUD module + Coupon admin UI together cover nearly every requirement. New code is mostly the Competition schema, the state machine, the CAS close, and the baseline-delta math.

---

## Common Pitfalls

### Pitfall 1: "funded" is not an accountType
**What goes wrong:** Querying `User.find({ "programs.accountType": "funded" })` returns nothing.
**Why:** `programs[].accountType` enum is `["live","demo","banned","passed"]` (auth.model.ts:290). The interface file `leaderboard.interface.ts:19` lists `"funded"` but that's a UI-layer type, not the DB enum.
**How to avoid:** Funded = `Program.programStage === "funded"` on the populated program (user-dashboard.service.ts:210). Enumerate via `Program.distinct("_id", { programStage: "funded" })` then match `Leaderboard.programId $in`.
**Warning signs:** Empty enrollment set; zero CompetitionEntry rows.

### Pitfall 2: Leaderboard cron not running in non-prod → stale/empty competition data
**What goes wrong:** Competition rankings and winner determination read an empty/stale `Leaderboard` collection.
**Why:** `LeaderboardCronService.startCronJob()` is gated behind `config.MT5_CRONS_ENABLED` (server.ts:386), OFF outside production.
**How to avoid:** Surface this dependency to the planner. The competition transition cron should NOT be MT5-gated (it does no MT5 work), but accurate scoring needs the leaderboard cron alive.
**Warning signs:** Winners all have delta 0; rankings table empty in staging.

### Pitfall 3: Banned / violated accounts winning
**What goes wrong:** A trader who breached mid-competition still appears in winners.
**Why:** The `Leaderboard` doc persists a `status` field (`ACTIVE`/`VIOLATED`/`BANNED`), and banned programs are skipped at refresh but a stale row can linger; `program.isBanned` lives on the User subdoc (auth.model.ts:308).
**How to avoid:** At winner determination, filter out entries whose current `Leaderboard.status` is `"BANNED"`/`"VIOLATED"` or whose User program `isBanned: true`. **This is underspecified in the locked decisions — flag for planner** (the milestone SUMMARY.md lists "Banned/violated accounts winning competitions" as a MEDIUM risk for this phase but does not lock a rule).
**Warning signs:** A winner with a breached account surfaces in admin results.

### Pitfall 4: Double winner determination
**What goes wrong:** Cron fires at endDate AND admin clicks "determine winners" → winners recorded twice / prizes double-counted.
**Why:** Two trigger paths (locked: cron + admin safety valve).
**How to avoid:** The locked CAS pattern. `findOneAndUpdate({ _id, status: "active" }, { $set: { status: "closing" } })` — only the process whose update matched (non-null return) proceeds. The admin on-demand trigger after `ended` must be idempotent (delete-then-reinsert entries for this run, or guard on `status === "ended"`).
**Warning signs:** Duplicate `winners[]` entries; duplicate CompetitionEntry isWinner rows.

### Pitfall 5: One entry per user vs per account
**What goes wrong:** A trader with 2 funded accounts gets enrolled twice and could occupy 2 winner slots, or only their worse account is scored.
**Why:** `Leaderboard` is keyed `{userId, programId}` (one row per account; leaderboard.model.ts:69). A user can hold multiple funded programs.
**How to avoid (recommendation):** Write **one CompetitionEntry per funded ACCOUNT** (mirrors the leaderboard's per-account granularity and keeps the delta math clean), but **dedupe by userId at winner determination** — take the user's best-performing account so one human cannot take two prize slots. This mirrors the milestone ARCHITECTURE.md determination step "Deduplicate by userId (take best-performing account per user)". Flag the per-account-vs-per-user storage choice for the planner to confirm.
**Warning signs:** Same person listed as 1st and 2nd.

### Pitfall 6: Rolling vs activation-only enrollment
**What goes wrong:** A trader who becomes funded mid-competition either is unfairly excluded or unfairly included with a late baseline.
**Why:** Locked decision says auto-enroll "when competition goes active" (COMP-03) — i.e. a single enrollment snapshot at activation.
**How to avoid:** Enroll ONCE at the `draft→active` transition. Do NOT roll new funded traders in mid-competition (no baseline exists for them, and a late baseline would distort delta fairness). This is consistent with the locked baseline-at-START decision. **Flag explicitly** that COMP-03 is activation-only, not rolling.
**Warning signs:** CompetitionEntry rows with `snapshotAt` later than competition startDate.

### Pitfall 7: brandId on a per-DB platform
**What goes wrong:** Adding `brandId` to `Competition` when nothing else in the DB has it, then filtering by a value that's never populated → empty results.
**Why:** Multi-brand is **pure per-DB separation** — `grep` finds ZERO models carrying `brandId` (verified across `src/app/modules/`). See Open Question #1.
**How to avoid:** See Open Question #1 recommendation.

---

## Code Examples

### Competition schema (mirror Coupon.model.ts conventions; timestamps + indexes)
```typescript
// Source pattern: Coupon.model.ts:5 (timestamps), leaderboard.model.ts:69-73 (indexes)
const CompetitionSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  // Locked: metric is NOT configurable — % profit growth only. Stored as a constant
  // for clarity but never offered in the admin form.
  metric: { type: String, default: "valueGrowthPercentage", enum: ["valueGrowthPercentage"] },
  status: { type: String, enum: ["draft","active","closing","ended","archived"], default: "draft", index: true },
  prizePool: [{
    rank: { type: Number, required: true },     // 1,2,3
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    label: { type: String },                    // "1st Place"
  }],
  winners: [{                                    // recorded at close
    rank: Number,
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    mt5AccountId: String,
    baselineValueGrowth: Number,
    finalValueGrowth: Number,
    deltaValueGrowth: Number,
    prizeAmount: Number,
    determinedAt: Date,
  }],
  // brandId: see Open Question #1 — recommend OMIT (per-DB separation)
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
CompetitionSchema.index({ status: 1, endDate: 1 });
CompetitionSchema.index({ startDate: 1, endDate: 1 });
```

### CompetitionEntry schema (SEPARATE collection — locked)
```typescript
// Source pattern: leaderboard.model.ts (separate precomputed collection)
const CompetitionEntrySchema = new Schema({
  competitionId: { type: Schema.Types.ObjectId, ref: "Competition", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  programId: { type: Schema.Types.ObjectId, ref: "Program", required: true },
  mt5AccountId: { type: String, required: true },
  baselineValueGrowth: { type: Number, required: true }, // snapshot at activation
  finalValueGrowth: { type: Number },                    // filled at close
  delta: { type: Number },                               // final − baseline (ranking key)
  rank: { type: Number },
  isWinner: { type: Boolean, default: false },
  snapshotAt: { type: Date, default: Date.now },
}, { timestamps: true });
CompetitionEntrySchema.index({ competitionId: 1, userId: 1 });   // dedupe-by-user at close
CompetitionEntrySchema.index({ competitionId: 1, delta: -1 });   // ranking
CompetitionEntrySchema.index({ competitionId: 1, rank: 1 });
```

### Admin route gating (mirror Coupon.route.ts:14-19)
```typescript
// Source: Coupon.route.ts; leaderboard.routes.ts:32
const COMPETITION_ADMIN_ROLES = [userRole.admin, userRole.backOffice];
router.post("/", Auth(...COMPETITION_ADMIN_ROLES),
  validateRequest(CompetitionValidations.createCompetitionSchema),
  CompetitionController.create);
router.patch("/:id", Auth(...COMPETITION_ADMIN_ROLES), /* draft-only edit guard in service */ ...);
router.post("/:id/determine-winners", Auth(...COMPETITION_ADMIN_ROLES), CompetitionController.determineWinners);
// PUBLIC — no Auth, masked, cache-bucketed:
router.get("/", cacheResponse(30), CompetitionController.listPublic);          // active/ended only
router.get("/:id/rankings", cacheResponse(15, { scope:"user", keyExtra:(r)=>r.headers.authorization?"auth":"anon" }), CompetitionController.publicRankings);
```

### Admin CRUD hook (mirror useKycReminderSettings.ts)
```typescript
// Source: src/hooks/useKycReminderSettings.ts:33-43
export function useCreateCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await apiClient.post("/competitions", body)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });
}
```

### Public competition hook (mirror usePublicLeaderboard.ts — apiClient auto-attaches token)
```typescript
// Source: src/hooks/usePublicLeaderboard.ts — NO auth branching; token auto-attached
export const usePublicCompetitionRankings = (id: string) =>
  useQuery({
    queryKey: ["public-competition-rankings", id],
    queryFn: async () => (await apiClient.get(`/competitions/${id}/rankings`)).data.data,
    staleTime: 15_000, // match backend cache TTL so opt-out reflects quickly
  });
```

### Middleware public allowlist (mirror the isLeaderboardPath line)
```typescript
// Source: src/middleware.ts:438-448
const isCompetitionsPath = path.startsWith("/competitions");
const isPublicPath = isAuthPath || isCheckoutPath || /* ... */ || isLeaderboardPath || isCompetitionsPath;
```

---

## State of the Art

| Old Approach | Current Approach | Source |
|--------------|------------------|--------|
| Per-app panel deploy branch | Everything ships from `main-2026` | MEMORY.md |
| Embed participants in competition doc | Separate `CompetitionEntry` collection | Locked decision |
| `(public)` route group (ARCHITECTURE.md proposal) | Plain `app/leaderboard/` folder outside `(dashboard)` | As-built Phase 2 (STATE.md 02-02) |

**Deprecated/outdated in the milestone docs vs as-built:**
- ARCHITECTURE.md proposes a `(public)` route group and a `competition.metric` with 4 options — **superseded**: Phase 2 shipped `app/leaderboard/` (no group) and the metric is LOCKED to % profit growth only.
- ARCHITECTURE.md `CompetitionEntry` carried a full `snapshotPerformance` subdoc; for the LOCKED delta-ranking you only strictly need baseline + final `valueGrowthPercentage`. A fuller snapshot is optional (audit nicety), not required.

---

## Open Questions

1. **brandId on Competition — milestone says "from day one", but NO model in the codebase carries brandId.**
   - What we know: `grep "brandId"` across `src/app/modules/` returns ZERO schema matches. Multi-brand is pure per-DB separation (MEMORY.md `reference_per_brand_databases`); each brand has its own database, so every `Competition` doc already lives in exactly one brand's DB.
   - What's unclear: whether the milestone author wanted brandId for a future shared-DB scenario or out of caution.
   - **Recommendation:** OMIT `brandId` to stay consistent with every other model. DB separation already guarantees brand isolation; an always-null/always-same brandId adds a foot-gun (Pitfall 7). If the planner wants future-proofing, add it as optional/unindexed and never filter on it. **Surface this to the human in CONTEXT/discussion before building** since it contradicts the literal milestone note.

2. **Banned/violated disqualification rule at close (Pitfall 3).** Not locked. Recommend: exclude `Leaderboard.status in ["BANNED","VIOLATED"]` and `program.isBanned` at determination. Needs a product decision.

3. **One CompetitionEntry per account or per user (Pitfall 5).** Recommend: per-account storage, dedupe-by-user (best account) at winner determination. Needs confirmation.

4. **Does the new `/admin/competitions` route need a Super Admin `pagePermissions` entry?**
   - What we know: admin page visibility per role is governed by Super Admin per-tenant `pagePermissions`, and granular per-route rules are seeded from `pfr-super-admin/lib/sidebar-routes.ts` (MEMORY.md `reference_page_visibility_permissions`). The dashboard sidebar (`sidebar-config.tsx`) and middleware `isPathAllowedForRoles` both consult it.
   - **Recommendation:** YES — a new admin route `/admin/competitions` will need (a) a sidebar entry in `pft-dashboard/src/lib/config/sidebar-config.tsx` and (b) a `pagePermissions`/`sidebar-routes.ts` seed entry in `pfr-super-admin` so it's visible to admin/backOffice per tenant. **Flag for the planner as a cross-repo task** (it touches `pfr-super-admin`, not just the two app repos). Without it the page may be hidden even though the route exists.

5. **Leaderboard cron gating in non-prod (Pitfall 2).** Winner accuracy depends on `MT5_CRONS_ENABLED`. Confirm staging strategy for demoing competitions.

---

## Sources

### Primary (HIGH confidence — direct source inspection)
- `pft-backend/src/app/modules/Leaderboard/` — model (:58,:69), service (:223 toPublicDTO, :279 getPublicLeaderboard, :288 funded force, :293 opt-out, :965 generateAndStoreLeaderboardData), routes (:22-32 public+cache), controller (getPublicLeaderboard token decode), cron service (full)
- `pft-backend/src/server.ts:24,386-391` — cron registration site
- `pft-backend/src/app/routes/index.ts:127` — route registration
- `pft-backend/src/app/modules/Coupon/` — route (:14-45), validation (zod), model (timestamps/indexes), controller (catchAsync/sendResponse)
- `pft-backend/src/app/modules/Auth/auth.model.ts:285-319,461` — programs subdoc (accountType enum, isBanned), leaderboardOptOut
- `pft-backend/src/app/modules/Auth/auth.utils.ts:3-8` — userRole enum
- `pft-backend/src/app/modules/User/user-dashboard.service.ts:210` — funded = programStage "funded"
- `pft-backend/src/app/modules/Admin/Program/program.model.ts:318` — programStage field
- `pft-dashboard/package.json` — date-fns/framer-motion/canvas-confetti/react-hook-form/zod/react-day-picker/radix-dialog/sonner present
- `pft-dashboard/src/middleware.ts:430-488` — public allowlist mechanism
- `pft-dashboard/src/app/leaderboard/` + `src/components/public-leaderboard/` + `src/hooks/usePublicLeaderboard.ts` — as-built public surface
- `pft-dashboard/src/app/(dashboard)/admin/coupon-codes/page.tsx` + `_components/modules/admin/coupon-codes/` (CouponFormModal, CouponCodesTable, Container) — admin CRUD UI pattern
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/leaderboard/WeeklyPrizeWinners.tsx` — winners display reuse
- `pft-dashboard/src/hooks/useKycReminderSettings.ts` — useQuery/useMutation + apiClient pattern
- `pft-dashboard/src/lib/api/config.ts:128` — ENDPOINTS block
- `.planning/research/ARCHITECTURE.md`, `.planning/research/SUMMARY.md`, `.planning/STATE.md`

### Secondary (MEDIUM confidence — auto-memory references)
- MEMORY.md `reference_per_brand_databases` (per-brand DB separation)
- MEMORY.md `reference_page_visibility_permissions` (Super Admin pagePermissions, cross-repo seed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified in package.json / imports
- Backend patterns & cron site: HIGH — exact file:line confirmed in actual repo (server.ts:387, routes/index.ts:127)
- Enrollment/baseline/funded determination: HIGH — confirmed `accountType` enum lacks "funded"; programStage is the real signal
- Masking carry-over: HIGH — toPublicDTO + cache bucketing read directly
- brandId / pagePermissions / disqualification rules: MEDIUM — flagged as Open Questions needing a human decision

**Research date:** 2026-06-29
**Valid until:** ~2026-07-29 (stable internal codebase; re-verify if `main-2026` sees major Leaderboard or middleware refactors)
