// src/components/settings/M365SmartInbox.tsx
"use client"
// The missing last mile of the M365 integration: a "Sync now" button that
// calls /api/m365/sync and a review panel for what was detected — emails,
// meetings, and Teams mentions matched to projects — with one-click apply
// through the existing acceptSuggestion actions.
import { useState } from "react"

const NAVY = "#0D1B2A", SLATE = "#64748B", GREEN = "#047857", STEEL = "#1B6CA8"

type Item = {
  kind: "email" | "meeting" | "chat"
  id: string
  title: string
  meta: string
  snippet?: string
  projectId: string | null
  projectLabel: string | null
  action: "log_minutes" | "create_task" | "log_risk"
  actionLabel: string
  data: Record<string, unknown>
}

function mapPayload(d: any): Item[] {
  const items: Item[] = []
  for (const e of d?.emails ?? []) {
    const risky = e.detectedType === "RISK_MENTION"
    const task  = e.detectedType === "TASK_UPDATE"
    items.push({
      kind: "email", id: e.emailId, title: e.subject || "(no subject)",
      meta: `✉️ ${e.from} · ${new Date(e.receivedAt).toLocaleString()}`,
      snippet: e.snippet,
      projectId: e.projectId, projectLabel: e.projectCode || e.projectName,
      action: risky ? "log_risk" : task ? "create_task" : "log_minutes",
      actionLabel: risky ? "Log as risk" : task ? "Create task" : "Log as note",
      data: risky
        ? { title: e.subject, description: e.snippet }
        : task
          ? { title: e.subject, description: e.snippet }
          : { content: `Email from ${e.from}: ${e.subject}\n\n${e.snippet || ""}` },
    })
  }
  for (const m of d?.meetings ?? []) {
    items.push({
      kind: "meeting", id: m.meetingId, title: m.subject || "(meeting)",
      meta: `📅 ${m.organizer} · ${new Date(m.startTime).toLocaleString()} · ${m.durationMinutes} min`,
      snippet: m.suggestedMinutes || (m.actionItems?.length ? `Action items: ${m.actionItems.join("; ")}` : undefined),
      projectId: m.projectId, projectLabel: m.projectCode,
      action: "log_minutes", actionLabel: "Log minutes",
      data: {
        meetingStart: m.startTime, meetingEnd: m.endTime,
        minutes: m.suggestedMinutes ||
          `Meeting: ${m.subject}\nOrganizer: ${m.organizer}\nAttendees: ${(m.attendees||[]).join(", ")}` +
          (m.actionItems?.length ? `\nAction items:\n- ${m.actionItems.join("\n- ")}` : ""),
      },
    })
  }
  for (const c of d?.chats ?? []) {
    items.push({
      kind: "chat", id: c.messageId, title: `${c.teamName} / ${c.channelName}`,
      meta: `💬 ${c.sender} · ${new Date(c.sentAt).toLocaleString()}`,
      snippet: c.content,
      projectId: c.projectId, projectLabel: null,
      action: c.hasTaskMention ? "create_task" : "log_minutes",
      actionLabel: c.hasTaskMention ? "Create task" : "Log as note",
      data: c.hasTaskMention
        ? { title: c.content?.slice(0, 80), description: c.content }
        : { content: `Teams (${c.channelName}) ${c.sender}: ${c.content}` },
    })
  }
  return items
}

export function M365SmartInbox({ connected }: { connected: boolean }) {
  const [items, setItems]     = useState<Item[] | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError]     = useState("")
  const [applied, setApplied] = useState<Record<string,string>>({})
  const [syncedAt, setSyncedAt] = useState<string>("")

  async function syncNow() {
    setSyncing(true); setError("")
    try {
      const res = await fetch("/api/m365/sync")
      const d   = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error || (res.status === 503
          ? "The integration flag is not enabled on the server."
          : "Sync failed — check your Microsoft connection."))
        setItems(null); return
      }
      setItems(mapPayload(d.data))
      setSyncedAt(new Date().toLocaleTimeString())
    } catch {
      setError("Sync failed — network error.")
    } finally { setSyncing(false) }
  }

  async function apply(it: Item) {
    if (!it.projectId) return
    setApplied(a => ({ ...a, [it.id]: "…" }))
    const res = await fetch("/api/m365/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: it.kind, entityId: it.id, projectId: it.projectId, action: it.action, data: it.data }),
    })
    const d = await res.json().catch(() => ({}))
    setApplied(a => ({ ...a, [it.id]: res.ok ? (d?.data?.message || "Applied ✓") : (d?.error || "Failed") }))
  }

  if (!connected) return null

  return (
    <div style={{ marginTop:16, background:"#fff", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 18px",
        borderBottom:"1px solid var(--border)" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:NAVY }}>Smart inbox</div>
          <div style={{ fontSize:11.5, color:SLATE }}>
            Emails, meetings, and Teams mentions that look project-related. Detection matches the
            subject against your project names and codes.
            {syncedAt && ` · Last sync ${syncedAt}`}
          </div>
        </div>
        <button onClick={syncNow} disabled={syncing}
          style={{ padding:"9px 18px", background: syncing ? "#94A3B8" : STEEL, color:"#fff",
            border:"none", borderRadius:8, fontSize:12.5, fontWeight:700,
            cursor: syncing ? "default" : "pointer", fontFamily:"var(--font)" }}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {error && (
        <div style={{ margin:14, padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA",
          borderRadius:8, fontSize:12.5, color:"#B91C1C" }}>{error}</div>
      )}

      {items && items.length === 0 && !error && (
        <div style={{ padding:"18px", fontSize:12.5, color:SLATE }}>
          Nothing project-related detected in the recent window. Tip: include the project code
          (e.g. "PRJ-001") or the exact project name in email subjects and meeting titles.
          Only Active or On-hold projects where you are a team member are matched.
        </div>
      )}

      {items && items.length > 0 && (
        <div>
          {items.map(it => (
            <div key={it.id} style={{ display:"flex", gap:12, padding:"12px 18px",
              borderTop:"1px solid #F1F5F9", alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:NAVY }}>{it.title}</div>
                <div style={{ fontSize:11, color:SLATE, marginTop:1 }}>{it.meta}</div>
                {it.snippet && (
                  <div style={{ fontSize:11.5, color:"#475569", marginTop:4, lineHeight:1.5,
                    overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                    {it.snippet}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                {it.projectLabel
                  ? <span style={{ fontSize:10.5, fontWeight:700, color:GREEN, background:"#ECFDF5",
                      padding:"2px 8px", borderRadius:99 }}>{it.projectLabel}</span>
                  : <span style={{ fontSize:10.5, color:"#94A3B8" }}>No project matched</span>}
                {applied[it.id]
                  ? <span style={{ fontSize:11.5, color: applied[it.id].includes("Fail") ? "#B91C1C" : GREEN,
                      fontWeight:600 }}>{applied[it.id]}</span>
                  : (
                    <button onClick={() => apply(it)} disabled={!it.projectId}
                      title={!it.projectId ? "Include the project code in the subject so it can be matched" : undefined}
                      style={{ padding:"5px 12px", fontSize:11.5, fontWeight:700,
                        background: it.projectId ? "#ECFDF5" : "#F8FAFC",
                        color: it.projectId ? GREEN : "#CBD5E1",
                        border:`1px solid ${it.projectId ? "#A7F3D0" : "#E2E8F0"}`,
                        borderRadius:8, cursor: it.projectId ? "pointer" : "default",
                        fontFamily:"var(--font)" }}>
                      {it.actionLabel}
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
