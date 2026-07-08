// src/app/api/projects/[projectId]/ai/route.ts
// POST /api/projects/:id/ai  — AI co-pilot actions

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { AzureOpenAI } from 'openai'
import { prisma } from '@/lib/db/prisma'
import {
  withAuth, ok, err, handleApiError,
  requireProjectAccess, validate,
  type AuthContext
} from '@/lib/auth/middleware'
import { computeEVM } from '../route'

// ─────────────────────────────────────────────
// AZURE OPENAI CLIENT
// ─────────────────────────────────────────────

function getAIClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O!,
  })
}

function getMiniClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_MINI!,
  })
}

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const aiActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate_status_report'),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    health: z.enum(['GREEN', 'AMBER', 'RED']).default('GREEN'),
    additionalNotes: z.string().max(1000).optional(),
    format: z.enum(['text', 'docx', 'pdf', 'pptx']).default('text'),
  }),
  z.object({
    action: z.literal('analyze_risks'),
    context: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal('suggest_schedule_fix'),
    taskIds: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    action: z.literal('process_m365_event'),
    eventType: z.enum(['email', 'teams_meeting', 'planner_update']),
    eventData: z.object({
      subject: z.string().optional(),
      body: z.string().optional(),
      attendees: z.array(z.string()).optional(),
      date: z.string().optional(),
      duration: z.number().optional(), // minutes
    }),
  }),
  z.object({
    action: z.literal('chat'),
    message: z.string().max(2000),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional().default([]),
  }),
])

// ─────────────────────────────────────────────
// POST — AI actions
// ─────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const projectId = params?.projectId!
    await requireProjectAccess(projectId, ctx, 'VIEWER')

    const body = await req.json()
    const action = validate(body, aiActionSchema)

    switch (action.action) {

      case 'generate_status_report':
        return handleStatusReport(projectId, ctx, action)

      case 'analyze_risks':
        return handleRiskAnalysis(projectId, ctx, action)

      case 'suggest_schedule_fix':
        return handleScheduleFix(projectId, ctx, action)

      case 'process_m365_event':
        return handleM365Event(projectId, ctx, action)

      case 'chat':
        return handleChat(projectId, ctx, action)

      default:
        return err(400, 'INVALID_ACTION', 'Unknown AI action')
    }

  } catch (error) {
    return handleApiError(error)
  }
}, { requireAI: true })

// ─────────────────────────────────────────────
// ACTION: Generate Status Report
// ─────────────────────────────────────────────

