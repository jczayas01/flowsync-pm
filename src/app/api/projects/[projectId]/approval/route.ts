// GET  /api/projects/:projectId/approval — current approval state + caller rights
// POST /api/projects/:projectId/approval — { action: "submit" | "approve" | "reject", reason? }
// DRAFT → submit → PENDING_APPROVAL → approve → ACTIVE (Decision logged, Gate 0 achieved)
//                                   → reject  → DRAFT
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { mapDbRoleToRbac, ROLE_LEVEL } from "@/lib/rbac/roles"
import { notify, notifyMany } from "@/lib/notify"

const APPROVER_PROJECT_ROLES = ["SPONSOR", "EXECUTIVE_SPONSOR", "PMO"]
const APPROVER_WS_ROLES      = ["OWNER", "ADMIN", "PMO_DIRECTOR", "SUPER_ADMIN"]

async function getRights(projectId: string, userId: string, workspaceId: string) {
  const wsm = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  if (!wsm) return null
  const level = ROLE_LEVEL[mapDbRoleToRbac(wsm.role)] ?? 0
  const pm = await db.projectMember.findFirst({
    where: { projectId, userId },
    select: { projectRole: true },
  })
  const canApprove =
    APPROVER_WS_ROLES.includes(wsm.role) ||
    APPROVER_PROJECT_ROLES.includes(pm?.projectRole || "")
  const canSubmit = level >= 50 // PM and above
  return { level, canApprove, canSubmit, wsRole: wsm.role }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rights = await getRights(params.projectId, session.user.id, workspaceId)
  if (!rights) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: { status: true, approvalRequestedAt: true, approvalRequestedById: true },
  })

  return NextResponse.json({
    data: {
      status: project?.status,
      requestedAt: project?.approvalRequestedAt,
      requestedByMe: project?.approvalRequestedById === session.user.id,
      canApprove: rights.canApprove,
      canSubmit: rights.canSubmit,
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.locked) {
      return NextResponse.json(
        { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
        { status: 402 })
    }
  const rights = await getRights(params.projectId, session.user.id, workspaceId)
  if (!rights) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action: string = body?.action
  const reason: string = (body?.reason || "").slice(0, 1000)

  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, name: true, code: true, status: true, approvalRequestedById: true },
  })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const link = `/projects/${project.id}`

  // ── SUBMIT ──
  if (action === "submit") {
    if (!rights.canSubmit) return NextResponse.json({ error: "Only PMs and above can submit for approval" }, { status: 403 })
    if (project.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft projects can be submitted for approval" }, { status: 409 })
    }

    await db.project.update({
      where: { id: project.id },
      data: { status: "PENDING_APPROVAL" as any, approvalRequestedAt: new Date(), approvalRequestedById: session.user.id },
    })

    // Notify sponsors/PMO on the project + workspace approvers
    const [sponsorMembers, wsApprovers] = await Promise.all([
      db.projectMember.findMany({
        where: { projectId: project.id, projectRole: { in: APPROVER_PROJECT_ROLES as any } },
        select: { userId: true },
      }),
      db.workspaceMember.findMany({
        where: { workspaceId, role: { in: APPROVER_WS_ROLES as any } },
        select: { userId: true },
      }),
    ])
    const approverIds = [...new Set([...sponsorMembers, ...wsApprovers].map(m => m.userId))]
    await notifyMany(approverIds, {
      workspaceId,
      actorId: session.user.id,
      type: "APPROVAL_REQUESTED",
      title: `Approval requested: ${project.name}`,
      body: `${project.code} is ready for review${reason ? ` — "${reason}"` : ""}`,
      link,
    }).catch(() => {})

    return NextResponse.json({ data: { status: "PENDING_APPROVAL" } })
  }

  // ── APPROVE / REJECT ──
  if (action === "approve" || action === "reject") {
    if (!rights.canApprove) {
      return NextResponse.json({ error: "Only a Sponsor, PMO, or workspace admin can decide on approval" }, { status: 403 })
    }
    if (project.status !== ("PENDING_APPROVAL" as any)) {
      return NextResponse.json({ error: "This project is not pending approval" }, { status: 409 })
    }
    // No self-approval (admins level 80+ may override)
    if (action === "approve" && project.approvalRequestedById === session.user.id && rights.level < 80) {
      return NextResponse.json({ error: "You cannot approve your own request — another approver must decide" }, { status: 403 })
    }

    if (action === "approve") {
      await db.project.update({ where: { id: project.id }, data: { status: "ACTIVE" } })

      // Log the decision (DEC-###)
      try {
        const all = await db.decision.findMany({ where: { projectId: project.id }, select: { code: true } })
        const max = all
          .map(r => parseInt((r.code || "").replace(/^DEC-/, ""), 10))
          .filter(n => !isNaN(n))
          .reduce((a, b) => Math.max(a, b), 0)
        const code = `DEC-${String(max + 1).padStart(3, "0")}`
        await db.decision.create({
          data: {
            projectId: project.id,
            code,
            title: "Project approved for execution",
            description: `${project.code} moved from Draft to Active.${reason ? ` Notes: ${reason}` : ""}`,
            rationale: "Approved via project approval workflow.",
            madeById: session.user.id,
          },
        })
      } catch { /* decision log is best-effort */ }

      // Gate 0 tie-in: mark the concept gate achieved if present
      try {
        const gate = await db.milestone.findFirst({
          where: {
            projectId: project.id,
            name: { contains: "Gate 0", mode: "insensitive" },
            status: { in: ["UPCOMING", "AT_RISK"] as any },
          },
        })
        if (gate) await db.milestone.update({ where: { id: gate.id }, data: { status: "ACHIEVED" as any } })
      } catch { /* optional */ }
    } else {
      await db.project.update({
        where: { id: project.id },
        data: { status: "DRAFT", approvalRequestedAt: null, approvalRequestedById: null },
      })
    }

    // Notify the requester (and PMs) of the outcome
    const pmMembers = await db.projectMember.findMany({
      where: { projectId: project.id, projectRole: { in: ["PM"] as any } },
      select: { userId: true },
    })
    const recipients = [...new Set([
      ...(project.approvalRequestedById ? [project.approvalRequestedById] : []),
      ...pmMembers.map(m => m.userId),
    ])]
    await notifyMany(recipients, {
      workspaceId,
      actorId: session.user.id,
      type: "APPROVAL_DECISION",
      title: action === "approve"
        ? `Approved: ${project.name} is now Active`
        : `Not approved: ${project.name} returned to Draft`,
      body: reason ? `Reviewer notes: ${reason}` : (action === "approve" ? "Approved for execution" : "Sent back for changes"),
      link,
    }).catch(() => {})

    return NextResponse.json({ data: { status: action === "approve" ? "ACTIVE" : "DRAFT" } })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
