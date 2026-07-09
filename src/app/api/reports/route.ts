// src/app/api/reports/route.ts — workspace report templates (list + create).
// Managed by admin-level roles via the reports:manage_templates permission (Owner,
// Admin, PMO Director) — NOT tied to the literal "Admin" role, so a PMO Director can
// manage templates without being made a workspace administrator.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

// Available report section blocks (kept in sync with the builder UI).
import { SECTION_IDS } from "@/lib/api/handlers/reports"

const createSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional().nullable(),
  audience:    z.enum(["TEAM","EXECUTIVE","CLIENT","SPONSOR"]).optional(),
  sections:    z.array(z.enum(SECTION_IDS)).min(1),
})

async function listTemplates(ctx: ApiContext) {
  // Anyone who can view reports can *read* the templates (they're used in project reports).
  const templates = await db.reportTemplate.findMany({
    where:   { workspaceId: ctx.workspaceId },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return ok(templates)
}

async function createTemplate(ctx: ApiContext) {
  const guard = await requirePermission(ctx as any, "reports:manage_templates" as any)
  if (guard) return guard
  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data
  const template = await db.reportTemplate.create({
    data: {
      workspaceId: ctx.workspaceId,
      name:        d.name,
      description: d.description ?? null,
      audience:    d.audience ?? "TEAM",
      sections:    d.sections,
      createdById: ctx.userId,
    },
    include: { creator: { select: { id: true, name: true } } },
  })
  return ok(template)
}

export async function GET(req: NextRequest)  { return withWorkspace(req, listTemplates) }
export async function POST(req: NextRequest) { return withWorkspace(req, createTemplate) }
