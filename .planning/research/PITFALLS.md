# Pitfalls Research

**Domain:** Public leaderboard + competition system on existing prop trading platform (Node.js + Next.js + MongoDB)
**Researched:** 2026-06-28
**Confidence:** HIGH — based on direct code inspection of existing leaderboard module + competition system design analysis

---

## Critical Pitfalls

### Pitfall 1: PII Leak via Public Leaderboard Endpoint — Email + Full Name Exposed

**What goes wrong:**
The existing `LeaderboardUser` interface carries `email`, `firstName`, and `lastName`. The `.populate("userId", "firstName lastName email programs")` in `leaderboard.service.ts` (line 120) pulls all three fields. The current routes are admin-only (`Auth(userRole.admin, userRole.backOffice)`), so the leak is contained for now. The moment a public-facing route is added without stripping PII from the response serializer, real emails and full names are visible to anonymous visitors.

**Why it happens:**
Developers add a public route by copying the existing controller without auditing what the populate projection returns. The interface was designed for admin consumption. There is no separate "public" DTO or serialization layer — the same object goes to the response.

**How to avoid:**
Create a `PublicLeaderboardTrader` DTO that contains only display-safe fields: a display name (first name + last initial OR a chosen handle), country flag (optional), account number masked. Never include `email`. Add a dedicated serializer function `toPublicDTO(trader: LeaderboardTrader)` called in the public controller. The admin route can keep the full object.

**Warning signs:**
- Public endpoint returns objects with an `email` field
- `user.email` visible in browser network tab on the public leaderboard page
- No separate public/admin controller split

**Phase to address:** Phase 1 (Public Leaderboard page — first milestone). This must be designed into the public route from day one. Retrofitting after launch requires a coordinated deploy + potential GDPR notification.

---

### Pitfall 2: Opt-Out Model with No Enforcement Mechanism

**What goes wrong:**
Planning an opt-out model (funded traders shown by default) without a database field to record the preference means the flag gets added late and without backfill. Existing funded accounts never see the opt-out prompt and are shown publicly forever. When the field is added later, the query `{ leaderboardOptOut: { $ne: true } }` silently includes everyone who predates the field (because `$ne: true` matches documents where the field is missing).

**Why it happens:**
The auth model has no `leaderboardOptOut` (or similar) field today. Teams ship the public page first, add the setting UI later, and assume the query is safe because missing = false. The `$ne: true` pattern is a MongoDB gotcha — it matches `null`, `undefined`, and missing keys.

**How to avoid:**
Add `leaderboardOptOut: { type: Boolean, default: false }` to `UserSchema` in the same PR that creates the public route. The correct query is `{ leaderboardOptOut: { $ne: true } }` which works correctly only after the field exists with a default. Alternatively, query `{ leaderboardOptOut: false }` explicitly — this excludes documents with missing fields, which is safer until a migration runs.

**Warning signs:**
- `leaderboardOptOut` field absent from User schema when public route is added
- No migration script in the PR that adds opt-out
- Dashboard settings page for leaderboard privacy not built in same phase

**Phase to address:** Phase 1 (Public Leaderboard). Schema migration must ship with the public endpoint.

---

### Pitfall 3: Competition Snapshot Isolation vs. Existing Cron (400-pair cap)

**What goes wrong:**
The existing `generateAndStoreLeaderboardData` cron caps at 400 pairs per run (`LEADERBOARD_MAX_PAIRS_PER_RUN`). If competition snapshots are piggybacked onto this same cron (or share the same Leaderboard collection), two problems arise: (a) the 400-pair cap truncates competition participants if the platform has more accounts, meaning some entrants are simply never scored; (b) the 15-minute refresh cycle means a competitor who surges in the last 5 minutes of a competition may not have their score recorded before the winner is determined.

**Why it happens:**
It is tempting to reuse `generateAndStoreLeaderboardData` for competition scoring because it already computes `valueGrowthPercentage`. Developers add a filter (`where competitionId = X`) and call it done. But the cap, the cycle time, and the shared upsert key (`userId + programId`) mean competition data and leaderboard data interfere.

**How to avoid:**
Store competition snapshots in a separate `CompetitionSnapshot` collection with its own cron or trigger. The competition cron should be event-driven at end-of-competition (not periodic). For final winner determination, always do a fresh on-demand MT5 fetch for all registered participants, not a cache read. Keep competition scoring code completely separate from the rolling leaderboard refresh.

