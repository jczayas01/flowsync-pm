// src/app/api/projects/[projectId]/labor/route.ts
// GET   — accrued labour per assigned person (computed, never stored per-person)
// PATCH — the only two inputs the whole model has: a person's allocation %,
//         and the workspace's hours-per-day assumption.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, audit, ApiContext } from "@/lib/api"
import { computeProjectLabor, syncProjectLabor, laborHoursPerDay } from "@/lib/labor-accrual"

const EDIT_ROLES = ["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR", "PROGRAM_MANAGER", "PM"]

const patchSchema = z.object({
  userId:       z.string().min(1).optional(),
  allocation:   z.number().int().min(0).max(100).optional(),
  // null clears the override and falls back to the project start date
  laborSince:   z.string().datetime().nullable().optional(),
  hoursPerDay:  z.number().min(1).max(24).optional(),
})

async function ownsProject(ctx: ApiContext, projectId: string) {
  return db.project.findFirst({
    where: { id: projectId, workspaceId: ctx.workspaceId }, select: { id: true },
  })
}

async function read(ctx: ApiContext, params?: Record<string, string>) {
  const projectId = params!.projectId
  if (!(await ownsProject(ctx, projectId))) return notFound("Project")

  const summary = await computeProjectLabor(projectId)
  const ws = await db.workspace.findUnique({
    where: { id: ctx.workspaceId }, select: { settings: true },
  })
  return ok({
    rows: summary.rows.map(r => ({
      userId: r.userId, name: r.name, allocation: r.allocation,
      costRate: r.costRate, since: r.since, through: r.through,
      workingDays: r.workingDays, hours: r.hours, cost: r.cost,
      missingRate: r.missingRate, sinceIsOverride: r.sinceIsOverride,
    })),
    totalHours:  summary.totalHours,
    totalCost:   summary.totalCost,
    hoursPerDay: laborHoursPerDay(ws?.settings),
  })
}

async function update(ctx: ApiContext, params?: Record<string, string>) {
  const projectId = params!.projectId
  if (!(await ownsProject(ctx, projectId))) return notFound("Project")
  if (!EDIT_ROLES.includes(String(ctx.userRole))) return err("Insufficient permissions", 403)

  const parsed = await parseBody(ctx.req, patchSchema)
  if ("error" in parsed) return parsed.error
  const { userId, allocation, laborSince, hoursPerDay } = parsed.data

  if (hoursPerDay != null) {
    // settings is a Json blob — merge rather than replace so nothing else is lost.
    const ws = await db.workspace.findUnique({
      where: { id: ctx.workspaceId }, select: { settings: true },
    })
    const base = (ws?.settings && typeof ws.settings === "object") ? ws.settings as any : {}
    await db.workspace.update({
      where: { id: ctx.workspaceId },
      data:  { settings: { ...base, laborHoursPerDay: hoursPerDay } },
    })
  }

  if (userId != null && (allocation != null || laborSince !== undefined)) {
    const member = await db.projectMember.findFirst({
      where: { projectId, userId }, select: { id: true },
    })
    if (!member) return err("That person is not assigned to this project", 400)
    await db.projectMember.update({
      where: { id: member.id },
      data: {
        ...(allocation != null && { allocation }),
        // undefined = untouched; null = clear the override
        ...(laborSince !== undefined && {
          laborSince: laborSince ? new Date(laborSince) : null }),
      },
    })
    await audit(ctx.workspaceId, ctx.userId, "project.member_allocation" as any,
      "project_member", member.id, undefined, { projectId, userId, allocation, laborSince })
  }

  // Re-mirror onto the budget line so the number the user just changed is the
  // number EVM reads, with no cron in between.
  const totalCost = await syncProjectLabor(projectId)
  const summary = await computeProjectLabor(projectId)
  return ok({ totalCost, totalHours: summary.totalHours, rows: summary.rows })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, read, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, update, params)
}
