---
phase: 03-competition-system
plan: 01
subsystem: competition
tags: [competition, admin-crud, mongoose, react-query, pagePermissions]
requires: []
provides:
  - Competition Mongoose model (status state machine, prizePool, winners)
  - CompetitionEntry Mongoose model (separate collection)
  - Competition admin CRUD module (service/controller/routes) gated Auth(admin, backOffice)
  - Admin /admin/competitions management UI (table + create/edit modal)
  - competitions ENDPOINTS + useCompetitions hooks
  - /admin/competitions pagePermissions seed (pfr-super-admin)
affects:
  - pft-backend route registry (/competitions)
  - pft-dashboard sidebar (Sales group)
  - pfr-super-admin sidebar-routes (page visibility seed)
tech-stack:
  added: []
  patterns:
    - Coupon module pattern (zod validateRequest + Auth + catchAsync/sendResponse)
    - Coupon admin UI pattern (useState + Input + type=date/number, no react-hook-form)
key-files:
  created:
    - pft-backend/src/app/modules/Competition/competition.interface.ts
    - pft-backend/src/app/modules/Competition/competition.model.ts
    - pft-backend/src/app/modules/Competition/competitionEntry.model.ts
    - pft-backend/src/app/modules/Competition/competition.validation.ts
    - pft-backend/src/app/modules/Competition/competition.service.ts
    - pft-backend/src/app/modules/Competition/competition.controller.ts
    - pft-backend/src/app/modules/Competition/competition.routes.ts
    - pft-dashboard/src/types/competition.types.ts
    - pft-dashboard/src/hooks/useCompetitions.ts
    - pft-dashboard/src/app/(dashboard)/admin/competitions/page.tsx
    - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx
    - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionsTable.tsx
    - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionFormModal.tsx
  modified:
    - pft-backend/src/app/routes/index.ts
    - pft-dashboard/src/lib/api/config.ts
    - pft-dashboard/src/lib/config/sidebar-config.tsx
    - pfr-super-admin/lib/sidebar-routes.ts
decisions:
  - "Winners recorded as a Competition subdoc array (winners[]); CompetitionEntry also carries isWinner/rank for ranking."
  - "Admin reads served under /competitions/admin to reserve bare GET / and /:id/rankings for the public surface (03-03)."
  - "deactivate (active->draft) is blocked once any CompetitionEntry rows exist, keeping disable safe pre-enrollment."
metrics:
  duration: ~25m
  completed: 2026-06-29
---

# Phase 3 Plan 01: Competition Models and Admin CRUD Summary

Competition foundation across three repos: backend Mongoose models + admin CRUD module (Coupon pattern), dashboard admin management UI (Coupon UI pattern), and the cross-repo Super Admin pagePermissions seed that makes the admin page visible.

## What Was Built

### Backend (pft-backend, main-2026)
- **Competition model** — `draft|active|closing|ended|archived` status state machine (default draft, indexed), locked `valueGrowthPercentage` metric, `prizePool[]` (rank/amount/currency/label), `winners[]` subdoc (recorded at close in 03-04), `createdBy`. Indexes `{status,endDate}` and `{startDate,endDate}`. **No per-brand discriminator field** (LOCKED — per-DB isolation).
- **CompetitionEntry model** — SEPARATE collection (not embedded): competitionId/userId/programId/mt5AccountId refs, baselineValueGrowth (required), finalValueGrowth/delta/rank/isWinner/snapshotAt. Indexes for dedupe-by-user and ranking.
- **zod validation** — create (name, dates with endDate-after-startDate refine, prizePool min 1) and partial update; status/metric never accepted from the client.
- **Service/controller/routes** — CRUD + activate(draft→active)/deactivate(active→draft). Draft-only guards on update/remove. deactivate blocked when entries exist. All routes gated `Auth(admin, backOffice)`. Admin reads under `/competitions/admin`; bare `/` and `/:id/rankings` reserved for 03-03. Registered at `/competitions`.

### Dashboard (pft-dashboard, main-2026)
- `competition.types.ts`, `competitions` ENDPOINTS block, `useCompetitions` hooks (list/create/update/delete/activate/deactivate, invalidate `["competitions"]`).
- `/admin/competitions` page → CompetitionContainer → CompetitionsTable + CompetitionFormModal. Modal mirrors CouponFormModal (useState + Input + type=date/number, no react-hook-form). Table: name, status badge, dates, prize summary; Edit/Delete disabled unless draft; Enable/Disable toggle.
- Sidebar nav entry "Competitions" (Trophy icon) under Sales group, roles admin/backOffice.

### Super Admin (pfr-super-admin, main)
- `lib/sidebar-routes.ts` seed: `/admin/competitions` (admin, backOffice) under SALES — required for per-tenant page visibility.

## Deviations from Plan

None — plan executed exactly as written.

One careful adjustment worth noting: the negative `brandId` grep guard also matched the literal token inside explanatory code comments, so the comments were reworded ("per-brand discriminator field") to keep the guard passing while preserving the locked-decision rationale. No functional change.

## Verification
- Backend scoped tsc clean for `Competition/` and `routes/index`; `grep brandId` returns nothing (PASS); status enum has all five states; route registered at `/competitions`; draft guards + Auth roles present.
- Dashboard scoped tsc clean for competition files; `/admin/competitions` in sidebar-config; competitions ENDPOINTS present.
- Super-admin: `/admin/competitions` seed present (PASS).

## Commits
- pft-backend `2d7b8949`: models + interface + validation
- pft-backend `2a360a99`: service + controller + routes + registration
- pft-dashboard `9e63857b`: admin competition management UI
- pfr-super-admin `69d3669`: pagePermissions seed

All pushed (pft-backend main-2026, pft-dashboard main-2026, pfr-super-admin main).

## Notes for Later Plans
- `activate()` is the hook point for 03-02 enrollment + baseline snapshot (currently just flips status).
- Public list (`GET /`) and rankings (`GET /:id/rankings`) routes are intentionally reserved for 03-03.
- Winner determination (03-04) fills `winners[]` and CompetitionEntry final/delta/rank/isWinner via the locked CAS close pattern.

## Self-Check: PASSED

All created files present; all four commits (2d7b8949, 2a360a99, 9e63857b, 69d3669) found across their repos.
