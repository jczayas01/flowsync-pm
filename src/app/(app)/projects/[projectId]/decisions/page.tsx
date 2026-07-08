import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DecisionsTab } from "@/components/projects/tabs/DecisionsTab"

export default async function DecisionsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({ where:{ userId:session.user.id }, select:{ workspaceId:true } })
  const decisions = await db.decision.findMany({ where:{ projectId:params.projectId }, orderBy:{ madeAt:"desc" },
    include:{ madeBy:{ select:{ id:true,name:true,avatarUrl:true } } } })
  return <DecisionsTab projectId={params.projectId} workspaceId={membership?.workspaceId||""} decisions={decisions as any} />
}
