// src/app/api/ai/route.ts
// POST /api/ai  — AI co-pilot: status reports, insights, suggestions

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  withWorkspace, ok, err, parseBody,
  verifyProjectAccess, ApiContext,
} from "@/lib/api"

// ── Azure OpenAI client ──
async function callAzureOpenAI(
  messages: { role: string; content: string }[],
  model: "gpt4o" | "mini" = "mini",
  jsonMode = false
): Promise<string> {
  const deployment = model === "gpt4o"
    ? process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O
    : process.env.AZURE_OPENAI_DEPLOYMENT_MINI

  const res = await fetch(
    `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "api-key":       process.env.AZURE_OPENAI_API_KEY!,
      },
      body: JSON.stringify({
        messages,
        max_tokens:      2000,
        temperature:     0.3,
        ...(jsonMode && { response_format: { type: "json_object" } }),
      }),
    }
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Azure OpenAI error: ${res.status} ${error}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

// ── Request schema ──
const aiSchema = z.discriminatedUnion("action", [
  z.object({
    action:    z.literal("generate_status_report"),
    projectId: z.string().min(1),
    periodStart: z.string(),
    periodEnd:   z.string(),
    health:    z.enum(["GREEN","AMBER","RED"]),
    notes:     z.string().optional(),
    format:    z.enum(["docx","pdf","pptx","text"]).default("text"),
  }),
  z.object({
    action:    z.literal("get_insights"),
    projectId: z.string().min(1),
  }),
  z.object({
    action:    z.literal("suggest_mitigation"),
    projectId: z.string().min(1),
    riskId:    z.string().min(1),
  }),
  z.object({
    action:    z.literal("draft_email"),
    projectId: z.string().min(1),
    context:   z.string(),
    recipient: z.string(),
    purpose:   z.string(),
  }),
])

// ── Gather project context for AI ──
async function getProjectContext(projectId: string, workspaceId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      phases:    { orderBy: { order: "asc" } },
      milestones:{ where: { status: { in: ["UPCOMING","AT_RISK"] } }, orderBy: { dueDate: "asc" }, take: 5 },
      risks:     { where: { status: "OPEN" }, orderBy: { score: "desc" }, take: 5 },
      members:   { include: { user: { select: { name: true } } }, take: 10 },
      budget:    true,
    },
  })

  if (!project) return null

  const overdueTasks = await db.task.count({
    where: { projectId, dueDate: { lt: new Date() }, status: { notIn: ["DONE","CANCELLED"] } },
  })

  const recentlyCompleted = await db.task.findMany({
    where:   { projectId, status: "DONE", completedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    select:  { title: true },
    take:    10,
  })

  const inProgress = await db.task.findMany({
    where:   { projectId, status: { in: ["IN_PROGRESS","IN_REVIEW"] } },
    select:  { title: true, dueDate: true, percentComplete: true },
    take:    10,
    orderBy: { dueDate: "asc" },
  })

  const budgetTotal = project.budget.reduce((s, b) => s + Number(b.plannedCost), 0)
  const budgetSpent = project.budget.reduce((s, b) => s + Number(b.actualCost), 0)

  return {
    name:             project.name,
    code:             project.code,
    methodology:      project.methodology,
    status:           project.status,
    health:           project.health,
    percentComplete:  project.percentComplete,
    startDate:        project.startDate,
    endDate:          project.endDate,
    budgetTotal,
    budgetSpent,
    phases:           project.phases.map(p => ({ name: p.name, status: p.status })),
    openRisks:        project.risks.map(r => ({ title: r.title, score: r.score, category: r.category })),
    upcomingMilestones: project.milestones.map(m => ({ name: m.name, dueDate: m.dueDate, status: m.status })),
    teamSize:         project.members.length,
    overdueTasks,
    recentlyCompleted: recentlyCompleted.map(t => t.title),
    inProgress:       inProgress.map(t => ({ title: t.title, pct: t.percentComplete, due: t.dueDate })),
  }
}

// ── Handlers ──

async function generateStatusReport(ctx: ApiContext, data: any) {
  const context = await getProjectContext(data.projectId, ctx.workspaceId)
  if (!context) return err("Project not found", 404)

  const systemPrompt = `You are a professional project manager assistant for FlowSync PM. 
Generate clear, concise, professional status reports. 
Use the project data provided. Be factual and specific. 
Format: executive-friendly, action-oriented language.`

  const userPrompt = `Generate a weekly status report for this project:

PROJECT: ${context.name} (${context.code})
PERIOD: ${data.periodStart} to ${data.periodEnd}
HEALTH: ${data.health}
OVERALL PROGRESS: ${context.percentComplete}%
METHODOLOGY: ${context.methodology}
BUDGET: $${context.budgetSpent.toLocaleString()} spent of $${context.budgetTotal.toLocaleString()} (${Math.round(context.budgetSpent/context.budgetTotal*100)}%)
TEAM SIZE: ${context.teamSize}
OVERDUE TASKS: ${context.overdueTasks}

ACTIVE PHASES:
${context.phases.filter(p => p.status === "IN_PROGRESS").map(p => `- ${p.name}`).join("\n")}

COMPLETED THIS WEEK:
${context.recentlyCompleted.map(t => `- ${t}`).join("\n") || "None"}

IN PROGRESS:
${context.inProgress.map(t => `- ${t.title} (${t.pct}% complete)`).join("\n")}

UPCOMING MILESTONES:
${context.upcomingMilestones.map(m => `- ${m.name}: ${new Date(m.dueDate).toDateString()}`).join("\n") || "None"}

OPEN RISKS (top):
${context.openRisks.map(r => `- ${r.title} (score: ${r.score}, category: ${r.category})`).join("\n") || "None"}

${data.notes ? `ADDITIONAL CONTEXT: ${data.notes}` : ""}

Generate a structured status report with these sections:
1. Project Health (one sentence)
2. Key Metrics (progress %, budget utilization, overdue tasks, open risks)
3. Accomplishments this period
4. Next steps / planned work
5. Issues & risks
6. Decisions needed (if any)

Be concise and professional. Use plain text, no markdown.`

  const report = await callAzureOpenAI([
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt },
  ], "gpt4o")

  // Save to database
  const saved = await db.statusUpdate.create({
    data: {
      projectId:       data.projectId,
      type:            "WEEKLY_STATUS",
      periodStart:     new Date(data.periodStart),
      periodEnd:       new Date(data.periodEnd),
      health:          data.health,
      summary:         report,
      budgetPlanned:   context.budgetTotal,
      budgetActual:    context.budgetSpent,
      percentComplete: context.percentComplete,
      aiGenerated:     true,
      aiPrompt:        userPrompt,
      createdById:     ctx.userId,
    },
  })

  return ok({ report, statusUpdateId: saved.id, projectContext: context })
}

async function getInsights(ctx: ApiContext, data: any) {
  const context = await getProjectContext(data.projectId, ctx.workspaceId)
  if (!context) return err("Project not found", 404)

  const prompt = `You are a project management AI assistant. Analyze this project and provide 3-5 actionable insights.

PROJECT DATA:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "insights": [
    {
      "type": "RISK|SCHEDULE|BUDGET|RESOURCE|ACTION",
      "severity": "HIGH|MEDIUM|LOW",
      "title": "short title",
      "description": "one sentence description",
      "suggestedAction": "specific action the PM should take",
      "relatedEntity": "task/risk/phase name if applicable"
    }
  ]
}`

  const raw = await callAzureOpenAI([
    { role: "user", content: prompt }
  ], "mini", true)

  const parsed = JSON.parse(raw)
  return ok(parsed)
}

async function suggestMitigation(ctx: ApiContext, data: any) {
  const risk = await db.risk.findUnique({ where: { id: data.riskId } })
  if (!risk) return err("Risk not found", 404)

  const prompt = `You are a project risk management expert.

RISK: ${risk.title}
DESCRIPTION: ${risk.description || "Not provided"}
CATEGORY: ${risk.category}
PROBABILITY: ${risk.probability}
IMPACT: ${risk.impact}
SCORE: ${risk.score}

Provide:
1. A concise mitigation plan (how to reduce the probability or impact)
2. A contingency plan (what to do if the risk triggers)

Return JSON: { "mitigationPlan": "...", "contingencyPlan": "..." }`

  const raw = await callAzureOpenAI([
    { role: "user", content: prompt }
  ], "mini", true)

  return ok(JSON.parse(raw))
}

async function draftEmail(ctx: ApiContext, data: any) {
  const context = await getProjectContext(data.projectId, ctx.workspaceId)
  if (!context) return err("Project not found", 404)

  const prompt = `Draft a professional email for a project manager.

PROJECT: ${context.name}
RECIPIENT: ${data.recipient}
PURPOSE: ${data.purpose}
CONTEXT: ${data.context}
PROJECT HEALTH: ${context.health} (${context.percentComplete}% complete)

Write a concise, professional email. Include subject line.
Format: Subject: [subject]\n\n[body]`

  const email = await callAzureOpenAI([
    { role: "user", content: prompt }
  ], "mini")

  const [subjectLine, ...bodyParts] = email.split("\n\n")
  const subject = subjectLine.replace("Subject:", "").trim()
  const body    = bodyParts.join("\n\n").trim()

  return ok({ subject, body, full: email })
}

// ── Main handler ──
async function handleAI(ctx: ApiContext) {
  if (process.env.ENABLE_AI_COPILOT !== "true") {
    return err("AI co-pilot is not enabled", 503)
  }

  const parsed = await parseBody(ctx.req, aiSchema)
  if ("error" in parsed) return parsed.error

  const { data } = parsed

  switch (data.action) {
    case "generate_status_report": return generateStatusReport(ctx, data)
    case "get_insights":           return getInsights(ctx, data)
    case "suggest_mitigation":     return suggestMitigation(ctx, data)
    case "draft_email":            return draftEmail(ctx, data)
    default:                       return err("Unknown action")
  }
}

export async function POST(req: NextRequest) {
  return withWorkspace(req, handleAI)
}
