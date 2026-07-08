import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { BenefitsTab } from "@/components/projects/tabs/BenefitsTab"

export default async function BenefitsPage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({ where:{ userId:session.user.id }, select:{ workspaceId:true } })
  const [benefits, members] = await Promise.all([
    db.benefit.findMany({ where:{ projectId:params.projectId }, orderBy:{ createdAt:"asc" },
      include:{ owner:{ select:{ id:true,name:true,avatarUrl:true } } } }),
    db.projectMember.findMany({ where:{ projectId:params.projectId }, include:{ user:{ select:{ id:true,name:true } } } }),
  ])
  return <BenefitsTab projectId={params.projectId} workspaceId={membership?.workspaceId||""} benefits={benefits as any} members={members as any} />
}
