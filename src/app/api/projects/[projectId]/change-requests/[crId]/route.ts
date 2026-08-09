// src/app/api/projects/[projectId]/change-requests/[crId]/route.ts
// GET   — get a single change request
// PATCH — update status (approve, reject, implement) or edit fields

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { fireTrigger } from "@/lib/automation/trigger"
import { dispatchEvent } from "@/lib/automation/dispatch"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  status:          z.enum(["DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","REJECTED","IMPLEMENTED"]).optional(),
  title:           z.string().min(1).max(200).optional(),
  description:     z.string().max(5000).optional().nullable(),
  priority:        z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  scheduleImpact:  z.string().max(100).optional().nullable(),
  budgetImpact:    z.number().optional().nullable(),
  scopeImpact:     z.string().max(2000).optional().nullable(),
  scheduleDays:    z.number().int().min(-3650).max(3650).optional().nullable(),
  budgetLineId:    z.string().optional().nullable(),
  qualityImpact:   z.string().max(2000).optional().nullable(),
  rejectedReason:  z.string().max(2000).optional().nullable(),
}).strict()

async function getChangeRequest(ctx: ApiContext, params?: Record<string,string>) {
  const { projectId, crId } = params || {}
  if (!projectId || !crId) return err("Project ID and CR ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const cr = await db.changeRequest.findUnique({
    where:   { id: crId },
    include: {
      requestedBy: { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy:  { select:{ id:true, name:true, avatarUrl:true } },
      comments:    {
        orderBy: { createdAt: "asc" },
        include: { author: { select:{ id:true, name:true, avatarUrl:true } } },
      },
    },
  })
  if (!cr || cr.projectId !== projectId) return notFound("Change request")

  return ok({ ...cr, budgetImpact: cr.budgetImpact ? Number(cr.budgetImpact) : null })
}

