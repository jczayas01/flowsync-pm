// src/app/api/ideas/route.ts
// Initiative backlog — the project nursery. Any workspace member can plant
// and tend ideas; governance starts at promotion, not here.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"

const createSchema = z.object({
  title:   z.string().min(2).max(300),
  summary: z.string().max(3000).optional().nullable(),
})

async function list(ctx: ApiContext) {
  const items = await (db as any).initiative.findMany({
    where:   { workspaceId: ctx.workspaceId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  })
  return ok({ items: items.map((i: any) => ({
    ...i,
    estCost:    i.estCost    == null ? null : Number(i.estCost),
    estBenefit: i.estBenefit == null ? null : Number(i.estBenefit),
  })) })
}

async function create(ctx: ApiContext) {
  const body = await ctx.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return err("Invalid input")
  const item = await (db as any).initiative.create({
    data: {
      workspaceId: ctx.workspaceId,
      title:       parsed.data.title.trim(),
      summary:     parsed.data.summary || null,
      createdById: ctx.userId,
    },
  })
  return ok({ id: item.id }, 201)
}

export async function GET(req: NextRequest)  { return withWorkspace(req, list) }
export async function POST(req: NextRequest) { return withWorkspace(req, create) }
