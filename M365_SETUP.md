# FlowSync PM — Microsoft 365 Integration Setup

## Step 1 — Register an Azure AD App

1. Go to https://portal.azure.com → Azure Active Directory → App registrations
2. Click **New registration**
3. Name: `FlowSync PM`
4. Supported account types: **Accounts in any organizational directory + personal Microsoft accounts**
5. Redirect URI: `https://your-domain.com/api/auth/callback/azure-ad`
   - Also add: `http://localhost:3000/api/auth/callback/azure-ad` (for dev)
6. Click **Register**

## Step 2 — Configure API Permissions

Under your app → API permissions → Add a permission → Microsoft Graph → Delegated:

| Permission | Purpose |
|---|---|
| `Mail.Read` | Read emails for project detection |
| `Mail.ReadWrite` | Tag emails as project-related |
| `Calendars.Read` | Detect Teams meetings |
| `OnlineMeetings.Read` | Read meeting details |
| `ChannelMessage.Read.All` | Read Teams channel messages |
| `Chat.Read` | Read Teams chats |
| `Tasks.Read` | Read Planner tasks |
| `Tasks.ReadWrite` | Create/update Planner tasks |
| `Group.Read.All` | Access Planner plans |
| `User.Read` | Read user profile |
| `User.ReadBasic.All` | Read directory for RACI |
| `Sites.Read.All` | SharePoint document libraries |
| `Files.Read.All` | Read SharePoint files |
| `offline_access` | Refresh tokens |

Click **Grant admin consent** for your organization.

## Step 3 — Create a Client Secret

App registrations → your app → Certificates & secrets → New client secret
- Description: `FlowSync PM Production`
- Expires: 24 months
- Copy the secret VALUE immediately (shown once)

## Step 4 — Fill in .env.local

```bash
AZURE_AD_CLIENT_ID="your-application-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret-value"
AZURE_AD_TENANT_ID="common"  # or your specific tenant ID

# Same app credentials for Graph API calls
GRAPH_CLIENT_ID="your-application-client-id"
GRAPH_CLIENT_SECRET="your-client-secret-value"
GRAPH_TENANT_ID="common"

# Enable the integration
ENABLE_M365_INTEGRATION="true"
```

## Step 5 — Register Webhook (for real-time push)

Once deployed, call:
```
POST /api/m365/connect?action=webhook
```

This registers a Graph subscription so new emails trigger instant detection
without polling. Graph will call your `/api/m365/webhook` endpoint in real time.

## Step 6 — Test the connection

1. Sign in with a Microsoft account (personal or organizational)
2. Call `GET /api/m365/connect` — should show `connected: true`
3. Call `GET /api/m365/sync` — returns detected emails, meetings, chats

## Architecture notes

- Tokens are stored encrypted in the `accounts` table
- Access tokens auto-refresh via the `getGraphToken()` helper
- The webhook handler always returns HTTP 200 to Graph (even on error)
  to avoid subscription cancellation
- Planner sync is idempotent — re-running won't duplicate tasks
  (tracked via `planner:{id}` in task description)
- Enable M365 per workspace — flip `ENABLE_M365_INTEGRATION=true`
  and let each user connect their own account
