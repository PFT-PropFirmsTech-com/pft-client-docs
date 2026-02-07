# Codebase Concerns

**Analysis Date:** 2026-02-08

## Tech Debt

**Extremely Large Files (Maintainability Crisis):**
- Issue: Multiple files exceed 2000 lines, with some over 5000 lines, making them nearly impossible to maintain, test, or understand
- Files:
  - `pft-rule-checker/src/server.ts` (5233 lines)
  - `pft-backend/src/app/modules/Affiliate/affiliate.service.ts` (4921 lines)
  - `super-admin/app/projects/[projectId]/page.tsx` (3190 lines)
  - `pfr-super-admin/app/projects/[projectId]/page.tsx` (3150 lines)
  - `pft-dashboard/src/app/(dashboard)/admin/gamification/page.tsx` (2910 lines)
  - `pft-backend/src/app/modules/Payment/payment.service.modular.ts` (2739 lines)
  - `pft-backend/src/app/modules/Risk/detection.service.ts` (2605 lines)
  - `pft-backend/src/app/modules/User/user.service.ts` (2374 lines)
  - `pft-backend/src/app/modules/Auth/auth.service.ts` (2274 lines)
  - `pft-backend/src/app/modules/Withdrawals/withdrawal.service.ts` (2245 lines)
- Impact: High cognitive load, difficult debugging, merge conflicts, impossible to unit test effectively
- Fix approach: Extract into smaller, focused modules with single responsibilities (target: <300 lines per file)

**Silent Error Handling (Empty Catch Blocks):**
- Issue: Multiple empty catch blocks that swallow errors without logging or handling
- Files:
  - `pft-backend/src/app/services/broker/mt5.service.ts` (lines 956, 1006)
  - `pfr-super-admin/lib/mongodb-discovery.ts` (lines 90, 137)
  - `super-admin/lib/mongodb-discovery.ts` (lines 90, 137)
  - `pfr-super-admin/lib/models/User.ts` (line 79)
  - `pfr-super-admin/lib/models/ApiKey.ts` (line 134)
  - `pfr-super-admin/lib/models/Project.ts` (lines 110, 111, 123, 131, 139, 158)
  - `super-admin/lib/models/User.ts` (line 79)
  - `super-admin/lib/models/ApiKey.ts` (line 134)
  - `super-admin/lib/models/Project.ts` (lines 110, 111, 123, 131, 139, 158)
  - `pfr-super-admin/components/projects/EditProjectForm.tsx` (lines 87, 158)
  - `super-admin/components/projects/EditProjectForm.tsx` (lines 87, 158)
- Impact: Errors fail silently, making debugging impossible and hiding critical failures
- Fix approach: Add proper error logging and handling; use `.catch(() => {})` only for intentionally ignored errors with comments explaining why

**Type Safety Violations:**
- Issue: Widespread use of `any` type and TypeScript/ESLint suppressions
- Files:
  - `pft-backend/src/app.ts` (4 eslint-disable comments at top: no-undef, no-unused-vars, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any)
  - `pft-backend/src/app/services/broker/mt5.service.ts` (lines 3-4: @ts-ignore)
  - 50+ files with `any` type usage
  - 30+ hooks with `eslint-disable @typescript-eslint/no-explicit-any`
  - Multiple files with `@ts-ignore` comments
- Impact: Loss of type safety benefits, runtime errors that TypeScript should catch, harder refactoring
- Fix approach: Gradually replace `any` with proper types; remove suppressions and fix underlying issues

**Code Duplication:**
- Issue: `super-admin` and `pfr-super-admin` directories contain duplicated code with identical issues
- Files: Entire directory structures are duplicated
- Impact: Bug fixes must be applied twice, inconsistent behavior, wasted maintenance effort
- Fix approach: Extract shared code into a common package or consolidate into single admin interface

