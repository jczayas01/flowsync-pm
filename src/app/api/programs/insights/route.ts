// src/app/api/programs/insights/route.ts
// GET — the two things that only exist above a single project: dependencies
// that cross project boundaries, and people booked past their capacity.
// Both are computed on read; neither is stored.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, getSearchParams, ApiContext } from "@/lib/api"
import { analyzeCrossLinks, summarizeCrossLinks } from "@/lib/cross-project-deps"
import { detectOverAllocation } from "@/lib/allocation-check"

const OPEN = ["ACTIVE", "ON_HOLD", "DRAFT", "PENDING"] as const

async function read(ctx: ApiContext) {
  const { url } = getSearchParams(ctx.req)
  const programId = url.searchParams.get("programId") || undefined
  const capacity  = Math.max(1, Number(url.searchParams.get("capacity") || 100))

  const projectWhere: any = { workspaceId: ctx.workspaceId, status: { in: OPEN as any } }
  if (programId) projectWhere.programId = programId

  const projects = await db.project.findMany({
    where:  projectWhere,
    select: { id: true, code: true, name: true, status: true,
              startDate: true, endDate: true },
  })
  const projectIds = projects.map(p => p.id)
  const pById = new Map(projects.map(p => [p.id, p]))

  if (!projectIds.length) {
    return ok({ links: [], linkSummary: { total: 0, breached: 0, active: 0, worstSlip: 0, projects: 0 },
                people: [], capacity })
  }

  // Only links where at least one end sits in scope; analyzeCrossLinks drops
  // the same-project ones, which the Gantt already draws.
  const rawLinks = await db.taskDependency.findMany({
    where: {
      OR: [
        { dependentTask: { projectId: { in: projectIds } } },
        { precedingTask: { projectId: { in: projectIds } } },
      ],
    },
    select: { id: true, dependentTaskId: true, precedingTaskId: true,
              dependencyType: true, lagDays: true },
  })

  const taskIds = Array.from(new Set(rawLinks.flatMap(l => [l.dependentTaskId, l.precedingTaskId])))
  const tasks = taskIds.length
    ? await db.task.findMany({
        where:  { id: { in: taskIds }, project: { workspaceId: ctx.workspaceId } },
        select: { id: true, code: true, title: true, projectId: true, startDate: true,
                  dueDate: true, status: true, percentComplete: true },
      })
    : []

  const links = analyzeCrossLinks(rawLinks as any, tasks.map(t => ({
    ...t,
    projectName: pById.get(t.projectId)?.name ?? null,
    projectCode: pById.get(t.projectId)?.code ?? null,
  })) as any)

  // Capacity is workspace-wide on purpose: a person overbooked by a project
  // outside this program is still overbooked.
  const members = await db.projectMember.findMany({
    where:  { project: { workspaceId: ctx.workspaceId, status: { in: OPEN as any } } },
    select: { userId: true, allocation: true, laborSince: true,
              user:    { select: { name: true } },
              project: { select: { id: true, name: true, code: true, status: true,
                                   startDate: true, endDate: true } } },
  })

  const people = detectOverAllocation(members.map(m => ({
    userId:        m.userId,
    userName:      m.user?.name ?? null,
    projectId:     m.project.id,
    projectName:   m.project.name,
    projectCode:   m.project.code,
    allocation:    Number(m.allocation ?? 0),
    start:         m.laborSince ?? m.project.startDate,
    end:           m.project.endDate,
    projectStatus: m.project.status,
  })), capacity).filter(p => p.overloaded.length > 0)

  return ok({
    links: links.map(l => ({
      id: l.link.id,
      type: (l.link.dependencyType || "FS").toUpperCase(),
      lagDays: Number(l.link.lagDays ?? 0),
      preceding: { code: l.preceding.code, title: l.preceding.title,
                   projectCode: l.preceding.projectCode, projectName: l.preceding.projectName,
                   dueDate: l.preceding.dueDate, status: l.preceding.status },
      dependent: { code: l.dependent.code, title: l.dependent.title,
                   projectCode: l.dependent.projectCode, projectName: l.dependent.projectName,
                   startDate: l.dependent.startDate, status: l.dependent.status },
      breach: l.breach ? { slipDays: l.breach.slipDays, active: l.breach.active } : null,
    })),
    linkSummary: summarizeCrossLinks(links),
    people: people.map(p => ({
      userId: p.userId, userName: p.userName, peak: p.peak,
      projects: p.projects, overloadedDays: p.overloadedDays,
      worst: p.overloaded[0] ? {
        start: p.overloaded[0].start, end: p.overloaded[0].end,
        total: p.overloaded[0].total,
        projects: p.overloaded[0].projects.map(x => ({ name: x.projectName, allocation: x.allocation })),
      } : null,
    })),
    capacity,
  })
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, read)
}
