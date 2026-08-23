// src/app/api/time/[entryId]/route.ts
// Delete a time entry. Refused once the cost has been posted to a budget line —
// removing it then would silently overstate the remaining budget. Reverse the
// cost first (or add a correcting entry) instead.
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, ApiContext } from "@/lib/api"

async function remove(ctx: ApiContext, params?: Record<string, string>) {
  const entry = await db.timeEntry.findUnique({
    where: { id: params!.entryId },
    select: { id: true, userId: true, costPostedAt: true, projectId: true,
              project: { select: { workspaceId: true } } },
  })
  if (!entry || entry.project.workspaceId !== ctx.workspaceId) return notFound("Time entry")

  const privileged = ["OWNER", "ADMIN", "SUPER_ADMIN", "PMO_DIRECTOR", "PROGRAM_MANAGER", "PM"]
    .includes(String(ctx.userRole))
  if (entry.userId !== ctx.userId && !privileged) {
    return err("You can only delete your own time entries", 403)
  }
  if (entry.costPostedAt) {
    return err("This entry has already been posted to the budget and cannot be deleted. Log a correcting entry instead.", 409)
  }
  await db.timeEntry.delete({ where: { id: entry.id } })
  return ok({ deleted: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { entryId: string } }) {
  return withWorkspace(req, remove, params)
}
