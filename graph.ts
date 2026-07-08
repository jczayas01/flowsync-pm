// src/app/api/templates/route.ts
// GET  /api/templates          — browse marketplace
// POST /api/templates/install  — install template into project

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, err, parseBody, getSearchParams, audit, ApiContext } from "@/lib/api"
import { TEMPLATE_LIBRARY, filterTemplates, getTemplate } from "@/lib/templates/library"

// ── Browse ──
async function browseTemplates(ctx: ApiContext) {
  const { url } = getSearchParams(ctx.req)
  const industry    = url.searchParams.get("industry")    || "all"
  const methodology = url.searchParams.get("methodology") || "all"
  const search      = url.searchParams.get("q")           || undefined
  const premium     = url.searchParams.get("premium")
  const featured    = url.searchParams.get("featured") === "true" ? true : undefined

  const templates = filterTemplates({
    industry:    industry !== "all" ? industry : undefined,
    methodology: methodology !== "all" ? methodology : undefined,
    search,
    isPremium:   premium === "true" ? true : premium === "false" ? false : undefined,
    featured,
  })

  // Merge with workspace custom templates
  const workspaceTemplates = await db.template.findMany({
    where: {
      OR: [
        { workspaceId: ctx.workspaceId },
        { isPublic: true, workspaceId: { not: null } },
      ],
    },
    orderBy: { usageCount: "desc" },
  })

  return ok({
    builtIn:   templates,
    workspace: workspaceTemplates,
    total:     templates.length + workspaceTemplates.length,
  })
}

// ── Install ──
const installSchema = z.object({
  templateId:  z.string(),
  projectName: z.string().min(1).max(200),
  startDate:   z.string().datetime().optional(),
  currency:    z.string().length(3).default("USD"),
  teamMembers: z.array(z.object({
    userId: z.string().cuid(),
    role:   z.string().default("MEMBER"),
  })).optional().default([]),
})

async function installTemplate(ctx: ApiContext) {
  const parsed = await parseBody(ctx.req, installSchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  const template = getTemplate(data.templateId)
  if (!template) {
    // Try workspace template
    const wt = await db.template.findFirst({ where: { id: data.templateId } })
    if (!wt) return err("Template not found", 404)
  }

  const td = template?.phases || (await db.template.findFirst({ where: { id: data.templateId } }))?.templateData as any

  // Get next project code
  const lastProject = await db.project.findFirst({
    where:   { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    select:  { code: true },
  })
  const projNum = lastProject ? parseInt(lastProject.code.replace("PRJ-",""), 10) + 1 : 1
  const code    = `PRJ-${String(projNum).padStart(3,"0")}`

  const start = data.startDate ? new Date(data.startDate) : new Date()

  const project = await db.$transaction(async tx => {
    // 1. Create project
    const proj = await tx.project.create({
      data: {
        workspaceId:  ctx.workspaceId,
        createdById:  ctx.userId,
        code,
        name:         data.projectName,
        description:  template?.description || "Created from template",
        methodology:  (template?.methodology || "WATERFALL") as any,
        startDate:    start,
        currency:     data.currency,
        status:       "DRAFT",
        health:       "GREEN",
      },
    })

    // 2. Add creator as PM
    await tx.projectMember.create({
      data: { projectId: proj.id, userId: ctx.userId, role: "PM", allocation: 100 },
    })

    // 3. Add team members
    for (const m of data.teamMembers) {
      await tx.projectMember.upsert({
        where:  { projectId_userId: { projectId: proj.id, userId: m.userId } },
        create: { projectId: proj.id, userId: m.userId, role: m.role as any, allocation: 100 },
        update: {},
      })
    }

    // 4. Create phases with tasks and milestones
    if (template?.phases) {
      let weekCursor = 0
      for (let pi = 0; pi < template.phases.length; pi++) {
        const ph = template.phases[pi]
        const phaseStart = new Date(start.getTime() + weekCursor * 7 * 86400000)
        const phaseEnd   = new Date(phaseStart.getTime() + ph.durationWeeks * 7 * 86400000)

        const phase = await tx.phase.create({
          data: {
            projectId:    proj.id,
            name:         ph.name,
            description:  ph.description,
            order:        ph.order,
            status:       pi === 0 ? "IN_PROGRESS" : "PENDING",
            plannedStart: phaseStart,
            plannedEnd:   phaseEnd,
          },
        })

        // Tasks
        let taskNum = pi * 10 + 1
        for (const t of ph.tasks) {
          await tx.task.create({
            data: {
              projectId:      proj.id,
              phaseId:        phase.id,
              code:           `T-${String(taskNum++).padStart(3,"0")}`,
              title:          t.title,
              description:    t.description,
              status:         "TODO",
              priority:       t.priority as any,
              estimatedHours: t.estimatedHours,
              ownerId:        ctx.userId,
            },
          })
        }

        // Milestones
        for (const ms of ph.milestones || []) {
          const msDate = new Date(phaseStart.getTime() + ms.weekOffset * 7 * 86400000)
          await tx.milestone.create({
            data: {
              projectId:   proj.id,
              name:        ms.name,
              dueDate:     msDate,
              status:      "UPCOMING",
              color:       template.color || "#F59E0B",
            },
          })
        }

        weekCursor += ph.durationWeeks
      }

      // Update project end date
      await tx.project.update({
        where: { id: proj.id },
        data:  { endDate: new Date(start.getTime() + weekCursor * 7 * 86400000) },
      })
    }

    // 5. Create initial baseline
    await tx.baseline.create({
      data: {
        projectId:   proj.id,
        name:        `Baseline 1 — ${template?.name || "Template"} install`,
        budgetTotal: 0,
        startDate:   start,
        endDate:     new Date(start.getTime() + (template?.estimatedWeeks || 12) * 7 * 86400000),
        createdById: ctx.userId,
        snapshotData: {
          template:  template?.id,
          phases:    template?.phases?.map(p => p.name) || [],
          tasks:     [],
          budget:    { total: 0 },
          schedule:  { startDate: start, endDate: null, percentComplete: 0 },
          milestones:[],
        },
      },
    })

    return proj
  })

  // Increment usage count
  if (template) {
    await db.template.updateMany({
      where: { id: data.templateId },
      data:  { usageCount: { increment: 1 } },
    }).catch(() => {})
  }

  await audit(ctx.workspaceId, ctx.userId, "project.created" as any, "project", project.id,
    undefined, { code, name: data.projectName, template: data.templateId })

  // Return full project
  const full = await db.project.findUnique({
    where:   { id: project.id },
    include: {
      phases:  { orderBy: { order: "asc" }, include: { _count: { select: { tasks: true } } } },
      members: { include: { user: { select: { id:true, name:true, avatarUrl:true } } } },
      _count:  { select: { tasks: true, milestones: true } },
    },
  })

  return ok(full, 201)
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, browseTemplates)
}
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get("action") === "install") {
    return withWorkspace(req, installTemplate)
  }
  return withWorkspace(req, browseTemplates)
}
