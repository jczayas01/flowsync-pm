// src/app/api/webhooks/route.ts — list + create outbound webhooks.
// The signing secret is returned once on create; managed by workspace admins.
import { NextRequest } from "next/server"
import { z } from "zod"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"

export const WH_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]

const iso = (d: any) => (d instanceof Date ? d.toISOString() : d) || undefined

export const toView = (w: any, includeSecret = false) => ({
  id: w.id, url: w.url, events: w.events, isActive: w.isActive,
  secret: includeSecret ? w.secret : undefined,
  createdAt: iso(w.createdAt),
  lastTriggeredAt: w.lastTriggeredAt ? iso(w.lastTriggeredAt) : undefined,
  successCount: w.successCount, errorCount: w.errorCount,
})

const createSchema = z.object({
  url:    z.string().url(),
  events: z.array(z.string()).min(1),
})

async function listWebhooks(ctx: ApiContext) {
  if (!WH_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const rows = await db.webhook.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } })
  return ok(rows.map(w => toView(w)))
}

async function createWebhook(ctx: ApiContext) {
  if (!WH_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const secret = `whsec_${randomBytes(20).toString("hex")}`
  const w = await db.webhook.create({
    data: { workspaceId: ctx.workspaceId, url: parsed.data.url, events: parsed.data.events, secret, createdById: ctx.userId },
  })
  return ok({ webhook: toView(w, true), secret })
}

export async function GET(req: NextRequest)  { return withWorkspace(req, listWebhooks) }
export async function POST(req: NextRequest) { return withWorkspace(req, createWebhook) }
