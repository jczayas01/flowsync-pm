// src/app/api/projects/[projectId]/program/route.ts
// Assign (or unassign) a project to a program. This is a portfolio/program-management
// action, so it is gated on workspace-level `projects:edit` and workspace scope —
// NOT project membership (unlike the general project PATCH). That lets PMO Directors,
// Portfolio/Program Managers, Admins and Owners assign any workspace project without
// having to be a member of it, while read-only roles (e.g. Executive) are denied.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, parseBody, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  programId: z.string().min(1).nullable(),
})

async function assignProgram(ctx: ApiContext, params?: Record<string, string>) {
  const guard = await requirePermission(ctx as any, "projects:edit" as any)
  if (guard) return guard

  const projectId = params?.projectId
  if (!projectId) return err("Project ID required")

  // Workspace scope (not membership) — program managers manage composition, not tasks.
  const project = await db.project.findFirst({
    where:  { id: projectId, workspaceId: ctx.workspaceId },
    select: { id: true },
  })
  if (!project) return notFound("Project")

  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const { programId } = parsed.data

  // When assigning, ensure the program lives in the same workspace.
  if (programId) {
    const program = await db.program.findFirst({
      where:  { id: programId, portfolio: { workspaceId: ctx.workspaceId } },
      select: { id: true },
    })
    if (!program) return notFound("Program")
  }

  const updated = await db.project.update({
    where:  { id: projectId },
    data:   { programId },
    select: { id: true, programId: true },
  })
  return ok(updated)
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  return withWorkspace(req, assignProgram, params)
}
