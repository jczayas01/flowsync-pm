// src/lib/automation/dispatch.ts
// Central event dispatcher. Call dispatchEvent(...) after a domain mutation to run
// any matching automation rules and fire subscribed webhooks. Everything here is
// wrapped so a failing rule or webhook can NEVER break the caller's operation.
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/emails/templates"
import { createHmac } from "crypto"

// Automation rules use UPPER_SNAKE triggers; webhooks use dotted.lowercase events.
const EVENTS: Record<string, { automation: string; webhook: string }> = {
  PROJECT_CREATED:     { automation: "PROJECT_CREATED",     webhook: "project.created" },
  PROJECT_UPDATED:     { automation: "PROJECT_UPDATED",     webhook: "project.updated" },
  PROJECT_HEALTH_RED:  { automation: "PROJECT_HEALTH_RED",  webhook: "project.updated" },
  TASK_CREATED:        { automation: "TASK_CREATED",        webhook: "task.created" },
  TASK_STATUS_CHANGED: { automation: "TASK_STATUS_CHANGED", webhook: "task.status_changed" },
  RISK_CREATED:        { automation: "RISK_CREATED",        webhook: "risk.created" },
  MEMBER_ADDED:        { automation: "MEMBER_ADDED",        webhook: "member.invited" },
  CHANGE_APPROVED:     { automation: "CHANGE_APPROVED",     webhook: "change.approved" },
  MILESTONE_COMPLETED: { automation: "MILESTONE_COMPLETED", webhook: "milestone.completed" },
}

// Basic SSRF guard for server-side webhook delivery.
function isSafeUrl(u: string): boolean {
  try {
    const url = new URL(u)
    if (url.protocol !== "https:" && url.protocol !== "http:") return false
    const h = url.hostname.toLowerCase()
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(h)) return false
    if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
    if (h.endsWith(".internal") || h.endsWith(".local")) return false
    return true
  } catch { return false }
}

async function deliverWebhook(wh: any, webhookEvent: string, data: any) {
  if (!isSafeUrl(wh.url)) {
    await db.webhook.update({ where: { id: wh.id }, data: { errorCount: { increment: 1 } } }).catch(() => {})
    return
  }
  const payload = JSON.stringify({ event: webhookEvent, workspaceId: wh.workspaceId, timestamp: new Date().toISOString(), data })
  const signature = createHmac("sha256", wh.secret).update(payload).digest("hex")
  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FlowSync-Event": webhookEvent, "X-FlowSync-Signature": signature },
      body: payload, signal: AbortSignal.timeout(5000),
    })
    await db.webhook.update({
      where: { id: wh.id },
      data: { lastTriggeredAt: new Date(), ...(res.ok ? { successCount: { increment: 1 } } : { errorCount: { increment: 1 } }) },
    }).catch(() => {})
  } catch {
    await db.webhook.update({ where: { id: wh.id }, data: { errorCount: { increment: 1 } } }).catch(() => {})
  }
}

// Resolve who a NOTIFY_* action should reach.
async function recipients(action: string, ctx: any, workspaceId: string): Promise<string[]> {
  if (ctx.projectId) {
    let roles: string[]
    // Match the roles people actually assign, not just the literal "PM".
    if (action === "NOTIFY_PM") roles = ["PM", "PROGRAM_MANAGER", "PMO_DIRECTOR", "PMO"]
    else if (action === "NOTIFY_SPONSOR") roles = ["SPONSOR", "EXECUTIVE_SPONSOR", "STEERING_COMMITTEE"]
    else roles = ["SPONSOR", "EXECUTIVE_SPONSOR", "STAKEHOLDER", "STEERING_COMMITTEE", "PMO"]
    const members = await db.projectMember.findMany({
      where: { projectId: ctx.projectId, projectRole: { in: roles as any } }, select: { userId: true },
    })
    let ids = members.map(m => m.userId)
    if (ids.length === 0 && ctx.actorId) ids = [ctx.actorId]
    return Array.from(new Set(ids))
  }
  const admins = await db.workspaceMember.findMany({
    where: { workspaceId, role: { in: ["OWNER", "ADMIN"] as any } }, select: { userId: true },
  })
  return admins.map(a => a.userId)
}

