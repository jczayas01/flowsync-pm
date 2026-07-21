// src/app/api/automation/rules/route.ts — list + create automation rules.
// Managed by workspace admins (matches the manage-integrations nav gate).
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { checkPlanLimit } from "@/lib/stripe/client"
import { withWorkspace, ok, err, forbidden, parseBody, ApiContext } from "@/lib/api"

import { AUTO_ADMIN_ROLES, toView } from "@/lib/api/handlers/automation"

const createSchema = z.object({
  name:      z.string().min(1),
  trigger:   z.string().min(1),
  action:    z.string().min(1),
  condition: z.string().optional().nullable(),
  isActive:  z.boolean().optional(),
})

async function listRules(ctx: ApiContext) {
  if (!AUTO_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const rows = await db.automationRule.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } })
  return ok(rows.map(toView))
}

async function createRule(ctx: ApiContext) {
  if (!AUTO_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()

  // Plan cap: Starter allows a limited number of rules; Business+ unlimited.
  const ws = await db.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { plan: true } })
  const current = await db.automationRule.count({ where: { workspaceId: ctx.workspaceId } })
  const cap = checkPlanLimit((ws?.plan ?? "FREE") as any, "automations", current)
  if (!cap.allowed) {
    return err(`Your plan includes ${cap.limit} automation rules. Upgrade to Business for unlimited rules (Settings → Billing).`, 402)
  }

  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data
  const r = await db.automationRule.create({
    data: {
      workspaceId: ctx.workspaceId, name: d.name, trigger: d.trigger, action: d.action,
      condition: d.condition ?? null, isActive: d.isActive ?? true, createdById: ctx.userId,
    },
  })
  return ok(toView(r))
}

export async function GET(req: NextRequest)  { return withWorkspace(req, listRules) }
export async function POST(req: NextRequest) { return withWorkspace(req, createRule) }
