// src/app/(app)/skills/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { SkillsView } from "@/components/resources/SkillsView"

export const metadata: Metadata = { title: "Skills" }

export default async function SkillsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const m = await db.workspaceMember.findFirst({ where:{ userId: session.user.id }, select:{ workspaceId:true } })
  if (!m) redirect("/onboarding")

  const rows = await db.workspaceMember.findMany({
    where:   { workspaceId: m.workspaceId },
    include: { user: { select: { id:true, name:true, avatarUrl:true } } },
    orderBy: { joinedAt: "asc" },
  })
  const members = rows.map((wm:any) => ({
    id: wm.id, name: wm.user?.name || "Member", avatarUrl: wm.user?.avatarUrl || null,
    role: wm.role, skills: Array.isArray(wm.skills) ? wm.skills : [],
  }))

  return <SkillsView members={members as any} workspaceId={m.workspaceId} />
}
