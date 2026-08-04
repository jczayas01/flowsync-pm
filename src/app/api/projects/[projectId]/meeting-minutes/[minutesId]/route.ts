// src/app/api/projects/[projectId]/meeting-minutes/[minutesId]/route.ts
// Minutes could be created but never corrected — a typo in a decision or a
// missing attendee was permanent. PATCH mirrors the create contract field for
// field; DELETE removes a record that was filed by mistake.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const schema = z.object({
  title:       z.string().min(1).max(300).optional(),
  meetingDate: z.string().optional(),
  meetingType: z.enum(["KICKOFF","STATUS","PHASE_GATE","RISK_REVIEW","STEERING","AD_HOC","SPRINT_PLANNING","RETROSPECTIVE","OTHER"]).optional(),
  location:    z.string().max(300).optional().nullable(),
  facilitator: z.string().max(200).optional().nullable(),
  attendees:   z.any().optional(),
  agenda:      z.string().max(3000).optional().nullable(),
  discussion:  z.string().max(5000).optional().nullable(),
  decisions:   z.any().optional(),
  actionItems: z.any().optional(),
  nextMeeting: z.string().optional().nullable(),
  nextAgenda:  z.string().max(3000).optional().nullable(),
  status:      z.enum(["DRAFT","FINAL","APPROVED"]).optional(),
})

const asJson = (v: any) =>
  v === undefined ? undefined
    : Array.isArray(v) ? v
    : typeof v === "string" ? v.split("\n").map(x => x.trim()).filter(Boolean)
    : v ?? []

async function update(ctx: ApiContext, params?: Record<string, string>) {
  { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, minutesId } = params || {}
  if (!projectId || !minutesId) return notFound("Meeting minutes")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.meetingMinutes.findFirst({
    where: { id: minutesId, projectId }, select: { id: true, code: true },
  })
  if (!existing) return notFound("Meeting minutes")

  const parsed = await parseBody(ctx.req, schema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data as any

  const data: any = { ...d }
  if (d.meetingDate !== undefined) data.meetingDate = new Date(d.meetingDate)
  if (d.nextMeeting !== undefined) data.nextMeeting = d.nextMeeting ? new Date(d.nextMeeting) : null
  if (d.attendees   !== undefined) data.attendees   = asJson(d.attendees)
  if (d.decisions   !== undefined) data.decisions   = asJson(d.decisions)
  if (d.actionItems !== undefined) data.actionItems = Array.isArray(d.actionItems) ? d.actionItems : []

  const updated = await db.meetingMinutes.update({ where: { id: existing.id }, data })
  await audit(ctx.workspaceId, ctx.userId, "meeting_minutes.updated", "project", projectId,
    { code: existing.code }).catch(() => {})
  return ok(updated)
}

async function remove(ctx: ApiContext, params?: Record<string, string>) {
  { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, minutesId } = params || {}
  if (!projectId || !minutesId) return notFound("Meeting minutes")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const existing = await db.meetingMinutes.findFirst({
    where: { id: minutesId, projectId }, select: { id: true, code: true, title: true },
  })
  if (!existing) return notFound("Meeting minutes")

  await db.meetingMinutes.delete({ where: { id: existing.id } })
  await audit(ctx.workspaceId, ctx.userId, "meeting_minutes.deleted", "project", projectId,
    { code: existing.code, title: existing.title }).catch(() => {})
  return ok({ deleted: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; minutesId: string } }) {
  return withWorkspace(req, update, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; minutesId: string } }) {
  return withWorkspace(req, remove, params)
}
