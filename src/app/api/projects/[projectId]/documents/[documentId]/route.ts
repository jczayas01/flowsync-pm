// DELETE /api/projects/:projectId/documents/:documentId
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess, audit } from "@/lib/api"
import { deleteFile } from "@/lib/storage"
import { can, mapDbRoleToRbac } from "@/lib/rbac/roles"
import { notifyMany } from "@/lib/notify"

// PATCH /api/projects/:projectId/documents/:documentId — toggle share-with-client
export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string; documentId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Only users who can edit the project may change client-sharing
  const member = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId }, select: { role: true },
  })
  if (!can(mapDbRoleToRbac(member?.role), "projects:edit")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 })
  }

  const doc = await db.document.findUnique({ where: { id: params.documentId } })
  if (!doc || doc.projectId !== params.projectId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const updated = await db.document.update({
    where: { id: params.documentId },
    data:  "sharedWithClient" in body ? { sharedWithClient: Boolean(body.sharedWithClient) } : {},
  })

  // Explicit per-member sharing: body.shareUserIds = array of userIds who may see this doc
  if (Array.isArray(body.shareUserIds)) {
    try {
      const existing = await db.documentShare.findMany({ where: { documentId: params.documentId }, select: { userId: true } })
      const prev = new Set(existing.map(s => s.userId))
      const ids: string[] = Array.from(new Set(body.shareUserIds.filter((x:any) => typeof x === "string")))
      await db.documentShare.deleteMany({ where: { documentId: params.documentId } })
      if (ids.length) {
        await db.documentShare.createMany({ data: ids.map(userId => ({ documentId: params.documentId, userId })), skipDuplicates: true })
      }
      const added = ids.filter(u => !prev.has(u))
      if (added.length) {
        await notifyMany(added, { workspaceId, actorId: session.user.id, type: "DOC_SHARED",
          title: `A document was shared with you: "${updated.name}"`, link: "/my-tasks" })
      }
    } catch { /* ignore */ }
  }

  // When sharing with clients (not unsharing), notify the project's client members
  if (Boolean(body.sharedWithClient)) {
    try {
      const [clients, projMembers] = await Promise.all([
        db.workspaceMember.findMany({ where: { workspaceId, role: "CLIENT" }, select: { userId: true } }),
        db.projectMember.findMany({ where: { projectId: params.projectId }, select: { userId: true } }),
      ])
      const inProject = new Set(projMembers.map(m => m.userId))
      const targets = clients.map(c => c.userId).filter(u => inProject.has(u))
      await notifyMany(targets, {
        workspaceId, actorId: session.user.id, type: "DOC_SHARED",
        title: `A document was shared with you: "${updated.name}"`, link: "/my-tasks",
      })
    } catch { /* ignore */ }
  }

  await audit(workspaceId, session.user.id, "document.shared_toggle", "project", params.projectId,
    doc as any, updated as any)

  return NextResponse.json({ document: updated })
}

// DELETE /api/projects/:projectId/documents/:documentId
export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string; documentId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId

  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const doc = await db.document.findUnique({ where: { id: params.documentId } })
  if (!doc || doc.projectId !== params.projectId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  // Delete from Supabase Storage (extract path from URL)
  try {
    const url    = new URL(doc.fileUrl)
    const path   = url.pathname.split(`/${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://","").split(".")[0]}/storage/v1/object/public/project-documents/`).pop() || ""
    if (path) await deleteFile(path)
  } catch { /* storage delete failure is non-fatal */ }

  await db.document.delete({ where: { id: params.documentId } })

  await audit(workspaceId, session.user.id, "document.deleted", "project", params.projectId,
    doc as any, undefined)

  return NextResponse.json({ deleted: true })
}
