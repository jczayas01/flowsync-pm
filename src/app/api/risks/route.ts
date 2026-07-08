// src/app/api/risks/route.ts
// GET  /api/risks?projectId=  — list risks
// POST /api/risks              — create risk

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { dispatchEvent } from "@/lib/automation/dispatch"
import {
  withWorkspace, ok, okList, err, parseBody,
  getSearchParams, audit, verifyProjectAccess, ApiContext,
} from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const PROB_SCORE: Record<string,number> = {
  VERY_LOW:2, LOW:4, MEDIUM:6, HIGH:8, VERY_HIGH:10 }
const IMP_SCORE:  Record<string,number> = {
  NEGLIGIBLE:1, MINOR:2, MODERATE:3, MAJOR:4, CRITICAL:5 }

function calcScore(prob: string, impact: string): number {
  return (PROB_SCORE[prob] || 1) * (IMP_SCORE[impact] || 1)
}

const createRiskSchema = z.object({
  projectId:       z.string().min(1),
  title:           z.string().min(1).max(500),
  description:     z.string().max(3000).optional(),
  category:        z.string().max(100).optional(),
  probability:     z.enum(["VERY_LOW","LOW","MEDIUM","HIGH","VERY_HIGH"]),
  impact:          z.enum(["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CRITICAL"]),
  ownerId:         z.string().min(1).optional().nullable(),
  isOpportunity:   z.boolean().optional().default(false),
  responseType:    z.enum(["AVOID","TRANSFER","MITIGATE","ACCEPT","ESCALATE","EXPLOIT","ENHANCE","SHARE"]).optional().nullable(),
  mitigationPlan:  z.string().max(3000).optional(),
  contingencyPlan: z.string().max(3000).optional(),
  residualRisk:    z.string().max(2000).optional(),
  reviewDate:      z.string().datetime().optional().nullable(),
})

async function listRisks(ctx: ApiContext) {
  const { page, perPage, skip, take, q, url } = getSearchParams(ctx.req)
  const projectId = url.searchParams.get("projectId")
  if (!projectId) return err("projectId required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err("Not found", 404)

  const status = url.searchParams.get("status") || undefined

  const where: any = {
    projectId,
    ...(status && { status }),
    ...(q && { title: { contains: q, mode: "insensitive" } }),
  }

  const [risks, total] = await Promise.all([
    db.risk.findMany({
      where,
      skip, take,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    }),
    db.risk.count({ where }),
  ])

  return okList(risks, total, page, perPage)
}

async function createRisk(ctx: ApiContext) {
    { const _g = await requirePermission(ctx as any, "risks:create" as any); if (_g) return _g }
  const parsed = await parseBody(ctx.req, createRiskSchema)
  if ("error" in parsed) return parsed.error
  const { data } = parsed

  const access = await verifyProjectAccess(data.projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return err("Project not found", 404)

  const code = await nextRiskCode(data.projectId)
  const score = calcScore(data.probability, data.impact)

  try { const risk = await db.risk.create({
    data: {
      projectId:       data.projectId,
      code,
      title:           data.title,
      description:     data.description,
      category:        data.category,
      probability:     data.probability,
      impact:          data.impact,
      score,
      ownerId:         data.ownerId,
      isOpportunity:   data.isOpportunity || false,
      responseType:    data.responseType || null,
      mitigationPlan:  data.mitigationPlan,
      contingencyPlan: data.contingencyPlan,
      residualRisk:    data.residualRisk,
      reviewDate:      data.reviewDate ? new Date(data.reviewDate) : null,
      status:          "OPEN",
    },
  })

  // Flag project as AMBER if score >= 12
  if (score >= 12) {
    await db.project.updateMany({
      where: { id: data.projectId, health: "GREEN" },
      data:  { health: "AMBER" },
    })
  }

  await audit(ctx.workspaceId, ctx.userId, "risk.created", "risk", risk.id,
    undefined, { code, title: data.title, score })

  dispatchEvent(ctx.workspaceId, "RISK_CREATED", {
    projectId: data.projectId, actorId: ctx.userId,
    title: `Risk logged: ${data.title}`, link: `/projects/${data.projectId}`,
    data: { id: risk.id, code, title: data.title, score },
  }).catch(() => {})

  return ok(risk, 201)
  } catch(e:any) {
    console.error("[Risk create]", e?.message)
    return err(e?.message?.includes("Unique")?`Code ${code} already exists — please retry`:"Failed to create risk", 500)
  }
}

async function nextRiskCode(projectId: string): Promise<string> {
  try {
    const all = await db.risk.findMany({
      where:  { projectId },
      select: { code: true },
    })
    if (!all.length) return "RSK-001"
    const nums = all
      .map(r => parseInt((r.code||"").replace(/^RSK-/, ""), 10))
      .filter(n => !isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `RSK-${String(max + 1).padStart(3, "0")}`
  } catch { return "RSK-001" }
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, listRisks)
}
export async function POST(req: NextRequest) {
  return withWorkspace(req, createRisk)
}
