// src/app/(app)/intake/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { mapDbRoleToRbac, can } from "@/lib/rbac/roles"
import { IntakeView } from "@/components/intake/IntakeView"

export const metadata: Metadata = { title: "Project Intake" }

export default async function IntakePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId: true, role: true },
  })
  if (!membership) redirect("/onboarding")

  const role = mapDbRoleToRbac(membership.role)
  const canEval = ["EXECUTIVE","PMO_DIRECTOR","SUPER_ADMIN","OWNER","ADMIN"].includes(role)
  const viewAll = canEval

  let items: any[] = []
  try {
    items = await db.projectIntake.findMany({
      where: { workspaceId: membership.workspaceId, ...(viewAll ? {} : { submittedById: session.user.id }) },
      orderBy: { createdAt: "desc" },
      include: {
        submittedBy: { select: { id:true, name:true } },
        reviewedBy:  { select: { id:true, name:true } },
      },
    })
  } catch { items = [] }

  // Files fetched separately so a files issue can never hide the intake list
  const filesByIntake: Record<string, any[]> = {}
  try {
    const fileRows = await db.intakeFile.findMany({
      where:  { intakeId: { in: items.map(i => i.id) } },
      select: { id:true, name:true, fileUrl:true, fileType:true, intakeId:true },
    })
    for (const f of fileRows) (filesByIntake[f.intakeId] ||= []).push(f)
  } catch { /* table not migrated yet — list still shows */ }

  const plain = items.map(i => ({
    id: i.id, title: i.title, description: i.description, problem: i.problem,
    expectedValue: i.expectedValue, urgency: i.urgency, status: i.status,
    reviewNote: i.reviewNote, convertedProjectId: i.convertedProjectId,
    createdAt: i.createdAt, submittedBy: i.submittedBy?.name || "Someone",
    submittedById: i.submittedById,
    reviewedBy: i.reviewedBy?.name || null,
    files: filesByIntake[i.id] || [],
  }))

  return <IntakeView items={plain}
    currentUserId={session.user.id}
    canSubmit={role !== "CLIENT"}
    canReview={canEval}
    canApprove={canEval}
    canConvert={canEval} />
}
