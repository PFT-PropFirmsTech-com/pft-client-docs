# Feature Research

**Domain:** Public leaderboard + monthly competition system for prop trading platforms
**Researched:** 2026-06-28
**Confidence:** MEDIUM (industry patterns HIGH confidence; specific competitor UI details MEDIUM — direct scraping blocked, validated via multiple secondary sources)

---

## Context: What's Already Built

The following exist and must NOT be rebuilt — only extended:

- `LeaderboardTable`, `LeaderboardStats`, `LeaderboardPagination`, `LeaderboardSearchAndSort`, `LeaderboardViewToggle`, `WeeklyPrizeWinners` components (admin-only)
- `LeaderboardHeader`, `LeaderboardContainer` (admin shell)
- Backend: precomputed `Leaderboard` collection, cron refresh, routes at `/leaderboard` (admin/backOffice auth only)
- Data model: rank, globalRank, profitPercentage, valueGrowthPercentage, winRate, profitFactor, totalProfit, maxDrawdown, tradingDays, accountAge per MT5 account

New work is: (1) public-facing version of leaderboard, (2) monthly competition system with admin creation, auto-enrollment, prize pool, opt-out.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every competing prop firm has. Missing = product looks unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public leaderboard page (no login required) | FXIFY, FTMO, FundingPips all have public-facing leaderboards; traders share links on social | LOW | Route `/leaderboard` must be accessible without auth; reuse existing LeaderboardTable component |
| Anonymous display for non-logged-in visitors | Industry standard — show initials or "Trader #1234", never full name/email to unauthenticated users | LOW | Backend: strip firstName/lastName/email from public API response; show avatar initials only |
| Full name visible after login | Traders want to know who they're competing against after they authenticate | LOW | Same API endpoint, auth token unlocks full name field |
| Rank + profit % as primary displayed metric | Profit percentage is the universal ranking metric across FXIFY, FundingPips, FTMO, FundedNext | LOW | Already in data model as `valueGrowthPercentage`; already shown in LeaderboardTable |
| Timeframe filter (monthly / all-time) | Competitions run monthly; traders expect to filter to see current month standings | MEDIUM | `LeaderboardFilters.timeframe` exists in interface but needs public-facing UI wiring |
| Competition countdown timer | FundedNext, FundingPips both show prominent countdown to competition end; creates urgency | LOW | Frontend only — calculate from competition `endDate` |
| Past winners / hall of fame | Industry standard; shows the firm pays out, builds social proof | MEDIUM | New collection or embedded in competition doc; reuse WeeklyPrizeWinners pattern |
| Prize pool display | All prop firm competition pages lead with prize pool size prominently | LOW | Admin-configured field; display on competition hero section |
| Trader opt-out from public leaderboard | Privacy expectation; some firms offer this; GDPR-relevant for EU traders | MEDIUM | User preference flag; if opted out, entry not returned in public API |

### Differentiators (Competitive Advantage)

