// src/app/api/api-keys/[keyId]/route.ts — revoke an API key.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, ApiContext } from "@/lib/api"
import { KEY_ADMIN_ROLES } from "@/lib/api/handlers/api-keys"

async function revokeKey(ctx: ApiContext, params?: Record<string, string>) {
  if (!KEY_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const id = params?.keyId
  if (!id) return err("Key ID required")
  const existing = await db.apiKey.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } })
  if (!existing) return notFound("API key")
  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
  return ok({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { keyId: string } }) {
  return withWorkspace(req, revokeKey, params)
}
