// POST /api/workspace/export-pptx — portfolio-level PowerPoint (Dashboard / Executive)
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { generatePortfolioDeck, PortfolioFlavor } from "@/lib/pptx-deck"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id }, select: { id: true },
  })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const flavor: PortfolioFlavor = body?.flavor === "EXECUTIVE" ? "EXECUTIVE" : "DASHBOARD"

  const [workspace, projects, risks, milestones, decisions, pendingApprovals] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, primaryColor: true, accentColor: true } }),
    db.project.findMany({
      where: { workspaceId, status: { notIn: ["CANCELLED", "ARCHIVED"] as any } },
      select: { name: true, code: true, health: true, status: true, percentComplete: true, budgetTotal: true, budgetSpent: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.risk.findMany({
      where: { project: { workspaceId }, status: { not: "CLOSED" as any }, isOpportunity: false },
      select: { title: true, score: true, status: true, isOpportunity: true, project: { select: { name: true } } },
      orderBy: { score: "desc" }, take: 12,
    }),
    db.milestone.findMany({
      where: { project: { workspaceId }, status: { not: "ACHIEVED" as any }, dueDate: { gte: new Date() } },
      select: { name: true, dueDate: true, status: true, project: { select: { name: true } } },
      orderBy: { dueDate: "asc" }, take: 15,
    }),
    db.decision.findMany({
      where: { project: { workspaceId } },
      select: { code: true, title: true, project: { select: { name: true } } },
      orderBy: { madeAt: "desc" }, take: 5,
    }),
    db.project.count({ where: { workspaceId, status: "PENDING_APPROVAL" as any } }),
  ])

  try {
    const buf = await generatePortfolioDeck({
      workspace: { name: workspace?.name || "FlowSync PM", primaryColor: workspace?.primaryColor, accentColor: (workspace as any)?.accentColor },
      projects,
      risks: risks.map(r => ({ ...r, projectName: (r as any).project?.name })),
      milestones: milestones.map(m => ({ ...m, projectName: (m as any).project?.name })),
      decisions: decisions.map(d => ({ ...d, projectName: (d as any).project?.name })),
      pendingApprovals: Number(pendingApprovals || 0),
    }, flavor)

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${(workspace?.name || "Portfolio").replace(/[^a-zA-Z0-9]+/g, "_")}_${flavor === "EXECUTIVE" ? "Executive" : "Dashboard"}_Deck.pptx"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Deck generation failed" }, { status: 500 })
  }
}
