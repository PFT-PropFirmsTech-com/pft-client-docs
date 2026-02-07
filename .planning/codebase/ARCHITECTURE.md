# Architecture

**Analysis Date:** 2026-02-08

## Pattern Overview

**Overall:** Monorepo with Next.js App Router Frontend + Express.js REST API Backend

**Key Characteristics:**
- Server-side rendering with Next.js 15.2.8 App Router
- Client-side state management via TanStack Query and React Context
- Centralized API client with automatic token refresh
- Role-based access control enforced at middleware and API levels
- Real-time data via WebSocket connections
- Multi-tenant white-label architecture with dynamic configuration

## Layers

**Presentation Layer:**
- Purpose: UI components and page rendering
- Location: `pft-dashboard/src/components/`, `pft-dashboard/src/app/`
- Contains: React components (Server and Client), layouts, pages
- Depends on: Hooks layer, API client, providers
- Used by: End users via browser

**Business Logic Layer:**
- Purpose: Encapsulate domain logic and API interactions
- Location: `pft-dashboard/src/hooks/` (135 custom hooks), `pft-dashboard/src/utils/`
- Contains: Custom React hooks (useAuth, useAccounts, usePrograms, etc.), utility functions
- Depends on: API client, types
- Used by: Presentation layer components

**Data Access Layer:**
- Purpose: Communication with backend services
- Location: `pft-dashboard/src/lib/api/`, `pft-dashboard/src/lib/websocket/`
- Contains: API client (`client.ts`), service modules (config, health, breach, etc.), WebSocket client
- Depends on: Environment configuration, authentication tokens
- Used by: Business logic layer (hooks)

**Configuration Layer:**
- Purpose: Application configuration and environment setup
- Location: `pft-dashboard/src/lib/config/`, `pft-dashboard/src/providers/`
- Contains: Environment config, project config, React context providers
- Depends on: External configuration API (Super Admin)
- Used by: All layers

**Routing & Middleware Layer:**
- Purpose: Request routing, authentication, authorization, tracking
- Location: `pft-dashboard/src/middleware.ts`, `pft-dashboard/src/app/`
- Contains: Next.js middleware, route handlers, API routes
- Depends on: Configuration, authentication tokens
- Used by: Next.js framework

**Backend API Layer:**
- Purpose: REST API and business logic processing
- Location: `pft-backend/src/`
- Contains: Express.js routes, controllers, services, models
- Depends on: MongoDB, external services (payment gateways, KYC, etc.)
- Used by: Frontend data access layer

## Data Flow

**Authentication Flow:**

1. User submits credentials → `pft-dashboard/src/app/auth/login/page.tsx`
2. Login page calls `useAuth().login()` hook → `pft-dashboard/src/hooks/useAuth.ts`
3. Hook sends POST to backend via API client → `pft-dashboard/src/lib/api/client.ts`
4. Backend validates credentials → `pft-backend/src/` (assumed)
5. Backend returns JWT tokens (access + refresh)
6. Tokens stored in cookies, role stored in cookie
7. Middleware validates tokens on subsequent requests → `pft-dashboard/src/middleware.ts`
8. API client automatically refreshes expired tokens via interceptor

**Data Fetching Flow (Client Components):**

1. Component mounts → calls custom hook (e.g., `useAccounts()`)
2. Hook uses TanStack Query → `@tanstack/react-query`
3. Query function calls API client → `pft-dashboard/src/lib/api/client.ts`
4. API client adds auth header, sends request to backend
5. Response interceptor logs timing, processes data
6. Hook returns data to component via TanStack Query state
7. Component renders with data

**Server Component Flow:**

1. Next.js renders server component
2. Component directly fetches config → `pft-dashboard/src/lib/config/project-config.ts`
3. Config fetched from Super Admin API or cache
4. Component renders with data in initial HTML

**Real-time Data Flow:**

1. Dashboard component establishes WebSocket connection → `pft-dashboard/src/lib/websocket/`
2. Backend streams account updates via Socket.io
3. Client receives updates, triggers React state updates
4. Components re-render with live data

**State Management:**
- Server state: TanStack Query (caching, refetching, optimistic updates)
- Client state: React Context via providers (theme, session, bootstrap data)
- URL state: Next.js router (search params, route params)
- Form state: React Hook Form with Zod validation
- Local state: React useState/useReducer

## Key Abstractions

**Custom Hooks:**
- Purpose: Encapsulate API calls and business logic
- Examples: `pft-dashboard/src/hooks/useAuth.ts`, `pft-dashboard/src/hooks/useAccounts.ts`, `pft-dashboard/src/hooks/usePrograms.ts`
- Pattern: Each hook wraps TanStack Query mutations/queries, returns standardized interface
- Count: 135 custom hooks for different domain areas

**API Client:**
- Purpose: Centralized HTTP communication with automatic auth
- Location: `pft-dashboard/src/lib/api/client.ts`
- Pattern: Axios instance with request/response interceptors
- Features:
  - Automatic Bearer token injection
  - Token expiration detection and refresh
  - Request queuing during token refresh
  - Request timing and logging
  - Error handling and retry logic

**Providers:**
- Purpose: Global state and configuration injection
- Location: `pft-dashboard/src/providers/`
- Pattern: Nested React Context providers
- Examples:
  - `QueryProvider` - TanStack Query client
  - `SessionProvider` - User session state
  - `ThemeProvider` - Dark/light mode
  - `BootstrapProvider` - Initial app data loading
  - `LogRocketProvider`, `ClarityProvider`, `FacebookPixelProvider` - Analytics
  - `IntercomProvider` - Customer support
  - `EasterEggProvider` - Hidden features

