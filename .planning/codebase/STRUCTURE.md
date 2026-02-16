# Codebase Structure

**Analysis Date:** 2026-02-08

## Directory Layout

```
PFT-WhiteLabel-v2-staging/
├── pft-dashboard/          # Next.js frontend application
│   ├── src/
│   │   ├── app/            # Next.js App Router pages & API routes
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks (135 files)
│   │   ├── lib/            # Core libraries (API, config, utils)
│   │   ├── providers/      # React Context providers
│   │   ├── theme/          # Theme configuration
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── middleware.ts   # Next.js middleware
│   ├── public/             # Static assets
│   ├── scripts/            # Build/utility scripts
│   └── package.json
├── pft-backend/            # Express.js REST API
│   ├── src/                # Backend source code
│   ├── dist/               # Compiled output
│   └── package.json
├── pft-rule-checker/       # Rule validation service
├── mt5-rest-api-deploy/    # MT5 trading platform API
├── pfr-super-admin/        # Super admin panel
├── super-admin/            # Legacy super admin
└── .planning/              # GSD planning documents
    └── codebase/           # Architecture documentation
```

## Directory Purposes

**pft-dashboard/src/app/**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components, layouts, route handlers, API endpoints
- Key subdirectories:
  - `(dashboard)/` - Route group for authenticated pages
  - `auth/` - Authentication pages (login, register, reset-password)
  - `checkout/` - Payment flow pages
  - `kyc/` - KYC verification pages
  - `verify/` - Public certificate verification
  - `api/` - API route handlers
  - `admin/` - Admin panel (30+ sub-routes)

**pft-dashboard/src/components/**
- Purpose: Reusable React components
- Contains: UI components, admin components, modules, charts
- Key subdirectories:
  - `ui/` - Base UI components (57 files: buttons, forms, dialogs, etc.)
  - `admin/` - Admin-specific components
  - `charts/` - Data visualization components
  - `modules/` - Feature modules (CustomCodeInjector, etc.)

**pft-dashboard/src/hooks/**
- Purpose: Custom React hooks for business logic
- Contains: 135 custom hooks for API calls and state management
- Examples:
  - `useAuth.ts` - Authentication logic
  - `useAccounts.ts` - Account management
  - `usePrograms.ts` - Program data
  - `useAffiliates.ts` - Affiliate system
  - `useCertificates.ts` - Certificate management

**pft-dashboard/src/lib/**
- Purpose: Core library code and utilities
- Contains: API clients, configuration, constants, server utilities
- Key subdirectories:
  - `api/` - API client and service modules
  - `config/` - Configuration management
  - `constants/` - Application constants
  - `server/` - Server-side utilities
  - `utils/` - Shared utility functions
  - `websocket/` - WebSocket client

**pft-dashboard/src/providers/**
- Purpose: React Context providers for global state
- Contains: 15 provider components
- Examples:
  - `QueryProvider.tsx` - TanStack Query setup
  - `SessionProvider.tsx` - User session state
  - `ThemeProvider.tsx` - Theme management
  - `BootstrapProvider.tsx` - Initial data loading
  - `LogRocketProvider.tsx` - Session replay
  - `IntercomProvider.tsx` - Customer support

**pft-dashboard/src/types/**
- Purpose: TypeScript type definitions
- Contains: 40 type definition files
- Examples:
  - `auth.types.ts` - Authentication types
  - `program.types.ts` - Program types
  - `user.types.ts` - User types
  - `certificate.types.ts` - Certificate types
  - `kyc.types.ts` - KYC verification types

**pft-dashboard/src/utils/**
- Purpose: Utility functions and helpers
- Contains: 38 utility files
- Examples:
  - `auth.ts` - Authentication utilities
  - `dataLayer.ts` - Analytics data layer
  - `validation.ts` - Validation helpers
  - `templateVariables.utils.ts` - Template processing
  - `secureLogger.ts` - Secure logging

**pft-backend/src/**
- Purpose: Express.js backend application
- Contains: API routes, controllers, services, models
- Technology: Express.js 5.1.0, MongoDB with Mongoose, Socket.io

## Key File Locations

**Entry Points:**
- `pft-dashboard/src/app/layout.tsx` - Root layout with providers and config
- `pft-dashboard/src/app/(dashboard)/layout.tsx` - Dashboard layout with auth
- `pft-dashboard/src/middleware.ts` - Request middleware
- `pft-dashboard/src/providers/index.tsx` - Provider composition
- `pft-backend/src/server.ts` - Backend server entry (assumed)

**Configuration:**
- `pft-dashboard/package.json` - Frontend dependencies and scripts
- `pft-dashboard/next.config.js` - Next.js configuration (assumed)
- `pft-dashboard/tsconfig.json` - TypeScript configuration (assumed)
- `pft-dashboard/tailwind.config.js` - Tailwind CSS configuration (assumed)
- `pft-backend/package.json` - Backend dependencies and scripts
- `pft-backend/tsconfig.json` - Backend TypeScript configuration

**Core Logic:**
- `pft-dashboard/src/lib/api/client.ts` - Centralized API client with auth
- `pft-dashboard/src/hooks/useAuth.ts` - Authentication hook
- `pft-dashboard/src/lib/config/project-config.ts` - Project configuration
- `pft-dashboard/src/lib/config/environment.ts` - Environment config

**Testing:**
- Test files not extensively present in frontend
- `pft-backend/` uses Jest (from package.json)

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `DashboardLayout.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useAuth.ts`)
- Utilities: `camelCase.ts` (e.g., `validation.ts`)
- Types: `camelCase.types.ts` (e.g., `auth.types.ts`)
- API routes: `route.ts` in directory structure
- Pages: `page.tsx` in directory structure

**Directories:**
- Route groups: `(groupName)` with parentheses (e.g., `(dashboard)`)
- Dynamic routes: `[param]` with brackets (e.g., `[id]`)
- Feature directories: `kebab-case` (e.g., `payment-history`)
- Component directories: `PascalCase` for component folders

**Variables/Functions:**
- Functions: `camelCase` (e.g., `getUserData`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `API_URL`)
- React components: `PascalCase` (e.g., `UserProfile`)
- Types/Interfaces: `PascalCase` (e.g., `UserData`)

## Where to Add New Code

**New Dashboard Page:**
- Primary code: `pft-dashboard/src/app/(dashboard)/[feature-name]/page.tsx`
- Layout (if needed): `pft-dashboard/src/app/(dashboard)/[feature-name]/layout.tsx`
- Components: `pft-dashboard/src/app/(dashboard)/[feature-name]/components/`

**New Admin Page:**
- Primary code: `pft-dashboard/src/app/(dashboard)/admin/[feature-name]/page.tsx`
- Follow existing admin structure with nested routes

**New API Route:**
- Route handler: `pft-dashboard/src/app/api/[endpoint]/route.ts`
- Export GET, POST, PUT, DELETE functions as needed

**New React Component:**
- UI component: `pft-dashboard/src/components/ui/[component-name].tsx`
- Feature component: `pft-dashboard/src/components/[feature]/[component-name].tsx`
- Admin component: `pft-dashboard/src/components/admin/[component-name].tsx`

**New Custom Hook:**
- Implementation: `pft-dashboard/src/hooks/use[FeatureName].ts`
- Follow pattern: export hook function, use TanStack Query for API calls
- Example: `useMyFeature.ts` with `useMyFeatureData()`, `useCreateMyFeature()`, etc.

**New API Service:**
- Service module: `pft-dashboard/src/lib/api/[service-name].ts`
- Export functions that use `apiClient` from `client.ts`
- Follow pattern: `export const getItems = () => apiClient.get('/items')`

**New Type Definition:**
- Type file: `pft-dashboard/src/types/[feature].types.ts`
- Export interfaces and types
- Import in components/hooks as needed

**Utilities:**
- Shared helpers: `pft-dashboard/src/utils/[utility-name].ts`
- Domain-specific: `pft-dashboard/src/utils/[domain]/[utility-name].ts`

**New Provider:**
- Provider component: `pft-dashboard/src/providers/[FeatureName]Provider.tsx`
- Add to provider composition in `pft-dashboard/src/providers/index.tsx`

## Special Directories

**pft-dashboard/.next/**
- Purpose: Next.js build output and cache
- Generated: Yes (during build/dev)
- Committed: No (in .gitignore)

**pft-dashboard/node_modules/**
- Purpose: NPM dependencies
- Generated: Yes (via npm/yarn install)
- Committed: No (in .gitignore)

**pft-dashboard/public/**
- Purpose: Static assets served at root
- Contains: Images, fonts, icons, data files
- Committed: Yes
- Subdirectories:
  - `platforms/` - Platform-specific assets
  - `icons/` - Icon files
  - `Fonts/` - Custom fonts
  - `models/` - ML models (face-api)

**pft-backend/dist/**
- Purpose: Compiled TypeScript output
- Generated: Yes (via build script)
- Committed: No (in .gitignore)

**pft-backend/logs/**
- Purpose: Application logs
- Generated: Yes (at runtime)
- Committed: No (in .gitignore)

**.planning/**
- Purpose: GSD planning and documentation
- Contains: Codebase analysis, phase plans, execution logs
- Committed: Yes (for team reference)

## Route Structure Patterns

**Public Routes:**
- `/auth/login` - Login page
- `/auth/register` - Registration page
- `/auth/reset-password` - Password reset
- `/checkout` - Payment checkout
- `/verify/certificate` - Public certificate verification

**Protected Routes (Dashboard):**
- `/dashboard` - User dashboard
- `/accounts` - Account management
- `/profile` - User profile
- `/settings` - User settings
- `/withdrawals` - Withdrawal requests
- `/certificates` - User certificates
- `/contracts` - Contract management
- `/kyc` - KYC verification
- `/payment-history` - Payment history

**Admin Routes:**
- `/admin/dashboard` - Admin dashboard
- `/admin/users` - User management
- `/admin/accounts` - Account management
- `/admin/programs` - Program configuration
- `/admin/payments` - Payment management
- `/admin/kyc-verification` - KYC review
- `/admin/certificates` - Certificate management
- `/admin/analytics` - Analytics dashboards
- Plus 20+ additional admin routes

**API Routes:**
- `/api/config` - Project configuration
- `/api/config/stream` - Config streaming
- `/api/config/webhook` - Config webhooks
- `/api/changelog` - Changelog data
- `/api/manifest` - PWA manifest
- `/api/system/reload` - System reload

## Import Path Aliases

**Configured Aliases:**
- `@/` - Maps to `pft-dashboard/src/`
- Example: `import { Button } from '@/components/ui/button'`
- Example: `import { useAuth } from '@/hooks/useAuth'`

**Usage Pattern:**
```typescript
// Absolute imports via alias (preferred)
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api/client';

// Relative imports (avoid for cross-directory)
import { helper } from './utils/helper';
```

## Monorepo Organization

**Independent Projects:**
- Each project has its own `package.json` and dependencies
- No shared workspace configuration detected
- Projects communicate via HTTP APIs

**Project Relationships:**
- `pft-dashboard` → calls → `pft-backend` (REST API)
- `pft-dashboard` → fetches config from → `super-admin` or `pfr-super-admin`
- `pft-backend` → may call → `mt5-rest-api-deploy` (trading platform)
- `pft-backend` → may call → `pft-rule-checker` (rule validation)

---

*Structure analysis: 2026-02-08*
