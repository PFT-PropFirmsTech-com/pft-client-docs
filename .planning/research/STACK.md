# Technology Stack — Public Leaderboard + Competition System

**Project:** PFT WhiteLabel v2 — Leaderboard & Competition Milestone
**Researched:** 2026-06-28
**Scope:** NEW additions only. Existing stack (Next.js 15, Node/Express, MongoDB/Mongoose, Redis/ioredis, socket.io, nodemailer, node-cron) is validated and not re-evaluated here.

---

## What Actually Needs Adding

After reviewing the existing codebase, the answer is: **very little new stack**. Every building block is already present. The analysis below explains what to reach for and what to build with what already exists.

---

## Recommended Stack Additions

### Frontend — Dashboard (pft-dashboard)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| — | — | Countdown timer | Build with `date-fns` (^4.1.0, already installed) + `useEffect` interval. No library needed — a 1-line `differenceInSeconds` + `useInterval` pattern is sufficient and avoids a new dependency for a single display component. |
| — | — | Prize/rank display | `canvas-confetti` (^1.9.4, already installed) for winner reveal animation. Rank badges via Tailwind + Lucide icons (both already present). No new dependency. |
| `framer-motion` | ^12.7.4 (already installed) | Competition card animations, countdown pulse | Already present; use `AnimatePresence` + `motion.div` for competition state transitions (upcoming → live → ended). |

**No new npm packages required for the frontend display layer.**

### Backend — API (pft-backend)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| — | — | Competition state cron | `node-cron` (^4.2.1, already installed). Add a new cron expression (e.g., `*/5 * * * *`) to evaluate competition end conditions. Same pattern as `LeaderboardCronService`. |
| — | — | Winner notification emails | `nodemailer` + `SimpleEmailTemplateService` (already present). Add a `COMPETITION_WINNER` template key to the existing MessageTemplates system — zero new infrastructure. |
| — | — | Public (unauthenticated) route caching | `cacheResponse` middleware (already present, Redis-backed). Apply to the new public leaderboard GET with a 60s TTL. Existing single-flight coalescing handles burst traffic. |

**No new npm packages required for the backend layer.**

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Countdown display | `date-fns` (existing) + `setInterval` | `react-countdown` library | Single-use component; adding a 3KB library for what is 10 lines of code is wasteful |
| Countdown display | — | `moment` (existing) | `date-fns` v4 is tree-shakeable and already used for date formatting in the same codebase; no reason to mix |
| Competition state machine | Custom cron in backend | `XState` / `zustand` state machine | Competition states (UPCOMING → ACTIVE → ENDED → ARCHIVED) are server-owned, not client-owned. Server cron + MongoDB status field is the correct authoritative source. |
| Winner emails | Existing `sendEmail` service | Third-party transactional email SDK (Postmark JS, SendGrid Node) | The codebase already abstracts provider via `emailConfig` per-brand — the service already supports Postmark/SendGrid/Zoho switching. Adding an SDK would duplicate what exists. |
| Public page caching | Redis `cacheResponse` (existing) | Next.js `unstable_cache` / ISR | The leaderboard data lives behind the Express API, not Next.js data fetching. Redis cache at the API layer is the right boundary and already works. ISR adds no value when the source of truth is the backend. |
| Real-time rank updates | — | New WebSocket channel or SSE | The 15-min cron refresh cadence matches prop-firm leaderboard expectations (not millisecond trading data). Polling every 60s on the public page is sufficient and consistent with the existing pattern. If real-time is later required, `socket.io` is already installed. |

---

## Integration Points

### Public Route — No Auth Required
The existing `Auth(userRole.admin, ...)` guard must be removed (or a new unguarded route added) for the public endpoint. The `cacheResponse` middleware is already safe for anonymous callers — it does not scope by user when `scope` is omitted (defaults to `"global"`).

Pattern to follow:
```typescript
// New public leaderboard route (no Auth middleware)
router.get("/public", cacheResponse(60), getPublicLeaderboard);
```

### Competition Model — New MongoDB Collection
Add a `Competition` collection (Mongoose model) with fields:
- `title`, `description`, `startDate`, `endDate`
- `status`: `"UPCOMING" | "ACTIVE" | "ENDED" | "ARCHIVED"`
- `prizeStructure`: array of `{ rank, label, value }`
- `eligibilityCriteria`: filter params (program type, account size, etc.)
- `winnersSnapshot`: array populated at `status → ENDED`
- `brandId` (for multi-brand isolation)

This is plain Mongoose — no new library.

### Winner Determination Cron
Extend `LeaderboardCronService` pattern or add a sibling `CompetitionCronService`. On `endDate` crossing:
1. Query top-N from `Leaderboard` collection filtered to competition-eligible accounts.
2. Write `winnersSnapshot` to `Competition` doc.
3. Flip `status` to `"ENDED"`.
4. Call `sendEmail` for each winner using a new `COMPETITION_WINNER` message template.

All four operations use existing infrastructure.

### Email Notification
Add template key `COMPETITION_WINNER` via the admin MessageTemplates UI. Template variables: `{{competitionTitle}}`, `{{rank}}`, `{{prizeLabel}}`, `{{prizeValue}}`. The existing `formatEmailArgs` + `SimpleEmailTemplateService` pipeline handles substitution, per-brand layout, and language fallback automatically.

### Frontend Public Page
Add a Next.js route outside the auth layout, e.g. `/leaderboard` or `/competition/[slug]`. This route calls the new public API endpoint. Use `@tanstack/react-query` (^5.74.4, already installed) for client-side polling (`refetchInterval: 60_000`). No server-side rendering cache complexity needed — the Redis cache at the API layer provides the staleness control.

---

## What NOT to Add

- **Do not add `react-countdown`, `react-timer-hook`, or any countdown library** — `date-fns` + a 10-line hook covers it.
- **Do not add `bull` or `bullmq` for job queuing** — competition end is a low-frequency, low-stakes event. A cron check every 5 minutes is correct. BullMQ introduces Redis queue infra overhead that is not justified.
- **Do not add a state management library (Zustand, Redux) for competition state** — competition status is server state fetched via React Query. Client-side state management is not the right tool.
- **Do not add ISR or Next.js `revalidateTag`** — the data pipeline is Express API → Redis cache → client. Mixing in Next.js cache layers creates two TTL systems to reason about.
- **Do not add a separate leaderboard service or microservice** — the precomputed Leaderboard collection + cron already scales to the use case. Public exposure is a route change, not an architecture change.

---

## Sources

- Codebase audit: `pft-backend/src/app/modules/Leaderboard/` — existing model, routes, cron, cache middleware
- Codebase audit: `pft-dashboard/package.json` — confirmed `date-fns`, `framer-motion`, `canvas-confetti`, `@tanstack/react-query` already installed
- Codebase audit: `pft-backend/src/app/middlewares/cacheResponse.ts` — confirmed Redis single-flight cache is production-ready and generic
- Codebase audit: `pft-backend/src/app/services/email/` — confirmed nodemailer + template system supports arbitrary template keys
- Confidence: HIGH — all claims grounded in direct codebase inspection, no WebSearch-only assertions
