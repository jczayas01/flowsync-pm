// src/lib/roles.ts
// PM Standard Role Taxonomy — FlowSync PM
// Defines all project roles, their descriptions, access rights,
// and methodology relevance per PM best practices Sections 2.3 and Stakeholder Domain.

// ── Role Metadata ─────────────────────────────────────────────────────────

export type ProjectRoleKey =
  | "EXECUTIVE_SPONSOR" | "SPONSOR" | "STEERING_COMMITTEE" | "PMO_DIRECTOR"
  | "PMO" | "PROGRAM_MANAGER" | "PM"
  | "PRODUCT_OWNER" | "BUSINESS_ANALYST"
  | "TECH_LEAD" | "SCRUM_MASTER"
  | "TEAM_MEMBER"
  | "STAKEHOLDER"
  | "EXTERNAL_RESOURCE" | "CLIENT" | "AUDITOR"

export interface RoleDef {
  value:       ProjectRoleKey
  label:       string
  shortLabel:  string
  color:       string
  bg:          string
  layer:       "governance" | "pmo" | "management" | "direction" | "technical" | "delivery" | "stakeholder" | "external"
  standardRef:      string      // PM Standard function section reference
  description: string      // What this person does
  authority:   string      // What they can approve/decide
  methodologies: ("WATERFALL" | "AGILE" | "SCRUM" | "ALL")[]
  // Platform access
  canEdit:     boolean     // can modify project data
  canApprove:  boolean     // can approve changes, milestones, CRs
  visibleTabs: string[]    // which tabs they can see ("*" = all)
}

