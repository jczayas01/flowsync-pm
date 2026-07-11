// src/app/api/m365/sync/route.ts
// POST /api/m365/sync  — trigger M365 sync for current user
// GET  /api/m365/sync  — get latest sync results (smart inbox)

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { runFullSync, acceptSuggestion } from "@/lib/m365/sync"
import { z } from "zod"

const acceptSchema = z.object({
  type:      z.enum(["email","meeting","chat"]),
  entityId:  z.string(),
  projectId: z.string().min(1),
  action:    z.enum(["log_minutes","create_task","log_risk","update_task"]),
  data:      z.record(z.unknown()).default({}),
})

async function syncM365(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:manage_integrations"); if (_g) return _g
  if (process.env.ENABLE_M365_INTEGRATION !== "true") {
    return err("M365 integration is not enabled", 503)
  }

  const payload = await runFullSync(ctx.userId)
  return ok(payload)
}

async function acceptM365Suggestion(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "workspace:manage_integrations"); if (_g) return _g
  const body = await ctx.req.json().catch(() => ({}))
  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) return err("Invalid request body", 422)

  const { type, entityId, projectId, action, data } = parsed.data
  const result = await acceptSuggestion(ctx.userId, type, entityId, projectId, action, data as any)

  return ok(result)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, syncM365)
}
export async function POST(req: NextRequest) {
  return withWorkspace(req, acceptM365Suggestion)
}
