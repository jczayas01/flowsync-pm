// src/lib/m365/graph.ts
// Microsoft Graph API client — Outlook, Teams, Planner, SharePoint

import { Client } from '@microsoft/microsoft-graph-client'

// ─────────────────────────────────────────────
// CLIENT FACTORY
// ─────────────────────────────────────────────

export function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  })
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface M365Email {
  id: string
  subject: string
  bodyPreview: string
  from: string
  receivedAt: string
  hasAttachments: boolean
  webLink: string
}

export interface M365Meeting {
  id: string
  subject: string
  start: string
  end: string
  attendees: string[]
  bodyPreview: string
  isOnlineMeeting: boolean
  joinUrl?: string
}

export interface M365PlannerTask {
  id: string
  title: string
  percentComplete: number
  dueDateTime?: string
  assignedTo: string[]
  bucketName?: string
}

// ─────────────────────────────────────────────
// OUTLOOK — Recent project-related emails
// ─────────────────────────────────────────────

export async function getRecentEmails(
  accessToken: string,
  projectKeywords: string[],
  daysBack = 7
): Promise<M365Email[]> {
  const client = getGraphClient(accessToken)
  const since = new Date(Date.now() - daysBack * 86400000).toISOString()

  // Build keyword filter
  const keywordFilter = projectKeywords
    .slice(0, 3) // Graph API filter limit
    .map(kw => `contains(subject,'${kw}') or contains(body,'${kw}')`)
    .join(' or ')

  try {
    const res = await client
      .api('/me/messages')
      .filter(`receivedDateTime ge ${since}`)
      .search(projectKeywords[0] ?? '')
      .select('id,subject,bodyPreview,from,receivedDateTime,hasAttachments,webLink')
      .top(20)
      .orderby('receivedDateTime DESC')
      .get()

    return (res.value ?? []).map((m: any) => ({
      id: m.id,
      subject: m.subject,
      bodyPreview: m.bodyPreview,
      from: m.from?.emailAddress?.address ?? '',
      receivedAt: m.receivedDateTime,
      hasAttachments: m.hasAttachments,
      webLink: m.webLink,
    }))
  } catch (error) {
    console.error('[Graph] getRecentEmails error:', error)
    return []
  }
}

// ─────────────────────────────────────────────
// TEAMS — Recent meetings
// ─────────────────────────────────────────────

export async function getRecentMeetings(
  accessToken: string,
  daysBack = 7
): Promise<M365Meeting[]> {
  const client = getGraphClient(accessToken)
  const since = new Date(Date.now() - daysBack * 86400000).toISOString()
  const until = new Date().toISOString()

  try {
    const res = await client
      .api('/me/calendarView')
      .query({ startDateTime: since, endDateTime: until })
      .select('id,subject,start,end,attendees,bodyPreview,isOnlineMeeting,onlineMeeting')
      .filter('isOnlineMeeting eq true')
      .top(20)
      .get()

    return (res.value ?? []).map((m: any) => ({
      id: m.id,
      subject: m.subject,
      start: m.start?.dateTime,
      end: m.end?.dateTime,
      attendees: m.attendees?.map((a: any) => a.emailAddress?.address) ?? [],
      bodyPreview: m.bodyPreview,
      isOnlineMeeting: m.isOnlineMeeting,
      joinUrl: m.onlineMeeting?.joinUrl,
    }))
  } catch (error) {
    console.error('[Graph] getRecentMeetings error:', error)
    return []
  }
}

// ─────────────────────────────────────────────
// PLANNER — Sync tasks
// ─────────────────────────────────────────────

export async function getPlannerTasks(
  accessToken: string,
  planId: string
): Promise<M365PlannerTask[]> {
  const client = getGraphClient(accessToken)

  try {
    const [tasks, buckets] = await Promise.all([
      client.api(`/planner/plans/${planId}/tasks`)
        .select('id,title,percentComplete,dueDateTime,assignments,bucketId')
        .get(),
      client.api(`/planner/plans/${planId}/buckets`)
        .select('id,name')
        .get(),
    ])

    const bucketMap = Object.fromEntries(
      (buckets.value ?? []).map((b: any) => [b.id, b.name])
    )

    return (tasks.value ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      percentComplete: t.percentComplete,
      dueDateTime: t.dueDateTime,
      assignedTo: Object.keys(t.assignments ?? {}),
      bucketName: bucketMap[t.bucketId] ?? 'Unknown',
    }))
  } catch (error) {
    console.error('[Graph] getPlannerTasks error:', error)
    return []
  }
}

