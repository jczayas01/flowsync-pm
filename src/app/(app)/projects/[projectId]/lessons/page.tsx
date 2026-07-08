import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProjectLessonsTab } from "@/components/projects/tabs/ProjectLessonsTab"

export default async function ProjectLessonsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [lessons, phases] = await Promise.all([
    db.lessonLearned.findMany({
      where:   { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select:{ id:true, name:true, avatarUrl:true } } },
    }),
    db.phase.findMany({
      where:   { projectId: params.projectId },
      orderBy: { order: "asc" },
      select:  { id:true, name:true },
    }),
  ])

  return (
    <ProjectLessonsTab
      projectId={params.projectId}
      workspaceId={membership?.workspaceId || ""}
      lessons={lessons as any}
      phases={phases}
    />
  )
}
