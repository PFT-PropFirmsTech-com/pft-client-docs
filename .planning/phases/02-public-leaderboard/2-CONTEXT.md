# Phase 2 Context — Public Leaderboard

## Decisions (LOCKED — honor exactly)

- **Name masking is universal.** First name + last initial for ALL viewers (anonymous AND logged-in). Email is NEVER exposed on the public endpoint. Logged-in state unlocks only richer STATS (account size, % growth, trading days, profit factor) — never fuller identity.
- **Public leaderboard = funded traders only.** Filter to funded accounts. Challenge/phase accounts are excluded from the public surface (matches PM's "top funded traders" wording). The existing admin leaderboard keeps showing everything.
- **Public page = ranked table + filters/sort only.** No stats banner, no weekly prize winners widget on the public page (those endpoints are admin-gated and would 401). Do not build public versions of them this phase.
- **Opt-out filtering happens at query time, not cron.** Use `User.distinct("_id", { leaderboardOptOut: true })` → exclude via `userId: { $nin }`. Opt-out must hide a trader from the public view near-immediately. If `cacheResponse` is applied to the public route, keep TTL low (≤15s) OR bust the cache on opt-out toggle so the "hide immediately" criterion holds.

## Claude's Discretion

- Exact public component structure (slim dedicated components — admin `LeaderboardTable` is NOT reusable: it renders `trader.user.email` and pushes to `/admin/users/...`)
- Masked-DTO shape and where `toPublicDTO()` lives
- Settings page location for the opt-out toggle and its UX
- Cache TTL value vs cache-bust approach (within the constraint above)

## Deferred (out of scope this phase)

- Public stats banner / public weekly prize winners endpoint
- Competition surfaces (Phase 3)
- Full-name exposure to any viewer

## Key Research Facts (from 2-RESEARCH.md)

- `apiClient` auto-attaches Bearer token on every request — single `/leaderboard/public` route can serve masked-anon and richer-logged-in by reading token presence in the backend. No frontend branching needed.
- Public route precedent: `PublicPlatformDownloadRoutes` (no `Auth()`). Add `router.get("/public", ...)` to `leaderboard.routes.ts` (mounted at `/leaderboard`).
- `leaderboardOptOut` already on schema (Phase 1). `PATCH /users/:id` already allows self-update of it (not in sensitive-strip list). LB-03 is mainly Settings UI toggle + query-time filter.
- Middleware: add `path.startsWith("/leaderboard")` to `isPublicPath` OR-chain in `pft-dashboard/src/middleware.ts:435`. Public page lives at `src/app/leaderboard/` (outside `(dashboard)`).
- Backend = nested git repo on `main-2026`. Dashboard = separate repo. Commit code to the right repo.
