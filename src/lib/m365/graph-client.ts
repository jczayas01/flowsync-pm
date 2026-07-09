// src/lib/m365/graph-client.ts
// Microsoft Graph API authenticated client
// Handles token acquisition, refresh, and all Graph HTTP calls

import { db } from "@/lib/db"

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const TOKEN_URL  = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || "common"}/oauth2/v2.0/token`

// ── Scopes needed per feature ──
export const GRAPH_SCOPES = {
  // Read user's emails tagged to projects
  mail:       ["Mail.Read", "Mail.ReadWrite"],
  // Read Teams meetings and messages
  teams:      ["OnlineMeetings.Read", "ChannelMessage.Read.All", "Chat.Read"],
  // Sync with Microsoft Planner
  planner:    ["Tasks.Read", "Tasks.ReadWrite", "Group.Read.All"],
  // Read calendar for meeting detection
  calendar:   ["Calendars.Read"],
  // Read user profile + directory
  profile:    ["User.Read", "User.ReadBasic.All"],
  // SharePoint document libraries
  sharepoint: ["Sites.Read.All", "Files.Read.All"],
}

// ─────────────────────────────────────────────
// TOKEN MANAGEMENT
// ─────────────────────────────────────────────

interface GraphToken {
  accessToken:  string
  expiresAt:    Date
  refreshToken: string | null
}

/**
 * Get a valid Graph access token for a user.
 * Refreshes automatically if expired.
 */
export async function getGraphToken(userId: string): Promise<GraphToken | null> {
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: { in: ["AZURE_AD", "MICROSOFT"] },
    },
    orderBy: { updatedAt: "desc" },
  })

  if (!account) return null

  // Check if token is still valid (with 5-min buffer)
  if (account.tokenExpiresAt && account.tokenExpiresAt > new Date(Date.now() + 5 * 60000)) {
    return {
      accessToken:  account.accessToken!,
      expiresAt:    account.tokenExpiresAt,
      refreshToken: account.refreshToken,
    }
  }

  // Refresh if we have a refresh token
  if (!account.refreshToken) return null

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        grant_type:    "refresh_token",
        refresh_token: account.refreshToken,
        scope:         [...GRAPH_SCOPES.mail, ...GRAPH_SCOPES.teams,
                        ...GRAPH_SCOPES.calendar, ...GRAPH_SCOPES.planner,
                        "offline_access"].join(" "),
      }),
    })

    if (!res.ok) {
      console.error("[Graph] Token refresh failed:", await res.text())
      return null
    }

    const tokens = await res.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Persist refreshed tokens
    await db.account.update({
      where: { id: account.id },
      data: {
        accessToken:     tokens.access_token,
        refreshToken:    tokens.refresh_token || account.refreshToken,
        tokenExpiresAt:  expiresAt,
      },
    })

    return {
      accessToken:  tokens.access_token,
      expiresAt,
      refreshToken: tokens.refresh_token || account.refreshToken,
    }
  } catch (e) {
    console.error("[Graph] Token refresh error:", e)
    return null
  }
}

// ─────────────────────────────────────────────
// GRAPH HTTP CLIENT
// ─────────────────────────────────────────────

export class GraphClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  static async forUser(userId: string): Promise<GraphClient | null> {
    const token = await getGraphToken(userId)
    if (!token) return null
    return new GraphClient(token.accessToken)
  }

  private async request<T>(
    path:    string,
    method:  string = "GET",
    body?:   unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = path.startsWith("https://") ? path : `${GRAPH_BASE}${path}`

    const res = await fetch(url, {
      method,
      headers: {
        Authorization:  `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ConsistencyLevel: "eventual",
        ...(headers || {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new GraphError(res.status, error?.error?.message || "Graph API error", error)
    }

    // 204 No Content
    if (res.status === 204) return {} as T
    return res.json()
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, "GET", undefined, headers)
  }
  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, "POST", body)
  }
  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, "PATCH", body)
  }
  delete(path: string): Promise<void> {
    return this.request(path, "DELETE")
  }

  // Paginate through all pages of a Graph list response
  async getAll<T>(path: string): Promise<T[]> {
    const results: T[] = []
    let url: string | null = path

    while (url) {
      const res: any = await this.get<any>(url)
      if (res.value) results.push(...res.value)
      url = res["@odata.nextLink"] || null
    }

    return results
  }
}

export class GraphError extends Error {
  constructor(
    public status:  number,
    message:        string,
    public details: unknown
  ) {
    super(message)
    this.name = "GraphError"
  }
}