async function updateChangeRequest(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "changes:create" as any); if (_g) return _g }
  const { projectId, crId } = params || {}
  if (!projectId || !crId) return err("Project ID and CR ID required")

  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.changeRequest.findUnique({ where: { id: crId } })
  if (!existing || existing.projectId !== projectId) return notFound("Change request")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error

  const data: any = { ...parsed.data }

  // Set approval/rejection metadata automatically
  if (data.status === "APPROVED") {
    data.approvedById = ctx.userId
    data.approvedAt   = new Date()
  }
  if (data.status === "IMPLEMENTED") {
    data.implementedAt = new Date()
  }
  // ── Approval applies the change ──────────────────────────────────────────
  // A change control process whose output is a signature and a to-do list is a
  // filing cabinet: somebody still has to remember to move the budget, extend
  // the date and update the scope, and the day they forget is the day the
  // register and the project stop describing the same thing. Approval does it.
  let applied: string[] = []
  const willApply = data.status === "APPROVED" && !(existing as any).appliedAt
  if (willApply) {
    const cr = existing as any
    const money = cr.budgetImpact == null ? 0 : Number(cr.budgetImpact)
    const days  = cr.scheduleDays == null ? 0 : Number(cr.scheduleDays)

    try {
      await db.$transaction(async tx => {
        // Cost — onto the nominated line, or as a new line when none was chosen,
        // so approved money is never left without a home.
        if (money !== 0) {
          if (cr.budgetLineId) {
            const line = await tx.budgetItem.findFirst({
              where: { id: cr.budgetLineId, projectId }, select: { id: true, name: true, plannedCost: true },
            })
            if (line) {
              await tx.budgetItem.update({
                where: { id: line.id },
                data:  { plannedCost: { increment: money } },
              })
              applied.push(`${money > 0 ? "Added" : "Removed"} ${Math.abs(money).toLocaleString(undefined,{style:"currency",currency:"USD"})} ${money > 0 ? "to" : "from"} "${line.name}"`)
            }
          } else {
            const created = await tx.budgetItem.create({
              data: {
                projectId, category: "OTHER" as any,
                name: `${cr.code} — ${cr.title}`.slice(0, 200),
                plannedCost: money, approvedCost: money, approvedAt: new Date(),
              },
            })
            applied.push(`Created budget line "${created.name}" for ${money.toLocaleString(undefined,{style:"currency",currency:"USD"})}`)
          }
          const agg = await tx.budgetItem.aggregate({ where: { projectId }, _sum: { plannedCost: true } })
          await tx.project.update({ where: { id: projectId }, data: { budgetTotal: agg._sum.plannedCost ?? 0 } })
        }

        // Schedule — the end date moves, and so do the milestones that sit after
        // today, because a change that delays delivery delays what it delivers.
        if (days !== 0) {
          const proj = await tx.project.findUnique({ where: { id: projectId }, select: { endDate: true } })
          if (proj?.endDate) {
            const nd = new Date(proj.endDate)
            nd.setDate(nd.getDate() + days)
            await tx.project.update({ where: { id: projectId }, data: { endDate: nd } })
            applied.push(`Moved the project finish date by ${days > 0 ? "+" : ""}${days} day${Math.abs(days) === 1 ? "" : "s"}`)
          }
          const ms = await tx.milestone.findMany({
            where: { projectId, dueDate: { gte: new Date() }, status: { not: "ACHIEVED" as any } },
            select: { id: true, dueDate: true },
          })
          for (const m2 of ms) {
            if (!m2.dueDate) continue
            const nd = new Date(m2.dueDate); nd.setDate(nd.getDate() + days)
            await tx.milestone.update({ where: { id: m2.id }, data: { dueDate: nd } })
          }
          if (ms.length) applied.push(`Rescheduled ${ms.length} upcoming milestone${ms.length === 1 ? "" : "s"}`)
        }

        // Scope — appended with attribution, never overwritten. The original
        // wording is evidence of what was agreed before the change.
        if (cr.scopeImpact) {
          const proj = await tx.project.findUnique({ where: { id: projectId }, select: { scope: true } })
          const stamp = `\n\n[${cr.code}, approved ${new Date().toISOString().slice(0,10)}] ${cr.scopeImpact}`
          await tx.project.update({
            where: { id: projectId },
            data:  { scope: `${proj?.scope || ""}${stamp}`.slice(0, 20000) },
          })
          applied.push("Appended the scope change to the project scope")
        }
      })

      // A cost change without a new baseline leaves the approved figure and the
      // working plan disagreeing — the exact drift the Budget tab now flags.
      if (money !== 0) {
        const lines = await db.budgetItem.findMany({
          where: { projectId },
          select: { id: true, name: true, category: true, plannedCost: true, approvedCost: true, earnRule: true },
        })
        const proj = await db.project.findUnique({
          where: { id: projectId },
          select: { budgetTotal: true, startDate: true, endDate: true, scope: true, outOfScope: true, objective: true },
        })
        if (proj?.startDate && proj?.endDate) {
          await db.baseline.create({
            data: {
              projectId,
              name: `Rebaseline — ${(existing as any).code}`,
              description: `Cost baseline recaptured on approval of ${(existing as any).code}: ${(existing as any).title}`,
              snapshotData: {
                capturedAt: new Date().toISOString(),
                budget: { total: Number(proj.budgetTotal), lines: lines.map(l => ({
                  id: l.id, name: l.name, category: l.category,
                  plannedCost: Number(l.plannedCost || 0),
                  approvedCost: l.approvedCost == null ? null : Number(l.approvedCost),
                  earnRule: (l as any).earnRule || "EFFORT",
                })) },
                schedule: { startDate: proj.startDate, endDate: proj.endDate },
              },
              budgetTotal: proj.budgetTotal,
              startDate: proj.startDate, endDate: proj.endDate,
              scopeSnapshot: proj.scope, outOfScopeSnapshot: proj.outOfScope, objectiveSnapshot: proj.objective,
              createdById: ctx.userId,
              approvedById: ctx.userId, approvedAt: new Date(), isApproved: true,
              approvalNotes: `Approved with ${(existing as any).code}`,
              linkedCrId: (existing as any).id,
            },
          }).catch(() => {})
          applied.push("Captured a new approved cost baseline")
        }
      }

      data.appliedAt = new Date()
      data.appliedSummary = applied.length ? applied.join(" · ") : "No automatic changes were applicable"
    } catch (e: any) {
      console.error("[ChangeRequest] apply failed:", e)
      return err(`The change was approved but could not be applied: ${e?.message || "unknown error"}. Nothing was changed.`, 500)
    }
  }


  const updated = await db.changeRequest.update({
    where: { id: crId },
    data,
    include: {
      requestedBy: { select:{ id:true, name:true, avatarUrl:true } },
      approvedBy:  { select:{ id:true, name:true, avatarUrl:true } },
    },
  })

  await audit(ctx.workspaceId, ctx.userId, "change_request.updated", "project", projectId,
    existing as any, updated as any)

  if (data.status === "APPROVED" && existing.status !== "APPROVED") {
    fireTrigger("change.approved", ctx.workspaceId, projectId, "change_request", updated.id, ctx.userId,
      { title: updated.title, budgetImpact: updated.budgetImpact ? Number(updated.budgetImpact) : 0 })
  }
  if (data.status === "SUBMITTED" && existing.status !== "SUBMITTED") {
    fireTrigger("change.submitted", ctx.workspaceId, projectId, "change_request", updated.id, ctx.userId,
      { title: updated.title, budgetImpact: updated.budgetImpact ? Number(updated.budgetImpact) : 0 })
  }

  // The fireTrigger above already routes CHANGE_APPROVED through the engine,
  // which now reaches every catalogue action. Dispatching a second time made
  // each approval run its rules twice — two baselines from one decision.

  return ok({ ...updated, budgetImpact: updated.budgetImpact ? Number(updated.budgetImpact) : null })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string; crId: string } }) {
  return withWorkspace(req, getChangeRequest, params)
}
async function deleteChangeRequest(ctx: ApiContext, params?: Record<string, string>) {
  const { projectId, crId } = params || {}
  if (!projectId || !crId) return notFound("Change request")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  { const _g = await requirePermission(ctx as any, "project:edit" as any); if (_g) return _g }

  const cr = await db.changeRequest.findFirst({
    where: { id: crId, projectId }, select: { id: true, code: true, title: true, status: true },
  })
  if (!cr) return notFound("Change request")

  // An approved or implemented change request is part of the project's decision
  // history — deleting it would erase why the baseline moved.
  if (cr.status === "APPROVED" || cr.status === "IMPLEMENTED") {
    return err("Approved change requests can't be deleted — they document why the baseline changed. Reject or supersede it instead.", 409)
  }

  await db.changeRequest.delete({ where: { id: cr.id } })
  await audit(ctx.workspaceId, ctx.userId, "change_request.deleted", "project", projectId,
    { code: cr.code, title: cr.title }).catch(() => {})
  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; crId: string } }) {
  return withWorkspace(req, updateChangeRequest, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; crId: string } }) {
  return withWorkspace(req, deleteChangeRequest, params)
}
