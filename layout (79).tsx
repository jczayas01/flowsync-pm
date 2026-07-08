// src/app/api/automation/logs/route.ts
// GET /api/automation/logs  — execution history

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, getSearchParams, ApiContext } from "@/lib/api"

async function getLogs(ctx: ApiContext) {
  const { page, perPage, skip, take, url } = getSearchParams(ctx.req)
  const ruleId    = url.searchParams.get("ruleId")    || undefined
  const projectId = url.searchParams.get("projectId") || undefined

  const logs = await db.$queryRaw<any[]>`
    SELECT al.*, ar.name as rule_name
    FROM automation_logs al
    LEFT JOIN automation_rules ar ON ar.id = al.rule_id
    WHERE al.workspace_id = ${ctx.workspaceId}
    ${ruleId    ? db.$queryRaw`AND al.rule_id = ${ruleId}`       : db.$queryRaw``}
    ORDER BY al.created_at DESC
    LIMIT ${take} OFFSET ${skip}
  `.catch(() => [])

  return okList(logs, logs.length, page, perPage)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getLogs)
}
