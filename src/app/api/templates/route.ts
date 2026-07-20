// src/app/api/templates/route.ts
// GET  /api/templates          — browse marketplace
// POST /api/templates/install  — install template into project

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/rbac/guards"
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
    userId: z.string().min(1),
    role:   z.string().default("MEMBER"),
  })).optional().default([]),
})


// Plans that include premium templates. FREE (incl. trial) and STARTER must
// upgrade — the template's price tag is honored by plan entitlement, not a
// per-template checkout.
const PREMIUM_TEMPLATE_PLANS = ["PRO", "PROFESSIONAL", "CONSULTANT", "BUSINESS", "ENTERPRISE"]

async function assertPremiumTemplateAllowed(workspaceId: string, isPremium: boolean) {
  if (!isPremium) return null
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
  if (ws && PREMIUM_TEMPLATE_PLANS.includes(String(ws.plan))) return null
  return err("This is a premium template — included with the Business plan. Upgrade in Settings → Billing to use it.", 402)
}

async function installTemplate(ctx: ApiContext) {
  const _g = await requirePermission(ctx as any, "projects:create"); if (_g) return _g
  const parsed = await parseBody(ctx.req, installSchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  const template = getTemplate(data.templateId)
  let wt: any = null
  if (!template) {
    // Try workspace template
    wt = await db.template.findFirst({ where: { id: data.templateId } })
    if (!wt) return err("Template not found", 404)
  }

  // Premium gate — server-side, so the marketplace UI can't bypass payment.
  const premiumBlock = await assertPremiumTemplateAllowed(
    ctx.workspaceId, !!(template as any)?.isPremium || !!wt?.isPremium)
  if (premiumBlock) return premiumBlock

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
      const taskRows: any[] = []
      const milestoneRows: any[] = []
      let sortSeq = 0
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

        // Tasks (collected, inserted in one batch after the loop).
        // Schedule each task across the phase window (sequential cascade) so it
        // has a start/finish and renders as a bar in the Gantt and grid.
        const phaseMs = Math.max(phaseEnd.getTime() - phaseStart.getTime(), 86400000)
        const nTasks  = ph.tasks.length || 1
        ph.tasks.forEach((t, idx) => {
          const tStart = new Date(phaseStart.getTime() + Math.round((idx / nTasks) * phaseMs))
          const tDue   = new Date(phaseStart.getTime() + Math.round(((idx + 1) / nTasks) * phaseMs))
          taskRows.push({
            projectId:      proj.id,
            phaseId:        phase.id,
            code:           `T-${String(pi * 10 + 1 + idx).padStart(3,"0")}`,
            title:          t.title,
            description:    t.description,
            status:         "TODO",
            priority:       t.priority as any,
            estimatedHours: t.estimatedHours,
            sortOrder:      sortSeq++,
            startDate:      tStart,
            dueDate:        tDue,
            ownerId:        ctx.userId,
          })
        })

        // Milestones (collected, inserted in one batch after the loop)
        for (const ms of ph.milestones || []) {
          const msDate = new Date(phaseStart.getTime() + ms.weekOffset * 7 * 86400000)
          milestoneRows.push({
            projectId:   proj.id,
            name:        ms.name,
            dueDate:     msDate,
            status:      "UPCOMING",
            color:       template.color || "#F59E0B",
          })
        }

        weekCursor += ph.durationWeeks
      }

      // Batch-insert all tasks and milestones (few round-trips instead of one per row)
      if (taskRows.length)      await tx.task.createMany({ data: taskRows })
      if (milestoneRows.length) await tx.milestone.createMany({ data: milestoneRows })

      // Update project end date
      await tx.project.update({
        where: { id: proj.id },
        data:  { endDate: new Date(start.getTime() + weekCursor * 7 * 86400000) },
      })
    }

    // 4b. Seed a starter risk register from the template's risk categories
    const PROB_N: Record<string,number> = { VERY_LOW:1, LOW:2, MEDIUM:3, HIGH:4, VERY_HIGH:5 }
    const IMP_N:  Record<string,number> = { NEGLIGIBLE:1, MINOR:2, MODERATE:3, MAJOR:4, CRITICAL:5 }
    const riskRows: any[] = []
    let rskNum = 1
    for (const rc of (template?.riskCategories || [])) {
      const prob  = (rc as any).probability || "MEDIUM"
      const imp   = (rc as any).impact || "MODERATE"
      const score = (PROB_N[prob] || 3) * (IMP_N[imp] || 3)
      for (const ex of (rc.examples || [])) {
        riskRows.push({
          projectId:   proj.id,
          code:        `RSK-${String(rskNum++).padStart(3,"0")}`,
          title:       ex,
          category:    rc.name,
          description: `Identified from the ${template?.name || "project"} template. Review probability, impact, and response.`,
          probability: prob as any,
          impact:      imp as any,
          score,
          status:      "OPEN" as any,
          ownerId:     ctx.userId,
        })
      }
    }
    if (riskRows.length) await tx.risk.createMany({ data: riskRows })

    // 4c. Seed governance document scaffolds from the template's document types
    const docRows: any[] = []
    for (const dt of (template?.documentTypes || [])) {
      const body = `# ${dt}\n\nGovernance document scaffold created from the ${template?.name || "project"} template. Replace this placeholder with your project's actual ${dt}.`
      docRows.push({
        projectId:    proj.id,
        name:         dt,
        description:  "Template scaffold — replace with the actual document.",
        fileUrl:      `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`,
        fileType:     "text/plain",
        fileSize:     body.length,
        uploadedById: ctx.userId,
      })
    }
    if (docRows.length) await tx.document.createMany({ data: docRows })

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
  }, { maxWait: 10000, timeout: 30000 })

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
