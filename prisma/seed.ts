// prisma/seed.ts — FlowSync PM demo seed
// Clean slate: wipes ALL data, then creates one user per role and one fully
// populated project per methodology (Waterfall / Agile / Scrum).
// Run: npx tsx prisma/seed.ts   (or: npm run db:seed)

import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const db = new PrismaClient()

const PWD_PLAIN = "Demo@FlowSync2026"

// ── One user per workspace role ────────────────────────────────────────────
const USERS = [
  { email:"super@demo.flowsyncpm.com",   name:"Sam Okafor",     title:"Platform Administrator",  role:"SUPER_ADMIN" },
  { email:"owner@demo.flowsyncpm.com",   name:"Olivia Bennett", title:"Founder & Owner",         role:"OWNER" },
  { email:"admin@demo.flowsyncpm.com",   name:"Aaron Cole",     title:"Workspace Administrator", role:"ADMIN" },
  { email:"pmo@demo.flowsyncpm.com",     name:"Lisa Chen",      title:"PMO Director",            role:"PMO_DIRECTOR" },
  { email:"exec@demo.flowsyncpm.com",    name:"Carlos Rivera",  title:"VP Operations",           role:"EXECUTIVE" },
  { email:"program@demo.flowsyncpm.com", name:"Priya Nair",     title:"Program Manager",         role:"PROGRAM_MANAGER" },
  { email:"pm@demo.flowsyncpm.com",      name:"Alex Johnson",   title:"Project Manager",         role:"PM" },
  { email:"member@demo.flowsyncpm.com",  name:"James Miller",   title:"Senior Engineer",         role:"MEMBER" },
  { email:"viewer@demo.flowsyncpm.com",  name:"Vera Lang",      title:"Auditor / Observer",      role:"VIEWER" },
  { email:"client@demo.flowsyncpm.com",  name:"Chris Dubois",   title:"Client Stakeholder",      role:"CLIENT" },
]
const E = (k:string) => `${k}@demo.flowsyncpm.com`

// Standard project team (maps role-users onto governance/project roles).
const BASE_TEAM = [
  { email:E("pm"),      role:"PM",     projectRole:"PM",                allocation:100 },
  { email:E("owner"),   role:"ADMIN",  projectRole:"EXECUTIVE_SPONSOR", allocation:5   },
  { email:E("exec"),    role:"VIEWER", projectRole:"SPONSOR",           allocation:10  },
  { email:E("pmo"),     role:"MEMBER", projectRole:"PMO",               allocation:50  },
  { email:E("program"), role:"MEMBER", projectRole:"PROGRAM_MANAGER",   allocation:30  },
  { email:E("admin"),   role:"ADMIN",  projectRole:"TECH_LEAD",         allocation:40  },
  { email:E("member"),  role:"MEMBER", projectRole:"TEAM_MEMBER",       allocation:100 },
  { email:E("viewer"),  role:"VIEWER", projectRole:"AUDITOR",           allocation:5   },
  { email:E("client"),  role:"CLIENT", projectRole:"CLIENT",            allocation:15  },
]
// Agile/Scrum flavour: add Product Owner + Scrum Master.
const AGILE_TEAM = BASE_TEAM.map(m =>
  m.email===E("exec")    ? { ...m, projectRole:"PRODUCT_OWNER" } :
  m.email===E("program") ? { ...m, projectRole:"SCRUM_MASTER" }  : m)

const D = (s:string) => new Date(s + "T00:00:00Z")

// Sample skills per role-user (for the Skills matrix)
const SKILLS: Record<string,string[]> = {
  owner:   ["Leadership","Finance","Strategy"],
  admin:   ["Architecture","Security","DevOps","Code Review"],
  pmo:     ["Governance","Portfolio Management","Reporting","PM Standards"],
  exec:    ["Strategy","Operations"],
  program: ["Program Management","Dependency Management","Roadmapping"],
  pm:      ["Project Management","Stakeholder Management","Risk Management","Agile"],
  member:  ["TypeScript","React","Node.js","PostgreSQL","CI/CD"],
}

// ── Wipe every application table (true clean slate) ────────────────────────
async function wipe() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (rows.length) {
    const list = rows.map(r => `"${r.tablename}"`).join(", ")
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  }
  console.log(`🧹 Wiped ${rows.length} tables`)
}

