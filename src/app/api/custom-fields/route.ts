// src/app/api/custom-fields/route.ts — workspace custom fields (list + create).
// Mutations require a workspace-admin role; listing is open to workspace members.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"

import { CF_ADMIN_ROLES, toView } from "@/lib/api/handlers/custom-fields"

const createSchema = z.object({
  name:        z.string().min(1),
  type:        z.string().min(1),
  entity:      z.string().min(1),
  required:    z.boolean().optional(),
  options:     z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
})

async function listFields(ctx: ApiContext) {
  const fields = await db.customField.findMany({
    where: { workspaceId: ctx.workspaceId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  })
  return ok(fields.map(toView))
}

async function createField(ctx: ApiContext) {
  if (!CF_ADMIN_ROLES.includes(ctx.userRole as any)) return forbidden()
  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data
  const f = await db.customField.create({
    data: {
      workspaceId: ctx.workspaceId, name: d.name, fieldType: d.type, entityType: d.entity,
      required: d.required ?? false,
      options: (d.options && d.options.length ? d.options : undefined) as any,
      description: d.description ?? null, isActive: true,
    },
  })
  return ok(toView(f))
}

export async function GET(req: NextRequest)  { return withWorkspace(req, listFields) }
export async function POST(req: NextRequest) { return withWorkspace(req, createField) }
