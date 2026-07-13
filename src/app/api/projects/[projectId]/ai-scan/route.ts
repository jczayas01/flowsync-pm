// POST /api/projects/:projectId/ai-scan — AI-extract register candidates from stored documents
// Body: { domain: "issues"|"changes"|"decisions"|"requirements"|"lessons", documentIds: string[] }
// FlowSync principle: documents flow into every register — the PM reviews, the platform synchronizes.
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

type DomainCfg = {
  existing: (projectId: string) => Promise<string[]>
  spec: string
  rules: string
}

const DOMAINS: Record<string, DomainCfg> = {
  issues: {
    existing: async (projectId) =>
      (await db.issue.findMany({ where: { projectId }, select: { title: true } }).catch(() => []))
        .map((r: any) => r.title),
    spec: `{"candidates":[{"title":"short issue title (max 120 chars)","description":"1-3 sentences — what is happening now","category":"one or two words e.g. Supplier, Technical, Resource, Schedule","priority":"CRITICAL|HIGH|MEDIUM|LOW","sourceDoc":"document name","evidence":"short phrase from the document (max 160 chars)"}]}`,
    rules: `An ISSUE is a problem happening NOW (vs a risk, which is a future uncertainty). Extract only current, active problems the documents describe.`,
  },
  changes: {
    existing: async (projectId) =>
      (await db.changeRequest.findMany({ where: { projectId }, select: { title: true } }).catch(() => []))
        .map((r: any) => r.title),
    spec: `{"candidates":[{"title":"short change request title (max 120 chars)","description":"what is being requested to change","justification":"why — the business reason stated","priority":"CRITICAL|HIGH|MEDIUM|LOW","sourceDoc":"document name","evidence":"short phrase from the document (max 160 chars)"}]}`,
    rules: `A CHANGE REQUEST is a requested modification to scope, schedule, budget, or deliverables — someone asking for something different than planned. Only extract explicit or clearly implied requests.`,
  },
  decisions: {
    existing: async (projectId) =>
      (await db.decision.findMany({ where: { projectId }, select: { title: true } }).catch(() => []))
        .map((r: any) => r.title),
    spec: `{"candidates":[{"title":"short decision title (max 120 chars)","description":"what was decided","rationale":"why it was decided — the reasoning stated","sourceDoc":"document name","evidence":"short phrase from the document (max 160 chars)"}]}`,
    rules: `A DECISION is a choice that was MADE and stated (agreed, approved, selected, decided). Do not extract open questions or pending choices.`,
  },
  requirements: {
    existing: async (projectId) =>
      (await db.requirement.findMany({ where: { projectId }, select: { title: true } }).catch(() => []))
        .map((r: any) => r.title),
    spec: `{"candidates":[{"title":"short requirement statement (max 150 chars)","description":"fuller description if the document gives one","type":"FUNCTIONAL|NON_FUNCTIONAL|BUSINESS|TECHNICAL|REGULATORY|OTHER","priority":"CRITICAL|HIGH|MEDIUM|LOW","acceptanceCriteria":"measurable criteria if stated, else empty string","sourceDoc":"document name","evidence":"short phrase from the document (max 160 chars)"}]}`,
    rules: `A REQUIREMENT is a capability, constraint, or condition the deliverable must satisfy ("must", "shall", "needs to", "required"). Write each as a single testable statement.`,
  },
  procurement: {
    existing: async (projectId) =>
      (await db.procurementItem.findMany({ where: { projectId }, select: { title: true, vendorName: true } }).catch(() => []))
        .map((r: any) => `${r.title} (${r.vendorName})`),
    spec: `{"candidates":[{"title":"short name of the agreement/document (max 150 chars)","vendorName":"the vendor/supplier/counterparty name","vendorContact":"contact person if stated, else null","type":"CONTRACT|PURCHASE_ORDER|SOW|MSA|NDA|OTHER","poNumber":"PO number if stated, else null","contractRef":"contract/reference number if stated, else null","value":12345.67,"currency":"USD or the stated currency code","startDate":"yyyy-mm-dd or null","endDate":"yyyy-mm-dd or null","deliverables":"short summary of deliverables/scope if stated, else null","sourceDoc":"document name","evidence":"short phrase with the key detail (max 160 chars)"}]}`,
    rules: `Extract PROCUREMENT records: purchase orders, contracts, invoices, statements of work, master agreements, NDAs — any commercial document binding the project to a vendor. Invoices map to type OTHER with the invoice number in poNumber. value must be a plain number when a monetary amount is stated, otherwise null — never invent amounts. Dates strictly yyyy-mm-dd or null.`,
  },
  lessons: {
    existing: async (projectId) =>
      (await db.lessonLearned.findMany({ where: { projectId }, select: { title: true } }).catch(() => []))
        .map((r: any) => r.title),
    spec: `{"candidates":[{"title":"short lesson title (max 120 chars)","category":"PLANNING|EXECUTION|STAKEHOLDER|RISK|COMMUNICATION|TEAM|TECHNICAL|PROCUREMENT|QUALITY|OTHER","situation":"what happened","lesson":"what was learned from it","recommendation":"what to do differently next time","impact":"POSITIVE|NEGATIVE","sourceDoc":"document name","evidence":"short phrase from the document (max 160 chars)"}]}`,
    rules: `A LESSON LEARNED is an experience worth repeating or avoiding — retrospective insight. Situation, lesson, and recommendation must each be a real sentence, not empty.`,
  },
}

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
  const domain: string = body?.domain
  const cfg = DOMAINS[domain]
  if (!cfg) return NextResponse.json({ error: "Unknown scan domain" }, { status: 400 })

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

  const existing = await cfg.existing(params.projectId)

  const prompt = `You are a project management analyst following industry-standard PM practices.

${cfg.rules}

ALREADY IN THE REGISTER (do not repeat these or close variants): ${existing.join("; ") || "none"}

Return ONLY valid JSON, no markdown fences, in this exact shape:
${cfg.spec}

Rules: 1-10 candidates total. Be specific to what the documents actually say — no generic boilerplate. Write in the same language as the documents. Evidence must be a real phrase from the text.

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
    const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates.slice(0, 12) : []
    return NextResponse.json({ data: { candidates, scannedDocs: scanned, skippedDocs: skipped } })
  } catch {
    return NextResponse.json({ error: "Could not parse the AI response — try again" }, { status: 502 })
  }
}
