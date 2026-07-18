// src/lib/automation/trigger.ts
// Drop-in trigger helper — call from any API route when events happen
// Examples:
//   await fireTrigger("task.status_changed", workspaceId, projectId, "task", taskId, userId, { from: "TODO", to: "DONE" })
//   await fireTrigger("project.health_changed", workspaceId, projectId, "project", projectId, userId, { to: "RED" })

import { SITE_URL } from "@/lib/site-url"
import type { TriggerType } from "./types"

export async function fireTrigger(
  type:        TriggerType,
  workspaceId: string,
  projectId:   string | undefined,
  entityType:  string,
  entityId:    string,
  triggeredBy: string | undefined,
  payload:     Record<string, unknown> = {}
): Promise<void> {
  // Fire-and-forget — don't block the caller
  const appUrl = SITE_URL

  fetch(`${appUrl}/api/automation/execute`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify({
      type, workspaceId, projectId,
      entityType, entityId, triggeredBy,
      payload, timestamp: new Date().toISOString(),
    }),
  }).catch(e => console.error("[Trigger]", e))
}

// Pre-built trigger helpers for common events
export const triggers = {
  taskStatusChanged: (ws: string, proj: string, taskId: string, by: string, from: string, to: string) =>
    fireTrigger("task.status_changed", ws, proj, "task", taskId, by, { from, to }),

  taskCompleted: (ws: string, proj: string, taskId: string, by: string) =>
    fireTrigger("task.completed", ws, proj, "task", taskId, by, {}),

  taskOverdue: (ws: string, proj: string, taskId: string) =>
    fireTrigger("task.overdue", ws, proj, "task", taskId, undefined, {}),

  projectHealthChanged: (ws: string, proj: string, by: string, from: string, to: string) =>
    fireTrigger("project.health_changed", ws, proj, "project", proj, by, { from, to }),

  projectBudgetThreshold: (ws: string, proj: string, pct: number) =>
    fireTrigger("project.budget_threshold", ws, proj, "project", proj, undefined, { threshold_pct: pct }),

  riskCreated: (ws: string, proj: string, riskId: string, by: string) =>
    fireTrigger("risk.created", ws, proj, "risk", riskId, by, {}),

  changeSubmitted: (ws: string, proj: string, changeId: string, by: string) =>
    fireTrigger("change.submitted", ws, proj, "change", changeId, by, {}),

  changeApproved: (ws: string, proj: string, changeId: string, by: string) =>
    fireTrigger("change.approved", ws, proj, "change", changeId, by, {}),

  milestoneApproaching: (ws: string, proj: string, msId: string, daysLeft: number) =>
    fireTrigger("project.milestone_approaching", ws, proj, "milestone", msId, undefined, { days_before: daysLeft }),

  milestoneMissed: (ws: string, proj: string, msId: string) =>
    fireTrigger("project.milestone_missed", ws, proj, "milestone", msId, undefined, {}),

  intakeSubmitted: (ws: string, reqId: string, by: string) =>
    fireTrigger("intake.submitted", ws, undefined, "intake", reqId, by, {}),
}
