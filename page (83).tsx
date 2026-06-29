// src/app/api/automation/rules/[ruleId]/route.ts
// PATCH  /api/automation/rules/:id  — update rule
// DELETE /api/automation/rules/:id  — delete rule

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, audit, ApiContext } from "@/lib/api"

const updateSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  isActive:    z.boolean().optional(),
  conditions:  z.array(z.any()).optional(),
  actions:     z.array(z.any()).optional(),
}).strict()

async function updateRule(ctx: ApiContext, params?: Record<string,string>) {
  const id     = params?.ruleId
  if (!id) return err("Rule ID required")
  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const updates = parsed.data
  await db.$executeRaw`
    UPDATE automation_rules SET
      ${updates.name        !== undefined ? db.$queryRaw`name = ${updates.name},`        : db.$queryRaw``}
      ${updates.isActive    !== undefined ? db.$queryRaw`is_active = ${updates.isActive},` : db.$queryRaw``}
      ${updates.conditions  !== undefined ? db.$queryRaw`conditions = ${JSON.stringify(updates.conditions)}::jsonb,` : db.$queryRaw``}
      ${updates.actions     !== undefined ? db.$queryRaw`actions = ${JSON.stringify(updates.actions)}::jsonb,` : db.$queryRaw``}
      updated_at = NOW()
    WHERE id = ${id} AND workspace_id = ${ctx.workspaceId}
  `.catch(e => { throw new Error(e.message) })

  return ok({ id, ...updates })
}

async function deleteRule(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.ruleId
  if (!id) return err("Rule ID required")
  await db.$executeRaw`DELETE FROM automation_rules WHERE id = ${id} AND workspace_id = ${ctx.workspaceId}`
  await audit(ctx.workspaceId, ctx.userId, "automation.rule_deleted" as any, "automation_rule", id)
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { ruleId: string } }) {
  return withWorkspace(req, updateRule, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { ruleId: string } }) {
  return withWorkspace(req, deleteRule, params)
}
