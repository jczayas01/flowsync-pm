// src/app/api/time/[entryId]/route.ts
// Delete a time entry. Refused once the cost has been posted to a budget line —
// removing it then would silently overstate the remaining budget. Reverse the
// cost first (or add a correcting entry) instead.
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, ApiContext } from "@/lib/api"
import { reverseEntryCost } from "@/lib/labor-posting"

async function remove(ctx: ApiContext, params?: Record<string, string>) {
  const entry = await db.timeEntry.findUnique({
    where: { id: params!.entryId },
    select: { id: true, userId: true, costPostedAt: true, projectId: true, taskId: true,
              hours: true, hourlyRate: true,
              project: { select: { workspaceId: true } } },
  })
  if (!entry || entry.project.workspaceId !== ctx.workspaceId) return notFound("Time entry")

  const privileged = ["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR", "PROGRAM_MANAGER", "PM"]
    .includes(String(ctx.userRole))
  if (entry.userId !== ctx.userId && !privileged) {
    return err("You can only delete your own time entries", 403)
  }

  // If the cost already reached the budget, reverse it with a correcting expense
  // in the same transaction, then delete — so the budget always stays truthful
  // and there is no "posted, can't touch it" dead end.
  await db.$transaction(async tx => {
    if (entry.costPostedAt) {
      await reverseEntryCost(tx, {
        id: entry.id, projectId: entry.projectId, taskId: entry.taskId,
        hours: entry.hours, hourlyRate: entry.hourlyRate, costPostedAt: entry.costPostedAt,
      })
    }
    await tx.timeEntry.delete({ where: { id: entry.id } })
  })
  return ok({ deleted: true, reversed: !!entry.costPostedAt })
}

export async function DELETE(req: NextRequest, { params }: { params: { entryId: string } }) {
  return withWorkspace(req, remove, params)
}
