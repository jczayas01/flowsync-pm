// POST /api/projects/import/analyze — read an uploaded project plan and extract a full project structure
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { extractTextFromBuffer } from "@/lib/extract"

const MAX_FILE = 8 * 1024 * 1024 // 8 MB

const SPEC = `{
  "project": {
    "name": "project name (max 150 chars)",
    "objective": "the project objective/goal in 1-3 sentences, or null",
    "scope": "in-scope summary, or null",
    "methodology": "WATERFALL|AGILE|SCRUM|HYBRID — infer from vocabulary (sprints→SCRUM/AGILE, phase gates→WATERFALL, both→HYBRID); default WATERFALL",
    "startDate": "yyyy-mm-dd or null",
    "endDate": "yyyy-mm-dd or null",
    "budgetTotal": 12345.67,
    "currency": "3-letter code, default USD"
  },
  "phases": [{ "name": "phase name in delivery order" }],
  "tasks": [{
    "title": "task name (max 200 chars)",
    "phaseName": "must exactly match one of the phases above, or null",
    "startDate": "yyyy-mm-dd or null",
    "dueDate": "yyyy-mm-dd or null",
    "priority": "CRITICAL|HIGH|MEDIUM|LOW or null",
    "estimatedHours": "total effort in hours as a number, or null"
  }],
  "milestones": [{ "name": "milestone name", "dueDate": "yyyy-mm-dd (required — omit undated milestones)" }],
  "risks": [{
    "title": "risk statement (max 200 chars)",
    "probability": "VERY_LOW|LOW|MEDIUM|HIGH|VERY_HIGH",
    "impact": "NEGLIGIBLE|MINOR|MODERATE|MAJOR|CRITICAL",
    "description": "context/consequence, or null"
  }],
  "budget": [{
    "category": "LABOR|MATERIALS|EQUIPMENT|SOFTWARE|CONSULTING|TRAVEL|CONTINGENCY|OTHER",
    "name": "line item name",
    "plannedCost": 12345.67
  }]
}`

