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