**Route Groups:**
- Purpose: Organize routes with shared layouts
- Location: `pft-dashboard/src/app/(dashboard)/`
- Pattern: Next.js route groups (parentheses syntax)
- Example: `(dashboard)` group shares authentication layout

**Service Modules:**
- Purpose: Domain-specific API operations
- Location: `pft-dashboard/src/lib/api/`
- Examples: `config.ts`, `health.ts`, `breach.ts`, `checkout-settings.ts`
- Pattern: Export functions that use API client

## Entry Points

**Frontend Root:**
- Location: `pft-dashboard/src/app/layout.tsx`
- Triggers: Every page request
- Responsibilities:
  - Load project configuration from Super Admin
  - Set up fonts (Google Fonts + custom fonts)
  - Generate metadata (SEO, Open Graph, Twitter cards)
  - Inject custom code (GTM, analytics scripts)
  - Initialize global providers
  - Set up theme colors and CSS variables

**Dashboard Layout:**
- Location: `pft-dashboard/src/app/(dashboard)/layout.tsx`
- Triggers: Authenticated dashboard routes
- Responsibilities:
  - Verify user authentication via `useAuth()` hook
  - Handle impersonation mode
  - Collect device fingerprint
  - Track daily logins
  - Render dashboard navigation and sidebar
  - Redirect to login if unauthenticated

**Middleware:**
- Location: `pft-dashboard/src/middleware.ts`
- Triggers: Every request (except static assets)
- Responsibilities:
  - Capture UTM parameters and click IDs (attribution tracking)
  - Set affiliate referral cookies
  - Handle maintenance mode
  - Enforce authentication (redirect to login)
  - Check role-based permissions via Super Admin config
  - Enforce feature flags
  - Handle custom checkout URL redirects

**API Routes:**
- Location: `pft-dashboard/src/app/api/`
- Examples:
  - `config/route.ts` - Fetch project configuration
  - `config/stream/route.ts` - Stream config updates
  - `config/webhook/route.ts` - Receive config change webhooks
  - `changelog/route.ts` - Fetch changelog data
  - `manifest/route.ts` - Generate PWA manifest
  - `system/reload/route.ts` - Trigger system reload

**Backend Server:**
- Location: `pft-backend/src/server.ts` (assumed)
- Triggers: Node.js process start
- Responsibilities:
  - Initialize Express.js application
  - Connect to MongoDB
  - Set up Socket.io for real-time communication
  - Register API routes
  - Start HTTP server

## Error Handling

**Strategy:** Multi-layered error handling with graceful degradation

**Patterns:**

**API Client Level:**
- Axios interceptors catch HTTP errors
- 401 errors trigger automatic token refresh
- Failed refresh redirects to login
- Network errors logged via AI logger
- Errors propagated to calling code

**Hook Level:**
- TanStack Query handles error states
- Hooks return `{ error, isError }` to components
- Retry logic configured per query
- Error boundaries catch unhandled errors

**Component Level:**
- Conditional rendering based on error state
- Error UI components display user-friendly messages
- Toast notifications for transient errors
- Full-page error states for critical failures

**Middleware Level:**
- Try-catch blocks prevent middleware crashes
- Failed config fetches fall back to defaults
- Permission checks fail-safe to existing logic

**Backend Level:**
- Express error handling middleware
- Validation errors return 400 with details
- Auth errors return 401
- Server errors return 500 with sanitized message

## Cross-Cutting Concerns

**Logging:**
- Frontend: Custom AI logger (`pft-dashboard/src/providers/AILoggerProvider.tsx`)
- API requests logged with timing and request ID
- LogRocket integration for session replay
- Console logging in development
- Backend: Winston logger (assumed from package.json)

**Validation:**
- Client-side: Zod schemas with React Hook Form
- Type-safe validation with TypeScript
- Server-side: Zod validation in backend (from package.json)
- Input sanitization via DOMPurify

**Authentication:**
- JWT-based authentication (access + refresh tokens)
- Tokens stored in HTTP-only cookies (secure in production)
- Middleware enforces authentication on protected routes
- API client automatically includes Bearer token
- Token refresh handled transparently
- Role-based access control (admin, backOffice, sales, user)

**Authorization:**
- Role-based permissions checked in middleware
- Dynamic page permissions from Super Admin config
- Feature flags control access to entire sections
- Backend validates permissions on API endpoints

**Monitoring:**
- LogRocket for session replay and error tracking
- Microsoft Clarity for heatmaps and recordings
- Facebook Pixel for conversion tracking
- Intercom for customer support
- Vercel Analytics and Speed Insights
- Custom AI logger for structured logging

**Configuration:**
- Multi-tenant configuration from Super Admin API
- Project-specific config loaded at build time and runtime
- Environment variables for secrets and endpoints
- Dynamic theming based on project config
- Feature flags for gradual rollouts

**Internationalization:**
- Not currently implemented (English only)
- Country selection available for user profiles

**Performance:**
- Next.js automatic code splitting
- TanStack Query caching and deduplication
- Image optimization via Next.js Image component
- Font optimization with next/font
- Preconnect hints for critical origins
- WebSocket for real-time data (reduces polling)

---

*Architecture analysis: 2026-02-08*
