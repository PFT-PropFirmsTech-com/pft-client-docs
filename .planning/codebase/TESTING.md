# Testing Patterns

**Analysis Date:** 2026-02-08

## Test Framework

**Backend (pft-backend):**
- Jest 29.7.0
- ts-jest 29.2.5 (TypeScript support)
- Config: Not found (likely using defaults or inline config)

**Frontend (pft-dashboard):**
- No test framework detected
- No test files found

**Worker (pft-rule-checker):**
- No test framework detected
- No test files found

**Run Commands:**
```bash
# Backend (pft-backend)
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:webhook        # Webhook-specific tests
npm run test:webhook:live   # Live webhook testing
```

## Test File Organization

**Location:**
- Backend test directory exists: `pft-backend/test/`
- No test files currently present in project
- Test files found only in node_modules dependencies

**Naming:**
- Expected pattern: `*.test.ts` or `*.spec.ts`
- No project test files to analyze

**Structure:**
```
pft-backend/
├── src/
│   └── app/
│       └── modules/
│           └── [Module]/
│               ├── [module].service.ts
│               ├── [module].controller.ts
│               └── [module].test.ts (expected, not present)
└── test/
    └── (empty)
```

## Test Structure

**Suite Organization:**
Not applicable - no test files present in codebase.

**Expected Pattern (based on Jest configuration):**
```typescript
import { describe, it, expect } from '@jest/globals';

describe('ModuleName', () => {
  describe('methodName', () => {
    it('should handle expected case', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle error case', () => {
      // Test error handling
    });
  });
});
```

## Mocking

**Framework:** Jest (built-in mocking)

**Expected Patterns:**
```typescript
// Mock external dependencies
jest.mock('../../utils/logger');
jest.mock('../Auth/auth.model');

// Mock functions
const mockFunction = jest.fn();
mockFunction.mockResolvedValue(data);
mockFunction.mockRejectedValue(error);

// Spy on methods
jest.spyOn(Service, 'method').mockImplementation(() => result);
```

**What to Mock:**
- External API calls (MetaAPI, payment gateways)
- Database models (Mongoose models)
- File system operations
- Logger calls
- Third-party services (Cloudinary, Stripe, etc.)

**What NOT to Mock:**
- Pure utility functions
- Type definitions
- Constants
- Simple data transformations

## Fixtures and Factories

**Test Data:**
Not applicable - no test fixtures found in codebase.

**Expected Location:**
- `pft-backend/test/fixtures/` (directory exists but empty)
- `pft-backend/test/factories/` (not present)

**Recommended Pattern:**
```typescript
// test/fixtures/user.fixture.ts
export const mockUser = {
  _id: 'user123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: ['user'],
};

export const mockProgram = {
  _id: 'program123',
  programId: 'prog123',
  mt5Login: '12345',
  status: 'active',
};
```

## Coverage

**Requirements:** Not enforced (no coverage thresholds in package.json)

**View Coverage:**
```bash
cd pft-backend
npm run test:coverage
```

**Coverage Output:**
- HTML report (expected location: `coverage/`)
- Console summary

## Test Types

**Unit Tests:**
- Scope: Individual functions and methods
- Focus: Service layer business logic, utility functions
- Isolation: Mock all external dependencies
- Location: Co-located with source files or in `test/` directory

**Integration Tests:**
- Scope: Multiple modules working together
- Focus: API endpoints, database operations
- Isolation: Use test database, mock external APIs only
- Location: `test/integration/` (not present)

**E2E Tests:**
- Not implemented
- No E2E framework detected

## Common Patterns

**Async Testing:**
```typescript
// Using async/await
it('should fetch data asynchronously', async () => {
  const result = await service.getData();
  expect(result).toBeDefined();
});

// Using done callback (legacy)
it('should handle callback', (done) => {
  service.getData((err, result) => {
    expect(err).toBeNull();
    expect(result).toBeDefined();
    done();
  });
});
```

**Error Testing:**
```typescript
// Testing thrown errors
it('should throw AppError for invalid input', async () => {
  await expect(service.method(invalidInput))
    .rejects
    .toThrow(AppError);
});

// Testing error properties
it('should throw error with correct status code', async () => {
  try {
    await service.method(invalidInput);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
  }
});
```

**Controller Testing:**
```typescript
// Test Express controllers with mocked req/res
it('should return success response', async () => {
  const req = {
    params: { id: '123' },
    query: {},
    body: {},
  } as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  await controller.method(req, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      data: expect.any(Object),
    })
  );
});
```

**Service Testing:**
```typescript
// Test service methods with mocked dependencies
describe('StatisticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get trade history with caching', async () => {
    // Mock database calls
    jest.spyOn(TradeHistory, 'find').mockResolvedValue(mockTrades);
    jest.spyOn(AccountOverview, 'findOne').mockResolvedValue(mockOverview);

    const result = await StatisticsService.getTradeHistoryOptimized(query);

    expect(result.tradeHistory).toHaveLength(mockTrades.length);
    expect(result.accountOverview).toEqual(mockOverview);
  });
});
```

**Database Testing:**
```typescript
// Use in-memory MongoDB or test database
beforeAll(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(async () => {
  // Clean up test data
  await User.deleteMany({});
  await Program.deleteMany({});
});
```

## Testing Gaps

**Current State:**
- No test files present in main codebase
- Test infrastructure configured but not utilized
- Test directory exists but is empty

**Critical Untested Areas:**
- `pft-backend/src/app/modules/` - All business logic modules
- `pft-backend/src/app/services/` - External service integrations
- `pft-backend/src/app/utils/` - Utility functions
- `pft-backend/src/app/middlewares/` - Request middleware
- `pft-dashboard/src/hooks/` - React hooks
- `pft-dashboard/src/lib/api/` - API client
- `pft-rule-checker/src/` - Rule checking logic

**High Priority for Testing:**
1. Authentication flow (`pft-backend/src/app/modules/Auth/`)
2. Payment processing (`pft-backend/src/app/modules/Payment/`)
3. Trade history and statistics (`pft-backend/src/app/modules/Statistics/`)
4. User management (`pft-backend/src/app/modules/User/`)
5. Error handling middleware (`pft-backend/src/app/middlewares/globalErrorhandler.ts`)

**Recommended Test Coverage Targets:**
- Services: 80%+ coverage
- Controllers: 70%+ coverage
- Utilities: 90%+ coverage
- Middleware: 80%+ coverage

## Test Environment Setup

**Environment Variables:**
```bash
# .env.test (recommended)
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/pft-test
JWT_SECRET=test-secret
# Other test-specific configs
```

**Test Database:**
- Use separate test database
- Reset between test runs
- Consider using MongoDB Memory Server for unit tests

**External Service Mocking:**
- Mock MetaAPI SDK calls
- Mock payment gateway APIs (Stripe, NowPayments)
- Mock email service (Nodemailer)
- Mock file upload services (Cloudinary)

## Continuous Integration

**CI Configuration:**
- Not detected in `.github/workflows/`
- Recommended: Add GitHub Actions workflow for automated testing

**Recommended CI Pipeline:**
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

---

*Testing analysis: 2026-02-08*
