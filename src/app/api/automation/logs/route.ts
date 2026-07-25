// src/app/api/automation/logs/route.ts
// GET /api/automation/logs  — execution history

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, getSearchParams, ApiContext } from "@/lib/api"

async function getLogs(ctx: ApiContext) {
  const { page, perPage, skip, take, url } = getSearchParams(ctx.req)
  const ruleId    = url.searchParams.get("ruleId")    || undefined
  const projectId = url.searchParams.get("projectId") || undefined

  const [rows, total] = await Promise.all([
    db.automationLog.findMany({
      where:   { workspaceId: ctx.workspaceId, ...(ruleId ? { ruleId } : {}) },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    db.automationLog.count({
      where: { workspaceId: ctx.workspaceId, ...(ruleId ? { ruleId } : {}) },
    }),
  ]).catch(() => [[], 0] as const)

  // Keys the Execution logs tab reads: rule_name, trigger_context, status, created_at
  const logs = rows.map(l => ({
    id: l.id,
    rule_name:       l.ruleName,
    trigger_context: `${l.trigger} → ${l.action}${l.message ? ` · ${l.message}` : ""}`,
    status:          l.status,
    created_at:      l.createdAt,
  }))
  return okList(logs, total, page, perPage)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getLogs)
}
