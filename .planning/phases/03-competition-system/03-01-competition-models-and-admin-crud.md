---
phase: 03-competition-system
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # pft-backend (nested git repo, branch main-2026)
  - pft-backend/src/app/modules/Competition/competition.model.ts
  - pft-backend/src/app/modules/Competition/competitionEntry.model.ts
  - pft-backend/src/app/modules/Competition/competition.interface.ts
  - pft-backend/src/app/modules/Competition/competition.validation.ts
  - pft-backend/src/app/modules/Competition/competition.service.ts
  - pft-backend/src/app/modules/Competition/competition.controller.ts
  - pft-backend/src/app/modules/Competition/competition.routes.ts
  - pft-backend/src/app/routes/index.ts
  # pft-dashboard (separate repo, branch main-2026)
  - pft-dashboard/src/types/competition.types.ts
  - pft-dashboard/src/hooks/useCompetitions.ts
  - pft-dashboard/src/lib/api/config.ts
  - pft-dashboard/src/app/(dashboard)/admin/competitions/page.tsx
  - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx
  - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionsTable.tsx
  - pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionFormModal.tsx
  - pft-dashboard/src/lib/config/sidebar-config.tsx
  # pfr-super-admin (separate repo)
  - pfr-super-admin/lib/sidebar-routes.ts
autonomous: true

must_haves:
  truths:
    - "Admin can create a competition with name, start/end dates, and 1st/2nd/3rd prize amounts"
    - "A newly created competition appears in 'draft' status before going active"
    - "Admin can edit a competition's fields while it is in draft status"
    - "Admin can enable (draft->active) and disable (active->draft) a competition"
    - "Editing or deleting a non-draft competition is rejected by the backend"
    - "The /admin/competitions page is visible to admin and backOffice roles"
  artifacts:
    - path: "pft-backend/src/app/modules/Competition/competition.model.ts"
      provides: "Competition schema with status state machine (draft|active|closing|ended|archived), prizePool[], winners[], NO brandId"
      contains: "status"
    - path: "pft-backend/src/app/modules/Competition/competitionEntry.model.ts"
      provides: "Separate CompetitionEntry collection (NOT embedded) with baselineValueGrowth, finalValueGrowth, delta, rank, isWinner"
      contains: "competitionId"
    - path: "pft-backend/src/app/modules/Competition/competition.routes.ts"
      provides: "Admin CRUD routes gated Auth(userRole.admin, userRole.backOffice)"
      contains: "Auth"
    - path: "pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionFormModal.tsx"
      provides: "Create/edit modal (useState + Input + type=date/number) mirroring CouponFormModal"
      min_lines: 60
    - path: "pfr-super-admin/lib/sidebar-routes.ts"
      provides: "pagePermissions seed entry for /admin/competitions so the page is visible per tenant"
      contains: "/admin/competitions"
  key_links:
    - from: "pft-backend/src/app/routes/index.ts"
      to: "competitionRoutes"
      via: "route registration array entry { path: '/competitions', route: competitionRoutes }"
      pattern: "competitions"
    - from: "pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx"
      to: "/competitions"
      via: "useCompetitions hook -> apiClient"
      pattern: "competitions"
    - from: "pft-dashboard/src/lib/config/sidebar-config.tsx"
      to: "/admin/competitions"
      via: "sidebar nav entry"
      pattern: "/admin/competitions"
---

<objective>
Build the Competition foundation: backend Mongoose models (Competition + separate CompetitionEntry collection), the admin CRUD module (validation/service/controller/routes mirroring the Coupon module), the dashboard admin UI (table + create/edit modal mirroring the Coupon admin UI), and the cross-repo Super Admin pagePermissions seed so the admin page is actually visible.

This plan satisfies COMP-01 (create competition) and COMP-02 (enable/disable + edit while draft). It is the foundation every later Phase 3 plan builds on (enrollment, public page, winner determination).

