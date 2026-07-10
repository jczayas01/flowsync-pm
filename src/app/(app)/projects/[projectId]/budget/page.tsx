// src/app/(app)/projects/[projectId]/budget/page.tsx
import { db } from '@/lib//db'
import { ProjectBudgetTab } from '@/components//projects/tabs/ProjectBudgetTab'

export default async function ProjectBudgetPage({ params }: { params: { projectId: string } }) {
  const [project, budgetItems, timeEntries] = await Promise.all([
    db.project.findUnique({
      where:  { id: params.projectId },
      select: { budgetTotal:true, budgetSpent:true, currency:true, startDate:true, endDate:true },
    }),
    db.budgetItem.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt:'asc' },
    }),
    db.timeEntry.findMany({
      where:   { projectId: params.projectId, billable: true },
      orderBy: { date:'desc' },
      include: { user: { select:{ id:true, name:true } } },
    }),
  ])

  const serializedProject = project ? {
    ...project,
    budgetTotal: project.budgetTotal ? Number(project.budgetTotal) : 0,
    budgetSpent: project.budgetSpent ? Number(project.budgetSpent) : 0,
  } : null

  const serializedBudgetItems = budgetItems.map(b => ({
    ...b,
    plannedCost: b.plannedCost ? Number(b.plannedCost) : 0,
    actualCost:  b.actualCost  ? Number(b.actualCost)  : 0,
    earnedValue: b.earnedValue ? Number(b.earnedValue) : 0,
  }))

  const serializedTimeEntries = timeEntries.map(t => ({
    ...t,
    hours:      t.hours      ? Number(t.hours)      : 0,
    hourlyRate: t.hourlyRate ? Number(t.hourlyRate) : 0,
  }))

  return (
    <ProjectBudgetTab
      projectId={params.projectId}
      project={serializedProject as any}
      budgetItems={serializedBudgetItems as any}
      timeEntries={serializedTimeEntries as any}
    />
  )
}
