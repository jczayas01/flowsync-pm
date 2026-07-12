// PATCH  /api/risks/:riskId — update a risk/opportunity (recomputes score)
// DELETE /api/risks/:riskId — remove it
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, notFound, parseBody,
  audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const PROB_SCORE: Record<string, number> = {
  VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, VERY_HIGH: 5 }
const IMP_SCORE: Record<string, number> = {
  NEGLIGIBLE: 1, MINOR: 2, MODERATE: 3, MAJOR: 4, CRITICAL: 5 }

const updateSchema = z.object({
  title:           z.string().min(1).max(500).optional(),
  description:     z.string().max(3000).optional().nullable(),
  category:        z.string().max(100).optional().nullable(),
  probability:     z.enum(["VERY_LOW","LOW","MEDIUM","HIGH","VERY_HIGH"]).optional(),
  impact:          z.enum(["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CRITICAL"]).optional(),
  status:          z.enum(["OPEN","MITIGATED","ACCEPTED","TRIGGERED","CLOSED"]).optional(),
  responseType:    z.enum(["AVOID","TRANSFER","MITIGATE","ACCEPT","ESCALATE","EXPLOIT","ENHANCE","SHARE"]).optional().nullable(),
  ownerId:         z.string().optional().nullable(),
  mitigationPlan:  z.string().max(3000).optional().nullable(),
  contingencyPlan: z.string().max(3000).optional().nullable(),
  residualRisk:    z.string().max(2000).optional().nullable(),
  reviewDate:      z.string().datetime().optional().nullable(),
})

async function loadAndAuthorize(ctx: ApiContext, riskId?: string) {
  if (!riskId) return { error: err("Risk ID required") }
  const risk = await db.risk.findUnique({ where: { id: riskId } })
  if (!risk) return { error: notFound("Risk") }
  const access = await verifyProjectAccess(risk.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return { error: notFound("Risk") }
  return { risk }
}

async function updateRisk(ctx: ApiContext, params?: Record<string, string>) {
  { const g = await requirePermission(ctx as any, "risks:create" as any); if (g) return g }
  const { risk, error } = await loadAndAuthorize(ctx, params?.riskId)
  if (error) return error

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const data = parsed.data

  const probability = data.probability ?? risk!.probability
  const impact      = data.impact      ?? risk!.impact
  const score = (PROB_SCORE[probability] || 1) * (IMP_SCORE[impact] || 1)

  try {
    const updated = await db.risk.update({
      where: { id: risk!.id },
      data: {
        ...data,
        ownerId: data.ownerId === "" ? null : data.ownerId,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : (data.reviewDate === null ? null : undefined),
        score,
      },
    })
    await audit(ctx.workspaceId, ctx.userId, "risk.updated", "risk", risk!.id,
      undefined, { title: updated.title, score }).catch(() => {})
    return ok({ id: updated.id, score })
  } catch (e: any) {
    return err(e?.message || "Failed to update risk", 500)
  }
}

async function deleteRisk(ctx: ApiContext, params?: Record<string, string>) {
  { const g = await requirePermission(ctx as any, "risks:create" as any); if (g) return g }
  const { risk, error } = await loadAndAuthorize(ctx, params?.riskId)
  if (error) return error
  try {
    await db.risk.delete({ where: { id: risk!.id } })
    await audit(ctx.workspaceId, ctx.userId, "risk.deleted", "risk", risk!.id,
      undefined, { title: risk!.title }).catch(() => {})
    return ok({ deleted: true })
  } catch (e: any) {
    return err(e?.message || "Failed to delete risk", 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { riskId: string } }) {
  return withWorkspace(req, updateRisk, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { riskId: string } }) {
  return withWorkspace(req, deleteRisk, params)
}