// ─────────────────────────────────────────────
// SHAREPOINT — List documents
// ─────────────────────────────────────────────

export async function getSharePointFiles(
  accessToken: string,
  siteId: string,
  folderPath?: string
): Promise<any[]> {
  const client = getGraphClient(accessToken)
  const path = folderPath
    ? `/sites/${siteId}/drive/root:/${folderPath}:/children`
    : `/sites/${siteId}/drive/root/children`

  try {
    const res = await client
      .api(path)
      .select('id,name,size,lastModifiedDateTime,webUrl,file')
      .top(50)
      .get()

    return res.value ?? []
  } catch (error) {
    console.error('[Graph] getSharePointFiles error:', error)
    return []
  }
}

// ─────────────────────────────────────────────
// SMART INBOX — Scan M365 for project signals
// ─────────────────────────────────────────────

export interface InboxSignal {
  type: 'email' | 'meeting' | 'planner'
  id: string
  summary: string
  suggestedAction: string
  rawData: any
  confidence: 'high' | 'medium' | 'low'
}

export async function scanProjectSignals(
  accessToken: string,
  projectName: string,
  taskTitles: string[]
): Promise<InboxSignal[]> {
  const keywords = [
    projectName,
    ...taskTitles.slice(0, 5).map(t => t.split(' ').slice(0, 3).join(' ')),
  ]

  const [emails, meetings] = await Promise.all([
    getRecentEmails(accessToken, keywords),
    getRecentMeetings(accessToken),
  ])

  const signals: InboxSignal[] = []

  // Score emails by keyword relevance
  for (const email of emails) {
    const relevance = keywords.filter(kw =>
      email.subject.toLowerCase().includes(kw.toLowerCase()) ||
      email.bodyPreview.toLowerCase().includes(kw.toLowerCase())
    ).length

    if (relevance > 0) {
      signals.push({
        type: 'email',
        id: email.id,
        summary: `Email: "${email.subject}" from ${email.from}`,
        suggestedAction: 'Review and log to project',
        rawData: email,
        confidence: relevance >= 2 ? 'high' : 'medium',
      })
    }
  }

  // Score meetings
  for (const meeting of meetings) {
    const relevance = keywords.filter(kw =>
      meeting.subject.toLowerCase().includes(kw.toLowerCase())
    ).length

    if (relevance > 0) {
      const duration = meeting.start && meeting.end
        ? Math.round((new Date(meeting.end).getTime() - new Date(meeting.start).getTime()) / 60000)
        : null

      signals.push({
        type: 'meeting',
        id: meeting.id,
        summary: `Teams meeting: "${meeting.subject}" ${duration ? `(${duration} min)` : ''} with ${meeting.attendees.length} attendees`,
        suggestedAction: duration
          ? `Log ${duration}-min meeting to minutes and update related tasks`
          : 'Log meeting to minutes',
        rawData: meeting,
        confidence: relevance >= 2 ? 'high' : 'medium',
      })
    }
  }

  // Sort by confidence
  return signals.sort((a, b) =>
    ['high', 'medium', 'low'].indexOf(a.confidence) -
    ['high', 'medium', 'low'].indexOf(b.confidence)
  )
}

// ─────────────────────────────────────────────
// TEAMS MEETING — Get transcript (if available)
// ─────────────────────────────────────────────

export async function getMeetingTranscript(
  accessToken: string,
  meetingId: string
): Promise<string | null> {
  const client = getGraphClient(accessToken)

  try {
    const res = await client
      .api(`/me/onlineMeetings/${meetingId}/transcripts`)
      .get()

    if (!res.value?.length) return null

    const transcriptId = res.value[0].id
    const content = await client
      .api(`/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
      .header('Accept', 'text/vtt')
      .get()

    // Strip VTT formatting to plain text
    return content
      .toString()
      .replace(/WEBVTT.*?\n\n/s, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> .+\n/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
  } catch {
    return null // transcripts not available for all meetings
  }
}
