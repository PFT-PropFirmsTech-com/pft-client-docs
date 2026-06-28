# Phase 2: Public Leaderboard - Research

**Researched:** 2026-06-29
**Domain:** Public (unauthenticated) leaderboard surface — pft-backend (Express/Mongoose) + pft-dashboard (Next.js App Router)
**Confidence:** HIGH (all findings are direct reads of the codebase on the deploy branches; no external/training-data dependence)

## Summary

This phase adds a public, masked leaderboard alongside the existing admin-only one. The existing leaderboard module (`pft-backend/src/app/modules/Leaderboard/`) already precomputes a `Leaderboard` collection via a 15-min cron and serves it through `getLeaderboard()`. Every existing route is gated by `Auth(userRole.admin, userRole.backOffice)`, and the populated trader objects carry full PII (`email`, real `firstName`/`lastName`) plus admin-only routing (the dashboard table links to `/admin/users/...`). The public surface must NOT reuse those payloads or those components as-is.

The cleanest path follows precedents already in the repo: a separate **public route with no `Auth()` middleware** (mirroring `PublicPlatformDownloadRoutes` at `/platform-downloads`), a **service-level `toPublicDTO()` masking pass** that strips `email` and reduces names to `firstName + lastInitial`, and **query-time opt-out filtering** (`leaderboardOptOut: { $ne: true }`) so opt-out hides a trader immediately rather than waiting for the next cron. On the frontend, the public page lives in a **plain route-group folder** (e.g. `src/app/leaderboard/`) outside `(dashboard)`, and the `isPublicPath` predicate in `src/middleware.ts` must be extended with a `/leaderboard` check. The existing admin React components (`LeaderboardTable`, `LeaderboardContainer`, etc.) are NOT reusable without surgery — they hard-render `trader.user.email` and push to admin user-report routes — so the public page needs its own slimmer presentational components.

The opt-out toggle (LB-03) requires almost no new backend: `leaderboardOptOut` already exists on the User schema, and `PATCH /users/:id` already accepts arbitrary self-update fields (it is NOT in the sensitive-field strip list and the service does no whitelisting), so a logged-in trader can set it through the existing endpoint.

**Primary recommendation:** Add a new `GET /leaderboard/public` route with NO `Auth()`, run masking + opt-out filtering in a new `LeaderboardService.getPublicLeaderboard()`, build dedicated public React components (do not reuse admin ones), extend `isPublicPath` for `/leaderboard`, and wire the opt-out toggle through the existing `PATCH /users/:id` self-update path.

---

## User Constraints

No CONTEXT.md exists for this phase — standard research mode. The milestone-level architecture decisions in `.planning/research/ARCHITECTURE.md` and `SUMMARY.md` are treated as fixed inputs (separate `/leaderboard/public` route, masked DTO, opt-out filter, public Next.js route group). This research validates and operationalizes those decisions against the actual code.

---

## Standard Stack

No new libraries are needed. This phase is built entirely on the existing stack.

### Core (already in repo)
| Library | Purpose | Where |
|---------|---------|-------|
| Express + Mongoose | Backend routes/models/service | `pft-backend/src/app/modules/Leaderboard/` |
| `@tanstack/react-query` v5 | Data fetching/caching in dashboard | `pft-dashboard/src/hooks/useLeaderboard.ts` |
| `axios` (`apiClient`) | HTTP client, auto-attaches Bearer token if present | `pft-dashboard/src/lib/api/client.ts` |
| Next.js App Router | Route groups + middleware | `pft-dashboard/src/app/`, `src/middleware.ts` |
| `cacheResponse(ttl)` middleware | Redis response cache for GET routes | `pft-backend/src/app/middlewares/cacheResponse.ts` |
| Radix `Switch` | Toggle UI for opt-out | `pft-dashboard/src/components/ui/switch.tsx` (exists) |

**Installation:** none.

---

## Architecture Patterns