Purpose: Establish the data model, status state machine, and admin entry point. Get a draft competition creatable and editable before any enrollment/scoring exists.
Output: Competition + CompetitionEntry models, admin CRUD endpoints, admin management UI, sidebar entry, pagePermissions seed.
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-competition-system/3-CONTEXT.md
@.planning/phases/03-competition-system/3-RESEARCH.md

# Backend clone sources (study these patterns before writing)
@pft-backend/src/app/modules/Coupon/Coupon.model.ts
@pft-backend/src/app/modules/Coupon/Coupon.validation.ts
@pft-backend/src/app/modules/Coupon/Coupon.route.ts
@pft-backend/src/app/modules/Coupon/Coupon.controller.ts
@pft-backend/src/app/modules/Coupon/Coupon.service.ts
@pft-backend/src/app/modules/Leaderboard/leaderboard.model.ts
@pft-backend/src/app/routes/index.ts

# Dashboard clone sources
@pft-dashboard/src/app/(dashboard)/admin/coupon-codes/page.tsx
@pft-dashboard/src/app/(dashboard)/_components/modules/admin/coupon-codes/CouponCodeContainer.tsx
@pft-dashboard/src/app/(dashboard)/_components/modules/admin/coupon-codes/CouponCodesTable.tsx
@pft-dashboard/src/app/(dashboard)/_components/modules/admin/coupon-codes/CouponFormModal.tsx
@pft-dashboard/src/hooks/useKycReminderSettings.ts
@pft-dashboard/src/lib/api/config.ts
@pft-dashboard/src/lib/config/sidebar-config.tsx

# Super-admin clone source
@pfr-super-admin/lib/sidebar-routes.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Competition + CompetitionEntry models, interface, validation (pft-backend)</name>
  <files>
    pft-backend/src/app/modules/Competition/competition.model.ts
    pft-backend/src/app/modules/Competition/competitionEntry.model.ts
    pft-backend/src/app/modules/Competition/competition.interface.ts
    pft-backend/src/app/modules/Competition/competition.validation.ts
  </files>
  <action>
    All files in the NESTED pft-backend git repo (branch main-2026).

    Create the Competition module skeleton mirroring the Coupon module conventions (mongoose Schema/model, `{ timestamps: true }`, zod via the house `validateRequest` pattern — study Coupon.model.ts and Coupon.validation.ts).

    competition.interface.ts: define ICompetition, ICompetitionEntry, and DTO types.
    - ICompetition: name, description?, startDate, endDate, metric (constant "valueGrowthPercentage"), status ("draft"|"active"|"closing"|"ended"|"archived"), prizePool: [{ rank, amount, currency, label? }], winners: [{ rank, userId, mt5AccountId, baselineValueGrowth, finalValueGrowth, deltaValueGrowth, prizeAmount, determinedAt }], createdBy?.
    - ICompetitionEntry: competitionId, userId, programId, mt5AccountId, baselineValueGrowth, finalValueGrowth?, delta?, rank?, isWinner, snapshotAt.

    competition.model.ts (Competition collection):
    - Schema fields per the verified example in 3-RESEARCH.md "Competition schema" (lines 277-307).
    - status enum default "draft", indexed.
    - metric: { type: String, default: "valueGrowthPercentage", enum: ["valueGrowthPercentage"] } — locked, never offered in admin form.
    - prizePool subdoc array (rank/amount/currency default "USD"/label).
    - winners subdoc array (recorded at close in 03-04; define now so the shape exists).
    - **DO NOT add a brandId field.** LOCKED DECISION (3-CONTEXT.md): OMIT brandId — multi-brand is per-DB separation, zero existing models carry it. Adding it is a foot-gun.
    - Indexes: { status: 1, endDate: 1 } and { startDate: 1, endDate: 1 }.

    competitionEntry.model.ts (SEPARATE CompetitionEntry collection — LOCKED, NOT embedded):
    - Schema per 3-RESEARCH.md "CompetitionEntry schema" (lines 312-327): competitionId/userId/programId/mt5AccountId refs, baselineValueGrowth (required), finalValueGrowth?, delta?, rank?, isWinner default false, snapshotAt default Date.now, timestamps.
    - Indexes: { competitionId: 1, userId: 1 } (dedupe-by-user at close), { competitionId: 1, delta: -1 } (ranking), { competitionId: 1, rank: 1 }.

    competition.validation.ts (zod, mirror Coupon.validation.ts):
    - createCompetitionSchema: name (string min 1), description optional, startDate + endDate (coerce to date; endDate must be after startDate — use .refine), prizePool array of { rank: number, amount: number positive, currency optional, label optional } with at least 1 entry. DO NOT accept status or metric from the client.
    - updateCompetitionSchema: all fields optional (partial). DO NOT accept status here — status transitions go through dedicated enable/disable endpoints in Task 2.
  </action>
  <verify>
    cd pft-backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "Competition/" || echo "no Competition type errors"
    grep -rn "brandId" src/app/modules/Competition/ && echo "FAIL brandId present" || echo "PASS no brandId"
    grep -n "status.*draft.*active.*closing.*ended.*archived\|enum:" src/app/modules/Competition/competition.model.ts | head
  </verify>
  <done>
    Both models + interface + validation compile (scoped tsc clean for Competition/). brandId is absent (grep returns nothing). CompetitionEntry is a separate model file (separate collection), not embedded in Competition. status enum includes all five states; metric enum is locked to valueGrowthPercentage.
  </done>