// ── Fully populate one project ─────────────────────────────────────────────
async function seedProject(users: Record<string,any>, workspace: any, cfg: any) {
  const u = (k:string) => users[E(k)]
  const pm = u("pm"), owner = u("owner"), exec = u("exec"), pmo = u("pmo"),
        admin = u("admin"), member = u("member"), analyst = u("member")

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id, createdById: pm.id,
      code: cfg.code, name: cfg.name, description: cfg.description,
      objective: cfg.objective, scope: cfg.scope, outOfScope: cfg.outOfScope,
      background: cfg.background, assumptions: cfg.assumptions,
      constraints: cfg.constraints, economicImpact: cfg.economicImpact,
      methodology: cfg.methodology as any, priority: cfg.priority as any,
      isConfidential: false, status: cfg.status as any, health: cfg.health as any,
      startDate: D(cfg.start), endDate: D(cfg.end),
      budgetTotal: cfg.budgetTotal, budgetSpent: cfg.budgetSpent,
      currency: "USD", percentComplete: cfg.pct,
    },
  })

  // Members
  for (const m of cfg.team) {
    await db.projectMember.create({
      data: { projectId: project.id, userId: users[m.email].id,
        role: m.role as any, projectRole: m.projectRole as any, allocation: m.allocation },
    })
  }

  // Phases
  const phases: any[] = []
  for (let i=0; i<cfg.phases.length; i++) {
    const p = await db.phase.create({
      data: { projectId: project.id, name: cfg.phases[i].name, order: i, status: cfg.phases[i].status as any },
    })
    phases.push(p)
  }

  // Tasks
  const createdTasks: any[] = []
  for (let i=0; i<cfg.tasks.length; i++) {
    const t = cfg.tasks[i]
    const created = await db.task.create({
      data: {
        projectId: project.id, phaseId: phases[t.p]?.id || null,
        code: `T-${String(i+1).padStart(3,"0")}`, title: t.title,
        status: t.s as any, priority: t.pr as any, percentComplete: t.pct, sortOrder: i,
        startDate: D(t.start), dueDate: D(t.due), ownerId: pm.id,
        ...(t.s==="DONE" && { completedAt: D(t.due) }),
      },
    })
    createdTasks.push({ id: created.id, phaseIdx: t.p, start: t.start, due: t.due })
  }

  // Task dependencies — tasks within a phase run in parallel; each phase is driven by
  // the previous phase's longest ("anchor") task. The chain of anchors forms a clean
  // critical path, leaving the shorter parallel tasks off it.
  const durMs = (x:any) => new Date(x.due).getTime() - new Date(x.start).getTime()
  const byPhase: Record<number, any[]> = {}
  for (const t of createdTasks) (byPhase[t.phaseIdx] = byPhase[t.phaseIdx] || []).push(t)
  const phaseIdxs = Object.keys(byPhase).map(Number).sort((a,b)=>a-b)
  const taskDeps: any[] = []
  for (let k=1; k<phaseIdxs.length; k++) {
    const prev = byPhase[phaseIdxs[k-1]]
    const anchor = prev.reduce((a,b)=> durMs(b) > durMs(a) ? b : a)
    for (const t of byPhase[phaseIdxs[k]]) {
      taskDeps.push({ dependentTaskId: t.id, precedingTaskId: anchor.id, dependencyType:"FS", lagDays:0 })
    }
  }
  if (taskDeps.length) await db.taskDependency.createMany({ data: taskDeps })

  // Milestones
  await db.milestone.createMany({ data: cfg.milestones.map((m:any) => ({
    projectId: project.id, name: m.name, dueDate: D(m.due), status: m.st as any, color: m.color,
    ...(m.achieved && { achievedAt: D(m.achieved) }),
  })) })

  // Risks
  await db.risk.createMany({ data: cfg.risks.map((r:any) => ({
    projectId: project.id, code: r.code, title: r.title, category: r.cat,
    probability: r.prob as any, impact: r.imp as any, score: r.score, status: "OPEN" as any,
    isOpportunity: !!r.opp, responseType: r.resp as any, ownerId: pm.id, mitigationPlan: r.plan,
  })) })

  // Budget
  const spent = cfg.budgetSpent
  await db.budgetItem.createMany({ data: [
    { projectId: project.id, category:"LABOR" as any,      name:"Delivery team",       plannedCost: Math.round(cfg.budgetTotal*0.6), actualCost: Math.round(spent*0.62), earnedValue: Math.round(spent*0.58), currency:"USD" },
    { projectId: project.id, category:"SOFTWARE" as any,   name:"Licenses & tooling",  plannedCost: Math.round(cfg.budgetTotal*0.15), actualCost: Math.round(spent*0.16), earnedValue: Math.round(spent*0.16), currency:"USD" },
    { projectId: project.id, category:"CONSULTING" as any, name:"External expertise",  plannedCost: Math.round(cfg.budgetTotal*0.12), actualCost: Math.round(spent*0.12), earnedValue: Math.round(spent*0.10), currency:"USD" },
    { projectId: project.id, category:"EQUIPMENT" as any,  name:"Infrastructure",      plannedCost: Math.round(cfg.budgetTotal*0.08), actualCost: Math.round(spent*0.07), earnedValue: Math.round(spent*0.07), currency:"USD" },
    { projectId: project.id, category:"OTHER" as any,      name:"Training & misc",     plannedCost: Math.round(cfg.budgetTotal*0.05), actualCost: Math.round(spent*0.03), earnedValue: Math.round(spent*0.03), currency:"USD" },
  ] })

  // Issues
  await db.issue.createMany({ data: [
    { projectId: project.id, code:"ISS-001", title:`Integration dependency blocking ${cfg.name}`,
      category:"Technical", priority:"HIGH" as any, status:"IN_PROGRESS" as any, raisedById: member.id, ownerId: member.id,
      description:"A required external dependency is incomplete, blocking a portion of the delivery work.",
      impact:"Estimated 1–2 week delay to the affected workstream if not resolved this sprint/phase." },
    { projectId: project.id, code:"ISS-002", title:"Test environment provisioning delayed",
      category:"Environment", priority:"MEDIUM" as any, status:"OPEN" as any, raisedById: pm.id, ownerId: pmo.id,
      description:"The dedicated test environment request is still pending with infrastructure.",
      impact:"May compress the testing window if not delivered on schedule." },
  ] })

  // Decisions
  await db.decision.createMany({ data: [
    { projectId: project.id, code:"DEC-001", title:`Adopt ${cfg.methodology} delivery approach`,
      madeById: pm.id, madeAt: D(cfg.start),
      description:`The project will be delivered using a ${cfg.methodology.toLowerCase()} approach.`,
      rationale: cfg.methodChoice, alternatives:"Alternative methodologies were evaluated and documented in the selection matrix.",
      impact:"Sets the cadence for planning, reviews, and stakeholder sign-off." },
    { projectId: project.id, code:"DEC-002", title:"Phased rollout over single cutover",
      madeById: exec.id, madeAt: D(cfg.start),
      description:"Delivery will roll out incrementally rather than in a single big-bang release.",
      rationale:"Reduces risk, surfaces issues earlier, and improves change adoption.",
      alternatives:"A single cutover was considered but rejected due to concentration of risk.",
      impact:"Slightly longer timeline, materially lower delivery risk." },
  ] })

  // Lessons
  await db.lessonLearned.createMany({ data: [
    { projectId: project.id, createdById: pm.id, title:"Early dependency engagement prevents delays",
      category:"PLANNING" as any, phase: cfg.phases[0].name, impact:"NEGATIVE" as any,
      situation:"A dependency engaged late in planning caused avoidable rework and a short delay.",
      lesson:"Engage external and cross-team dependencies during planning, not delivery.",
      recommendation:"Add a dependency-readiness checkpoint to the planning phase for every project." },
    { projectId: project.id, createdById: analyst.id, title:"Structured stakeholder cadence improved clarity",
      category:"STAKEHOLDER" as any, phase: cfg.phases[0].name, impact:"POSITIVE" as any,
      situation:"A predictable review cadence with the right people present produced clearer decisions.",
      lesson:"A fixed cadence with clear inputs beats ad-hoc sync meetings.",
      recommendation:"Standardise the review cadence and pre-work templates across the portfolio." },
  ] })

  // Benefits
  await db.benefit.createMany({ data: [
    { projectId: project.id, title:"Operational efficiency gain", category:"Operational", status:"PROJECTED" as any,
      projectedValue: cfg.benefit, ownerId: exec.id, measureBy: D(cfg.end),
      description:"Efficiency improvement expected once the solution is fully adopted." },
    { projectId: project.id, title:"Improved stakeholder/customer experience", category:"Customer", status:"TRACKING" as any,
      projectedValue:"Measurable improvement in satisfaction and response times",
      actualValue:"Early pilot signal is positive", ownerId: pm.id, measureBy: D(cfg.end),
      description:"Better experience for the people the deliverable serves." },
  ] })

  // Communication plan
  await db.commPlanEntry.createMany({ data: [
    { projectId: project.id, stakeholderName: owner.name, role:"Executive Sponsor",
      information:"Health, budget, risks, milestones", format:"Status Report", frequency:"Weekly", method:"Email", ownerId: pm.id },
    { projectId: project.id, stakeholderName: exec.name, role:"Sponsor",
      information:"Progress, decisions, budget variance", format:"Presentation", frequency:"Monthly", method:"Video call", ownerId: pm.id },
    { projectId: project.id, stakeholderName:"Delivery Team", role:"Core Team",
      information:"Assignments, blockers, priorities", format:"Chat", frequency:"Daily", method:"Team channel", ownerId: pm.id },
    { projectId: project.id, stakeholderName: users[E("client")].name, role:"Client",
      information:"Demos, acceptance, release notes", format:"Email", frequency:"On milestone", method:"Email", ownerId: pm.id },
  ] })

  // Change requests
  await db.changeRequest.createMany({ data: [
    { projectId: project.id, code:"CR-001", title:"Additional reporting view requested",
      priority:"MEDIUM" as any, status:"APPROVED" as any, requestedById: exec.id, approvedById: pm.id, approvedAt: D(cfg.start),
      description:"Stakeholders requested an additional reporting view not in the original scope.",
      scheduleImpact:"+1 week", budgetImpact: Math.round(cfg.budgetTotal*0.03),
      scopeImpact:"Minor additional build and test effort." },
    { projectId: project.id, code:"CR-002", title:"Extra integration with an internal system",
      priority:"HIGH" as any, status:"UNDER_REVIEW" as any, requestedById: analyst.id,
      description:"A newly identified internal integration would add value but expands scope.",
      scheduleImpact:"+3 weeks", budgetImpact: Math.round(cfg.budgetTotal*0.08),
      scopeImpact:"Significant additional integration and testing.",
      qualityImpact:"Requires extra data-integrity validation." },
  ] })

  // Status update
  await db.statusUpdate.create({ data: {
    projectId: project.id, type:"WEEKLY_STATUS" as any, health: cfg.health as any,
    periodStart: D("2026-06-23"), periodEnd: D("2026-06-29"),
    percentComplete: cfg.pct, aiGenerated: false, createdById: pm.id,
    summary: `${cfg.name} is progressing. Overall completion is at ${cfg.pct}% and health is ${cfg.health}. Budget is tracking within forecast; the open integration item (ISS-001) is being actively worked.`,
    accomplishments:"• Closed the majority of this period's planned work\n• Held stakeholder review with positive feedback\n• Updated the risk register",
    nextSteps:"• Resolve the open integration dependency\n• Prepare the next milestone review\n• Begin scoping the following workstream",
    risks:"ISS-001 (integration dependency) is the main risk to the next milestone. Mitigation in progress.",
    issues:"Test environment provisioning (ISS-002) still pending infrastructure.",
  } })

  // Baseline
  // Baseline — captures the original plan per task. Early phases finished on plan;
  // later phases (Build onward) were originally planned ~2 weeks earlier, so the
  // current bars show a visible slip against the baseline ghost bars in the Gantt.
  const shiftISO = (dstr:string, days:number) => { const d = new Date(dstr+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+days); return d.toISOString() }
  await db.baseline.create({ data: {
    projectId: project.id, name:`Original Baseline — ${cfg.name}`, createdById: pm.id,
    snapshotData: {
      capturedAt: D(cfg.start).toISOString(),
      schedule: { start: cfg.start, end: cfg.end },
      budget: { total: cfg.budgetTotal },
      tasks: createdTasks.map(t => {
        const slip = t.phaseIdx >= 2 ? -14 : 0
        return { id: t.id, startDate: shiftISO(t.start, slip), dueDate: shiftISO(t.due, slip) }
      }),
    },
    budgetTotal: cfg.budgetTotal, startDate: D(cfg.start), endDate: D(cfg.end),
  } })

  // Procurement
  await db.procurementItem.createMany({ data: [
    { projectId: project.id, vendorName:"Northwind Solutions", vendorContact:"Dana Lee", vendorEmail:"dana@northwind.example",
      type:"SOW", title:`${cfg.name} — delivery services`, poNumber:"PO-1001", value: Math.round(cfg.budgetTotal*0.4), currency:"USD",
      startDate: D(cfg.start), endDate: D(cfg.end), status:"ACTIVE", deliverables:"Staffing and delivery per statement of work.",
      createdById: pm.id, ownerId: pm.id },
    { projectId: project.id, vendorName:"BrightTools Inc.", vendorContact:"Marco Diaz", vendorEmail:"marco@brighttools.example",
      type:"PURCHASE_ORDER", title:"Software licenses & tooling", poNumber:"PO-1002", value: Math.round(cfg.budgetTotal*0.12), currency:"USD",
      startDate: D(cfg.start), status:"ACTIVE", deliverables:"Annual licenses for the delivery toolchain.",
      createdById: pm.id, ownerId: admin.id },
  ] })

  // Quality checklists
  await db.qualityChecklist.createMany({ data: [
    { projectId: project.id, deliverable:`${cfg.phases[1].name} deliverables`, status:"PASSED",
      items:[
        { id:"q1", criterion:"Meets documented requirements", passed:true, notes:"Verified against sign-off." },
        { id:"q2", criterion:"Peer reviewed", passed:true, notes:"" },
        { id:"q3", criterion:"No critical defects open", passed:true, notes:"" },
      ], reviewedById: pmo.id, reviewedAt: D(cfg.start), notes:"Passed phase-gate quality review.", createdById: pm.id },
    { projectId: project.id, deliverable:`${cfg.phases[2].name} deliverables`, status:"IN_REVIEW",
      items:[
        { id:"q1", criterion:"Meets acceptance criteria", passed:true, notes:"" },
        { id:"q2", criterion:"Automated tests passing", passed:false, notes:"2 flaky tests under investigation." },
        { id:"q3", criterion:"Documentation updated", passed:false, notes:"In progress." },
      ], createdById: pm.id },
  ] })

  // Requirements (RTM)
  await db.requirement.createMany({ data: [
    { projectId: project.id, code:"REQ-001", title:"Role-based access control", type:"NON_FUNCTIONAL", priority:"HIGH", status:"APPROVED",
      description:"Access must be governed by role with least-privilege defaults.", source: exec.name,
      acceptanceCriteria:"Each role sees only permitted screens and actions; verified by test matrix.", ownerId: pm.id, createdById: pm.id },
    { projectId: project.id, code:"REQ-002", title:"Audit trail for key actions", type:"REGULATORY", priority:"HIGH", status:"APPROVED",
      description:"All create/update/delete on key entities is logged with actor and timestamp.", source:"Compliance",
      acceptanceCriteria:"Audit log captures actor, action, entity, and time; exportable.", ownerId: pmo.id, createdById: pm.id },
    { projectId: project.id, code:"REQ-003", title:"Core workflow completion", type:"FUNCTIONAL", priority:"CRITICAL", status:"IMPLEMENTED",
      description:"Users can complete the primary end-to-end workflow.", source: exec.name,
      acceptanceCriteria:"Primary workflow completes without error for all supported roles.", ownerId: pm.id, createdById: pm.id },
    { projectId: project.id, code:"REQ-004", title:"Performance under expected load", type:"NON_FUNCTIONAL", priority:"MEDIUM", status:"DRAFT",
      description:"System remains responsive under the expected concurrent load.", source:"Architecture",
      acceptanceCriteria:"95th-percentile response under target at expected concurrency.", ownerId: admin.id, createdById: pm.id },
  ] })

  // Documents (data-URL text scaffolds so preview works)
  const doc = (t:string) => "data:text/plain;charset=utf-8," + encodeURIComponent(t)
  await db.document.createMany({ data: [
    { projectId: project.id, name:"Project Charter.txt", description:"Approved project charter.", fileUrl: doc(`${cfg.name} — Project Charter\n\nObjective: ${cfg.objective}`), fileType:"text/plain", version:1, sharedWithClient:false, uploadedById: pm.id },
    { projectId: project.id, name:"Requirements Spec.txt", description:"Requirements specification.", fileUrl: doc("Requirements specification (scaffold)."), fileType:"text/plain", version:2, sharedWithClient:false, uploadedById: analyst.id },
    { projectId: project.id, name:"Status Summary.txt", description:"Latest status summary — shareable with client.", fileUrl: doc("Status summary (scaffold)."), fileType:"text/plain", version:1, sharedWithClient:true, uploadedById: pm.id },
  ] })

  // Meeting minutes
  await db.meetingMinutes.createMany({ data: [
    { projectId: project.id, code:"MIN-001", title:"Project Kickoff", meetingDate: D(cfg.start), location:"Team channel", facilitator: pm.name,
      attendees:[ {name:pm.name,role:"PM",present:true},{name:owner.name,role:"Sponsor",present:true},{name:pmo.name,role:"PMO",present:true} ],
      agenda:"Charter, scope, roles, plan.", discussion:"Reviewed charter and confirmed scope and governance cadence.",
      decisions:[ {decision:"Adopt phased rollout",owner:pm.name,date:cfg.start} ],
      actionItems:[ {action:"Publish comms plan",owner:pm.name,dueDate:cfg.start,status:"DONE"} ], status:"APPROVED", approvedById: owner.id, createdById: pm.id },
    { projectId: project.id, code:"MIN-002", title:"Mid-project Review", meetingDate: D("2026-06-24"), location:"Video call", facilitator: pm.name,
      attendees:[ {name:pm.name,role:"PM",present:true},{name:exec.name,role:"Sponsor",present:true},{name:member.name,role:"Team",present:true} ],
      agenda:"Progress, risks, budget.", discussion:"On track overall; integration dependency flagged.",
      decisions:[], actionItems:[ {action:"Escalate integration dependency",owner:member.name,dueDate:"2026-07-01",status:"IN_PROGRESS"} ], status:"DRAFT", createdById: pm.id },
  ] })

  console.log(`✓ Project ${cfg.code} — ${cfg.name} (${cfg.methodology})`)
  return project
}

