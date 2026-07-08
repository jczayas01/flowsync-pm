// src/app/api/m365/teams/route.ts
// GET /api/m365/teams  — meetings and chats detected for projects

import { NextRequest } from "next/server"
import { withWorkspace, ok, ApiContext } from "@/lib/api"
import { detectProjectMeetings, detectProjectChatMentions } from "@/lib/m365/teams"

async function getTeamsData(ctx: ApiContext) {
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
