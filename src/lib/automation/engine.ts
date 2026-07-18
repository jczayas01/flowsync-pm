// src/lib/automation/engine.ts
// The automation rule engine — evaluates triggers, checks conditions,
// executes action chains, and logs results

import { SITE_URL } from "@/lib/site-url"
import { db } from "@/lib/db"
import type { AutomationRule, TriggerEvent, ExecutionResult, ExecutionLogEntry, Condition, Action } from "./types"

// ─────────────────────────────────────────────
// CONDITION EVALUATION
// ─────────────────────────────────────────────

function resolveValue(field: string, context: Record<string, unknown>): unknown {
  // Dot-notation field resolution: "task.priority" → context.task.priority
  return field.split(".").reduce((obj: any, key) => obj?.[key], context)
}

function evaluateCondition(condition: Condition, context: Record<string, unknown>): boolean {
  const actual = resolveValue(condition.field, context)
  const expected = condition.value

  switch (condition.operator) {
    case "equals":       return actual === expected
    case "not_equals":   return actual !== expected
    case "contains":     return typeof actual === "string" && actual.includes(String(expected))
    case "not_contains": return typeof actual === "string" && !actual.includes(String(expected))
    case "greater_than": return Number(actual) > Number(expected)
    case "less_than":    return Number(actual) < Number(expected)
    case "is_empty":     return actual === null || actual === undefined || actual === ""
    case "is_not_empty": return actual !== null && actual !== undefined && actual !== ""
    case "in":           return Array.isArray(expected) && expected.includes(actual as string)
    case "not_in":       return Array.isArray(expected) && !expected.includes(actual as string)
    default:             return false
  }
}

function evaluateConditions(conditions: Condition[], context: Record<string, unknown>): boolean {
  return conditions.every(c => evaluateCondition(c, context))
}

// ─────────────────────────────────────────────
// TEMPLATE INTERPOLATION
// Replaces {{variable}} placeholders in action params
// ─────────────────────────────────────────────

function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const val = resolveValue(path.trim(), context)
    if (val instanceof Date) return val.toLocaleDateString("en-US", { dateStyle: "medium", timeZone:"UTC" })
    return val !== undefined && val !== null ? String(val) : `{{${path}}}`
  })
}

function interpolateParams(
  params: Record<string, unknown>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string") {
      result[key] = interpolate(val, context)
    } else if (typeof val === "object" && val !== null) {
      result[key] = interpolateParams(val as Record<string, unknown>, context)
    } else {
      result[key] = val
    }
  }
  return result
}

// ─────────────────────────────────────────────
// ACTION EXECUTORS
// ─────────────────────────────────────────────

