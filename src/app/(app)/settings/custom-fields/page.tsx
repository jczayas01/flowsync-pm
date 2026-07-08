// src/app/(app)/settings/custom-fields/page.tsx
import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { CustomFieldsView } from "@/components/settings/CustomFieldsView"
export const metadata: Metadata = { title: "Custom fields" }
export default async function CustomFieldsPage() {
  const session = await auth()
  if(!session?.user?.id) redirect("/auth/signin")
  const m = await db.workspaceMember.findFirst({ where:{ userId:session.user.id }, select:{ workspaceId:true, role:true } })
  if(!m) redirect("/onboarding")

  const rows = await db.customField.findMany({
    where:{ workspaceId:m.workspaceId }, orderBy:[{ order:"asc" },{ createdAt:"asc" }],
  })
  const initialFields = rows.map((f:any)=>({
    id:f.id, name:f.name, type:f.fieldType, entity:f.entityType, required:f.required,
    options: Array.isArray(f.options)?f.options:(f.options||[]),
    description: f.description||undefined, isActive: f.isActive,
  }))

  return <CustomFieldsView workspaceId={m.workspaceId} role={m.role} initialFields={initialFields as any} />
}