Features beyond baseline that create engagement and retention.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Your rank" highlighted when logged in | FundedNext does this — logged-in trader sees their own row highlighted/pinned | MEDIUM | Requires matching auth user to leaderboard entry by userId; scroll-to or pin at top |
| Competition-specific leaderboard (separate from all-time) | FundingPips runs competitions on a dedicated portal; cleaner UX than mixing competition vs ongoing | MEDIUM | Competition has its own snapshot of participants + rankings; not the live precomputed leaderboard |
| Multiple concurrent competitions per brand | White-label brands may want different competitions for different program types (1-step vs 2-step) | HIGH | Competition schema needs `programFilter` field; enrollment query filters by program type |
| Tiered prize structure (top 3 + random lottery for 4-100) | FundedNext's lottery mechanic for mid-table traders dramatically increases engagement; more traders feel they can win | HIGH | Needs random selection logic, verifiable seed, prize type enum (cash / funded account / evaluation) |
| Admin competition management UI | Admins need to create, edit, start, end, and manually award competitions without code deploys | HIGH | New admin section; competition CRUD; trigger manual finalization; override winner |
| Per-brand competition config | White-label requirement: each brand has independent competitions, prize pools, enrollment rules | MEDIUM | Competition doc scoped to `brandId`; consistent with per-brand DB architecture |
| Competition history page | Shows credibility — FTMO, FundedNext all surface historical results with winner names and amounts | LOW | Simple list of past competitions with winner rows; reuse table components |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time leaderboard updates (sub-minute) | Feels dynamic and exciting | MT5 data pipeline is cron-based (precomputed collection); sub-minute polling would require full streaming refactor; high infra cost for marginal UX gain | Cache at 45–60s (already implemented); show "last updated" timestamp so traders understand cadence |
| Showing all trader stats publicly (drawdown, trade history, balance) | More transparency = more trust | Email is PII; balance reveals account size which traders treat as private; GDPR concerns for EU traders | Show: rank, initials/avatar, profit %, win rate, trading days. Hide: email, MT5 account ID, exact balance, full name (unless logged in) |
| Self-enrollment (opt-in) competition model | Seems fairer — only committed traders enter | Dramatically lowers participation numbers (most traders won't bother); empty leaderboard kills social proof | Opt-out model: all eligible funded traders auto-enrolled; opt-out via profile setting. Matches FundingPips/FXIFY approach |
| Separate competition MT5 accounts | FundingPips runs competitions on dedicated MatchTrader instances; clean separation | Requires provisioning separate MT5 logins per competition; massive ops complexity for white-label | Use existing funded accounts, filter by enrollment period; rank by % growth from competition start date |
| Publicly displaying MT5 account IDs | Some platforms show account numbers | MT5 account ID leaks account existence; combines with rank to reveal account size tier | Show account size tier label ("$100K Account") not raw MT5 login number |

---

## Feature Dependencies

```
[Public leaderboard page]
    └──requires──> [Public API endpoint (no auth)]
                       └──requires──> [Data masking layer (strip PII for anonymous)]

[Competition leaderboard]
    └──requires──> [Competition data model (MongoDB)]
                       └──requires──> [Admin competition CRUD]

[Your rank highlight]
    └──requires──> [Public leaderboard page]
    └──requires──> [Auth check on public page]

[Opt-out preference]
    └──requires──> [User profile setting]
    └──requires──> [Public API respects opt-out flag]

[Competition auto-enrollment]
    └──requires──> [Competition data model]
    └──requires──> [Eligible-trader query logic]

[Competition finalization + prize award]
    └──requires──> [Competition auto-enrollment]
    └──requires──> [Admin competition management UI]

[Past winners / hall of fame]
    └──requires──> [Competition finalization stores winner snapshot]

[Tiered lottery prizes]
    └──requires──> [Competition finalization]
    └──enhances──> [Past winners page (publishable RNG proof)]
```

### Dependency Notes

- **Public API requires data masking:** The existing leaderboard routes are auth-gated (`Auth(userRole.admin, userRole.backOffice)`). A new public route must be added that returns the same data structure but with PII fields stripped or masked. Do not remove auth from existing admin routes.
- **Competition leaderboard is NOT the live precomputed leaderboard:** Competition rankings are a snapshot — profit % growth measured from competition `startDate`, not all-time. Needs separate computation or a filtered view using leaderboard snapshots taken at competition start.
- **Opt-out requires user model change:** A `leaderboardOptOut: boolean` field on the User document, respected in both the public and competition enrollment queries.

---

## MVP Definition

### Launch With (v1)

Minimum to have a working public leaderboard + competition system.

- [ ] Public leaderboard API endpoint — anonymous access, PII stripped, returns rank/initials/profit%/winRate/tradingDays
- [ ] Public leaderboard page — `/leaderboard` route, no auth wall, reuses LeaderboardTable with masked data mode
- [ ] Logged-in name reveal — auth check on public page unlocks full name, highlights own row
- [ ] Trader opt-out preference — `leaderboardOptOut` flag on User, profile UI toggle, respected in public API
- [ ] Competition data model — MongoDB schema: name, brandId, startDate, endDate, prizePool, status, enrolledTraders[], winners[]
- [ ] Admin competition creation — form to create competition (name, dates, prize pool, eligible program types)
- [ ] Auto-enrollment cron/trigger — when competition starts, enroll all funded traders matching program filter who haven't opted out
- [ ] Competition leaderboard — ranked by % profit growth from competition startDate; separate endpoint `/competitions/:id/leaderboard`
- [ ] Competition public page — hero (prize pool + countdown), leaderboard table, "Your rank" if logged in
- [ ] Competition finalization — admin triggers end; snapshots top N winners; stores result

### Add After Validation (v1.x)

- [ ] Competition history page — list of past competitions with winners; adds social proof
- [ ] Past winners "hall of fame" on main leaderboard — reuse/extend WeeklyPrizeWinners pattern
- [ ] Multiple active competitions per brand — UI to list/switch; schema already supports it if brandId-scoped
- [ ] Timeframe filter on public leaderboard — "This Month" / "All Time" tabs

### Future Consideration (v2+)

- [ ] Tiered lottery prize mechanic — significant complexity (RNG, proof-of-fairness, prize type enum); high engagement upside but needs product validation first
- [ ] Competition notification emails — "Competition started", "You're in top 10", "Competition ends in 24h"
- [ ] Social share card — trader-specific OG image showing rank + profit %; requires image generation service
- [ ] Leaderboard embed iFrame — for brands to embed on their marketing site; low demand until brands request it

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Public leaderboard page (anonymous) | HIGH | LOW (reuse existing components + new API) | P1 |
| PII masking on public API | HIGH | LOW | P1 |
| Logged-in name reveal + self-highlight | HIGH | LOW | P1 |
| Trader opt-out | MEDIUM | LOW | P1 |
| Competition data model + admin creation | HIGH | MEDIUM | P1 |
| Auto-enrollment | HIGH | MEDIUM | P1 |
| Competition leaderboard (% growth from start) | HIGH | MEDIUM | P1 |
| Competition public page | HIGH | MEDIUM | P1 |
| Competition finalization + winner snapshot | HIGH | MEDIUM | P1 |
| Competition history page | MEDIUM | LOW | P2 |
| Hall of fame on main leaderboard | MEDIUM | LOW | P2 |
| Timeframe filter on public leaderboard | MEDIUM | MEDIUM | P2 |
| Multiple competitions per brand | LOW | MEDIUM | P2 |
| Tiered lottery prizes | MEDIUM | HIGH | P3 |
| Competition email notifications | MEDIUM | HIGH | P3 |
| Social share card | LOW | HIGH | P3 |

---

## Public vs. Private Data Matrix

Critical design decision: what to show at each auth level.

| Data Field | Unauthenticated | Logged In (Own Entry) | Logged In (Others) | Admin |
|------------|-----------------|----------------------|-------------------|-------|
| Rank | Yes | Yes | Yes | Yes |
| Avatar initials | Yes | Yes | Yes | Yes |
| Full name | No | Yes | Yes | Yes |
| Email | No | Yes | No | Yes |
| MT5 account ID | No | Yes | No | Yes |
| Profit % growth | Yes | Yes | Yes | Yes |
| Win rate | Yes | Yes | Yes | Yes |
| Trading days | Yes | Yes | Yes | Yes |
| Account size tier label | Yes | Yes | Yes | Yes |
| Exact balance/equity | No | Yes | No | Yes |
| Max drawdown | Yes (%) | Yes | Yes | Yes |
| Program type label | Yes | Yes | Yes | Yes |

---

## Competitor Feature Analysis

| Feature | FXIFY | FundingPips | FundedNext | Our Approach |
|---------|-------|-------------|------------|--------------|
| Public leaderboard | Yes (no login needed) | Yes (blog posts confirm; live page 403'd) | Yes (real-time updates) | Yes — new public route, mask PII |
| Competition format | Monthly, top 12 win funded accounts | Monthly, MatchTrader separate instance, top 20 + prizes | 30-day sprint, top 3 cash+funded, 4-100 lottery | Monthly, use existing funded accounts, % growth from start date |
| Ranking metric | Leaderboard performance (profit %) | Profit % (MatchTrader computed) | Live equity / profit % | `valueGrowthPercentage` (already computed) |
| Prize type | Free challenge accounts up to $400K | Cash + funded account evaluations | Cash + funded accounts | Admin-configured; store as prize description string for v1 |
| Opt-out | Unknown (blocked) | Unknown (blocked) | Implied opt-in model | Opt-out model (auto-enrolled, can opt out) |
| Auth gate | Public (no login for rankings) | Public | Login shows personal rank | Public page, login reveals own rank highlight |
| Historical results | Unknown | Blog posts | Yes (monthly stats table) | Yes — v1.x competition history page |

---

## Sources

- [FundedNext Competition page](https://fundednext.com/competition) — HIGH confidence, page loaded fully; confirms real-time leaderboard, public prize structure, login for personal rank
- [FundingPips 30-Day Sprint blog](https://www.fundingpips.com/en/blog/the-30-day-sprint-climb-the-leaderboard-claim-your-reward) — MEDIUM confidence (403 on main leaderboard page; blog accessible)
- [FXIFY $1M competition announcement](https://thegodfunded.com/en/news/fxify-unveils-1m-monthly-trading-competition) — MEDIUM confidence via third-party news
- [GrowYourPropFirm competition guide](https://www.growyourpropfirm.com/prop-firms-trading-competitions) — MEDIUM confidence (aggregator, consistent with primary sources)
- [PropFunding.com leaderboard metrics guide](https://blog.propfunding.com/funded-trader-leaderboard-what-it-tracks-why-it-matters-and-how-prop-firms-use-rankings/) — MEDIUM confidence
- [VerticalWise leaderboard operator guide](https://www.verticalwise.com/how-trader-leaderboards-help-prop-firms-grow-and-why-operators-are-adding-them/) — MEDIUM confidence
- Existing codebase: `leaderboard.interface.ts`, `leaderboard.model.ts`, `leaderboard.routes.ts`, `LeaderboardTable.tsx` — HIGH confidence (source of truth for what's built)

---
*Feature research for: Public leaderboard + monthly competition system (prop trading platform)*
*Researched: 2026-06-28*
