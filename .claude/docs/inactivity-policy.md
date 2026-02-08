# Inactivity Policy System

## Overview

The inactivity policy automatically warns and breaches trading accounts that have been inactive for too long. This helps manage costs (broker charges for active accounts) and ensures traders are actively using their accounts.

## Configuration

Located at `/admin/broker-config` in the dashboard under "Inactivity Policy":

| Setting | Default | Description |
|---------|---------|-------------|
| `isEnabled` | `false` | Master toggle for the entire system |
| `warningDays` | `15` | Days of inactivity before warning email is sent |
| `breachDays` | `30` | Days of inactivity before account is breached |
| `description` | - | Optional description for admin reference |

**Important**: `breachDays` must be greater than `warningDays`.

## How It Works

### Normal Flow (New Accounts)

```
Day 0:  User stops trading
Day 15: Warning email sent, inactivityWarningSent: true, inactivityWarningSentAt: <date>
Day 30: If no trading since warning → Account breached
```

### Grace Period Calculation

The breach happens **15 days after warning is sent** (breachDays - warningDays), NOT 30 days from last trade.

This means:
- If warning sent on Jan 1, breach happens on Jan 16 (if no trading)
- If user trades on Jan 10, they're safe (traded after warning)
- User must trade AFTER receiving the warning to avoid breach

### Historical/Stale Accounts

Accounts that were inactive before the policy was enabled need special handling:

```
December 2021 Account (1000+ days inactive, never warned):
1. Admin sees count on broker-config page
2. Admin clicks "Send Warnings"
3. Warning email sent TODAY, inactivityWarningSentAt: TODAY
4. User has 15 days from TODAY to trade
5. If no trading → breached
```

## Key Files

### Backend (`pft-backend`)

| File | Purpose |
|------|---------|
| `src/app/modules/Admin/InactivityPolicy/inactivity-cron.service.ts` | Main cron logic, runs every hour |
| `src/app/modules/Admin/InactivityPolicy/inactivity-policy.service.ts` | Config CRUD operations |
| `src/app/modules/Admin/InactivityPolicy/inactivity-policy.controller.ts` | API endpoints |
| `src/app/modules/Admin/InactivityPolicy/inactivity-policy.routes.ts` | Route definitions |
| `src/app/modules/Auth/auth.model.ts` | User/Program schema with inactivity fields |

### Dashboard (`pft-dashboard`)

| File | Purpose |
|------|---------|
| `src/hooks/useInactivityPolicy.ts` | React Query hooks for API calls |
| `src/app/(dashboard)/_components/modules/admin/broker-config/BrokerConfigContainer.tsx` | Admin UI |

## API Endpoints

All endpoints require admin authentication.

### GET `/api/admin/inactivity-policy`
Returns current configuration.

### PATCH `/api/admin/inactivity-policy`
Updates configuration.

```json
{
  "isEnabled": true,
  "warningDays": 15,
  "breachDays": 30,
  "description": "Default policy"
}
```

### GET `/api/admin/inactivity-policy/stale-accounts`
Returns accounts that are inactive > breachDays but never received a warning.

```json
{
  "totalCount": 42,
  "accounts": [
    {
      "userId": "...",
      "email": "user@example.com",
      "firstName": "John",
      "mt5AccountId": "12345678",
      "programId": "...",
      "programName": "Phase 1 - $10K",
      "createdAt": "2021-12-15T00:00:00Z",
      "daysInactive": 1100,
      "lastActivityDate": "2021-12-20T00:00:00Z"
    }
  ]
}
```

### POST `/api/admin/inactivity-policy/process-historical`
Sends warning emails to stale accounts, giving them a fresh grace period.

```json
{
  "processed": 42,
  "warned": 40,
  "errors": 2
}
```

## Database Fields (Program subdocument)

| Field | Type | Description |
|-------|------|-------------|
| `inactivityWarningSent` | Boolean | Whether warning email was sent |
| `inactivityWarningSentAt` | Date | When warning was sent (used for breach timing) |
| `inactivityBreachProcessed` | Boolean | Whether breach was executed |
| `inactivityBreachProcessedAt` | Date | When breach was processed |

## Cron Job Details

**Location**: `pft-backend/src/server.ts`
**Frequency**: Every 1 hour
**Also runs**: On server startup

### Logic Flow

```typescript
1. Check if policy is enabled
2. Query users with programs that are:
   - isBanned: false
   - isPassed: false
   - Has mt5AccountId
   - Has createdAt

3. For each program:
   a. Get last activity from:
      - AccountRuleState.lastTradeCloseTime (primary, real-time)
      - TradeHistory (fallback, may be delayed)
      - program.createdAt (default if no trades)

   b. Calculate daysInactive

   c. If daysInactive >= warningDays AND not warned:
      → Send warning email
      → Set inactivityWarningSent: true
      → Set inactivityWarningSentAt: now

   d. If warned AND daysSinceWarning >= gracePeriod AND not traded after warning:
      → Send breach email
      → Breach account via MT5WorkerProxyService
      → Set inactivityBreachProcessed: true
```

## Email Templates

Two email templates are used (configured in email service):

1. `inactivity_warning` - Sent when user reaches warning threshold
2. `inactivity_breach` - Sent when account is breached

### Template Variables

| Variable | Description |
|----------|-------------|
| `user_name` | User's first name |
| `account_id` | MT5 account ID |
| `program_name` | Program display name |
| `days_inactive` | Number of days inactive |
| `breach_days` | Days until breach (from warning) |
| `breach_date` | Formatted breach date |
| `dashboard_url` | Link to dashboard |
| `site_name` | Project display name |

## Common Issues & Fixes

### Accounts not appearing in disable queue
**Cause**: Account was never breached (isBanned: false)
**Fix**: Check if inactivityWarningSent is true. If not, use "Send Warnings" button.

### Old accounts breached immediately after warning
**Cause**: Old bug where breach checked days since last trade, not days since warning
**Fix**: Now checks `daysSinceWarning >= (breachDays - warningDays)`

### Warning emails not sending
**Cause**: Email template not configured or email service down
**Fix**: Check email service logs, verify template exists

### Cron not running
**Cause**: Server restart, policy disabled
**Fix**: Check server logs for "Inactivity enforcement run completed"

## Extending the System

### Adding New Warning Levels

To add multiple warning levels (e.g., 7-day, 14-day, 21-day warnings):

1. Add new fields to auth.model.ts:
   ```typescript
   inactivityWarning1SentAt: { type: Date },
   inactivityWarning2SentAt: { type: Date },
   ```

2. Update cron logic to check each threshold

3. Add corresponding email templates

### Changing Grace Period Logic

The grace period is calculated as `breachDays - warningDays`. To make it configurable:

1. Add `gracePeriodDays` to InactivityPolicy model
2. Update the breach check in cron service
3. Add UI field in broker-config

### Excluding Certain Programs

To exclude specific programs (e.g., live/funded accounts):

```typescript
// Already implemented - live accounts are skipped
if (program.accountType === "live") continue;
```

To add more exclusions, modify the query in `checkAndEnforce()`.

## Testing

### Manual Testing Steps

1. Create test account with old `createdAt` date
2. Enable inactivity policy with short thresholds (e.g., 1 day warning, 2 day breach)
3. Wait for cron or trigger manually
4. Verify warning email sent
5. Wait for breach threshold
6. Verify account breached

### Triggering Cron Manually

The cron runs on server startup. To force a run:
```bash
# Restart the backend server
pm2 restart pft-backend
```

Or add a debug endpoint (not recommended for production).