export const ROLE_DEFINITIONS: Record<ProjectRoleKey, RoleDef> = {

  // ── GOVERNANCE LAYER ──────────────────────────────────────────────────────

  EXECUTIVE_SPONSOR: {
    value:"EXECUTIVE_SPONSOR", label:"Executive Sponsor", shortLabel:"Exec. Sponsor",
    color:"#581C87", bg:"#F3E8FF",
    layer:"governance", standardRef:"PM Standard — Provide Resources & Direction",
    description:"C-Suite champion who authorizes the project budget, communicates organizational vision, and removes enterprise-level obstacles. Not involved in day-to-day work.",
    authority:"Authorizes budget overruns, cancels projects, approves strategic pivots.",
    methodologies:["ALL"],
    canEdit:false, canApprove:true,
    visibleTabs:["dashboard","reports","budget","risks"],
  },

  SPONSOR: {
    value:"SPONSOR", label:"Project Sponsor", shortLabel:"Sponsor",
    color:"#7C3AED", bg:"#F5F3FF",
    layer:"governance", standardRef:"PM Standard — Provide Resources & Direction",
    description:"Funds and champions the project. Liaises between senior management and the project team. Signs off on phase gates and milestone deliverables. Removes obstacles beyond the PM's authority.",
    authority:"Signs milestone acceptance, approves Change Requests, escalation point for blocked risks.",
    methodologies:["ALL"],
    canEdit:false, canApprove:true,
    visibleTabs:["dashboard","gantt","reports","milestones","risks","changes","budget"],
  },

  STEERING_COMMITTEE: {
    value:"STEERING_COMMITTEE", label:"Steering Committee", shortLabel:"Steering Cmte.",
    color:"#1E3A8A", bg:"#EFF6FF",
    layer:"governance", standardRef:"PM Standard — Maintain Governance",
    description:"Governance body that approves phase gate transitions, reviews strategic alignment, and provides oversight on scope, budget, and schedule. Typically meets at key milestones.",
    authority:"Phase gate approvals, portfolio prioritization, project cancellation authority.",
    methodologies:["ALL"],
    canEdit:false, canApprove:true,
    visibleTabs:["dashboard","reports","budget","risks","closure"],
  },

  PMO_DIRECTOR: {
    value:"PMO_DIRECTOR", label:"PMO Director", shortLabel:"PMO Director",
    color:"#0E7490", bg:"#ECFEFF",
    layer:"governance", standardRef:"PM Standard — Maintain Governance",
    description:"Heads the Project Management Office. Sets methodology standards, defines governance policies, manages the project portfolio, and is the final authority on PM best practices within the organization.",
    authority:"Approves methodology exceptions, escalation from all PMs, portfolio resource decisions.",
    methodologies:["ALL"],
    canEdit:true, canApprove:true,
    visibleTabs:["*"],
  },

  // ── PMO & COORDINATION LAYER ──────────────────────────────────────────────

  PMO: {
    value:"PMO", label:"PMO Analyst", shortLabel:"PMO",
    color:"#0891B2", bg:"#F0FDFF",
    layer:"pmo", standardRef:"PM Standard — Facilitate & Support",
    description:"PMO Analyst who supports the PM with governance documentation, status reporting, compliance tracking, and process adherence. Ensures the project follows organizational standards.",
    authority:"No formal approval authority — supports governance decisions.",
    methodologies:["ALL"],
    canEdit:true, canApprove:false,
    visibleTabs:["*"],
  },

  PROGRAM_MANAGER: {
    value:"PROGRAM_MANAGER", label:"Program Manager", shortLabel:"Prog. Mgr.",
    color:"#1D4ED8", bg:"#EFF6FF",
    layer:"pmo", standardRef:"PM Standard — Provide Oversight & Coordination",
    description:"Manages a group of related projects to achieve benefits not available from managing them individually. Coordinates interdependencies, shared resources, and shared risks across projects.",
    authority:"Cross-project resource allocation, escalation across related projects.",
    methodologies:["ALL"],
    canEdit:true, canApprove:true,
    visibleTabs:["*"],
  },

  // ── PROJECT MANAGEMENT LAYER ───────────────────────────────────────────────

  PM: {
    value:"PM", label:"Project Manager", shortLabel:"PM",
    color:"#1B6CA8", bg:"#EFF6FF",
    layer:"management", standardRef:"PM Standard — Provide Oversight & Coordination",
    description:"Leads the project team to achieve project objectives. Plans, monitors, and controls all project work. Manages schedule, budget, risks, stakeholders, and communications throughout the project life cycle.",
    authority:"Full project authority — approve CRs within delegated thresholds, milestone sign-off, team decisions.",
    methodologies:["ALL"],
    canEdit:true, canApprove:true,
    visibleTabs:["*"],
  },

  // ── BUSINESS DIRECTION LAYER ───────────────────────────────────────────────

  PRODUCT_OWNER: {
    value:"PRODUCT_OWNER", label:"Product Owner", shortLabel:"Product Owner",
    color:"#0F766E", bg:"#F0FDFA",
    layer:"direction", standardRef:"PM Standard — Provide Business Direction & Insight",
    description:"Owns the product backlog and prioritizes work based on business value, dependencies, and risk. The single voice of the customer within the team. Accepts or rejects completed sprint work. Defines the Definition of Done.",
    authority:"Backlog prioritization, sprint acceptance, feature scope decisions.",
    methodologies:["SCRUM","AGILE"],
    canEdit:true, canApprove:true,
    visibleTabs:["dashboard","tasks","board","docs","reports","lessons","benefits"],
  },

  BUSINESS_ANALYST: {
    value:"BUSINESS_ANALYST", label:"Business Analyst", shortLabel:"BA",
    color:"#059669", bg:"#ECFDF5",
    layer:"direction", standardRef:"PM Standard — Provide Business Direction & Insight",
    description:"Elicits, documents, and validates business requirements. Ensures project deliverables align with business needs. Bridges the gap between business stakeholders and the technical team.",
    authority:"Requirements sign-off, UAT coordination, business case validation.",
    methodologies:["ALL"],
    canEdit:true, canApprove:false,
    visibleTabs:["dashboard","tasks","board","docs","reports","risks","lessons"],
  },

  // ── TECHNICAL LEADERSHIP LAYER ─────────────────────────────────────────────

  TECH_LEAD: {
    value:"TECH_LEAD", label:"Technical Lead", shortLabel:"Tech Lead",
    color:"#4338CA", bg:"#EEF2FF",
    layer:"technical", standardRef:"PM Standard — Perform Work & Apply Expertise",
    description:"Technical design authority on the project. Makes architecture decisions, reviews technical deliverables, guides the engineering team, and ensures technical quality standards are met.",
    authority:"Technical design decisions, architecture sign-off, code/system standards.",
    methodologies:["ALL"],
    canEdit:true, canApprove:false,
    visibleTabs:["dashboard","tasks","board","gantt","docs","risks","lessons"],
  },

  SCRUM_MASTER: {
    value:"SCRUM_MASTER", label:"Scrum Master", shortLabel:"Scrum Master",
    color:"#B45309", bg:"#FFFBEB",
    layer:"technical", standardRef:"PM Standard — Facilitate & Support",
    description:"Servant-leader who facilitates Scrum ceremonies (Sprint Planning, Daily Standup, Sprint Review, Retrospective). Removes impediments to team progress. NOT a PM — does not own project decisions, budget, or schedule authority.",
    authority:"Ceremony facilitation, impediment removal. No formal project authority.",
    methodologies:["SCRUM","AGILE"],
    canEdit:true, canApprove:false,
    visibleTabs:["dashboard","tasks","board","gantt","risks","lessons","team"],
  },

  // ── DELIVERY TEAM LAYER ────────────────────────────────────────────────────

  TEAM_MEMBER: {
    value:"TEAM_MEMBER", label:"Team Member", shortLabel:"Team Member",
    color:"#16A34A", bg:"#F0FDF4",
    layer:"delivery", standardRef:"PM Standard — Perform Work & Contribute Insights",
    description:"Core delivery team member. Performs the project work — engineering, design, QA, analysis, or any other specialist function needed to deliver project outcomes. Can be full-time or part-time.",
    authority:"Own task management only. No project-level decisions.",
    methodologies:["ALL"],
    canEdit:true, canApprove:false,
    visibleTabs:["dashboard","tasks","board","gantt","docs","lessons"],
  },

  // ── STAKEHOLDER LAYER ──────────────────────────────────────────────────────

  STAKEHOLDER: {
    value:"STAKEHOLDER", label:"Stakeholder", shortLabel:"Stakeholder",
    color:"#D97706", bg:"#FFFBEB",
    layer:"stakeholder", standardRef:"PM Standard — Present Objectives & Feedback",
    description:"Individual, group, or organization that may affect or be affected by the project. Has interest in the outcome but is not part of daily project execution. Provides input during reviews and feedback sessions.",
    authority:"No formal authority — provides feedback and input.",
    methodologies:["ALL"],
    canEdit:false, canApprove:false,
    visibleTabs:["dashboard","reports","milestones"],
  },

  // ── EXTERNAL LAYER ────────────────────────────────────────────────────────

  EXTERNAL_RESOURCE: {
    value:"EXTERNAL_RESOURCE", label:"External Resource", shortLabel:"External",
    color:"#64748B", bg:"#F8FAFC",
    layer:"external", standardRef:"PM Standard — Apply Expertise",
    description:"External contractor, vendor, or consultant who brings specialized expertise for the project or a phase. Subject matter expert from outside the organization. May be engaged for the full project or a specific period.",
    authority:"Technical recommendations only. No project decisions.",
    methodologies:["ALL"],
    canEdit:true, canApprove:false,
    visibleTabs:["dashboard","tasks","docs"],
  },

  CLIENT: {
    value:"CLIENT", label:"Client / End User", shortLabel:"Client",
    color:"#0891B2", bg:"#F0FDFF",
    layer:"external", standardRef:"PM Standard — Present Objectives & Feedback",
    description:"The customer or end user who will receive and use the project deliverable. Provides requirements, reviews deliverables, and accepts final outputs. In some projects the client participates directly in UAT.",
    authority:"Final acceptance of deliverables.",
    methodologies:["ALL"],
    canEdit:false, canApprove:true,
    visibleTabs:["dashboard","reports","milestones"],
  },

  AUDITOR: {
    value:"AUDITOR", label:"Auditor", shortLabel:"Auditor",
    color:"#374151", bg:"#F9FAFB",
    layer:"external", standardRef:"PM Standard — Maintain Governance",
    description:"Compliance or internal audit observer. Reviews project documentation, financial records, and governance artifacts for regulatory or organizational compliance purposes. Read-only access to all project data.",
    authority:"No approval authority — provides findings and recommendations only.",
    methodologies:["ALL"],
    canEdit:false, canApprove:false,
    visibleTabs:["dashboard","tasks","budget","risks","changes","decisions","docs","reports","closure"],
  },
}