async function executeAction(
  action:  Action,
  context: Record<string, unknown>,
  log:     ExecutionLogEntry[]
): Promise<boolean> {
  const params  = interpolateParams(action.params, context)
  const ts      = new Date()

  try {
    switch (action.type) {

      case "notify.user":
      case "notify.role": {
        const message = params.message as string
        const channel = (params.channel as string) || "in_app"

        // Resolve target users
        let userIds: string[] = []

        if (action.type === "notify.role") {
          const projectId = context.projectId as string
          if (projectId) {
            const members = await db.projectMember.findMany({
              where: { projectId, role: { in: [params.role as string] } as any },
              select: { userId: true },
            })
            userIds = members.map(m => m.userId)
          }
        } else {
          const target = params.target as string
          if (target === "assignee") {
            const task = await db.task.findUnique({
              where: { id: context.entityId as string },
              select: { ownerId: true },
            })
            if (task?.ownerId) userIds = [task.ownerId]
          } else if (target === "risk.owner") {
            const risk = await db.risk.findUnique({
              where: { id: context.entityId as string },
              select: { ownerId: true },
            })
            if (risk?.ownerId) userIds = [risk.ownerId]
          }
        }

        // Create in-app notifications
        if (channel === "in_app" || channel === "both") {
          await db.notification.createMany({
            data: userIds.map(userId => ({
              userId,
              type:       "TASK_ASSIGNED" as any,
              title:      "Automation",
              body:       message,
            })),
            skipDuplicates: true,
          })
        }

        // Send emails
        if ((channel === "email" || channel === "both") && userIds.length) {
          const users = await db.user.findMany({
            where:  { id: { in: userIds } },
            select: { email: true, name: true },
          })
          const { Resend } = await import("resend")
          const resend = new Resend(process.env.RESEND_API_KEY)
          for (const user of users) {
            await resend.emails.send({
              from:    process.env.RESEND_FROM_EMAIL!,
              to:      user.email,
              subject: `FlowSync PM: ${message.slice(0, 60)}`,
              html:    `<div style="font-family:Inter,sans-serif;padding:20px;max-width:500px">
                <p>${message}</p>
                <a href="${SITE_URL}/dashboard" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#1B6CA8;color:#fff;border-radius:6px;text-decoration:none">View in FlowSync PM</a>
              </div>`,
            }).catch(() => {})
          }
        }

        log.push({ actionType: action.type, success: true, message: `Notified ${userIds.length} user(s)`, timestamp: ts })
        return true
      }

      case "notify.email": {
        const { Resend } = await import("resend")
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from:    process.env.RESEND_FROM_EMAIL!,
          to:      params.to as string,
          subject: params.subject as string,
          html:    `<div style="font-family:Inter,sans-serif;padding:20px">${params.body}</div>`,
        })
        log.push({ actionType: action.type, success: true, message: `Email sent to ${params.to}`, timestamp: ts })
        return true
      }

      case "project.set_health": {
        const projectId = context.projectId as string
        if (!projectId) return false
        await db.project.update({
          where: { id: projectId },
          data:  { health: params.health as any },
        })
        log.push({ actionType: action.type, success: true, message: `Project health set to ${params.health}`, timestamp: ts })
        return true
      }

      case "project.set_status": {
        const projectId = context.projectId as string
        if (!projectId) return false
        await db.project.update({
          where: { id: projectId },
          data:  { status: params.status as any },
        })
        log.push({ actionType: action.type, success: true, message: `Project status set to ${params.status}`, timestamp: ts })
        return true
      }

      case "task.set_status": {
        const taskId = context.entityId as string
        if (!taskId) return false
        await db.task.update({
          where: { id: taskId },
          data:  { status: params.status as any },
        })
        log.push({ actionType: action.type, success: true, message: `Task status set to ${params.status}`, timestamp: ts })
        return true
      }

      case "task.set_priority": {
        const taskId = context.entityId as string
        if (!taskId) return false
        await db.task.update({
          where: { id: taskId },
          data:  { priority: params.priority as any },
        })
        log.push({ actionType: action.type, success: true, message: `Task priority set to ${params.priority}`, timestamp: ts })
        return true
      }

      case "task.create": {
        const projectId = context.projectId as string
        if (!projectId) return false
        const lastTask = await db.task.findFirst({
          where:   { projectId },
          orderBy: { createdAt: "desc" },
          select:  { code: true },
        })
        const num  = lastTask ? parseInt(lastTask.code.replace("T-",""), 10) + 1 : 1
        const code = `T-${String(num).padStart(3,"0")}`
        await db.task.create({
          data: {
            projectId,
            code,
            title:       params.title as string,
            description: params.description as string || undefined,
            status:      "TODO",
            priority:    (params.priority as any) || "MEDIUM",
            ownerId:     context.triggeredBy as string || undefined,
          },
        })
        log.push({ actionType: action.type, success: true, message: `Created task: ${code} ${params.title}`, timestamp: ts })
        return true
      }

      case "task.add_comment": {
        const entityId = context.entityId as string
        if (!entityId) return false
        await db.comment.create({
          data: {
            content:    params.text as string,
            authorId:   context.triggeredBy as string || "system",
            taskId:     params.on === "task" ? entityId : undefined,
            aiGenerated: false,
          },
        }).catch(() => {})
        log.push({ actionType: action.type, success: true, message: "Comment added", timestamp: ts })
        return true
      }

      case "risk.escalate": {
        const projectId = context.projectId as string
        if (!projectId) return false
        const lastRisk = await db.risk.findFirst({
          where:   { projectId },
          orderBy: { createdAt: "desc" },
          select:  { code: true },
        })
        const num  = lastRisk ? parseInt(lastRisk.code.replace("RSK-",""), 10) + 1 : 1
        const code = `RSK-${String(num).padStart(3,"0")}`
        await db.risk.create({
          data: {
            projectId,
            code,
            title:       params.title as string,
            probability: (params.probability as any) || "MEDIUM",
            impact:      (params.impact as any) || "MODERATE",
            score:       12,
            status:      "OPEN",
          },
        })
        log.push({ actionType: action.type, success: true, message: `Risk escalated: ${code}`, timestamp: ts })
        return true
      }

      case "report.generate_status": {
        const projectId = context.projectId as string
        if (!projectId) return false
        const project = await db.project.findUnique({
          where: { id: projectId },
          select: { name: true, health: true, percentComplete: true, budgetTotal: true, budgetSpent: true },
        })
        if (!project) return false
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 86400000)
        await db.statusUpdate.create({
          data: {
            projectId,
            type:            "WEEKLY_STATUS",
            periodStart:     weekAgo,
            periodEnd:       now,
            health:          project.health,
            summary:         `Auto-generated status report for ${project.name}. Progress: ${project.percentComplete}%. Budget: $${project.budgetSpent}/$${project.budgetTotal}.`,
            percentComplete: project.percentComplete,
            budgetPlanned:   Number(project.budgetTotal),
            budgetActual:    Number(project.budgetSpent),
            aiGenerated:     false,
            createdById:     context.triggeredBy as string || "system",
          },
        })
        log.push({ actionType: action.type, success: true, message: "Status report generated", timestamp: ts })
        return true
      }

      case "webhook.call": {
        const url = params.url as string
        if (!url || url.includes("{{")) {
          log.push({ actionType: action.type, success: false, message: "Webhook URL not configured", timestamp: ts })
          return false
        }
        await fetch(url, {
          method:  (params.method as string) || "POST",
          headers: { "Content-Type": "application/json", "X-FlowSync-Webhook": "1" },
          body:    JSON.stringify(params.payload || context),
        }).catch(e => {
          throw new Error(`Webhook failed: ${e.message}`)
        })
        log.push({ actionType: action.type, success: true, message: `Webhook called: ${url.slice(0, 40)}...`, timestamp: ts })
        return true
      }

      case "flow.wait": {
        // In production: store deferred execution in a queue (Redis/BullMQ)
        // For now: log and continue (synchronous execution doesn't truly wait)
        const hours = Number(params.hours) || 1
        log.push({ actionType: action.type, success: true, message: `Wait ${hours}h (deferred in production)`, timestamp: ts })
        return true
      }

      case "flow.stop_if": {
        const cond  = params.condition as any
        const ctx   = await buildContext(context.entityType as string, context.entityId as string, context.projectId as string)
        const stop  = evaluateCondition(cond, { ...context, ...ctx })
        log.push({ actionType: action.type, success: true, message: `Stop condition ${stop ? "MET — stopping" : "not met — continuing"}`, timestamp: ts })
        return !stop  // return false to stop chain
      }

      default: {
        log.push({ actionType: action.type, success: false, message: `Action type not implemented: ${action.type}`, timestamp: ts })
        return true  // continue chain even if action unknown
      }
    }
  } catch (e: any) {
    log.push({ actionType: action.type, success: false, message: `Error: ${e.message}`, timestamp: ts })
    return true  // continue chain on non-fatal errors
  }
}

