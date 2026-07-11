// src/app/api/goals/[goalId]/route.ts — update (scalars, key results, linked
// projects, progress rollup) and delete a goal.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, parseBody, ApiContext } from "@/lib/api"
import { GOAL_ROLES } from "@/lib/api/handlers/goals"

const TYPES    = ["ANNUAL", "QUARTERLY", "MONTHLY"] as const
const STATUSES = ["DRAFT", "ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "MISSED"] as const

const keyResultSchema = z.object({
  title:        z.string().min(1),
  target:       z.number().optional(),
  currentValue: z.number().optional(),
  baseline:     z.number().optional().nullable(),
  unit:         z.string().optional().nullable(),
})

const updateSchema = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type:        z.enum(TYPES).optional(),
  quarter:     z.string().optional().nullable(),
  status:      z.enum(STATUSES).optional(),
  keyResults:  z.array(keyResultSchema).optional(),   // full replace when present
  projectIds:  z.array(z.string()).optional(),        // full replace when present
})

// 0-100 progress from a key result. With a baseline this works in both directions:
// increase goals (target > baseline) and reduction goals (target < baseline).
function krProgress(current: number, target: number, baseline?: number | null): number {
  const b = baseline ?? 0
  const denom = target - b
  if (denom === 0) return current === target ? 100 : 0
  return Math.max(0, Math.min(100, Math.round(((current - b) / denom) * 100)))
}

const goalInclude = {
  owner:      { select: { id: true, name: true, avatarUrl: true } },
  keyResults: { orderBy: { createdAt: "asc" as const } },
  projects:   { include: { project: { select: {
    id: true, code: true, name: true, percentComplete: true, health: true, status: true,
  } } } },
}

async function updateGoal(ctx: ApiContext, params?: Record<string, string>) {
  if (!GOAL_ROLES.includes(ctx.userRole as any)) return forbidden()
  const goalId = params?.goalId
  if (!goalId) return err("Goal ID required")

  const existing = await db.goal.findFirst({
    where: { id: goalId, workspaceId: ctx.workspaceId }, select: { id: true },
  })
  if (!existing) return notFound("Goal")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data

  await db.$transaction(async (tx) => {
    // Scalar fields
    const scalar: any = {}
    for (const k of ["title", "description", "type", "quarter", "status"] as const) {
      if (d[k] !== undefined) scalar[k] = d[k]
    }
    if (Object.keys(scalar).length) await tx.goal.update({ where: { id: goalId }, data: scalar })

    // Key results — replace whole set, recompute goal progress
    if (d.keyResults !== undefined) {
      await tx.keyResult.deleteMany({ where: { goalId } })
      for (const kr of d.keyResults) {
        const target = kr.target ?? 100
        const current = kr.currentValue ?? 0
        await tx.keyResult.create({
          data: { goalId, title: kr.title, target, currentValue: current, baseline: kr.baseline ?? null, unit: kr.unit ?? null, progress: krProgress(current, target, kr.baseline) },
        })
      }
      const progress = d.keyResults.length
        ? Math.round(d.keyResults.reduce((s, kr) => s + krProgress(kr.currentValue ?? 0, kr.target ?? 100, kr.baseline), 0) / d.keyResults.length)
        : 0
      await tx.goal.update({ where: { id: goalId }, data: { progress } })
    }

    // Linked projects — replace with the workspace-valid subset
    if (d.projectIds !== undefined) {
      const valid = await tx.project.findMany({
        where: { id: { in: d.projectIds }, workspaceId: ctx.workspaceId }, select: { id: true },
      })
      await tx.goalProject.deleteMany({ where: { goalId } })
      for (const p of valid) await tx.goalProject.create({ data: { goalId, projectId: p.id } })
    }
  })

  const goal = await db.goal.findUnique({ where: { id: goalId }, include: goalInclude })
  return ok({
    ...goal,
    linkedProjects: (goal?.projects || []).map((gp: any) => gp.project),
  })
}

async function deleteGoal(ctx: ApiContext, params?: Record<string, string>) {
  if (!GOAL_ROLES.includes(ctx.userRole as any)) return forbidden()
  const goalId = params?.goalId
  if (!goalId) return err("Goal ID required")
  const existing = await db.goal.findFirst({
    where: { id: goalId, workspaceId: ctx.workspaceId }, select: { id: true },
  })
  if (!existing) return notFound("Goal")
  await db.goal.delete({ where: { id: goalId } })
  return ok({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { goalId: string } }) {
  return withWorkspace(req, updateGoal, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { goalId: string } }) {
  return withWorkspace(req, deleteGoal, params)
}
