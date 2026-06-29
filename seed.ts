// prisma/seed.ts
// Seeds the database with a demo workspace, user, and project
// Run: npx tsx prisma/seed.ts

import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("🌱 Seeding FlowSync PM...")

  // 1. Create demo user
  const hashedPassword = await hash("FlowSync PM2026!", 12)

  const user = await db.user.upsert({
    where:  { email: "jczayas@flowsyncpm.com" },
    update: {},
    create: {
      email:    "jczayas@flowsyncpm.com",
      name:     "Juan Carlos Zayas",
      timezone: "America/Puerto_Rico",
      locale:   "en",
      currency: "USD",
      accounts: {
        create: {
          provider:          "EMAIL",
          providerAccountId: "jczayas@flowsyncpm.com",
          accessToken:       hashedPassword, // stores hashed pw for credentials auth
        },
      },
    },
  })
  console.log("✓ User:", user.email)

  // 2. Create workspace
  const workspace = await db.workspace.upsert({
    where:  { slug: "sistema-salud-menonita" },
    update: {},
    create: {
      name:            "Sistema de Salud Menonita",
      slug:            "sistema-salud-menonita",
      plan:            "BUSINESS",
      primaryColor:    "#1B6CA8",
      accentColor:     "#F59E0B",
      defaultTimezone: "America/Puerto_Rico",
      defaultCurrency: "USD",
    },
  })
  console.log("✓ Workspace:", workspace.name)

  // 3. Add user as workspace owner
  await db.workspaceMember.upsert({
    where:  { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
  })

  // 4. Create demo project
  const project = await db.project.upsert({
    where:  { workspaceId_code: { workspaceId: workspace.id, code: "PRJ-001" } },
    update: {},
    create: {
      workspaceId:     workspace.id,
      createdById:     user.id,
      code:            "PRJ-001",
      name:            "EHR System Modernization",
      description:     "Modernization of the EHR system across all SSM facilities. Includes HL7 FHIR R4 integration, patient portal, and clinical dashboard.",
      methodology:     "WATERFALL",
      status:          "ACTIVE",
      health:          "GREEN",
      startDate:       new Date("2026-01-05"),
      endDate:         new Date("2026-09-30"),
      budgetTotal:     460000,
      budgetSpent:     284000,
      currency:        "USD",
      percentComplete: 62,
    },
  })
  console.log("✓ Project:", project.code, project.name)

  // 5. Add user to project as PM
  await db.projectMember.upsert({
    where:  { projectId_userId: { projectId: project.id, userId: user.id } },
    update: {},
    create: { projectId: project.id, userId: user.id, role: "PM", allocation: 100 },
  })

  // 6. Create phases
  const phases = ["Initiation","Planning","Design","Execution","Testing & Go-live"]
  const phaseStatuses = ["COMPLETED","COMPLETED","COMPLETED","IN_PROGRESS","PENDING"]
  for (let i = 0; i < phases.length; i++) {
    await db.phase.upsert({
      where:  { id: `ph-seed-${i}` },
      update: {},
      create: {
        id:        `ph-seed-${i}`,
        projectId: project.id,
        name:      phases[i],
        order:     i,
        status:    phaseStatuses[i] as any,
      },
    }).catch(() => {}) // ignore if already exists with different ID
  }

  // 7. Seed budget items
  const budgetItems = [
    { category: "LABOR",       name: "Development team",  plannedCost: 318000, actualCost: 196000 },
    { category: "SOFTWARE",    name: "Licenses & tools",  plannedCost: 62000,  actualCost: 53000  },
    { category: "CONSULTING",  name: "HL7 consultant",    plannedCost: 46000,  actualCost: 22000  },
    { category: "EQUIPMENT",   name: "Infrastructure",    plannedCost: 20000,  actualCost: 8000   },
    { category: "OTHER",       name: "Training & misc",   plannedCost: 14000,  actualCost: 5000   },
  ]
  for (const item of budgetItems) {
    await db.budgetItem.create({
      data: { projectId: project.id, currency: "USD", ...item as any },
    }).catch(() => {})
  }

  // 8. Seed risks
  const risks = [
    { title: "Backend delay cascade",   probability: "HIGH",   impact: "CRITICAL", category: "Technical", score: 20 },
    { title: "Resource over-allocation",probability: "MEDIUM", impact: "MAJOR",    category: "Resource",  score: 12 },
    { title: "HL7 vendor timeline slip",probability: "MEDIUM", impact: "MODERATE", category: "External",  score: 9  },
  ]
  let riskNum = 1
  for (const risk of risks) {
    await db.risk.create({
      data: { projectId: project.id, code: `RSK-00${riskNum++}`, status: "OPEN", ...risk as any },
    }).catch(() => {})
  }

  console.log("✅ Seed complete!")
  console.log("")
  console.log("Login credentials:")
  console.log("  Email:    jczayas@flowsyncpm.com")
  console.log("  Password: FlowSync PM2026!")
  console.log("")
  console.log("Workspace: Sistema de Salud Menonita")
  console.log("Project:   PRJ-001 — EHR System Modernization")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
