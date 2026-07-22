// src/lib/automation/recipes.ts
// Built-in automation recipe library — 40+ ready-to-use templates

import type { RecipeTemplate } from "./types"

export const RECIPES: RecipeTemplate[] = [

  // ─── TASK MANAGEMENT ───────────────────────
  {
    id: "task-overdue-notify-pm",
    category: "Task management",
    name: "Notify PM when task is overdue",
    description: "When a task passes its due date without being completed, notify the project manager.",
    icon: "⏰",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "task.overdue", params: {} },
    conditions: [{ field: "task.status", operator: "not_in", value: ["DONE","CANCELLED"] }],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "Task {{task.title}} is overdue (due {{task.dueDate}}). Assigned to {{task.assignee}}.", channel: "both" } },
      { type: "project.set_health", params: { health: "AMBER", reason: "Overdue task: {{task.title}}" } },
    ],
  },
  {
    id: "task-due-soon-remind",
    category: "Task management",
    name: "Remind assignee 3 days before due date",
    description: "Send a reminder notification 3 days before a task is due.",
    icon: "🔔",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "task.due_date_approaching", params: { days_before: 3 } },
    conditions: [{ field: "task.status", operator: "not_in", value: ["DONE","CANCELLED","IN_REVIEW"] }],
    actions: [
      { type: "notify.user", params: { target: "assignee", message: "Reminder: {{task.title}} is due in 3 days ({{task.dueDate}}).", channel: "both" } },
    ],
  },
  {
    id: "task-due-soon-1day",
    category: "Task management",
    name: "Final reminder 1 day before due date",
    description: "Urgent reminder to assignee and PM the day before a task is due.",
    icon: "🚨",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "task.due_date_approaching", params: { days_before: 1 } },
    conditions: [{ field: "task.status", operator: "not_in", value: ["DONE","CANCELLED","IN_REVIEW"] }],
    actions: [
      { type: "notify.user",  params: { target: "assignee", message: "URGENT: {{task.title}} is due TOMORROW.", channel: "both" } },
      { type: "notify.role",  params: { role: "PROJECT_MANAGER", message: "Task {{task.title}} due tomorrow is still {{task.status}}.", channel: "in_app" } },
      { type: "task.set_priority", params: { priority: "HIGH" } },
    ],
  },
  {
    id: "task-completed-next",
    category: "Task management",
    name: "Notify next assignee when predecessor completes",
    description: "When a task is marked Done, notify the assignee of dependent tasks that they can start.",
    icon: "✅",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "task.completed", params: {} },
    conditions: [],
    actions: [
      { type: "notify.user", params: { target: "dependent_task_assignees", message: "{{task.title}} is complete. You can now start your dependent task.", channel: "both" } },
    ],
  },
  {
    id: "task-blocked-escalate",
    category: "Task management",
    name: "Escalate blocked tasks after 24 hours",
    description: "If a task stays in BLOCKED status for more than 24 hours, notify the PM.",
    icon: "🚫",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "task.status_changed", params: { to: "BLOCKED" } },
    conditions: [],
    actions: [
      { type: "flow.wait",   params: { hours: 24 } },
      { type: "flow.stop_if",params: { condition: { field: "task.status", operator: "not_equals", value: "BLOCKED" } } },
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "Task {{task.title}} has been BLOCKED for 24+ hours. Immediate attention needed.", channel: "both" } },
      { type: "task.set_priority", params: { priority: "CRITICAL" } },
    ],
  },
  {
    id: "task-high-priority-assign-pm",
    category: "Task management",
    name: "Alert PM when critical task is created",
    description: "When a task is created with Critical priority, immediately notify the PM.",
    icon: "🔴",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "task.created", params: {} },
    conditions: [{ field: "task.priority", operator: "equals", value: "CRITICAL" }],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "New CRITICAL task created: {{task.title}}", channel: "both" } },
    ],
  },

  // ─── PROJECT HEALTH ─────────────────────────
  {
    id: "project-health-red-escalate",
    category: "Project health",
    name: "Escalate to sponsor when project goes RED",
    description: "When project health turns RED, notify the sponsor and generate an AI status summary.",
    icon: "🔴",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "project.health_changed", params: { to: "RED" } },
    conditions: [],
    actions: [
      { type: "notify.role",          params: { role: "SUPER_USER", message: "Project {{project.name}} has turned RED. Immediate review required.", channel: "both" } },
      { type: "ai.generate_summary",  params: { includeRisks: true, includeOverdue: true } },
      { type: "report.send_email",    params: { to: "sponsor", subject: "⚠ Project Alert: {{project.name}} is at risk", includeAiSummary: true } },
    ],
  },
  {
    id: "project-health-amber-notify",
    category: "Project health",
    name: "Notify PM when project turns AMBER",
    description: "When project health changes to Amber (at risk), notify the project manager.",
    icon: "🟡",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "project.health_changed", params: { to: "AMBER" } },
    conditions: [],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "Project {{project.name}} is now AT RISK (Amber). Review required.", channel: "both" } },
    ],
  },
  {
    id: "project-budget-80",
    category: "Project health",
    name: "Alert when budget reaches 80%",
    description: "Notify PM and sponsor when project budget consumption reaches 80%.",
    icon: "💰",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "project.budget_threshold", params: { threshold_pct: 80 } },
    conditions: [{ field: "budget_pct", operator: "greater_than", value: 79 }],
    actions: [
      { type: "notify.role",  params: { role: "PROJECT_MANAGER", message: "Budget alert: {{project.name}} has consumed 80% of its budget (${{project.budgetSpent}} of ${{project.budgetTotal}}).", channel: "both" } },
      { type: "notify.role",  params: { role: "SUPER_USER",      message: "Budget alert: {{project.name}} at 80% (${{project.budgetSpent}} spent).", channel: "email" } },
    ],
  },
  {
    id: "project-budget-95",
    category: "Project health",
    name: "Critical alert when budget reaches 95%",
    description: "Urgent notification and health flag when budget is nearly exhausted.",
    icon: "💸",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "project.budget_threshold", params: { threshold_pct: 95 } },
    conditions: [{ field: "budget_pct", operator: "greater_than", value: 94 }],
    actions: [
      { type: "project.set_health", params: { health: "RED", reason: "Budget at 95%" } },
      { type: "notify.role",        params: { role: "PROJECT_MANAGER", message: "CRITICAL: {{project.name}} has consumed 95% of budget. Immediate action required.", channel: "both" } },
      { type: "notify.role",        params: { role: "SUPER_USER",      message: "CRITICAL: {{project.name}} budget at 95% (${{project.budgetSpent}} of ${{project.budgetTotal}}).", channel: "both" } },
      { type: "change.request_approval", params: { title: "Budget increase required — {{project.name}}", auto_create: true } },
    ],
  },

  // ─── MILESTONE & PHASE ──────────────────────
  {
    id: "milestone-approaching-7days",
    category: "Milestones & phases",
    name: "Notify team 7 days before milestone",
    description: "Remind the full project team of an upcoming milestone one week out.",
    icon: "🎯",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "project.milestone_approaching", params: { days_before: 7 } },
    conditions: [],
    actions: [
      { type: "notify.role", params: { role: "TEAM_MEMBER", message: "Milestone in 7 days: {{milestone.name}} ({{milestone.dueDate}}). Ensure all related tasks are on track.", channel: "in_app" } },
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "7-day milestone reminder: {{milestone.name}}", channel: "in_app" } },
    ],
  },
  {
    id: "milestone-missed",
    category: "Milestones & phases",
    name: "Escalate missed milestone",
    description: "When a milestone is missed, set project health to RED and notify sponsor.",
    icon: "❌",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "project.milestone_missed", params: {} },
    conditions: [],
    actions: [
      { type: "project.set_health", params: { health: "RED", reason: "Missed milestone: {{milestone.name}}" } },
      { type: "notify.role",        params: { role: "SUPER_USER", message: "Milestone MISSED: {{milestone.name}} was due {{milestone.dueDate}}.", channel: "both" } },
      { type: "notify.role",        params: { role: "PROJECT_MANAGER", message: "Milestone missed: {{milestone.name}}. Update project schedule.", channel: "both" } },
      { type: "risk.escalate",      params: { title: "Milestone missed: {{milestone.name}}", probability: "HIGH", impact: "MAJOR" } },
    ],
  },
  {
    id: "phase-gate-reminder",
    category: "Milestones & phases",
    name: "Remind PM of pending phase gate",
    description: "When a phase is complete but the gate hasn't been approved, remind the PM daily.",
    icon: "🚪",
    popular: false,
    methodology: "WATERFALL",
    trigger:    { type: "project.phase_gate_pending", params: {} },
    conditions: [],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "Phase gate pending approval: {{phase.name}}. All tasks complete — awaiting sign-off.", channel: "both" } },
    ],
  },
  {
    id: "phase-completed-celebrate",
    category: "Milestones & phases",
    name: "Celebrate phase completion",
    description: "Post a congratulations comment when a phase is completed.",
    icon: "🎉",
    popular: false,
    methodology: "WATERFALL",
    trigger:    { type: "project.phase_completed", params: {} },
    conditions: [],
    actions: [
      { type: "notify.role",    params: { role: "TEAM_MEMBER", message: "🎉 Phase complete: {{phase.name}}! Great work team.", channel: "in_app" } },
      { type: "task.add_comment", params: { on: "project", text: "✅ Phase {{phase.name}} completed on {{date}}." } },
    ],
  },

  // ─── RISK MANAGEMENT ────────────────────────
  {
    id: "risk-high-score-notify",
    category: "Risk management",
    name: "Escalate high-score risks",
    description: "When a risk score reaches 15 or above (HIGH), notify PM and sponsor.",
    icon: "⚠",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "risk.score_changed", params: {} },
    conditions: [{ field: "risk.score", operator: "greater_than", value: 14 }],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "HIGH RISK: {{risk.title}} (score {{risk.score}}). Mitigation required.", channel: "both" } },
      { type: "notify.role", params: { role: "SUPER_USER",      message: "High risk flagged: {{risk.title}} in {{project.name}} (score {{risk.score}}).", channel: "email" } },
      { type: "project.set_health", params: { health: "AMBER", reason: "High-score risk: {{risk.title}}" } },
    ],
  },
  {
    id: "risk-review-due",
    category: "Risk management",
    name: "Remind risk owner of review date",
    description: "Remind the risk owner 3 days before a risk review is due.",
    icon: "📋",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "risk.review_date_approaching", params: { days_before: 3 } },
    conditions: [{ field: "risk.status", operator: "not_equals", value: "CLOSED" }],
    actions: [
      { type: "notify.user", params: { target: "risk.owner", message: "Risk review due in 3 days: {{risk.title}}. Please update status and mitigation plan.", channel: "both" } },
    ],
  },
  {
    id: "risk-new-auto-log",
    category: "Risk management",
    name: "Auto-comment when risk is created",
    description: "Post a comment on the project when a new risk is logged.",
    icon: "📌",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "risk.created", params: {} },
    conditions: [],
    actions: [
      { type: "task.add_comment", params: { on: "project", text: "⚠ New risk logged: {{risk.title}} ({{risk.probability}} probability, {{risk.impact}} impact, score: {{risk.score}})." } },
    ],
  },

  // ─── CHANGE CONTROL ─────────────────────────
  {
    id: "change-submitted-notify",
    category: "Change control",
    name: "Notify PM when change request is submitted",
    description: "Immediately notify the PM when a change request is submitted for review.",
    icon: "↻",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "change.submitted", params: {} },
    conditions: [],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "New change request submitted: {{change.title}}. Budget impact: ${{change.budgetImpact}}. Schedule impact: {{change.scheduleImpact}}.", channel: "both" } },
    ],
  },
  {
    id: "change-approved-update",
    category: "Change control",
    name: "Update project when change is approved",
    description: "When a change request is approved, notify the team and add a comment.",
    icon: "✅",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "change.approved", params: {} },
    conditions: [],
    actions: [
      { type: "notify.role",      params: { role: "TEAM_MEMBER", message: "Change request approved: {{change.title}}. {{change.scopeImpact}}", channel: "in_app" } },
      { type: "task.add_comment", params: { on: "project", text: "✅ Change request approved: {{change.title}} — Budget impact: ${{change.budgetImpact}}, Schedule: {{change.scheduleImpact}}" } },
    ],
  },
  {
    id: "change-high-impact-escalate",
    category: "Change control",
    name: "Escalate high-budget change requests",
    description: "When a change request has a budget impact over $10,000, notify the sponsor before approval.",
    icon: "💰",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "change.submitted", params: {} },
    conditions: [{ field: "change.budgetImpact", operator: "greater_than", value: 10000 }],
    actions: [
      { type: "notify.role", params: { role: "SUPER_USER", message: "High-impact change request requires your approval: {{change.title}}. Budget impact: ${{change.budgetImpact}}.", channel: "both" } },
    ],
  },

  // ─── REPORTING ──────────────────────────────
  {
    id: "weekly-status-auto",
    category: "Reporting",
    name: "Auto-generate weekly status report every Monday",
    description: "Every Monday at 8am, generate an AI status report and email it to the sponsor.",
    icon: "📝",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "schedule.weekly", params: { day: "monday", time: "08:00" } },
    conditions: [{ field: "project.status", operator: "equals", value: "ACTIVE" }],
    actions: [
      { type: "report.generate_status", params: { type: "WEEKLY_STATUS", ai: true } },
      { type: "report.send_email",      params: { to: "sponsor", subject: "Weekly Status — {{project.name}} — {{date}}", includeReport: true } },
    ],
  },
  {
    id: "monthly-executive-report",
    category: "Reporting",
    name: "Monthly executive summary",
    description: "On the 1st of each month, generate and send an executive summary to all sponsors.",
    icon: "📊",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "schedule.monthly", params: { day: 1, time: "09:00" } },
    conditions: [],
    actions: [
      { type: "report.generate_status", params: { type: "EXECUTIVE_SUMMARY", ai: true } },
      { type: "report.send_email",      params: { to: "all_sponsors", subject: "Monthly Executive Summary — {{project.name}}", includeReport: true } },
    ],
  },

  // ─── SCRUM / AGILE ──────────────────────────
  {
    id: "sprint-planning-reminder",
    category: "Scrum",
    name: "Sprint planning reminder",
    description: "Every other Monday morning, remind the Scrum team to run sprint planning.",
    icon: "🏃",
    popular: true,
    methodology: "SCRUM",
    trigger:    { type: "schedule.weekly", params: { day: "monday", time: "08:00", every_n_weeks: 2 } },
    conditions: [{ field: "sprint.status", operator: "equals", value: "PLANNING" }],
    actions: [
      { type: "notify.role", params: { role: "TEAM_MEMBER", message: "Sprint planning today! Review the backlog and commit to this sprint's goal.", channel: "in_app" } },
    ],
  },
  {
    id: "sprint-review-remind",
    category: "Scrum",
    name: "Sprint review reminder",
    description: "One day before sprint end, remind the team to prepare the demo.",
    icon: "🎬",
    popular: false,
    methodology: "SCRUM",
    trigger:    { type: "schedule.daily", params: { time: "09:00" } },
    conditions: [{ field: "sprint.days_remaining", operator: "equals", value: 1 }],
    actions: [
      { type: "notify.role", params: { role: "TEAM_MEMBER", message: "Sprint ends tomorrow! Prepare your demo and update task status.", channel: "in_app" } },
    ],
  },
  {
    id: "backlog-unestimated",
    category: "Scrum",
    name: "Flag unestimated backlog items",
    description: "Every Friday, remind the Product Owner of backlog items without story point estimates.",
    icon: "📌",
    popular: false,
    methodology: "SCRUM",
    trigger:    { type: "schedule.weekly", params: { day: "friday", time: "14:00" } },
    conditions: [],
    actions: [
      { type: "notify.role", params: { role: "PROJECT_MANAGER", message: "{{count}} backlog items still have no story point estimates. Please groom the backlog.", channel: "in_app" } },
    ],
  },

  // ─── INTAKE & ONBOARDING ────────────────────
  {
    id: "intake-submitted-confirm",
    category: "Intake",
    name: "Confirm project request to submitter",
    description: "When a project request is submitted, send a confirmation email to the requestor.",
    icon: "📨",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "intake.submitted", params: {} },
    conditions: [],
    actions: [
      { type: "notify.email", params: { to: "{{request.requestorEmail}}", subject: "Request received: {{request.title}} — FlowSync PM", body: "Your project request has been received ({{request.requestNumber}}). Our PMO will review it within 5 business days." } },
    ],
  },
  {
    id: "intake-approved-create",
    category: "Intake",
    name: "Auto-create project when request is approved",
    description: "When a project request is fully approved, automatically create the project in the system.",
    icon: "🚀",
    popular: true,
    methodology: "ALL",
    trigger:    { type: "intake.approved", params: {} },
    conditions: [],
    actions: [
      { type: "notify.email", params: { to: "{{request.requestorEmail}}", subject: "Project approved: {{request.title}}", body: "Your project request has been approved! Your project {{request.requestNumber}} has been created. Your PM will be in touch shortly." } },
    ],
  },

  // ─── WEBHOOKS & INTEGRATIONS ────────────────
  {
    id: "webhook-on-health-red",
    category: "Integrations",
    name: "Call webhook when project goes RED",
    description: "POST to an external URL (Slack, Teams, Zapier) when project health turns red.",
    icon: "🔗",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "project.health_changed", params: { to: "RED" } },
    conditions: [],
    actions: [
      { type: "webhook.call", params: { url: "{{workspace.webhookUrl}}", method: "POST", payload: { project: "{{project.name}}", health: "RED", url: "{{project.url}}" } } },
    ],
  },
  {
    id: "m365-task-sync",
    category: "Integrations",
    name: "Create Planner task when FlowSync PM task is created",
    description: "Automatically mirror new FlowSync PM tasks to Microsoft Planner.",
    icon: "🔵",
    popular: false,
    methodology: "ALL",
    trigger:    { type: "task.created", params: {} },
    conditions: [{ field: "project.m365Enabled", operator: "equals", value: true as any }],
    actions: [
      { type: "m365.create_planner_task", params: { syncTitle: true, syncDueDate: true, syncAssignee: true } },
    ],
  },
]

export const RECIPE_CATEGORIES = [
  ...new Set(RECIPES.map(r => r.category))
]

export function getRecipesByCategory(category: string): RecipeTemplate[] {
  return RECIPES.filter(r => r.category === category)
}

export function getPopularRecipes(): RecipeTemplate[] {
  return RECIPES.filter(r => r.popular)
}

export function getRecipeById(id: string): RecipeTemplate | undefined {
  return RECIPES.find(r => r.id === id)
}
