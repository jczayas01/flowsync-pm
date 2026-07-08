import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { BaselinesPage } from "@/components/projects/BaselinesPage"

export default async function ProjectBaselinesPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [baselines, project, changeRequests, tasks] = await Promise.all([
    db.baseline.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy:  { select:{ id:true, name:true, avatarUrl:true } },
        approvedBy: { select:{ id:true, name:true, avatarUrl:true } },
      },
    }),
    db.project.findUnique({
      where:  { id: params.projectId },
      select: { name:true, code:true, status:true, startDate:true, endDate:true,
                budgetTotal:true, currency:true },
    }),
    db.changeRequest.findMany({
      where:   { projectId: params.projectId, status:"IMPLEMENTED" },
      orderBy: { implementedAt:"desc" },
      select:  { id:true, code:true, title:true, status:true, implementedAt:true,
                 scheduleImpact:true, budgetImpact:true, scopeImpact:true },
    }),
    db.task.findMany({
      where:   { projectId: params.projectId },
      orderBy: { sortOrder: "asc" },
      select:  { id:true, code:true, title:true, status:true,
                 startDate:true, dueDate:true, percentComplete:true, phaseId:true },
    }),
  ])

  return (
    <BaselinesPage
      projectId={params.projectId}
      workspaceId={membership?.workspaceId || ""}
      baselines={baselines.map(b => ({ ...b, budgetTotal: Number(b.budgetTotal) })) as any}
      project={{ ...project, budgetTotal: project?.budgetTotal ? Number(project.budgetTotal) : 0 } as any}
      changeRequests={changeRequests as any}
      tasks={tasks as any}
    />
  )
}
