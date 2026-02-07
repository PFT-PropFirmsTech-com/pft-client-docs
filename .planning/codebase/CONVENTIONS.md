# Coding Conventions

**Analysis Date:** 2026-02-08

## Naming Patterns

**Files:**
- Types: kebab-case with `.types.ts` suffix - `user-management.types.ts`, `sales.types.ts`, `contract.types.ts`
- Components: PascalCase - `SidebarGroup.tsx`, `MobileSidebarBackdrop.tsx`, `DailyLoginTracker.tsx`
- Hooks: camelCase with `use` prefix - `useAuth.ts`, `useAccountDisableQueue.ts`, `usePrograms.ts`
- Module files: camelCase with dot notation - `statistics.service.ts`, `statistics.controller.ts`, `statistics.validation.ts`, `statistics.interface.ts`, `statistics.routes.ts`
- Utilities: camelCase - `catchAsync.ts`, `sendResponse.ts`, `logger.ts`
- Middleware: camelCase - `globalErrorhandler.ts`, `validateRequest.ts`, `auth.ts`

**Functions:**
- camelCase for regular functions - `getDeviceId()`, `setAuthData()`, `calculatePerformanceMetrics()`
- PascalCase for React components - `SidebarGroup`, `SidebarSubmenu`

**Variables:**
- camelCase for local variables - `loginId`, `programId`, `tradeHistory`
- SCREAMING_SNAKE_CASE for constants - `CACHE_DURATION_MS`, `MAX_CACHE_ENTRIES`, `CLEANUP_INTERVAL_MS`

**Types:**
- PascalCase for interfaces and types - `TradeHistoryQuery`, `StatisticsFilters`, `AuthResponse`, `User`
- Prefix with `T` for generic types - `TResponse<T>`, `TMeta`, `TErrorSources`

**Directories:**
- PascalCase for module directories - `Statistics/`, `WaitListEmails/`, `Auth/`, `TradeHistory/`
- lowercase for utility directories - `utils/`, `config/`, `middlewares/`, `errors/`

## Code Style

**Formatting:**
- Tool: Biome (pft-dashboard), Prettier (pft-backend)
- Indent: spaces (configured in biome.json)
- Quote style: double quotes (configured in biome.json)
- Line endings: LF
- Trailing commas: enabled

**Linting:**
- pft-dashboard: Biome + ESLint
  - Config: `biome.json`, `eslint.config.mjs`
  - Key rules disabled: `noUnusedVariables`, `noImgElement`, accessibility rules
- pft-backend: ESLint
  - Config: `eslint.config.mjs`
  - Key rules: `@typescript-eslint/no-unused-vars` as warning, `no-explicit-any` disabled
  - Unused parameters with underscore prefix ignored: `argsIgnorePattern: "^_"`

**TypeScript:**
- Strict mode enabled across all projects
- Target: ES2017 (dashboard), ES2021 (backend)
- Module: ESNext (dashboard), CommonJS (backend)
- Path aliases: `@/*` maps to `./src/*` (dashboard only)

## Import Organization

**Order:**
1. External dependencies (React, Express, third-party packages)
2. Internal absolute imports using path aliases (`@/lib`, `@/types`)
3. Relative imports (`./`, `../`)
4. Type imports (when separated)

**Example from dashboard:**
```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { ENDPOINTS } from "@/lib/api/config";
import type { User } from "@/types/user.types";
import apiClient, { isTokenExpired } from "@/lib/api/client";
import { useRouter } from "next/navigation";
```

**Example from backend:**
```typescript
import { Request, Response } from "express";
import httpStatus from "http-status";
import { StatisticsService } from "./statistics.service";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../errors/AppError";
```

**Path Aliases:**
- Dashboard: `@/*` → `./src/*`
- Backend: No path aliases (relative imports only)

**Import Organization:**
- Biome auto-organizes imports in dashboard (enabled in biome.json)
- Manual organization in backend

## Error Handling

**Backend Pattern:**
- Custom `AppError` class extends `Error` with `statusCode` property
- Location: `pft-backend/src/app/errors/AppError.ts`
- Usage: `throw new AppError(httpStatus.BAD_REQUEST, "Error message")`

**Global Error Handler:**
- Location: `pft-backend/src/app/middlewares/globalErrorhandler.ts`
- Handles: ZodError, ValidationError, CastError, MongoDB duplicate errors, AppError
- Returns structured response:
```typescript
{
  success: false,
  message: string,
  errorSources: Array<{ path: string, message: string }>,
  stack: string | null  // Only in development
}
```

**Error Handler Helpers:**
- `handleZodError()` - Zod validation errors
- `handleValidationError()` - Mongoose validation errors
- `handleCastError()` - MongoDB cast errors
- `handleDuplicateError()` - MongoDB duplicate key errors

**Frontend Pattern:**
- Extract backend error messages using `getBackendErrorMessage()` helper
- Location: `pft-dashboard/src/hooks/useAuth.ts`
- Priority: errorSources → message → error → errors → statusText
- Always prioritize backend response data over generic error messages

**Async Error Handling:**
- Backend: Use `catchAsync` wrapper for all async route handlers
- Location: `pft-backend/src/app/utils/catchAsync.ts`
- Pattern: `catchAsync(async (req, res, next) => { ... })`
- Automatically catches and forwards errors to global error handler

## Logging

**Backend Framework:** Winston
- Location: `pft-backend/src/app/utils/logger.ts`
- Levels: error, warn, info, http, debug
- Environment-based: debug in development, warn in production

**Log Format:**
- Console: Compact with timestamp, colorized
- Files: JSON format with full error stack (production only)

