// POST /api/projects/:projectId/ai-analyze/extract
// Extracts plain text from an uploaded file so the AI analyzer can read
// formats the browser can't parse client-side (.docx, .pdf, .xlsx, .pptx, .msg).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { extractTextFromBuffer } from "@/lib/extract"

const MAX_CHARS = 20000

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

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const text = await extractTextFromBuffer(file.name || "", buffer)
    if (!text) {
      return NextResponse.json(
        { error: "No readable text found in this file (it may be a scanned image)" },
        { status: 422 },
      )
    }
    return NextResponse.json({ text: text.slice(0, MAX_CHARS), name: file.name })
  } catch (e: any) {
    const msg = e?.message || "unknown error"
    const status = msg.includes("Legacy") ? 415 : 500
    return NextResponse.json({ error: status === 415 ? msg : `Could not extract text: ${msg}` }, { status })
  }
}
