// src/app/api/m365/outlook/route.ts
// GET /api/m365/outlook?projectId=  — emails detected for a project

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { requireFeature } from "@/lib/stripe/guards"
import { detectProjectEmails } from "@/lib/m365/outlook"

async function getOutlookEmails(ctx: ApiContext) {
  // Plan gate: Microsoft 365 integration is Business-tier (trial included).
  const m365Guard = await requireFeature(ctx.workspaceId, "m365")
  if (m365Guard) return m365Guard

  const url = new URL(ctx.req.url)
  const projectId = url.searchParams.get("projectId") || undefined
  const emails = await detectProjectEmails(ctx.userId, projectId ? [projectId] : undefined)
  return ok(emails)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getOutlookEmails)
}