### Pattern 1: Public (unauthenticated) backend route
**What:** A router with routes that simply omit `Auth()`. Confirmed precedent: `PublicPlatformDownloadRoutes`.
**Source:** `pft-backend/src/app/modules/Platform/platform.routes.ts`
```typescript
const router = express.Router();
// Public Routes — note: NO Auth() middleware
router.get("/", PlatformDownloadController.getActivePlatformDownloads);
export const PublicPlatformDownloadRoutes = router;
```
Registered in `pft-backend/src/app/routes/index.ts:118` as `{ path: "/platform-downloads", route: PublicPlatformDownloadRoutes }`. Other public examples in the same file: `/programs/public/*`, `/tracking/public-settings`, `/certificates/marketing/public`, `/social-proof/public`.

**Apply here:** Add to the existing `leaderboard.routes.ts` a route with no `Auth()`:
```typescript
// pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts
router.get("/public", cacheResponse(45), getPublicLeaderboard);
```
This sits alongside the existing admin-gated `router.get("/", Auth(...), cacheResponse(45), getLeaderboard)`. Because the module is mounted at `/leaderboard` (`routes/index.ts:127`), the full path is `GET /leaderboard/public`. **Route ordering note:** Express matches `/public` literally before any param route, and there are no conflicting param routes in this module, so order is safe — but place `/public` near the top of the file for clarity.

### Pattern 2: `Auth()` middleware — what it does and how to omit it
**Source:** `pft-backend/src/app/middlewares/auth.ts`
`Auth(...requiredRoles)` returns a middleware that: reads `req.headers.authorization`, **throws `401` if no token**, verifies the JWT, loads the user, checks ban + role membership, and on success sets `req.user = decoded`. To make a route public you simply do not include `Auth()` in its middleware chain — there is no "optional auth" variant in the repo.

**Implication for "logged-in sees full / anonymous sees masked":** The `Auth()` middleware throws on a missing token, so it CANNOT be used for a route that must serve both. Two viable designs:
- **(A) Single `/public` route, manual token inspection (recommended).** In `getPublicLeaderboard`, optionally read+verify the Bearer token yourself (reuse `verifyToken` from `pft-backend/src/app/utils/tokenGenerateFunction`). If a valid token is present → return full data; else → masked. This matches the milestone ARCHITECTURE.md decision ("service checks if request has a valid JWT").
- **(B) Two routes.** `GET /leaderboard/public` (no auth, always masked) for LB-01, and reuse a `user`-gated route for the logged-in full view (LB-02). Simpler to reason about, no manual JWT parsing, but the frontend must choose which URL to hit based on auth state.

**Recommendation:** Use **(A)** — a single `/public` route that masks unless a valid JWT is attached. The dashboard `apiClient` *always* attaches the Bearer token when an `accessToken` cookie exists (`client.ts:198-204`), so a logged-in trader's request to `/leaderboard/public` will automatically carry the token and receive full data, while an anonymous browser sends no token and gets masked data. This needs zero frontend branching. If you prefer to avoid manual JWT handling in the controller, fall back to (B).

> ⚠️ **Pitfall:** Do NOT add `user` role to the existing `GET /leaderboard` ("/") route to serve traders. That route returns full PII for every trader and links to admin pages. Keep the public surface on its own route + own DTO.

### Pattern 3: Frontend public route group
**What:** Public pages live as plain folders directly under `src/app/` (NOT inside `(dashboard)`), e.g. `auth/`, `checkout/`, `changelog/`, `c/`, `pap/`, `verify/`. Each is a normal `page.tsx`.
**Source:** `pft-dashboard/src/app/changelog/page.tsx` (single public page, no auth layout).
**Apply here:** Create `src/app/leaderboard/page.tsx` (+ optional `layout.tsx` for metadata, mirroring the admin leaderboard `layout.tsx`). This keeps it out of the `(dashboard)` auth-enforcing layout. A `(public)` named route group also works but is unnecessary given the existing convention of plain folders.

