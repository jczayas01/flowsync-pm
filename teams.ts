// src/app/api/templates/install/route.ts
// POST /api/templates/install — install a template into a project

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, parseBody, audit, ApiContext } from "@/lib/api"
import { SYSTEM_TEMPLATES } from "@/lib/templates/library"

const installSchema = z.object({
  templateId:  z.string(),
  projectId:   z.string().cuid(),
  startDate:   z.string().datetime().optional(),
  options: z.object({
    createPhases:     z.boolean().default(true),
    createTasks:      z.boolean().default(true),
    createMilestones: z.boolean().default(true),
    createRiskCategories: z.boolean().default(true),
    createBudgetItems:    z.boolean().default(true),
  }).default({}),
})

export async function POST(req: NextRequest) {
  return withWorkspace(req, async (ctx: ApiContext) => {
    const parsed = await parseBody(ctx.req, installSchema)
    if ("error" in parsed) return parsed.error

    const { templateId, projectId, startDate, options } = parsed.data

    // Get template
    const template = SYSTEM_TEMPLATES.find(t => t.id === templateId)
    if (!template) return err("Template not found", 404)

    // Verify project belongs to workspace
    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId: ctx.workspaceId },
    })
    if (!project) return err("Project not found", 404)

    const projectStart = startDate ? new Date(startDate) : (project.startDate || new Date())
    const results = { phases: 0, tasks: 0, milestones: 0, risks: 0, budget: 0 }

    await db.$transaction(async tx => {
      // Delete existing phases/tasks if any (fresh install)
      // In production: offer merge vs replace option

      for (const phase of template.phases) {
        if (!options.createPhases) break

        // Calculate phase dates based on task offsets
        const taskOffsets = phase.tasks.map(t => t.offsetDays + t.durationDays)
        const phaseDurationDays = Math.max(...taskOffsets, 14)
        const phaseStart = new Date(projectStart)

        // Add previous phases duration
        const prevPhasesDuration = template.phases
          .slice(0, phase.order)
          .reduce((sum, ph) => {
            const maxOffset = Math.max(...ph.tasks.map(t => t.offsetDays + t.durationDays), 14)
            return sum + maxOffset
          }, 0)
        phaseStart.setDate(phaseStart.getDate() + prevPhasesDuration)

        const phaseEnd = new Date(phaseStart)
        phaseEnd.setDate(phaseEnd.getDate() + phaseDurationDays)

        const createdPhase = await tx.phase.create({
          data: {
            projectId,
            name:         phase.name,
            description:  phase.description,
            order:        phase.order,
            status:       phase.order === 0 ? "IN_PROGRESS" : "PENDING",
            plannedStart: phaseStart,
            plannedEnd:   phaseEnd,
          },
        })
        results.phases++

        // Get next task code
        const lastTask = await tx.task.findFirst({
          where:   { projectId },
          orderBy: { createdAt: "desc" },
          select:  { code: true },
        })
        let taskNum = lastTask ? parseInt(lastTask.code.replace("T-",""), 10) + 1 : 1

        if (options.createTasks) {
          for (const task of phase.tasks) {
            const taskStart = new Date(phaseStart)
            taskStart.setDate(taskStart.getDate() + task.offsetDays)
            const taskEnd = new Date(taskStart)
            taskEnd.setDate(taskEnd.getDate() + task.durationDays)

            await tx.task.create({
              data: {
                projectId,
                phaseId:        createdPhase.id,
                code:           `T-${String(taskNum++).padStart(3,"0")}`,
                title:          task.title,
                description:    task.description,
                status:         "TODO",
                priority:       task.priority,
                startDate:      taskStart,
                dueDate:        taskEnd,
                estimatedHours: task.estimatedHours,
                isCriticalPath: task.isCriticalPath,
              },
            })
            results.tasks++
          }
        }

        if (options.createMilestones) {
          for (const ms of phase.milestones) {
            const msDate = new Date(phaseStart)
            msDate.setDate(msDate.getDate() + ms.offsetDays)
            await tx.milestone.create({
              data: {
                projectId,
                name:    ms.name,
                dueDate: msDate,
                status:  "UPCOMING",
                color:   "#F59E0B",
              },
            })
            results.milestones++
          }
        }
      }

      // Create risk categories as initial risks
      if (options.createRiskCategories) {
        let riskNum = 1
        for (const cat of template.riskCategories) {
          await tx.risk.create({
            data: {
              projectId,
              code:        `RSK-${String(riskNum++).padStart(3,"0")}`,
              title:       `[${cat.name}] — Review and update`,
              description: `Risk category: ${cat.name}

Common examples:
${cat.examples.map(e=>`• ${e}`).join("
")}`,
              probability: "MEDIUM",
              impact:      "MODERATE",
              score:       6,
              status:      "OPEN",
              category:    cat.name,
            },
          }).catch(() => {})
          results.risks++
        }
      }

      // Create budget line items
      if (options.createBudgetItems) {
        for (const item of template.budgetCategories) {
          await tx.budgetItem.create({
            data: {
              projectId,
              category:    item.category as any,
              name:        item.name,
              description: `Typical: ${item.typical}`,
              plannedCost: 0,  // PM fills in actual budget
              currency:    project.currency || "USD",
            },
          }).catch(() => {})
          results.budget++
        }
      }

      // Update template usage count
      // (for system templates, track in a separate usage_logs table in production)

      // Update project methodology to match template
      await tx.project.update({
        where: { id: projectId },
        data:  { methodology: template.methodology },
      })
    })

    await audit(ctx.workspaceId, ctx.userId, "template.installed" as any, "template", templateId,
      undefined, { projectId, results })

    return ok({
      message:  `Template "${template.name}" installed successfully`,
      results,
      template: { id: template.id, name: template.name, methodology: template.methodology },
    })
  })
}
