// POST /api/projects/:projectId/ai-analyze/extract
// Extracts plain text from an uploaded file so the AI analyzer can read
// formats the browser can't parse client-side (.docx, .pdf).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"

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

  const name = (file.name || "").toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let text = ""

    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth: any = await import("mammoth")
      const extract = mammoth.extractRawText || mammoth.default?.extractRawText
      const result = await extract({ buffer })
      text = result?.value || ""
    } else if (name.endsWith(".pdf")) {
      const { extractText } = await import("unpdf")
      const result = await extractText(new Uint8Array(buffer), { mergePages: true })
      text = (result?.text as string) || ""
    } else {
      // Plain-text formats
      text = buffer.toString("utf-8")
    }

    text = (text || "").trim()
    if (!text) {
      return NextResponse.json(
        { error: "No readable text found in this file (it may be a scanned image)" },
        { status: 422 },
      )
    }

    return NextResponse.json({ text: text.slice(0, MAX_CHARS), name: file.name })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not extract text: ${e?.message || "unknown error"}` },
      { status: 500 },
    )
  }
}
