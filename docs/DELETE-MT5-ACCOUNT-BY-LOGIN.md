# Delete MT5 Account by Login

## Endpoint

```
DELETE /api/users/mt5-account/:login
```

## Description

Deletes an MT5 account directly by login ID via the MT5 REST API. Does not require the account to exist in the database — it sends the deletion command directly to the MT5 server and also cleans up any matching DB records.

## Access

- **Roles**: Admin, BackOffice
- **Auth**: Bearer token required

## Parameters

| Parameter | Type   | Location | Required | Description              |
|-----------|--------|----------|----------|--------------------------|
| login     | number | path     | Yes      | MT5 account login ID     |

## Example Request

```bash
curl -X DELETE \
  'https://xpips-backend-v2.propfirmstech.com/api/users/mt5-account/889228804' \
  -H 'authorization: Bearer <token>' \
  -H 'accept: application/json'
```

## Responses

### 200 — Success

```json
{
  "success": true,
  "message": "MT5 account 889228804 deleted successfully",
  "data": { "login": 889228804 }
}
```

### 400 — Invalid Login

```json
{
  "success": false,
  "message": "Valid numeric login ID is required"
}
```

### 500 — MT5 Server Error

Possible MT5 error codes:

| Code | Meaning                                              |
|------|------------------------------------------------------|
| 0    | Done (success)                                       |
| 8    | Not enough permissions (USER_DELETE not granted)      |
| 13   | Account not found on MT5 server                      |
| 14   | Account belongs to manager/administrator group        |

## Behavior

1. Validates login is a valid number
2. Connects to MT5 server and sends `USER_DELETE` command (30s timeout)
3. Removes matching program entries from the database (`programs.mt5AccountId`)
4. Logs the action to the audit log with severity `warning`
