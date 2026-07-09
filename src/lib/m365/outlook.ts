// src/lib/m365/outlook.ts
// Reads Outlook emails and detects project-related content

import { GraphClient } from "./graph-client"
import { db } from "@/lib/db"

export interface DetectedEmailUpdate {
  emailId:      string
  subject:      string
  from:         string
  receivedAt:   Date
  projectId:    string | null
  projectCode:  string | null
  projectName:  string | null
  detectedType: "TASK_UPDATE" | "RISK_MENTION" | "MEETING_REQUEST" | "STATUS_UPDATE" | "GENERAL"
  suggestedAction: string | null
  snippet:      string
  confidence:   number // 0-1
}

// Keywords that indicate project relevance per detection type
const SIGNAL_PATTERNS = {
  taskUpdate:  [/task\s+(complete|done|finished|blocked|delayed)/i, /update on/i, /progress on/i],
  riskMention: [/risk|concern|issue|problem|blocker|impediment/i, /escalat/i, /critical/i],
  meeting:     [/meeting|standup|sync|review|retrospective|demo/i],
  status:      [/status|weekly|update|report/i],
}

/**
 * Fetch recent emails from the user's inbox
 * and detect which ones relate to their projects.
 */
export async function detectProjectEmails(
  userId:    string,
  projectIds?: string[]
): Promise<DetectedEmailUpdate[]> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return []

  // Get user's active projects for matching
  const projects = await db.project.findMany({
    where: {
      status: { in: ["ACTIVE", "ON_HOLD"] },
      members: { some: { userId } },
      ...(projectIds?.length && { id: { in: projectIds } }),
    },
    select: { id: true, code: true, name: true },
  })

  if (!projects.length) return []

  // Fetch emails from last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const emails = await graph.get<{ value: any[] }>(
    `/me/messages?$filter=receivedDateTime ge ${since}` +
    `&$select=id,subject,from,receivedDateTime,bodyPreview,body` +
    `&$top=50&$orderby=receivedDateTime desc`
  )

  const detected: DetectedEmailUpdate[] = []

  for (const email of emails.value || []) {
    const text     = `${email.subject} ${email.bodyPreview}`.toLowerCase()
    const fullText = `${email.subject} ${email.body?.content || email.bodyPreview}`

    // Match against project codes and names
    let matchedProject: any = null
    for (const proj of projects) {
      const codeMatch = text.includes(proj.code.toLowerCase())
      const nameMatch = text.includes(proj.name.toLowerCase().slice(0, 10))
      if (codeMatch || nameMatch) {
        matchedProject = proj
        break
      }
    }

    // Detect signal type
    let detectedType: DetectedEmailUpdate["detectedType"] = "GENERAL"
    let confidence = 0.3

    if (SIGNAL_PATTERNS.taskUpdate.some(p => p.test(fullText))) {
      detectedType = "TASK_UPDATE"; confidence = 0.75
    } else if (SIGNAL_PATTERNS.riskMention.some(p => p.test(fullText))) {
      detectedType = "RISK_MENTION"; confidence = 0.65
    } else if (SIGNAL_PATTERNS.meeting.some(p => p.test(fullText))) {
      detectedType = "MEETING_REQUEST"; confidence = 0.7
    } else if (SIGNAL_PATTERNS.status.some(p => p.test(fullText))) {
      detectedType = "STATUS_UPDATE"; confidence = 0.6
    }

    // Skip low-confidence unmatched emails
    if (!matchedProject && confidence < 0.6) continue

    // Build suggested action
    let suggestedAction: string | null = null
    if (matchedProject) {
      if (detectedType === "TASK_UPDATE")
        suggestedAction = `Update task status in ${matchedProject.code}`
      else if (detectedType === "RISK_MENTION")
        suggestedAction = `Log new risk in ${matchedProject.code}`
      else if (detectedType === "MEETING_REQUEST")
        suggestedAction = `Log meeting minutes in ${matchedProject.code}`
    }

    detected.push({
      emailId:      email.id,
      subject:      email.subject,
      from:         email.from?.emailAddress?.address || "",
      receivedAt:   new Date(email.receivedDateTime),
      projectId:    matchedProject?.id   || null,
      projectCode:  matchedProject?.code || null,
      projectName:  matchedProject?.name || null,
      detectedType,
      suggestedAction,
      snippet:      email.bodyPreview?.slice(0, 200) || "",
      confidence,
    })
  }

  // Sort by confidence then recency
  return detected.sort((a, b) => b.confidence - a.confidence || b.receivedAt.getTime() - a.receivedAt.getTime())
}

/**
 * Subscribe to Outlook push notifications via Graph webhooks.
 * When new email arrives, Graph calls our /api/m365/webhook endpoint.
 */
export async function subscribeToMailbox(userId: string, notificationUrl: string): Promise<string | null> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return null

  const expiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days max

  const sub = await graph.post<any>("/subscriptions", {
    changeType:         "created,updated",
    notificationUrl,
    resource:           "me/messages",
    expirationDateTime: expiry.toISOString(),
    clientState:        `flowsync-${userId}`,
  }).catch(e => { console.error("[Graph] Mail subscription failed:", e); return null })

  return sub?.id || null
}