### Pattern 4: Middleware public-path allowlist
**Source:** `pft-dashboard/src/middleware.ts:421-483`
The middleware computes `isPublicPath` from a set of `path.startsWith(...)` / regex checks (`isAuthPath`, `isCheckoutPath`, `isChangelogPath`, `isVerifyPath`, `isFreeTrialPath`, `isFreeChallengePath`, `isPapFreePath`). Then at line 481:
```typescript
if (!isPublicPath && (!token || !refreshToken || !roleCookie)) {
  return NextResponse.redirect(new URL("/auth/login", request.url));
}
```
So any path not in `isPublicPath` redirects unauthenticated visitors to login. **To make `/leaderboard` public, add a predicate and include it in the `isPublicPath` OR-chain:**
```typescript
const isLeaderboardPath = path.startsWith("/leaderboard");
const isPublicPath =
  isAuthPath || isCheckoutPath || isPaymentResultPath || isChangelogPath ||
  isVerifyPath || isFreeTrialPath || isFreeChallengePath || isPapFreePath ||
  isLeaderboardPath;   // <-- add
```
The matcher (`src/middleware.ts:730-732`) already covers all non-asset routes, so `/leaderboard` will pass through the middleware. No `protectedPaths` entry should be added for it.

> ⚠️ **Pitfall:** `protectedPaths` (line 444-456) is a separate list used for role-based handling later; do not add `/leaderboard` there. Also note a logged-in trader visiting `/leaderboard` will still pass the `isPublicPath` short-circuit and reach the page — that is desired (LB-02 full view).

### Pattern 5: Frontend data hook — auth-agnostic by default
**Source:** `pft-dashboard/src/lib/api/client.ts:191-227` and `src/hooks/useLeaderboard.ts`
The shared `apiClient` request interceptor attaches `Authorization: Bearer <accessToken>` whenever the cookie exists, for ALL requests. This means a single new hook hitting `GET /leaderboard/public` works for both anonymous and logged-in users — the backend decides masking by token presence. Build `usePublicLeaderboard(query)` modeled on the existing `useLeaderboard` (same react-query shape, same `filters[...]` querystring serialization), pointing at a new `ENDPOINTS.leaderboard.public = "/leaderboard/public"` entry in `src/lib/api/config.ts:128-133`.

### Anti-Patterns to Avoid
- **Reusing `LeaderboardTable`/`LeaderboardContainer` for the public page.** They hard-render `trader.user.email` (`LeaderboardTable.tsx:301,603`) and `handleViewReport` pushes to `/admin/users/${id}/programs/...` (`LeaderboardContainer.tsx:224-231`). Build new presentational components for the public page; you may copy markup but strip PII + admin links.
- **Filtering opt-out only in the cron.** The cron runs every 15 min (`leaderboard-cron.service.ts:13`), so cron-only filtering means an opted-out trader stays visible up to 15 minutes. Success criterion 3 requires immediate hiding → filter at query time.
- **Adding `user` role to the existing admin `/` route.** Leaks PII and admin routing to traders.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Opt-out persistence endpoint | New `PATCH /users/me/leaderboard-opt-out` module | Existing `PATCH /users/:id` self-update | `leaderboardOptOut` already on schema; endpoint already allows self-update of non-sensitive fields (see below). A dedicated endpoint is optional polish, not required. |
| Token verification in public controller | Custom JWT parsing | `verifyToken(token, config.jwt_access_secret)` from `utils/tokenGenerateFunction` (same helper `auth.ts:42` uses) | Consistent signature/secret handling. |
| Response caching for the public route | Custom cache | `cacheResponse(45)` middleware | Already used by every leaderboard route; Redis-backed, `?noCache=1` bypass. |
| Toggle UI | Custom switch | `@/components/ui/switch` (Radix) | Already in the design system. |
| Auth-state detection on a client page | Custom cookie reads | `useAuth().useCurrentUser()` (`src/hooks/useAuth.ts:466`) or `Cookies.get("accessToken")` | `useCurrentUser` already returns the logged-in user (incl. `leaderboardOptOut` once backend returns it) and gracefully no-ops when unauthenticated. |

**Key insight:** The opt-out field and a working self-update endpoint already exist; LB-03 is mostly a UI task plus a query-time filter, not new backend plumbing.

---

## Answers to the Phase Questions

