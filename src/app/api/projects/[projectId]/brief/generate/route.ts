// POST /api/projects/:projectId/brief/generate
// Reads the project's uploaded documents (all recent, or the ids the user
// picked) and asks the AI to draft the Project Brief sections.
// Returns drafts only — nothing is saved until the user applies them.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { downloadBuffer } from "@/lib/storage"
import { extractTextFromBuffer } from "@/lib/extract"

const PER_DOC_CHARS = 6000
const TOTAL_CHARS   = 15000

const FIELDS = [
  "description", "background", "objective", "scope", "outOfScope",
  "economicImpact", "assumptions", "constraints",
] as const

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

  const body = await req.json().catch(() => ({}))
  const documentIds: string[] | undefined =
    Array.isArray(body?.documentIds) && body.documentIds.length ? body.documentIds : undefined

  const docs = await db.document.findMany({
    where: { projectId: params.projectId, ...(documentIds ? { id: { in: documentIds } } : {}) },
    orderBy: { createdAt: "desc" },
    ...(documentIds ? {} : { take: 3 }),
    select: { id: true, name: true, fileUrl: true },
  })
  if (!docs.length) {
    return NextResponse.json({ error: "No documents found — upload files to this project first" }, { status: 400 })
  }

  // Pull and extract text from each document
  const chunks: string[] = []
  const used: string[] = []
  let total = 0
  for (const d of docs) {
    if (total >= TOTAL_CHARS) break
    try {
      const buf = await downloadBuffer(d.fileUrl)
      if (!buf) continue
      const t = (await extractTextFromBuffer(d.name, buf)).slice(0, PER_DOC_CHARS)
      if (!t) continue
      chunks.push(`## Document: ${d.name}\n${t}`)
      used.push(d.name)
      total += t.length
    } catch { /* skip unreadable docs, keep going */ }
  }
  if (!chunks.length) {
    return NextResponse.json(
      { error: "Could not read any of the selected documents" },
      { status: 422 },
    )
  }

  const project = await db.project.findUnique({
    where: { id: params.projectId },
    select: { name: true, code: true },
  })

  const prompt = `You are a PMO assistant. Based on the project documents below, draft the Project Brief for "${project?.name}" (${project?.code}).

Write in the SAME LANGUAGE as the source documents.

Respond ONLY with valid JSON, no markdown, exactly this shape (use null for any field the documents don't support):
{
  "description": "short summary of what this project is (max 100 words)",
  "background": "business context and why this project exists (max 120 words)",
  "objective": "what the project must achieve, measurable outcomes (max 120 words)",
  "scope": "deliverables and work included (max 120 words)",
  "outOfScope": "what is explicitly excluded (max 80 words)",
  "economicImpact": "expected financial benefit, savings, or ROI (max 80 words)",
  "assumptions": "conditions assumed true (max 80 words)",
  "constraints": "known limitations: budget, regulatory, technology, deadlines (max 80 words)"
}

${chunks.join("\n\n").slice(0, TOTAL_CHARS)}`

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const e = await response.json().catch(() => ({}))
      return NextResponse.json({ error: "AI service error", details: e }, { status: 502 })
    }

    const data = await response.json()
    if (data.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "The draft was too long and got cut off — try selecting fewer documents" },
        { status: 502 },
      )
    }

    const text = data.content?.map((b: any) => b.text || "").join("") || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 })
    }

    const raw = JSON.parse(jsonMatch[0])
    const drafts: Record<string, string> = {}
    for (const f of FIELDS) {
      const v = raw[f]
      if (typeof v === "string" && v.trim()) drafts[f] = v.trim()
    }

    return NextResponse.json({ data: { drafts, usedDocuments: used } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI request failed" }, { status: 500 })
  }
}