async function runAction(rule: any, ctx: any): Promise<{ status: string; message: string }> {
  const ws = rule.workspaceId
  const action = rule.action
  try {
    if (["NOTIFY_PM", "NOTIFY_STAKEHOLDERS", "NOTIFY_SPONSOR", "SEND_EMAIL"].includes(action)) {
      const ids = await recipients(action === "SEND_EMAIL" ? "NOTIFY_PM" : action, ctx, ws)
      const wantsEmail = action === "SEND_EMAIL"
      const title = ctx.title || rule.name
      const link  = ctx.link || null
      let mailed = 0

      for (const uid of ids) {
        await db.notification.create({
          data: { workspaceId: ws, userId: uid, type: "automation",
            title, body: `Automation: ${rule.name}`, link, actorId: ctx.actorId || null },
        })
      }

      // Mail transport IS configured — send for real instead of pretending.
      if (wantsEmail && ids.length) {
        const people = await db.user.findMany({
          where: { id: { in: ids } }, select: { email: true, name: true },
        })
        const base = process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"
        const url  = link ? (link.startsWith("http") ? link : `${base}${link}`) : base
        for (const person of people) {
          if (!person.email) continue
          const ok = await sendEmail({
            to: person.email,
            subject: title,
            html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
              <p style="font-size:15px;color:#0F172A;margin:0 0 10px"><strong>${title}</strong></p>
              <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 18px">
                Triggered by the automation rule <strong>${rule.name}</strong> in FlowSync PM.
              </p>
              <p style="margin:0 0 22px">
                <a href="${url}" style="display:inline-block;background:#1B6CA8;color:#fff;
                  text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">
                  Open in FlowSync PM
                </a>
              </p>
              <p style="font-size:12px;color:#94A3B8;margin:0">
                You received this because you are on this project's team. Manage automation rules in Settings → Automation.
              </p>
            </div>`,
          }).catch(() => false)
          if (ok) mailed++
        }
      }

      return { status: "SUCCESS",
        message: wantsEmail
          ? `Notified ${ids.length} recipient(s) · emailed ${mailed}`
          : `Notified ${ids.length} recipient(s)` }
    }
    if (action === "CREATE_TASKS" && ctx.projectId) {
      const base = ["Kickoff meeting", "Define success criteria", "Set up communication plan"]
      let n = await db.task.count({ where: { projectId: ctx.projectId } })
      for (const t of base) {
        n++
        await db.task.create({ data: { projectId: ctx.projectId, code: `T-${String(n).padStart(3, "0")}`, title: t, status: "TODO" as any, priority: "MEDIUM" as any, percentComplete: 0, sortOrder: n } })
      }
      return { status: "SUCCESS", message: `Created ${base.length} kickoff tasks` }
    }
    // ── Advance the schedule: when a task completes, start whatever it was
    //    blocking (dependents whose predecessors are now all done). ──
    if (action === "UPDATE_TASK_STATUS" && ctx.projectId) {
      const taskId = ctx.entityId || ctx.taskId
      if (!taskId) return { status: "FAILED", message: "No task in context" }
      const links = await db.taskDependency.findMany({
        where: { precedingTaskId: taskId }, select: { dependentTaskId: true },
      })
      if (!links.length) return { status: "SUCCESS", message: "No dependent tasks to advance" }
      let started = 0
      for (const l of links) {
        const preds = await db.taskDependency.findMany({
          where: { dependentTaskId: l.dependentTaskId },
          select: { precedingTask: { select: { status: true } } },
        })
        const allDone = preds.every(p2 => p2.precedingTask?.status === "DONE")
        if (!allDone) continue
        const dep = await db.task.findUnique({
          where: { id: l.dependentTaskId }, select: { status: true },
        })
        if (dep && (dep.status === "TODO" || dep.status === "BACKLOG")) {
          await db.task.update({
            where: { id: l.dependentTaskId }, data: { status: "IN_PROGRESS" as any },
          })
          started++
        }
      }
      return { status: "SUCCESS", message: `Started ${started} unblocked task(s)` }
    }

    // ── Re-evaluate project health from real signals, not a fixed value ──
    if (action === "UPDATE_PROJECT_HEALTH" && ctx.projectId) {
      const pid = ctx.projectId
      const now = new Date()
      const [overdue, criticalRisks, project] = await Promise.all([
        db.task.count({ where: { projectId: pid, dueDate: { lt: now },
          status: { notIn: ["DONE", "CANCELLED"] as any } } }),
        db.risk.count({ where: { projectId: pid, status: "OPEN" as any,
          score: { gte: 15 } } }).catch(() => 0),
        db.project.findUnique({ where: { id: pid },
          select: { health: true, budgetTotal: true, budgetSpent: true } }),
      ])
      if (!project) return { status: "FAILED", message: "Project not found" }
      const bac = Number(project.budgetTotal || 0)
      const overBudget = bac > 0 && Number(project.budgetSpent || 0) > bac
      const health = (overdue >= 5 || criticalRisks >= 3 || overBudget) ? "RED"
                   : (overdue >= 1 || criticalRisks >= 1)               ? "AMBER"
                   : "GREEN"
      if (health === project.health) {
        return { status: "SUCCESS", message: `Health unchanged (${health})` }
      }
      await db.project.update({ where: { id: pid }, data: { health: health as any } })
      return { status: "SUCCESS",
        message: `Health ${project.health} → ${health} (${overdue} overdue, ${criticalRisks} critical risks${overBudget ? ", over budget" : ""})` }
    }

    // ── Re-baseline on approved change: snapshot the new plan of record and
    //    leave it awaiting sponsor approval. Never auto-approve a baseline. ──
    if (action === "UPDATE_BASELINE" && ctx.projectId) {
      const pid = ctx.projectId
      const project = await db.project.findUnique({
        where: { id: pid },
        select: { name: true, startDate: true, endDate: true, budgetTotal: true,
                  objective: true, scope: true, outOfScope: true },
      })
      if (!project) return { status: "FAILED", message: "Project not found" }
      const tasks = await db.task.findMany({
        where: { projectId: pid },
        select: { code: true, title: true, startDate: true, dueDate: true,
                  percentComplete: true, status: true, phaseId: true },
      })
      const n = await db.baseline.count({ where: { projectId: pid } })
      const author = ctx.actorId || (await db.projectMember.findFirst({
        where: { projectId: pid }, select: { userId: true } }))?.userId
      if (!author) return { status: "FAILED", message: "No user to attribute the baseline to" }
      await db.baseline.create({
        data: {
          projectId: pid,
          name: `Baseline v${n + 1} — after ${rule.name}`,
          description: "Created automatically when a change request was approved. Pending sponsor approval.",
          snapshotData: { tasks, capturedAt: new Date().toISOString() } as any,
          budgetTotal: project.budgetTotal ?? 0,
          startDate: project.startDate ?? new Date(),
          endDate:   project.endDate   ?? new Date(),
          createdById: author,
          isApproved: false,
          objectiveSnapshot:  project.objective  ?? null,
          scopeSnapshot:      project.scope      ?? null,
          outOfScopeSnapshot: project.outOfScope ?? null,
        },
      })
      return { status: "SUCCESS",
        message: `Baseline v${n + 1} captured (${tasks.length} tasks) — awaiting sponsor approval` }
    }

    // ── Status report into project history ──
    if (action === "GENERATE_AI_REPORT" && ctx.projectId) {
      const pid = ctx.projectId
      const project = await db.project.findUnique({
        where: { id: pid },
        select: { name: true, health: true, percentComplete: true,
                  budgetTotal: true, budgetSpent: true },
      })
      if (!project) return { status: "FAILED", message: "Project not found" }
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 86400000)
      const [done, open] = await Promise.all([
        db.task.count({ where: { projectId: pid, status: "DONE" as any,
          updatedAt: { gte: weekAgo } } }),
        db.task.count({ where: { projectId: pid,
          status: { notIn: ["DONE", "CANCELLED"] as any } } }),
      ])
      const author = ctx.actorId || (await db.projectMember.findFirst({
        where: { projectId: pid }, select: { userId: true } }))?.userId
      if (!author) return { status: "FAILED", message: "No user to attribute the report to" }
      await db.statusUpdate.create({
        data: {
          projectId: pid, type: "WEEKLY_STATUS" as any,
          periodStart: weekAgo, periodEnd: now,
          health: project.health,
          summary: `${project.name}: ${done} task(s) completed this period, ${open} still open. ` +
                   `Progress ${project.percentComplete}%. Spent $${Number(project.budgetSpent || 0).toLocaleString()} ` +
                   `of $${Number(project.budgetTotal || 0).toLocaleString()}. Generated by automation rule "${rule.name}".`,
          percentComplete: project.percentComplete,
          budgetPlanned: Number(project.budgetTotal || 0),
          budgetActual:  Number(project.budgetSpent || 0),
          aiGenerated: false,
          createdById: author,
        },
      })
      return { status: "SUCCESS", message: `Status update recorded (${done} completed, ${open} open)` }
    }

    // ── Audit trail entry ──
    if (action === "LOG_AUDIT_EVENT") {
      await db.auditLog.create({
        data: {
          workspaceId: ws,
          userId: ctx.actorId || null,
          action: "automation.logged",
          entityType: ctx.entityType || "project",
          entityId: ctx.entityId || ctx.projectId || ws,
          after: { rule: rule.name, trigger: rule.trigger, title: ctx.title || null } as any,
        },
      }).catch(() => {})
      return { status: "SUCCESS", message: `Audit entry written for "${rule.name}"` }
    }

    // An unimplemented action is a configuration problem, not a success.
    console.warn(`[Automation] rule "${rule.name}" uses action ${action}, which has no handler`)
    return { status: "FAILED", message: `Action "${action}" is not available yet — this rule does nothing. Pick a different action.` }
  } catch (e: any) {
    return { status: "FAILED", message: String(e?.message || e) }
  }
}

/**
 * Fire an event: run matching active automation rules and deliver to subscribed
 * webhooks. Safe to call fire-and-forget — it swallows all its own errors.
 * @param ctx  optional { projectId, actorId, title, link, data }
 */
export async function dispatchEvent(workspaceId: string, eventKey: string, ctx: any = {}) {
  try {
    const ev = EVENTS[eventKey]
    if (!ev) return

    const rules = await db.automationRule.findMany({ where: { workspaceId, trigger: ev.automation, isActive: true } })
    for (const rule of rules) {
      const result = await runAction(rule, ctx)
      await db.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }).catch(() => {})
      await db.automationLog.create({
        data: { workspaceId, ruleId: rule.id, ruleName: rule.name, trigger: ev.automation, action: rule.action, status: result.status, message: result.message },
      }).catch(() => {})
    }

    const webhooks = await db.webhook.findMany({ where: { workspaceId, isActive: true } })
    for (const wh of webhooks) {
      if ((wh.events || []).includes(ev.webhook)) await deliverWebhook(wh, ev.webhook, ctx.data || ctx)
    }
  } catch {
    /* dispatch must never break the caller */
  }
}
