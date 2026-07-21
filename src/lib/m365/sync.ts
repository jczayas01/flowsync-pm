// src/lib/m365/sync.ts
// Orchestrates all M365 sync operations for a workspace
// Called by the /api/m365/sync endpoint and scheduled jobs

import { detectProjectEmails } from "./outlook"
import { detectProjectMeetings, detectProjectChatMentions } from "./teams"
import { db } from "@/lib/db"

export interface SyncPayload {
  emails:   Awaited<ReturnType<typeof detectProjectEmails>>
  meetings: Awaited<ReturnType<typeof detectProjectMeetings>>
  chats:    Awaited<ReturnType<typeof detectProjectChatMentions>>
  total:    number
  syncedAt: Date
}

/**
 * Run a full M365 sync for a user and surface all detected updates.
 * Returns structured data for the "Smart inbox" UI.
 */
export async function runFullSync(userId: string): Promise<SyncPayload> {
  const [emails, meetings, chats] = await Promise.allSettled([
    detectProjectEmails(userId),
    detectProjectMeetings(userId),
    detectProjectChatMentions(userId),
  ])

  const result: SyncPayload = {
    emails:   emails.status   === "fulfilled" ? emails.value   : [],
    meetings: meetings.status === "fulfilled" ? meetings.value : [],
    chats:    chats.status    === "fulfilled" ? chats.value    : [],
    total:    0,
    syncedAt: new Date(),
  }

  result.total = result.emails.length + result.meetings.length + result.chats.length

  // Persist sync timestamp on user account
  await db.account.updateMany({
    where: { userId, provider: { in: ["AZURE_AD","MICROSOFT"] } },
    data:  { updatedAt: new Date() },
  }).catch(() => {})

  return result
}

/**
 * Accept a suggested update from M365 detection.
 * Applies the change to the FlowSync PM database.
 */
export async function acceptSuggestion(
  userId:    string,
  type:      "email" | "meeting" | "chat",
  entityId:  string,  // emailId / meetingId / messageId
  projectId: string,
  action:    "log_minutes" | "create_task" | "log_risk" | "update_task",
  data:      Record<string, any>
): Promise<{ success: boolean; entityId?: string; message: string }> {
  try {
    switch (action) {
      case "log_minutes": {
        // Create a status update / meeting minutes entry
        const update = await db.statusUpdate.create({
          data: {
            projectId,
            type:           "WEEKLY_STATUS",
            periodStart:    data.meetingStart ? new Date(data.meetingStart) : new Date(),
            periodEnd:      data.meetingEnd   ? new Date(data.meetingEnd)   : new Date(),
            health:         "GREEN",
            // Prefixed so reports and readers can see where this came from.
            summary:        `[From Microsoft 365${data.subject ? `: ${data.subject}` : ""}] ` +
                            (data.minutes || data.content || ""),
            aiGenerated:    false,
            createdById:    userId,
          },
        })
        return { success: true, entityId: update.id, message: "Meeting minutes logged" }
      }

      case "create_task": {
        // Get next task code
        const last = await db.task.findFirst({
          where: { projectId }, orderBy: { createdAt: "desc" }, select: { code: true },
        })
        const num  = last ? parseInt(last.code.replace("T-",""), 10) + 1 : 1
        const code = `T-${String(num).padStart(3,"0")}`

        const task = await db.task.create({
          data: {
            projectId,
            code,
            title:       data.title || "Task from M365",
            description: data.description || `Created from ${type}: ${entityId}`,
            status:      "TODO",
            priority:    data.priority || "MEDIUM",
            dueDate:     data.dueDate ? new Date(data.dueDate) : null,
            ownerId:     userId,
          },
        })
        return { success: true, entityId: task.id, message: `Task ${code} created` }
      }

      case "log_risk": {
        const last = await db.risk.findFirst({
          where: { projectId }, orderBy: { createdAt: "desc" }, select: { code: true },
        })
        const num  = last ? parseInt(last.code.replace("RSK-",""), 10) + 1 : 1
        const code = `RSK-${String(num).padStart(3,"0")}`

        const risk = await db.risk.create({
          data: {
            projectId,
            code,
            title:       data.title || "Risk from M365 detection",
            description: data.description || `Detected in ${type}: ${entityId}`,
            probability: data.probability || "MEDIUM",
            impact:      data.impact      || "MODERATE",
            score:       6,
            status:      "OPEN",
          },
        })
        return { success: true, entityId: risk.id, message: `Risk ${code} logged` }
      }

      case "update_task": {
        if (!data.taskId) return { success: false, message: "Task ID required" }
        await db.task.update({
          where: { id: data.taskId },
          data: {
            status:          data.status          || undefined,
            percentComplete: data.percentComplete || undefined,
            actualHours:     data.hours           || undefined,
          },
        })
        return { success: true, entityId: data.taskId, message: "Task updated" }
      }

      default:
        return { success: false, message: "Unknown action" }
    }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}
