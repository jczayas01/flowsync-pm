// src/app/api/ideas/[ideaId]/route.ts
// PATCH edits any working field; POST ?action=promote graduates the idea into
// a real DRAFT Project (title → name, goal/summary → objective, est. cost →
// budgetTotal) and freezes the initiative as PROMOTED with the link back.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, ApiContext } from "@/lib/api"

const jsonArr = z.array(z.record(z.any())).max(200)

const patchSchema = z.object({
  title:      z.string().min(2).max(300).optional(),
  summary:    z.string().max(3000).optional().nullable(),
  problem:    z.string().max(3000).optional().nullable(),
  goal:       z.string().max(3000).optional().nullable(),
  sponsor:    z.string().max(200).optional().nullable(),
  estCost:    z.number().min(0).optional().nullable(),
  estBenefit: z.number().min(0).optional().nullable(),
  targetDate: z.string().optional().nullable(),
  status:     z.enum(["IDEA","EXPLORING","COMPARING","READY","PROMOTED","ARCHIVED"]).optional(),
  decision:   z.string().max(3000).optional().nullable(),
  meetings:   jsonArr.optional(),
  links:      jsonArr.optional(),
  comparison: z.object({
    criteria: z.array(z.object({ id: z.string(), name: z.string().max(120),
      weight: z.number().min(0).max(100) })).max(20),
    options: z.array(z.object({ id: z.string(), name: z.string().max(200),
      vendor: z.string().max(200).optional().nullable(),
      cost: z.number().min(0).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
      scores: z.record(z.number().min(0).max(5)).optional(),
      specs: z.record(z.string().max(300)).optional(),
    })).max(10),
  }).optional().nullable(),
})

async function getOne(ctx: ApiContext, params?: Record<string, string>) {
  const item = await (db as any).initiative.findFirst({
    where: { id: params?.ideaId, workspaceId: ctx.workspaceId },
    include: { createdBy: { select: { name: true } } },
  })
  if (!item) return notFound("Initiative")
  return ok({ item: { ...item,
    estCost:    item.estCost    == null ? null : Number(item.estCost),
    estBenefit: item.estBenefit == null ? null : Number(item.estBenefit) } })
}

async function patch(ctx: ApiContext, params?: Record<string, string>) {
  const existing = await (db as any).initiative.findFirst({
    where: { id: params?.ideaId, workspaceId: ctx.workspaceId }, select: { id: true },
  })
  if (!existing) return notFound("Initiative")
  const body = await ctx.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return err("Invalid input")
  const d = parsed.data
  await (db as any).initiative.update({
    where: { id: existing.id },
    data: {
      ...d,
      targetDate: d.targetDate === undefined ? undefined
                : d.targetDate ? new Date(d.targetDate) : null,
    },
  })
  return ok({ id: existing.id })
}

async function act(ctx: ApiContext, params?: Record<string, string>) {
  const url = new URL(ctx.req.url)
  if (url.searchParams.get("action") !== "promote") return err("Unknown action")
  const item = await (db as any).initiative.findFirst({
    where: { id: params?.ideaId, workspaceId: ctx.workspaceId },
  })
  if (!item) return notFound("Initiative")
  if (item.status === "PROMOTED" && item.promotedProjectId) {
    return ok({ projectId: item.promotedProjectId, already: true })
  }
  const count = await db.project.count({ where: { workspaceId: ctx.workspaceId } })
  const project = await db.$transaction(async tx => {
    const p = await tx.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        code:        `PRJ-${String(count + 1).padStart(3, "0")}`,
        name:        item.title,
        objective:   [item.goal, item.summary].filter(Boolean).join("\n\n") || null,
        description: item.problem || null,
        status:      "DRAFT",
        budgetTotal: item.estCost ?? undefined,
        members: { create: { userId: ctx.userId, projectRole: "PM" } },
      } as any,
    })
    await (tx as any).initiative.update({
      where: { id: item.id },
      data:  { status: "PROMOTED", promotedProjectId: p.id },
    })
    return p
  })
  return ok({ projectId: project.id })
}

async function remove(ctx: ApiContext, params?: Record<string, string>) {
  await (db as any).initiative.deleteMany({
    where: { id: params?.ideaId, workspaceId: ctx.workspaceId },
  })
  return ok({ deleted: true })
}

export async function GET(req: NextRequest, { params }: { params: { ideaId: string } }) {
  return withWorkspace(req, getOne, params)
}
export async function PATCH(req: NextRequest, { params }: { params: { ideaId: string } }) {
  return withWorkspace(req, patch, params)
}
export async function POST(req: NextRequest, { params }: { params: { ideaId: string } }) {
  return withWorkspace(req, act, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { ideaId: string } }) {
  return withWorkspace(req, remove, params)
}