### Q1 — Exact route registration for a public GET /leaderboard/public
- Module is mounted at `/leaderboard` in `pft-backend/src/app/routes/index.ts:127`.
- Existing routes (`leaderboard.routes.ts:16-39`) all use `Auth(userRole.admin, userRole.backOffice)`. To add a public route, append/prepend a route WITHOUT `Auth()`:
  ```typescript
  router.get("/public", cacheResponse(45), getPublicLeaderboard);
  ```
- `Auth()` (`middlewares/auth.ts:12`) throws `401` on missing token, so omitting it is the entire mechanism for making a route public. Precedent: `PublicPlatformDownloadRoutes`.
- `userRole` values: `{ admin: "admin", user: "user", sales: "sales", backOffice: "back-office" }` (`auth.utils.ts:3-8`).

### Q2 — What `toPublicDTO()` must strip / mask
The populated trader object (`LeaderboardTrader` in `leaderboard.interface.ts:56-66`) nests `user: LeaderboardUser` which carries **PII**: `email` (line 31), full `firstName`, full `lastName`, and `programs[]` (which can include `mt5AccountPass`, `brokerServer`, `mt5AccountId`). The service currently populates `userId` with `"firstName lastName email programs"` (`leaderboard.service.ts:119`).

`toPublicDTO()` should produce a public trader where:
- `email` → **omitted entirely** (do not send empty string; delete the key).
- `lastName` → masked to last initial. Masked-name format per requirements LB-01 = **first name + last initial**, e.g. `"John D."` or `firstName + " " + lastName[0] + "."`. Guard empty names (`lastName?.[0]?.toUpperCase()`).
- `firstName` → kept as-is (requirement allows first name).
- `mt5AccountId`, `mt5AccountPass`, `brokerServer`, raw `programs[]` credentials → **omitted**. The public view only needs `accountSize`, `challengeType`/`programStage`, `displayName` from the program — not the live account login or password.
- `user._id` → consider keeping for React keys/grouping, but it is an internal id; if you want zero internal-id exposure, substitute a per-row synthetic id. The admin grouping logic keys on `trader.user._id` (`LeaderboardContainer.tsx:189`); the public page can key on `rank` instead.
- Performance metrics (`valueGrowthPercentage`, `winRate`, `profitFactor`, `tradingDays`, `accountValue`/account size) → **kept** (these are the public stats per LB-02/LB-04). Note `balance`/`equity`/`floatingPL` are arguably sensitive absolute figures — recommend exposing **percentage growth + account size bucket** publicly and keeping raw balance/equity for the logged-in (full) response only.

**Recommendation:** Implement `toPublicDTO(trader, { masked: boolean })`. When `masked` (anonymous), strip email + mask lastName + drop account credentials + drop raw balance/equity. When `!masked` (valid JWT present), return the fuller payload (still without other users' email — a trader should not see *other* traders' emails; only their own row could be unmasked, but simplest/safest is: logged-in still gets masked names + full stats, just richer metrics than anonymous). Decide the exact unmasked-name policy at planning time; the safe default is **names stay masked even for logged-in users; logged-in only unlocks extra stats** (account size, % growth, trading days, profit factor per LB-02).

### Q3 — Cron filter vs query-time filter for opt-out
**Filter at query time.** The cron (`generateAndStoreLeaderboardData`, `leaderboard.service.ts:846`) recomputes only every 15 min (`leaderboard-cron.service.ts:13`) and is rate-capped (`LEADERBOARD_MAX_PAIRS_PER_RUN`, default 400 pairs/run), so cron-side exclusion would leave an opted-out trader visible for up to 15 min — violating success criterion 3 ("hide from leaderboard immediately"). Instead, in the new `getPublicLeaderboard()` query path, exclude opted-out users:
- The `Leaderboard` collection stores `userId` but not the opt-out flag. Two options:
  1. **Pre-resolve opted-out user IDs** (`User.distinct("_id", { leaderboardOptOut: true })`) and add `userId: { $nin: optedOutIds }` to `matchConditions` (mirrors how `search` already resolves `matchingUserIds` at `leaderboard.service.ts:81-92`). Simple, one extra `distinct` per request (cacheable).
  2. **Denormalize** `leaderboardOptOut` onto the `Leaderboard` doc during cron and also flip it on toggle. More moving parts; not worth it for a boolean.
