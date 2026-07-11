// src/app/api/api-keys/route.ts — list + create API keys.
// Keys are hashed at rest (sha-256); the full key is returned exactly once, on create.
// Managed by workspace admins only.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"

import { KEY_ADMIN_ROLES, sha, toView } from "@/lib/api/handlers/api-keys"

const createSchema = z.object({
  name:   z.string().min(1),
  scopes: z.array(z.string()).optional(),
})

async function listKeys(ctx: ApiContext) {
  if (!KEY_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const keys = await db.apiKey.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } })
  return ok(keys.map(toView))
}

async function createKey(ctx: ApiContext) {
  if (!KEY_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const raw = `pxpm_live_${randomBytes(24).toString("hex")}`
  const prefix = raw.slice(0, 16) + "…"
  const key = await db.apiKey.create({
    data: {
      workspaceId: ctx.workspaceId, name: parsed.data.name,
      keyHash: sha(raw), prefix, scopes: parsed.data.scopes || [], createdById: ctx.userId,
    },
  })
  // The raw key is included only in this response — it is never stored or shown again.
  return ok({ key: raw, apiKey: toView(key) })
}

export async function GET(req: NextRequest)  { return withWorkspace(req, listKeys) }
export async function POST(req: NextRequest) { return withWorkspace(req, createKey) }