// ── Ordered list for dropdowns ──────────────────────────────────────────────

export const PROJECT_ROLES_ORDERED: RoleDef[] = [
  ROLE_DEFINITIONS.EXECUTIVE_SPONSOR,
  ROLE_DEFINITIONS.SPONSOR,
  ROLE_DEFINITIONS.STEERING_COMMITTEE,
  ROLE_DEFINITIONS.PMO_DIRECTOR,
  ROLE_DEFINITIONS.PROGRAM_MANAGER,
  ROLE_DEFINITIONS.PMO,
  ROLE_DEFINITIONS.PM,
  ROLE_DEFINITIONS.PRODUCT_OWNER,
  ROLE_DEFINITIONS.BUSINESS_ANALYST,
  ROLE_DEFINITIONS.TECH_LEAD,
  ROLE_DEFINITIONS.SCRUM_MASTER,
  ROLE_DEFINITIONS.TEAM_MEMBER,
  ROLE_DEFINITIONS.STAKEHOLDER,
  ROLE_DEFINITIONS.EXTERNAL_RESOURCE,
  ROLE_DEFINITIONS.CLIENT,
  ROLE_DEFINITIONS.AUDITOR,
]

// ── Layer groupings ────────────────────────────────────────────────────────

export const ROLE_LAYERS = [
  { key:"governance", label:"Governance", color:"#7C3AED",
    roles:["EXECUTIVE_SPONSOR","SPONSOR","STEERING_COMMITTEE","PMO_DIRECTOR"] },
  { key:"pmo", label:"PMO & Program",   color:"#0E7490",
    roles:["PMO","PROGRAM_MANAGER"] },
  { key:"management", label:"Project Management", color:"#1B6CA8",
    roles:["PM"] },
  { key:"direction", label:"Business Direction", color:"#059669",
    roles:["PRODUCT_OWNER","BUSINESS_ANALYST"] },
  { key:"technical", label:"Technical Leadership", color:"#4338CA",
    roles:["TECH_LEAD","SCRUM_MASTER"] },
  { key:"delivery", label:"Delivery Team", color:"#16A34A",
    roles:["TEAM_MEMBER"] },
  { key:"stakeholder", label:"Stakeholders", color:"#D97706",
    roles:["STAKEHOLDER"] },
  { key:"external", label:"External", color:"#64748B",
    roles:["EXTERNAL_RESOURCE","CLIENT","AUDITOR"] },
] as const

