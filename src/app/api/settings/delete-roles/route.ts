// src/app/api/settings/delete-roles/route.ts
// GET   — current deletion-permission configuration (+ what's assignable)
// PATCH — update it. Workspace admins only. SUPER_ADMIN/OWNER can't be removed.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, audit, ApiContext } from "@/lib/api"
import {
  getDeleteRoles, normalizeDeleteRoles,
  ASSIGNABLE_DELETE_ROLES, ALWAYS_DELETE_ROLES,
} from "@/lib/security/delete-permissions"

const patchSchema = z.object({
  project:   z.array(z.string()).optional(),
  program:   z.array(z.string()).optional(),
  portfolio: z.array(z.string()).optional(),
})

async function assertAdmin(ctx: ApiContext) {
  const me = await db.workspaceMember.findFirst({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    select: { role: true },
  })
  if (!me || !["SUPER_ADMIN","OWNER","ADMIN"].includes(String(me.role))) return null
  return me
}

async function getConfig(ctx: ApiContext) {
  if (!(await assertAdmin(ctx))) return err("Not allowed", 403)
  const roles = await getDeleteRoles(ctx.workspaceId)
  return ok({ roles, assignable: ASSIGNABLE_DELETE_ROLES, alwaysOn: ALWAYS_DELETE_ROLES })
}

async function patchConfig(ctx: ApiContext) {
  if (!(await assertAdmin(ctx))) return err("Not allowed", 403)
  const body = await parseBody(ctx.req, patchSchema)
  if ("error" in body) return body.error

  const current = await getDeleteRoles(ctx.workspaceId)
  const next = {
    project:   body.data.project   !== undefined ? normalizeDeleteRoles(body.data.project)   : current.project,
    program:   body.data.program   !== undefined ? normalizeDeleteRoles(body.data.program)   : current.program,
    portfolio: body.data.portfolio !== undefined ? normalizeDeleteRoles(body.data.portfolio) : current.portfolio,
  }

  const ws = await db.workspace.findUnique({
    where: { id: ctx.workspaceId }, select: { settings: true },
  })
  const settings = { ...((ws?.settings as object) || {}), deleteRoles: next }
  await db.workspace.update({ where: { id: ctx.workspaceId }, data: { settings } })
  await audit(ctx.workspaceId, ctx.userId, "workspace.delete_roles_updated", "workspace", ctx.workspaceId)
  return ok({ roles: next })
}

export async function GET(req: NextRequest)   { return withWorkspace(req, getConfig) }
export async function PATCH(req: NextRequest) { return withWorkspace(req, patchConfig) }
