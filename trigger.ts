// src/app/api/portfolio/route.ts
// GET  /api/portfolio  — list portfolios with rollup metrics
// POST /api/portfolio  — create portfolio

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, okList, err, parseBody, getSearchParams, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const portfolioSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  ownerId:     z.string().cuid().optional(),
  color:       z.string().default("#1B6CA8"),
  startDate:   z.string().datetime().optional(),
  endDate:     z.string().datetime().optional(),
  budgetTotal: z.number().min(0).optional(),
})

async function listPortfolios(ctx: ApiContext) {
  const portfolios = await db.portfolio.findMany({
    where:   { workspaceId: ctx.workspaceId },
    include: {
      owner:    { select: { id:true, name:true, avatarUrl:true } },
      programs: {
        include: {
          projects: {
            select: {
              id:true, code:true, name:true, health:true, status:true,
              percentComplete:true, budgetTotal:true, budgetSpent:true,
              endDate:true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Compute rollup metrics per portfolio
  const enriched = portfolios.map(p => {
    const allProjects = p.programs.flatMap(prog => prog.projects)

    const budgetTotal = allProjects.reduce((s,proj) => s + Number(proj.budgetTotal||0), 0)
    const budgetSpent = allProjects.reduce((s,proj) => s + Number(proj.budgetSpent||0), 0)
    const avgComplete = allProjects.length
      ? allProjects.reduce((s,proj) => s + Number(proj.percentComplete||0), 0) / allProjects.length
      : 0

    const healthCounts = { GREEN:0, AMBER:0, RED:0 }
    allProjects.forEach(proj => {
      if (proj.health in healthCounts) healthCounts[proj.health as keyof typeof healthCounts]++
    })

    const overallHealth = healthCounts.RED > 0 ? "RED"
      : healthCounts.AMBER > 0 ? "AMBER" : "GREEN"

    return {
      ...p,
      rollup: {
        programCount:  p.programs.length,
        projectCount:  allProjects.length,
        budgetTotal,
        budgetSpent,
        budgetPct:     budgetTotal > 0 ? Math.round(budgetSpent / budgetTotal * 100) : 0,
        avgComplete:   Math.round(avgComplete),
        health:        overallHealth,
        healthCounts,
        projectsAtRisk: healthCounts.RED + healthCounts.AMBER,
      },
    }
  })

  return ok({ portfolios: enriched, total: enriched.length })
}

async function createPortfolio(ctx: ApiContext) {
  const guard = await requirePermission(ctx, "programs:create")
  if (guard) return guard

  const parsed = await parseBody(ctx.req, portfolioSchema)
  if ("error" in parsed) return parsed.error

  const portfolio = await db.portfolio.create({
    data: {
      workspaceId:  ctx.workspaceId,
      name:         parsed.data.name,
      description:  parsed.data.description,
      ownerId:      parsed.data.ownerId || ctx.userId,
      color:        parsed.data.color,
      startDate:    parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate:      parsed.data.endDate   ? new Date(parsed.data.endDate)   : undefined,
      budgetTotal:  parsed.data.budgetTotal || 0,
    },
  })

  return ok(portfolio, 201)
}

export async function GET(req: NextRequest) { return withWorkspace(req, listPortfolios) }
export async function POST(req: NextRequest) { return withWorkspace(req, createPortfolio) }