// ── Methodology-filtered roles ─────────────────────────────────────────────

export function getRolesForMethodology(methodology: "WATERFALL" | "AGILE" | "SCRUM") {
  return PROJECT_ROLES_ORDERED.filter(r =>
    r.methodologies.includes("ALL") || r.methodologies.includes(methodology)
  )
}

// ── Access checks ──────────────────────────────────────────────────────────

export function canAccessTab(role: ProjectRoleKey | null | undefined, tab: string): boolean {
  if (!role) return false
  const def = ROLE_DEFINITIONS[role]
  if (!def) return false
  if (def.visibleTabs.includes("*")) return true
  return def.visibleTabs.includes(tab)
}

export function canEditProject(role: ProjectRoleKey | null | undefined): boolean {
  if (!role) return false
  return ROLE_DEFINITIONS[role]?.canEdit ?? false
}

export function canApprove(role: ProjectRoleKey | null | undefined): boolean {
  if (!role) return false
  return ROLE_DEFINITIONS[role]?.canApprove ?? false
}

// ── Role helper ────────────────────────────────────────────────────────────

export function getRoleDef(role: string | null | undefined): RoleDef {
  return ROLE_DEFINITIONS[role as ProjectRoleKey] || {
    value:"TEAM_MEMBER" as ProjectRoleKey,
    label:"Team Member", shortLabel:"Team Member",
    color:"#94A3B8", bg:"#F8FAFC",
    layer:"delivery" as const, standardRef:"PM Standard",
    description:"", authority:"", methodologies:["ALL" as const],
    canEdit:true, canApprove:false, visibleTabs:["tasks","board"],
  }
}

// ── RACI mapping ───────────────────────────────────────────────────────────
// R=Responsible, A=Accountable, C=Consulted, I=Informed

export const RACI_BY_ROLE: Record<ProjectRoleKey, "R"|"A"|"C"|"I"> = {
  EXECUTIVE_SPONSOR:  "A",
  SPONSOR:            "A",
  STEERING_COMMITTEE: "A",
  PMO_DIRECTOR:       "A",
  PROGRAM_MANAGER:    "A",
  PMO:                "R",
  PM:                 "R",
  PRODUCT_OWNER:      "R",
  BUSINESS_ANALYST:   "R",
  TECH_LEAD:          "R",
  SCRUM_MASTER:       "R",
  TEAM_MEMBER:        "R",
  STAKEHOLDER:        "I",
  EXTERNAL_RESOURCE:  "C",
  CLIENT:             "I",
  AUDITOR:            "I",
}
