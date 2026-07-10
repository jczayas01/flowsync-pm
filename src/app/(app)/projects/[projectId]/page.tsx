import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { ProjectDashboardTab } from '@/components//projects/tabs/ProjectDashboardTab'

export default async function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [project, tasks, risks, milestones, budgetItems, members, statusUpdates, phases, portfolios, programs, goalLinks] = await Promise.all([
    db.project.findUnique({
      where:  { id: params.projectId },
      select: {
        id:true, name:true, code:true, description:true,
        objective:true, scope:true, outOfScope:true, background:true,
        assumptions:true, constraints:true,
        economicImpact:true, priority:true, isConfidential:true,
        methodology:true, status:true, health:true,
        startDate:true, endDate:true, percentComplete:true,
        budgetTotal:true, budgetSpent:true, currency:true,
        programId:true,
        program: { select:{ id:true, name:true, portfolio:{ select:{ id:true, name:true } } } },
        workspace: { select:{ id:true, name:true } },
      },
    }),
    db.task.findMany({
      where:   { projectId: params.projectId },
      orderBy: [{ phaseId:'asc' }, { sortOrder:'asc' }],
      take: 20,
      include: { assignees: { include: { projectMember: { include: { user: { select:{ id:true, name:true, avatarUrl:true } } } } } } },
    }),
    db.risk.findMany({
      where:   { projectId: params.projectId, status: { in:['OPEN','TRIGGERED'] } },
      orderBy: { score:'desc' },
      take: 5,
    }),
    db.milestone.findMany({
      where:   { projectId: params.projectId, status: { in:['UPCOMING','AT_RISK'] } },
      orderBy: { dueDate:'asc' },
      take: 5,
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
