// PATCH  /api/programs/:programId — update a program
// DELETE /api/programs/:programId — delete it (projects are released, not deleted)
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { canDelete } from "@/lib/security/delete-permissions"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  color:       z.string().max(20).optional(),
  managerId:   z.string().optional().nullable(),
})

async function load(ctx: ApiContext, programId?: string) {
  if (!programId) return { error: err("Program ID required") }
  const program = await db.program.findFirst({
    where: { id: programId, portfolio: { workspaceId: ctx.workspaceId } },
  })
  if (!program) return { error: notFound("Program") }
  return { program }
}

async function updateProgram(ctx: ApiContext, params?: Record<string, string>) {
  const guard = await requirePermission(ctx as any, "programs:create")
  if (guard) return guard
  const { program, error } = await load(ctx, params?.programId)
  if (error) return error
  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  try {
    const updated = await db.program.update({
      where: { id: program!.id },
      data: {
        ...parsed.data,
        managerId: parsed.data.managerId === "" ? null : parsed.data.managerId,
      },
    })
    return ok({ id: updated.id })
  } catch (e: any) {
    return err(e?.message || "Failed to update program", 500)
  }
}

async function deleteProgram(ctx: ApiContext, params?: Record<string, string>) {
  // Deletion roles are workspace-configurable (Settings → Roles → Deletion
  // permissions); defaults to workspace admins.
  if (!(await canDelete(ctx.workspaceId, ctx.userRole, 'program'))) return err("Not allowed", 403)
  const { program, error } = await load(ctx, params?.programId)
  if (error) return error
  try {
    // Release member projects first, then remove the program
    await db.project.updateMany({ where: { programId: program!.id }, data: { programId: null } })
    await db.program.delete({ where: { id: program!.id } })
    return ok({ deleted: true })
  } catch (e: any) {
    return err(e?.message || "Failed to delete program", 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { programId: string } }) {
  return withWorkspace(req, updateProgram, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { programId: string } }) {
  return withWorkspace(req, deleteProgram, params)
}
