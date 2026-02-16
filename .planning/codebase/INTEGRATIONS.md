# External Integrations

**Analysis Date:** 2026-02-08

## APIs & External Services

**Trading Platforms:**
- MetaAPI Cloud SDK - MT4/MT5 broker integration
  - SDK/Client: `metaapi.cloud-sdk` 29.0.5
  - Implementation: `pft-rule-checker/src/app/services/broker/mt5-rest-client.ts`
  - Auth: API key configuration
  - Purpose: Trade synchronization, account management, real-time market data

- MT5 REST API (Custom) - Direct MT5 Manager API integration
  - Implementation: `mt5-rest-api-deploy/` (C# .NET 6.0 service)
  - Connection: MongoDB for data persistence
  - Config: `mt5-rest-api-deploy/appsettings.json`
  - Purpose: High-performance MT5 account operations, trade management
  - Features: Real-time mode, rule checking integration

**Payment Processing:**
- Stripe - Credit card and payment processing
  - SDK/Client: `stripe` 18.5.0
  - Implementation: `pft-backend/src/app/modules/Payment/services/stripe.service.ts`
  - Webhooks: `pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts`
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Purpose: Challenge purchases, subscription billing

- NOWPayments - Cryptocurrency payment processing
  - SDK/Client: `@nowpaymentsio/nowpayments-api-js` 1.0.5
  - Implementation: `pft-backend/src/app/modules/Payment/services/crypto.service.ts`
  - Auth: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_CALLBACK_URL`
  - Purpose: Crypto invoice creation, payment verification
  - Supported: Flexible cryptocurrency selection (BTC, ETH, USDT, etc.)

**KYC & Identity Verification:**
- Veriff - Identity verification service
  - Implementation: `pft-backend/src/app/modules/Kyc/veriff.service.ts`
  - Webhooks: `pft-backend/src/app/modules/Kyc/veriff.controller.ts`
  - Purpose: Document verification, identity validation
  - Features: Session management, webhook callbacks

- Tesseract.js - OCR for document processing
  - SDK/Client: `tesseract.js` 6.0.1
  - Implementation: `pft-backend/src/app/modules/Kyc/ocr.service.ts`
  - Purpose: Extract text from identity documents

- Face-api.js - Face detection and verification
  - SDK/Client: `face-api.js` 0.22.2
  - Implementation: `pft-dashboard/src/app/(dashboard)/_components/modules/users/kyc/guided/useFaceDetection.ts`
  - Purpose: Liveness detection, face matching for KYC

**Media & File Storage:**
- Cloudinary - Cloud-based media management
  - SDK/Client: `cloudinary` 2.6.0
  - Implementation: `pft-backend/src/app/modules/Admin/CloudinarySettings/`
  - Auth: Dynamic configuration via database
  - Purpose: Image uploads, certificate storage, document management
  - Features: Transformation, optimization, CDN delivery

**Customer Support:**
- Intercom - Customer messaging and support
  - Implementation: `pft-backend/src/app/modules/Intercom/`
  - Events: `pft-backend/src/app/modules/Intercom/intercom-events.service.ts`
  - Queue: `pft-backend/src/app/modules/Intercom/intercom-queue.service.ts`
  - Auth: OAuth integration, API key
  - Purpose: User messaging, support tickets, event tracking

**Reviews & Reputation:**
- Trustpilot - Review collection and management
  - Implementation: `pft-backend/src/app/modules/Trustpilot/`
  - Events: `pft-backend/src/app/modules/Trustpilot/trustpilot-events.service.ts`
  - Purpose: Automated review invitations via BCC on positive events
  - Triggers: Payout completion, challenge passed, funded achievement

**Marketing & Analytics:**
- Facebook Pixel - Conversion tracking
  - Implementation: `pft-backend/src/app/modules/FacebookPixel/`
  - Purpose: Track user events, conversion optimization

**Blockchain & Crypto:**
- Ethers.js - Ethereum blockchain interaction
  - SDK/Client: `ethers` 6.16.0
  - Implementation: `pft-backend/src/app/modules/Crypto/`, `pft-backend/src/app/modules/Wallets/`
  - Purpose: Crypto wallet management, blockchain transactions
  - Features: Wallet creation, balance checking, transfers

## Data Storage

**Databases:**
- MongoDB - Primary database
  - Connection: `DATABASE_URL` environment variable
  - Client: `mongoose` 8.4.4 ODM
  - Implementation: All projects connect via `mongoose.connect()`
  - Collections: Users, programs, trades, payments, KYC, analytics
  - Indexes: Custom indexes via `pft-rule-checker/scripts/add-indexes.js`

**Caching & Queuing:**
- Redis - In-memory data store
  - Connection: `REDIS_URL` environment variable
  - Client: `ioredis` 5.8.0+
  - Implementation:
    - Cache: `pft-backend/src/app/services/cache/redis.service.ts`
    - Cache: `pft-rule-checker/src/app/services/cache/RedisCacheService.ts`
    - Queue: `pft-rule-checker/src/app/services/queue/jobQueue.ts`
    - Socket adapter: `pft-rule-checker/src/app/services/socket/redisAdapter.ts`
  - Purpose: Session storage, job queues (BullMQ), Socket.io scaling, caching

**File Storage:**
- Cloudinary - Primary media storage (images, PDFs, certificates)
- Local filesystem - Temporary file processing, uploads via multer

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation:
    - Backend: `pft-backend/src/app/middlewares/auth.ts`
    - Super-admin: `pfr-super-admin/lib/auth-jwt.ts`, `super-admin/lib/auth-jwt.ts`
  - Token generation: `jsonwebtoken` 9.0.2 (backend), `jose` 6.1.2 (frontend)
  - Password hashing: `bcryptjs` 2.4.3/3.0.3
  - Session management: JWT tokens with refresh mechanism
  - 2FA: OTP support via `input-otp` package

**Authorization:**
- Role-based access control (RBAC)
- API key authentication for external webhooks
  - Implementation: `pft-backend/src/app/modules/ExternalWebhook/apiKey.service.ts`

## Monitoring & Observability

**Error Tracking:**
- LogRocket - Frontend error tracking and session replay
  - Implementation: `pft-dashboard/src/utils/logrocket.ts`
  - Purpose: User session recording, error tracking, performance monitoring

**Analytics:**
- Microsoft Clarity - User behavior analytics
  - SDK/Client: `@microsoft/clarity` 1.0.2
  - Implementation: `pft-dashboard/src/hooks/useClarity.ts`
  - Backend: `pft-backend/src/app/modules/Clarity/`
  - Purpose: Heatmaps, session recordings, user insights

- Vercel Analytics - Performance and web vitals
  - SDK/Client: `@vercel/analytics` 1.5.0, `@vercel/speed-insights` 1.3.1
  - Implementation: `pft-dashboard/` (Next.js integration)
  - Purpose: Core Web Vitals, performance monitoring

**Logs:**
- Winston - Structured logging
  - Implementation: `winston` 3.17.0
  - Format: JSON with timestamps, log levels
  - Transports: Console, file (configurable)

**Health Checks:**
- Custom health check endpoints
  - Implementation: `pft-rule-checker/src/app/controllers/healthCheck.controller.ts`
  - Monitors: Database connection, Redis connection, system metrics

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js applications (dashboard, super-admin)
- Custom servers - Backend and worker services (PM2 managed)
- Docker - Containerization support (Dockerfile in `pft-dashboard/`)

**CI Pipeline:**
- Not explicitly configured in codebase
- Build scripts available in package.json for all projects

**Process Management:**
- PM2 - Production process manager
  - Config: `pft-backend/ecosystem.config.js`, `pft-rule-checker/ecosystem.config.js`
  - Features: Clustering, auto-restart, log management

## Environment Configuration

**Required env vars (Backend):**
- `DATABASE_URL` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `NOWPAYMENTS_API_KEY` - NOWPayments API key
- `CLOUDINARY_*` - Cloudinary credentials (dynamic config)
- `SMTP_*` - Email server configuration (dynamic config)
- `PROJECT_NAME` - Application identifier
- `PROJECT_SUPPORT_EMAIL` - Support contact email

**Required env vars (Frontend):**
- `NEXT_PUBLIC_API_URL` - Backend API endpoint
- `NEXT_PUBLIC_SOCKET_URL` - Socket.io server endpoint

**Required env vars (MT5 REST API):**
- `MongoConnectionString` - MongoDB connection
- `RuleCheckerUrl` - Rule checker service endpoint
- `MasterApiKey` - API authentication key

**Secrets location:**
- Environment variables (`.env` files, not committed)
- Database-stored configuration (email, payment gateways, Cloudinary)
- Super-admin configuration service for dynamic settings

## Webhooks & Callbacks

**Incoming:**
- Stripe webhooks - Payment events
  - Endpoint: `pft-backend/src/app/modules/Payment/services/stripe-webhook.service.ts`
  - Verification: Signature validation via `STRIPE_WEBHOOK_SECRET`

- NOWPayments IPN - Crypto payment notifications
  - Endpoint: Configured via `NOWPAYMENTS_CALLBACK_URL`
  - Handler: `pft-backend/src/app/modules/Payment/services/callback.service.ts`

- Veriff webhooks - KYC verification results
  - Endpoint: `pft-backend/src/app/modules/Kyc/veriff.controller.ts`
  - Events: Session status updates, verification decisions

- Intercom webhooks - Customer support events
  - Endpoint: `pft-backend/src/app/modules/Intercom/intercom.webhook.ts`

- External webhooks - Custom integrations
  - Endpoint: `pft-backend/src/app/modules/ExternalWebhook/`
  - Auth: API key validation

**Outgoing:**
- Email notifications - Nodemailer to SMTP providers
  - Implementation: `pft-backend/src/app/services/email/sendEmail.service.ts`
  - Providers: Postmark, SendGrid, Zoho, custom SMTP
  - Features: Template system, BCC for Trustpilot reviews

- Trustpilot BCC - Review invitation emails
  - Implementation: Automatic BCC on positive events
  - Triggers: Payout approved, challenge passed, funded achieved

- Rule checker callbacks - MT5 REST API to rule checker
  - URL: Configured in `mt5-rest-api-deploy/appsettings.json`
  - Purpose: Real-time trade rule validation

## Real-Time Communication

**Socket.io:**
- Server: `pft-backend/`, `pft-rule-checker/`
- Client: `pft-dashboard/` via `socket.io-client` 4.8.1
- Implementation:
  - Server: `pft-backend/src/app/services/notifications/socket.ts`
  - Server: `pft-rule-checker/src/app/services/socket/socketService.ts`
  - Client: `pft-dashboard/src/hooks/useNotifications.ts`
- Redis adapter: Enabled for horizontal scaling
- Purpose: Real-time notifications, trade updates, account snapshots

**WebSocket:**
- Native WebSocket support via `ws` 8.17.1/8.18.3
- Used for low-level connections in broker integrations

## Email Delivery

**Nodemailer:**
- Implementation: `pft-backend/src/app/services/email/sendEmail.service.ts`
- Configuration: Dynamic via `pft-backend/src/app/modules/Admin/EmailConfig/`
- Supported providers:
  - Postmark (port 587, STARTTLS)
  - SendGrid (port 587, STARTTLS)
  - Zoho (standard SMTP)
  - Custom SMTP servers
- Features:
  - Template system with variable substitution
  - Email logging and retry mechanism
  - BCC support for Trustpilot integration
  - Event-based email triggering

---

*Integration audit: 2026-02-08*
