// src/app/(app)/goals/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { projectVisibilityWhere } from "@/lib/security/project-visibility"
import { GoalsView } from "@/components/goals/GoalsView"

export const metadata: Metadata = { title: "Goals & OKRs" }

export default async function GoalsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!membership) redirect("/onboarding")

  const raw = await db.goal.findMany({
    where:   { workspaceId: membership.workspaceId },
    include: {
      owner:      { select: { id: true, name: true, avatarUrl: true } },
      keyResults: { orderBy: { createdAt: "asc" } },
      // Linked projects carry LIVE progress/health — the goal reflects real project
      // state automatically (flow + sync), not a manually re-keyed snapshot.
      projects:   { include: { project: { select: {
        id: true, code: true, name: true, percentComplete: true, health: true, status: true,
      } } } },
    },
    orderBy: { createdAt: "desc" },
  })

  const goals = raw.map((g) => ({
    id:          g.id,
    title:       g.title,
    description: g.description,
    type:        g.type,
    quarter:     g.quarter,
    status:      g.status,
    progress:    g.progress,
    owner:       g.owner ? { id: g.owner.id, name: g.owner.name } : null,
    keyResults:  g.keyResults.map((kr) => ({
      id: kr.id, title: kr.title, target: kr.target, current: kr.currentValue,
      baseline: kr.baseline, unit: kr.unit, progress: kr.progress,
    })),
    linkedProjects: g.projects.map((gp) => gp.project),
  }))

  // Workspace projects available to link (for the picker).
  const projects = await db.project.findMany({
    where:   { workspaceId: membership.workspaceId, status: { in: ["ACTIVE", "ON_HOLD", "DRAFT"] },
               AND: [projectVisibilityWhere(session.user.id, membership.role)] },
    select:  { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  })

  return (
    <GoalsView
      goals={goals}
      projects={projects}
      workspaceId={membership.workspaceId}
      userRole={membership.role}
    />
  )
}