const RULES = `You are extracting a complete project structure from a project plan document.
Rules:
- Respond with ONLY valid JSON matching the spec exactly. No markdown fences, no commentary.
- Dates strictly yyyy-mm-dd. Infer the year from document context; if a date is relative or unclear, use null. Never invent dates.
- budgetTotal and plannedCost must be plain numbers actually stated in the document — never invent or estimate amounts. If no budget is stated, use null / empty array.
- estimatedHours: only if the document states an effort/hours/work estimate for the task (e.g. an 'Effort', 'Hours', or 'Work' column or 'Xh'/'X hours' text). It is the TOTAL effort for the task. Never invent or estimate hours — use null when not stated.
- phases: use the document's own phase/stage structure if present. If none, derive 3-6 logical phases from section headings. Every task's phaseName must exactly match a phase name or be null.
- Limits: phases ≤ 8, tasks ≤ 60, milestones ≤ 12, risks ≤ 15, budget ≤ 20. Prefer the most important items when trimming.
- Deduplicate: a milestone should not also appear as a task; a phase should not also appear as a task.
- FIDELITY: when the document contains an explicit phase list or schedule table, use EXACTLY those phases — never add, split, or rename phases beyond it. When the document contains a work-plan/task table, extract EXACTLY those rows as the tasks — do not additionally convert milestones, deliverables, assumptions, scope bullets, or budget lines into tasks.
- Keep original language of the document for names and titles.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") || (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })
  const member = await db.workspaceMember.findFirst({ where: { workspaceId, userId: session.user.id }, select: { id: true } })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (file.size > MAX_FILE) return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 })

  const buf = Buffer.from(await file.arrayBuffer())
  let text = ""
  try { text = (await extractTextFromBuffer(file.name, buf)).slice(0, 60000) } catch { /* fall through */ }

  const usableText = text.trim().length > 60
  const isPdf = file.name.toLowerCase().endsWith(".pdf")
  if (!usableText && !(isPdf && buf.length <= 3_500_000)) {
    return NextResponse.json({
      error: `Could not read "${file.name}" — no extractable text${isPdf ? " and the PDF is too large to read visually (max 3.5 MB)" : ""}. Supported: Word, PDF, Excel, text.`,
    }, { status: 422 })
  }

  const content: any[] = []
  if (!usableText && isPdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
    })
  }
  content.push({
    type: "text",
    text: `${RULES}\n\nJSON spec:\n${SPEC}\n\n${usableText
      ? `Document "${file.name}":\n\n${text}`
      : `The document "${file.name}" is attached as a PDF — read it visually, including tables.`}`,
  })

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content }],
      }),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => "")
      return NextResponse.json({ error: `AI service error (${aiRes.status})${t ? ": " + t.slice(0, 120) : ""}` }, { status: 502 })
    }
    const data = await aiRes.json()
    if (data?.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "The document produced too much content — try a shorter or more focused plan." }, { status: 422 })
    }
    const raw = (data?.content || []).map((c: any) => c?.text || "").join("\n")
    const clean = raw.replace(/```json|```/g, "").trim()
    let parsed: any
    try { parsed = JSON.parse(clean) } catch {
      return NextResponse.json({ error: "Could not parse the AI response — please try again." }, { status: 502 })
    }

    // Server-side sanitation & hard caps
    const iso = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null)
    const P_ENUM = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
    const I_ENUM = ["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"]
    const C_ENUM = ["LABOR", "MATERIALS", "EQUIPMENT", "SOFTWARE", "CONSULTING", "TRAVEL", "CONTINGENCY", "OTHER"]
    const PR_ENUM = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    const M_ENUM = ["WATERFALL", "AGILE", "SCRUM", "HYBRID"]

    const phases = (Array.isArray(parsed?.phases) ? parsed.phases : [])
      .map((p: any) => ({ name: String(p?.name || "").slice(0, 120).trim() }))
      .filter((p: any) => p.name).slice(0, 8)
    const phaseNames = new Set(phases.map((p: any) => p.name))

    const result = {
      project: {
        name: String(parsed?.project?.name || file.name.replace(/\.[^.]+$/, "")).slice(0, 150),
        objective: parsed?.project?.objective ? String(parsed.project.objective).slice(0, 3000) : null,
        scope: parsed?.project?.scope ? String(parsed.project.scope).slice(0, 3000) : null,
        methodology: M_ENUM.includes(parsed?.project?.methodology) ? parsed.project.methodology : "WATERFALL",
        startDate: iso(parsed?.project?.startDate),
        endDate: iso(parsed?.project?.endDate),
        budgetTotal: Number(parsed?.project?.budgetTotal) > 0 ? Number(parsed.project.budgetTotal) : null,
        currency: /^[A-Za-z]{3}$/.test(String(parsed?.project?.currency || "")) ? String(parsed.project.currency).toUpperCase() : "USD",
      },
      phases,
      tasks: (Array.isArray(parsed?.tasks) ? parsed.tasks : [])
        .map((t: any) => ({
          title: String(t?.title || "").slice(0, 200).trim(),
          phaseName: phaseNames.has(t?.phaseName) ? t.phaseName : null,
          startDate: iso(t?.startDate),
          dueDate: iso(t?.dueDate),
          priority: PR_ENUM.includes(t?.priority) ? t.priority : null,
          estimatedHours: Number(t?.estimatedHours) > 0 ? Math.round(Number(t.estimatedHours) * 100) / 100 : null,
        }))
        .filter((t: any) => t.title).slice(0, 60),
      milestones: (Array.isArray(parsed?.milestones) ? parsed.milestones : [])
        .map((m: any) => ({ name: String(m?.name || "").slice(0, 200).trim(), dueDate: iso(m?.dueDate) }))
        .filter((m: any) => m.name && m.dueDate).slice(0, 12),
      risks: (Array.isArray(parsed?.risks) ? parsed.risks : [])
        .map((r: any) => ({
          title: String(r?.title || "").slice(0, 200).trim(),
          probability: P_ENUM.includes(r?.probability) ? r.probability : "MEDIUM",
          impact: I_ENUM.includes(r?.impact) ? r.impact : "MODERATE",
          description: r?.description ? String(r.description).slice(0, 2000) : null,
        }))
        .filter((r: any) => r.title).slice(0, 15),
      budget: (Array.isArray(parsed?.budget) ? parsed.budget : [])
        .map((b: any) => ({
          category: C_ENUM.includes(b?.category) ? b.category : "OTHER",
          name: String(b?.name || "").slice(0, 200).trim(),
          plannedCost: Number(b?.plannedCost) > 0 ? Number(b.plannedCost) : 0,
        }))
        .filter((b: any) => b.name && b.plannedCost > 0).slice(0, 20),
      sourceFile: file.name,
    }

    return NextResponse.json({ data: result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Analysis failed" }, { status: 500 })
  }
}
