// src/app/api/projects/[projectId]/reports/chart-data/route.ts
// Web-report parity: same numbers behind the PDF's Performance Snapshot,
// served to the on-screen report view.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, notFound, verifyProjectAccess, ApiContext } from "@/lib/api"
import { getReportChartData } from "@/lib/report-chart-data"

async function get(ctx: ApiContext, params?: Record<string, string>) {
  const projectId = params?.projectId
  if (!projectId) return notFound("Project")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  const data = await getReportChartData(projectId).catch(() => ({}))
  return ok(data)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, get, params)
}