async function main() {
  console.log("🌱 Seeding FlowSync PM (clean slate)...")
  await wipe()
  const pwd = await hash(PWD_PLAIN, 12)

  // Users
  const users: Record<string,any> = {}
  for (const ud of USERS) {
    const user = await db.user.create({
      data: {
        email: ud.email, name: ud.name, timezone:"America/New_York", locale:"en", currency:"USD",
        accounts: { create: { provider:"EMAIL", providerAccountId: ud.email, accessToken: pwd } },
      },
    })
    users[ud.email] = user
  }
  console.log(`✓ ${USERS.length} users (one per role)`)

  // Workspace
  const workspace = await db.workspace.create({
    data: {
      name:"Demo Workspace", slug:"demo-workspace", plan:"BUSINESS",
      primaryColor:"#1B6CA8", accentColor:"#F59E0B",
      defaultTimezone:"America/New_York", defaultCurrency:"USD",
    },
  })
  for (const ud of USERS) {
    await db.workspaceMember.create({ data: { workspaceId: workspace.id, userId: users[ud.email].id, role: ud.role as any, skills: SKILLS[ud.email.split("@")[0]] || [] } })
  }
  console.log("✓ Workspace + members")

  // ── PROJECT 1 — WATERFALL ────────────────────────────────────────────────
  await seedProject(users, workspace, {
    code:"PRJ-001", name:"Enterprise System Implementation", methodology:"WATERFALL",
    description:"Company-wide implementation of a new core business system with phased governance and formal sign-offs.",
    objective:"Replace legacy tooling with an integrated platform to improve efficiency by 40% and cut operating costs.",
    scope:"In scope: data migration, workflow automation, reporting, integrations with three internal systems, staff training.",
    outOfScope:"Out of scope: hardware refresh, changes to unrelated business units, third-party platform modifications.",
    background:"A strategic review identified system modernization as the top priority for the year, with full board approval.",
    assumptions:"Infrastructure remains stable; key staff are 80% available; vendor APIs are documented.",
    constraints:"Budget ceiling $450,000; go-live by Sep 30, 2026; maintain uptime during transition.",
    economicImpact:"~$200K annual savings; ROI within 18 months; NPV ~$480K over three years.",
    priority:"HIGH", status:"ACTIVE", health:"GREEN", start:"2026-01-05", end:"2026-09-30",
    budgetTotal:450000, budgetSpent:265000, pct:58,
    methodChoice:"Formal phase gates and documented approvals are required by governance; scope is well understood up front.",
    benefit:"$200,000 per year in operational savings", team: BASE_TEAM,
    phases:[
      { name:"Discovery & Planning", status:"COMPLETED" },
      { name:"Design", status:"COMPLETED" },
      { name:"Build", status:"IN_PROGRESS" },
      { name:"Testing", status:"PENDING" },
      { name:"Deployment & Handover", status:"PENDING" },
    ],
    tasks:[
      { p:0, title:"Project kickoff", s:"DONE", pr:"HIGH", pct:100, start:"2026-01-05", due:"2026-01-06" },
      { p:0, title:"Requirements workshop", s:"DONE", pr:"HIGH", pct:100, start:"2026-01-07", due:"2026-01-20" },
      { p:0, title:"Project charter sign-off", s:"DONE", pr:"HIGH", pct:100, start:"2026-01-15", due:"2026-01-28" },
      { p:1, title:"Solution architecture", s:"DONE", pr:"CRITICAL", pct:100, start:"2026-02-01", due:"2026-02-21" },
      { p:1, title:"Integration design", s:"DONE", pr:"HIGH", pct:100, start:"2026-02-15", due:"2026-03-07" },
      { p:2, title:"Data migration build", s:"IN_PROGRESS", pr:"CRITICAL", pct:70, start:"2026-03-10", due:"2026-05-30" },
      { p:2, title:"Workflow automation", s:"IN_PROGRESS", pr:"HIGH", pct:55, start:"2026-03-15", due:"2026-06-15" },
      { p:2, title:"Integration — System A", s:"IN_PROGRESS", pr:"HIGH", pct:80, start:"2026-04-01", due:"2026-05-15" },
      { p:2, title:"Integration — System B", s:"TODO", pr:"HIGH", pct:0, start:"2026-05-01", due:"2026-06-30" },
      { p:2, title:"Reporting dashboards", s:"TODO", pr:"MEDIUM", pct:0, start:"2026-05-15", due:"2026-07-15" },
      { p:3, title:"System integration testing", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-07-01", due:"2026-08-01" },
      { p:3, title:"User acceptance testing", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-08-01", due:"2026-08-22" },
      { p:4, title:"Staff training", s:"TODO", pr:"HIGH", pct:0, start:"2026-09-01", due:"2026-09-15" },
      { p:4, title:"Go-live cutover", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-09-22", due:"2026-09-26" },
    ],
    milestones:[
      { name:"Charter Approved", due:"2026-01-28", st:"ACHIEVED", achieved:"2026-01-28", color:"#059669" },
      { name:"Design Complete", due:"2026-03-07", st:"ACHIEVED", achieved:"2026-03-10", color:"#059669" },
      { name:"Build Complete", due:"2026-06-30", st:"AT_RISK", color:"#F59E0B" },
      { name:"UAT Sign-off", due:"2026-08-22", st:"UPCOMING", color:"#1B6CA8" },
      { name:"Go-live", due:"2026-09-26", st:"UPCOMING", color:"#1B6CA8" },
    ],
    risks:[
      { code:"RSK-001", title:"Scope creep from change requests", cat:"Scope", prob:"HIGH", imp:"MAJOR", score:16, resp:"MITIGATE", plan:"Enforce formal change control; all scope changes require CR approval." },
      { code:"RSK-002", title:"Key resource availability", cat:"Resource", prob:"MEDIUM", imp:"MAJOR", score:12, resp:"TRANSFER", plan:"Cross-train and retain backup contractors." },
      { code:"RSK-003", title:"Vendor API delays", cat:"External", prob:"MEDIUM", imp:"MODERATE", score:9, resp:"ACCEPT", plan:"Early engagement; develop against mock APIs." },
      { code:"RSK-004", title:"Additional automation savings", cat:"Technical", prob:"MEDIUM", imp:"MODERATE", score:9, opp:true, resp:"EXPLOIT", plan:"Document extra automation opportunities for a scope-expansion CR." },
      { code:"RSK-005", title:"Early go-live if testing runs ahead", cat:"Schedule", prob:"LOW", imp:"MAJOR", score:8, opp:true, resp:"ENHANCE", plan:"Pre-stage go-live activities and confirm stakeholder availability." },
    ],
  })

  // ── PROJECT 2 — AGILE ────────────────────────────────────────────────────
  await seedProject(users, workspace, {
    code:"PRJ-002", name:"Customer Portal Platform", methodology:"AGILE",
    description:"Iterative build of a self-service customer portal delivered in incremental releases.",
    objective:"Give customers self-service access to accounts, requests, and status, reducing inbound support volume.",
    scope:"In scope: authentication, account dashboard, request submission, notifications, an admin console.",
    outOfScope:"Out of scope: native mobile apps, billing engine changes, legacy data archival.",
    background:"Support volume has grown faster than headcount; self-service is the agreed lever to bend the curve.",
    assumptions:"Design system is available; product owner is engaged each iteration; APIs are reasonably stable.",
    constraints:"Budget ceiling $320,000; public beta targeted mid-year; must meet accessibility standards.",
    economicImpact:"~25% reduction in inbound support tickets; improved retention from a better experience.",
    priority:"HIGH", status:"ACTIVE", health:"AMBER", start:"2026-02-02", end:"2026-10-15",
    budgetTotal:320000, budgetSpent:150000, pct:47,
    methodChoice:"Requirements are expected to evolve with user feedback; incremental releases de-risk delivery.",
    benefit:"25% reduction in inbound support tickets", team: AGILE_TEAM,
    phases:[
      { name:"Inception", status:"COMPLETED" },
      { name:"Release 1 — Core", status:"COMPLETED" },
      { name:"Release 2 — Self-service", status:"IN_PROGRESS" },
      { name:"Release 3 — Admin & Notifications", status:"PENDING" },
      { name:"Hardening & Launch", status:"PENDING" },
    ],
    tasks:[
      { p:0, title:"Product vision & roadmap", s:"DONE", pr:"HIGH", pct:100, start:"2026-02-02", due:"2026-02-13" },
      { p:0, title:"Backlog & story mapping", s:"DONE", pr:"HIGH", pct:100, start:"2026-02-09", due:"2026-02-20" },
      { p:1, title:"Authentication & accounts", s:"DONE", pr:"CRITICAL", pct:100, start:"2026-02-23", due:"2026-03-27" },
      { p:1, title:"Account dashboard", s:"DONE", pr:"HIGH", pct:100, start:"2026-03-16", due:"2026-04-17" },
      { p:2, title:"Request submission flow", s:"IN_PROGRESS", pr:"HIGH", pct:65, start:"2026-04-20", due:"2026-05-29" },
      { p:2, title:"Status tracking", s:"IN_PROGRESS", pr:"HIGH", pct:40, start:"2026-05-04", due:"2026-06-12" },
      { p:2, title:"Accessibility pass (R2)", s:"TODO", pr:"MEDIUM", pct:0, start:"2026-06-01", due:"2026-06-19" },
      { p:3, title:"Admin console", s:"TODO", pr:"HIGH", pct:0, start:"2026-06-22", due:"2026-07-31" },
      { p:3, title:"Notifications service", s:"TODO", pr:"MEDIUM", pct:0, start:"2026-07-06", due:"2026-08-14" },
      { p:4, title:"Performance & security hardening", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-08-17", due:"2026-09-18" },
      { p:4, title:"Public beta", s:"TODO", pr:"HIGH", pct:0, start:"2026-09-21", due:"2026-10-02" },
      { p:4, title:"General availability launch", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-10-05", due:"2026-10-15" },
    ],
    milestones:[
      { name:"Inception Complete", due:"2026-02-20", st:"ACHIEVED", achieved:"2026-02-20", color:"#059669" },
      { name:"Release 1 Live", due:"2026-04-17", st:"ACHIEVED", achieved:"2026-04-20", color:"#059669" },
      { name:"Release 2 Live", due:"2026-06-19", st:"AT_RISK", color:"#F59E0B" },
      { name:"Public Beta", due:"2026-10-02", st:"UPCOMING", color:"#1B6CA8" },
      { name:"General Availability", due:"2026-10-15", st:"UPCOMING", color:"#1B6CA8" },
    ],
    risks:[
      { code:"RSK-001", title:"Evolving requirements outpace capacity", cat:"Scope", prob:"HIGH", imp:"MODERATE", score:12, resp:"MITIGATE", plan:"Ruthless backlog prioritization; fixed iteration capacity." },
      { code:"RSK-002", title:"API instability from upstream teams", cat:"External", prob:"MEDIUM", imp:"MAJOR", score:12, resp:"MITIGATE", plan:"Contract tests and versioned API agreements." },
      { code:"RSK-003", title:"Accessibility rework late", cat:"Quality", prob:"MEDIUM", imp:"MODERATE", score:9, resp:"MITIGATE", plan:"Bake accessibility checks into each release, not the end." },
      { code:"RSK-004", title:"Self-service exceeds ticket-deflection target", cat:"Business", prob:"MEDIUM", imp:"MODERATE", score:9, opp:true, resp:"EXPLOIT", plan:"Instrument usage; expand self-service coverage if deflection is strong." },
      { code:"RSK-005", title:"Design system reuse accelerates delivery", cat:"Technical", prob:"MEDIUM", imp:"MINOR", score:6, opp:true, resp:"ENHANCE", plan:"Invest early in shared components to compound velocity." },
    ],
  })

  // ── PROJECT 3 — SCRUM ────────────────────────────────────────────────────
  await seedProject(users, workspace, {
    code:"PRJ-003", name:"Mobile App Development", methodology:"SCRUM",
    description:"Sprint-based development of a cross-platform mobile app with regular demos and releases.",
    objective:"Deliver a mobile experience for on-the-go access, launching to the app stores by year end.",
    scope:"In scope: onboarding, core workflows, push notifications, offline mode, app-store release.",
    outOfScope:"Out of scope: wearables, in-app purchases, region-specific compliance beyond launch markets.",
    background:"Usage is increasingly mobile; a dedicated app is the agreed way to meet users where they are.",
    assumptions:"Backend APIs are ready; product owner attends ceremonies; store accounts are provisioned.",
    constraints:"Budget ceiling $280,000; store submission lead times; two-week sprint cadence.",
    economicImpact:"Higher engagement and retention; new channel for growth.",
    priority:"MEDIUM", status:"ACTIVE", health:"GREEN", start:"2026-03-02", end:"2026-11-13",
    budgetTotal:280000, budgetSpent:95000, pct:34,
    methodChoice:"Sprint cadence with demos gives fast feedback and predictable delivery for an evolving product.",
    benefit:"Higher mobile engagement and retention", team: AGILE_TEAM,
    phases:[
      { name:"Sprint 0 — Setup", status:"COMPLETED" },
      { name:"Sprints 1–2 — Foundations", status:"COMPLETED" },
      { name:"Sprints 3–4 — Core Workflows", status:"IN_PROGRESS" },
      { name:"Sprints 5–6 — Notifications & Offline", status:"PENDING" },
      { name:"Release Sprint — Store Launch", status:"PENDING" },
    ],
    tasks:[
      { p:0, title:"Repo, CI/CD & environments", s:"DONE", pr:"HIGH", pct:100, start:"2026-03-02", due:"2026-03-13" },
      { p:0, title:"Backlog refinement & DoD", s:"DONE", pr:"HIGH", pct:100, start:"2026-03-09", due:"2026-03-13" },
      { p:1, title:"Onboarding & auth", s:"DONE", pr:"CRITICAL", pct:100, start:"2026-03-16", due:"2026-04-10" },
      { p:1, title:"Navigation shell & design system", s:"DONE", pr:"HIGH", pct:100, start:"2026-03-30", due:"2026-04-24" },
      { p:2, title:"Core workflow — list & detail", s:"IN_PROGRESS", pr:"HIGH", pct:60, start:"2026-04-27", due:"2026-05-22" },
      { p:2, title:"Core workflow — create & edit", s:"IN_PROGRESS", pr:"HIGH", pct:35, start:"2026-05-11", due:"2026-06-05" },
      { p:2, title:"Sprint 4 demo & review", s:"TODO", pr:"MEDIUM", pct:0, start:"2026-06-01", due:"2026-06-05" },
      { p:3, title:"Push notifications", s:"TODO", pr:"HIGH", pct:0, start:"2026-06-08", due:"2026-07-03" },
      { p:3, title:"Offline mode & sync", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-07-06", due:"2026-08-14" },
      { p:4, title:"Beta via TestFlight/Play", s:"TODO", pr:"HIGH", pct:0, start:"2026-10-05", due:"2026-10-23" },
      { p:4, title:"Store submission & launch", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-11-02", due:"2026-11-13" },
    ],
    milestones:[
      { name:"Backlog Ready", due:"2026-03-13", st:"ACHIEVED", achieved:"2026-03-13", color:"#059669" },
      { name:"Sprint 2 Demo", due:"2026-04-24", st:"ACHIEVED", achieved:"2026-04-24", color:"#059669" },
      { name:"Sprint 4 Demo", due:"2026-06-05", st:"UPCOMING", color:"#1B6CA8" },
      { name:"Feature Complete", due:"2026-08-14", st:"UPCOMING", color:"#1B6CA8" },
      { name:"App Store Release", due:"2026-11-13", st:"UPCOMING", color:"#1B6CA8" },
    ],
    risks:[
      { code:"RSK-001", title:"App-store review delays launch", cat:"External", prob:"MEDIUM", imp:"MAJOR", score:12, resp:"MITIGATE", plan:"Submit early; pre-validate store guidelines; buffer the release sprint." },
      { code:"RSK-002", title:"Offline sync complexity", cat:"Technical", prob:"HIGH", imp:"MODERATE", score:12, resp:"MITIGATE", plan:"Spike the sync design early; keep the first offline scope small." },
      { code:"RSK-003", title:"Cross-platform inconsistencies", cat:"Quality", prob:"MEDIUM", imp:"MODERATE", score:9, resp:"MITIGATE", plan:"Shared component library and device test matrix." },
      { code:"RSK-004", title:"Strong beta feedback enables earlier launch", cat:"Schedule", prob:"LOW", imp:"MAJOR", score:8, opp:true, resp:"ENHANCE", plan:"Prepare store assets in advance to move quickly if beta is clean." },
      { code:"RSK-005", title:"Reusable mobile foundation for future apps", cat:"Technical", prob:"MEDIUM", imp:"MINOR", score:6, opp:true, resp:"EXPLOIT", plan:"Extract shared foundation into an internal package." },
    ],
  })

  // ── PROJECT 4 — HYBRID ───────────────────────────────────────────────────
  await seedProject(users, workspace, {
    code:"PRJ-004", name:"Digital Platform Modernization", methodology:"HYBRID",
    description:"Modernization program combining phased governance gates with agile build sprints.",
    objective:"Modernize the core digital platform with enterprise governance around iterative delivery, improving speed and reliability.",
    scope:"In scope: architecture modernization, phased delivery in sprints, integrations, testing, training, go-live.",
    outOfScope:"Out of scope: unrelated legacy systems, hardware procurement, org-structure changes.",
    background:"Leadership wants agile delivery speed without losing the governance and change control required at enterprise scale.",
    assumptions:"Product owner is engaged each sprint; gate reviews are scheduled; environments are available.",
    constraints:"Budget ceiling $380,000; go-live within the year; governance gates must be passed.",
    economicImpact:"Faster delivery cycles and reduced maintenance; improved reliability and adoption.",
    priority:"HIGH", status:"ACTIVE", health:"AMBER", start:"2026-02-16", end:"2026-11-06",
    budgetTotal:380000, budgetSpent:140000, pct:42,
    methodChoice:"Hybrid balances enterprise governance (gates, change control, baselines) with agile build sprints for speed and feedback.",
    benefit:"Faster, governed delivery with fewer defects", team: AGILE_TEAM,
    phases:[
      { name:"Initiation & Planning", status:"COMPLETED" },
      { name:"Solution Design", status:"COMPLETED" },
      { name:"Sprints 1-2 (Build)", status:"IN_PROGRESS" },
      { name:"Sprints 3-4 (Build)", status:"PENDING" },
      { name:"System Testing & UAT", status:"PENDING" },
      { name:"Go-live & Handover", status:"PENDING" },
    ],
    tasks:[
      { p:0, title:"Project charter & business case", s:"DONE", pr:"CRITICAL", pct:100, start:"2026-02-16", due:"2026-03-06" },
      { p:0, title:"Scope, roadmap & release plan", s:"DONE", pr:"HIGH", pct:100, start:"2026-02-23", due:"2026-03-13" },
      { p:1, title:"Solution architecture & design", s:"DONE", pr:"CRITICAL", pct:100, start:"2026-03-16", due:"2026-04-17" },
      { p:1, title:"Product backlog & story mapping", s:"DONE", pr:"HIGH", pct:100, start:"2026-03-23", due:"2026-04-10" },
      { p:2, title:"Sprint 1 - core features", s:"DONE", pr:"HIGH", pct:100, start:"2026-04-20", due:"2026-05-01" },
      { p:2, title:"Sprint 2 - core features", s:"IN_PROGRESS", pr:"HIGH", pct:60, start:"2026-05-04", due:"2026-05-29" },
      { p:2, title:"Increment 1 demo & review", s:"TODO", pr:"MEDIUM", pct:0, start:"2026-05-25", due:"2026-05-29" },
      { p:3, title:"Sprint 3 - extended features", s:"TODO", pr:"HIGH", pct:0, start:"2026-06-01", due:"2026-06-26" },
      { p:3, title:"Sprint 4 - hardening & polish", s:"TODO", pr:"HIGH", pct:0, start:"2026-06-29", due:"2026-07-24" },
      { p:4, title:"System integration testing", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-08-03", due:"2026-08-28" },
      { p:4, title:"User acceptance testing", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-08-31", due:"2026-09-18" },
      { p:5, title:"Cutover & go-live", s:"TODO", pr:"CRITICAL", pct:0, start:"2026-10-26", due:"2026-10-30" },
      { p:5, title:"Training & knowledge transfer", s:"TODO", pr:"HIGH", pct:0, start:"2026-10-19", due:"2026-10-30" },
      { p:5, title:"Hypercare & stabilization", s:"TODO", pr:"HIGH", pct:0, start:"2026-11-02", due:"2026-11-06" },
    ],
    milestones:[
      { name:"Charter approved (Gate 1)", due:"2026-03-06", st:"ACHIEVED", achieved:"2026-03-06", color:"#059669" },
      { name:"Design baseline approved (Gate 2)", due:"2026-04-17", st:"ACHIEVED", achieved:"2026-04-18", color:"#059669" },
      { name:"Increment 1 accepted", due:"2026-05-29", st:"AT_RISK", color:"#F59E0B" },
      { name:"Feature complete", due:"2026-07-24", st:"UPCOMING", color:"#0891B2" },
      { name:"UAT sign-off (Gate 3)", due:"2026-09-18", st:"UPCOMING", color:"#0891B2" },
      { name:"Go-live (Gate 4)", due:"2026-10-30", st:"UPCOMING", color:"#0891B2" },
    ],
    risks:[
      { code:"RSK-001", title:"Gate reviews stall sprint flow", cat:"Governance", prob:"HIGH", imp:"MODERATE", score:12, resp:"MITIGATE", plan:"Lightweight gates; pre-align approvers; time-box reviews." },
      { code:"RSK-002", title:"Backlog churn across increments", cat:"Scope", prob:"HIGH", imp:"MAJOR", score:16, resp:"MITIGATE", plan:"Firm sprint scope; change control at gate boundaries only." },
      { code:"RSK-003", title:"Late integration issues", cat:"Technical", prob:"MEDIUM", imp:"MAJOR", score:12, resp:"MITIGATE", plan:"Continuous integration; environment readiness checks each sprint." },
      { code:"RSK-004", title:"Reusable delivery accelerator", cat:"Technical", prob:"MEDIUM", imp:"MODERATE", score:9, opp:true, resp:"EXPLOIT", plan:"Extract shared build accelerators for future programs." },
      { code:"RSK-005", title:"Early gate pass if increments are clean", cat:"Schedule", prob:"LOW", imp:"MAJOR", score:8, opp:true, resp:"ENHANCE", plan:"Pre-stage gate evidence to move quickly when quality is high." },
    ],
  })

  console.log("")
  console.log("✅ Seed complete — clean workspace with all roles and all methodologies")
  console.log("")
  console.log(`Login password (all users): ${PWD_PLAIN}`)
  console.log("Users (one per role):")
  for (const ud of USERS) console.log(`  ${ud.role.padEnd(15)} ${ud.email}   (${ud.name})`)
  console.log("")
  console.log("Projects: PRJ-001 Waterfall · PRJ-002 Agile · PRJ-003 Scrum · PRJ-004 Hybrid")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
