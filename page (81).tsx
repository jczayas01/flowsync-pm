// src/app/api/automation/rules/route.ts
// GET  /api/automation/rules  — list workspace/project rules
// POST /api/automation/rules  — create rule

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, err, parseBody, getSearchParams, audit, ApiContext } from "@/lib/api"
import { requireFeature } from "@/lib/stripe/guards"

const createRuleSchema = z.object({
  projectId:   z.string().cuid().optional().nullable(),
  name:        z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  scope:       z.enum(["workspace","project","program"]).default("project"),
  isActive:    z.boolean().default(true),
  trigger: z.object({
    type:   z.string(),
    params: z.record(z.unknown()).default({}),
  }),
  conditions: z.array(z.object({
    field:    z.string(),
    operator: z.string(),
    value:    z.union([z.string(), z.number(), z.array(z.string())]),
  })).default([]),
  actions: z.array(z.object({
    type:   z.string(),
    params: z.record(z.unknown()).default({}),
  })).min(1, "At least one action required"),
  recipeId: z.string().optional(),
})

async function listRules(ctx: ApiContext) {
  const guard = await requireFeature(ctx.workspaceId, "aiCopilot") // automation requires Pro+
  if (guard) return guard

  const { page, perPage, skip, take, url } = getSearchParams(ctx.req)
  const projectId = url.searchParams.get("projectId") || undefined
  const active    = url.searchParams.get("active")

  const where: any = {
    workspace_id: ctx.workspaceId,
    ...(projectId && { project_id: projectId }),
    ...(active === "true"  && { is_active: true }),
    ...(active === "false" && { is_active: false }),
  }

  const [rules, total] = await Promise.all([
    db.$queryRaw<any[]>`
      SELECT ar.*, u.name as creator_name
      FROM automation_rules ar
      LEFT JOIN users u ON u.id = ar.created_by_id
      WHERE ar.workspace_id = ${ctx.workspaceId}
      ${projectId ? db.$queryRaw`AND ar.project_id = ${projectId}` : db.$queryRaw``}
      ORDER BY ar.created_at DESC
      LIMIT ${take} OFFSET ${skip}
    `.catch(() => []),
    db.$queryRaw<any[]>`SELECT COUNT(*) as count FROM automation_rules WHERE workspace_id = ${ctx.workspaceId}`.catch(() => [{ count: 0 }]),
  ])

  return okList(rules, Number(total[0]?.count || 0), page, perPage)
}

async function createRule(ctx: ApiContext) {
  const guard = await requireFeature(ctx.workspaceId, "aiCopilot")
  if (guard) return guard

  const parsed = await parseBody(ctx.req, createRuleSchema)
  if ("error" in parsed) return parsed.error

  const { data } = parsed
  const id = crypto.randomUUID()

  await db.$executeRaw`
    INSERT INTO automation_rules (
      id, workspace_id, project_id, name, description, scope, is_active,
      trigger_type, trigger_config, conditions, actions, recipe_id,
      run_count, created_by_id, created_at, updated_at
    ) VALUES (
      ${id}, ${ctx.workspaceId}, ${data.projectId || null}, ${data.name},
      ${data.description || null}, ${data.scope}, ${data.isActive},
      ${data.trigger.type}, ${JSON.stringify(data.trigger)}::jsonb,
      ${JSON.stringify(data.conditions)}::jsonb,
      ${JSON.stringify(data.actions)}::jsonb,
      ${data.recipeId || null}, 0, ${ctx.userId}, NOW(), NOW()
    )
  `.catch(e => { throw new Error(`Failed to create rule: ${e.message}`) })

  await audit(ctx.workspaceId, ctx.userId, "automation.rule_created" as any, "automation_rule", id,
    undefined, { name: data.name, trigger: data.trigger.type })

  return ok({ id, ...data }, 201)
}

export async function GET(req: NextRequest) { return withWorkspace(req, listRules) }
export async function POST(req: NextRequest) { return withWorkspace(req, createRule) }
