import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { ProjectDashboardTab } from '@/components//projects/tabs/ProjectDashboardTab'

export default async function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const activeWs = (session.user as any).activeWorkspaceId as string | undefined
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, ...(activeWs ? { workspaceId: activeWs } : {}) },
    select: { workspaceId:true }
  })

  const [project, tasks, risks, milestones, budgetItems, members, statusUpdates, phases, portfolios, programs, goalLinks] = await Promise.all([
    db.project.findFirst({
      // Scoped to the member's workspace — the layout gate is the primary
      // check; this keeps a stray query from ever crossing tenants.
      where:  { id: params.projectId, workspaceId: membership?.workspaceId || '__none__' },
      select: {
        id:true, name:true, code:true, description:true,
        objective:true, scope:true, outOfScope:true, background:true,
        assumptions:true, constraints:true,
        economicImpact:true, priority:true, isConfidential:true,
        methodology:true, status:true, health:true,
        startDate:true, endDate:true, percentComplete:true, autoEv:true,
        budgetTotal:true, budgetSpent:true, currency:true,
        programId:true,
        program: { select:{ id:true, name:true, portfolio:{ select:{ id:true, name:true } } } },
        workspace: { select:{ id:true, name:true, primaryColor:true, secondaryColor:true } },
      },
    }),
    db.task.findMany({
      where:   { projectId: params.projectId },
      orderBy: [{ phaseId:'asc' }, { sortOrder:'asc' }],
      // The S-curve and time-phased PV need the whole schedule, not a preview
      // slice — 20 tasks produced a curve that ignored most of the project.
      take: 500,
      include: { assignees: { include: { projectMember: { include: { user: { select:{ id:true, name:true, avatarUrl:true } } } } } } },
    }),
    db.risk.findMany({
      where:   { projectId: params.projectId, status: { in:['OPEN','TRIGGERED'] } },
      orderBy: { score:'desc' },
      take: 5,
    }),
    db.milestone.findMany({
      // The panel manages milestones, so it needs all of them: filtering to
      // UPCOMING/AT_RISK made a milestone disappear the moment it was achieved,
      // which reads as data loss even though the record was intact.
      where:   { projectId: params.projectId },
      orderBy: { dueDate:'asc' },
      take: 100,
      include: { acceptedBy: { select:{ id:true, name:true } } },
    }),
    db.budgetItem.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt:'asc' },
    }),
    db.projectMember.findMany({
      where:   { projectId: params.projectId },
      include: { user: { select:{ id:true, name:true, avatarUrl:true } } },
      orderBy: { joinedAt:'asc' },
    }),
    db.statusUpdate.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt:'desc' },
      take: 10,
      select: {
        id:true, type:true, periodStart:true, periodEnd:true, health:true,
        summary:true, accomplishments:true, nextSteps:true, risks:true, issues:true,
        percentComplete:true, createdAt:true, createdById:true,
      },
    }),
    db.phase.findMany({
      where:   { projectId: params.projectId },
      orderBy: { order:'asc' },
      select:  { id:true, name:true, status:true, order:true, plannedStart:true, plannedEnd:true, gateApproved:true },
    }),
    db.portfolio.findMany({
      where:   { workspaceId: membership?.workspaceId||"" },
      select:  { id:true, name:true, color:true },
      orderBy: { name:'asc' },
    }),
    db.program.findMany({
      where:   { portfolio:{ workspaceId: membership?.workspaceId||"" } },
      select:  { id:true, name:true, portfolioId:true },
      orderBy: { name:'asc' },
    }),
    // Strategic goals this project rolls up to (the reverse of the Goals→project link)
    db.goalProject.findMany({
      where:   { projectId: params.projectId },
      include: { goal: { select:{ id:true, title:true, type:true, status:true, progress:true } } },
    }),
  ])

  return (
    <ProjectDashboardTab
      project={{ ...project,
        budgetTotal: project?.budgetTotal ? Number(project.budgetTotal) : 0,
        budgetSpent: project?.budgetSpent ? Number(project.budgetSpent) : 0,
      } as any}
      projectId={params.projectId}
      tasks={tasks as any}
      risks={risks as any}
      milestones={milestones as any}
      budgetItems={budgetItems.map(b => ({
        ...b,
        plannedCost: b.plannedCost ? Number(b.plannedCost) : 0,
        actualCost:  b.actualCost  ? Number(b.actualCost)  : 0,
        earnedValue: b.earnedValue ? Number(b.earnedValue) : 0,
      })) as any}
      members={members as any}
      statusUpdates={statusUpdates as any}
      phases={phases as any}
      portfolios={portfolios as any}
      programs={programs as any}
      linkedGoals={goalLinks.map((g:any)=>g.goal) as any}
    />
  )
}
