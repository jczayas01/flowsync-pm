// src/app/api/time/[entryId]/status/route.ts
// Timesheet workflow: DRAFT → SUBMITTED → APPROVED (or REJECTED).
// Only APPROVED entries are picked up by postLaborActuals, so cost reaches the
// budget through a decision rather than through whatever anybody typed.
//
//   submit  — the owner sends their entry for review
//   approve — a PM-level role accepts it (nobody approves their own hours)
//   reject  — sent back with a note; the owner can edit and resubmit
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, ApiContext } from "@/lib/api"
import { postEntryCost } from "@/lib/labor-posting"

const APPROVER_ROLES = ["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR", "PROGRAM_MANAGER", "PM"]
const schema = z.object({
  action: z.enum(["submit", "approve", "reject", "reopen"]),
  note:   z.string().max(500).optional().nullable(),
})

async function decide(ctx: ApiContext, params?: Record<string, string>) {
  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const { action, note } = parsed.data

  const entry = await db.timeEntry.findUnique({
    where: { id: params!.entryId },
    select: { id: true, userId: true, status: true, costPostedAt: true,
              projectId: true, taskId: true, hours: true, hourlyRate: true, billable: true,
              project: { select: { workspaceId: true } } } as any,
  }) as any
  if (!entry || entry.project.workspaceId !== ctx.workspaceId) return notFound("Time entry")
  if (entry.costPostedAt) return err("This entry has already been posted to the budget", 409)

  const isApprover = APPROVER_ROLES.includes(String(ctx.userRole))
  const isOwner    = entry.userId === ctx.userId

  if (action === "submit") {
    if (!isOwner && !isApprover) return err("You can only submit your own time", 403)
    if (!["DRAFT", "REJECTED"].includes(String(entry.status)))
      return err("Only draft or rejected entries can be submitted", 409)
    const u = await db.timeEntry.update({ where: { id: entry.id },
      data: { status: "APPROVED" as any, submittedAt: new Date(), rejectionNote: null } as any })
    // A PM submitting their own work is also the approver — no point bouncing
    // it to themselves. Everyone else lands in SUBMITTED for review.
    if (!isApprover) {
      await db.timeEntry.update({ where: { id: entry.id },
        data: { status: "SUBMITTED" as any } as any })
      return ok({ id: u.id, status: "SUBMITTED" })
    }
    await db.$transaction(async tx => {
      await tx.timeEntry.update({ where: { id: entry.id },
        data: { approvedAt: new Date(), approvedById: ctx.userId } as any })
      await postEntryCost(tx, entry)   // approval mode: post the instant it's approved, no cron
    })
    return ok({ id: u.id, status: "APPROVED", autoApproved: true })
  }

  if (!isApprover) return err("Insufficient permissions", 403)

  if (action === "approve") {
    if (isOwner && !["OWNER", "ADMIN", "SUPER_ADMIN"].includes(String(ctx.userRole)))
      return err("You cannot approve your own time entries", 403)
    const u = await db.$transaction(async tx => {
      const up = await tx.timeEntry.update({ where: { id: entry.id },
        data: { status: "APPROVED" as any, approvedAt: new Date(), approvedById: ctx.userId,
                rejectionNote: null } as any })
      await postEntryCost(tx, entry)   // post on approve, no cron dependency
      return up
    })
    return ok({ id: u.id, status: u.status })
  }
  if (action === "reject") {
    const u = await db.timeEntry.update({ where: { id: entry.id },
      data: { status: "REJECTED" as any, rejectionNote: note || null,
              approvedAt: null, approvedById: null } as any })
    return ok({ id: u.id, status: u.status })
  }
  // reopen — pull an approved entry back before it posts
  const u = await db.timeEntry.update({ where: { id: entry.id },
    data: { status: "DRAFT" as any, approvedAt: null, approvedById: null } as any })
  return ok({ id: u.id, status: u.status })
}

export async function PATCH(req: NextRequest, { params }: { params: { entryId: string } }) {
  return withWorkspace(req, decide, params)
}
