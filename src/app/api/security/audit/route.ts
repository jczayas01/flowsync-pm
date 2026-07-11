// src/app/api/security/audit/route.ts
// GET /api/security/audit  — query audit logs (ADMIN+ only)

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"
import { queryAuditLog } from "@/lib/security/audit"

async function getAuditLogs(ctx: ApiContext) {
  const guard = await requirePermission(ctx as any, "workspace:view_audit_log")
  if (guard) return guard

  const url       = new URL(ctx.req.url)
  const page      = parseInt(url.searchParams.get("page")   || "1")
  const perPage   = parseInt(url.searchParams.get("per")    || "50")
  const userId    = url.searchParams.get("userId")    || undefined
  const action    = url.searchParams.get("action")    || undefined
  const entityType= url.searchParams.get("entity")    || undefined
  const from      = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined
  const to        = url.searchParams.get("to")   ? new Date(url.searchParams.get("to")!)   : undefined

  const result = await queryAuditLog({
    workspaceId: ctx.workspaceId,
    userId,
    action:      action as any,
    entityType,
    from, to,
    page, perPage,
  })

  return ok(result)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getAuditLogs)
}
