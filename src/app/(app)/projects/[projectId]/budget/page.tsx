// src/app/(app)/projects/[projectId]/budget/page.tsx
import { db } from '@/lib//db'
import { auth } from '@/lib//auth'
import { redirect } from 'next/navigation'
import { ProjectBudgetTab } from '@/components//projects/tabs/ProjectBudgetTab'
import { syncProjectLabor } from '@/lib/labor-accrual'

export default async function ProjectBudgetPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId: true },
  })
  // Mirror accrued labour onto its budget line before reading, so EVM's actual
  // cost is current. Idempotent (SET, not increment) — safe on every load.
  await syncProjectLabor(params.projectId).catch(() => {})

  const [project, budgetItems] = await Promise.all([
    db.project.findUnique({
      where:  { id: params.projectId },
      // A narrow select is how a saved setting looks broken: the write succeeds,
      // the page reloads, and the value it was never asked for comes back
      // undefined — so the UI falls to its default and the change appears lost.
      select: {
        budgetTotal:true, budgetSpent:true, currency:true, startDate:true, endDate:true,
        percentComplete:true, autoEv:true, eacMethod:true, eacManualEtc:true,
      },
    }),
    db.budgetItem.findMany({
      where:   { projectId: params.projectId },
      orderBy: [{ sortOrder:'asc' }, { createdAt:'asc' }],
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

  return (
    <ProjectBudgetTab
      projectId={params.projectId}
      project={serializedProject as any}
      budgetItems={serializedBudgetItems as any}
      workspaceId={membership?.workspaceId || ''}
    />
  )
}
