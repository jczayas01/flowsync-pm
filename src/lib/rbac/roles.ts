// src/lib/rbac/roles.ts
// FlowSync PM — Role-Based Access Control
// Single source of truth for all roles, permissions, and access rules.
// Every API route, UI guard, and middleware reads from here.

// ─────────────────────────────────────────────
// ROLE DEFINITIONS
// ─────────────────────────────────────────────

export type SystemRole =
  | "SYSTEM_ADMIN"       // Level 1 — full platform access, reserved

export type WorkspaceRole =
  | "ADMIN"              // Level 2 — platform admin (colors, logos, users)
  | "SUPER_USER"         // Level 3 — sponsor, project approvals, visibility rules
  | "PMO_DIRECTOR"       // Level 3.5 — PMO oversight across all portfolios/programs/projects
  | "EXECUTIVE"          // Level 3.5 — C-level, read-only across the whole workspace
  | "PROGRAM_MANAGER"    // Level 4 — manages projects within assigned programs
  | "PROJECT_MANAGER"    // Level 5 — manages assigned projects
  | "TEAM_MEMBER"        // Level 6 — task access, notifications
  | "READ_ONLY"          // Level 7 — view only
  | "CLIENT"             // Level 8 — external, limited to assigned projects

export type AnyRole = SystemRole | WorkspaceRole

// Numeric hierarchy — higher = more access
export const ROLE_LEVEL: Record<AnyRole, number> = {
  SYSTEM_ADMIN:    100,
  ADMIN:           80,
  SUPER_USER:      70,
  PMO_DIRECTOR:    68,
  EXECUTIVE:       65,
  PROGRAM_MANAGER: 60,
  PROJECT_MANAGER: 50,
  TEAM_MEMBER:     30,
  READ_ONLY:       10,
  CLIENT:          5,
}

export const ROLE_LABELS: Record<AnyRole, string> = {
  SYSTEM_ADMIN:    "System Administrator",
  ADMIN:           "Platform Administrator",
  SUPER_USER:      "Super User / Sponsor",
  PMO_DIRECTOR:    "PMO Director",
  EXECUTIVE:       "Executive (C-Level)",
  PROGRAM_MANAGER: "Program Manager",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER:     "Team Member",
  READ_ONLY:       "Read-Only User",
  CLIENT:          "Client / External User",
}

export const ROLE_DESCRIPTIONS: Record<AnyRole, string> = {
  SYSTEM_ADMIN:    "Full system access. Reserved for primary administrator(s). Can assign this role to others.",
  ADMIN:           "Create and manage users. Assign roles. Configure workspace appearance (colors, logo).",
  SUPER_USER:      "Create/remove users. Approve project requests. View and edit all data. Define confidential project visibility.",
  PMO_DIRECTOR:    "Oversight of all portfolios, programs, and projects. Sets standards, reviews intake, monitors performance across the workspace. View all; edit governance.",
  EXECUTIVE:       "C-level read-only visibility across the entire workspace — strategic performance, investment, and benefits. No editing.",
  PROGRAM_MANAGER: "Manage projects within assigned programs. View and edit project information. Upload and download data.",
  PROJECT_MANAGER: "Manage assigned projects. View and edit project details. Upload and download related data.",
  TEAM_MEMBER:     "View assigned projects. Access and track assigned tasks. Receive notifications for due dates and updates.",
  READ_ONLY:       "View project and program information only. No editing, uploading, or downloading.",
  CLIENT:          "Limited access to specific assigned projects. View status and shared documents. Editing restricted per project settings.",
}

// ─────────────────────────────────────────────
// PERMISSION MATRIX
// Each permission maps to a boolean or function per role
// ─────────────────────────────────────────────

