// POST /api/projects/:projectId/budget/scan — AI-extract budget line-item candidates from stored documents
// Body: { documentIds: string[] } → { candidates: [...], scannedDocs: string[] }
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { getAiStyleDirective } from "@/lib/ai-style"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"
import { downloadBuffer } from "@/lib/storage"
import { extractTextFromBuffer } from "@/lib/extract"
import { aiGuard, AI_DISABLED_ERROR } from "@/lib/ai-guard"

const PER_DOC = 6000
const TOTAL   = 18000

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })
  if (!(await aiGuard(workspaceId, "budget-scan", session.user.id, params.projectId)))
    return NextResponse.json({ error: AI_DISABLED_ERROR }, { status: 403 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.locked) {
      return NextResponse.json(
        { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
        { status: 402 })
    }
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
  const skipped: { name: string; reason: string }[] = []
  const pdfBlocks: { name: string; data: string }[] = []
  let total = 0
  for (const d of docs) {
    if (total >= TOTAL) { skipped.push({ name: d.name, reason: "text budget reached — scan fewer documents" }); continue }
    try {
      const buf = await downloadBuffer(d.fileUrl)
      if (!buf) { skipped.push({ name: d.name, reason: "could not download from storage" }); continue }
      const t = (await extractTextFromBuffer(d.name, buf)).slice(0, PER_DOC)
      if (t.trim().length > 40) {
        chunks.push(`## Document: ${d.name}\n${t}`)
        scanned.push(d.name)
        total += t.length
      } else if (d.name.toLowerCase().endsWith(".pdf") && buf.length <= 3_500_000 && pdfBlocks.length < 2) {
        // No text layer — a scanned/image PDF. Send it to the AI as a visual document.
        pdfBlocks.push({ name: d.name, data: buf.toString("base64") })
        scanned.push(`${d.name} (read visually)`)
      } else {
        skipped.push({ name: d.name, reason: "no readable text (scanned/image file too large or unsupported)" })
      }
    } catch { skipped.push({ name: d.name, reason: "unreadable format" }) }
  }
  if (!chunks.length && !pdfBlocks.length) {
    const detail = skipped.map(s => `${s.name}: ${s.reason}`).join("; ")
    return NextResponse.json({ error: `Could not read the selected document(s) — ${detail || "no content"}` }, { status: 422 })
  }

  const existing = await db.budgetItem.findMany({
    where: { projectId: params.projectId },
    select: { name: true },
  }).catch(() => [] as any[])

  const styleDirective = await getAiStyleDirective(params.projectId)
  const prompt = `${styleDirective}You are a project cost analyst. Read the documents (proposals, contracts, quotes, plans) and extract BUDGET LINE ITEMS — planned costs the project will incur.

ALREADY IN THE BUDGET (do not repeat these or close variants): ${existing.map(r => r.name).join("; ") || "none"}

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"candidates":[{"description":"short line item name (max 90 chars)","category":"LABOR|MATERIALS|EQUIPMENT|SOFTWARE|CONSULTING|TRAVEL|CONTINGENCY|OTHER","plannedAmount":12345.67,"sourceDoc":"document name it came from","evidence":"the short phrase with the amount in the document (max 160 chars)"}]}

Rules: only include items with a real monetary amount stated or clearly derivable in the documents — never invent numbers. plannedAmount must be a plain number (no currency symbols, no thousands separators). 1-10 candidates. Write descriptions in the same language as the documents.
- Never emit discounts, credits, $0 rows, or informational lines.
- Emit every real cost item you find, including ones that look like they are already in the budget — the caller flags and unchecks those, and silently emitting nothing is indistinguishable from finding nothing.
- Do NOT break an umbrella line into its sub-components when the budget already carries the umbrella (for example a vendor contract total that is already a single line): emit the total, not the parts.

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
        messages: [{
          role: "user",
          content: [
            ...pdfBlocks.map(b => ({
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: b.data },
            })),
            { type: "text", text: (pdfBlocks.length ? `${pdfBlocks.length} document(s) are attached as PDFs — read them visually (tables included). Their names: ${pdfBlocks.map(b=>b.name).join(", ")}.\n\n` : "") + prompt },
          ],
        }],
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
    let candidates = (Array.isArray(parsed?.candidates) ? parsed.candidates.slice(0, 12) : [])
      // Hard floor: no zero/negative/discount rows regardless of what the model says.
      .filter((c: any) => Number(c?.plannedAmount) > 0)
      .filter((c: any) => !/\b(discount|descuento|credit|cr[eé]dito)\b/i.test(String(c?.description || "")))

    // Double-count guards, flagged for the client (default-unchecked there):
    //  - dupOf: candidate amount equals an existing line's planned amount (±1%), or
    //           strong name-token overlap with an existing line
    //  - sub-decomposition: candidates from one document summing to an existing
    //    line's planned amount (±10%) are details of that line, not new cost
    const norm = (x: string) => String(x || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "")
    const toks = (x: string) => new Set(norm(x).split(/\s+/).filter(w => w.length > 3))
    const overlap = (a: Set<string>, b: Set<string>) => {
      if (!a.size || !b.size) return 0
      let hit = 0; a.forEach(t => { if (b.has(t)) hit++ })
      return hit / Math.min(a.size, b.size)
    }
    const existingT = existing.map(e => ({ name: e.name, planned: Number(e.plannedCost || 0), t: toks(e.name) }))
    for (const c of candidates) {
      const ct = toks(c.description)
      const amt = Number(c.plannedAmount)
      const hit = existingT.find(e =>
        (e.planned > 0 && Math.abs(e.planned - amt) / e.planned < 0.01) || overlap(ct, e.t) >= 0.5)
      if (hit) c.dupOf = hit.name
    }
    const byDoc = new Map<string, any[]>()
    for (const c of candidates) {
      const k = String(c.sourceDoc || "")
      byDoc.set(k, [...(byDoc.get(k) || []), c])
    }
    byDoc.forEach(list => {
      const sum = list.reduce((s2, c) => s2 + Number(c.plannedAmount || 0), 0)
      const hit = existingT.find(e => e.planned > 0 && Math.abs(e.planned - sum) / e.planned < 0.10)
      if (hit) list.forEach(c => { if (!c.dupOf) c.dupOf = hit.name })
    })

    return NextResponse.json({ data: { candidates, scannedDocs: scanned, skippedDocs: skipped } })
  } catch {
    return NextResponse.json({ error: "Could not parse the AI response — try again" }, { status: 502 })
  }
}