- **Recommendation:** Option 1 (query-time `$nin` on pre-resolved opted-out IDs), optionally cached for ~30s like the existing `filterOptionsCache` pattern. This gives near-immediate hiding (bounded only by the response cache TTL, which the opt-out mutation can bust by not relying on stale cache, or accept ≤45s via `cacheResponse`). If "immediate" must be sub-second, also skip/bust the response cache for the public route or lower its TTL.

> Note: the cron's existing opt-out handling is irrelevant to the public read path. You do NOT need to modify the cron for correctness, though excluding opted-out users there too would save a tiny amount of compute. Keep cron unchanged to limit blast radius.

### Q4 — How middleware decides public vs auth-gated, and the exact change
See **Pattern 4** above. `src/middleware.ts:435-443` builds `isPublicPath`; line 481 redirects non-public unauthenticated requests to `/auth/login`. Add `const isLeaderboardPath = path.startsWith("/leaderboard");` and OR it into `isPublicPath`. Do not touch `protectedPaths`. The matcher already lets `/leaderboard` through.

### Q5 — Can the admin LeaderboardTable/Stats/etc. be reused with a `masked` prop?
**Not cleanly — build dedicated public components.** Hard dependencies on admin context:
- `LeaderboardTable.tsx` renders `trader.user.email` directly (lines 301, 603) and builds `userName` from full first+last (lines 249, 545).
- `LeaderboardContainer.tsx` `handleViewReport` (lines 224-231) routes to `/admin/users/${user._id}/programs/${programId}/account/${mt5AccountId}` — an admin-only deep link that also exposes `mt5AccountId`.
- `LeaderboardStats.tsx` and `WeeklyPrizeWinners.tsx` call the admin-gated `useLeaderboardStats`/`useWeeklyLeaderboard` hooks (which hit `/leaderboard/stats` and `/leaderboard/weekly`, both `Auth(admin, backOffice)`), so they will 401 for anonymous users.

You *can* copy the visual markup, but the cleaner plan is a slim `PublicLeaderboardContainer` + `PublicLeaderboardTable` that consume `usePublicLeaderboard` and never reference email or admin routes. If you want to share code, refactor the pure presentational pieces (rank badge, growth pill) into prop-driven components, but treat that as optional. Adding a `masked` prop to the existing admin table risks regressions in the admin view and still leaves the admin-route `onViewReport` and admin-only stats hooks wired in.

### Q6 — Where the opt-out toggle goes and how to wire it
- **Location:** `pft-dashboard/src/app/(dashboard)/settings/page.tsx` → `SettingsContainer` (`src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx`). It already has card sections (Password, Sessions, Logout). Add a "Leaderboard Visibility" card with a Radix `Switch`. (`profile/page.tsx` is an alternative location; settings is the natural home for preference toggles.)
- **Current toggle wiring precedent:** there are no existing `Switch`-style preference toggles in settings, but `updateLanguagePreference` (`user.controller.ts:350` → `PATCH /users/language-preference`) shows the "self preference → service.updateUserById" pattern, and `SettingsContainer` already imports `useUpdateUser` (`useUsers.ts:131`).
- **Backend endpoint to use:** `PATCH /users/:id` (`user.routes.ts:123`, `Auth(user, admin, sales, backOffice)`). Self-update is permitted (`updateUserById` controller `user.controller.ts:445-455`). `leaderboardOptOut` is **NOT** in the self-update sensitive-field strip list (`user.controller.ts:460` strips only `role, roleIds, isBanned, isDeleted, isNameLocked`), and `UserService.updateUserById` does a raw `findByIdAndUpdate(id, updates)` with no whitelist (`user.service.ts:1382-1410`). So `apiClient.patch(ENDPOINTS.admin.users.update(currentUser._id), { leaderboardOptOut: true })` works today.
  - The `useUpdateUser` mutation's TS type (`useUsers.ts:140-155`) lists allowed `userData` keys and does NOT include `leaderboardOptOut` — extend that `Partial<{...}>` type to add `leaderboardOptOut?: boolean` (type-only change; runtime already passes it through).
  - **Optional hardening:** a dedicated `PATCH /users/me/leaderboard-opt-out` route (`Auth(user)`) is cleaner/safer than reusing the broad self-update endpoint, but is not required for function. Decide at planning time; ARCHITECTURE.md proposed it.
