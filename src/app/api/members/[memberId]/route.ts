// src/app/api/members/[memberId]/route.ts — update a workspace member's skills.
// Editable by resource-management roles (Owner/Admin/PMO Director) or by the member
// themselves editing their own skills.
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, forbidden, parseBody, ApiContext } from "@/lib/api"

const ADMINISH = ["SUPER_ADMIN", "OWNER", "ADMIN", "PMO_DIRECTOR"]
const schema = z.object({ skills: z.array(z.string()) })

async function updateMember(ctx: ApiContext, params?: Record<string, string>) {
  const id = params?.memberId
  if (!id) return err("Member ID required")
  const member = await db.workspaceMember.findFirst({
    where: { id, workspaceId: ctx.workspaceId }, select: { id: true, userId: true },
  })
  if (!member) return notFound("Member")
  const canEdit = ADMINISH.includes(ctx.userRole as any) || member.userId === ctx.userId
  if (!canEdit) return forbidden()

  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const skills = Array.from(new Set(parsed.data.skills.map((s: string) => s.trim()).filter(Boolean))) as string[]
  const updated = await db.workspaceMember.update({
    where: { id }, data: { skills }, select: { id: true, skills: true },
  })
  return ok(updated)
}

export async function PATCH(req: NextRequest, { params }: { params: { memberId: string } }) {
  return withWorkspace(req, updateMember, params)
}