async function handleStatusReport(
  projectId: string,
  ctx: AuthContext,
  action: any
) {
  const ai = getMiniClient() // use mini for cost efficiency

  // Gather project context
  const [project, tasks, risks, milestones, evm] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: { phases: true },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { title: true, status: true, percentComplete: true, dueDate: true, priority: true },
    }),
    prisma.risk.findMany({
      where: { projectId, status: 'OPEN' },
      select: { title: true, score: true, status: true },
      orderBy: { score: 'desc' },
      take: 5,
    }),
    prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: 'asc' },
    }),
    computeEVM(projectId),
  ])

  if (!project) return err(404, 'NOT_FOUND', 'Project not found')

  const overdueTasks = tasks.filter(
    t => t.dueDate && new Date(t.dueDate) < new Date() && !['DONE', 'CANCELLED'].includes(t.status)
  )
  const completedThisWeek = tasks.filter(t => t.status === 'DONE').length
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length

  const systemPrompt = `You are an expert Project Management co-pilot for FlowSync PM. 
Generate professional, concise weekly status reports for project managers.
Always write in a professional but clear tone. Be specific with numbers and dates.
Format your response as JSON with these exact keys:
{ "summary": "2-3 sentence executive summary", "accomplishments": "bullet list", "nextSteps": "bullet list", "risks": "brief risk summary", "issues": "any blockers or issues" }`

  const userPrompt = `Generate a weekly status report for:

PROJECT: ${project.name}
PERIOD: ${action.periodStart} to ${action.periodEnd}
OVERALL HEALTH: ${action.health}
PROGRESS: ${project.percentComplete}%
METHODOLOGY: ${project.methodology}

TASKS THIS PERIOD:
- Completed: ${completedThisWeek} tasks
- In progress: ${inProgress} tasks
- Overdue: ${overdueTasks.length} tasks (${overdueTasks.map(t => t.title).join(', ')})

BUDGET (EVM):
- Budget At Completion: $${evm?.bac?.toLocaleString() ?? 'N/A'}
- Actual Cost: $${evm?.ac?.toLocaleString() ?? 'N/A'}
- CPI: ${evm?.cpi ?? 'N/A'} ${evm?.cpi && evm.cpi < 1 ? '(over budget)' : '(on/under budget)'}
- SPI: ${evm?.spi ?? 'N/A'} ${evm?.spi && evm.spi < 1 ? '(behind schedule)' : '(on/ahead of schedule)'}

TOP OPEN RISKS:
${risks.map(r => `- ${r.title} (score: ${r.score})`).join('\n')}

UPCOMING MILESTONES:
${milestones.filter(m => m.status === 'UPCOMING').slice(0, 3).map(m => `- ${m.name}: ${m.dueDate}`).join('\n')}

ADDITIONAL NOTES: ${action.additionalNotes ?? 'None'}`

  const response = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI!,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1000,
  })

  const content = response.choices[0]?.message?.content
  let reportContent: any = {}
  try {
    reportContent = JSON.parse(content ?? '{}')
  } catch {
    reportContent = { summary: content }
  }

  // Save the report
  const report = await prisma.statusUpdate.create({
    data: {
      projectId,
      periodStart: new Date(action.periodStart),
      periodEnd: new Date(action.periodEnd),
      health: action.health,
      summary: reportContent.summary,
      accomplishments: reportContent.accomplishments,
      nextSteps: reportContent.nextSteps,
      risks: reportContent.risks,
      issues: reportContent.issues,
      budgetPlanned: evm?.bac,
      budgetActual: evm?.ac,
      percentComplete: project.percentComplete,
      forecastEnd: project.endDate,
      aiGenerated: true,
      aiPrompt: userPrompt,
      createdById: ctx.userId,
    },
  })

  return ok({ report, content: reportContent, tokensUsed: response.usage?.total_tokens })
}

// ─────────────────────────────────────────────
// ACTION: Analyze Risks
// ─────────────────────────────────────────────

async function handleRiskAnalysis(projectId: string, ctx: AuthContext, action: any) {
  const ai = getMiniClient()

  const [project, tasks, risks, budget] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, methodology: true, endDate: true, percentComplete: true } }),
    prisma.task.findMany({
      where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: new Date(Date.now() + 14 * 86400000) } },
      select: { title: true, status: true, dueDate: true, priority: true },
      take: 20,
    }),
    prisma.risk.findMany({ where: { projectId, status: 'OPEN' }, orderBy: { score: 'desc' } }),
    computeEVM(projectId),
  ])

  const response = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI!,
    messages: [
      {
        role: 'system',
        content: 'You are a risk analysis expert for project management. Identify risks and provide mitigation recommendations. Respond in JSON format.',
      },
      {
        role: 'user',
        content: `Analyze risks for project: ${project?.name}
Progress: ${project?.percentComplete}%
Due: ${project?.endDate}
CPI: ${budget?.cpi}, SPI: ${budget?.spi}

Tasks due in 2 weeks: ${JSON.stringify(tasks.slice(0, 10))}
Existing open risks: ${JSON.stringify(risks.slice(0, 5))}
${action.context ? `Additional context: ${action.context}` : ''}

Return JSON: { "newRisks": [{ "title", "category", "probability", "impact", "mitigation" }], "insights": "string", "urgentActions": ["action1", "action2"] }`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 800,
  })

  const result = JSON.parse(response.choices[0]?.message?.content ?? '{}')
  return ok(result)
}

// ─────────────────────────────────────────────
// ACTION: Process M365 Event (Outlook/Teams)
// ─────────────────────────────────────────────

