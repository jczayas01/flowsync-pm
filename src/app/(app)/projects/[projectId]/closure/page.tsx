import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ClosureTab } from "@/components/projects/tabs/ClosureTab"

export default async function ClosurePage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({ where:{ userId:session.user.id }, select:{ workspaceId:true } })
  const [closure, project] = await Promise.all([
    db.projectClosure.findUnique({ where:{ projectId:params.projectId } }),
    db.project.findUnique({ where:{ id:params.projectId }, select:{ name:true,code:true,status:true } }),
  ])
  return <ClosureTab projectId={params.projectId} workspaceId={membership?.workspaceId||""} closure={closure as any} project={project as any} />
}
