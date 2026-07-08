// src/app/api/automation/rules/route.ts — list + create automation rules.
// Managed by workspace admins (matches the manage-integrations nav gate).
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"

export const AUTO_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]

const iso = (d: any) => (d instanceof Date ? d.toISOString() : d) || undefined

export const toView = (r: any) => ({
  id: r.id, name: r.name, trigger: r.trigger, condition: r.condition || "",
  action: r.action, isActive: r.isActive, runCount: r.runCount,
  lastRunAt: r.lastRunAt ? iso(r.lastRunAt) : undefined, createdAt: iso(r.createdAt),
})

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
