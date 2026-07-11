// src/app/(app)/my-tasks/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { MyTasksView } from "@/components/mytasks/MyTasksView"
import { mapDbRoleToRbac, ROLE_LEVEL } from "@/lib/rbac/roles"
import { signRef } from "@/lib/storage"

export const metadata: Metadata = { title: "My Tasks" }

export default async function MyTasksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  if (!membership) redirect("/onboarding")

  const rbacRole = mapDbRoleToRbac(membership.role)
  const restricted = ROLE_LEVEL[rbacRole] < 50   // below PM: no full-project access from here

  let tasks: any[] = []
  try {
    tasks = await db.task.findMany({
      where: {
        project:   { workspaceId: membership.workspaceId },
        assignees: { some: { userId: session.user.id } },
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        phase:   { select: { name: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: [{ dueDate: "asc" }],
    })
  } catch {
    tasks = []
  }

  const plain = tasks.map(t => ({
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    priority: t.priority,
    percentComplete: t.percentComplete,
    startDate: t.startDate,
    dueDate: t.dueDate,
    isMilestone: t.isMilestone,
    phaseName: t.phase?.name || null,
    projectId: t.project?.id,
    projectCode: t.project?.code,
    projectName: t.project?.name,
    contributions: (t.comments || []).map((c:any) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      authorId: c.authorId,
      authorName: c.author?.name || "Someone",
    })),
  }))

  // Documents shared with this user, from projects they belong to
  const isClient = rbacRole === "CLIENT"
  let sharedDocs: any[] = []
  try {
    sharedDocs = await db.document.findMany({
      where: {
        project: {
          workspaceId: membership.workspaceId,
          members: { some: { userId: session.user.id } },
        },
        OR: [
          { shares: { some: { userId: session.user.id } } },
          ...(isClient ? [{ sharedWithClient: true }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { project: { select: { code: true, name: true } } },
    })
  } catch { sharedDocs = [] }

  const docs = await Promise.all(sharedDocs.map(async d => ({
    id: d.id, name: d.name, fileUrl: await signRef(d.fileUrl), fileType: d.fileType,
    createdAt: d.createdAt, projectCode: d.project?.code, projectName: d.project?.name,
  })))

  return <MyTasksView tasks={plain} userName={session.user.name || "You"}
    userId={session.user.id} userLevel={ROLE_LEVEL[rbacRole] ?? 30} canOpenProject={!restricted} sharedDocs={docs} />
}
