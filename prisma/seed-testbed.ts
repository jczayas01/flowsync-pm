// prisma/seed-testbed.ts
// Run: npx tsx prisma/seed-testbed.ts
// Adds PRJ-006 "Enterprise Platform Delivery (Test Bed)" — a 9-phase project
// with varied completion, cross-phase dependencies, milestones, risks and an
// approved baseline, for full testing of the Tasks grid, phase filter,
// phase completion %, and Gantt. Industry-neutral.

import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const log = (m: string) => console.log(m)
const skip = (e: any) => console.error("  skipped:",
  ((e?.message || String(e)).split("\n").map((l:string)=>l.trim()).filter(Boolean)[0]) || "(unknown error)")
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) }

async function main() {
  log("Seeding PRJ-006 Enterprise Platform Delivery (Test Bed)...")

  const workspace = await db.workspace.findFirst({ where: { slug: "demo-workspace" } })
  if (!workspace) {
    console.error("Demo workspace not found. Run the main seed first: npx tsx prisma/seed.ts")
    process.exit(1)
  }

  const users = await db.user.findMany({
    where: { email: { in: [
      "jczayas@flowsyncpm.com", "pm@demo.flowsyncpm.com", "sponsor@demo.flowsyncpm.com",
      "pmo@demo.flowsyncpm.com", "stakeholder@demo.flowsyncpm.com",
    ]}},
  })
  const owner   = users.find(u => u.email === "jczayas@flowsyncpm.com") || users[0]
  const pm      = users.find(u => u.email === "pm@demo.flowsyncpm.com")
  const sponsor = users.find(u => u.email === "sponsor@demo.flowsyncpm.com")
  const analyst = users.find(u => u.email === "pmo@demo.flowsyncpm.com")
  const vp      = users.find(u => u.email === "stakeholder@demo.flowsyncpm.com")
  if (!owner) { console.error("No users found"); process.exit(1) }

  // ── Project ────────────────────────────────────────────
  const project = await db.project.upsert({
    where: { workspaceId_code: { workspaceId: workspace.id, code: "PRJ-006" } },
    update: { health: "GREEN", percentComplete: 42 },
    create: {
      workspaceId: workspace.id,
      code: "PRJ-006",
      name: "Enterprise Platform Delivery (Test Bed)",
      description: "A nine-phase delivery project used to test phases, filtering, phase completion, dependencies, and the Gantt.",
      objective: "Deliver the platform through a full nine-phase life cycle with measurable completion at each stage.",
      scope: "Initiation through closeout, including design, build, integration, testing, deployment, and training.",
      outOfScope: "Ongoing operations after handover.",
      priority: "HIGH",
      methodology: "WATERFALL",
      status: "ACTIVE",
      health: "GREEN",
      startDate: new Date("2026-01-05"),
      endDate: new Date("2026-11-30"),
      budgetTotal: 520000,
      budgetSpent: 210000,
      percentComplete: 42,
      currency: "USD",
      createdById: owner.id,
    },
  })
  log(`Project: ${project.code} — ${project.name}`)

  // ── Members ────────────────────────────────────────────
  const memberPairs = [
    { user: owner,   role: "PM" },
    { user: pm,      role: "BUSINESS_ANALYST" },
    { user: sponsor, role: "EXECUTIVE_SPONSOR" },
    { user: analyst, role: "PMO" },
    { user: vp,      role: "STAKEHOLDER" },
  ]
  for (const { user, role } of memberPairs) {
    if (!user) continue
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      update: {},
      create: { projectId: project.id, userId: user.id, projectRole: role as any, joinedAt: new Date() },
    }).catch(skip)
  }
  log("Members assigned")

  // ── 9 Phases ───────────────────────────────────────────
  const phaseData = [
    { name:"Initiation",   order:1, status:"COMPLETED",   gateApproved:true,  plannedStart:new Date("2026-01-05"), plannedEnd:new Date("2026-01-30") },
    { name:"Requirements", order:2, status:"COMPLETED",   gateApproved:true,  plannedStart:new Date("2026-02-02"), plannedEnd:new Date("2026-02-27") },
    { name:"Design",       order:3, status:"IN_PROGRESS", gateApproved:false, plannedStart:new Date("2026-03-02"), plannedEnd:new Date("2026-04-03") },
    { name:"Development",  order:4, status:"IN_PROGRESS", gateApproved:false, plannedStart:new Date("2026-04-06"), plannedEnd:new Date("2026-06-19") },
    { name:"Integration",  order:5, status:"IN_PROGRESS", gateApproved:false, plannedStart:new Date("2026-06-22"), plannedEnd:new Date("2026-07-24") },
    { name:"Testing",      order:6, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-07-27"), plannedEnd:new Date("2026-08-28") },
    { name:"Deployment",   order:7, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-08-31"), plannedEnd:new Date("2026-09-25") },
    { name:"Training",     order:8, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-09-28"), plannedEnd:new Date("2026-10-23") },
    { name:"Closeout",     order:9, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-10-26"), plannedEnd:new Date("2026-11-30") },
  ]
  const phases: any[] = []
  for (const ph of phaseData) {
    let phase = await db.phase.findFirst({ where: { projectId: project.id, name: ph.name } })
    if (phase) {
      phase = await db.phase.update({ where: { id: phase.id }, data: { status: ph.status as any, gateApproved: ph.gateApproved } })
    } else {
      phase = await db.phase.create({ data: { projectId: project.id, ...ph, status: ph.status as any } }).catch((e:any)=>{ skip(e); return null as any })
    }
    phases.push(phase)
  }
  log(`${phases.filter(Boolean).length} phases created`)

  // ── Tasks (varied % so each phase shows a different completion) ──
  const taskData = [
    // Initiation (avg 100)
    { code:"TB-001", title:"Define project charter",            phaseIdx:0, start:"2026-01-05", due:"2026-01-12", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"TB-002", title:"Identify stakeholders",             phaseIdx:0, start:"2026-01-08", due:"2026-01-16", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"TB-003", title:"Set governance & cadence",          phaseIdx:0, start:"2026-01-15", due:"2026-01-23", status:"DONE",        priority:"MEDIUM",   pct:100 },
    { code:"TB-004", title:"Baseline budget approval",          phaseIdx:0, start:"2026-01-22", due:"2026-01-30", status:"DONE",        priority:"HIGH",     pct:100 },
    // Requirements (avg 100)
    { code:"TB-005", title:"Elicit business requirements",      phaseIdx:1, start:"2026-02-02", due:"2026-02-11", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"TB-006", title:"Document functional specs",         phaseIdx:1, start:"2026-02-10", due:"2026-02-19", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"TB-007", title:"Requirements sign-off",             phaseIdx:1, start:"2026-02-20", due:"2026-02-27", status:"DONE",        priority:"CRITICAL", pct:100 },
    // Design (avg ~83)
    { code:"TB-008", title:"Solution architecture",            phaseIdx:2, start:"2026-03-02", due:"2026-03-13", status:"DONE",        priority:"CRITICAL", pct:100 },
    { code:"TB-009", title:"Data model design",                phaseIdx:2, start:"2026-03-10", due:"2026-03-20", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"TB-010", title:"UX wireframes",                    phaseIdx:2, start:"2026-03-18", due:"2026-03-30", status:"IN_PROGRESS", priority:"MEDIUM",   pct:70  },
    { code:"TB-011", title:"Design review & approval",         phaseIdx:2, start:"2026-03-28", due:"2026-04-03", status:"IN_PROGRESS", priority:"HIGH",     pct:60  },
    // Development (avg ~55)
    { code:"TB-012", title:"Core services build",              phaseIdx:3, start:"2026-04-06", due:"2026-05-01", status:"IN_PROGRESS", priority:"CRITICAL", pct:80  },
    { code:"TB-013", title:"API layer build",                  phaseIdx:3, start:"2026-04-20", due:"2026-05-15", status:"IN_PROGRESS", priority:"HIGH",     pct:65  },
    { code:"TB-014", title:"Front-end build",                  phaseIdx:3, start:"2026-05-04", due:"2026-05-29", status:"IN_PROGRESS", priority:"HIGH",     pct:45  },
    { code:"TB-015", title:"Reporting module",                 phaseIdx:3, start:"2026-05-18", due:"2026-06-12", status:"IN_PROGRESS", priority:"MEDIUM",   pct:30  },
    { code:"TB-016", title:"Developer QA & code review",       phaseIdx:3, start:"2026-06-01", due:"2026-06-19", status:"TODO",        priority:"MEDIUM",   pct:0   },
    // Integration (avg ~30)
    { code:"TB-017", title:"System integration",               phaseIdx:4, start:"2026-06-22", due:"2026-07-03", status:"IN_PROGRESS", priority:"HIGH",     pct:50  },
    { code:"TB-018", title:"Identity / SSO integration",       phaseIdx:4, start:"2026-06-29", due:"2026-07-10", status:"IN_PROGRESS", priority:"HIGH",     pct:40  },
    { code:"TB-019", title:"Data migration dry run",           phaseIdx:4, start:"2026-07-06", due:"2026-07-17", status:"TODO",        priority:"CRITICAL", pct:10  },
    { code:"TB-020", title:"Integration test pass",            phaseIdx:4, start:"2026-07-15", due:"2026-07-24", status:"TODO",        priority:"MEDIUM",   pct:0   },
    // Testing (avg ~8)
    { code:"TB-021", title:"Test plan preparation",            phaseIdx:5, start:"2026-07-27", due:"2026-08-05", status:"IN_PROGRESS", priority:"HIGH",     pct:20  },
    { code:"TB-022", title:"Functional testing",              phaseIdx:5, start:"2026-08-03", due:"2026-08-14", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"TB-023", title:"Performance & load testing",       phaseIdx:5, start:"2026-08-12", due:"2026-08-21", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"TB-024", title:"User acceptance testing",          phaseIdx:5, start:"2026-08-19", due:"2026-08-28", status:"TODO",        priority:"CRITICAL", pct:0   },
    // Deployment (avg 0)
    { code:"TB-025", title:"Deployment runbook",               phaseIdx:6, start:"2026-08-31", due:"2026-09-08", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"TB-026", title:"Production release",               phaseIdx:6, start:"2026-09-07", due:"2026-09-16", status:"TODO",        priority:"CRITICAL", pct:0   },
    { code:"TB-027", title:"Cutover & smoke test",             phaseIdx:6, start:"2026-09-16", due:"2026-09-25", status:"TODO",        priority:"HIGH",     pct:0   },
    // Training (avg 0)
    { code:"TB-028", title:"Training materials",               phaseIdx:7, start:"2026-09-28", due:"2026-10-07", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"TB-029", title:"Administrator training",           phaseIdx:7, start:"2026-10-06", due:"2026-10-15", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"TB-030", title:"End-user training",                phaseIdx:7, start:"2026-10-14", due:"2026-10-23", status:"TODO",        priority:"LOW",      pct:0   },
    // Closeout (avg 0)
    { code:"TB-031", title:"Lessons learned",                  phaseIdx:8, start:"2026-10-26", due:"2026-11-04", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"TB-032", title:"Final report",                     phaseIdx:8, start:"2026-11-03", due:"2026-11-14", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"TB-033", title:"Handover to operations",           phaseIdx:8, start:"2026-11-13", due:"2026-11-24", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"TB-034", title:"Project closure & sign-off",       phaseIdx:8, start:"2026-11-23", due:"2026-11-30", status:"TODO",        priority:"CRITICAL", pct:0   },
  ]
  const byCode: Record<string, any> = {}
  for (const [i, t] of taskData.entries()) {
    const task = await db.task.upsert({
      where: { projectId_code: { projectId: project.id, code: t.code } },
      update: { status: t.status as any, percentComplete: t.pct, phaseId: phases[t.phaseIdx]?.id },
      create: {
        projectId: project.id,
        phaseId: phases[t.phaseIdx]?.id,
        code: t.code,
        title: t.title,
        status: t.status as any,
        priority: t.priority as any,
        startDate: new Date(t.start),
        dueDate: new Date(t.due),
        percentComplete: t.pct,
        sortOrder: i,
        ownerId: owner.id,
        estimatedHours: Math.ceil(daysBetween(new Date(t.start), new Date(t.due)) * 6),
      },
    }).catch(skip)
    if (task) byCode[t.code] = task
  }
  log(`${taskData.length} tasks created`)

  // ── Cross-phase dependencies (finish → start) ──────────
  const deps: [string, string][] = [
    ["TB-008","TB-007"], // architecture after requirements sign-off
    ["TB-012","TB-011"], // core build after design approval
    ["TB-017","TB-016"], // integration after dev QA
    ["TB-019","TB-018"], // migration after SSO
    ["TB-022","TB-021"], // functional testing after test plan
    ["TB-026","TB-025"], // release after runbook
    ["TB-034","TB-033"], // closure after handover
  ]
  for (const [dep, pre] of deps) {
    const d = byCode[dep], p = byCode[pre]
    if (!d || !p) continue
    await db.taskDependency.upsert({
      where: { dependentTaskId_precedingTaskId: { dependentTaskId: d.id, precedingTaskId: p.id } },
      update: {},
      create: { dependentTaskId: d.id, precedingTaskId: p.id, dependencyType: "FS" },
    }).catch(skip)
  }
  log(`${deps.length} dependencies created`)

  // ── Milestones ─────────────────────────────────────────
  const milestones = [
    { name:"Requirements approved", dueDate:new Date("2026-02-27"), status:"ACHIEVED", achievedAt:new Date("2026-02-27"), color:"#059669" },
    { name:"Design complete",       dueDate:new Date("2026-04-03"), status:"AT_RISK",  color:"#F59E0B" },
    { name:"Build complete",        dueDate:new Date("2026-06-19"), status:"UPCOMING", color:"#1B6CA8" },
    { name:"Go-live",               dueDate:new Date("2026-09-16"), status:"UPCOMING", color:"#7C3AED" },
  ]
  for (const m of milestones) {
    await db.milestone.create({ data: { projectId: project.id, ...m, status: m.status as any } }).catch(skip)
  }
  log(`${milestones.length} milestones created`)

  // ── Risks ──────────────────────────────────────────────
  const risks = [
    { code:"RSK-601", title:"Design approval delay",     probability:"MEDIUM", impact:"MODERATE", score:9,  responseType:"MITIGATE", mitigationPlan:"Time-box reviews; escalate blockers.", contingencyPlan:"Parallel-track low-risk build." },
    { code:"RSK-602", title:"Integration complexity",    probability:"HIGH",   impact:"MAJOR",    score:16, responseType:"MITIGATE", mitigationPlan:"Early spike; vendor engagement.",      contingencyPlan:"Phase integration incrementally." },
    { code:"RSK-603", title:"UAT resource availability",  probability:"MEDIUM", impact:"MODERATE", score:8,  responseType:"ACCEPT",   mitigationPlan:"Book testers in advance.",            contingencyPlan:"Extend UAT window." },
  ]
  for (const r of risks) {
    await db.risk.upsert({
      where: { projectId_code: { projectId: project.id, code: r.code } },
      update: { probability: r.probability as any, impact: r.impact as any },
      create: { projectId: project.id, ownerId: owner.id, status:"OPEN", category:"DELIVERY", reviewDate: new Date("2026-08-01"), ...r, responseType: r.responseType as any, probability: r.probability as any, impact: r.impact as any },
    }).catch(skip)
  }
  log(`${risks.length} risks created`)

  // ── Approved baseline (snapshot of current task dates) ──
  const allTasks = await db.task.findMany({ where: { projectId: project.id } })
  const snapshotData = {
    capturedAt: new Date().toISOString(),
    tasks: allTasks.map(t => ({
      id: t.id, code: t.code, title: t.title,
      startDate: t.startDate, dueDate: t.dueDate,
    })),
  }
  await db.baseline.create({
    data: {
      projectId: project.id,
      name: "Baseline 1 — Approved plan",
      description: "Initial approved schedule baseline for the test bed.",
      isApproved: true,
      approvedById: owner.id,
      approvedAt: new Date(),
      approvalNotes: "Approved for test bed.",
      budgetTotal: 520000,
      startDate: new Date("2026-01-05"),
      endDate: new Date("2026-11-30"),
      snapshotData,
      createdById: owner.id,
    },
  }).catch(skip)
  log("Approved baseline created")

  log("Done: PRJ-006 test bed seeded.")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
