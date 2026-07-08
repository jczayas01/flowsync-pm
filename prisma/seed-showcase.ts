// prisma/seed-showcase.ts
// Run: npx tsx prisma/seed-showcase.ts
// Adds PRJ-005 "Enterprise PMO Platform Rollout" showcase project
// showing every FlowSync PM feature

import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

async function main() {
  console.log("ð¯ Seeding PRJ-005 Enterprise PMO Platform Rollout...")

  // Find the demo workspace
  const workspace = await db.workspace.findFirst({
    where: { slug: "demo-workspace" },
  })
  if (!workspace) {
    console.error("â Demo workspace not found. Run the main seed first: npx tsx prisma/seed.ts")
    process.exit(1)
  }

  // Find users
  const users = await db.user.findMany({
    where: { email: { in: [
      "jczayas@flowsyncpm.com",
      "pm@demo.flowsyncpm.com",
      "sponsor@demo.flowsyncpm.com",
      "pmo@demo.flowsyncpm.com",
      "stakeholder@demo.flowsyncpm.com",
    ]}},
  })

  const owner   = users.find(u => u.email === "jczayas@flowsyncpm.com") || users[0]
  const pm      = users.find(u => u.email === "pm@demo.flowsyncpm.com")
  const sponsor = users.find(u => u.email === "sponsor@demo.flowsyncpm.com")
  const analyst = users.find(u => u.email === "pmo@demo.flowsyncpm.com")
  const vp      = users.find(u => u.email === "stakeholder@demo.flowsyncpm.com")

  if (!owner) { console.error("â No users found"); process.exit(1) }

  // ââ Project ââââââââââââââââââââââââââââââââââââââââââ
  const project = await db.project.upsert({
    where: { workspaceId_code: { workspaceId: workspace.id, code: "PRJ-005" } },
    update: { health: "GREEN", percentComplete: 44 },
    create: {
      workspaceId:     workspace.id,
      code:            "PRJ-005",
      name:            "Enterprise PMO Platform Rollout",
      description:     "Full enterprise rollout of the project management platform across all 8 departments. This project demonstrates every FlowSync PM feature.",
      objective:       "Deploy and adopt the enterprise PMO platform across all departments within 9 months, achieving 85% user adoption and reducing project reporting time by 60%.",
      scope:           "Platform deployment, user training, data migration, integrations, change management, and post-deployment support for all departments.",
      outOfScope:      "Legacy system decommissioning, hardware procurement, third-party vendor management beyond platform integrations.",
      background:      "The organization currently manages 40+ active projects across disconnected tools. This initiative consolidates all project management into one enterprise PMO platform.",
      assumptions:     "Executive sponsorship secured. IT infrastructure ready. Department heads will champion adoption.",
      economicImpact:  "Projected $280K annual savings in reporting overhead. ROI within 14 months. Additional $120K/year in productivity gains.",
      priority:        "HIGH",
      methodology:     "WATERFALL",
      status:          "ACTIVE",
      health:          "GREEN",
      startDate:       new Date("2026-01-05"),
      endDate:         new Date("2026-09-30"),
      budgetTotal:     425000,
      budgetSpent:     187000,
      percentComplete: 44,
      currency:        "USD",
      createdById:     owner.id,
    },
  })
  console.log(`â Project created: ${project.code} â ${project.name}`)

  // ââ Members ââââââââââââââââââââââââââââââââââââââââââ
  const memberPairs = [
    { user: owner,   role: "PM"                 },
    { user: pm,      role: "BUSINESS_ANALYST"   },
    { user: sponsor, role: "EXECUTIVE_SPONSOR"  },
    { user: analyst, role: "PMO"                },
    { user: vp,      role: "STAKEHOLDER"        },
  ]
  for (const { user, role } of memberPairs) {
    if (!user) continue
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      update: {},
      create: { projectId: project.id, userId: user.id, projectRole: role as any, joinedAt: new Date() },
    }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  }
  console.log("â Members assigned")

  // ââ Phases âââââââââââââââââââââââââââââââââââââââââââ
  const phaseData = [
    { name:"Initiation & Planning",   order:1, status:"COMPLETED",   gateApproved:true,  plannedStart:new Date("2026-01-05"), plannedEnd:new Date("2026-02-28") },
    { name:"Infrastructure Setup",    order:2, status:"COMPLETED",   gateApproved:true,  plannedStart:new Date("2026-03-01"), plannedEnd:new Date("2026-04-15") },
    { name:"Pilot Deployment",        order:3, status:"IN_PROGRESS", gateApproved:false, plannedStart:new Date("2026-04-16"), plannedEnd:new Date("2026-06-30") },
    { name:"Full Rollout",            order:4, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-07-01"), plannedEnd:new Date("2026-08-31") },
    { name:"Training & Adoption",     order:5, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-07-15"), plannedEnd:new Date("2026-09-15") },
    { name:"Closure & Handover",      order:6, status:"PENDING", gateApproved:false, plannedStart:new Date("2026-09-01"), plannedEnd:new Date("2026-09-30") },
  ]
  const phases: any[] = []
  for (const ph of phaseData) {
    let phase = await db.phase.findFirst({ where: { projectId: project.id, name: ph.name } })
    if (phase) {
      phase = await db.phase.update({ where: { id: phase.id }, data: { status: ph.status as any, gateApproved: ph.gateApproved } })
    } else {
      phase = await db.phase.create({ data: { projectId: project.id, ...ph, status: ph.status as any } }).catch((e:any)=>{ console.error("  skipped:",(e.message||String(e)).split("\n")[0]); return null as any })
    }
    phases.push(phase)
  }
  console.log(`â ${phases.length} phases created`)

  // ââ Tasks ââââââââââââââââââââââââââââââââââââââââââââ
  const taskData = [
    // Phase 1
    { code:"T-501", title:"Project Charter development",           phaseIdx:0, start:"2026-01-05", due:"2026-01-16", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-502", title:"Stakeholder identification & analysis", phaseIdx:0, start:"2026-01-08", due:"2026-01-20", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-503", title:"Requirements gathering workshops",      phaseIdx:0, start:"2026-01-19", due:"2026-02-06", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-504", title:"Technical architecture design",         phaseIdx:0, start:"2026-02-02", due:"2026-02-20", status:"DONE",        priority:"CRITICAL", pct:100 },
    { code:"T-505", title:"Project Management Plan approval",      phaseIdx:0, start:"2026-02-18", due:"2026-02-28", status:"DONE",        priority:"HIGH",     pct:100 },
    // Phase 2
    { code:"T-506", title:"Server environment provisioning",       phaseIdx:1, start:"2026-03-01", due:"2026-03-14", status:"DONE",        priority:"CRITICAL", pct:100 },
    { code:"T-507", title:"Database setup & configuration",        phaseIdx:1, start:"2026-03-10", due:"2026-03-28", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-508", title:"Security hardening & compliance",       phaseIdx:1, start:"2026-03-20", due:"2026-04-04", status:"DONE",        priority:"CRITICAL", pct:100 },
    { code:"T-509", title:"SSO / Active Directory integration",    phaseIdx:1, start:"2026-03-25", due:"2026-04-10", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-510", title:"Performance & load testing",            phaseIdx:1, start:"2026-04-06", due:"2026-04-15", status:"DONE",        priority:"MEDIUM",   pct:100 },
    // Phase 3
    { code:"T-511", title:"Pilot department selection",            phaseIdx:2, start:"2026-04-16", due:"2026-04-22", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-512", title:"Data migration â IT Department",        phaseIdx:2, start:"2026-04-21", due:"2026-05-09", status:"DONE",        priority:"CRITICAL", pct:100 },
    { code:"T-513", title:"Pilot user training â IT Department",   phaseIdx:2, start:"2026-05-05", due:"2026-05-16", status:"DONE",        priority:"HIGH",     pct:100 },
    { code:"T-514", title:"Pilot feedback collection & analysis",  phaseIdx:2, start:"2026-05-19", due:"2026-05-30", status:"DONE",        priority:"MEDIUM",   pct:100 },
    { code:"T-515", title:"Platform configuration refinements",    phaseIdx:2, start:"2026-06-02", due:"2026-06-20", status:"IN_PROGRESS", priority:"HIGH",     pct:65  },
    { code:"T-516", title:"Pilot sign-off & Phase Gate review",    phaseIdx:2, start:"2026-06-23", due:"2026-06-30", status:"TODO",        priority:"CRITICAL", pct:0   },
    // Phase 4
    { code:"T-517", title:"Department rollout â Finance",          phaseIdx:3, start:"2026-07-01", due:"2026-07-14", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-518", title:"Department rollout â Operations",       phaseIdx:3, start:"2026-07-07", due:"2026-07-21", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-519", title:"Department rollout â HR",               phaseIdx:3, start:"2026-07-14", due:"2026-07-28", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"T-520", title:"Department rollout â Marketing",        phaseIdx:3, start:"2026-07-21", due:"2026-08-04", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"T-521", title:"Department rollout â Legal",            phaseIdx:3, start:"2026-07-28", due:"2026-08-11", status:"TODO",        priority:"LOW",      pct:0   },
    { code:"T-522", title:"Department rollout â Executive Office", phaseIdx:3, start:"2026-08-11", due:"2026-08-22", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-523", title:"Full rollout validation & UAT",         phaseIdx:3, start:"2026-08-18", due:"2026-08-31", status:"TODO",        priority:"CRITICAL", pct:0   },
    // Phase 5
    { code:"T-524", title:"Training curriculum development",       phaseIdx:4, start:"2026-07-15", due:"2026-07-31", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-525", title:"PM training â all project managers",    phaseIdx:4, start:"2026-08-01", due:"2026-08-15", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-526", title:"Executive dashboard training",          phaseIdx:4, start:"2026-08-11", due:"2026-08-20", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"T-527", title:"Adoption metrics tracking",             phaseIdx:4, start:"2026-08-18", due:"2026-09-05", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"T-528", title:"Post-training certification",           phaseIdx:4, start:"2026-09-02", due:"2026-09-15", status:"TODO",        priority:"LOW",      pct:0   },
    // Phase 6
    { code:"T-529", title:"Lessons learned sessions",              phaseIdx:5, start:"2026-09-01", due:"2026-09-10", status:"TODO",        priority:"MEDIUM",   pct:0   },
    { code:"T-530", title:"Final project report",                  phaseIdx:5, start:"2026-09-08", due:"2026-09-19", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-531", title:"Handover to Operations",                phaseIdx:5, start:"2026-09-15", due:"2026-09-25", status:"TODO",        priority:"HIGH",     pct:0   },
    { code:"T-532", title:"Project closure & sign-off",            phaseIdx:5, start:"2026-09-24", due:"2026-09-30", status:"TODO",        priority:"CRITICAL", pct:0   },
  ]

  for (const [i, t] of taskData.entries()) {
    await db.task.upsert({
      where: { projectId_code: { projectId: project.id, code: t.code } },
      update: { status: t.status as any, percentComplete: t.pct, phaseId: phases[t.phaseIdx]?.id },
      create: {
        projectId:       project.id,
        phaseId:         phases[t.phaseIdx]?.id,
        code:            t.code,
        title:           t.title,
        status:          t.status as any,
        priority:        t.priority as any,
        startDate:       new Date(t.start),
        dueDate:         new Date(t.due),
        percentComplete: t.pct,
        sortOrder:       i,
        ownerId:         owner.id,
        estimatedHours:  Math.ceil(daysBetween(new Date(t.start), new Date(t.due)) * 6),
      },
    }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  }
  console.log(`â ${taskData.length} tasks created`)

  // ââ Risks ââââââââââââââââââââââââââââââââââââââââââââ
  const risks = [
    { code:"RSK-501", title:"Low user adoption rate",          probability:"HIGH",   impact:"MAJOR",    score:16, responseType:"MITIGATE", mitigationPlan:"Department champions. Gamified onboarding. Weekly adoption metrics.", contingencyPlan:"Extended support. 1-on-1 coaching." },
    { code:"RSK-502", title:"Data migration errors",           probability:"MEDIUM", impact:"MAJOR",    score:12, responseType:"MITIGATE", mitigationPlan:"Parallel run. Automated validation. Rollback plan.", contingencyPlan:"Restore backup. Manual reconciliation." },
    { code:"RSK-503", title:"SSO integration failure",         probability:"LOW",    impact:"CRITICAL", score:9,  responseType:"AVOID",    mitigationPlan:"Engage vendor early. Test all AD configs.", contingencyPlan:"Local authentication fallback." },
    { code:"RSK-504", title:"Budget overrun on training",      probability:"MEDIUM", impact:"MODERATE", score:8,  responseType:"MITIGATE", mitigationPlan:"Cap vendor costs. Use internal trainers.", contingencyPlan:"Reduce to core features only." },
    { code:"RSK-505", title:"Key resource unavailability",     probability:"LOW",    impact:"MODERATE", score:4,  responseType:"ACCEPT",   mitigationPlan:"Cross-train backup. Document all processes.", contingencyPlan:"External PMO consultant." },
    { code:"RSK-506", title:"Regulatory compliance gap",       probability:"LOW",    impact:"CRITICAL", score:9,  responseType:"AVOID",    mitigationPlan:"Legal review at each phase gate.", contingencyPlan:"Engage compliance attorney." },
  ]
  for (const r of risks) {
    await db.risk.upsert({
      where: { projectId_code: { projectId: project.id, code: r.code } },
      update: {},
      create: { projectId: project.id, ownerId: owner.id, status:"OPEN", category:"TECHNICAL", reviewDate: new Date("2026-08-01"), ...r, responseType: r.responseType as any, probability: r.probability as any, impact: r.impact as any },
    }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  }
  console.log(`â ${risks.length} risks created`)

  // ââ Issues âââââââââââââââââââââââââââââââââââââââââââ
  await db.issue.upsert({
    where: { projectId_code: { projectId: project.id, code: "ISS-501" } },
    update: {},
    create: { projectId: project.id, code:"ISS-501", raisedById: owner.id, ownerId: analyst?.id || owner.id,
      title:"Vendor delayed SSO connector delivery", category:"Technical", priority:"HIGH", status:"OPEN",
      description:"Identity provider vendor confirmed 3-week delay in SAML 2.0 connector delivery.",
      impact:"Delays T-509. Risk of cascading schedule impact on pilot start." },
  }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))

  await db.issue.upsert({
    where: { projectId_code: { projectId: project.id, code: "ISS-502" } },
    update: {},
    create: { projectId: project.id, code:"ISS-502", raisedById: owner.id, ownerId: pm?.id || owner.id,
      title:"Finance department resisting change", category:"People", priority:"MEDIUM", status:"IN_PROGRESS",
      description:"Finance VP requesting additional security audit docs before approving rollout.",
      impact:"Could delay Finance rollout by 2-3 weeks." },
  }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  console.log("â 2 issues created")

  // ââ Change Requests âââââââââââââââââââââââââââââââââââ
  await db.changeRequest.upsert({
    where: { projectId_code: { projectId: project.id, code: "CR-501" } },
    update: {},
    create: { projectId: project.id, code:"CR-501", requestedById: owner.id,
      title:"Add mobile app access to scope", priority:"MEDIUM", status:"UNDER_REVIEW",
      description:"Stakeholders requesting iOS and Android mobile access to platform dashboard.",
      scheduleImpact:"Potential 3-week extension to training phase", budgetImpact:18500,
      scopeImpact:"Adds mobile-responsive dashboard and push notifications." },
  }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))

  await db.changeRequest.upsert({
    where: { projectId_code: { projectId: project.id, code: "CR-502" } },
    update: {},
    create: { projectId: project.id, code:"CR-502", requestedById: owner.id,
      title:"Accelerate Finance rollout by 2 weeks", priority:"HIGH", status:"APPROVED",
      description:"CFO requesting Finance go-live moved up to align with fiscal year-end.",
      scheduleImpact:"Finance rollout moved from Jul 14 to Jul 1", budgetImpact:0 },
  }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  console.log("â 2 change requests created")

  // ââ Decisions ââââââââââââââââââââââââââââââââââââââââ
  const decisions = [
    { code:"DEC-501", title:"Waterfall methodology selected", rationale:"Regulatory constraints require formal sign-off at each phase.", madeAt:new Date("2026-01-15"), description:"After evaluating Agile and Waterfall, Waterfall selected due to sequential department dependencies." },
    { code:"DEC-502", title:"IT Department selected as pilot", rationale:"Technical staff identify integration issues early.", madeAt:new Date("2026-04-10"), description:"IT selected for pilot due to technical familiarity and quality feedback capability." },
    { code:"DEC-503", title:"Internal trainers over vendor", rationale:"$45K cost saving. Internal trainers know organizational context.", madeAt:new Date("2026-06-01"), description:"Decision to use internal project team as trainers rather than contracting vendor." },
    { code:"DEC-504", title:"CR-501 mobile app deferred to Phase 2", rationale:"Prevents scope creep. Core rollout timeline must be protected.", madeAt:new Date("2026-06-15"), description:"Mobile app approved in principle but deferred to follow-on Phase 2 project." },
  ]
  for (const d of decisions) {
    await db.decision.upsert({
      where: { projectId_code: { projectId: project.id, code: d.code } },
      update: {},
      create: { projectId: project.id, madeById: owner.id, ...d },
    }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  }
  console.log("â 4 decisions created")

  // ââ Budget Items âââââââââââââââââââââââââââââââââââââ
  const budgetItems = [
    { name:"PMO Platform License (annual)", category:"SOFTWARE",      plannedCost:120000, actualCost:120000, earnedValue:120000 },
    { name:"Implementation consulting",     category:"CONSULTING",    plannedCost:85000,  actualCost:42000,  earnedValue:38000  },
    { name:"Server infrastructure",         category:"EQUIPMENT",     plannedCost:55000,  actualCost:25000,  earnedValue:25000  },
    { name:"Internal PM team (loaded)",     category:"LABOR",         plannedCost:95000,  actualCost:0,      earnedValue:0      },
    { name:"Training development",          category:"OTHER",         plannedCost:35000,  actualCost:0,      earnedValue:0      },
    { name:"Change management",             category:"CONSULTING",    plannedCost:20000,  actualCost:0,      earnedValue:0      },
    { name:"Contingency reserve",           category:"CONTINGENCY",   plannedCost:15000,  actualCost:0,      earnedValue:0      },
  ]
  for (const b of budgetItems) {
    await db.budgetItem.create({ data: { projectId: project.id, currency:"USD", notes:null, ...b } }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  }
  console.log("â Budget items created")

  // ââ Milestones âââââââââââââââââââââââââââââââââââââââ
  const milestones = [
    { name:"Project Charter Approved",  dueDate:new Date("2026-01-16"), status:"ACHIEVED", achievedAt:new Date("2026-01-16"), color:"#059669" },
    { name:"Infrastructure Ready",      dueDate:new Date("2026-04-15"), status:"ACHIEVED", achievedAt:new Date("2026-04-15"), color:"#059669" },
    { name:"Pilot Go-Live",             dueDate:new Date("2026-05-05"), status:"ACHIEVED", achievedAt:new Date("2026-05-05"), color:"#059669" },
    { name:"Pilot Phase Gate Approval", dueDate:new Date("2026-06-30"), status:"AT_RISK",  color:"#F59E0B" },
    { name:"Full Rollout Complete",     dueDate:new Date("2026-08-31"), status:"UPCOMING", color:"#1B6CA8" },
    { name:"Training Complete",         dueDate:new Date("2026-09-15"), status:"UPCOMING", color:"#1B6CA8" },
    { name:"Project Go-Live",           dueDate:new Date("2026-09-30"), status:"UPCOMING", color:"#1B6CA8" },
  ]
  for (const m of milestones) {
    await db.milestone.create({ data: { projectId: project.id, ...m, status: m.status as any } }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  }
  console.log("â 7 milestones created")

  // ââ Requirements âââââââââââââââââââââââââââââââââââââ
  const reqs = [
    { code:"REQ-501", title:"Single Sign-On (SSO) authentication", type:"FUNCTIONAL",     priority:"CRITICAL", status:"VERIFIED",   source:"IT Security", acceptanceCriteria:"All users authenticate via Active Directory. No separate passwords required." },
    { code:"REQ-502", title:"Role-based access control",           type:"FUNCTIONAL",     priority:"CRITICAL", status:"VERIFIED",   source:"Security",    acceptanceCriteria:"5 role levels enforced server-side." },
    { code:"REQ-503", title:"99.5% platform uptime SLA",          type:"NON_FUNCTIONAL", priority:"HIGH",     status:"APPROVED",   source:"IT Ops",      acceptanceCriteria:"Monthly uptime â¥ 99.5%. Maintenance windows pre-announced 48hrs ahead." },
    { code:"REQ-504", title:"Data residency â US servers only",   type:"REGULATORY",    priority:"CRITICAL", status:"VERIFIED",   source:"Legal",       acceptanceCriteria:"All data stored on US-based servers. No cross-border transfer." },
    { code:"REQ-505", title:"Export to Excel and PDF",            type:"FUNCTIONAL",     priority:"HIGH",     status:"IMPLEMENTED",source:"Dept Heads",  acceptanceCriteria:"Any report exportable in â¤ 5 seconds." },
    { code:"REQ-506", title:"Mobile-responsive interface",        type:"NON_FUNCTIONAL", priority:"MEDIUM",   status:"DRAFT",      source:"Executives",  acceptanceCriteria:"Core features accessible on iOS/Android without horizontal scroll." },
  ]
  for (const r of reqs) {
    const existing = await db.requirement.findFirst({ where: { projectId: project.id, code: r.code } })
    if (existing) continue
    await db.requirement.create({
      data: { projectId: project.id, createdById: owner.id, ...r, type: r.type as any, priority: r.priority as any, status: r.status as any },
    }).catch((e:any)=>console.error("  skipped:",((e.message||String(e)).split("\n").map((l:string)=>l.trim()).filter(Boolean)[0])||"(unknown)"))
  }
  console.log("â 6 requirements created")

  // ââ Procurement ââââââââââââââââââââââââââââââââââââââ
  await db.procurementItem.create({
    data: { projectId: project.id, createdById: owner.id,
      vendorName:"CloudPMO Solutions Inc.", type:"CONTRACT", status:"ACTIVE",
      title:"Enterprise PMO Platform Annual License",
      deliverables:"Enterprise PMO platform annual license - unlimited users",
      value:120000, currency:"USD",
      startDate:new Date("2026-01-01"), endDate:new Date("2026-12-31"),
      notes:"Includes implementation support, 24/7 SLA, dedicated CSM." },
  }).catch((e:any)=>console.error("  skipped:",(e.message||String(e)).split("\n")[0]))

  await db.procurementItem.create({
    data: { projectId: project.id, createdById: owner.id,
      vendorName:"TechBridge Consulting Group", type:"SOW", status:"ACTIVE",
      title:"Implementation & Integration Consulting",
      deliverables:"Implementation and integration consulting services",
      value:85000, currency:"USD",
      startDate:new Date("2026-02-01"), endDate:new Date("2026-07-31"),
      notes:"Fixed-price SOW. Deliverables: architecture, SSO integration, data migration, pilot support." },
  }).catch((e:any)=>console.error("  skipped:",(e.message||String(e)).split("\n")[0]))
  console.log("2 procurement items created")

  // Benefits
  await db.benefit.create({
    data: { projectId: project.id, ownerId: owner.id, status:"TRACKING",
      title:"Reduction in project reporting time", category:"Operational",
      projectedValue:"$168,000/yr",
      description:"Automated dashboards replace manual weekly status reports.",
      notes:"Measurement: hours spent on reporting before vs after. Target 60% reduction.",
      measureBy: new Date("2026-12-31") },
  }).catch((e:any)=>console.error("  skipped:",(e.message||String(e)).split("\n")[0]))
  await db.benefit.create({
    data: { projectId: project.id, ownerId: owner.id, status:"PROJECTED",
      title:"Improved project on-time delivery rate", category:"Strategic",
      projectedValue:"58% -> 80% on-time",
      description:"Real-time visibility expected to improve delivery rate from 58% to 80%.",
      notes:"Measurement: compare on-time delivery 6 months before vs after adoption.",
      measureBy: new Date("2027-03-31") },
  }).catch((e:any)=>console.error("  skipped:",(e.message||String(e)).split("\n")[0]))
  console.log("2 benefits created")

  // ââ Team Charter âââââââââââââââââââââââââââââââââââââ
  await db.teamCharter.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id, createdById: owner.id,
      vision: "Deliver a world-class PMO platform that empowers every team to deliver projects on time, on budget, with full transparency.",
      objectives: "1. Complete rollout to all 8 departments by Sep 30, 2026\n2. Achieve 85% user adoption within 60 days of each go-live\n3. Reduce project reporting time by 60%\n4. Stakeholder satisfaction â¥ 4.2/5.0",
      values: "Transparency Â· Collaboration Â· Accountability Â· Continuous Improvement Â· User Focus",
      norms: "Core hours: MonâFri 8amâ5pm\nWeekly standup: Mondays 9am\nStakeholder updates: Fridays by 3pm\nResponse time: 4 business hours",
      decisionMaking: "Day-to-day: PM owns\nScope changes: CR required + sponsor approval\nBudget >$5K: Sponsor + finance approval\nAll decisions logged in Decisions register",
      conflictResolution: "1. Direct conversation first (48hrs)\n2. Escalate to PM\n3. PM facilitates discussion\n4. Escalate to Sponsor if unresolved",
      communicationPlan: "Primary: FlowSync PM\nMessaging: Microsoft Teams\nEmail: Formal decisions only\nExecutive: Monthly steering committee",
      toolsAndProcesses: "PM: FlowSync PM Â· Docs: SharePoint Â· Messaging: Teams\nChange control: CR form required\nDefinition of Done: Tested + documented + stakeholder-accepted",
    },
  }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))

  // ââ Meeting Minutes âââââââââââââââââââââââââââââââââââ
  await db.meetingMinutes.create({
    data: {
      projectId: project.id, createdById: owner.id,
      code: "MIN-501",
      title: "Pilot Phase Gate Review - Go/No-Go Decision",
      meetingDate: new Date("2026-06-10"),
      facilitator: "Alex Johnson (PM)",
      attendees: [
        { name:"Sarah Williams", role:"Sponsor",  present:true },
        { name:"Alex Johnson",   role:"PM",       present:true },
        { name:"Lisa Chen",      role:"PMO",       present:true },
        { name:"Carlos Rivera",  role:"VP Ops",    present:true },
        { name:"IT Champion",    role:"Champion",  present:true },
      ],
      agenda: "1. Pilot results review\n2. Adoption metrics\n3. Outstanding issues and risks\n4. Go/No-Go vote\n5. Timeline review",
      discussion: "92% IT department adoption after 30 days. All 5 pilot criteria met. SSO issue resolved 3 days late but within acceptable window. Finance concern flagged as risk for full rollout.",
      decisions: [
        { decision:"PROCEED to Full Rollout (unanimous)", owner:"Steering Committee", date:"2026-06-10" },
        { decision:"Finance rollout preceded by security briefing", owner:"Alex Johnson", date:"2026-06-10" },
        { decision:"CR-501 mobile app deferred to Phase 2", owner:"Steering Committee", date:"2026-06-10" },
      ],
      actionItems: [
        { action:"Schedule Finance security briefing", owner:"Alex Johnson",  dueDate:"2026-06-20", status:"OPEN" },
        { action:"Update dashboard with pilot metrics", owner:"Lisa Chen",     dueDate:"2026-06-12", status:"OPEN" },
        { action:"Confirm rollout sequence",            owner:"Carlos Rivera", dueDate:"2026-06-17", status:"OPEN" },
      ],
      nextMeeting: new Date("2026-07-01"),
    },
  }).catch((e:any)=>console.error("  skipped:",(e.message||String(e)).split("\n")[0]))
  console.log("â Team Charter + Meeting Minutes created")

  // ââ Baseline snapshot âââââââââââââââââââââââââââââââââ
  const allTasks = await db.task.findMany({ where: { projectId: project.id } })
  const snapshotData = {
    capturedAt: new Date("2026-01-16").toISOString(),
    tasks: allTasks.map(t => ({
      id: t.id, code: t.code, title: t.title,
      startDate: t.startDate, dueDate: t.dueDate,
      percentComplete: 0, status: "TODO",
    })),
    budget: { total: 425000 },
    schedule: { startDate: new Date("2026-01-05"), endDate: new Date("2026-09-30") },
  }
  await db.baseline.create({
    data: {
      projectId:  project.id,
      name:       "Original Baseline â Jan 16, 2026",
      description:"Project baseline set at Charter approval.",
      isApproved: true,
      approvedById: owner.id,
      approvedAt: new Date("2026-01-16"),
      approvalNotes: "Approved at Project Charter sign-off",
      budgetTotal: 425000,
      startDate:  new Date("2026-01-05"),
      endDate:    new Date("2026-09-30"),
      snapshotData,
      createdById: owner.id,
    },
  }).catch((e:any)=>console.error("  ⚠ skipped:",(e.message||String(e)).split("\n")[0]))
  console.log("â Baseline created with all task snapshots")

  console.log("\nð PRJ-005 seeded successfully!")
  console.log("ð Go to http://localhost:3000 â Projects â PRJ-005")
  console.log("   Every tab is populated with realistic data")
}

main()
  .catch(e => { console.error("â Seed failed:", e); process.exit(1) })
  .finally(() => db.$disconnect())
