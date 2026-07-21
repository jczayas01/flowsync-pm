// src/app/api/m365/teams/route.ts
// GET /api/m365/teams  — meetings and chats detected for projects

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, ApiContext } from "@/lib/api"
import { requireFeature } from "@/lib/stripe/guards"
import { detectProjectMeetings, detectProjectChatMentions } from "@/lib/m365/teams"

async function getTeamsData(ctx: ApiContext) {
  // Plan gate: Microsoft 365 integration is Business-tier (trial included).
  const m365Guard = await requireFeature(ctx.workspaceId, "m365")
  if (m365Guard) return m365Guard

  const url  = new URL(ctx.req.url)
  const days = parseInt(url.searchParams.get("days") || "7")

  const [meetings, chats] = await Promise.allSettled([
    detectProjectMeetings(ctx.userId, days),
    detectProjectChatMentions(ctx.userId),
  ])

  return ok({
    meetings: meetings.status === "fulfilled" ? meetings.value : [],
    chats:    chats.status    === "fulfilled" ? chats.value    : [],
  })
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getTeamsData)
}
