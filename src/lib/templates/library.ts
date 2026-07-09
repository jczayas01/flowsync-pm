// src/lib/templates/library.ts
// Built-in template library — installed at workspace creation
// and available in the public marketplace

export interface TemplatePhase {
  name:        string
  description: string
  order:       number
  durationWeeks: number
  tasks:       TemplateTask[]
  milestones?: TemplateMilestone[]
}

export interface TemplateTask {
  title:          string
  description?:   string
  estimatedHours: number
  priority:       "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"
  role:           string   // suggested role for assignee
}

export interface TemplateMilestone {
  name:        string
  weekOffset:  number   // weeks from phase start
}

export interface TemplateRiskCategory {
  name:        string
  examples:    string[]
  probability?: string
  impact?:      string
}

export interface TemplateDefinition {
  id:           string
  name:         string
  description:  string
  longDescription: string
  methodology:  "WATERFALL"|"AGILE"|"SCRUM"|"HYBRID"
  industry:     string
  category:     string
  icon:         string
  color:        string
  estimatedWeeks: number
  teamSize:     string
  difficulty:   "Beginner"|"Intermediate"|"Advanced"
  tags:         string[]
  isPremium:    boolean
  price:        number        // cents, 0 = free
  usageCount:   number
  rating:       number        // 0-5
  ratingCount:  number
  author:       string
  authorOrg?:   string
  phases:       TemplatePhase[]
  riskCategories: TemplateRiskCategory[]
  documentTypes:  string[]
  featured:     boolean
}

