// src/app/api/intake/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"
import { can, mapDbRoleToRbac } from "@/lib/rbac/roles"

const submitSchema = z.object({
  title:         z.string().min(3).max(200),
  description:   z.string().min(1).max(5000),
  problem:       z.string().max(5000).optional().nullable(),
  expectedValue: z.string().max(500).optional().nullable(),
  urgency:       z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).optional(),
})

async function listIntake(ctx: ApiContext) {
  const role = mapDbRoleToRbac(ctx.userRole as any)
  const viewAll = ["EXECUTIVE","PMO_DIRECTOR","SUPER_ADMIN","OWNER","ADMIN"].includes(role)
  const items = await db.projectIntake.findMany({
    where: { workspaceId: ctx.workspaceId, ...(viewAll ? {} : { submittedById: ctx.userId }) },
    orderBy: { createdAt: "desc" },
    include: {
      submittedBy: { select: { id:true, name:true, avatarUrl:true } },
      reviewedBy:  { select: { id:true, name:true } },
    },
  })
  return ok({ items, canReview: viewAll })
}

async function submitIntake(ctx: ApiContext) {
  const role = mapDbRoleToRbac(ctx.userRole as any)
  if (role === "CLIENT") return err("External users can't submit intake requests", 403)
  const parsed = await parseBody(ctx.req, submitSchema); if ('error' in parsed) return parsed.error
  const item = await db.projectIntake.create({
    data: {
      workspaceId:   ctx.workspaceId,
      submittedById: ctx.userId,
      title:         parsed.data.title,
      description:   parsed.data.description,
      problem:       parsed.data.problem ?? null,
      expectedValue: parsed.data.expectedValue ?? null,
      urgency:       parsed.data.urgency ?? "MEDIUM",
    },
  })
  return ok({ item })
}

export async function GET(req: NextRequest)  { return withWorkspace(req, listIntake) }
export async function POST(req: NextRequest) { return withWorkspace(req, submitIntake) }
