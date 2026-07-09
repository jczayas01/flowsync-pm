// src/app/api/automation/rules/[ruleId]/route.ts — toggle/update or delete a rule.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, parseBody, ApiContext } from "@/lib/api"
import { AUTO_ADMIN_ROLES, toView } from "@/lib/api/handlers/automation"

const patchSchema = z.object({
  isActive:  z.boolean().optional(),
  name:      z.string().min(1).optional(),
  condition: z.string().optional().nullable(),
  action:    z.string().min(1).optional(),
  trigger:   z.string().min(1).optional(),
})

async function updateRule(ctx: ApiContext, params?: Record<string, string>) {
  if (!AUTO_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.ruleId
  if (!id) return err("Rule ID required")
  const existing = await db.automationRule.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Automation rule")
  const parsed = await parseBody(ctx.req, patchSchema)
  if ("error" in parsed) return parsed.error
  const r = await db.automationRule.update({ where: { id }, data: parsed.data as any })
  return ok(toView(r))
}

async function deleteRule(ctx: ApiContext, params?: Record<string, string>) {
  if (!AUTO_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.ruleId
  if (!id) return err("Rule ID required")
  const existing = await db.automationRule.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Automation rule")
  await db.automationRule.delete({ where: { id } })
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { ruleId: string } }) {
  return withWorkspace(req, updateRule, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { ruleId: string } }) {
  return withWorkspace(req, deleteRule, params)
}