**Deprecated Code Still in Use:**
- Issue: Multiple deprecated functions and patterns still actively used
- Files:
  - `pft-backend/src/config/projectConfig.ts` (line 149: "@deprecated Use Super-Admin config instead")
  - `pft-dashboard/src/providers/IntercomProvider.tsx` (line 87: "Legacy HMAC hash (deprecated)")
  - `pft-dashboard/src/hooks/useIntercomSettings.ts` (line 92: "@deprecated Use useIntercomUserIdentity instead")
  - `pft-backend/src/app/modules/Intercom/intercom.service.ts` (line 215: "@deprecated Use generateUserJwt instead - HMAC is deprecated by Intercom")
  - `pft-rule-checker/src/app/services/rule-engine/ruleStateService.ts` (line 1793: "@deprecated Use archiveState instead")
  - `pft-rule-checker/src/app/services/cluster/ClusteredInstanceManager.ts` (line 972: "@deprecated Use forceAccountDiscovery() instead")
- Impact: Using deprecated APIs that may be removed, security vulnerabilities in old auth methods
- Fix approach: Migrate to recommended replacements; remove deprecated code paths

**DEBUG Code in Production:**
- Issue: Extensive debug logging and debug flags left in production code
- Files:
  - `pft-rule-checker/src/server.ts` (lines 1255, 1269, 1278, 2328, 2332, 2336, 2343, 3183, 3191, 3567)
  - `pft-rule-checker/src/app/services/broker/mt5-rest-client.ts` (line 13: `DEBUG_MT5_REST` flag)
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkTotalTrailingDrawdown.ts` (line 17: `DEBUG_TRAILING = true`)
  - `pft-rule-checker/src/app/services/socket/sdkEventReceiver.service.ts` (multiple DEBUG log statements)
  - `pft-rule-checker/src/app/services/socket/socketService.ts` (multiple DEBUG log statements)
  - `pft-rule-checker/src/app/services/ban/ImmediateBreachHandler.ts` (DEBUG log statements)
  - `pft-rule-checker/src/app/services/ban/accountAutoDisable.service.ts` (extensive DEBUG logging)
  - `pft-rule-checker/src/app/models/tradeHistory.service.ts` (line 70: `console.error` in production)
- Impact: Performance overhead, log pollution, potential information leakage
- Fix approach: Remove debug flags; use proper log levels; remove console.log statements

## Known Bugs

**Incomplete Implementations (TODO Comments):**
- `pft-backend/src/app/modules/Intercom/intercom.webhook.ts` (line 18):
  - Issue: "TODO: Re-enable strict verification once webhook is confirmed working"
  - Impact: Webhook security disabled, vulnerable to spoofed requests
  - Workaround: None - security feature disabled

- `pft-backend/src/app/modules/Contracts/contracts.service.ts` (line 754):
  - Issue: "TODO: Implement actual Adobe Acrobat Sign status check"
  - Impact: Contract status not properly synchronized with Adobe Sign
  - Workaround: Manual status checks required

- `pft-rule-checker/src/app/services/rule-engine/utils/programProgression.ts` (lines 1021, 1131):
  - Issue: "TODO: Add MT5 account disable functionality if needed"
  - Impact: Accounts may not be properly disabled during progression
  - Workaround: Manual intervention required

- `pft-backend/src/app/modules/Payment/services/paysagi.service.ts` (line 689):
  - Issue: "TODO: Add actual API test call to verify authentication"
  - Impact: Payment gateway authentication not properly validated
  - Workaround: None - may fail silently in production

**Documented Bug Fixes:**
- `pft-rule-checker/src/app/services/ban/ImmediateBreachHandler.ts` (line 638):
  - Issue: "CRITICAL BUG FIX: Only fetch RiskStateService evidence for equityHistory"
  - Symptoms: Previous implementation fetched incorrect data
  - Trigger: Breach detection events

- `pft-rule-checker/src/app/services/broker/websocket-stream-bridge.ts` (lines 15-20):
  - Issue: Multiple documented bug fixes:
    - "BUG #1: Now calls handleBreachImmediately instead of just logging"
    - "BUG #2: Uses public getRiskState() instead of accessing private riskStates"
    - "BUG #3: Uses updateEquityFromStream() which includes 20% sudden drop validation"
    - "BUG #4: Updates minEquityToday in accountRuleStates via GlobalBatchScheduler"
    - "BUG #5: Added processing lock to prevent race conditions"
  - Symptoms: Breaches not handled, race conditions, incorrect equity tracking
  - Trigger: Real-time trading events

## Security Considerations

**XSS Vulnerability (dangerouslySetInnerHTML):**
- Risk: User-controlled content rendered as HTML without sanitization
- Files:
  - `pft-dashboard/src/components/modules/CustomCodeInjector.tsx` (line 264)
  - `pft-dashboard/src/app/layout.tsx` (lines 317, 347, 357, 369, 400, 427, 439, 457)
  - `pft-dashboard/src/app/(dashboard)/admin/support/page.tsx` (line 231)
  - `pft-dashboard/src/app/(dashboard)/_components/modules/admin/email/LayoutForm.tsx` (lines 1579, 1581)
  - `pft-dashboard/src/app/(dashboard)/_components/modules/admin/email/layout-preview/EmailLayoutPreviewContainer.tsx` (lines 344, 399, 408)
  - `pfr-super-admin/components/ui/chart.tsx` (line 83)
  - `super-admin/components/ui/chart.tsx` (line 83)
- Current mitigation: Some files use DOMPurify (`isomorphic-dompurify` in dependencies)
- Recommendations: Ensure ALL dangerouslySetInnerHTML usage is sanitized with DOMPurify; add CSP headers; audit admin-only vs user-facing usage

**Webhook Verification Disabled:**
- Risk: Intercom webhooks accepted without signature verification
- Files: `pft-backend/src/app/modules/Intercom/intercom.webhook.ts` (line 18)
- Current mitigation: None - explicitly disabled with TODO comment
- Recommendations: Implement proper webhook signature verification immediately

**Environment Variable Exposure:**
- Risk: Process.env accessed directly without validation in 30+ locations
- Files: Extensive usage across `pft-backend/src/config/index.ts` and other config files
- Current mitigation: None - no validation layer
- Recommendations: Use Zod or similar to validate all environment variables at startup; fail fast on missing/invalid values

**Infinite Loop Risk:**
- Risk: `while(true)` loops without proper exit conditions
- Files: `pft-backend/src/app/services/broker/mt5.service.ts` (lines 364, 414, 812)
- Current mitigation: Unclear - needs code review
- Recommendations: Add timeout mechanisms, circuit breakers, and proper error handling

## Performance Bottlenecks

**Memory Leaks (setInterval without cleanup):**
- Problem: Multiple setInterval calls without corresponding clearInterval
- Files:
  - `pft-backend/src/server.ts` (lines 124, 149, 201, 237, 250, 275)
  - `pft-backend/src/app.ts` (line 176)
  - `pft-backend/src/app/modules/Analytics/analytics.service.ts` (line 46)
  - `pft-backend/src/app/modules/Risk/realtime-copy-detection.service.ts` (line 66)
  - `pft-backend/src/app/modules/Risk/risk-cron.service.ts` (lines 25, 39)
  - `super-admin/lib/auth.ts` (line 25)
  - `pfr-super-admin/lib/auth.ts` (line 25)
  - `super-admin/components/user/UserMenu.tsx` (line 266)
  - `pfr-super-admin/components/user/UserMenu.tsx` (line 266)
  - `pft-dashboard/src/app/api/config/stream/route.ts` (line 14)
  - `pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/Timer.tsx` (line 44)
  - `pft-dashboard/src/app/(dashboard)/_components/modules/users/programs-details/PayAfterPassBanner.tsx` (line 77)
- Cause: Intervals started but never cleaned up, especially in React components
- Improvement path: Add cleanup in useEffect return functions; use proper lifecycle management

**Regex in Loops:**
- Problem: Regex execution inside while loop
- Files: `pft-backend/src/app/services/broker/mt5.service.ts` (line 966: `while ((match = dealIdPattern.exec(jsonString)) !== null)`)
- Cause: Pattern matching on potentially large JSON strings
- Improvement path: Pre-parse JSON properly instead of regex; use streaming parser for large data

**Large File Complexity:**
- Problem: Files over 2000 lines likely contain complex, slow logic
- Files: See "Extremely Large Files" in Tech Debt section
- Cause: God objects, lack of separation of concerns
- Improvement path: Profile hot paths; extract and optimize critical sections

**Unoptimized Database Queries:**
- Problem: Some queries lack pagination or proper indexing
- Files: Multiple service files with `.find()` calls without limits
- Cause: Early implementation without performance consideration
- Improvement path: Add pagination to all list endpoints; review and add database indexes

## Fragile Areas

**Race Conditions (Documented Fixes):**
- Files:
  - `pft-rule-checker/src/app/services/socket/sdkEventReceiver.service.ts` (line 519: "FIX: Atomic check-and-set to prevent race condition in concurrent processing")
  - `pft-rule-checker/src/app/services/socket/sdkEventReceiver.service.ts` (line 758: "FIX: Atomic check-and-set to prevent race condition where two events")
  - `pft-rule-checker/src/app/services/socket/sdkEventReceiver.service.ts` (line 766: "Immediately mark as 'breach in progress' to prevent race condition")
  - `pft-rule-checker/src/app/services/socket/socketService.ts` (line 2133: "Use findOneAndUpdate with upsert to avoid race conditions")
  - `pft-rule-checker/src/app/services/ban/ban.service.ts` (line 50: "Use more precise query conditions to avoid race conditions")
  - `pft-rule-checker/src/app/services/ban/ban.service.ts` (line 473: "ATOMIC PRE-CHECK: Use database-level atomic operation to prevent race conditions")
  - `pft-rule-checker/src/app/services/ban/ban.service.ts` (line 554: "possible race condition or data inconsistency")
  - `pft-rule-checker/src/app/services/ban/ban.service.ts` (line 799: "Use atomic operation to prevent race conditions during program addition")
  - `pft-rule-checker/src/app/services/ban/ImmediateBreachHandler.ts` (line 360: "RACE CONDITION FIX: Check Redis FIRST (distributed), then in-memory as cache")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkDailyMaxDrawdown.ts` (line 201: "This prevents the race condition where a trader could breach and recover before first check")
  - `pft-rule-checker/src/app/services/rule-engine/snapshot-capture/daily-starting-balance.service.ts` (line 121: "Handle duplicate key error (race condition)")
