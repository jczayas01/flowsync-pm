// src/app/api/projects/[projectId]/ai-analyze/route.ts
// POST — analyze pasted email/meeting text and suggest project placement
// POST — generate status report from project data

export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { getAiStyleDirective } from "@/lib/ai-style"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("analyze_content"),
    content: z.string().min(10).max(20000),
    contentType: z.enum(["email","teams_meeting","teams_chat","document","notes"]).default("email"),
  }),
  z.object({
    action: z.literal("generate_status_report"),
    periodStart: z.string(),
    periodEnd:   z.string(),
    health:      z.enum(["GREEN","YELLOW","RED","ON_HOLD"]).default("GREEN"),
    additionalNotes: z.string().max(1000).optional(),
  }),
])

import { createHash } from "crypto"
export function suggestionFingerprint(type: string, title: string) {
  const norm = `${(type||"").toLowerCase().trim()}|${(title||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}`
  return createHash("sha1").update(norm).digest("hex")
}

function buildAnalyzePrompt(content: string, contentType: string, project: any) {
  return `You are a PMO assistant for ${project.name} (${project.code}).

The user pasted the following ${contentType.replace("_"," ")}:

---
${content}
---

Project context:
- Name: ${project.name}
- Status: ${project.status}
- Health: ${project.health}
- % Complete: ${project.percentComplete}%

Analyze this content and extract structured information. Include at most the 8 most important suggestions, and keep every string value under 30 words.
If the content is a meeting transcript or meeting notes, include exactly ONE suggestion of type "meeting_minutes" (title = meeting name, description = 2-3 sentence discussion summary, meeting_date and attendees filled from the content) so the meeting itself is filed, in addition to any tasks/risks it produced. Respond ONLY with valid JSON matching this schema exactly:
{
  "summary": "2-3 sentence summary of what this content is about",
  "suggestions": [
    {
      "type": "task|risk|status_update|document|action_item|meeting_minutes",
      "title": "concise title",
      "description": "what should be created or recorded",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "suggested_assignee": "name if mentioned, else null",
      "suggested_due_date": "YYYY-MM-DD if mentioned, else null",
      "meeting_date": "YYYY-MM-DD (meeting_minutes only) if mentioned, else null",
      "attendees": ["names (meeting_minutes only)"] 
    }
  ],
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": ["action 1", "action 2"],
  "risks_identified": ["risk 1"],
  "sentiment": "positive|neutral|concerning",
  "recommended_health": "GREEN|YELLOW|RED|ON_HOLD"
}`
}

function buildReportPrompt(project: any, tasks: any[], risks: any[], milestones: any[], period: string, health: string, notes?: string) {
  const doneTasks = tasks.filter(t => t.status === "DONE")
  const inProgressTasks = tasks.filter(t => t.status === "IN_PROGRESS")
  const overdueTasks = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && !["DONE","CANCELLED"].includes(t.status)
  )
  const highRisks = risks.filter(r => r.score >= 12)

  return `You are a PMO analyst writing a professional status report for ${project.name}.

Project data:
- Period: ${period}
- Health: ${health}
- Overall progress: ${project.percentComplete}%
- Budget: $${Number(project.budgetTotal||0).toLocaleString()} total, $${Number(project.budgetSpent||0).toLocaleString()} spent
- Start: ${project.startDate ? new Date(project.startDate).toLocaleDateString() : "TBD"}
- End: ${project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD"}
- Tasks completed this period: ${doneTasks.length} of ${tasks.length} total
- Tasks in progress: ${inProgressTasks.length}
- Overdue tasks: ${overdueTasks.map(t => t.title).join(", ") || "None"}
- High risks: ${highRisks.map(r => r.title).join(", ") || "None"}
- Upcoming milestones: ${milestones.map(m => `${m.name} (${new Date(m.dueDate).toLocaleDateString()})`).join(", ") || "None"}
${notes ? `\nAdditional context from PM: ${notes}` : ""}

Write a professional PMO status report. Respond ONLY with valid JSON:
{
  "summary": "2-3 paragraph executive summary",
  "accomplishments": "bullet-point accomplishments this period (use newlines between items)",
  "next_steps": "bullet-point priorities for next period",
  "risks": "description of active risks and mitigations",
  "issues": "any blockers or escalation items, or null if none",
  "percent_complete": ${project.percentComplete}
}`
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

    if (access.locked) {
      return NextResponse.json(
        { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
        { status: 402 })
    }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 422 })
  }

  const project = await db.project.findUnique({
    where:  { id: params.projectId },
    select: { name:true, code:true, status:true, health:true, percentComplete:true,
               budgetTotal:true, budgetSpent:true, startDate:true, endDate:true },
  })
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  let prompt = ""

  if (parsed.data.action === "analyze_content") {
    prompt = buildAnalyzePrompt(parsed.data.content, parsed.data.contentType, project)
  } else {
    const [tasks, risks, milestones] = await Promise.all([
      db.task.findMany({ where: { projectId: params.projectId }, select: {
        title:true, status:true, dueDate:true, percentComplete:true
      }}),
      db.risk.findMany({ where: { projectId: params.projectId, status: { in: ["OPEN","TRIGGERED"] } },
        select: { title:true, score:true, probability:true, impact:true }}),
      db.milestone.findMany({ where: { projectId: params.projectId, status: { in: ["UPCOMING","AT_RISK"] } },
        select: { name:true, dueDate:true }}),
    ])
    const period = `${parsed.data.periodStart} to ${parsed.data.periodEnd}`
    prompt = buildReportPrompt(project, tasks, risks, milestones, period, parsed.data.health, parsed.data.additionalNotes)
  }

  // Call Anthropic API
  const styleDirective = await getAiStyleDirective(params.projectId)
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
        messages: [{ role: "user", content: styleDirective + prompt }],
      }),
    })

    if (!response.ok) {
      const e = await response.json().catch(() => ({}))
      return NextResponse.json({ error: "AI service error", details: e }, { status: 502 })
    }

    const data = await response.json()
    if (data.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "The analysis was too long and got cut off — try a shorter section of the document" },
        { status: 502 },
      )
    }
    const text = data.content?.map((b: any) => b.text || "").join("") || ""

    // Parse JSON from AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid format", raw: text }, { status: 502 })
    }

    const result = JSON.parse(jsonMatch[0])

    // Distribution ledger check: mark suggestions that were already applied
    // to this project (from this or any other document) so the UI can show
    // NEW vs. already-distributed and skip duplicates by default.
    if (parsed.data.action === "analyze_content" && Array.isArray(result.suggestions)) {
      for (const sg of result.suggestions) sg.fingerprint = suggestionFingerprint(sg.type, sg.title)
      const fps = result.suggestions.map((sg: any) => sg.fingerprint)
      const existing = fps.length ? await db.documentExtraction.findMany({
        where: { projectId: params.projectId, fingerprint: { in: fps } },
        select: { fingerprint: true, itemCode: true, itemType: true, sourceLabel: true },
      }) : []
      const byFp = new Map(existing.map(e => [e.fingerprint, e]))
      for (const sg of result.suggestions) {
        const hit = byFp.get(sg.fingerprint)
        sg.existing = hit ? { code: hit.itemCode, type: hit.itemType, source: hit.sourceLabel } : null
      }
    }

    return NextResponse.json({ data: result, action: parsed.data.action })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI request failed" }, { status: 500 })
  }
}