**Warning signs:**
- Competition module imports `LeaderboardService.generateAndStoreLeaderboardData`
- Competition score queries the `Leaderboard` collection instead of a dedicated snapshot
- No on-demand "close competition" job that re-fetches all participant accounts

**Phase to address:** Phase 2 (Competition System). Architecture decision must be made before writing any competition scoring code.

---

### Pitfall 4: Race Condition in Competition Winner Determination

**What goes wrong:**
Two concurrent HTTP requests (admin manually closes competition + scheduled cron closes competition) both read the current leaderboard, both find the same top trader, both insert a `CompetitionWinner` document. Result: duplicate prize records, double notification, potentially double prize credit.

**Why it happens:**
Competition close is triggered by a cron at the end datetime AND by an admin "close now" button. No mutex or atomic operation prevents concurrent execution. MongoDB `findOneAndUpdate` with `upsert` is safe for idempotent updates but not for "first-write-wins" winner selection when two processes run simultaneously.

**How to avoid:**
Use an atomic MongoDB state transition: `Competition.findOneAndUpdate({ _id: competitionId, status: "ACTIVE" }, { $set: { status: "CLOSING" } })`. Only the process that successfully transitions from `ACTIVE` → `CLOSING` proceeds with winner selection. All others see the CAS miss and abort. After winners are recorded, transition to `CLOSED`. The cron and the admin button both use this same CAS pattern.

**Warning signs:**
- Competition close handler has no status check before writing winners
- No `status: "CLOSING"` intermediate state in the Competition model
- Admin "close" button and cron both call the same function without a lock

**Phase to address:** Phase 2 (Competition System). This is a data integrity requirement, not a nice-to-have.

---

### Pitfall 5: Mid-Competition Join Creates Unfair % Growth Baseline

**What goes wrong:**
If competition is ranked by % profit growth from competition start, a trader who joins 3 days in starts from their current balance as baseline. They then only need to grow from that point forward, effectively having a lower drawdown risk relative to someone who competed from day 1 and may have had a bad first day. Alternatively, if the competition snapshots their balance at join time and computes growth from then, a trader can game this by waiting for a market dip and joining when their account is temporarily lower, giving them an artificially high % growth baseline.

**Why it happens:**
Growth % = (current balance - baseline) / baseline. The baseline is ambiguous: competition start, account creation, or join time. Teams default to "join time" because it is simplest to implement. The exploit is not obvious until a player discovers it.

**How to avoid:**
Lock the baseline at competition registration time and enforce a registration deadline (e.g., competition starts Monday, registration closes Monday 00:00 UTC). Snapshot the balance at the registration deadline for all registrants simultaneously. Late registrations are rejected, not accommodated with a shifted baseline. This removes the gaming vector entirely.

**Warning signs:**
- Competition schema has no `registrationDeadline` field separate from `startDate`
- Baseline snapshot is taken per-user at their individual join time
- No validation that prevents registration after competition start

**Phase to address:** Phase 2 (Competition System — registration and baseline logic).

---

### Pitfall 6: Banned/Violated Account Remains on Leaderboard During Competition

**What goes wrong:**
A trader gets banned mid-competition for a rule violation. Their position is frozen in the leaderboard (because the cron stops updating banned accounts — see `generateAndStoreLeaderboardData` line 883: it skips `banned` and `closed` accountType). However, if the competition winner was already determined using a cached snapshot from before the ban, the banned trader wins. Alternatively, if the competition is still running and banned accounts are not explicitly excluded from competition queries, they appear in the ranking.

**Why it happens:**
The leaderboard cron already excludes banned accounts from refreshes. But competition snapshots may be point-in-time. If a snapshot was taken at T=0 showing the trader as ACTIVE, and the ban happens at T=1, the snapshot at T=0 still shows them as the winner at competition close. There is no re-validation step.

**How to avoid:**
At competition close (winner determination step), re-validate every potential winner's current account status against the live User document before recording them as winner. If `programs[n].accountType === "banned"` or `user.isBanned === true` at the moment of closing, disqualify them. This must be part of the CAS close sequence, not an afterthought.

**Warning signs:**
- Winner selection query only looks at CompetitionSnapshot data, never re-queries User
- No disqualification field on CompetitionParticipant model
- Test cases don't cover "ban during active competition" scenario

