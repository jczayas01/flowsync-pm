// src/lib/automation/adapter.ts
// Bridges the REAL automation_rules table (Prisma shape: trigger/condition/
// action as simple strings, created by the Automations UI) to the engine's
// richer internal rule format (typed conditions[] and actions[]).
//
// Discovered 2026-07: the engine's raw SQL targeted a table shape
// (trigger_type, is_active, …) that never existed in production — every rule
// lookup failed and was swallowed by .catch(() => []). This adapter is the
// permanent fix: no schema change, no UI change, existing rules start firing.

import type { Action, Condition } from "./types"

// ── Event (dotted, fired in code) → rule trigger values (UPPER, stored) ──
export const EVENT_TO_RULE_TRIGGERS: Record<string, string[]> = {
  "task.created":                  ["TASK_CREATED"],
  "task.status_changed":           ["TASK_STATUS_CHANGED"],
  "task.completed":                ["TASK_STATUS_CHANGED", "TASK_COMPLETED"],
  "task.overdue":                  ["TASK_OVERDUE"],
  "task.due_date_approaching":     ["TASK_DUE_SOON"],
  "project.created":               ["PROJECT_CREATED"],
  "project.health_changed":        ["PROJECT_HEALTH_RED", "PROJECT_HEALTH_CHANGED"],
  "project.milestone_approaching": ["MILESTONE_DUE_SOON"],
  "project.budget_threshold":      ["BUDGET_THRESHOLD"],
  "risk.created":                  ["RISK_CREATED"],
  "risk.status_changed":           ["RISK_STATUS_CHANGED"],
  "project.completed":             ["PROJECT_COMPLETED"],
  "schedule.monthly":              ["SCHEDULE_MONTHLY"],
  "change.approved":               ["CHANGE_APPROVED"],
  "change.submitted":              ["CHANGE_SUBMITTED"],
  "schedule.weekly":               ["SCHEDULE_WEEKLY"],
  "project.add_member":            ["MEMBER_ADDED"],
  "workspace.member_added":        ["MEMBER_ADDED"],
}

export function ruleTriggersFor(eventType: string): string[] {
  return EVENT_TO_RULE_TRIGGERS[eventType] || [eventType]
}

/** Reverse lookup for the scheduled scans: does this workspace have an active
 *  rule for the given dotted event? */
export function eventMatchesRuleTrigger(eventType: string, ruleTrigger: string): boolean {
  return ruleTriggersFor(eventType).includes(ruleTrigger)
}

// ── Implicit conditions per stored trigger ──
function impliedConditions(ruleTrigger: string): Condition[] {
  if (ruleTrigger === "PROJECT_HEALTH_RED") {
    return [{ field: "to", operator: "equals", value: "RED" }]
  }
  return []
}

// ── Stored action string → engine action list ──
// Project-role notify targets use ProjectMember.role values.
const say = (msg: string) => msg
function actionsFor(actionKey: string, ruleTrigger: string): { actions: Action[]; unsupported?: string } {
  const M: Record<string, string> = {
    TASK_OVERDUE:        say("Task {{task.title}} in {{project.name}} is overdue."),
    TASK_DUE_SOON:       say("Task {{task.title}} in {{project.name}} is due in {{days_until}} days."),
    PROJECT_HEALTH_RED:  say("Project {{project.name}} has turned RED. Immediate review required."),
    PROJECT_HEALTH_CHANGED: say("Project {{project.name}} health changed to {{to}}."),
    MILESTONE_DUE_SOON:  say("Milestone approaching in {{project.name}} — {{days_until}} days out."),
    BUDGET_THRESHOLD:    say("Budget alert: {{project.name}} is at {{budget_pct}}% of budget."),
    RISK_CREATED:        say("New risk logged in {{project.name}}: {{risk.title}}."),
    PROJECT_CREATED:     say("New project created: {{project.name}}."),
    CHANGE_APPROVED:     say("A change request was approved in {{project.name}}."),
    CHANGE_SUBMITTED:    say("A change request was submitted in {{project.name}}."),
    SCHEDULE_WEEKLY:     say("Weekly check-in for {{project.name}} — review status and send your report."),
    TASK_STATUS_CHANGED: say("Task {{task.title}} changed status in {{project.name}}."),
    MEMBER_ADDED:        say("A new member joined the workspace."),
  }
  const message = M[ruleTrigger] || "Automation triggered."
  const roleNotify = (role: string, channel = "both"): Action[] =>
    [{ type: "notify.role", params: { role, message, channel } } as Action]

  switch (actionKey) {
    case "NOTIFY_PM":            return { actions: roleNotify("PM") }
    case "NOTIFY_PMO":           return { actions: roleNotify("PMO") }
    case "NOTIFY_SPONSOR":       return { actions: roleNotify("SPONSOR") }
    case "NOTIFY_STAKEHOLDERS":  return { actions: roleNotify("STAKEHOLDER") }
    case "SEND_EMAIL":           return { actions: roleNotify("PM", "email") }
    case "NOTIFY_TEAM":          return { actions: roleNotify("TEAM_MEMBER") }
    // Honest gaps: these need dedicated builders; skip visibly, never fake.
    case "UPDATE_TASK_STATUS":
    case "CREATE_TASKS":
    case "UPDATE_BASELINE":
    case "GENERATE_AI_REPORT":
      return { actions: [], unsupported: `${actionKey} is not automated yet — rule matched but action was skipped` }
    default:
      // Custom rules may store free text; fall back to notifying the PM with it.
      return { actions: [{ type: "notify.role",
        params: { role: "PM", message: actionKey.length > 60 ? message : `${message} (${actionKey})`, channel: "both" } } as Action] }
  }
}

export interface AdaptedRule {
  id: string
  name: string
  storedTrigger: string
  conditions: Condition[]
  actions: Action[]
  unsupported?: string
}

export function adaptRule(row: {
  id: string; name: string; trigger: string; condition: string | null; action: string
}): AdaptedRule {
  const conditions: Condition[] = [...impliedConditions(row.trigger)]
  // Freeform condition column: honor it when it parses as engine conditions.
  if (row.condition) {
    try {
      const parsed = JSON.parse(row.condition)
      if (Array.isArray(parsed)) conditions.push(...parsed)
      else if (parsed && typeof parsed === "object" && parsed.field) conditions.push(parsed)
    } catch { /* plain-text note — ignored for evaluation */ }
  }
  const { actions, unsupported } = actionsFor(row.action, row.trigger)
  return { id: row.id, name: row.name, storedTrigger: row.trigger, conditions, actions, unsupported }
}