export const TEMPLATE_LIBRARY: TemplateDefinition[] = [

  // ─── SYSTEM & PLATFORM ───────────────────────────────
  {
    id: "system-implementation",
    name: "System Implementation",
    description: "Full lifecycle implementation of a new business system or platform.",
    longDescription: "Covers requirements gathering, integration planning, data migration, staff training, and go-live support. Pre-loaded with compliance checkpoints and validation gates.",
    methodology: "WATERFALL",
    difficulty: "Advanced",
    estimatedWeeks: 36,
    industry: "IT",
    category: "IT Implementation",
    icon: "🧩",
    color: "#1B6CA8",
    teamSize: "8-15",
    tags: ["Implementation","Integration","Migration","Enterprise"],
    isPremium: false,
    price: 0,
    usageCount: 847,
    rating: 4.8,
    ratingCount: 210,
    author: "FlowSync PM",
    featured: true,
    phases: [
      { name:"Initiation & Planning", description:"Project setup, requirements, stakeholder alignment", order:0, durationWeeks:4,
        tasks:[
          {title:"Define project charter", estimatedHours:16, priority:"HIGH", role:"PM"},
          {title:"Stakeholder identification and analysis", estimatedHours:8, priority:"HIGH", role:"PM"},
          {title:"Requirements gathering workshops", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Risk assessment", estimatedHours:16, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Initiation & Planning complete", weekOffset:4}]},
      { name:"Design", description:"System design, architecture, integration planning", order:1, durationWeeks:8,
        tasks:[
          {title:"System architecture design", estimatedHours:64, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Integration design specification", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Data migration strategy", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Design complete", weekOffset:8}]},
      { name:"Development & Configuration", description:"Build, configure, and integrate", order:2, durationWeeks:14,
        tasks:[
          {title:"Core system configuration", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Integration development", estimatedHours:160, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Data migration scripts", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Development & Configuration complete", weekOffset:14}]},
      { name:"Testing & Validation", description:"SIT, UAT, performance testing", order:3, durationWeeks:8,
        tasks:[
          {title:"System integration testing", estimatedHours:80, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"User acceptance testing", estimatedHours:120, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Performance testing", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Testing & Validation complete", weekOffset:8}]},
      { name:"Go-live & Handover", description:"Deployment, training, stabilization", order:4, durationWeeks:2,
        tasks:[
          {title:"Staff training delivery", estimatedHours:60, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Go-live execution", estimatedHours:32, priority:"CRITICAL", role:"PM"},
          {title:"Post go-live support", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Go-live & Handover complete", weekOffset:2}]},
    ],
    riskCategories:[
      {name:"Scope creep", examples:["Stakeholder change requests","Undocumented requirements"]},
      {name:"Resource availability", examples:["Key staff turnover","Competing priorities"]},
      {name:"Integration failures", examples:["API compatibility issues","Data format mismatches"]},
      {name:"Data migration", examples:["Data quality issues","Migration performance"]},
    ],
    documentTypes:["Project Charter","Requirements Specification","Integration Design","Training Plan","Go-Live Runbook","Sign-off Document"],
  },

  {
    id: "web-platform",
    name: "Web Platform Launch",
    description: "Agile delivery of a customer-facing web or mobile platform.",
    longDescription: "Sprint-based delivery covering UX design, frontend/backend development, integrations, accessibility, and launch. Includes testing and monitoring checkpoints.",
    methodology: "AGILE",
    difficulty: "Intermediate",
    estimatedWeeks: 20,
    industry: "Technology",
    category: "Product Development",
    icon: "📱",
    color: "#059669",
    teamSize: "5-10",
    tags: ["Web Platform","Agile","Launch","UX"],
    isPremium: false,
    price: 0,
    usageCount: 412,
    rating: 4.6,
    ratingCount: 128,
    author: "FlowSync PM",
    featured: true,
    phases: [
      { name:"Discovery & Design", description:"UX research, design system, architecture", order:0, durationWeeks:4,
        tasks:[
          {title:"User research and personas", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"UX wireframes and prototypes", estimatedHours:60, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Technical architecture", estimatedHours:24, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Accessibility review", estimatedHours:16, priority:"MEDIUM", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Discovery & Design complete", weekOffset:4}]},
      { name:"Development", description:"Frontend, backend, integrations", order:1, durationWeeks:10,
        tasks:[
          {title:"Frontend development", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Backend API development", estimatedHours:160, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Third-party integrations", estimatedHours:100, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Authentication and security", estimatedHours:40, priority:"CRITICAL", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Development complete", weekOffset:10}]},
      { name:"Testing & QA", description:"Testing, performance, security", order:2, durationWeeks:4,
        tasks:[
          {title:"Functional testing", estimatedHours:80, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Performance and load testing", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Security review", estimatedHours:24, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"UAT with real users", estimatedHours:32, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Testing & QA complete", weekOffset:4}]},
      { name:"Launch", description:"Deployment, monitoring, handover", order:3, durationWeeks:2,
        tasks:[
          {title:"Production deployment", estimatedHours:16, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Monitoring and alerting setup", estimatedHours:12, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Launch communications", estimatedHours:8, priority:"MEDIUM", role:"PM"},
        ],
        milestones:[{name:"Launch complete", weekOffset:2}]},
    ],
    riskCategories:[
      {name:"Scope creep", examples:["Feature additions mid-sprint","Changing requirements"]},
      {name:"Performance", examples:["Slow load times","Scalability issues"]},
      {name:"Security", examples:["Data exposure","Authentication vulnerabilities"]},
      {name:"Integration", examples:["Third-party API changes","Rate limiting"]},
    ],
    documentTypes:["UX Research Report","API Design Spec","Security Review","UAT Results","Launch Checklist"],
  },

  // ─── IT / INFRASTRUCTURE ────────────────────
  {
    id: "cloud-migration",
    name: "Cloud Migration (AWS / Azure)",
    description: "Enterprise migration from on-premise infrastructure to cloud with zero-downtime cutover.",
    longDescription: "Covers discovery, architecture design, pilot migration, parallel running, and full cutover. Supports AWS, Azure, and hybrid deployments. Includes rollback procedures and business continuity planning at each gate.",
    methodology: "WATERFALL",
    industry: "IT",
    category: "Infrastructure",
    icon: "☁️",
    color: "#0891B2",
    estimatedWeeks: 24,
    teamSize: "6–12 people",
    difficulty: "Advanced",
    tags: ["Cloud","AWS","Azure","Migration","Infrastructure","DevOps"],
    isPremium: true,
    price: 4900,
    usageCount: 623,
    rating: 4.9,
    ratingCount: 89,
    author: "CloudOps Pro",
    authorOrg: "CloudOps Consulting",
    featured: true,
    phases:[
      {name:"Discovery & Assessment", description:"Current state analysis, TCO, migration strategy", order:0, durationWeeks:4,
        tasks:[
          {title:"Infrastructure inventory", estimatedHours:60, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Dependency mapping", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Cloud readiness assessment", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"TCO analysis", estimatedHours:24, priority:"HIGH", role:"PROJECT_MANAGER"},
        ],
        milestones:[{name:"Assessment complete", weekOffset:4}]
      },
      {name:"Architecture & Design", description:"Target architecture, network design, security model", order:1, durationWeeks:5,
        tasks:[
          {title:"Target architecture design", estimatedHours:120, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Network & security design", estimatedHours:80, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"DR / BCP planning", estimatedHours:40, priority:"HIGH", role:"PROJECT_MANAGER"},
        ],
        milestones:[{name:"Architecture approved", weekOffset:5}]
      },
      {name:"Pilot Migration", description:"Migrate 2-3 non-critical workloads, validate approach", order:2, durationWeeks:6,
        tasks:[
          {title:"Pilot workload migration", estimatedHours:160, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Performance benchmarking", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Cost optimization review", estimatedHours:20, priority:"MEDIUM", role:"PROJECT_MANAGER"},
        ],
        milestones:[{name:"Pilot approved", weekOffset:6}]
      },
      {name:"Full Migration", description:"Wave-based migration of all workloads", order:3, durationWeeks:7,
        tasks:[
          {title:"Wave 1: Dev/test environments", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Wave 2: Business applications", estimatedHours:200, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Wave 3: Production databases", estimatedHours:160, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"DNS cutover", estimatedHours:20, priority:"CRITICAL", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Migration complete", weekOffset:7}]
      },
      {name:"Optimization & Closure", description:"Cost optimization, monitoring setup, decommission", order:4, durationWeeks:2,
        tasks:[
          {title:"Cloud cost optimization", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Monitoring & alerting setup", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Old infrastructure decommission", estimatedHours:20, priority:"MEDIUM", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Project closed", weekOffset:2}]
      },
    ],
    riskCategories:[
      {name:"Data loss", examples:["Migration failures","Incomplete backups"]},
      {name:"Downtime", examples:["DNS propagation delays","Dependency failures"]},
      {name:"Cost overrun", examples:["Unexpected egress fees","Over-provisioning"]},
    ],
    documentTypes:["Discovery Report","Target Architecture","Migration Plan","Runbook","DR Plan"],
  },

  {
    id: "software-dev-scrum",
    name: "Software Development (Scrum)",
    description: "Standard Scrum setup for a software development team — backlog, sprints, ceremonies, and definition of done.",
    longDescription: "Pre-configured with a product backlog, sprint board, velocity tracking, and all Scrum ceremonies (standup, planning, review, retro). Includes ready-made epics for common software features.",
    methodology: "SCRUM",
    industry: "IT",
    category: "Product Development",
    icon: "🏃",
    color: "#7C3AED",
    estimatedWeeks: 12,
    teamSize: "4–9 people",
    difficulty: "Beginner",
    tags: ["Scrum","Agile","Software","Sprints","Development"],
    isPremium: false,
    price: 0,
    usageCount: 1842,
    rating: 4.7,
    ratingCount: 312,
    author: "FlowSync PM",
    featured: true,
    phases:[
      {name:"Sprint 0: Setup", description:"Team setup, backlog seeding, definition of done", order:0, durationWeeks:2,
        tasks:[
          {title:"Create product backlog", estimatedHours:16, priority:"HIGH", role:"PROJECT_MANAGER"},
          {title:"Define DoD (Definition of Done)", estimatedHours:4, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Set up development environment", estimatedHours:20, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Sprint 1 planning", estimatedHours:4, priority:"HIGH", role:"PROJECT_MANAGER"},
        ]
      },
      {name:"Sprint 1", description:"First sprint — core functionality", order:1, durationWeeks:2,
        tasks:[
          {title:"User story: [Replace with your story]", estimatedHours:8, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Code review & PR", estimatedHours:4, priority:"MEDIUM", role:"TEAM_MEMBER"},
          {title:"Sprint review & demo", estimatedHours:2, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Sprint retrospective", estimatedHours:1, priority:"MEDIUM", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Sprint 1 complete", weekOffset:2}]
      },
    ],
    riskCategories:[
      {name:"Scope creep", examples:["Backlog bloat","Undocumented requirements"]},
      {name:"Velocity issues", examples:["Team capacity changes","Unplanned work"]},
    ],
    documentTypes:["Product Backlog","Sprint Plan","Velocity Chart","Retro Notes","Release Notes"],
  },

  // ─── CONSTRUCTION / FACILITIES ──────────────
  {
    id: "construction-project",
    name: "Construction Project Management",
    description: "End-to-end construction lifecycle from feasibility and permitting through commissioning and owner handover — with RFIs, submittals, change orders, punch lists, and draw schedules built in.",
    longDescription: "A comprehensive, phase-gated construction template covering pre-construction, design & permitting, procurement/buyout, site prep, foundation & structure, MEP & envelope, interiors, commissioning, and closeout. Pre-loaded with construction governance (RFI log, submittal register, change orders, inspections, punch lists), a Schedule of Values and draw schedule for financials, domain risk categories, and suggested roles (owner, GC, architect, engineer, superintendent, inspector).",
    methodology: "WATERFALL",
    difficulty: "Advanced",
    estimatedWeeks: 68,
    industry: "Construction",
    category: "Construction",
    icon: "🏗",
    color: "#EA580C",
    teamSize: "15-40 people",
    tags: ["Construction","RFIs","Submittals","Change Orders","Punch List","Waterfall"],
    isPremium: true,
    price: 9900,
    usageCount: 234,
    rating: 4.7,
    ratingCount: 58,
    author: "FlowSync PM",
    featured: true,
    phases:[
      { name:"Pre-Construction & Feasibility", description:"Charter, feasibility, budget, team, site survey", order:0, durationWeeks:6,
        tasks:[
          {title:"Develop project charter & business case", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Site feasibility & due-diligence study", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Preliminary (ROM) budget & cost model", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Establish project team & roles (Owner/GC/Architect/Engineer)", estimatedHours:16, priority:"HIGH", role:"PM"},
          {title:"Geotechnical & topographic survey", estimatedHours:32, priority:"HIGH", role:"Engineer"},
          {title:"Zoning, entitlement & code review", estimatedHours:24, priority:"MEDIUM", role:"Architect"},
        ],
        milestones:[{name:"Feasibility approved", weekOffset:6}] },
      { name:"Design & Permitting", description:"Schematic, DD, CDs, building permit", order:1, durationWeeks:10,
        tasks:[
          {title:"Schematic design (SD)", estimatedHours:80, priority:"HIGH", role:"Architect"},
          {title:"Design development (DD)", estimatedHours:120, priority:"HIGH", role:"Architect"},
          {title:"Construction documents (CD set)", estimatedHours:160, priority:"CRITICAL", role:"Architect"},
          {title:"Building permit application & submittal", estimatedHours:24, priority:"CRITICAL", role:"PM"},
          {title:"Respond to permit review comments", estimatedHours:32, priority:"HIGH", role:"Architect"},
          {title:"Value engineering review", estimatedHours:24, priority:"MEDIUM", role:"GC"},
        ],
        milestones:[{name:"Design approved", weekOffset:6},{name:"Building permit approved", weekOffset:10}] },
      { name:"Procurement & Buyout", description:"Bid packages, subs, POs, SOV, long-lead", order:2, durationWeeks:6,
        tasks:[
          {title:"Prepare bid packages & scopes of work", estimatedHours:40, priority:"HIGH", role:"GC"},
          {title:"Subcontractor bidding & bid leveling", estimatedHours:48, priority:"HIGH", role:"GC"},
          {title:"Award subcontracts & issue purchase orders", estimatedHours:24, priority:"CRITICAL", role:"GC"},
          {title:"Set up submittal register", estimatedHours:16, priority:"MEDIUM", role:"PM"},
          {title:"Procure long-lead materials & equipment", estimatedHours:40, priority:"CRITICAL", role:"GC"},
          {title:"Prepare Schedule of Values (SOV)", estimatedHours:24, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Buyout complete / contracts signed", weekOffset:6}] },
      { name:"Site Preparation & Mobilization", description:"Mobilize, erosion control, grading, safety plan", order:3, durationWeeks:4,
        tasks:[
          {title:"Site mobilization & temporary facilities", estimatedHours:40, priority:"HIGH", role:"Superintendent"},
          {title:"Erosion control & SWPPP implementation", estimatedHours:24, priority:"MEDIUM", role:"Superintendent"},
          {title:"Site clearing, grading & earthwork", estimatedHours:60, priority:"HIGH", role:"Superintendent"},
          {title:"Utility locates & temporary connections", estimatedHours:24, priority:"HIGH", role:"Engineer"},
          {title:"Establish site safety program & logistics plan", estimatedHours:24, priority:"CRITICAL", role:"Superintendent"},
        ],
        milestones:[{name:"Notice to proceed / site ready", weekOffset:4}] },
      { name:"Foundation & Structure", description:"Excavation, foundations, frame, inspections, RFIs", order:4, durationWeeks:12,
        tasks:[
          {title:"Excavation & shoring", estimatedHours:80, priority:"HIGH", role:"Superintendent"},
          {title:"Foundations & footings", estimatedHours:120, priority:"CRITICAL", role:"Superintendent"},
          {title:"Structural frame erection", estimatedHours:200, priority:"CRITICAL", role:"Superintendent"},
          {title:"Concrete pours & inspections", estimatedHours:80, priority:"HIGH", role:"Inspector"},
          {title:"Process structural RFIs & submittals", estimatedHours:40, priority:"HIGH", role:"PM"},
          {title:"Weekly safety inspections & toolbox talks", estimatedHours:48, priority:"CRITICAL", role:"Superintendent"},
        ],
        milestones:[{name:"Foundation inspection passed", weekOffset:5},{name:"Structure topped out", weekOffset:12}] },
      { name:"MEP & Building Envelope", description:"MEP rough-in, envelope, submittals, change orders", order:5, durationWeeks:12,
        tasks:[
          {title:"MEP rough-in (mechanical/electrical/plumbing)", estimatedHours:240, priority:"CRITICAL", role:"Superintendent"},
          {title:"Building envelope & roofing", estimatedHours:160, priority:"HIGH", role:"Superintendent"},
          {title:"MEP submittals & trade coordination", estimatedHours:60, priority:"HIGH", role:"Engineer"},
          {title:"Rough-in inspections", estimatedHours:40, priority:"HIGH", role:"Inspector"},
          {title:"Manage change orders (MEP scope)", estimatedHours:32, priority:"MEDIUM", role:"PM"},
          {title:"Fireproofing & life-safety systems", estimatedHours:80, priority:"HIGH", role:"Superintendent"},
        ],
        milestones:[{name:"MEP rough-in inspection passed", weekOffset:8},{name:"Building dried-in", weekOffset:12}] },
      { name:"Interiors & Fit-Out", description:"Framing, finishes, millwork, FF&E, change orders", order:6, durationWeeks:10,
        tasks:[
          {title:"Interior framing & drywall", estimatedHours:160, priority:"HIGH", role:"Superintendent"},
          {title:"Finishes — flooring, paint, ceilings", estimatedHours:160, priority:"MEDIUM", role:"Superintendent"},
          {title:"Millwork & casework installation", estimatedHours:80, priority:"MEDIUM", role:"Superintendent"},
          {title:"Fixtures, furnishings & equipment (FF&E)", estimatedHours:80, priority:"HIGH", role:"Superintendent"},
          {title:"Track & process change orders", estimatedHours:32, priority:"MEDIUM", role:"PM"},
          {title:"Finish quality inspections", estimatedHours:40, priority:"HIGH", role:"Inspector"},
        ],
        milestones:[{name:"Finishes complete", weekOffset:10}] },
      { name:"Commissioning & Testing", description:"Cx, TAB, life-safety, punch list, O&M", order:7, durationWeeks:4,
        tasks:[
          {title:"Systems commissioning (Cx)", estimatedHours:80, priority:"CRITICAL", role:"Engineer"},
          {title:"MEP testing, adjusting & balancing", estimatedHours:60, priority:"HIGH", role:"Engineer"},
          {title:"Life-safety & fire inspection", estimatedHours:32, priority:"CRITICAL", role:"Inspector"},
          {title:"Punch list walkthrough (owner/architect)", estimatedHours:40, priority:"HIGH", role:"Architect"},
          {title:"Prepare O&M manuals & handover docs", estimatedHours:40, priority:"MEDIUM", role:"PM"},
        ],
        milestones:[{name:"Certificate of Occupancy", weekOffset:3},{name:"Commissioning complete", weekOffset:4}] },
      { name:"Closeout & Handover", description:"Punch resolution, as-builts, retainage, handover", order:8, durationWeeks:4,
        tasks:[
          {title:"Final punch list resolution", estimatedHours:60, priority:"HIGH", role:"Superintendent"},
          {title:"As-built drawings & warranties", estimatedHours:40, priority:"MEDIUM", role:"Architect"},
          {title:"Retainage release & final draw", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Final draw / SOV reconciliation", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Owner training & handover", estimatedHours:32, priority:"HIGH", role:"PM"},
          {title:"Project closeout & lessons learned", estimatedHours:24, priority:"MEDIUM", role:"PM"},
        ],
        milestones:[{name:"Substantial completion", weekOffset:2},{name:"Owner handover / final acceptance", weekOffset:4}] },
    ],
    riskCategories:[
      {name:"Weather & site conditions", probability:"HIGH", impact:"MAJOR", examples:["Extreme weather delays","Unforeseen soil or geotechnical conditions","Environmental or contamination findings"]},
      {name:"Safety", probability:"MEDIUM", impact:"CRITICAL", examples:["OSHA-reportable incidents","Near misses","Fall and struck-by hazards"]},
      {name:"Permitting & inspections", probability:"HIGH", impact:"MODERATE", examples:["Permit approval delays","Failed inspections requiring rework","Code compliance issues"]},
      {name:"Supply & materials", probability:"HIGH", impact:"MAJOR", examples:["Long-lead material delays","Material price escalation","Subcontractor or supplier default"]},
      {name:"Cost & schedule", probability:"MEDIUM", impact:"MAJOR", examples:["Change-order cost growth","Critical-path schedule slippage","Retainage and cash-flow constraints"]},
    ],
    documentTypes:["Project Charter","Schedule of Values (SOV)","RFI Log","Submittal Register","Change Order Log","Inspection Reports","Punch List","Draw Schedule","As-Built Drawings","O&M Manual","Certificate of Occupancy","Closeout Package"],
  },

  // ─── COMPLIANCE ─────────────────────────────
  {
    id: "regulatory-compliance",
    name: "Regulatory Compliance Program",
    description: "Implement or audit a regulatory compliance program — gap analysis, risk analysis, policies, and controls.",
    longDescription: "Structured approach to achieving and maintaining regulatory compliance. Covers gap assessment, policy development, risk management, staff training, and ongoing monitoring.",
    methodology: "WATERFALL",
    difficulty: "Intermediate",
    estimatedWeeks: 16,
    industry: "Operations",
    category: "Compliance",
    icon: "🔒",
    color: "#DC2626",
    teamSize: "4-8",
    tags: ["Compliance","Regulatory","Audit","Controls"],
    isPremium: false,
    price: 0,
    usageCount: 389,
    rating: 4.8,
    ratingCount: 96,
    author: "FlowSync PM",
    featured: false,
    phases: [
      { name:"Gap Assessment", description:"Current state vs regulatory requirements", order:0, durationWeeks:3,
        tasks:[
          {title:"Regulatory requirements mapping", estimatedHours:24, priority:"CRITICAL", role:"PM"},
          {title:"Current state gap analysis", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Risk prioritization", estimatedHours:16, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Gap Assessment complete", weekOffset:3}]},
      { name:"Policy Development", description:"Create or update policies and procedures", order:1, durationWeeks:4,
        tasks:[
          {title:"Draft compliance policies", estimatedHours:60, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Legal and management review", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Policy approval and sign-off", estimatedHours:8, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Policy Development complete", weekOffset:4}]},
      { name:"Implementation", description:"Controls, tools, and process changes", order:2, durationWeeks:6,
        tasks:[
          {title:"Technical controls implementation", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Process change management", estimatedHours:40, priority:"HIGH", role:"PM"},
          {title:"Training program delivery", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Implementation complete", weekOffset:6}]},
      { name:"Audit & Certification", description:"Internal audit, remediation, certification", order:3, durationWeeks:3,
        tasks:[
          {title:"Internal audit", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Remediation of findings", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"External audit / certification submission", estimatedHours:24, priority:"CRITICAL", role:"PM"},
        ],
        milestones:[{name:"Audit & Certification complete", weekOffset:3}]},
    ],
    riskCategories:[
      {name:"Regulatory changes", examples:["Updated requirements","New interpretations"]},
      {name:"Resource constraints", examples:["Staff availability","Budget limitations"]},
      {name:"Audit findings", examples:["Critical gaps discovered","Remediation complexity"]},
    ],
    documentTypes:["Gap Analysis Report","Compliance Policies","Risk Register","Training Records","Audit Report","Certification Evidence"],
  },

  // ─── PRODUCT DEVELOPMENT ────────────────────
  {
    id: "saas-product-launch",
    name: "SaaS Product Launch",
    description: "From MVP to public launch — product development, beta program, go-to-market, and growth metrics.",
    longDescription: "Scrum-based delivery covering product discovery, MVP development, closed beta, open beta, and public launch. Includes GTM planning, pricing strategy, and post-launch growth tracking sprints.",
    methodology: "SCRUM",
    industry: "Technology",
    category: "Product Launch",
    icon: "🚀",
    color: "#7C3AED",
    estimatedWeeks: 24,
    teamSize: "4–10 people",
    difficulty: "Intermediate",
    tags: ["SaaS","Product","Launch","MVP","Beta","GTM"],
    isPremium: true,
    price: 2900,
    usageCount: 756,
    rating: 4.6,
    ratingCount: 103,
    author: "ProductOps Studio",
    featured: true,
    phases:[
      {name:"Discovery & MVP Definition", description:"Customer discovery, problem validation, MVP scope", order:0, durationWeeks:4,
        tasks:[
          {title:"Customer discovery interviews (20+)", estimatedHours:40, priority:"CRITICAL", role:"PROJECT_MANAGER"},
          {title:"Problem statement & solution hypothesis", estimatedHours:16, priority:"HIGH", role:"PROJECT_MANAGER"},
          {title:"MVP feature scope", estimatedHours:20, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Technical spike & architecture", estimatedHours:32, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"MVP scope locked", weekOffset:4}]
      },
      {name:"MVP Development (Sprints 1–6)", description:"Core product development, 2-week sprints", order:1, durationWeeks:12,
        tasks:[
          {title:"Sprint 1: Core authentication & onboarding", estimatedHours:80, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Sprint 2–3: Core feature set", estimatedHours:160, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Sprint 4–5: Integrations & billing", estimatedHours:120, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Sprint 6: Polish & performance", estimatedHours:80, priority:"MEDIUM", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"MVP complete", weekOffset:12}]
      },
      {name:"Beta Program", description:"Closed beta, feedback loops, iteration", order:2, durationWeeks:4,
        tasks:[
          {title:"Beta user recruitment (50 users)", estimatedHours:20, priority:"HIGH", role:"PROJECT_MANAGER"},
          {title:"Beta feedback collection & analysis", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Priority bug fixes & improvements", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Pricing & packaging finalization", estimatedHours:16, priority:"HIGH", role:"PROJECT_MANAGER"},
        ],
        milestones:[{name:"Beta complete", weekOffset:4}]
      },
      {name:"Launch & Growth", description:"Public launch, GTM execution, growth tracking", order:3, durationWeeks:4,
        tasks:[
          {title:"Launch marketing campaign", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Product Hunt / press launch", estimatedHours:20, priority:"HIGH", role:"PROJECT_MANAGER"},
          {title:"Customer support setup", estimatedHours:24, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Growth metrics dashboard", estimatedHours:16, priority:"MEDIUM", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Public launch", weekOffset:2},{name:"First 100 customers", weekOffset:4}]
      },
    ],
    riskCategories:[
      {name:"Product-market fit", examples:["Low activation","High churn"]},
      {name:"Technical debt", examples:["Scale issues at launch","Security vulnerabilities"]},
    ],
    documentTypes:["Product Brief","Sprint Plans","Beta Feedback Report","GTM Plan","Pricing Strategy","Launch Checklist"],
  },

  // ─── FINANCE ────────────────────────────────
  {
    id: "erp-implementation",
    name: "ERP System Implementation",
    description: "Full ERP deployment (SAP, Oracle, Dynamics 365) with data migration, training, and cutover.",
    longDescription: "Waterfall delivery covering blueprint, realization, testing, cutover, and hypercare. Pre-loaded with data migration tasks, integration checkpoints, parallel run phases, and change management deliverables.",
    methodology: "WATERFALL",
    industry: "Finance",
    category: "IT Implementation",
    icon: "💼",
    color: "#F59E0B",
    estimatedWeeks: 40,
    teamSize: "12–25 people",
    difficulty: "Advanced",
    tags: ["ERP","SAP","Oracle","Dynamics","Finance","ERP Implementation"],
    isPremium: true,
    price: 7900,
    usageCount: 178,
    rating: 4.9,
    ratingCount: 29,
    author: "ERPOps Consulting",
    featured: false,
    phases:[
      {name:"Project Preparation", description:"Project setup, standards, initial planning", order:0, durationWeeks:4,
        tasks:[
          {title:"Project scope & charter", estimatedHours:40, priority:"HIGH", role:"PROJECT_MANAGER"},
          {title:"System landscape design", estimatedHours:60, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Data migration strategy", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Project kickoff", weekOffset:4}]
      },
      {name:"Blueprint", description:"Business process workshops, gap analysis, solution design", order:1, durationWeeks:10,
        tasks:[
          {title:"Business process workshops", estimatedHours:200, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Gap / fit analysis", estimatedHours:80, priority:"HIGH", role:"PROJECT_MANAGER"},
          {title:"Solution design document", estimatedHours:120, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Custom development spec", estimatedHours:60, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Blueprint sign-off", weekOffset:10}]
      },
      {name:"Realization", description:"Configuration, development, unit testing", order:2, durationWeeks:16,
        tasks:[
          {title:"System configuration", estimatedHours:400, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Custom development", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Data migration development", estimatedHours:160, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Integration development", estimatedHours:120, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Unit testing", estimatedHours:100, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Realization complete", weekOffset:16}]
      },
      {name:"Final Preparation", description:"SIT, UAT, training, cutover preparation", order:3, durationWeeks:8,
        tasks:[
          {title:"System integration testing", estimatedHours:160, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"User acceptance testing", estimatedHours:120, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"End-user training", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Cutover plan & rehearsal", estimatedHours:60, priority:"CRITICAL", role:"PROJECT_MANAGER"},
        ],
        milestones:[{name:"Go/No-Go decision", weekOffset:8}]
      },
      {name:"Go-Live & Hypercare", description:"Production cutover, stabilization, hypercare support", order:4, durationWeeks:2,
        tasks:[
          {title:"Data migration cutover", estimatedHours:40, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Go-live cutover", estimatedHours:20, priority:"CRITICAL", role:"PROJECT_MANAGER"},
          {title:"Hypercare support (30 days)", estimatedHours:120, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Go-live", weekOffset:1},{name:"Hypercare complete", weekOffset:2}]
      },
    ],
    riskCategories:[
      {name:"Data quality", examples:["Legacy data cleansing","Migration errors"]},
      {name:"Change management", examples:["User adoption","Process resistance"]},
      {name:"Integration", examples:["Third-party connector failures","API changes"]},
    ],
    documentTypes:["Business Blueprint","Solution Design","Test Scripts","Training Materials","Cutover Plan","Hypercare Report"],
  },
  {
    id: "manufacturing-npi",
    name: "Manufacturing NPI (New Product Introduction)",
    description: "Stage-gate new product introduction from concept through DFM, tooling, PPAP, and ramp to full production — with gate reviews, ECOs, quality gates, and unit-cost tracking.",
    longDescription: "A comprehensive stage-gate NPI template for launching a new product or production line, modeled as Waterfall so phase gates, baselines, and change control apply. Covers concept & feasibility, design & DFM, prototype/validation, tooling & capital equipment, pilot run, PPAP & validation, ramp-up, and production handover. Pre-loaded with stage-gate reviews (Gate 0–3), DFMEA/PFMEA, control plans, requirements traceability, an ECO log, a PPAP package, capex and unit-cost tracking, domain risk categories, and suggested cross-functional roles (process engineering, quality, supply chain, operations).",
    methodology: "WATERFALL",
    difficulty: "Advanced",
    estimatedWeeks: 52,
    industry: "Manufacturing",
    category: "Manufacturing",
    icon: "🏭",
    color: "#0F766E",
    teamSize: "10-25 people",
    tags: ["Manufacturing","NPI","Stage-Gate","PPAP","ECO","DFM"],
    isPremium: true,
    price: 9900,
    usageCount: 0,
    rating: 0,
    ratingCount: 0,
    author: "FlowSync PM",
    featured: true,
    phases:[
      { name:"Concept & Feasibility", description:"Requirements, VOC, business case, Gate 0", order:0, durationWeeks:4,
        tasks:[
          {title:"Define product concept & requirements", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Voice-of-customer & market analysis", estimatedHours:32, priority:"HIGH", role:"PM"},
          {title:"Business case & unit-cost target", estimatedHours:32, priority:"HIGH", role:"PM"},
          {title:"Feasibility & technology assessment", estimatedHours:40, priority:"HIGH", role:"Design Engineer"},
          {title:"Form cross-functional team (PE/Quality/Supply Chain/Ops)", estimatedHours:16, priority:"HIGH", role:"PM"},
          {title:"Gate 0 review — concept approval", estimatedHours:8, priority:"CRITICAL", role:"PM"},
        ],
        milestones:[{name:"Gate 0 — Concept approved", weekOffset:4}] },
      { name:"Design & DFM", description:"Design, DFM, DFMEA, RTM, BOM, Gate 1", order:1, durationWeeks:8,
        tasks:[
          {title:"Detailed product design", estimatedHours:160, priority:"CRITICAL", role:"Design Engineer"},
          {title:"Design for Manufacturability (DFM) review", estimatedHours:40, priority:"HIGH", role:"Process Engineer"},
          {title:"DFMEA (design FMEA)", estimatedHours:40, priority:"HIGH", role:"Quality"},
          {title:"Requirements traceability matrix", estimatedHours:24, priority:"MEDIUM", role:"Quality"},
          {title:"Material & component selection", estimatedHours:40, priority:"HIGH", role:"Supply Chain"},
          {title:"Bill of Materials (BOM) release", estimatedHours:24, priority:"HIGH", role:"Design Engineer"},
          {title:"Gate 1 review — design freeze", estimatedHours:8, priority:"CRITICAL", role:"PM"},
        ],
        milestones:[{name:"Design freeze / BOM released", weekOffset:6},{name:"Gate 1 — Design approved", weekOffset:8}] },
      { name:"Prototype & Validation Build", description:"Prototype, DVT, ECOs, supplier parts", order:2, durationWeeks:6,
        tasks:[
          {title:"Prototype build", estimatedHours:120, priority:"HIGH", role:"Process Engineer"},
          {title:"Design verification testing (DVT)", estimatedHours:80, priority:"CRITICAL", role:"Quality"},
          {title:"Process engineering change orders (ECOs)", estimatedHours:40, priority:"HIGH", role:"Design Engineer"},
          {title:"Test & measurement setup", estimatedHours:40, priority:"MEDIUM", role:"Quality"},
          {title:"Supplier prototype parts qualification", estimatedHours:40, priority:"HIGH", role:"Supply Chain"},
        ],
        milestones:[{name:"Prototype validated (DVT complete)", weekOffset:6}] },
      { name:"Tooling & Equipment", description:"Tooling, capex, fixtures, layout, PFMEA", order:3, durationWeeks:10,
        tasks:[
          {title:"Tooling design & fabrication", estimatedHours:200, priority:"CRITICAL", role:"Process Engineer"},
          {title:"Capital equipment procurement (capex)", estimatedHours:80, priority:"CRITICAL", role:"Supply Chain"},
          {title:"Fixture & gauge design", estimatedHours:60, priority:"HIGH", role:"Process Engineer"},
          {title:"Process flow & line layout design", estimatedHours:60, priority:"HIGH", role:"Process Engineer"},
          {title:"Tooling tryout (T0/T1 samples)", estimatedHours:80, priority:"HIGH", role:"Process Engineer"},
          {title:"PFMEA (process FMEA)", estimatedHours:40, priority:"HIGH", role:"Quality"},
        ],
        milestones:[{name:"Tooling complete / T1 samples", weekOffset:10}] },
      { name:"Pilot Run", description:"Pilot, Cpk, control plan, training, Gate 2", order:4, durationWeeks:5,
        tasks:[
          {title:"Pilot production run", estimatedHours:80, priority:"HIGH", role:"Operations"},
          {title:"Process capability study (Cpk)", estimatedHours:40, priority:"CRITICAL", role:"Quality"},
          {title:"Control plan development", estimatedHours:32, priority:"HIGH", role:"Quality"},
          {title:"Operator work instructions & training", estimatedHours:40, priority:"MEDIUM", role:"Operations"},
          {title:"First-pass yield analysis", estimatedHours:32, priority:"HIGH", role:"Quality"},
          {title:"Gate 2 review — pilot approval", estimatedHours:8, priority:"CRITICAL", role:"PM"},
        ],
        milestones:[{name:"Pilot run complete", weekOffset:4},{name:"Gate 2 — Pilot approved", weekOffset:5}] },
      { name:"PPAP & Validation", description:"PPAP, run-at-rate, MSA, quality gate", order:5, durationWeeks:5,
        tasks:[
          {title:"Production Part Approval Process (PPAP) submission", estimatedHours:60, priority:"CRITICAL", role:"Quality"},
          {title:"Run-at-rate / capacity validation", estimatedHours:40, priority:"HIGH", role:"Operations"},
          {title:"Measurement system analysis (MSA) & Gauge R&R", estimatedHours:32, priority:"HIGH", role:"Quality"},
          {title:"Supplier PPAP collection & approval", estimatedHours:40, priority:"HIGH", role:"Supply Chain"},
          {title:"Quality gate review & sign-off", estimatedHours:16, priority:"CRITICAL", role:"Quality"},
        ],
        milestones:[{name:"PPAP approved", weekOffset:5}] },
      { name:"Ramp-Up", description:"Ramp plan, yield/OEE, cost, Gate 3", order:6, durationWeeks:8,
        tasks:[
          {title:"Production ramp plan", estimatedHours:32, priority:"HIGH", role:"Operations"},
          {title:"Yield & OEE improvement", estimatedHours:60, priority:"HIGH", role:"Process Engineer"},
          {title:"Supply chain scale-up", estimatedHours:40, priority:"HIGH", role:"Supply Chain"},
          {title:"Cost reduction & unit-cost verification", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Line balancing & bottleneck resolution", estimatedHours:40, priority:"MEDIUM", role:"Process Engineer"},
          {title:"Gate 3 review — launch readiness", estimatedHours:8, priority:"CRITICAL", role:"PM"},
        ],
        milestones:[{name:"Ramp to target rate", weekOffset:6},{name:"Gate 3 — Launch approved", weekOffset:8}] },
      { name:"Production & Handover", description:"SOP launch, handover, FMEA update, closeout", order:7, durationWeeks:6,
        tasks:[
          {title:"Full-rate production launch (SOP)", estimatedHours:40, priority:"CRITICAL", role:"Operations"},
          {title:"Handover to operations", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Update DFMEA/PFMEA & lessons learned", estimatedHours:24, priority:"MEDIUM", role:"Quality"},
          {title:"Continuous improvement plan (Kaizen)", estimatedHours:24, priority:"MEDIUM", role:"Process Engineer"},
          {title:"Warranty & field-quality monitoring setup", estimatedHours:24, priority:"MEDIUM", role:"Quality"},
          {title:"Project closeout", estimatedHours:16, priority:"MEDIUM", role:"PM"},
        ],
        milestones:[{name:"Production launch / SOP", weekOffset:4},{name:"Project closeout", weekOffset:6}] },
    ],
    riskCategories:[
      {name:"Supplier & lead time", probability:"HIGH", impact:"MAJOR", examples:["Long-lead tooling and equipment delays","Supplier PPAP failures","Component shortages"]},
      {name:"Yield & quality", probability:"MEDIUM", impact:"MAJOR", examples:["Low first-pass yield","Cpk below target","PPAP rejections"]},
      {name:"Capacity & ramp", probability:"MEDIUM", impact:"MODERATE", examples:["Capacity constraints","Line bottlenecks","Ramp slower than plan"]},
      {name:"Equipment & tooling", probability:"MEDIUM", impact:"MAJOR", examples:["Tooling tryout issues","Equipment downtime","Fixture and gauge accuracy"]},
      {name:"Cost", probability:"HIGH", impact:"MODERATE", examples:["Capital (capex) overrun","Unit cost above target","Scrap and rework cost"]},
    ],
    documentTypes:["Product Requirements","Business Case","DFMEA","PFMEA","Control Plan","Requirements Traceability Matrix","Bill of Materials (BOM)","ECO Log","PPAP Package","Process Capability Report (Cpk)","Gate Review Decks","Launch / SOP Package"],
  },

  {
    id: "professional-services",
    name: "Client Engagement Delivery",
    description: "End-to-end delivery of a professional services or consulting engagement.",
    longDescription: "A structured engagement lifecycle from kickoff through discovery, solution design, delivery, client acceptance, and closeout with knowledge transfer. Includes governance, status reporting, and deliverable acceptance gates.",
    methodology: "WATERFALL",
    difficulty: "Intermediate",
    estimatedWeeks: 16,
    industry: "Professional Services",
    category: "Professional Services",
    icon: "\ud83e\udd1d",
    color: "#7C3AED",
    teamSize: "4-10",
    tags: ["Consulting","Client Delivery","Engagement","Advisory","Professional Services"],
    isPremium: true,
    price: 4900,
    usageCount: 0,
    rating: 4.7,
    ratingCount: 0,
    author: "FlowSync PM",
    featured: true,
    phases:[
      { name:"Engagement Setup", description:"Kickoff, confirm scope, mobilise the team, stand up governance", order:0, durationWeeks:2,
        tasks:[
          {title:"Engagement kickoff & alignment", estimatedHours:16, priority:"HIGH", role:"PM"},
          {title:"Confirm scope, objectives & success criteria", estimatedHours:16, priority:"CRITICAL", role:"PM"},
          {title:"Mobilise team & set up governance/cadence", estimatedHours:12, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Engagement kicked off", weekOffset:2}]},
      { name:"Discovery & Assessment", description:"Interviews, current-state analysis, data gathering, findings", order:1, durationWeeks:3,
        tasks:[
          {title:"Stakeholder interviews & workshops", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Current-state analysis & data gathering", estimatedHours:48, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Synthesise findings & gaps", estimatedHours:24, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Discovery findings accepted", weekOffset:3}]},
      { name:"Solution Design", description:"Recommendations, target design, roadmap, business case", order:2, durationWeeks:3,
        tasks:[
          {title:"Design recommendations & target state", estimatedHours:48, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Implementation roadmap & business case", estimatedHours:32, priority:"HIGH", role:"PM"},
          {title:"Design review & client sign-off", estimatedHours:16, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Solution design approved", weekOffset:3}]},
      { name:"Delivery & Implementation", description:"Execute workstreams, build deliverables, client working sessions", order:3, durationWeeks:5,
        tasks:[
          {title:"Execute delivery workstreams", estimatedHours:200, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Produce engagement deliverables", estimatedHours:120, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Client working sessions & iteration", estimatedHours:48, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Core deliverables complete", weekOffset:5}]},
      { name:"Validation & Acceptance", description:"Client review, refinement, formal acceptance", order:4, durationWeeks:2,
        tasks:[
          {title:"Client review & feedback", estimatedHours:24, priority:"HIGH", role:"PM"},
          {title:"Refine deliverables to acceptance", estimatedHours:40, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Formal deliverable acceptance & sign-off", estimatedHours:12, priority:"CRITICAL", role:"PM"},
        ],
        milestones:[{name:"Client acceptance obtained", weekOffset:2}]},
      { name:"Closeout & Knowledge Transfer", description:"Handover, knowledge transfer, lessons, final report", order:5, durationWeeks:1,
        tasks:[
          {title:"Knowledge transfer & handover", estimatedHours:24, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Final report & recommendations", estimatedHours:16, priority:"HIGH", role:"PM"},
          {title:"Lessons learned & engagement closure", estimatedHours:8, priority:"MEDIUM", role:"PM"},
        ],
        milestones:[{name:"Engagement closed", weekOffset:1}]},
    ],
    riskCategories:[
      {name:"Scope & expectations", probability:"HIGH", impact:"MAJOR", examples:["Scope creep beyond the SOW","Unclear or shifting success criteria"]},
      {name:"Client availability", probability:"MEDIUM", impact:"MAJOR", examples:["Limited stakeholder access","Decision or approval delays"]},
      {name:"Data & access", probability:"MEDIUM", impact:"MODERATE", examples:["Missing or poor-quality data","Delayed system or site access"]},
      {name:"Change adoption", probability:"MEDIUM", impact:"MODERATE", examples:["Stakeholder resistance","Low adoption of recommendations"]},
      {name:"Commercial", probability:"MEDIUM", impact:"MODERATE", examples:["Scope-versus-fee pressure","Unmanaged change orders"]},
    ],
    documentTypes:["Statement of Work (SOW)","Engagement Plan","Discovery Findings","Solution Design","Status Report","Deliverable Acceptance","Final Report","Knowledge Transfer Pack"],
  },

  {
    id: "hybrid-delivery",
    name: "Hybrid Delivery Program",
    description: "Phased governance with an agile build \u2014 waterfall gates around iterative sprints.",
    longDescription: "Combines formal initiation, design, testing, and go-live gates with an agile build delivered in sprints. Ideal when enterprise governance and change control must wrap around iterative delivery.",
    methodology: "HYBRID",
    difficulty: "Advanced",
    estimatedWeeks: 24,
    industry: "IT",
    category: "Hybrid Delivery",
    icon: "\ud83d\udd00",
    color: "#0891B2",
    teamSize: "8-15",
    tags: ["Hybrid","Governance","Agile","Waterfall","Sprints"],
    isPremium: true,
    price: 4900,
    usageCount: 0,
    rating: 4.8,
    ratingCount: 0,
    author: "FlowSync PM",
    featured: true,
    phases:[
      { name:"Initiation & Planning", description:"Charter, scope, roadmap, governance setup (gate)", order:0, durationWeeks:3,
        tasks:[
          {title:"Project charter & business case", estimatedHours:24, priority:"CRITICAL", role:"PM"},
          {title:"Scope, roadmap & release plan", estimatedHours:32, priority:"HIGH", role:"PM"},
          {title:"Governance, RAID & cadence setup", estimatedHours:16, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Charter approved (Gate 1)", weekOffset:3}]},
      { name:"Solution Design", description:"Architecture, product backlog, design baseline (gate)", order:1, durationWeeks:4,
        tasks:[
          {title:"Solution architecture & design", estimatedHours:80, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"Product backlog & story mapping", estimatedHours:48, priority:"HIGH", role:"PRODUCT_OWNER"},
          {title:"Design baseline review & sign-off", estimatedHours:16, priority:"HIGH", role:"PM"},
        ],
        milestones:[{name:"Design baseline approved (Gate 2)", weekOffset:4}]},
      { name:"Sprints 1-2 (Build)", description:"Iterative delivery of the core increment", order:2, durationWeeks:6,
        tasks:[
          {title:"Sprint 1 \u2014 core features", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Sprint 2 \u2014 core features", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Increment 1 demo & review", estimatedHours:24, priority:"MEDIUM", role:"SCRUM_MASTER"},
        ],
        milestones:[{name:"Increment 1 accepted", weekOffset:6}]},
      { name:"Sprints 3-4 (Build)", description:"Iterative delivery to feature-complete", order:3, durationWeeks:6,
        tasks:[
          {title:"Sprint 3 \u2014 extended features", estimatedHours:200, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Sprint 4 \u2014 hardening & polish", estimatedHours:160, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Feature-complete demo & review", estimatedHours:24, priority:"MEDIUM", role:"SCRUM_MASTER"},
        ],
        milestones:[{name:"Feature complete", weekOffset:6}]},
      { name:"System Testing & UAT", description:"Integration testing, UAT, acceptance (gate)", order:4, durationWeeks:3,
        tasks:[
          {title:"System integration testing", estimatedHours:80, priority:"CRITICAL", role:"TEAM_MEMBER"},
          {title:"User acceptance testing", estimatedHours:120, priority:"CRITICAL", role:"PM"},
          {title:"Defect triage & fixes", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"UAT sign-off (Gate 3)", weekOffset:3}]},
      { name:"Go-live & Handover", description:"Cutover, training, stabilization (gate)", order:5, durationWeeks:2,
        tasks:[
          {title:"Cutover & go-live", estimatedHours:40, priority:"CRITICAL", role:"PM"},
          {title:"Training & knowledge transfer", estimatedHours:60, priority:"HIGH", role:"TEAM_MEMBER"},
          {title:"Hypercare & stabilization", estimatedHours:80, priority:"HIGH", role:"TEAM_MEMBER"},
        ],
        milestones:[{name:"Go-live (Gate 4)", weekOffset:2}]},
    ],
    riskCategories:[
      {name:"Governance vs agility", probability:"HIGH", impact:"MODERATE", examples:["Gate reviews stalling sprint flow","Change-control overhead"]},
      {name:"Scope & backlog", probability:"HIGH", impact:"MAJOR", examples:["Backlog churn","Scope creep across increments"]},
      {name:"Integration", probability:"MEDIUM", impact:"MAJOR", examples:["Late integration issues","Environment readiness"]},
      {name:"Resource availability", probability:"MEDIUM", impact:"MODERATE", examples:["Shared team across sprints","Key SME turnover"]},
      {name:"Adoption", probability:"MEDIUM", impact:"MODERATE", examples:["Change resistance","Training gaps"]},
    ],
    documentTypes:["Project Charter","Roadmap & Release Plan","Solution Design","Product Backlog","Sprint Review Notes","Test & UAT Report","Cutover Plan","Go-Live Runbook"],
  },
]

export const TEMPLATE_CATEGORIES = [
  { id:"all",          label:"All templates",   icon:"⭐" },
  { id:"featured",     label:"Featured",         icon:"🌟" },
  { id:"IT",           label:"IT & Technology",  icon:"💻" },
  { id:"Technology",   label:"Software",         icon:"🚀" },
  { id:"Construction", label:"Construction",     icon:"🏗" },
  { id:"Manufacturing", label:"Manufacturing",     icon:"🏭" },
  { id:"Finance",      label:"Finance",          icon:"💼" },
  { id:"Operations",   label:"Operations",       icon:"⚙️" },
]

export const METHODOLOGY_FILTERS = [
  { id:"all",       label:"All methodologies" },
  { id:"WATERFALL", label:"Waterfall" },
  { id:"AGILE",     label:"Agile" },
  { id:"SCRUM",     label:"Scrum" },
]

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATE_LIBRARY.find(t => t.id === id)
}

export function filterTemplates(opts: {
  industry?:    string
  methodology?: string
  isPremium?:   boolean
  search?:      string
  featured?:    boolean
}): TemplateDefinition[] {
  return TEMPLATE_LIBRARY.filter(t => {
    if (opts.industry && opts.industry !== "all" && opts.industry !== "featured" && t.industry !== opts.industry) return false
    if (opts.industry === "featured" && !t.featured) return false
    if (opts.methodology && opts.methodology !== "all" && t.methodology !== opts.methodology) return false
    if (opts.isPremium !== undefined && t.isPremium !== opts.isPremium) return false
    if (opts.featured !== undefined && t.featured !== opts.featured) return false
    if (opts.search) {
      const q = opts.search.toLowerCase()
      return t.name.toLowerCase().includes(q)
          || t.description.toLowerCase().includes(q)
          || t.tags.some(tag => tag.toLowerCase().includes(q))
    }
    return true
  })
}