**Phase to address:** Phase 2 (Competition System — winner determination).

---

### Pitfall 7: Per-Brand Isolation Absent from Leaderboard Collection

**What goes wrong:**
The existing `Leaderboard` model has no `brandId` field. Per-brand databases are used (each white-label has its own MongoDB), so within a single brand's DB, cross-brand leakage is not currently possible. But if competition system adds a shared admin view or if a future consolidation merges databases, the absence of a `brandId` field is a time bomb. More immediately: if the multi-brand backend ever shares a MongoDB instance (staging environments often do), all brands' leaderboard data is commingled.

**Why it happens:**
Per-brand DB isolation is assumed to provide brand separation at the infrastructure level. Developers don't add a `brandId` field because "each DB is already brand-specific." The risk is in shared environments (staging, demos) and in future architectural changes.

**How to avoid:**
Add `brandId` to both `Leaderboard` and any new `Competition`/`CompetitionSnapshot` models as a required indexed field, even if the current architecture makes it redundant. This is a zero-cost insurance policy. Index it: `{ brandId: 1, userId: 1, programId: 1 }`. Public API routes must filter by `brandId` derived from the request domain, not from a user-supplied query param.

**Warning signs:**
- `Leaderboard` model has no `brandId` field
- Public leaderboard API accepts `brandId` as a query param (IDOR risk)
- Competition creation does not record which brand it belongs to

**Phase to address:** Phase 1 (Public Leaderboard schema) and Phase 2 (Competition schema).

---

### Pitfall 8: getTradesByAccountId Returns Full Trade History Without Auth on Public Leaderboard

**What goes wrong:**
`GET /leaderboard/trades/:mt5AccountId` is currently admin-only. If this endpoint is made public (or a similar "view this trader's trades" feature is added to the public competition page), it exposes complete trade history — instrument names, lot sizes, entry/exit times, profit amounts — for any account number an anonymous user guesses. MT5 account IDs are numeric and sequential; enumeration is trivial.

**Why it happens:**
The endpoint was designed for admin review. When building the public "trader profile" feature, developers copy the route and remove the auth middleware to make it accessible, not realizing the trade data reveals proprietary trading strategies.

**How to avoid:**
Public trade history views must require the trader to have explicitly enabled "public profile." Gate on `user.leaderboardPublicProfile === true`. Even then, consider exposing only aggregated stats (win rate, trade count, profit curve) rather than individual trade records. Never make raw trade records public by default.

**Warning signs:**
- `/trades/:mt5AccountId` route loses the `Auth()` middleware
- No `publicProfile` opt-in flag on the User model
- Competition "leaderboard" page links to individual trade histories without a privacy gate

**Phase to address:** Phase 1 if public trade views are in scope; otherwise Phase 2 (Trader Profiles).

---

### Pitfall 9: Floating PL Randomization in Fallback Metrics

**What goes wrong:**
`calculatePerformanceMetricsFromTrades` (leaderboard.service.ts line 647) contains `const floatingPL = Math.random() * 200 - 100`. This means every time the MT5 fallback path runs, the `floatingPL` and consequently `equity` values for that account are random. On the public leaderboard, this produces flickering equity values across page refreshes. In a competition ranked by equity, it produces non-deterministic rankings.

**Why it happens:**
The comment says "Mock floating PL (in real implementation, this would come from open positions)." This was scaffolding code that was never replaced. It survived into production because the MT5 primary path is usually used; the fallback only triggers during MT5 outages.

**How to avoid:**
Replace the random value with `0` or omit `floatingPL` from the fallback entirely. Do not expose `equity` as a competition ranking metric if it relies on this fallback — use `balance` (which is deterministic from trade history) instead. File a code cleanup ticket for this immediately as it is a pre-existing bug that will surface visibly once leaderboard is public.

**Warning signs:**
- `equity` values change between requests for the same account during MT5 downtime
- Competition rankings shuffle without any trades occurring
- `floatingPL` field shows values like 47.3, -82.1, 103.7 (not round numbers) on the public page