// ─────────────────────────────────────────────
// CONTEXT BUILDER
// Fetches entity data for interpolation
// ─────────────────────────────────────────────

async function buildContext(
  entityType: string,
  entityId:   string,
  projectId?: string
): Promise<Record<string, unknown>> {
  const ctx: Record<string, unknown> = { date: new Date().toLocaleDateString("en-US", { dateStyle: "long", timeZone:"UTC" }) }

  if (projectId) {
    const project = await db.project.findUnique({
      where:  { id: projectId },
      select: { name: true, code: true, health: true, status: true, percentComplete: true, budgetTotal: true, budgetSpent: true, endDate: true },
    })
    if (project) ctx.project = project
  }

  if (entityType === "task" && entityId) {
    const task = await db.task.findUnique({
      where:  { id: entityId },
      select: { code: true, title: true, status: true, priority: true, dueDate: true, percentComplete: true },
    })
    if (task) ctx.task = task
  }

  if (entityType === "risk" && entityId) {
    const risk = await db.risk.findUnique({
      where:  { id: entityId },
      select: { code: true, title: true, status: true, probability: true, impact: true, score: true },
    })
    if (risk) ctx.risk = risk
  }

  if (entityType === "change" && entityId) {
    const change = await db.changeRequest.findUnique({
      where:  { id: entityId },
      select: { code: true, title: true, status: true, budgetImpact: true, scheduleImpact: true, scopeImpact: true },
    })
    if (change) ctx.change = change
  }

  return ctx
}

