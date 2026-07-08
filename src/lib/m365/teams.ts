// src/lib/m365/teams.ts
// Reads Teams meetings and chats to extract project updates

import { GraphClient } from "./graph-client"
import { db } from "@/lib/db"

export interface DetectedMeeting {
  meetingId:    string
  subject:      string
  organizer:    string
  startTime:    Date
  endTime:      Date
  attendees:    string[]
  projectId:    string | null
  projectCode:  string | null
  transcript:   string | null
  actionItems:  string[]
  suggestedMinutes: string | null
  durationMinutes:  number
}

export interface DetectedChatMessage {
  messageId:   string
  channelName: string
  teamName:    string
  sender:      string
  content:     string
  sentAt:      Date
  projectId:   string | null
  hasTaskMention: boolean
}

/**
 * Fetch recent Teams meetings for the user
 * and detect which relate to active projects.
 */
export async function detectProjectMeetings(
  userId:    string,
  daysBack:  number = 7
): Promise<DetectedMeeting[]> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return []

  // Get user's projects for matching
  const projects = await db.project.findMany({
    where: {
      status:  { in: ["ACTIVE","ON_HOLD"] },
      members: { some: { userId } },
    },
    select: { id: true, code: true, name: true },
    include: { members: { include: { user: { select: { email: true } } }, take: 20 } } as any,
  }) as any[]

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
  const until = new Date().toISOString()

  // Fetch calendar events (Teams meetings appear here)
  const events = await graph.get<{ value: any[] }>(
    `/me/calendarView?startDateTime=${since}&endDateTime=${until}` +
    `&$select=id,subject,organizer,start,end,attendees,isOnlineMeeting,onlineMeeting,bodyPreview` +
    `&$filter=isOnlineMeeting eq true&$top=20&$orderby=start/dateTime desc`
  ).catch(() => ({ value: [] }))

  const detected: DetectedMeeting[] = []

  for (const event of events.value || []) {
    const subject = (event.subject || "").toLowerCase()
    const body    = (event.bodyPreview || "").toLowerCase()

    // Match to project
    let matchedProject: any = null
    for (const proj of projects) {
      if (
        subject.includes(proj.code.toLowerCase()) ||
        subject.includes(proj.name.toLowerCase().slice(0, 12)) ||
        body.includes(proj.code.toLowerCase())
      ) {
        matchedProject = proj
        break
      }
    }

    const attendees = (event.attendees || []).map(
      (a: any) => a.emailAddress?.address || ""
    ).filter(Boolean)

    const startTime = new Date(event.start?.dateTime || event.start)
    const endTime   = new Date(event.end?.dateTime   || event.end)
    const duration  = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    detected.push({
      meetingId:   event.id,
      subject:     event.subject || "(No subject)",
      organizer:   event.organizer?.emailAddress?.address || "",
      startTime,
      endTime,
      attendees,
      projectId:   matchedProject?.id   || null,
      projectCode: matchedProject?.code || null,
      transcript:  null, // fetched separately if transcript available
      actionItems: extractActionItems(event.bodyPreview || ""),
      suggestedMinutes: matchedProject
        ? buildMinutesDraft(event, matchedProject, attendees, duration)
        : null,
      durationMinutes: duration,
    })
  }

  return detected.filter(m => m.projectId || m.durationMinutes > 15)
}

/**
 * Fetch recent Teams channel messages mentioning project codes.
 */
export async function detectProjectChatMentions(
  userId: string
): Promise<DetectedChatMessage[]> {
  const graph = await GraphClient.forUser(userId)
  if (!graph) return []

  const projects = await db.project.findMany({
    where:  { members: { some: { userId } }, status: "ACTIVE" },
    select: { id: true, code: true, name: true },
  })

  // Get user's joined teams
  const teamsRes = await graph.get<{ value: any[] }>("/me/joinedTeams").catch(() => ({ value: [] }))
  const detected: DetectedChatMessage[] = []

  for (const team of (teamsRes.value || []).slice(0, 5)) {
    const channelsRes = await graph.get<{ value: any[] }>(
      `/teams/${team.id}/channels`
    ).catch(() => ({ value: [] }))

    for (const channel of (channelsRes.value || []).slice(0, 3)) {
      const msgs = await graph.get<{ value: any[] }>(
        `/teams/${team.id}/channels/${channel.id}/messages` +
        `?$top=20&$filter=lastModifiedDateTime ge ${new Date(Date.now() - 7*86400000).toISOString()}`
      ).catch(() => ({ value: [] }))

      for (const msg of (msgs.value || [])) {
        const content = msg.body?.content?.replace(/<[^>]+>/g, "") || ""
        const lower   = content.toLowerCase()

        let matchedProject = null
        for (const proj of projects) {
          if (lower.includes(proj.code.toLowerCase())) {
            matchedProject = proj; break
          }
        }
        if (!matchedProject) continue

        const hasTaskMention = /task|t-\d{3}|action item|to-do/i.test(content)

        detected.push({
          messageId:      msg.id,
          channelName:    channel.displayName,
          teamName:       team.displayName,
          sender:         msg.from?.user?.displayName || "Unknown",
          content:        content.slice(0, 500),
          sentAt:         new Date(msg.createdDateTime),
          projectId:      matchedProject.id,
          hasTaskMention,
        })
      }
    }
  }

  return detected.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
}

// ── Helpers ──

function extractActionItems(text: string): string[] {
  const lines = text.split(/\n|\.|;/)
  return lines
    .filter(l => /action|todo|to-do|follow.?up|will|shall|must|should/i.test(l))
    .map(l => l.trim())
    .filter(l => l.length > 10 && l.length < 200)
    .slice(0, 5)
}

function buildMinutesDraft(
  event:    any,
  project:  any,
  attendees:string[],
  duration: number
): string {
  const date = new Date(event.start?.dateTime || event.start).toDateString()
  return [
    `MEETING MINUTES — ${project.code} ${project.name}`,
    `Date: ${date}`,
    `Duration: ${duration} minutes`,
    `Attendees: ${attendees.slice(0, 6).join(", ")}`,
    `Subject: ${event.subject}`,
    ``,
    `DISCUSSION:`,
    event.bodyPreview?.slice(0, 400) || "(No notes captured)",
    ``,
    `ACTION ITEMS:`,
    `[To be confirmed by attendees]`,
    ``,
    `Next meeting: TBD`,
  ].join("\n")
}