**Phase to address:** Phase 0 / pre-work (fix before any public leaderboard launch). This is a bug in existing code, not a new pitfall.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `Leaderboard` collection for competition snapshots | Faster build, no new schema | Cron cap truncates competition; cron refresh overwrites competition state | Never — competition needs immutable point-in-time snapshots |
| Opt-out as default without schema migration | Skip migration work | Existing users permanently included even if they would have opted out | Never — add schema field in same PR as public route |
| Inline `Math.random()` for floatingPL fallback | Silences TypeScript error | Non-deterministic rankings, visible flickering on public page | Never in a public-facing metric |
| Brand isolation via DB-per-brand with no `brandId` field | Simpler model | Breaks in shared envs; blocks future consolidation | Low risk now, add field anyway as insurance |
| Copy admin leaderboard controller for public route | Fast | PII in public response | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MT5 account info in competition close | Call MT5 socket directly from the close job | Use `MT5WorkerProxyService` (consistent with existing cron pattern); socket is not available on API workers |
| Competition winner notifications (email) | Send email inline in the close transaction | Queue via existing notification system; never block the CAS close with email I/O |
| Prize credit (XP or cash) | Grant prize in same transaction as winner selection | Idempotent separate step after winner is persisted; wrap in try/catch so a failed payout does not roll back the winner record |
| Public leaderboard caching | Set a long TTL to reduce DB load | Short TTL (45–90s) is correct; long TTL (5m+) means banned accounts remain visible after action is taken |
| Leaderboard search by name | Search against User collection, return IDs, then filter Leaderboard | Current pattern is correct; do not move name search to in-memory post-fetch |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-request MT5 socket call on public leaderboard | Public page load takes 5–30s; MT5 connection pool exhausted | Serve only from precomputed `Leaderboard` collection; never call MT5 on a public GET | Any meaningful traffic (>10 concurrent users) |
| `getLeaderboardStats` cursor scan of entire Leaderboard collection | Stats endpoint slow; memory spikes on large datasets | Add a dedicated stats document or use `$group` aggregation with a stored result; replace the in-memory cursor loop | ~10k Leaderboard entries |
| No index on `Leaderboard.status + programId` | Filter queries do full collection scan | Add compound index `{ status: 1, programId: 1, "performance.valueGrowthPercentage": -1 }` | ~5k entries |
| Competition snapshot on competition close fetches all participants serially | Close job takes minutes for 1k+ participant competitions | Batch parallel MT5 fetches (20 at a time, consistent with existing `BATCH_SIZE = 20` pattern) | >200 competition participants |
| Weekly leaderboard `getWeeklyLeaderboard` fetches 100 traders + unique-filters in application memory | Correct now at small scale | At 10k entries, this in-memory dedup should be pushed to a MongoDB aggregation with `$group by userId` | ~1k weekly participants |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public leaderboard route accepts `brandId` as query param | Any user can view any brand's leaderboard (IDOR) | Derive `brandId` from request hostname/subdomain, never from client-supplied param |
| MT5 account ID enumeration via public trades endpoint | Competitors can map all active accounts, size positions, infer strategies | Require opt-in `publicProfile` flag; never expose raw trade records by default |
| Competition registration accepts any `programId` without ownership check | User registers a competitor's account in the competition | Validate that the `programId` belongs to `req.user._id` before accepting registration |
| `search` param in leaderboard passes email regex to MongoDB | Leaderboard search can be abused to confirm whether an email address is a customer | On the public route, limit search to display name only; never search by email on public endpoint |
| Competition prize amount stored as user-supplied input without cap | Admin sets prize to `$999999`; payout system sends it | Validate prize amount against configured limits in brand settings |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Leaderboard shows `VIOLATED` and `BANNED` accounts by default | Confusing; traders see disqualified accounts above them | Default filter to `ACTIVE` only on public view; show disqualified accounts only in admin view |
| Competition countdown timer uses server time but client renders with local time | Timer shows wrong end time in non-UTC timezones | Store all competition times as UTC; send UTC ISO strings; render countdown in client's local timezone explicitly |
| Opt-out confirmation is buried in account settings | Traders who want privacy miss it; anger when they find out they were public | Show opt-out prompt during KYC completion flow AND when a trader first qualifies for funded status |
| Winner announcement email sent before prize is confirmed credited | Trader expects prize, prize job failed silently | Send "you won" notification only after prize record is durably written; separate from the payout confirmation email |
| Competition rank shown as "live" when it is 15 minutes stale | Traders think rank updates in real-time; make decisions based on stale data | Show `Last updated: X minutes ago` timestamp prominently; consider a "request refresh" button for own account during last hour of competition |

