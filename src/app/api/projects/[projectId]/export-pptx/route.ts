// POST /api/projects/:projectId/export-pptx — branded PowerPoint status deck
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { generateProjectDeck, DeckAudience } from "@/lib/pptx-deck"

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
  const audience: DeckAudience = body?.audience === "TEAM" ? "TEAM" : "EXECUTIVE"

  const pid = params.projectId
  const [project, phases, tasks, risks, milestones, decisions, pendingChanges, budgetItems, workspace] =
    await Promise.all([
      db.project.findUnique({
        where: { id: pid },
        select: {
          name: true, code: true, health: true, status: true, percentComplete: true,
          startDate: true, endDate: true, budgetTotal: true, budgetSpent: true,
          currency: true, objective: true,
        },
      }),
      db.phase.findMany({ where: { projectId: pid }, select: { id: true, name: true, order: true }, orderBy: { order: "asc" } }),
      db.task.findMany({ where: { projectId: pid }, select: { title: true, status: true, percentComplete: true, startDate: true, dueDate: true, phaseId: true } }),
      db.risk.findMany({ where: { projectId: pid }, select: { title: true, score: true, status: true, isOpportunity: true } }),
      db.milestone.findMany({ where: { projectId: pid }, select: { name: true, dueDate: true, status: true } }),
      db.decision.findMany({ where: { projectId: pid }, select: { code: true, title: true }, orderBy: { madeAt: "desc" }, take: 5 }),
      db.changeRequest.count({ where: { projectId: pid, status: { in: ["SUBMITTED", "UNDER_REVIEW"] as any } } }).catch(() => 0),
      db.budgetItem.findMany({ where: { projectId: pid }, select: { category: true, plannedCost: true, actualCost: true } }),
      db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, primaryColor: true, accentColor: true } }),
    ])
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const catMap: Record<string, { planned: number; actual: number }> = {}
  for (const b of budgetItems) {
    const k = String(b.category || "OTHER")
    catMap[k] = catMap[k] || { planned: 0, actual: 0 }
    catMap[k].planned += Number(b.plannedCost || 0)
    catMap[k].actual += Number(b.actualCost || 0)
  }
  const budgetByCategory = Object.entries(catMap)
    .map(([category, v]) => ({ category, ...v }))
    .filter(c => c.planned > 0 || c.actual > 0)
    .sort((a, b) => b.planned - a.planned)

  try {
    const buf = await generateProjectDeck({
      workspace: { name: workspace?.name || "FlowSync PM", primaryColor: workspace?.primaryColor, accentColor: (workspace as any)?.accentColor },
      project, phases, tasks, risks, milestones, decisions,
      pendingChanges: Number(pendingChanges || 0),
      budgetByCategory,
    }, audience)

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${project.code}_${audience === "TEAM" ? "Review" : "Executive"}_Deck.pptx"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Deck generation failed" }, { status: 500 })
  }
}