// ─────────────────────────────────────────────
// MAIN ENGINE — process a trigger event
// ─────────────────────────────────────────────

export async function processTrigger(event: TriggerEvent): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = []

  // Find all active rules matching this trigger
  const rules = await db.$queryRaw<any[]>`
    SELECT * FROM automation_rules
    WHERE workspace_id = ${event.workspaceId}
      AND is_active = true
      AND (project_id IS NULL OR project_id = ${event.projectId || null})
      AND trigger_type = ${event.type}
    ORDER BY created_at ASC
  `.catch(() => [])

  for (const rawRule of rules) {
    const rule: AutomationRule = {
      ...rawRule,
      trigger:    rawRule.trigger_config    || { type: event.type, params: {} },
      conditions: rawRule.conditions        || [],
      actions:    rawRule.actions           || [],
    }

    const startTime = Date.now()
    const log: ExecutionLogEntry[] = []

    try {
      // Build execution context
      const entityCtx = await buildContext(event.entityType, event.entityId, event.projectId)
      const context = {
        ...event.payload,
        ...entityCtx,
        workspaceId:  event.workspaceId,
        projectId:    event.projectId,
        entityType:   event.entityType,
        entityId:     event.entityId,
        triggeredBy:  event.triggeredBy,
      }

      // Evaluate conditions
      if (!evaluateConditions(rule.conditions, context)) {
        results.push({ ruleId: rule.id, success: true, actionsRun: 0, skipped: true, log: [], duration: Date.now() - startTime })
        continue
      }

      // Execute actions in sequence
      let actionsRun = 0
      for (const action of rule.actions) {
        const shouldContinue = await executeAction(action, context, log)
        actionsRun++
        if (!shouldContinue) break  // flow.stop_if returned false
      }

      // Update rule stats
      await db.$executeRaw`
        UPDATE automation_rules
        SET run_count = run_count + 1, last_run_at = NOW(), last_error = NULL
        WHERE id = ${rule.id}
      `.catch(() => {})

      // Write execution log
      await db.$executeRaw`
        INSERT INTO automation_logs (rule_id, workspace_id, event_type, entity_id, success, actions_run, log_entries, duration_ms)
        VALUES (${rule.id}, ${event.workspaceId}, ${event.type}, ${event.entityId}, true, ${actionsRun}, ${JSON.stringify(log)}::jsonb, ${Date.now() - startTime})
      `.catch(() => {})

      results.push({ ruleId: rule.id, success: true, actionsRun, skipped: false, log, duration: Date.now() - startTime })

    } catch (e: any) {
      await db.$executeRaw`
        UPDATE automation_rules SET last_error = ${e.message} WHERE id = ${rule.id}
      `.catch(() => {})

      results.push({ ruleId: rule.id, success: false, actionsRun: 0, skipped: false, error: e.message, log, duration: Date.now() - startTime })
    }
  }

  return results
}
