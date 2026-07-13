// POST /api/projects/:projectId/export-pdf — generate a branded Status Report PDF
export const dynamic = "force-dynamic"
export const maxDuration = 30

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { generateReportPdf } from "@/lib/pdf-report"

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const reportData = body?.reportData
  if (!reportData) return NextResponse.json({ error: "reportData required" }, { status: 400 })

  const [project, workspace] = await Promise.all([
    db.project.findUnique({ where: { id: params.projectId }, select: { name: true, code: true } }),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, primaryColor: true } }),
  ])
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  try {
    const bytes = await generateReportPdf({
      org: workspace?.name || "FlowSync PM",
      color: (workspace as any)?.primaryColor || undefined,
      projectName: project.name,
      projectCode: project.code,
      report: reportData,
    })
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${project.code}_Report.pdf"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "PDF generation failed" }, { status: 500 })
  }
}