**Usage Pattern:**
```typescript
import logger from "../../utils/logger";

logger.info("Message", { metadata });
logger.error("Error message", error);
logger.debug("Debug info");
logger.warn("Warning");
```

**Frontend Logging:**
- Custom `secureLog` utility for sensitive operations
- Location: `pft-dashboard/src/utils/secureLogger.ts`
- Usage: `secureLog.debug("message")`

## Validation

**Backend:**
- Framework: Zod
- Pattern: Separate validation schemas per module
- Location: `[module]/[module].validation.ts`
- Example: `pft-backend/src/app/modules/Statistics/statistics.validation.ts`

**Validation Schema Structure:**
```typescript
export const statisticsValidation = {
  tradeHistoryQuery: z.object({
    params: z.object({ ... }),
    query: z.object({ ... }).optional(),
  }),
  // More schemas...
};
```

**Validation Middleware:**
- Location: `pft-backend/src/app/middlewares/validateRequest.ts`
- Applied to routes before controller execution

## Comments

**When to Comment:**
- Complex business logic requiring explanation
- Non-obvious performance optimizations
- Workarounds for external API limitations
- Cache strategies and cleanup logic

**JSDoc/TSDoc:**
- Used for public API methods and service functions
- Example from `statistics.service.ts`:
```typescript
/**
 * Get ALL trade history and AccountOverview data for specific login and program
 * This method returns complete trade history without pagination
 */
async getAllTradeHistoryWithAccountOverview(loginId: string, programId: string)
```

**Inline Comments:**
- Used to explain non-obvious code sections
- Example: `// Cache the result for shorter duration since it's all data`

## Function Design

**Size:**
- Backend services: Methods can be 50-200 lines for complex operations
- Controllers: Keep thin, delegate to services
- Utilities: Small, single-purpose functions (10-30 lines)

**Parameters:**
- Use object destructuring for multiple parameters
- Example: `async getTradeHistoryOptimized(query: TradeHistoryQuery)`
- Validate parameters at function entry with AppError

**Return Values:**
- Backend: Return data directly, let controller wrap in response
- Services return domain objects, not HTTP responses
- Use TypeScript return types explicitly

**Async/Await:**
- Prefer async/await over promises
- Use Promise.all() for parallel operations
- Example from `statistics.service.ts`:
```typescript
const [hotTrades, coldTrades, hotCount, coldCount, accountOverview, programInfo] =
  await Promise.all([...]);
```

## Module Design

**Backend Module Structure:**
```
[ModuleName]/
├── [module].interface.ts    # TypeScript interfaces
├── [module].model.ts         # Mongoose models (if applicable)
├── [module].validation.ts    # Zod schemas
├── [module].controller.ts    # Request handlers
├── [module].service.ts       # Business logic
└── [module].routes.ts        # Route definitions
```

**Exports:**
- Named exports for services and controllers
- Example: `export const StatisticsService = { ... }`
- Default export for models: `export default User`

**Service Pattern:**
- Export object with methods (not class)
- Example:
```typescript
export const StatisticsService = {
  async getAllTradeHistory(...) { ... },
  async getTradeHistoryOptimized(...) { ... },
  calculatePerformanceMetrics(...) { ... },
};
```

**Controller Pattern:**
- Export object with catchAsync-wrapped methods
- Example:
```typescript
export const StatisticsController = {
  getAllTradeHistory: catchAsync(async (req, res) => { ... }),
  getTradeHistory: catchAsync(async (req, res) => { ... }),
};
```

**Frontend Module Structure:**
```
components/
├── ui/                       # Reusable UI components
│   └── [component]/
│       ├── index.tsx
│       └── [SubComponent].tsx
└── modules/                  # Feature-specific components

hooks/
└── use[Feature].ts          # Custom React hooks

lib/
├── api/                     # API client and endpoints
├── config/                  # Configuration
└── utils/                   # Utility functions
```

**React Hooks Pattern:**
- Use React Query for data fetching
- Return mutation functions and query results
- Example structure:
```typescript
export const useAuth = () => {
  const login = useMutation<AuthResponse, Error, LoginCredentials>({ ... });
  const useCurrentUser = () => useQuery<User, Error>({ ... });

  return {
    login: login.mutateAsync,
    useCurrentUser,
    // More methods...
  };
};
```

## Response Patterns

**Backend Response Structure:**
- Use `sendResponse` utility for consistent responses
- Location: `pft-backend/src/app/utils/sendResponse.ts`
- Structure:
```typescript
sendResponse(res, {
  statusCode: httpStatus.OK,
  success: true,
  message: "Success message",
  data: result,
  meta?: { limit, page, total, totalPage }
});
```

**Frontend API Response:**
- Axios responses wrapped in data property
- Access pattern: `response.data.data`
- Error handling through React Query's onError

## Performance Patterns

**Caching:**
- In-memory Map-based caching for heavy queries
- Cache expiry tracking with cleanup intervals
- Example from `statistics.service.ts`:
```typescript
const dataCache = new Map<string, any>();
const cacheExpiry = new Map<string, number>();
const CACHE_DURATION_MS = 30000;
```

**Database Optimization:**
- Use `.lean()` for read-only queries
- Parallel queries with Promise.all()
- Pagination with limit and offset
- Index-aware query building

**React Query:**
- Configure staleTime for caching: `staleTime: 5 * 60 * 1000`
- Disable unnecessary refetches: `refetchOnWindowFocus: false`
- Retry configuration for auth errors

---

*Convention analysis: 2026-02-08*