---

## "Looks Done But Isn't" Checklist

- [ ] **Public leaderboard privacy:** Verify no `email` field appears in the public API response — inspect the raw JSON, not just the UI
- [ ] **Opt-out enforcement:** Confirm `leaderboardOptOut: false` (not `$ne: true`) is the query used until migration confirms all documents have the field
- [ ] **Competition CAS close:** Verify a second concurrent call to close the same competition returns a no-op, not a duplicate winner record
- [ ] **Banned account disqualification:** Test scenario: trader is #1 at T-1h, gets banned at T-30m, competition closes at T=0 — verify they are not the winner
- [ ] **floatingPL randomization removed:** Check fallback path in `calculatePerformanceMetricsFromTrades` before any public launch
- [ ] **Brand isolation on competition:** Confirm competition create/read/close routes filter by derived brandId, not user-supplied
- [ ] **Registration deadline enforced:** Verify API rejects registration submitted after `registrationDeadline` with a 400, not silently accepting it
- [ ] **MT5 worker proxy used:** Confirm competition close job uses `MT5WorkerProxyService`, not direct `mt5Service` socket calls

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PII leak discovered post-launch | HIGH | Rotate affected data, notify users per GDPR Article 33 (72h window), strip field from API immediately, audit logs for access |
| Double winner recorded | MEDIUM | Add `competitionWinnerId` unique index to prevent duplicates going forward; backfill by deleting the duplicate winner doc (keep earliest `createdAt`); re-send corrected notification |
| Competition closed with banned trader as winner | MEDIUM | Admin "disqualify and re-run" tool: mark winner as disqualified, promote next eligible trader, re-send notifications |
| floatingPL randomization causes wrong competition outcome | HIGH | Requires re-running competition close with corrected metrics; if prizes already paid, dispute resolution needed; cannot be automated |
| Opt-out field missing, all users shown publicly | MEDIUM | Emergency deploy adding field with `default: false`; mass-email notifying users of leaderboard and opt-out option |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| PII in public response | Phase 1 — Public Leaderboard | Integration test: anonymous GET /leaderboard returns no `email` field anywhere in response tree |
| Opt-out model without schema enforcement | Phase 1 — Public Leaderboard | Schema review: `leaderboardOptOut` field present before route ships |
| floatingPL randomization | Phase 0 — Pre-work (bug fix) | Unit test: fallback metrics returns deterministic values |
| Competition cron isolation | Phase 2 — Competition Architecture | Code review: no Competition code calls `generateAndStoreLeaderboardData` |
| Race condition in winner determination | Phase 2 — Competition Close Logic | Concurrency test: two simultaneous close calls produce exactly one winner record |
| Mid-competition join baseline gaming | Phase 2 — Competition Registration | Integration test: registration after deadline returns 400 |
| Banned account winning | Phase 2 — Winner Determination | Test: ban a #1 trader before close; verify #2 wins |
| Brand isolation absent | Phase 1 + Phase 2 — Schema | Schema review: `brandId` field on Leaderboard + Competition models |
| Trade history IDOR on public route | Phase 1 (if public trades in scope) | Auth test: unauthenticated GET /leaderboard/trades/:id returns 401 |
| Per-brand competition contamination | Phase 2 — Competition API | Integration test: competition from Brand A not visible in Brand B API response |

---

## Sources

- Direct code inspection: `/pft-backend/src/app/modules/Leaderboard/leaderboard.service.ts` — floating PL randomization (line 647), batch cap (line 847), upsert key (lines 956–957)
- Direct code inspection: `/pft-backend/src/app/modules/Leaderboard/leaderboard.routes.ts` — admin-only auth gates; no public routes yet
- Direct code inspection: `/pft-backend/src/app/modules/Leaderboard/leaderboard.interface.ts` — `LeaderboardUser` carries `email` field
- Direct code inspection: `/pft-backend/src/app/modules/Leaderboard/leaderboard.model.ts` — no `brandId` field confirmed
- Project memory: per-brand databases (`reference_per_brand_databases.md`), IDOR user delete precedent (`project_idor_user_delete.md`)
- Project memory: PAP double XP bug pattern — prize grant idempotency lesson (`project_pap_double_xp_bug.md`)

---
*Pitfalls research for: public leaderboard + competition system on PFT WhiteLabel prop trading platform*
*Researched: 2026-06-28*