async function handleM365Event(projectId: string, ctx: AuthContext, action: any) {
  const ai = getMiniClient()

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, methodology: true },
  })

  const tasks = await prisma.task.findMany({
    where: { projectId, status: { notIn: ['DONE', 'CANCELLED'] } },
    select: { id: true, code: true, title: true, status: true },
    take: 30,
  })

  // Ask AI what project updates this event implies
  const response = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI!,
    messages: [
      {
        role: 'system',
        content: `You are a project management assistant. Given a ${action.eventType} event, identify which project tasks should be updated and what the updates should be. Be conservative — only suggest clear, obvious updates.`,
      },
      {
        role: 'user',
        content: `Project: ${project?.name}
Event type: ${action.eventType}
Subject: ${action.eventData.subject ?? 'N/A'}
Content: ${action.eventData.body?.slice(0, 500) ?? 'N/A'}
Date: ${action.eventData.date ?? 'N/A'}
Duration: ${action.eventData.duration ?? 'N/A'} minutes

Current open tasks:
${tasks.map(t => `${t.code}: ${t.title} [${t.status}]`).join('\n')}

Return JSON: {
  "suggestedUpdates": [{ "taskId": "id", "taskCode": "T-XXX", "field": "status|percentComplete|notes", "currentValue": "...", "suggestedValue": "...", "reason": "..." }],
  "meetingMinutes": { "summary": "...", "decisions": ["..."], "actionItems": ["..."] } or null,
  "confidence": "high|medium|low",
  "prompt": "Human-readable prompt to show the user"
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2, // low temp for factual extraction
    max_tokens: 600,
  })

  const result = JSON.parse(response.choices[0]?.message?.content ?? '{}')
  return ok(result)
}

// ─────────────────────────────────────────────
// ACTION: Suggest Schedule Fix
// ─────────────────────────────────────────────

async function handleScheduleFix(projectId: string, ctx: AuthContext, action: any) {
  const ai = getMiniClient()

  const overdueTasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { notIn: ['DONE', 'CANCELLED'] },
      ...(action.taskIds?.length ? { id: { in: action.taskIds } } : { dueDate: { lt: new Date() } }),
    },
    include: {
      dependencies: { include: { precedingTask: { select: { title: true, status: true } } } },
      dependents: { select: { id: true, title: true, dueDate: true } },
    },
  })

  const response = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_MINI!,
    messages: [
      {
        role: 'system',
        content: 'You are a project scheduling expert. Suggest practical fixes for schedule slippage.',
      },
      {
        role: 'user',
        content: `Suggest schedule fixes for these overdue/at-risk tasks:
${JSON.stringify(overdueTasks.map(t => ({
  code: t.code, title: t.title, status: t.status,
  dueDate: t.dueDate, priority: t.priority,
  dependents: t.dependents.length,
})))}

Return JSON: { "suggestions": [{ "taskCode": "...", "issue": "...", "fix": "...", "impact": "..." }], "overallRecommendation": "..." }`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 600,
  })

  const result = JSON.parse(response.choices[0]?.message?.content ?? '{}')
  return ok(result)
}

// ─────────────────────────────────────────────
// ACTION: Chat (conversational co-pilot)
// ─────────────────────────────────────────────

async function handleChat(projectId: string, ctx: AuthContext, action: any) {
  const ai = getAIClient() // use GPT-4o for chat

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      phases: { select: { name: true, status: true } },
      _count: { select: { tasks: true, risks: true } },
    },
  })

  const evm = await computeEVM(projectId)

  const systemPrompt = `You are the AI co-pilot for FlowSync PM, helping project manager ${ctx.userId} manage the project "${project?.name}".

Project context:
- Methodology: ${project?.methodology}
- Progress: ${project?.percentComplete}%
- CPI: ${evm?.cpi ?? 'N/A'}, SPI: ${evm?.spi ?? 'N/A'}
- Phases: ${project?.phases.map(p => `${p.name} (${p.status})`).join(', ')}
- Tasks: ${project?._count.tasks}, Open risks: ${project?._count.risks}

Be concise, practical, and proactive. Suggest specific actions when relevant. You can help with:
- Status reports and summaries
- Risk identification and mitigation
- Schedule analysis and recommendations
- Budget and EVM interpretation
- Meeting minutes and action items
- Best practices for ${project?.methodology} methodology`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...action.conversationHistory.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: action.message },
  ]

  const response = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O!,
    messages,
    temperature: 0.5,
    max_tokens: 800,
    stream: false,
  })

  const reply = response.choices[0]?.message?.content ?? ''
  return ok({ reply, tokensUsed: response.usage?.total_tokens })
}
