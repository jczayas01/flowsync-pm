import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CommPlanTab } from "@/components/projects/tabs/CommPlanTab"

export default async function CommsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({ where:{ userId:session.user.id }, select:{ workspaceId:true } })
  const [entries, members] = await Promise.all([
    db.commPlanEntry.findMany({ where:{ projectId:params.projectId }, orderBy:{ createdAt:"asc" },
      include:{ owner:{ select:{ id:true,name:true } } } }),
    db.projectMember.findMany({ where:{ projectId:params.projectId }, include:{ user:{ select:{ id:true,name:true } } } }),
  ])
  return <CommPlanTab projectId={params.projectId} workspaceId={membership?.workspaceId||""} entries={entries as any} members={members as any} />
}