- **Returning current value:** Ensure `GET /users/profile` (`getMe`, mapped to `ENDPOINTS.auth.me`) includes `leaderboardOptOut` so the toggle can render its initial state. Verify the profile serializer doesn't strip it; the field is a plain boolean on the schema (`auth.model.ts:461`) so a default projection returns it.

### Q7 — Logged-in vs anonymous detection on the same public page
- **Backend:** token presence drives masking (Q2/Pattern 2A). The `apiClient` auto-attaches the token, so the same `GET /leaderboard/public` call returns masked or full based on the cookie.
- **Frontend:** to render logged-in-only UI affordances (e.g. a "you are opted out" banner, or richer columns), detect auth with `useAuth().useCurrentUser()` (`src/hooks/useAuth.ts:466`) which returns the user when an `accessToken`/`refreshToken` cookie is valid and otherwise errors/empty — or read `Cookies.get("accessToken")` directly for a lightweight boolean. Because the public page is a client component (`"use client"`, like `LeaderboardContainer`), both work. Note the page is server-reachable without auth, so guard any logged-in-only rendering behind a truthy current-user check and treat the unauthenticated path as the default.

---

## Common Pitfalls

### Pitfall 1: Opt-out not hiding immediately
**What goes wrong:** Trader toggles opt-out, but still appears on the public board for up to 15 min.
**Root cause:** Relying on the cron to drop them, or a 45s `cacheResponse` serving stale data.
**Avoid:** Filter `userId $nin optedOutIds` at query time (Q3). Consider lowering/bypassing the public route's response-cache TTL, or invalidate it on toggle, so the change is visible within seconds.
**Warning sign:** Opted-out user visible after a hard refresh of the public page.

### Pitfall 2: PII leak through reused admin components/payloads
**What goes wrong:** Public page shows email or links to `/admin/users/...`.
**Root cause:** Reusing `LeaderboardTable`/`LeaderboardContainer` or the `/leaderboard` admin payload.
**Avoid:** New public components + `toPublicDTO()` that deletes `email`, `mt5AccountId`, account credentials, raw balance/equity.
**Warning sign:** Network tab shows `email` or `mt5AccountId` in the `/leaderboard/public` response.

### Pitfall 3: `Auth()` 401s the public route
**What goes wrong:** Anonymous request to `/leaderboard/public` returns 401.
**Root cause:** Accidentally adding `Auth()` to the new route, or routing the frontend at the admin `/leaderboard` path.
**Avoid:** New route has NO `Auth()`; new `ENDPOINTS.leaderboard.public` points at `/leaderboard/public`.

### Pitfall 4: Middleware redirects anonymous visitors away from /leaderboard
**What goes wrong:** Visiting `/leaderboard` logged-out redirects to `/auth/login`.
**Root cause:** `/leaderboard` not in `isPublicPath` (`middleware.ts:481`).
**Avoid:** Add `isLeaderboardPath` to the `isPublicPath` OR-chain (Pattern 4).

### Pitfall 5: Public stats/weekly endpoints 401 for anonymous
**What goes wrong:** Public page tries to show stats/prize winners and gets 401.
**Root cause:** `useLeaderboardStats`/`useWeeklyLeaderboard` hit `Auth(admin, backOffice)` routes (`leaderboard.routes.ts:19-32`).
**Avoid:** Either don't render those sections publicly, or add matching public `/leaderboard/public/stats` routes with masking. Scope at planning time per LB-01/02.

### Pitfall 6: `useUpdateUser` TS type rejects `leaderboardOptOut`
**What goes wrong:** TypeScript error when calling the mutation with `{ leaderboardOptOut }`.
**Root cause:** The `userData` `Partial<{...}>` type (`useUsers.ts:140-155`) doesn't list the field.
**Avoid:** Add `leaderboardOptOut?: boolean` to that type (runtime already passes it through).

---

