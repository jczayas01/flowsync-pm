// src/app/api/goals/route.ts — Goals & OKRs create (list is served by the page via Prisma)
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, forbidden, parseBody, ApiContext } from "@/lib/api"

// Governance-management roles may create/edit goals. Executive is read-only, so it
// can view Goals but not mutate them.
import { GOAL_ROLES } from "@/lib/api/handlers/goals"

const TYPES    = ["ANNUAL", "QUARTERLY", "MONTHLY"] as const
const STATUSES = ["DRAFT", "ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "MISSED"] as const

const createSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional().nullable(),
  type:        z.enum(TYPES).optional(),
  quarter:     z.string().optional().nullable(),
  status:      z.enum(STATUSES).optional(),
})

async function createGoal(ctx: ApiContext) {
  if (!GOAL_ROLES.includes(ctx.userRole as any)) return forbidden()
  const parsed = await parseBody(ctx.req, createSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data

  const goal = await db.goal.create({
    data: {
      workspaceId: ctx.workspaceId,
      title:       d.title,
      description: d.description ?? null,
      type:        (d.type ?? "ANNUAL") as any,
      quarter:     d.quarter ?? null,
      status:      (d.status ?? "DRAFT") as any,
      ownerId:     ctx.userId,
    },
    include: {
      owner:      { select: { id: true, name: true, avatarUrl: true } },
      keyResults: true,
    },
  })
  return ok({ ...goal, linkedProjects: [] })
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, createGoal)
}
