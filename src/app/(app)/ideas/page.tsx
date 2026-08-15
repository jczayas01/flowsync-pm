// src/app/(app)/ideas/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { IdeasWorkspace } from "@/components/ideas/IdeasWorkspace"

export const metadata: Metadata = { title: "Ideas" }
export const dynamic = "force-dynamic"

export default async function IdeasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }, select: { workspaceId: true },
  })
  if (!membership) redirect("/onboarding")
  return <IdeasWorkspace workspaceId={membership.workspaceId} />
}
