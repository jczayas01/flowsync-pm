// src/app/api/api-keys/route.ts — list + create API keys.
// Keys are hashed at rest (sha-256); the full key is returned exactly once, on create.
// Managed by workspace admins only.
import { NextRequest } from "next/server"
import { z } from "zod"
import { createHash, randomBytes } from "crypto"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"

export const KEY_ADMIN_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN"]

export const sha = (s: string) => createHash("sha256").update(s).digest("hex")

export const toView = (k: any) => ({
  id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes,
  isActive: !k.revokedAt,
  createdAt: (k.createdAt instanceof Date ? k.createdAt.toISOString() : k.createdAt),
})

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