## Code Examples (verified against repo)

### Public route (backend)
```typescript
// pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts
// Source: mirrors PublicPlatformDownloadRoutes (platform.routes.ts) + existing cacheResponse usage
router.get("/public", cacheResponse(45), getPublicLeaderboard);
```

### Query-time opt-out exclusion (service)
```typescript
// Source: pattern from leaderboard.service.ts:81-92 (search → matchingUserIds → $in)
const optedOutIds = await User.distinct("_id", { leaderboardOptOut: true });
if (optedOutIds.length) {
  matchConditions.userId = { ...(matchConditions.userId || {}), $nin: optedOutIds };
}
```

### Masking helper (service)
```typescript
// toPublicDTO — strip email, mask last name, drop credentials
function toPublicDTO(t: LeaderboardTrader) {
  const li = t.user.lastName?.[0] ? `${t.user.lastName[0].toUpperCase()}.` : "";
  return {
    rank: t.rank,
    name: `${t.user.firstName ?? ""} ${li}`.trim(),       // "John D."
    accountSize: (t.program as any)?.programId?.accountSize,
    challengeType: (t.program as any)?.programId?.challengeType,
    performance: {
      valueGrowthPercentage: t.performance.valueGrowthPercentage,
      winRate: t.performance.winRate,
      profitFactor: t.performance.profitFactor,
    },
    tradingDays: t.tradingDays,
    // email, mt5AccountId, balance, equity, programs[] intentionally omitted
  };
}
```

### Opt-out toggle call (frontend)
```typescript
// In SettingsContainer; uses existing useUpdateUser + current user id
// Source: useUsers.ts:131 (useUpdateUser), useAuth.ts:466 (useCurrentUser)
const updateUser = useUpdateUser();
await updateUser.mutateAsync({
  id: currentUser._id,
  userData: { leaderboardOptOut: nextValue },   // extend mutation type to allow this key
});
```

### Public data hook (frontend)
```typescript
// Model on src/hooks/useLeaderboard.ts; new ENDPOINTS.leaderboard.public = "/leaderboard/public"
// apiClient auto-attaches Bearer token when accessToken cookie exists (client.ts:198-204),
// so logged-in users transparently receive the fuller payload.
const url = `${ENDPOINTS.leaderboard.public}?${params.toString()}`;
const response = await apiClient.get(url);
```

### Middleware allowlist change (frontend)
```typescript
// pft-dashboard/src/middleware.ts (near line 435)
const isLeaderboardPath = path.startsWith("/leaderboard");
const isPublicPath =
  isAuthPath || isCheckoutPath || isPaymentResultPath || isChangelogPath ||
  isVerifyPath || isFreeTrialPath || isFreeChallengePath || isPapFreePath ||
  isLeaderboardPath;
```

---

## State of the Art / Notable Existing Decisions

| Area | Current Approach | Impact on this phase |
|------|------------------|----------------------|
| Leaderboard data | Precomputed `Leaderboard` collection refreshed by 15-min cron, capped at 400 pairs/run | Public read is fast (no per-request MT5 calls); opt-out must be query-time, not cron-time |
| Auth | JWT in `Authorization` header; `Auth()` throws on missing token | No "optional auth" helper — use manual `verifyToken` or a separate public route |
| Frontend auth gate | `src/middleware.ts` cookie check + `isPublicPath` allowlist | One-line allowlist change exposes `/leaderboard` publicly |
| API client | `apiClient` always attaches token when cookie present | Same `/public` call serves masked (anon) and full (logged-in) without frontend branching |
| User prefs | `PATCH /users/:id` self-update, no field whitelist beyond a small sensitive-field strip | `leaderboardOptOut` already persistable today |

**Already done in Phase 1 (per phase_context, confirmed):**
- `leaderboardOptOut` field exists: `auth.model.ts:461`, `auth.interface.ts:311`. ✅
- `floatingPL` handling exists in the service (`leaderboard.service.ts:456,647`). ✅

---

## Open Questions

