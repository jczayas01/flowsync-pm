// src/app/api/programs/route.ts
// GET  /api/programs  — list programs with budget/health rollup
// POST /api/programs  — create program

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, getSearchParams, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const programSchema = z.object({
  portfolioId: z.string().min(1).optional().nullable(),
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  managerId:   z.string().min(1).optional(),
  color:       z.string().default("#059669"),
  startDate:   z.string().datetime().optional(),
  endDate:     z.string().datetime().optional(),
  budgetTotal: z.number().min(0).optional(),
})

async function listPrograms(ctx: ApiContext) {
  const { url } = getSearchParams(ctx.req)
  const portfolioId = url.searchParams.get("portfolioId") || undefined

  const programs = await db.program.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(portfolioId && { portfolioId }),
    },
    include: {
      manager:  { select: { id:true, name:true, avatarUrl:true } },
      portfolio:{ select: { id:true, name:true, color:true } },
      projects: {
        select: {
          id:true, code:true, name:true, health:true, status:true,
          percentComplete:true, budgetTotal:true, budgetSpent:true,
          startDate:true, endDate:true,
          members: { where: { role: "PM" as any }, include: { user: { select:{ name:true, avatarUrl:true } } }, take:1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const enriched = programs.map(p => {
    const budgetTotal = p.projects.reduce((s,proj) => s + Number(proj.budgetTotal||0), 0)
    const budgetSpent = p.projects.reduce((s,proj) => s + Number(proj.budgetSpent||0), 0)
    const avgComplete = p.projects.length
      ? p.projects.reduce((s,proj) => s + Number(proj.percentComplete||0), 0) / p.projects.length
      : 0

    const healthCounts = { GREEN:0, AMBER:0, RED:0 }
    p.projects.forEach(proj => {
      if (proj.health in healthCounts) healthCounts[proj.health as keyof typeof healthCounts]++
    })

    return {
      ...p,
      rollup: {
        projectCount: p.projects.length,
        budgetTotal,
        budgetSpent,
        budgetPct:    budgetTotal > 0 ? Math.round(budgetSpent/budgetTotal*100) : 0,
        avgComplete:  Math.round(avgComplete),
        health:       healthCounts.RED > 0 ? "RED" : healthCounts.AMBER > 0 ? "AMBER" : "GREEN",
        healthCounts,
      },
    }
  })

  return ok({ programs: enriched, total: enriched.length })
}

async function createProgram(ctx: ApiContext) {
  const guard = await requirePermission(ctx, "programs:create")
  if (guard) return guard

  const parsed = await parseBody(ctx.req, programSchema)
  if ("error" in parsed) return parsed.error

  try {
    const program = await db.program.create({
      data: {
        portfolioId:  parsed.data.portfolioId,
        name:         parsed.data.name,
        description:  parsed.data.description || null,
        managerId:    parsed.data.managerId || ctx.userId,
        color:        parsed.data.color || "#059669",
      },
    })
    return ok(program, 201)
  } catch(e:any) {
    console.error("[Program create]", e?.message)
    return err(e?.message || "Failed to create program", 500)
  }
}

export async function GET(req: NextRequest) { return withWorkspace(req, listPrograms) }
export async function POST(req: NextRequest) { return withWorkspace(req, createProgram) }
