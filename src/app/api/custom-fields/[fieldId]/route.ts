// src/app/api/custom-fields/[fieldId]/route.ts — update / delete a custom field.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, parseBody, ApiContext } from "@/lib/api"
import { CF_ADMIN_ROLES, toView } from "@/lib/api/handlers/custom-fields"

const updateSchema = z.object({
  name:        z.string().min(1).optional(),
  required:    z.boolean().optional(),
  isActive:    z.boolean().optional(),
  options:     z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
})

async function updateField(ctx: ApiContext, params?: Record<string, string>) {
  if (!CF_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.fieldId
  if (!id) return err("Field ID required")
  const existing = await db.customField.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Custom field")
  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data
  const data: any = {}
  if (d.name !== undefined)        data.name = d.name
  if (d.required !== undefined)    data.required = d.required
  if (d.isActive !== undefined)    data.isActive = d.isActive
  if (d.description !== undefined) data.description = d.description
  if (d.options !== undefined)     data.options = d.options as any
  const f = await db.customField.update({ where: { id }, data })
  return ok(toView(f))
}

async function deleteField(ctx: ApiContext, params?: Record<string, string>) {
  if (!CF_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.fieldId
  if (!id) return err("Field ID required")
  const existing = await db.customField.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Custom field")
  await db.customField.delete({ where: { id } })
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { fieldId: string } }) {
  return withWorkspace(req, updateField, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { fieldId: string } }) {
  return withWorkspace(req, deleteField, params)
}