1. **Unmasked-name policy for logged-in users (LB-02).**
   - Known: anonymous = first name + last initial, no email. LB-02 says logged-in traders see "full stats" (account size, % growth, trading days, profit factor) — it does NOT explicitly say full *names* of other traders.
   - Unclear: should a logged-in trader see other traders' full last names / emails? Almost certainly not emails. Safe default: **names stay masked for everyone; logged-in only unlocks richer stats.**
   - Recommendation: planner confirms; default to masked names for all, no email ever.

2. **Should public stats / weekly prize-winner sections appear on the public page?**
   - Known: `/leaderboard/stats` and `/leaderboard/weekly` are admin-gated and will 401 anonymously.
   - Unclear: whether LB-01/02 scope includes the stats banner / weekly winners.
   - Recommendation: start with the ranked table only (LB-01/04); add public stats endpoints later if needed.

3. **Account-size / challenge-type filter values for the public filter (LB-04).**
   - Known: admin filters resolve options from `Program.distinct(...)` (`leaderboard.service.ts:130-134`). The same can power public filters.
   - Unclear: whether public filter options should be limited (e.g. only funded accounts, since LB-01 says "top funded traders").
   - Recommendation: default the public board to funded/active traders (the milestone says "top funded traders") and expose account-size + challenge-type filters from the same `distinct` sources.

4. **Response-cache immediacy for opt-out.**
   - `cacheResponse(45)` could delay opt-out visibility by ≤45s even with query-time filtering.
   - Recommendation: either lower the public route TTL or bust/skip cache so opt-out feels immediate; confirm acceptable latency at planning.

---

## Sources

### Primary (HIGH confidence — direct code reads on deploy branch `main-2026` / dashboard repo)
- `pft-backend/src/app/modules/Leaderboard/` — routes, controller, service, interface, model, cron (all read in full or in relevant part)
- `pft-backend/src/app/middlewares/auth.ts` — `Auth()` behavior
- `pft-backend/src/app/middlewares/cacheResponse.ts` — cache middleware
- `pft-backend/src/app/modules/Platform/platform.routes.ts` — public-route precedent
- `pft-backend/src/app/routes/index.ts` — route registration + public-route examples
- `pft-backend/src/app/modules/Auth/auth.utils.ts` — `userRole` values
- `pft-backend/src/app/modules/Auth/auth.model.ts:461` — `leaderboardOptOut` field
- `pft-backend/src/app/modules/User/user.routes.ts`, `user.controller.ts:350-514`, `user.service.ts:1382-1410` — self-update path + field handling
- `pft-dashboard/src/middleware.ts` — `isPublicPath` gate
- `pft-dashboard/src/lib/api/client.ts`, `src/lib/api/config.ts` — token auto-attach + ENDPOINTS
- `pft-dashboard/src/hooks/useLeaderboard.ts`, `src/hooks/useUsers.ts:131-168`, `src/hooks/useAuth.ts:466` — data/mutation/auth hooks
- `pft-dashboard/src/app/(dashboard)/_components/modules/admin/leaderboard/LeaderboardContainer.tsx`, `LeaderboardTable.tsx` — PII + admin-route coupling
- `pft-dashboard/src/app/(dashboard)/_components/modules/settings/SettingsContainer.tsx` — toggle host location
- `.planning/research/ARCHITECTURE.md`, `SUMMARY.md` — milestone decisions (treated as fixed input)

### Secondary / Tertiary
- None. No WebSearch/Context7 needed — this is an internal-codebase integration phase.

---

## Metadata

**Confidence breakdown:**
- Backend route/auth/opt-out: **HIGH** — every claim is a direct file+line read; the public-route and self-update precedents are concrete and currently in production code.
- Masking DTO specifics: **HIGH** on what is PII (confirmed in interface + service projection); **MEDIUM** on the exact unmasked-name/balance policy for logged-in users (a product decision, flagged in Open Questions).
- Frontend route group + middleware + hook: **HIGH** — middleware gate and apiClient token behavior read directly.
- Component reusability: **HIGH** — email rendering and admin-route push verified by line number.

**Research date:** 2026-06-29
**Valid until:** ~30 days (stable internal code; re-verify if `leaderboard.service.ts`, `middleware.ts`, or `user.controller.ts` self-update logic changes).
