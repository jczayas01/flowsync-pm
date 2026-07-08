// src/app/(app)/projects/new/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { NewProjectForm } from "@/components/projects/NewProjectForm"

export const metadata: Metadata = { title: "New project" }

export default async function NewProjectPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const membership = await db.workspaceMember.findFirst({
    where:  { userId: session.user.id },
    select: { workspaceId:true, role:true },
  })
  if (!membership) redirect("/onboarding")

  const members = await db.workspaceMember.findMany({
    where:   { workspaceId: membership.workspaceId },
    include: { user: { select:{ id:true, name:true, email:true, avatarUrl:true } } },
  })

  return (
    <NewProjectForm
      workspaceId={membership.workspaceId}
      members={members as any}
    />
  )
}
