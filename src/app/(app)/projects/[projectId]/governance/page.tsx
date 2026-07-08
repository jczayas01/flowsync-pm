import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { GovernanceHub } from "@/components/projects/tabs/GovernanceHub"

export default async function GovernancePage({ params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId:true }
  })

  const [project, charter, qmp, wbsEntries, requirements, minutes, handover, tasks, members] = await Promise.all([
    db.project.findUnique({
      where: { id:params.projectId },
      select: { id:true, name:true, code:true, methodology:true, workspace:{ select:{ primaryColor:true, name:true, logoUrl:true } } }
    }),
    db.teamCharter.findUnique({ where:{ projectId:params.projectId } }),
    db.qualityManagementPlan.findUnique({ where:{ projectId:params.projectId } }),
    db.wbsEntry.findMany({ where:{ projectId:params.projectId }, orderBy:{ code:"asc" } }),
    db.requirement.findMany({ where:{ projectId:params.projectId }, orderBy:{ code:"asc" } }),
    db.meetingMinutes.findMany({
      where:{ projectId:params.projectId }, orderBy:{ meetingDate:"desc" }, take:20,
      include:{ createdBy:{ select:{ id:true,name:true,avatarUrl:true } } }
    }),
    db.transitionPlan.findUnique({ where:{ projectId:params.projectId } }),
    db.task.findMany({ where:{ projectId:params.projectId }, select:{ id:true,code:true,title:true,status:true } }),
    db.projectMember.findMany({ where:{ projectId:params.projectId }, include:{ user:{ select:{ id:true,name:true } } } }),
  ])

  return (
    <GovernanceHub
      projectId={params.projectId}
      workspaceId={membership?.workspaceId||""}
      project={project as any}
      charter={charter as any}
      qmp={qmp as any}
      wbsEntries={wbsEntries as any}
      requirements={requirements as any}
      minutes={minutes as any}
      handover={handover as any}
      tasks={tasks as any}
      members={members as any}
    />
  )
}
