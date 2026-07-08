// src/app/api/time/route.ts
// GET  /api/time  — list time entries
// POST /api/time  — log a time entry

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
    _sum: { hours: true, amount: true },
  })

  return ok({
    entries,
    total,
    page,
    perPage,
    totals: {
      hours:  Number(totals._sum.hours  || 0),
      amount: Number(totals._sum.amount || 0),
    },
  })
}

async function logTimeEntry(ctx: ApiContext) {
  const parsed = await parseBody(ctx.req, timeEntrySchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  // Resolve hourly rate: entry override → user default → workspace default
  let rate = data.hourlyRate || 0
  if (!rate && data.billable) {
    const ws = await db.workspace.findUnique({
      where:  { id: ctx.workspaceId },
      select: { defaultHourlyRate: true },
    })
    rate = Number(ws?.defaultHourlyRate || 0)
  }

  const amount = data.billable ? data.hours * rate : 0

  const entry = await db.timeEntry.create({
    data: {
      workspaceId:  ctx.workspaceId,
      userId:       ctx.userId,
      projectId:    data.projectId,
      taskId:       data.taskId || undefined,
      date:         new Date(data.date),
      hours:        data.hours,
      description:  data.description,
      billable:   data.billable,
      hourlyRate:   rate,
      amount,
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
