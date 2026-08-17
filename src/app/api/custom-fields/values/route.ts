// src/app/api/custom-fields/values/route.ts
// Read/write custom field VALUES for one entity (project or task).
//   GET  ?entity=project|task&entityId=…            → active fields for that
//        entity type in this workspace + current values, in field order
//   PUT  { entity, entityId, projectId?, values: { [fieldId]: string|null } }
//        → upserts every provided value in one transaction
// Field definitions live in /api/custom-fields; this route only touches
// values, and only for fields that belong to the caller's workspace.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, ApiContext } from "@/lib/api"

async function list(ctx: ApiContext) {
  const url = new URL(ctx.req.url)
  const entity = url.searchParams.get("entity") || ""
  const entityId = url.searchParams.get("entityId") || ""
  if (!["project", "task"].includes(entity)) return err("entity must be project|task", 400)

  const fields = await db.customField.findMany({
    where: { workspaceId: ctx.workspaceId, entityType: entity, isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, fieldType: true, options: true, required: true, description: true },
  })
  const values = entityId
    ? await db.customFieldValue.findMany({
        where: { entityId, customFieldId: { in: fields.map(f => f.id) } },
        select: { customFieldId: true, value: true },
      })
    : []
  const vmap: Record<string, string | null> = {}
  for (const v of values) vmap[v.customFieldId] = v.value
  return ok({ fields, values: vmap })
}

const putSchema = z.object({
  entity:    z.enum(["project", "task"]),
  entityId:  z.string().min(1),
  projectId: z.string().optional().nullable(),
  values:    z.record(z.string(), z.string().max(4000).nullable()),
})

async function save(ctx: ApiContext) {
  const parsed = await parseBody(ctx.req, putSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data

  // Only fields owned by this workspace + entity type may be written.
  const owned = await db.customField.findMany({
    where: { workspaceId: ctx.workspaceId, entityType: d.entity, id: { in: Object.keys(d.values) } },
    select: { id: true, required: true, name: true },
  })
  const missing = owned.filter(f => f.required && !(d.values[f.id] ?? "").toString().trim())
  if (missing.length) return err(`Required: ${missing.map(m => m.name).join(", ")}`, 400)

  await db.$transaction(owned.map(f => db.customFieldValue.upsert({
    where:  { customFieldId_entityId: { customFieldId: f.id, entityId: d.entityId } },
    create: { customFieldId: f.id, entityId: d.entityId, projectId: d.projectId || null,
              value: d.values[f.id] ?? null },
    update: { value: d.values[f.id] ?? null, projectId: d.projectId || null },
  })))
  return ok({ saved: owned.length })
}

export async function GET(req: NextRequest) { return withWorkspace(req, list) }
export async function PUT(req: NextRequest) { return withWorkspace(req, save) }
