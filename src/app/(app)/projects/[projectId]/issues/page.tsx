import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { IssuesTab } from "@/components/projects/tabs/IssuesTab"

export default async function IssuesPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({ where:{ userId:session.user.id }, select:{ workspaceId:true } })
  const [issues, members] = await Promise.all([
    db.issue.findMany({ where:{ projectId:params.projectId }, orderBy:{ createdAt:"desc" },
      include:{ owner:{ select:{ id:true,name:true,avatarUrl:true } }, raisedBy:{ select:{ id:true,name:true,avatarUrl:true } } } }),
    db.projectMember.findMany({ where:{ projectId:params.projectId }, include:{ user:{ select:{ id:true,name:true,avatarUrl:true } } } }),
  ])
  return <IssuesTab projectId={params.projectId} workspaceId={membership?.workspaceId||""} issues={issues as any} members={members as any} />
}
