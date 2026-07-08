// src/app/api/reports/[templateId]/route.ts — update / delete a report template.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"
import { SECTION_IDS } from "../route"

const updateSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  audience:    z.enum(["TEAM","EXECUTIVE","CLIENT","SPONSOR"]).optional(),
  sections:    z.array(z.enum(SECTION_IDS)).min(1).optional(),
})

async function updateTemplate(ctx: ApiContext, params?: Record<string,string>) {
  const guard = await requirePermission(ctx as any, "reports:manage_templates" as any)
  if (guard) return guard
  const id = params?.templateId
  if (!id) return err("Template ID required")
  const existing = await db.reportTemplate.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Report template")
  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const updated = await db.reportTemplate.update({
    where: { id }, data: parsed.data as any,
    include: { creator: { select: { id: true, name: true } } },
  })
  return ok(updated)
}

async function deleteTemplate(ctx: ApiContext, params?: Record<string,string>) {
  const guard = await requirePermission(ctx as any, "reports:manage_templates" as any)
  if (guard) return guard
  const id = params?.templateId
  if (!id) return err("Template ID required")
  const existing = await db.reportTemplate.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Report template")
  await db.reportTemplate.delete({ where: { id } })
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { templateId: string } }) {
  return withWorkspace(req, updateTemplate, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { templateId: string } }) {
  return withWorkspace(req, deleteTemplate, params)
}