export type Permission =
  // ── System ──
  | "system:access"           // log in to the platform at all
  | "system:admin"            // full system-level access
  | "system:assign_admin"     // assign SYSTEM_ADMIN to others

  // ── Workspace settings ──
  | "workspace:view_settings"
  | "workspace:edit_branding"      // change colors, upload logo
  | "workspace:edit_settings"      // all other settings
  | "workspace:manage_integrations"// M365, Stripe, etc.
  | "workspace:view_audit_log"

  // ── User management ──
  | "users:view"
  | "users:invite"
  | "users:remove"
  | "users:assign_role"
  | "users:assign_admin_role"      // assign ADMIN or SUPER_USER
  | "users:assign_system_admin"    // assign SYSTEM_ADMIN (system admin only)

  // ── Project intake ──
  | "intake:submit"           // submit a project request
  | "intake:view_all"         // see all requests
  | "intake:review_pm"        // Level 1 PM review
  | "intake:approve_sponsor"  // Level 2 sponsor approval
  | "intake:convert"          // convert approved request → project

  // ── Projects ──
  | "projects:view_all"       // see all workspace projects
  | "projects:view_assigned"  // see only assigned projects
  | "projects:create"
  | "projects:edit"
  | "projects:delete"
  | "projects:archive"
  | "projects:set_confidential"    // mark project as confidential
  | "projects:view_confidential"   // see confidential projects
  | "projects:manage_members"      // add/remove project members
  | "projects:export"

  // ── Programs ──
  | "programs:view"
  | "programs:create"
  | "programs:edit"
  | "programs:manage_projects"

  // ── Tasks ──
  | "tasks:view_all"          // all tasks in project
  | "tasks:view_assigned"     // only their tasks
  | "tasks:create"
  | "tasks:edit_any"          // edit any task
  | "tasks:edit_assigned"     // edit only assigned tasks
  | "tasks:delete"
  | "tasks:assign"
  | "tasks:update_progress"   // update % complete on assigned tasks

  // ── Files & documents ──
  | "files:upload"
  | "files:download"
  | "files:download_sensitive" // financial docs, contracts
  | "files:delete"

  // ── Budget ──
  | "budget:view"
  | "budget:edit"
  | "budget:view_details"     // line items, EVM
  | "budget:export"

  // ── Risks & changes ──
  | "risks:view"
  | "risks:create"
  | "risks:edit"
  | "changes:view"
  | "changes:create"
  | "changes:approve"

  // ── Reports ──
  | "reports:view"
  | "reports:create"
  | "reports:export"
  | "reports:share_external"  // share with client users
  | "reports:manage_templates" // create/edit workspace report templates

  // ── Notifications ──
  | "notifications:receive_task"
  | "notifications:receive_project"
  | "notifications:receive_billing"

  // ── AI ──
  | "ai:use_copilot"
  | "ai:generate_reports"

  // ── M365 ──
  | "m365:connect"
  | "m365:sync"

const ALLOW: Record<Permission, boolean> = Object.fromEntries(
  [] as [Permission, boolean][]
) as any
const DENY = false, YES = true

// ─────────────────────────────────────────────
// PERMISSION TABLE
// permissions[role][permission] = true/false
// ─────────────────────────────────────────────

