# Technology Stack

**Analysis Date:** 2026-02-08

## Languages

**Primary:**
- TypeScript 5.x - All Node.js projects (backend, frontend, worker services)
- JavaScript ES2020+ - Legacy broker integration files and some utility scripts

**Secondary:**
- C# .NET 6.0 - MT5 REST API service (`mt5-rest-api-deploy/`)

## Runtime

**Environment:**
- Node.js 20.x+ (required minimum version)
- .NET 6.0 Runtime (for MT5 REST API)

**Package Manager:**
- npm 10.x+ (primary)
- Lockfiles: package-lock.json present in all Node.js projects

## Frameworks

**Core:**
- Next.js 15.2.8 - Frontend dashboard (`pft-dashboard/`)
- Next.js 16.0.7 - Super admin panels (`pfr-super-admin/`, `super-admin/`)
- Express 5.1.0 - Main backend API (`pft-backend/`)
- Express 4.19.2 - Worker/rule checker service (`pft-rule-checker/`)
- React 18.3.1 - Dashboard UI (`pft-dashboard/`)
- React 19.2.0 - Super admin UI (`pfr-super-admin/`, `super-admin/`)

**Testing:**
- Jest 29.7.0 - Unit and integration testing (`pft-backend/`)
- ts-jest 29.2.5 - TypeScript support for Jest

**Build/Dev:**
- TypeScript Compiler 5.x - Type checking and compilation
- SWC 1.10.1 - Fast TypeScript/JavaScript compilation (`pft-backend/`)
- ts-node-dev 2.0.0 - Development server with hot reload
- PM2 - Production process management (ecosystem.config.js in backend projects)
- Next.js Build System - Frontend compilation and optimization

## Key Dependencies

**Critical:**
- mongoose 8.4.4 - MongoDB ODM for all data persistence
- ioredis 5.8.0+ - Redis client for caching and job queues
- socket.io 4.8.1 - Real-time bidirectional communication
- metaapi.cloud-sdk 29.0.5 - Trading platform integration
- stripe 18.5.0 - Payment processing (`pft-backend/`)
- bullmq 5.58.7 - Redis-based job queue system (`pft-rule-checker/`)
- jsonwebtoken 9.0.2 - JWT authentication (`pft-backend/`, `pft-rule-checker/`)
- jose 6.1.2 - JWT handling in Next.js apps (`pfr-super-admin/`, `super-admin/`)

**Infrastructure:**
- axios 1.9.0 - HTTP client for external API calls
- winston 3.17.0 - Structured logging
- nodemailer 6.10.0/7.0.5 - Email delivery
- bcryptjs 2.4.3/3.0.3 - Password hashing
- zod 3.23.8/4.1.12 - Runtime type validation
- dotenv 16.5.0 - Environment variable management
- cors 2.8.5 - Cross-origin resource sharing
- helmet 8.0.0 - Security headers (`pft-backend/`)
- compression 1.8.1 - Response compression (`pft-backend/`)

**UI Libraries:**
- @radix-ui/react-* - Headless UI components (extensive usage)
- tailwindcss 3.4.1/4.x - Utility-first CSS framework
- lucide-react 0.475.0/0.552.0 - Icon library
- @tanstack/react-query 5.74.4 - Server state management (`pft-dashboard/`)
- @tanstack/react-table 8.21.3 - Table component (`pft-dashboard/`)
- framer-motion 12.7.4 - Animation library (`pft-dashboard/`)
- recharts 2.15.4 - Charting library
- react-hook-form 7.55.0/7.66.0 - Form management
- @hookform/resolvers 5.0.1/5.2.2 - Form validation resolvers

**Specialized:**
- ethers 6.16.0 - Ethereum/blockchain interaction (`pft-backend/`)
- @nowpaymentsio/nowpayments-api-js 1.0.5 - Crypto payment processing (`pft-backend/`)
- cloudinary 2.6.0 - Image/media management (`pft-backend/`)
- sharp 0.34.3/0.34.5 - Image processing
- tesseract.js 6.0.1 - OCR for document verification (`pft-backend/`)
- face-api.js 0.22.2 - Face detection for KYC (`pft-dashboard/`)
- canvas 3.2.0 - Server-side canvas for certificate generation (`pft-backend/`)
- qrcode 1.5.4 - QR code generation (`pft-backend/`)
- pdf-lib 1.17.1 - PDF manipulation (`pft-dashboard/`)
- jspdf 3.0.1 - PDF generation (`pft-dashboard/`)

**C# Dependencies (MT5 REST API):**
- MongoDB.Driver 2.19.0 - MongoDB client for .NET
- Newtonsoft.Json 13.0.3 - JSON serialization
- MetaQuotes.MT5ManagerAPI64 - MT5 Manager API SDK
- MetaQuotes.MT5CommonAPI64 - MT5 Common API SDK
- MetaQuotes.MT5GatewayAPI64 - MT5 Gateway API SDK

## Configuration

**Environment:**
- Environment variables via `.env` files (present in all projects)
- Configuration centralized in `config/index.ts` files
- Super-admin configuration service for dynamic settings
- High-scale configuration: `.env.high-scale` (`pft-rule-checker/`)

**Build:**
- `tsconfig.json` - TypeScript configuration in each project
  - Backend: CommonJS, ES2021 target, strict mode
  - Frontend: ESNext, bundler resolution, Next.js plugin
  - Worker: CommonJS, ES2020 target, decorators enabled
- `next.config.js`/`next.config.ts` - Next.js configuration
- `tailwind.config.ts` - TailwindCSS configuration
- `ecosystem.config.js` - PM2 process management
- `jest.config.*` - Test configuration
- `MT5RestAPI.csproj` - .NET project configuration

**TypeScript Compiler Options:**
- Target: ES2017-ES2021 depending on project
- Module: CommonJS (backend/worker), ESNext (frontend)
- Strict mode enabled in most projects
- Source maps and declaration files generated
- Incremental compilation enabled

## Platform Requirements

**Development:**
- Node.js 20.x or higher
- npm 10.x or higher
- TypeScript 5.x
- .NET 6.0 SDK (for MT5 REST API development)
- MongoDB instance (local or remote)
- Redis instance (local or remote)
- MT5 trading platform access (for broker integration)

**Production:**
- Node.js 20.x+ runtime
- PM2 process manager for backend services
- MongoDB Atlas or self-hosted MongoDB
- Redis (Upstash, AWS ElastiCache, or self-hosted)
- Vercel or similar platform for Next.js apps
- Docker support (Dockerfile present in `pft-dashboard/`)
- .NET 6.0 Runtime for MT5 REST API
- Linux x64 for production deployment (Sharp image processing)

**Memory Requirements:**
- Standard: Default Node.js limits
- High-scale mode: 16GB heap (`--max-old-space-size=16384`)
- Garbage collection exposed in high-scale mode (`--expose-gc`)

**Clustering:**
- Worker thread support (`pft-rule-checker/`)
- Cluster mode available via `USE_CLUSTERING=true` environment variable
- PM2 cluster mode configuration in ecosystem.config.js

---

*Stack analysis: 2026-02-08*
