// src/app/api/templates/publish/route.ts
// POST /api/templates/publish — publish a project as a template

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, ApiContext } from "@/lib/api"
import { verifyProjectAccess } from "@/lib/api"

const publishSchema = z.object({
  projectId:   z.string().min(1),
  name:        z.string().min(1).max(200),
  description: z.string().min(10).max(1000),
  industry:    z.string(),
  tags:        z.array(z.string()).max(10).default([]),
  isPublic:    z.boolean().default(false),
  isPremium:   z.boolean().default(false),
  price:       z.number().min(0).default(0),  // cents
})

async function publishTemplate(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "projects:create"); if (_g) return _g
  const parsed = await parseBody(ctx.req, publishSchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  // Verify access to source project
  const access = await verifyProjectAccess(data.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err("Project not found or access denied", 404)

  // Snapshot the project structure
  const project = await db.project.findUnique({
    where:   { id: data.projectId },
    include: {
      phases:    { orderBy: { order: "asc" }, include: { tasks: { orderBy: { createdAt: "asc" } } } },
      milestones:{ orderBy: { dueDate: "asc" } },
      risks:     { where: { status: "OPEN" }, select: { title: true, category: true } },
    },
  })
  if (!project) return err("Project not found", 404)

  // Build template data from project
  const templateData = {
    methodology: project.methodology,
    phases: project.phases.map(ph => ({
      name:        ph.name,
      description: ph.description || "",
      order:       ph.order,
      tasks: ph.tasks.map(t => ({
        title:          t.title,
        description:    t.description || undefined,
        estimatedHours: Number(t.estimatedHours) || 8,
        priority:       t.priority,
        role:           "TEAM_MEMBER",
      })),
    })),
    riskCategories: [...new Set(project.risks.map(r => r.category).filter(Boolean))]
      .map(cat => ({ name: cat, examples: [] })),
    documentTypes: [],
  }

  // Premium requires Stripe Connect (Phase 2)
  if (data.isPremium && data.price > 0) {
    // TODO: verify Stripe Connect account exists for this workspace
    // For now, store as premium pending payout setup
  }

  const template = await db.template.create({
    data: {
      workspaceId:  ctx.workspaceId,
      name:         data.name,
      description:  data.description,
      methodology:  project.methodology,
      industry:     data.industry,
      isPublic:     data.isPublic,
      isPremium:    data.isPremium,
      price:        data.price,
      templateData: templateData as any,
      usageCount:   0,
      createdById:  ctx.userId,
    },
  })

  return ok({ template, message: data.isPublic ? "Template submitted for marketplace review" : "Template saved to your workspace" }, 201)
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, publishTemplate)
}
