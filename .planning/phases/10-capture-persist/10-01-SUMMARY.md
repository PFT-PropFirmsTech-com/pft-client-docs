---
phase: 10-capture-persist
plan: "01"
subsystem: api
tags: [express, cookie, redirect, js-cookie, crm, partner-tracking]

# Dependency graph
requires: []
provides:
  - "GET /api/tracking/track?clickid= → sets _partner_clickid cookie (30d, raw value) + 302 redirect"
  - "pft-dashboard register payload conditionally includes partnerClickId from _partner_clickid cookie"
affects:
  - 10-02-PLAN (schema/persist: picks up partnerClickId from register body)
  - 10-03-PLAN (enrichment: reads persisted partnerClickId from user doc)
  - 12-xx-PLAN (S2S postback: encodes partnerClickId exactly once at send time)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw cookie passthrough: /track sets _partner_clickid with RAW clickid value; encoding deferred to Phase 12 S2S send (single encodeURIComponent at send time)"
    - "Skip-when-absent: conditional spread ...(partnerClickId ? { partnerClickId } : {}) — never send empty string on register"
    - "Open-redirect guard: allowlist redirect param to paths starting with / but not // (protocol-relative)"
    - "httpOnly:false on _partner_clickid so js-cookie can read it client-side for signup attribution"

key-files:
  created: []
  modified:
    - pft-backend/src/app/modules/Tracking/tracking.controller.ts
    - pft-backend/src/app/modules/Tracking/tracking.routes.ts
    - pft-dashboard/src/hooks/useAuth.ts
    - pft-dashboard/src/types/auth.types.ts

key-decisions:
  - "httpOnly:false on _partner_clickid — required so js-cookie reads it in the browser for signup attribution"
  - "Cookie stores RAW clickid; Phase 12 encodes once at S2S send (never double-encode)"
  - "Open-redirect guard on ?redirect= param: must start with / and not // (protocol-relative blocked)"
  - "trackRedirect is a sync Express handler (not async) since no DB/await ops needed"
  - "On error in trackRedirect: still 302-redirect to / — tracking failures must never break a landing click"

patterns-established:
  - "CRM-01 cookie contract: set raw on backend /track, forward raw from dashboard on register, encode once in Phase 12"

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 10 Plan 01: CRM-01 Partner Click Capture Summary

**First-party `_partner_clickid` cookie set via `GET /track` redirect entry point + forwarded as `partnerClickId` in signup body, with raw-value passthrough contract for Phase 12 S2S encoding**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T09:54:00Z
- **Completed:** 2026-07-01T10:02:50Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Backend: `TrackingController.trackRedirect` — reads `clickid` query param, sets `_partner_clickid` cookie (30d, httpOnly:false, sameSite:lax, secure in prod), allowlists same-origin redirect, 302-redirects; missing/empty clickid still redirects without cookie; error path also redirects (never 500 a landing click)
- Backend route: `GET /track` registered under `/api/tracking/track` with `apiLimiter`, no auth, before existing public routes
- Dashboard type: `RegisterCredentials.partnerClickId?: string` added to `auth.types.ts`
- Dashboard behaviour: `useAuth` register `mutationFn` reads `Cookies.get("_partner_clickid")` and conditionally spreads into payload (skip-when-absent contract honoured)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Backend GET /track route + cookie + commit/push** — `09ca7387` (feat) — pft-backend
2. **Task 3: Frontend _partner_clickid forward + commit/push** — `e111dab1` (feat) — pft-dashboard

## Files Created/Modified

- `pft-backend/src/app/modules/Tracking/tracking.controller.ts` — Added `static trackRedirect()` handler (sync, try/catch, open-redirect guard, raw cookie, 302)
- `pft-backend/src/app/modules/Tracking/tracking.routes.ts` — Registered `router.get("/track", apiLimiter, TrackingController.trackRedirect)` with JSDoc
- `pft-dashboard/src/types/auth.types.ts` — Added `partnerClickId?: string` to `RegisterCredentials`
- `pft-dashboard/src/hooks/useAuth.ts` — Read `_partner_clickid` cookie; conditional spread into register payload

## Decisions Made

- `trackRedirect` is a plain sync handler (not async) — no DB/await needed; returning `res.redirect()` in catch prevents any 500 from leaking to a landing user
- `httpOnly:false` is intentional and required: js-cookie (browser-side) must read the cookie to forward it on register; mirrors the existing ad-platform cookie pattern
- `partnerClickId` forwarded RAW from cookie, no `decodeURIComponent` — the backend `/track` set it raw; Phase 12 encodes exactly once at S2S send time (locked encoding contract)
- Open-redirect guard: `rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")` — blocks protocol-relative hijack while allowing all same-origin relative paths

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All plan verification greps passed:

```
pft-backend/src/app/modules/Tracking/tracking.controller.ts:219:  static trackRedirect(req: Request, res: Response) {
pft-backend/src/app/modules/Tracking/tracking.routes.ts:63:router.get("/track", apiLimiter, TrackingController.trackRedirect);
pft-dashboard/src/types/auth.types.ts:45:  partnerClickId?: string;
pft-dashboard/src/hooks/useAuth.ts:289:      const partnerClickId = Cookies.get("_partner_clickid");
pft-dashboard/src/hooks/useAuth.ts:296:        ...(partnerClickId ? { partnerClickId } : {}),
```

Scoped tsc errors are all pre-existing project-wide issues (esModuleInterop, `@/` path aliases, prom-client). Zero new type errors introduced. Relying on CI per the known OOM/scoped-check convention.

Manual logic check:
- `GET /api/tracking/track?clickid=ABC123` → `_partner_clickid=ABC123` cookie + 302 to `/`
- `GET /api/tracking/track` (no clickid) → 302 to `/`, no cookie set
- Dashboard with cookie present → register body includes `{ partnerClickId: "ABC123" }`
- Dashboard with no cookie → register body has no `partnerClickId` key (not empty string)

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CRM-01 complete: click capture + signup body wiring in place
- 10-02 (schema/persist) can now pick up `partnerClickId` from the register body at `auth.service.ts:721-743` (`new User({ ...userData })`)
- 10-03 (enrichment) and Phase 12 (S2S postback) depend on the field being persisted — must follow 10-02

---
*Phase: 10-capture-persist*
*Completed: 2026-07-01*
