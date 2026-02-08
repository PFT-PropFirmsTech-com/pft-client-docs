---
description: How to deploy a new MT5 SDK instance on a Windows VPS
---

# Deploy MT5 SDK on Windows VPS

This workflow guides you through deploying a new instance of the MT5 SDK (REST API) on a Windows server.

## 1. Connect to Server

First, establish an SSH connection to the Windows VPS.
**Note:** Some servers use port 7777, others use standard port 22. If 7777 fails with "Connection reset", try port 22.

```bash
# Verify connection (try port 22 first if 7777 fails)
nc -zv <IP> 22
nc -zv <IP> 7777
```

## 2. Locate Existing SDK

Find an existing SDK folder to use as a template (e.g., `EASY-Funding-SDK-5020`).

```powershell
# List directories in root to find SDKs
dir C:\
```

## 3. Copy SDK Folder

Copy the existing SDK to a new folder with the target port.

```powershell
# Example: Copy existing SDK to new folder
xcopy /E /I /H "C:\EASY-Funding-SDK-<SOURCE_PORT>" "C:\<NEW_NAME>-SDK-<TARGET_PORT>"
```

## 4. Configure SDK

Update `appsettings.json` in the new folder.
**Crucial:** PowerShell or echo commands may hang over SSH. It is safer to create the config locally and upload it via SCP.

**Config Template:**
```json
{
  "Server": "<MT5_SERVER_IP>:443",
  "Login": <MANAGER_ID>,
  "Password": "<MANAGER_PASSWORD>",
  "HttpPort": <TARGET_PORT>,
  "MaxConcurrentRequests": 5000,
  "AuthEnabled": true,
  "MasterApiKey": "PropFirmsTech",
  "EnableStreaming": true,
  "WebSocketPort": <WEBSOCKET_PORT>,
  "EnableBreachDetection": true,
  "RuleCheckerUrl": "wss://sdk.ws.<PROJECT>-rule-checker.propfirmstech.com"
}
```

**Upload:**
```bash
scp appsettings.json root@<IP>:"/C:/<NEW_NAME>-SDK-<TARGET_PORT>/appsettings.json"
```

## 5. Setup Persistence (Scheduled Task)

Do **NOT** use `start /B` over SSH as the process may die when the session ends.
Use `schtasks` to create a Windows Scheduled Task that runs on system start.

```powershell
# Create Scheduled Task
schtasks /create /tn "<NEW_NAME>-SDK" /tr "C:\<NEW_NAME>-SDK-<TARGET_PORT>\MT5RestAPI.exe" /sc onstart /ru SYSTEM /f

# Run immediately
schtasks /run /tn "<NEW_NAME>-SDK"
```

## 6. Verify Deployment

Check if the process is running and ports are listening.

```powershell
# Check process
wmic process where "Name LIKE 'MT5RestAPI%'" get Name,ProcessId,ExecutablePath

# Check ports (HTTP and WebSocket)
netstat -an | findstr <TARGET_PORT>
netstat -an | findstr <WEBSOCKET_PORT>
```

## 7. Check Logs

Verify the login was successful in the logs.

```powershell
cd C:\<NEW_NAME>-SDK-<TARGET_PORT>\logs
dir /OD
type <LATEST_LOG_FILE>
```
