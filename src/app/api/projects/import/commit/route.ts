// POST /api/projects/import/commit — create a full project from a reviewed import payload
export const dynamic = "force-dynamic"
export const maxDuration = 30

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()

const commitSchema = z.object({
  project: z.object({
    name: z.string().min(1).max(150),
    objective: z.string().max(3000).nullable().optional(),
    scope: z.string().max(3000).nullable().optional(),
    methodology: z.enum(["WATERFALL", "AGILE", "SCRUM", "HYBRID"]),
    startDate: iso,
    endDate: iso,
    budgetTotal: z.number().min(0).nullable().optional(),
    currency: z.string().length(3).optional(),
  }),
  phases: z.array(z.object({ name: z.string().min(1).max(120) })).max(8),
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    phaseName: z.string().nullable().optional(),
    startDate: iso, dueDate: iso,
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).nullable().optional(),
    estimatedHours: z.number().min(0).nullable().optional(),
  })).max(60),
  milestones: z.array(z.object({ name: z.string().min(1).max(200), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).max(12),
  risks: z.array(z.object({
    title: z.string().min(1).max(200),
    probability: z.enum(["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]),
    impact: z.enum(["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"]),
    description: z.string().max(2000).nullable().optional(),
  })).max(15),
  budget: z.array(z.object({
    category: z.enum(["LABOR", "MATERIALS", "EQUIPMENT", "SOFTWARE", "CONSULTING", "TRAVEL", "CONTINGENCY", "OTHER"]),
    name: z.string().min(1).max(200),
    plannedCost: z.number().min(0),
  })).max(20),
  sourceFile: z.string().max(300).optional(),
})

const P_SCORE: Record<string, number> = { VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, VERY_HIGH: 5 }
const I_SCORE: Record<string, number> = { NEGLIGIBLE: 1, MINOR: 2, MODERATE: 3, MAJOR: 4, CRITICAL: 5 }

async function commit(ctx: ApiContext) {
  { const g = await requirePermission(ctx as any, "projects:create" as any); if (g) return g }
  const parsed = await parseBody(ctx.req, commitSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data

  // Sequential PRJ-### code within the workspace (mirrors the standard create route)
  const last = await db.project.findFirst({
    where: { workspaceId: ctx.workspaceId, code: { startsWith: "PRJ-" } },
    orderBy: { code: "desc" }, select: { code: true },
  })
  const nextNum = last?.code ? parseInt(last.code.replace("PRJ-", ""), 10) + 1 : 1
  const code = `PRJ-${String(nextNum).padStart(3, "0")}`

  let project: any
  try {
    project = await db.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        code,
        name: d.project.name,
        objective: d.project.objective || null,
        scope: d.project.scope || null,
        methodology: d.project.methodology as any,
        priority: "MEDIUM" as any,
        status: "DRAFT" as any,
        health: "GREEN" as any,
        startDate: d.project.startDate ? new Date(d.project.startDate) : null,
        endDate: d.project.endDate ? new Date(d.project.endDate) : null,
        budgetTotal: d.project.budgetTotal ?? undefined,
        currency: d.project.currency || "USD",
        description: d.sourceFile ? `Imported from "${d.sourceFile}"` : null,
        members: { create: { userId: ctx.userId, role: "PM" as any, allocation: 100 } },
      },
    })
  } catch (e: any) {
    return err(e?.message || "Failed to create the project", 500)
  }

  const created = { phases: 0, tasks: 0, milestones: 0, risks: 0, budget: 0 }
  const skipped = { tasks: 0, milestones: 0, risks: 0, budget: 0 }

  // Phases (ordered), then map name → id for tasks
  const phaseIdByName = new Map<string, string>()
  for (let i = 0; i < d.phases.length; i++) {
    try {
      const ph = await db.phase.create({
        data: { projectId: project.id, name: d.phases[i].name, order: i + 1 },
      })
      phaseIdByName.set(d.phases[i].name, ph.id)
      created.phases++
    } catch { /* duplicate/malformed phase — skip */ }
  }

  // Tasks with sequential T-### codes
  let tNum = 1
  for (const t of d.tasks) {
    try {
      await db.task.create({
        data: {
          projectId: project.id,
          code: `T-${String(tNum).padStart(3, "0")}`,
          title: t.title,
          status: "TODO" as any,
          priority: (t.priority || "MEDIUM") as any,
          phaseId: t.phaseName ? phaseIdByName.get(t.phaseName) || null : null,
          startDate: t.startDate ? new Date(t.startDate) : null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          estimatedHours: t.estimatedHours ?? undefined,
        },
      })
      tNum++; created.tasks++
    } catch { skipped.tasks++ }
  }

  for (const m of d.milestones) {
    try {
      await db.milestone.create({
        data: { projectId: project.id, name: m.name, dueDate: new Date(m.dueDate), status: "UPCOMING" as any },
      })
      created.milestones++
    } catch { skipped.milestones++ }
  }

  let rNum = 1
  for (const r of d.risks) {
    try {
      await db.risk.create({
        data: {
          projectId: project.id,
          code: `RISK-${String(rNum).padStart(3, "0")}`,
          title: r.title,
          description: r.description || null,
          probability: r.probability as any,
          impact: r.impact as any,
          score: P_SCORE[r.probability] * I_SCORE[r.impact],
          status: "OPEN" as any,
        },
      })
      rNum++; created.risks++
    } catch { skipped.risks++ }
  }

  for (const b of d.budget) {
    try {
      await db.budgetItem.create({
        data: {
          projectId: project.id,
          category: b.category as any,
          name: b.name,
          plannedCost: b.plannedCost,
        },
      })
      created.budget++
    } catch { skipped.budget++ }
  }

  // Roll planned costs up into the project budget when the plan itself stated no total
  if (!d.project.budgetTotal && created.budget > 0) {
    const total = d.budget.reduce((sm, b) => sm + b.plannedCost, 0)
    await db.project.update({ where: { id: project.id }, data: { budgetTotal: total } }).catch(() => {})
  }

  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId, userId: ctx.userId,
      action: "project.imported", entityType: "project", entityId: project.id,
      after: { code, name: d.project.name, source: d.sourceFile || null, ...created } as any,
    },
  }).catch(() => {})

  return ok({ projectId: project.id, code, created, skipped })
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, commit)
}
