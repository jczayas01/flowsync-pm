// POST /api/projects/:projectId/budget/scan — AI-extract budget line-item candidates from stored documents
// Body: { documentIds: string[] } → { candidates: [...], scannedDocs: string[] }
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { downloadBuffer } from "@/lib/storage"
import { extractTextFromBuffer } from "@/lib/extract"

const PER_DOC = 6000
const TOTAL   = 18000

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.documentIds) ? body.documentIds.filter(Boolean) : []
  if (!ids.length) return NextResponse.json({ error: "No documents selected" }, { status: 400 })

  const docs = await db.document.findMany({
    where: { projectId: params.projectId, id: { in: ids } },
    select: { id: true, name: true, fileUrl: true },
  })
  if (!docs.length) return NextResponse.json({ error: "Documents not found" }, { status: 404 })

  const chunks: string[] = []
  const scanned: string[] = []
  let total = 0
  for (const d of docs) {
    if (total >= TOTAL) break
    try {
      const buf = await downloadBuffer(d.fileUrl)
      if (!buf) continue
      const t = (await extractTextFromBuffer(d.name, buf)).slice(0, PER_DOC)
      if (!t) continue
      chunks.push(`## Document: ${d.name}\n${t}`)
      scanned.push(d.name)
      total += t.length
    } catch { /* skip unreadable */ }
  }
  if (!chunks.length) return NextResponse.json({ error: "Could not read any of the selected documents" }, { status: 422 })

  const existing = await db.budgetItem.findMany({
    where: { projectId: params.projectId },
    select: { name: true },
  }).catch(() => [] as any[])

  const prompt = `You are a project cost analyst. Read the documents (proposals, contracts, quotes, plans) and extract BUDGET LINE ITEMS — planned costs the project will incur.

ALREADY IN THE BUDGET (do not repeat these or close variants): ${existing.map(r => r.name).join("; ") || "none"}

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"candidates":[{"description":"short line item name (max 90 chars)","category":"LABOR|MATERIALS|EQUIPMENT|SOFTWARE|CONSULTING|TRAVEL|CONTINGENCY|OTHER","plannedAmount":12345.67,"sourceDoc":"document name it came from","evidence":"the short phrase with the amount in the document (max 160 chars)"}]}

Rules: only include items with a real monetary amount stated or clearly derivable in the documents — never invent numbers. plannedAmount must be a plain number (no currency symbols, no thousands separators). 1-10 candidates. Write descriptions in the same language as the documents.

DOCUMENTS:
${chunks.join("\n\n")}`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
    if (!res.ok) {
      const e = await res.text().catch(() => "")
      return NextResponse.json({ error: `AI request failed (${res.status})${e ? ": " + e.slice(0, 200) : ""}` }, { status: 502 })
    }
    const data = await res.json()
    if (data.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "AI response was cut off — try fewer documents" }, { status: 502 })
    }
    const text = (data.content || []).map((c: any) => c.text || "").join("")
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates.slice(0, 12) : []
    return NextResponse.json({ data: { candidates, scannedDocs: scanned } })
  } catch {
    return NextResponse.json({ error: "Could not parse the AI response — try again" }, { status: 502 })
  }
}
