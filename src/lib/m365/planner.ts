// src/lib/m365/planner.ts
// Two-way sync between FlowSync PM tasks and Microsoft Planner

import { GraphClient } from "./graph-client"
import { db } from "@/lib/db"

export interface PlannerSyncResult {
  created:  number
  updated:  number
  skipped:  number
  errors:   string[]
}

/**
 * Pull tasks from a Planner plan into a FlowSync PM project.
 * Creates new tasks for items not yet in FlowSync PM.
 * Updates status for items that exist in both.
 */
export async function syncFromPlanner(
  userId:       string,
  projectId:    string,
  plannerPlanId:string
): Promise<PlannerSyncResult> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return { created:0, updated:0, skipped:0, errors:["No Graph token"] }

  const result: PlannerSyncResult = { created:0, updated:0, skipped:0, errors:[] }

  try {
    // Fetch Planner tasks
    const plannerTasks = await graph.get<{ value: any[] }>(
      `/planner/plans/${plannerPlanId}/tasks`
    )

    // Fetch Planner buckets (= phases in our system)
    const buckets = await graph.get<{ value: any[] }>(
      `/planner/plans/${plannerPlanId}/buckets`
    )
    const bucketMap = Object.fromEntries(
      (buckets.value || []).map((b: any) => [b.id, b.name])
    )

    // Get next task code
    const lastTask = await db.task.findFirst({
      where: { projectId }, orderBy: { createdAt: "desc" }, select: { code: true },
    })
    let taskNum = lastTask ? parseInt(lastTask.code.replace("T-",""), 10) + 1 : 1

    for (const pt of (plannerTasks.value || [])) {
      try {
        // Check if already imported (by external reference)
        const existing = await db.task.findFirst({
          where: { projectId, description: { contains: `planner:${pt.id}` } },
        })

        const statusMap: Record<string, string> = {
          "notStarted": "TODO",
          "inProgress":  "IN_PROGRESS",
          "completed":   "DONE",
          "deferred":    "BACKLOG",
          "waitingOnOthers": "IN_REVIEW",
        }

        if (existing) {
          // Update status if changed
          const newStatus = statusMap[pt.percentComplete === 100 ? "completed" : "inProgress"] || "TODO"
          if (existing.status !== newStatus) {
            await db.task.update({
              where: { id: existing.id },
              data: {
                status:          newStatus as any,
                percentComplete: pt.percentComplete || 0,
                ...(pt.percentComplete === 100 && { completedAt: new Date() }),
              },
            })
            result.updated++
          } else {
            result.skipped++
          }
          continue
        }

        // Create new task from Planner item
        const code = `T-${String(taskNum++).padStart(3, "0")}`
        await db.task.create({
          data: {
            projectId,
            code,
            title:           pt.title,
            description:     `Imported from Microsoft Planner\nBucket: ${bucketMap[pt.bucketId] || "General"}\nplanner:${pt.id}`,
            status:          (statusMap[pt.percentComplete === 100 ? "completed" : "notStarted"] || "TODO") as any,
            priority:        pt.priority <= 2 ? "CRITICAL" : pt.priority <= 4 ? "HIGH" : pt.priority <= 6 ? "MEDIUM" : "LOW" as any,
            percentComplete: pt.percentComplete || 0,
            dueDate:         pt.dueDateTime ? new Date(pt.dueDateTime) : null,
          },
        })
        result.created++
      } catch (e: any) {
        result.errors.push(`Task ${pt.title}: ${e.message}`)
      }
    }
  } catch (e: any) {
    result.errors.push(`Plan sync failed: ${e.message}`)
  }

  return result
}

/**
 * Push a FlowSync PM task to Microsoft Planner.
 * Creates or updates the corresponding Planner task.
 */
export async function pushTaskToPlanner(
  userId:        string,
  taskId:        string,
  plannerPlanId: string,
  bucketId:      string
): Promise<string | null> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return null

  const task = await db.task.findUnique({
    where:   { id: taskId },
    include: { assignees: { include: { projectMember: { include: { user: { select: { email: true } } } } } } },
  })
  if (!task) return null

  // Map status → Planner percentComplete
  const pctMap: Record<string, number> = {
    BACKLOG: 0, TODO: 0, IN_PROGRESS: 50, IN_REVIEW: 75, DONE: 100,
  }

  const plannerTask = await graph.post<any>("/planner/tasks", {
    planId:          plannerPlanId,
    bucketId,
    title:           `[${task.code}] ${task.title}`,
    percentComplete: pctMap[task.status] || 0,
    ...(task.dueDate && { dueDateTime: task.dueDate.toISOString() }),
    assignments: Object.fromEntries(
      (task.assignees || []).map(a => [
        a.projectMember.user.email,
        { "@odata.type": "#microsoft.graph.plannerAssignment", orderHint: " !" },
      ])
    ),
  }).catch((e: any) => { console.error("[Planner] Push task failed:", e); return null })

  return plannerTask?.id || null
}

/**
 * List all Planner plans the user has access to.
 */
export async function getUserPlannerPlans(userId: string): Promise<any[]> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return []

  const groups = await graph.get<{ value: any[] }>("/me/joinedGroups?$select=id,displayName").catch(() => ({ value: [] }))
  const plans: any[] = []

  for (const group of (groups.value || []).slice(0, 10)) {
    const groupPlans = await graph.get<{ value: any[] }>(
      `/groups/${group.id}/planner/plans`
    ).catch(() => ({ value: [] }))

    for (const plan of groupPlans.value || []) {
      plans.push({ ...plan, groupName: group.displayName })
    }
  }

  return plans
}
