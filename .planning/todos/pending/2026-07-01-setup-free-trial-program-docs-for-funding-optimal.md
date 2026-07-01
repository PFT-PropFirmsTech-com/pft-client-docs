---
created: 2026-07-01T07:00:19.523Z
title: Setup free trial Program docs for Funding Optimal
area: ops
files:
  - pft-backend/src/app/modules/FreeChallenge/freeChallenge.service.ts
  - "pft-dashboard/src/app/c/[slug]/FreeChallengeClient.tsx"
  - "pft-dashboard/src/app/(dashboard)/admin/free-trial/page.tsx"
---

## Problem

Ticket cmnx4jvry0001mr0kezmxcnnv: Funding Optimal (FO) wants a free-trial challenge live — "install free trial at our website, create programs in dashboard and start marketing... create some examples and put on website too." Bob's internal note on the ticket: free trial is already set up for XPIPS — copy that implementation 1-to-1, or just enable it for FO same as XPIPS.

Investigated 2026-07-01: this is NOT a GSD milestone / code task. The Free Challenge feature is already fully generic, not XPIPS-hardcoded:
- Backend: `Program.isFreeChallenge` + `Program.freeChallengeSlug` fields, gated only by those two — no brand check (`pft-backend/src/app/modules/FreeChallenge/freeChallenge.service.ts:86-93`)
- Admin already has the toggle in the Program create/edit form (`ProgramFormSections/ProgramTypeSelector.tsx`)
- Admin already has a management page at `/admin/free-trial` (stats, claims, fraud review, revoke)
- Public claim funnel is brand-agnostic, theme-driven via `useProjectConfig`, at `pft-dashboard/src/app/c/[slug]/` (confirmed no XPIPS-specific hardcoding)

No separate Funding Optimal marketing site exists in this workspace (`pft-web` is an unbranded generic template repo; confirmed with user FO uses dashboard-only, no separate marketing site). So "put on website" = FO's own `/c/<slug>` URL on their dashboard domain, nothing to build.

## Solution

1. Look up XPIPS's existing free-trial Program doc(s) in its own Mongo DB (per-brand DB — see `reference_per_brand_databases.md`) as the template: challengeType, growthTarget, drawdowns, `freeChallengeMinProfitAmount`/`freeChallengeMinProfitPercent`, `freeChallengePayoutCap`, `freeChallengeMaxLifetimePerUser`, `freeChallengeRequireKyc`/`freeChallengeRequireContract`.
2. Create 1-2 equivalent Program docs in Funding Optimal's own Mongo DB via the existing admin `/admin/free-trial` (or Program create) flow — same fields, FO's own `freeChallengeSlug`.
3. Hand FO the resulting claim URL: `<FO-dashboard-domain>/c/<slug>`.
4. Reply on ticket cmnx4jvry0001mr0kezmxcnnv with the link + a short "here's how to market it" note (it's their marketing site, their job to embed it).

## BLOCKED — client-requested hold (2026-07-01)

Client (Fitim, Funding Optimal) confirmed they DO want the free trial, but asked us NOT to make website changes yet: they have an **active Google Ads campaign** and changing the site mid-campaign would disrupt it. Free-trial go-live is on hold **until the client signals their Google Ads campaign has ended** (Bob: "tell me when the campaign finishes"). Ticket cmnx4jvry set WAITING_CLIENT.

Note: the Program-doc creation itself (steps 1-3 above) is backend/DB-only and does NOT touch the website — could technically be staged now. But hold the whole thing per the client's request until they give the go-ahead, so nothing surfaces on their site mid-campaign. Resume trigger: client says campaign done.