</task>

<task type="auto">
  <name>Task 2: Competition service + controller + routes + route registration (pft-backend)</name>
  <files>
    pft-backend/src/app/modules/Competition/competition.service.ts
    pft-backend/src/app/modules/Competition/competition.controller.ts
    pft-backend/src/app/modules/Competition/competition.routes.ts
    pft-backend/src/app/routes/index.ts
  </files>
  <action>
    All files in the NESTED pft-backend git repo (branch main-2026). Mirror Coupon.service.ts / Coupon.controller.ts / Coupon.route.ts (thin catchAsync + sendResponse handlers, Auth gating).

    competition.service.ts — implement ONLY the CRUD + status-transition methods for this plan (enrollment, public DTO, and winner determination are added in later plans 03-02/03-03/03-04 — leave the file extensible, do not stub them):
    - create(payload, createdBy): create a Competition with status "draft".
    - list(query): admin list (all statuses), newest first.
    - getById(id).
    - update(id, payload): **DRAFT-ONLY GUARD** — load competition; if status !== "draft" throw AppError(400, "Only draft competitions can be edited"). Then apply update.
    - remove(id): **DRAFT-ONLY GUARD** — only status "draft" deletable; else 400.
    - activate(id): transition draft -> active. Guard: must currently be "draft". Set status "active". (Enrollment + baseline snapshot is added in 03-02 — for now just flip status; 03-02 will hook enrollment into this method.)
    - deactivate(id): transition active -> draft (the "disable while draft" pairing — COMP-02). Guard: only allowed from "active" AND only if no entries/winners exist yet (no CompetitionEntry rows for this competition). If entries exist, 400 "Cannot disable a competition with enrolled participants." (This keeps disable safe pre-enrollment; once 03-02 enrolls on activate, disable becomes a no-op path that's correctly blocked.)

    competition.controller.ts: catchAsync handlers create/list/getById/update/remove/activate/deactivate, each sendResponse with the house shape. createdBy from req.user.

    competition.routes.ts (mirror Coupon.route.ts):
    - const COMPETITION_ADMIN_ROLES = [userRole.admin, userRole.backOffice].
    - POST "/"           Auth(...ROLES) + validateRequest(createCompetitionSchema) -> create
    - GET  "/admin"      Auth(...ROLES) -> list (admin list; public list endpoint is added in 03-03 at GET "/")
    - GET  "/admin/:id"  Auth(...ROLES) -> getById
    - PATCH "/:id"       Auth(...ROLES) + validateRequest(updateCompetitionSchema) -> update
    - DELETE "/:id"      Auth(...ROLES) -> remove
    - POST "/:id/activate"   Auth(...ROLES) -> activate
    - POST "/:id/deactivate" Auth(...ROLES) -> deactivate
    NOTE: reserve the bare public GET "/" and GET "/:id/rankings" for plan 03-03 — do not add them here. Use "/admin" prefixed admin reads now to avoid a later collision with the public list route.

    routes/index.ts: add `{ path: "/competitions", route: competitionRoutes }` to the routes array (next to the leaderboard entry ~line 127). Import competitionRoutes at top.
  </action>
  <verify>
    cd pft-backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "Competition/|routes/index" || echo "no scoped type errors"
    grep -n "competitions" src/app/routes/index.ts
    grep -n "status !== \"draft\"\|Only draft\|userRole.admin" src/app/modules/Competition/competition.service.ts src/app/modules/Competition/competition.routes.ts | head
  </verify>
  <done>
    Routes registered at /competitions. All admin routes gated Auth(admin, backOffice). update() and remove() reject non-draft (draft-only guard present). activate flips draft->active; deactivate flips active->draft and blocks when entries exist. Public list + rankings routes intentionally absent (reserved for 03-03). Scoped tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Admin competition UI + types + hook + endpoints + sidebar + pagePermissions seed (pft-dashboard + pfr-super-admin)</name>
  <files>
    pft-dashboard/src/types/competition.types.ts
    pft-dashboard/src/lib/api/config.ts
    pft-dashboard/src/hooks/useCompetitions.ts
    pft-dashboard/src/app/(dashboard)/admin/competitions/page.tsx
    pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionContainer.tsx
    pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionsTable.tsx
    pft-dashboard/src/app/(dashboard)/_components/modules/admin/competitions/CompetitionFormModal.tsx
    pft-dashboard/src/lib/config/sidebar-config.tsx
    pfr-super-admin/lib/sidebar-routes.ts
  </files>
  <action>
    Two SEPARATE repos. Commit pft-dashboard files to pft-dashboard (main-2026); commit the pfr-super-admin file to pfr-super-admin separately.

    competition.types.ts: Competition, CompetitionEntry, PrizePoolItem, CompetitionStatus types mirroring the backend interface. (Match where 02 placed types — co-locate in a dedicated competition.types.ts, re-export via @/types if that barrel exists.)

    lib/api/config.ts: add a `competitions` ENDPOINTS block near the existing `leaderboard` block (~line 128):
      competitions: {
        adminList: "/competitions/admin",
        adminGet: (id) => `/competitions/admin/${id}`,
        create: "/competitions",
        update: (id) => `/competitions/${id}`,
        remove: (id) => `/competitions/${id}`,
        activate: (id) => `/competitions/${id}/activate`,
        deactivate: (id) => `/competitions/${id}/deactivate`,
      }
    (Public endpoints added in 03-03.)

    useCompetitions.ts (mirror useKycReminderSettings.ts — useQuery/useMutation + apiClient, invalidate ["competitions"]):
    - useCompetitions() -> list (GET adminList)
    - useCreateCompetition(), useUpdateCompetition(), useDeleteCompetition(), useActivateCompetition(), useDeactivateCompetition().

    admin/competitions/page.tsx: thin Suspense wrapper rendering CompetitionContainer (mirror coupon-codes/page.tsx).

    CompetitionContainer.tsx (mirror CouponCodeContainer.tsx): fetch via useCompetitions, render CompetitionsTable, "Create competition" button opening CompetitionFormModal, wire activate/deactivate/delete actions with sonner toasts.

    CompetitionsTable.tsx (mirror CouponCodesTable.tsx): columns name, status badge, start/end dates, prize pool summary (1st/2nd/3rd amounts), actions (Edit — disabled unless draft; Enable/Disable toggle; Delete — disabled unless draft). Disable Edit/Delete when status !== "draft" to mirror the backend guard.

    CompetitionFormModal.tsx (mirror CouponFormModal.tsx — useState + @/components/ui/input + type="date" + type="number"; NOT react-hook-form):
    - Fields: name, description, startDate (type=date), endDate (type=date), and three prize rows (1st/2nd/3rd) each amount (type=number) + currency (default USD).
    - On submit build prizePool: [{rank:1,amount,...},{rank:2,...},{rank:3,...}] (omit empty/zero ranks).
    - Edit mode prefills from selected competition; the modal is only reachable for draft competitions (table gates Edit).
    - Do NOT render a status or metric field (status via Enable/Disable actions; metric is locked).

    sidebar-config.tsx: add an "/admin/competitions" nav entry under the appropriate admin section (mirror how coupon-codes is registered). Label "Competitions".

    pfr-super-admin/lib/sidebar-routes.ts (SEPARATE REPO — branch main): add a route entry for "/admin/competitions" so the Super Admin pagePermissions seed exposes the page to admin/backOffice per tenant. Mirror the existing entry shape (e.g. the /admin/affiliates or /admin/users block at lines 149-169). Title "Competitions", href "/admin/competitions". WITHOUT this the admin page is hidden for roles even though the route exists (MEMORY reference_page_visibility_permissions). This is the easy-to-forget cross-repo step — it is REQUIRED.
  </action>
  <verify>
    cd pft-dashboard && npx tsc --noEmit 2>&1 | grep -iE "competition" || echo "no competition type errors"
    grep -n "/admin/competitions" src/lib/config/sidebar-config.tsx
    grep -rn "competitions" src/lib/api/config.ts
    cd ../pfr-super-admin && grep -n "/admin/competitions" lib/sidebar-routes.ts && echo "PASS pagePermissions seed present" || echo "FAIL missing seed"
  </verify>
  <done>
    Admin /admin/competitions page renders a table + Create/Edit modal cloned from the Coupon UI (useState + Input, no react-hook-form). Edit/Delete disabled for non-draft; Enable/Disable toggles status via the activate/deactivate endpoints. competition.types.ts + competitions ENDPOINTS + useCompetitions hook exist. Sidebar entry present in dashboard. pagePermissions seed present in pfr-super-admin/lib/sidebar-routes.ts (grep confirms /admin/competitions). Scoped tsc clean.
  </done>
</task>

</tasks>

<verification>
- Backend Competition module exists with separate Competition + CompetitionEntry collections; NO brandId (grep clean).
- Admin CRUD routes registered at /competitions, all gated Auth(admin, backOffice).
- update/remove enforce draft-only; activate/deactivate handle draft<->active.
- Admin UI page + table + modal cloned from Coupon pattern; non-draft Edit/Delete disabled.
- pagePermissions seed added in pfr-super-admin so the page is visible.
- Scoped tsc clean in both repos (full-repo tsc OOMs — do NOT run it).
</verification>

<success_criteria>
- COMP-01: Admin creates a competition (name, dates, 1st/2nd/3rd prizes) -> appears in draft.
- COMP-02: Admin can edit while draft, and enable (activate) / disable (deactivate); non-draft edits rejected.
- Admin page visible to admin/backOffice (sidebar + pagePermissions seed).
</success_criteria>

<output>
After completion, create `.planning/phases/03-competition-system/03-01-SUMMARY.md`.
Commit backend files to the nested pft-backend repo (main-2026): `feat(03-01): competition models + admin CRUD module`.
Commit dashboard files to pft-dashboard (main-2026): `feat(03-01): admin competition management UI`.
Commit pfr-super-admin file separately: `feat(03-01): seed /admin/competitions pagePermissions`.
All commits Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>.
</output>
