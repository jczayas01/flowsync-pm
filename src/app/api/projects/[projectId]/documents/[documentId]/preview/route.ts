// GET /api/projects/:projectId/documents/:documentId/preview
// Server-side inline preview for types the browser can't render (currently .docx).
// Fetches the object via service role and converts docx -> HTML with mammoth.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { downloadBuffer } from "@/lib/storage"

const DOCX_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string; documentId: string } },
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

  const type = doc.fileType || ""
  const isDocx = DOCX_TYPES.includes(type) || String(doc.name || "").toLowerCase().endsWith(".docx")
  if (!isDocx) {
    return NextResponse.json({ error: "Inline preview not supported for this file type" }, { status: 415 })
  }

  const buffer = await downloadBuffer(doc.fileUrl)
  if (!buffer) return NextResponse.json({ error: "Could not read file from storage" }, { status: 502 })

  try {
    const mammoth: any = await import("mammoth")
    const convert = mammoth.convertToHtml || mammoth.default?.convertToHtml
    const { value } = await convert({ buffer })
    return NextResponse.json({ html: value || "<p><em>Empty document.</em></p>" })
  } catch (e: any) {
    return NextResponse.json({ error: `Preview failed: ${e?.message || "conversion error"}` }, { status: 500 })
  }
}
