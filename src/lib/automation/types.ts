// src/lib/automation/types.ts
// Complete type system for the FlowSync PM automation engine

// ─────────────────────────────────────────────
// TRIGGERS
// ─────────────────────────────────────────────

export type TriggerType =
  // Task events
  | "task.status_changed"
  | "task.created"
  | "task.assigned"
  | "task.unassigned"
  | "task.due_date_approaching"  // X days before due
  | "task.overdue"
  | "task.completed"
  | "task.priority_changed"
  | "task.progress_updated"      // % complete crosses threshold
  // Project events
  | "project.health_changed"
  | "project.status_changed"
  | "project.created"
  | "project.milestone_approaching"
  | "project.milestone_missed"
  | "project.budget_threshold"   // % of budget consumed
  | "project.phase_completed"
  | "project.phase_gate_pending"
  // Risk events
  | "risk.created"
  | "risk.score_changed"
  | "risk.status_changed"
  | "risk.review_date_approaching"
  // Change control
  | "change.submitted"
  | "change.approved"
  | "change.rejected"
  // Schedule
  | "schedule.daily"
  | "schedule.weekly"
  | "schedule.monthly"
  // Intake
  | "intake.submitted"
  | "intake.approved"
  | "intake.rejected"

// ─────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────

export type ConditionOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "greater_than" | "less_than"
  | "is_empty" | "is_not_empty"
  | "in" | "not_in"

export interface Condition {
  field:    string           // e.g. "task.priority", "project.health"
  operator: ConditionOperator
  value:    string | number | string[]
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────

export type ActionType =
  // Task actions
  | "task.set_status"
  | "task.set_priority"
  | "task.set_assignee"
  | "task.create"
  | "task.add_comment"
  | "task.set_due_date"        // relative: "+3 days"
  // Project actions
  | "project.set_health"
  | "project.set_status"
  | "project.add_member"
  | "workspace.member_added"
  // Notifications
  | "notify.user"              // specific user
  | "notify.role"              // all users with role X in project
  | "notify.email"             // email address (external)
  | "notify.slack"             // Slack webhook (Phase 2)
  // Reports
  | "report.generate_status"
  | "report.send_email"
  // AI actions
  | "ai.generate_summary"
  | "ai.flag_risk"
  // Integrations
  | "webhook.call"             // POST to external URL
  | "m365.create_planner_task"
  | "m365.send_teams_message"
  // Risk/Change
  | "risk.escalate"
  | "change.request_approval"
  // Flow control
  | "flow.wait"                // wait X hours before next action
  | "flow.stop_if"             // stop chain if condition met

export interface Action {
  type:   ActionType
  params: Record<string, unknown>
}

// ─────────────────────────────────────────────
// RULE DEFINITION
// ─────────────────────────────────────────────

export type RuleScope = "workspace" | "project" | "program"
export type RuleStatus = "active" | "paused" | "draft" | "error"

export interface AutomationRule {
  id:           string
  workspaceId:  string
  projectId?:   string        // null = workspace-wide
  name:         string
  description?: string
  isActive:     boolean
  scope:        RuleScope
  // Trigger
  trigger: {
    type:   TriggerType
    params: Record<string, unknown>  // e.g. { days_before: 3, status: "IN_PROGRESS" }
  }
  // Optional conditions (ALL must pass)
  conditions:   Condition[]
  // Actions (executed in order)
  actions:      Action[]
  // Metadata
  runCount:     number
  lastRunAt?:   Date
  lastError?:   string
  createdById:  string
  createdAt:    Date
  updatedAt:    Date
}

// ─────────────────────────────────────────────
// EXECUTION CONTEXT
// ─────────────────────────────────────────────

export interface TriggerEvent {
  type:        TriggerType
  workspaceId: string
  projectId?:  string
  entityType:  string          // "task" | "project" | "risk" | etc.
  entityId:    string
  triggeredBy?: string         // userId who caused the event
  payload:     Record<string, unknown>  // the changed data
  timestamp:   Date
}

export interface ExecutionResult {
  ruleId:     string
  success:    boolean
  actionsRun: number
  skipped:    boolean          // conditions not met
  error?:     string
  log:        ExecutionLogEntry[]
  duration:   number           // ms
}

export interface ExecutionLogEntry {
  actionType: ActionType
  success:    boolean
  message:    string
  timestamp:  Date
}

// ─────────────────────────────────────────────
// RECIPE TEMPLATES
// ─────────────────────────────────────────────

export interface RecipeTemplate {
  id:          string
  category:    string
  name:        string
  description: string
  icon:        string
  trigger:     AutomationRule["trigger"]
  conditions:  Condition[]
  actions:     Action[]
  popular:     boolean
  methodology?: "WATERFALL" | "AGILE" | "SCRUM" | "ALL"
}
