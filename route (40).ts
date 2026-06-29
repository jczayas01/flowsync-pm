// src/app/api/m365/outlook/route.ts
// GET /api/m365/outlook?projectId=  — emails detected for a project

import { NextRequest } from "next/server"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { detectProjectEmails } from "@/lib/m365/outlook"

async function getOutlookEmails(ctx: ApiContext) {
  const url = new URL(ctx.req.url)
  const projectId = url.searchParams.get("projectId") || undefined
  const emails = await detectProjectEmails(ctx.userId, projectId ? [projectId] : undefined)
  return ok(emails)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getOutlookEmails)
}
