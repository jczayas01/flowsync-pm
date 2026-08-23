// src/app/api/time/route.ts
// GET  /api/time  — list time entries
// POST /api/time  — log a time entry

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, err, parseBody, getSearchParams, audit, ApiContext } from "@/lib/api"

const timeEntrySchema = z.object({
  projectId:   z.string().min(1),
  taskId:      z.string().min(1).optional().nullable(),
  date:        z.string().datetime(),
  hours:       z.number().min(0.25).max(24),
  description: z.string().max(500).optional(),
  billable:  z.boolean().default(true),
  hourlyRate:  z.number().min(0).optional(),  // override rate
  userId:      z.string().min(1).optional(),  // log on behalf of a member (PM+)
})

async function listTimeEntries(ctx: ApiContext) {
  const { page, perPage, skip, take, url } = getSearchParams(ctx.req)
  const projectId = url.searchParams.get("projectId") || undefined
  const userId    = url.searchParams.get("userId")    || undefined
  const from      = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined
  const to        = url.searchParams.get("to")   ? new Date(url.searchParams.get("to")!)   : undefined
  const billable  = url.searchParams.get("billable")

  const where: any = {
    workspaceId: ctx.workspaceId,
    ...(projectId && { projectId }),
    ...(userId    && { userId }),
    ...(billable === "true"  && { billable: true }),
    ...(billable === "false" && { billable: false }),
    ...(from || to) && { date: {
      ...(from && { gte: from }),
      ...(to   && { lte: to   }),
    }},
  }

  const [entries, total] = await Promise.all([
    db.timeEntry.findMany({
      where,
      skip, take,
      orderBy: { date: "desc" },
      include: {
        user:    { select: { id:true, name:true, avatarUrl:true } },
        project: { select: { id:true, code:true, name:true } },
        task:    { select: { id:true, code:true, title:true } },
      },
    }),
    db.timeEntry.count({ where }),
  ])

  // Totals
  const totals = await db.timeEntry.aggregate({
    where,
    _sum: { hours: true },
  })
  const _rows = await db.timeEntry.findMany({ where, select: { hours: true, hourlyRate: true } })
  const _amount = _rows.reduce((sum: number, e: any) => sum + Number(e.hours) * Number(e.hourlyRate || 0), 0)

  return ok({
    entries,
    total,
    page,
    perPage,
    totals: {
      hours:  Number(totals._sum.hours  || 0),
      amount: _amount,
    },
  })
}

async function logTimeEntry(ctx: ApiContext) {
  const parsed = await parseBody(ctx.req, timeEntrySchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  // Who the hours belong to. Logging for someone else is a PM-level action —
  // it moves cost onto their rate, so it is not open to every member.
  const PRIVILEGED = ["OWNER","ADMIN","SUPER_ADMIN","PMO_DIRECTOR","PROGRAM_MANAGER","PM"]
  let targetUserId = ctx.userId
  if (data.userId && data.userId !== ctx.userId) {
    if (!PRIVILEGED.includes(String(ctx.userRole))) {
      return err("You can only log time for yourself", 403)
    }
    const target = await db.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: data.userId }, select: { userId: true },
    })
    if (!target) return err("That person is not a member of this workspace", 400)
    targetUserId = data.userId
  }

  // Resolve hourly rate: entry override → the member's cost rate. The previous
  // version fell straight to 0, so every entry recorded hours with no cost and
  // the labour never reached the budget.
  let rate = data.hourlyRate
  if (rate == null) {
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: targetUserId },
      select: { costRate: true },
    })
    rate = member?.costRate != null ? Number(member.costRate) : 0
  }

  const amount = data.billable ? data.hours * rate : 0

  const entry = await db.timeEntry.create({
    data: {
      userId:       targetUserId,
      projectId:    data.projectId,
      taskId:       data.taskId || undefined,
      date:         new Date(data.date),
      hours:        data.hours,
      description:  data.description,
      billable:   data.billable,
      hourlyRate:   rate,
    },
    include: {
      project: { select: { id:true, code:true, name:true } },
      task:    { select: { id:true, code:true, title:true } },
    },
  })

  await audit(ctx.workspaceId, ctx.userId, "time.logged" as any, "time_entry", entry.id,
    undefined, { hours: data.hours, projectId: data.projectId, billable: data.billable })

  return ok(entry, 201)
}

export async function GET(req: NextRequest) { return withWorkspace(req, listTimeEntries) }
export async function POST(req: NextRequest) { return withWorkspace(req, logTimeEntry) }