export const PERMISSIONS: Record<AnyRole, Partial<Record<Permission, boolean>>> = {

  // ────────────────────────────────────────
  // SYSTEM ADMIN — unrestricted
  // ────────────────────────────────────────
  SYSTEM_ADMIN: {
    "system:access":             YES,
    "system:admin":              YES,
    "system:assign_admin":       YES,
    "workspace:view_settings":   YES,
    "workspace:edit_branding":   YES,
    "workspace:edit_settings":   YES,
    "workspace:manage_integrations": YES,
    "workspace:view_audit_log":  YES,
    "users:view":                YES,
    "users:invite":              YES,
    "users:remove":              YES,
    "users:assign_role":         YES,
    "users:assign_admin_role":   YES,
    "users:assign_system_admin": YES,
    "intake:submit":             YES,
    "intake:view_all":           YES,
    "intake:review_pm":          YES,
    "intake:approve_sponsor":    YES,
    "intake:convert":            YES,
    "projects:view_all":         YES,
    "projects:view_assigned":    YES,
    "projects:create":           YES,
    "projects:edit":             YES,
    "projects:delete":           YES,
    "projects:archive":          YES,
    "projects:set_confidential": YES,
    "projects:view_confidential":YES,
    "projects:manage_members":   YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "programs:create":           YES,
    "programs:edit":             YES,
    "programs:manage_projects":  YES,
    "tasks:view_all":            YES,
    "tasks:view_assigned":       YES,
    "tasks:create":              YES,
    "tasks:edit_any":            YES,
    "tasks:edit_assigned":       YES,
    "tasks:delete":              YES,
    "tasks:assign":              YES,
    "tasks:update_progress":     YES,
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  YES,
    "files:delete":              YES,
    "budget:view":               YES,
    "budget:edit":               YES,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "risks:create":              YES,
    "risks:edit":                YES,
    "changes:view":              YES,
    "changes:create":            YES,
    "changes:approve":           YES,
    "reports:view":              YES,
    "reports:manage_templates": YES,
    "reports:create":            YES,
    "reports:export":            YES,
    "reports:share_external":    YES,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    "notifications:receive_billing": YES,
    "ai:use_copilot":            YES,
    "ai:generate_reports":       YES,
    "m365:connect":              YES,
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // ADMIN — workspace config, user management
  // ────────────────────────────────────────
  ADMIN: {
    "system:access":             YES,
    "system:admin":              DENY,  // cannot do system-level ops
    "system:assign_admin":       DENY,
    "workspace:view_settings":   YES,
    "workspace:edit_branding":   YES,   // colors, logo
    "workspace:edit_settings":   YES,
    "workspace:manage_integrations": YES,
    "workspace:view_audit_log":  YES,
    "users:view":                YES,
    "users:invite":              YES,
    "users:remove":              YES,
    "users:assign_role":         YES,
    "users:assign_admin_role":   YES,   // can assign ADMIN and below
    "users:assign_system_admin": DENY,  // cannot assign SYSTEM_ADMIN
    "intake:submit":             YES,
    "intake:view_all":           YES,
    "intake:review_pm":          YES,
    "intake:approve_sponsor":    DENY,  // sponsor approval is SUPER_USER only
    "intake:convert":            YES,
    "projects:view_all":         YES,
    "projects:view_assigned":    YES,
    "projects:create":           YES,
    "projects:edit":             YES,
    "projects:delete":           DENY,  // only SYSTEM_ADMIN deletes
    "projects:archive":          YES,
    "projects:set_confidential": YES,
    "projects:view_confidential":YES,
    "projects:manage_members":   YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "programs:create":           YES,
    "programs:edit":             YES,
    "programs:manage_projects":  YES,
    "tasks:view_all":            YES,
    "tasks:create":              YES,
    "tasks:edit_any":            YES,
    "tasks:delete":              YES,
    "tasks:assign":              YES,
    "tasks:update_progress":     YES,
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  YES,
    "files:delete":              YES,
    "budget:view":               YES,
    "budget:edit":               YES,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "risks:create":              YES,
    "risks:edit":                YES,
    "changes:view":              YES,
    "changes:create":            YES,
    "changes:approve":           YES,
    "reports:view":              YES,
    "reports:manage_templates": YES,
    "reports:create":            YES,
    "reports:export":            YES,
    "reports:share_external":    YES,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    "notifications:receive_billing": YES,
    "ai:use_copilot":            YES,
    "ai:generate_reports":       YES,
    "m365:connect":              YES,
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // SUPER_USER / SPONSOR
  // ────────────────────────────────────────
  SUPER_USER: {
    "system:access":             YES,
    "system:admin":              DENY,
    "system:assign_admin":       DENY,
    "workspace:view_settings":   YES,
    "workspace:edit_branding":   DENY,
    "workspace:edit_settings":   DENY,
    "workspace:manage_integrations": DENY,
    "workspace:view_audit_log":  YES,
    "users:view":                YES,
    "users:invite":              YES,
    "users:remove":              YES,
    "users:assign_role":         YES,
    "users:assign_admin_role":   DENY,  // cannot assign ADMIN and above
    "users:assign_system_admin": DENY,
    "intake:submit":             YES,
    "intake:view_all":           YES,
    "intake:review_pm":          YES,
    "intake:approve_sponsor":    YES,   // key sponsor power
    "intake:convert":            YES,
    "projects:view_all":         YES,
    "projects:view_assigned":    YES,
    "projects:create":           YES,
    "projects:edit":             YES,
    "projects:delete":           DENY,
    "projects:archive":          YES,
    "projects:set_confidential": YES,   // sponsor sets confidentiality
    "projects:view_confidential":YES,
    "projects:manage_members":   YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "programs:create":           YES,
    "programs:edit":             YES,
    "programs:manage_projects":  YES,
    "tasks:view_all":            YES,
    "tasks:create":              YES,
    "tasks:edit_any":            YES,
    "tasks:delete":              YES,
    "tasks:assign":              YES,
    "tasks:update_progress":     YES,
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  YES,
    "files:delete":              DENY,
    "budget:view":               YES,
    "budget:edit":               YES,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "risks:create":              YES,
    "risks:edit":                YES,
    "changes:view":              YES,
    "changes:create":            YES,
    "changes:approve":           YES,
    "reports:view":              YES,
    "reports:manage_templates": DENY,
    "reports:create":            YES,
    "reports:export":            YES,
    "reports:share_external":    YES,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    "notifications:receive_billing": DENY,
    "ai:use_copilot":            YES,
    "ai:generate_reports":       YES,
    "m365:connect":              YES,
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // PMO DIRECTOR — oversight across all portfolios/programs/projects
  // ────────────────────────────────────────
  PMO_DIRECTOR: {
    "system:access":             YES,
    "system:admin":              DENY,
    "system:assign_admin":       DENY,
    "workspace:view_settings":   YES,
    "workspace:edit_branding":   DENY,
    "workspace:edit_settings":   DENY,
    "workspace:manage_integrations": DENY,
    "workspace:view_audit_log":  YES,
    "users:view":                YES,
    "users:invite":              YES,
    "users:remove":              DENY,
    "users:assign_role":         YES,
    "users:assign_admin_role":   DENY,
    "users:assign_system_admin": DENY,
    "intake:submit":             YES,
    "intake:view_all":           YES,
    "intake:review_pm":          YES,
    "intake:approve_sponsor":    YES,
    "intake:convert":            YES,
    "projects:view_all":         YES,
    "projects:view_assigned":    YES,
    "projects:create":           YES,
    "projects:edit":             YES,
    "projects:delete":           DENY,
    "projects:archive":          YES,
    "projects:set_confidential": YES,
    "projects:view_confidential":YES,
    "projects:manage_members":   YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "programs:create":           YES,
    "programs:edit":             YES,
    "programs:manage_projects":  YES,
    "tasks:view_all":            YES,
    "tasks:create":              YES,
    "tasks:edit_any":            YES,
    "tasks:delete":              DENY,
    "tasks:assign":              YES,
    "tasks:update_progress":     YES,
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  YES,
    "files:delete":              DENY,
    "budget:view":               YES,
    "budget:edit":               DENY,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "risks:create":              YES,
    "risks:edit":                YES,
    "changes:view":              YES,
    "changes:create":            YES,
    "changes:approve":           YES,
    "reports:view":              YES,
    "reports:manage_templates": YES,
    "reports:create":            YES,
    "reports:export":            YES,
    "reports:share_external":    YES,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    "notifications:receive_billing": DENY,
    "ai:use_copilot":            YES,
    "ai:generate_reports":       YES,
    "m365:connect":              DENY,
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // EXECUTIVE — C-level, read-only across the whole workspace
  // ────────────────────────────────────────
  EXECUTIVE: {
    "system:access":             YES,
    "workspace:view_settings":   DENY,
    "workspace:view_audit_log":  DENY,
    "users:view":                YES,
    "intake:submit":             YES,
    "intake:view_all":           YES,
    "projects:view_all":         YES,
    "projects:view_assigned":    YES,
    "projects:view_confidential":YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "tasks:view_all":            YES,
    "files:download":            YES,
    "budget:view":               YES,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "changes:view":              YES,
    "reports:view":              YES,
    "reports:manage_templates": DENY,
    "reports:export":            YES,
    "notifications:receive_project": YES,
    "ai:generate_reports":       YES,
  },

  // ────────────────────────────────────────
  // PROGRAM MANAGER
  // ────────────────────────────────────────
  PROGRAM_MANAGER: {
    "system:access":             YES,
    "workspace:view_settings":   DENY,
    "workspace:view_audit_log":  DENY,
    "users:view":                YES,
    "users:invite":              YES,       // can invite team members
    "users:remove":              DENY,
    "users:assign_role":         DENY,
    "intake:submit":             YES,
    "intake:view_all":           YES,
    "intake:review_pm":          YES,
    "intake:approve_sponsor":    DENY,
    "intake:convert":            YES,
    "projects:view_all":         DENY,     // only assigned program projects
    "projects:view_assigned":    YES,
    "projects:create":           YES,
    "projects:edit":             YES,
    "projects:delete":           DENY,
    "projects:archive":          YES,
    "projects:set_confidential": DENY,
    "projects:view_confidential":DENY,
    "projects:manage_members":   YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "programs:create":           DENY,
    "programs:edit":             YES,      // edit assigned programs
    "programs:manage_projects":  YES,
    "tasks:view_all":            YES,
    "tasks:create":              YES,
    "tasks:edit_any":            YES,
    "tasks:delete":              DENY,
    "tasks:assign":              YES,
    "tasks:update_progress":     YES,
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  DENY,
    "files:delete":              DENY,
    "budget:view":               YES,
    "budget:edit":               YES,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "risks:create":              YES,
    "risks:edit":                YES,
    "changes:view":              YES,
    "changes:create":            YES,
    "changes:approve":           DENY,
    "reports:view":              YES,
    "reports:manage_templates": DENY,
    "reports:create":            YES,
    "reports:export":            YES,
    "reports:share_external":    DENY,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    "notifications:receive_billing": DENY,
    "ai:use_copilot":            YES,
    "ai:generate_reports":       YES,
    "m365:connect":              YES,
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // PROJECT MANAGER
  // ────────────────────────────────────────
  PROJECT_MANAGER: {
    "system:access":             YES,
    "workspace:view_settings":   DENY,
    "workspace:view_audit_log":  DENY,
    "users:view":                YES,
    "users:invite":              YES,       // invite team members
    "users:remove":              DENY,
    "users:assign_role":         DENY,
    "intake:submit":             YES,
    "intake:view_all":           DENY,
    "intake:review_pm":          YES,       // PM-level intake review
    "intake:approve_sponsor":    DENY,
    "intake:convert":            DENY,
    "projects:view_all":         DENY,
    "projects:view_assigned":    YES,
    "projects:create":           YES,
    "projects:edit":             YES,
    "projects:delete":           DENY,
    "projects:archive":          YES,
    "projects:set_confidential": DENY,
    "projects:view_confidential":DENY,
    "projects:manage_members":   YES,
    "projects:export":           YES,
    "programs:view":             YES,
    "programs:create":           DENY,
    "programs:edit":             DENY,
    "programs:manage_projects":  DENY,
    "tasks:view_all":            YES,
    "tasks:create":              YES,
    "tasks:edit_any":            YES,
    "tasks:delete":              YES,
    "tasks:assign":              YES,
    "tasks:update_progress":     YES,
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  DENY,
    "files:delete":              DENY,
    "budget:view":               YES,
    "budget:edit":               YES,
    "budget:view_details":       YES,
    "budget:export":             YES,
    "risks:view":                YES,
    "risks:create":              YES,
    "risks:edit":                YES,
    "changes:view":              YES,
    "changes:create":            YES,
    "changes:approve":           DENY,
    "reports:view":              YES,
    "reports:manage_templates": DENY,
    "reports:create":            YES,
    "reports:export":            YES,
    "reports:share_external":    DENY,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    "notifications:receive_billing": DENY,
    "ai:use_copilot":            YES,
    "ai:generate_reports":       YES,
    "m365:connect":              YES,
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // TEAM MEMBER
  // ────────────────────────────────────────
  TEAM_MEMBER: {
    "system:access":             YES,
    "workspace:view_settings":   DENY,
    "workspace:view_audit_log":  DENY,
    "users:view":                DENY,
    "users:invite":              DENY,
    "users:remove":              DENY,
    "users:assign_role":         DENY,
    "intake:submit":             YES,        // anyone can submit a request
    "intake:view_all":           DENY,
    "intake:review_pm":          DENY,
    "intake:approve_sponsor":    DENY,
    "intake:convert":            DENY,
    "projects:view_all":         DENY,
    "projects:view_assigned":    YES,
    "projects:create":           DENY,
    "projects:edit":             DENY,
    "projects:delete":           DENY,
    "projects:archive":          DENY,
    "projects:set_confidential": DENY,
    "projects:view_confidential":DENY,
    "projects:manage_members":   DENY,
    "projects:export":           DENY,
    "programs:view":             YES,
    "programs:create":           DENY,
    "programs:edit":             DENY,
    "programs:manage_projects":  DENY,
    "tasks:view_all":            DENY,
    "tasks:view_assigned":       YES,        // only their tasks
    "tasks:create":              DENY,
    "tasks:edit_any":            DENY,
    "tasks:edit_assigned":       YES,        // can update their own tasks
    "tasks:delete":              DENY,
    "tasks:assign":              DENY,
    "tasks:update_progress":     YES,        // key: can update % complete
    "files:upload":              YES,
    "files:download":            YES,
    "files:download_sensitive":  DENY,
    "files:delete":              DENY,
    "budget:view":               DENY,       // team members don't see budget
    "budget:edit":               DENY,
    "budget:view_details":       DENY,
    "budget:export":             DENY,
    "risks:view":                YES,        // can see risks affecting their work
    "risks:create":              YES,        // can flag a risk
    "risks:edit":                DENY,
    "changes:view":              YES,
    "changes:create":            DENY,
    "changes:approve":           DENY,
    "reports:view":              YES,        // can see status reports
    "reports:manage_templates": DENY,
    "reports:create":            DENY,
    "reports:export":            DENY,
    "reports:share_external":    DENY,
    "notifications:receive_task":YES,        // key: task due dates + updates
    "notifications:receive_project": YES,
    "notifications:receive_billing": DENY,
    "ai:use_copilot":            DENY,
    "ai:generate_reports":       DENY,
    "m365:connect":              YES,        // connect their own M365
    "m365:sync":                 YES,
  },

  // ────────────────────────────────────────
  // READ ONLY
  // ────────────────────────────────────────
  READ_ONLY: {
    "system:access":             YES,
    "projects:view_all":         DENY,
    "projects:view_assigned":    YES,
    "tasks:view_all":            DENY,
    "tasks:view_assigned":       YES,
    "files:upload":              DENY,
    "files:download":            YES,        // can download non-sensitive
    "files:download_sensitive":  DENY,
    "budget:view":               YES,
    "budget:view_details":       DENY,       // can see totals but not line items
    "risks:view":                YES,
    "changes:view":              YES,
    "reports:view":              YES,
    "reports:manage_templates": DENY,
    "programs:view":             YES,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    // Everything else: DENY (omitted = DENY by default)
  },

  // ────────────────────────────────────────
  // CLIENT / EXTERNAL
  // ────────────────────────────────────────
  CLIENT: {
    "system:access":             YES,
    "projects:view_assigned":    YES,        // ONLY projects they're explicitly added to
    "projects:view_all":         DENY,
    "tasks:view_assigned":       YES,
    "tasks:update_progress":     DENY,       // unless project PM enables it
    "files:download":            YES,        // shared docs only
    "files:download_sensitive":  DENY,
    "files:upload":              DENY,       // unless project PM enables it
    "budget:view":               DENY,       // clients don't see financials
    "risks:view":                DENY,
    "changes:view":              DENY,
    "reports:view":              YES,        // shared status reports only
    "reports:manage_templates": DENY,
    "reports:export":            DENY,
    "notifications:receive_task":YES,
    "notifications:receive_project": YES,
    // Everything else: DENY
  },
}

// ─────────────────────────────────────────────
// PERMISSION CHECK FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 * Falls back to DENY for any permission not explicitly listed.
 */
// Map a stored DB UserRole value → RBAC AnyRole vocabulary (client-safe).
export function mapDbRoleToRbac(raw: string | null | undefined): AnyRole {
  switch (raw) {
    case "SUPER_ADMIN":     return "SYSTEM_ADMIN"
    case "OWNER":           return "ADMIN"
    case "ADMIN":           return "ADMIN"
    case "PMO_DIRECTOR":    return "PMO_DIRECTOR"
    case "EXECUTIVE":       return "EXECUTIVE"
    case "PROGRAM_MANAGER": return "PROGRAM_MANAGER"
    case "PM":              return "PROJECT_MANAGER"
    case "MEMBER":          return "TEAM_MEMBER"
    case "VIEWER":          return "READ_ONLY"
    case "CLIENT":          return "CLIENT"
    case "SYSTEM_ADMIN":
    case "SUPER_USER":
    case "PROJECT_MANAGER":
    case "TEAM_MEMBER":
    case "READ_ONLY":
      return raw as AnyRole
    default:                return "READ_ONLY"   // least privilege
  }
}

// ── Canonical DB-role groupings ──────────────────────────────────────────────
// IMPORTANT: these operate on the DB UserRole enum (SUPER_ADMIN, OWNER, ADMIN,
// PMO_DIRECTOR, EXECUTIVE, PROGRAM_MANAGER, PM, MEMBER, VIEWER, CLIENT) — NOT the
// mapped RBAC WorkspaceRole names. Use these instead of hardcoding role lists so
// checks can't drift onto RBAC names (e.g. SYSTEM_ADMIN/TEAM_MEMBER/READ_ONLY),
// which never match a raw membership.role and silently break gates.
export const WORKSPACE_ADMIN_ROLES   = ["SUPER_ADMIN", "OWNER", "ADMIN"]
export const WORKSPACE_MANAGER_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN", "PMO_DIRECTOR"]
export const READ_ONLY_ROLES         = ["VIEWER", "CLIENT"]

export function isWorkspaceAdmin(role?: string | null): boolean {
  return WORKSPACE_ADMIN_ROLES.includes((role || "") as any)
}
export function isWorkspaceManager(role?: string | null): boolean {
  return WORKSPACE_MANAGER_ROLES.includes((role || "") as any)
}
export function isReadOnlyRole(role?: string | null): boolean {
  return READ_ONLY_ROLES.includes((role || "") as any)
}

export function can(role: AnyRole, permission: Permission): boolean {
  const rolePerms = PERMISSIONS[role]
  if (!rolePerms) return false
  return rolePerms[permission] === true
}

/**
 * Check if role A can manage role B
 * (you can only assign roles below your own level)
 */
export function canManageRole(actorRole: AnyRole, targetRole: AnyRole): boolean {
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole]
}

/**
 * Get all permissions a role has (for display in UI)
 */
export function getRolePermissions(role: AnyRole): Permission[] {
  return Object.entries(PERMISSIONS[role] || {})
    .filter(([_, v]) => v === true)
    .map(([k]) => k as Permission)
}

/**
 * Get the minimum role required for a permission
 */
export function minimumRoleFor(permission: Permission): AnyRole | null {
  const order: AnyRole[] = [
    "CLIENT","READ_ONLY","TEAM_MEMBER","PROJECT_MANAGER",
    "PROGRAM_MANAGER","SUPER_USER","ADMIN","SYSTEM_ADMIN",
  ]
  return order.find(role => can(role, permission)) || null
}

/**
 * Assignable roles for a given actor role
 * (cannot assign roles equal to or above your own)
 */
export function assignableRoles(actorRole: AnyRole): WorkspaceRole[] {
  const allRoles: WorkspaceRole[] = [
    "ADMIN","SUPER_USER","PMO_DIRECTOR","EXECUTIVE","PROGRAM_MANAGER","PROJECT_MANAGER",
    "TEAM_MEMBER","READ_ONLY","CLIENT",
  ]
  return allRoles.filter(r => canManageRole(actorRole, r))
}

// ─────────────────────────────────────────────
// PROJECT-LEVEL OVERRIDES
// For CLIENT role — project PM can enable specific permissions
// ─────────────────────────────────────────────

export type ClientOverride =
  | "allow_task_update"    // client can update progress on their tasks
  | "allow_file_upload"    // client can upload documents
  | "allow_budget_view"    // client can see budget summary (not details)
  | "allow_comment"        // client can comment on tasks

export interface ProjectClientSettings {
  overrides: ClientOverride[]
}

export function canWithOverride(
  role:      AnyRole,
  permission: Permission,
  overrides?: ClientOverride[]
): boolean {
  if (role !== "CLIENT") return can(role, permission)

  // Base CLIENT permissions
  if (can("CLIENT", permission)) return true

  // Check overrides
  if (!overrides?.length) return false

  const overrideMap: Partial<Record<ClientOverride, Permission[]>> = {
    allow_task_update: ["tasks:update_progress", "tasks:edit_assigned"],
    allow_file_upload: ["files:upload"],
    allow_budget_view: ["budget:view"],
    allow_comment:     [],  // handled separately via comments system
  }

  return overrides.some(o =>
    overrideMap[o]?.includes(permission)
  )
}
