// src/app/api/webhooks/[webhookId]/route.ts — toggle/update or delete a webhook.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, parseBody, ApiContext } from "@/lib/api"
import { WH_ADMIN_ROLES, toView } from "@/lib/api/handlers/webhooks"

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  url:      z.string().url().optional(),
  events:   z.array(z.string()).min(1).optional(),
})

async function updateWebhook(ctx: ApiContext, params?: Record<string, string>) {
  if (!WH_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.webhookId
  if (!id) return err("Webhook ID required")
  const existing = await db.webhook.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Webhook")
  const parsed = await parseBody(ctx.req, patchSchema)
  if ("error" in parsed) return parsed.error
  const w = await db.webhook.update({ where: { id }, data: parsed.data as any })
  return ok(toView(w))
}

async function deleteWebhook(ctx: ApiContext, params?: Record<string, string>) {
  if (!WH_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.webhookId
  if (!id) return err("Webhook ID required")
  const existing = await db.webhook.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("Webhook")
  await db.webhook.delete({ where: { id } })
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { webhookId: string } }) {
  return withWorkspace(req, updateWebhook, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { webhookId: string } }) {
  return withWorkspace(req, deleteWebhook, params)
}
