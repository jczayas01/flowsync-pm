// src/app/(app)/settings/white-label/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { WhiteLabelView } from "@/components/settings/WhiteLabelView"
export const metadata: Metadata = { title: "White-label" }
export default async function WhiteLabelPage() {
  const session = await auth()
  if(!session?.user?.id) redirect("/auth/signin")
  const m = await db.workspaceMember.findFirst({
    where:{ userId:session.user.id }, include:{ workspace:true }
  })
  if(!m) redirect("/onboarding")
  return <WhiteLabelView workspace={m.workspace as any} role={m.role} />
}