- Why fragile: Multiple documented race condition fixes suggest this is an ongoing issue; concurrent trading events can trigger edge cases
- Safe modification: Always use atomic database operations; add distributed locks for critical sections; extensive testing with concurrent requests
- Test coverage: Likely insufficient for concurrency scenarios

**Memory Leak Concerns (Documented Fixes):**
- Files:
  - `pft-rule-checker/src/server.ts` (line 4901: "Hourly cleanup of expired cooldowns (prevents memory leaks)")
  - `pft-rule-checker/src/app/services/socket/sdkEventReceiver.service.ts` (line 272: "This shouldn't happen, but prevents memory leaks if there's an uncaught error")
  - `pft-rule-checker/src/app/services/socket/sdkEventReceiver.service.ts` (line 290: "FIX: Cap HWM cache size to prevent memory leaks (keep most recent 10k)")
  - `pft-rule-checker/src/app/services/socket/socketService.ts` (line 340: "Periodic cleanup of internal caches to prevent memory leaks")
  - `pft-rule-checker/src/app/services/ban/ImmediateBreachHandler.ts` (line 54: "MEMORY LEAK FIX: Time-based cleanup interval (every 5 minutes)")
  - `pft-rule-checker/src/app/services/ban/ImmediateBreachHandler.ts` (line 113: "This prevents the memory leak issue where locks were only cleaned")
  - `pft-rule-checker/src/app/services/rule-engine/RiskStateService.ts` (line 466: "Clean up empty symbol entries to prevent memory leak")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkTotalTrailingDrawdown.ts` (line 78: "MEMORY LEAK FIX: Cache cleanup configuration")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkTotalTrailingDrawdown.ts` (line 427: "MEMORY LEAK FIX: Always 'touch' the cache entry to prevent TTL expiration")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkLotSize.ts` (line 34: "Clean up old entries from warning times map to prevent memory leak")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkWeekendHolding.ts` (line 34: "Clean up old entries from warning times map to prevent memory leak")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkMandatoryTakeProfit.ts` (line 34: "Clean up old entries from warning times map to prevent memory leak")
  - `pft-rule-checker/src/app/services/rule-engine/rules/checkMandatoryStopLoss.ts` (line 33: "Clean up old entries from warning times map to prevent memory leak")
- Why fragile: Multiple memory leak fixes suggest unbounded cache growth is a recurring pattern
- Safe modification: Always implement cache size limits and TTL; monitor memory usage in production
- Test coverage: Memory leak testing likely absent

**Rule Checker Service (High Complexity):**
- Files: `pft-rule-checker/src/server.ts` (5233 lines), entire `pft-rule-checker/src/app/services/` directory
- Why fragile: Core trading rule engine with complex state management, real-time processing, and financial implications
- Safe modification: Extensive testing required; changes should be feature-flagged; monitor breach detection accuracy
- Test coverage: Unknown - likely insufficient given file size

## Scaling Limits

**In-Memory State Management:**
- Current capacity: Limited by single server memory
- Limit: `pft-rule-checker` uses in-memory caches that don't scale horizontally
- Scaling path: Migrate to Redis for shared state; implement proper distributed caching

**Monolithic Server Files:**
- Current capacity: Single 5000+ line server file
- Limit: Cannot split across multiple processes/containers easily
- Scaling path: Extract into microservices; implement proper service boundaries

**Database Query Performance:**
- Current capacity: Queries without pagination or indexes
- Limit: Will slow down as data grows
- Scaling path: Add indexes; implement pagination; consider read replicas

## Dependencies at Risk

**metaapi.cloud-sdk:**
- Version: 29.0.5 (used in multiple projects)
- Risk: External trading API dependency; version consistency across projects
- Impact: Trading functionality breaks if API changes
- Migration plan: Pin versions; implement adapter pattern to isolate SDK usage; monitor for breaking changes

**Outdated or Vulnerable Packages:**
- Risk: Some packages may have known vulnerabilities
- Impact: Security vulnerabilities, compatibility issues
- Migration plan: Run `npm audit`; update packages regularly; implement automated dependency scanning

## Missing Critical Features

**Comprehensive Error Tracking:**
- Problem: No centralized error tracking service detected
- Blocks: Difficult to diagnose production issues; no error aggregation or alerting
- Recommendation: Integrate Sentry, Rollbar, or similar service

**Proper Logging Infrastructure:**
- Problem: Mix of console.log and winston; no structured logging
- Blocks: Difficult to search logs; no log aggregation
- Recommendation: Standardize on winston with structured JSON logging; integrate with log aggregation service

**API Rate Limiting:**
- Problem: Limited rate limiting implementation detected
- Blocks: Vulnerable to abuse and DDoS
- Recommendation: Implement comprehensive rate limiting at API gateway level

**Request Validation:**
- Problem: Inconsistent input validation across endpoints
- Blocks: Potential for invalid data in database; security vulnerabilities
- Recommendation: Use Zod or similar for all API input validation

## Test Coverage Gaps

**Critical: Almost No Tests:**
- What's not tested: Entire codebase - only 1 test file found (excluding node_modules)
- Files: All production code
- Risk: Any change can break functionality unnoticed; no regression detection; impossible to refactor safely
- Priority: **CRITICAL** - This is a financial trading platform handling real money

**Specific Untested Areas:**
- **Trading Rule Engine:**
  - Files: `pft-rule-checker/src/app/services/rule-engine/` (entire directory)
  - Risk: Incorrect breach detection, financial losses, regulatory issues
  - Priority: **CRITICAL**

- **Payment Processing:**
  - Files: `pft-backend/src/app/modules/Payment/` (entire directory)
  - Risk: Payment failures, double charges, financial losses
  - Priority: **CRITICAL**

- **User Authentication:**
  - Files: `pft-backend/src/app/modules/Auth/` (entire directory)
  - Risk: Security breaches, unauthorized access
  - Priority: **CRITICAL**

- **Withdrawal Processing:**
  - Files: `pft-backend/src/app/modules/Withdrawals/` (entire directory)
  - Risk: Incorrect payouts, financial losses
  - Priority: **CRITICAL**

- **Affiliate System:**
  - Files: `pft-backend/src/app/modules/Affiliate/` (entire directory)
  - Risk: Incorrect commission calculations, fraud
  - Priority: **HIGH**

**Testing Infrastructure Needed:**
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Load tests for performance validation
- Security tests for vulnerability scanning

---

*Concerns audit: 2026-02-08*
