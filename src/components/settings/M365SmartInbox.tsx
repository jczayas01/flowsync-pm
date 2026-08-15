"use client"
// src/components/settings/M365SmartInbox.tsx
// The missing last mile of the M365 integration: a "Sync now" button that
// calls /api/m365/sync and a review panel for what was detected — emails,
// meetings, and Teams mentions matched to projects — with one-click apply
// through the existing acceptSuggestion actions.
import { useState } from "react"
import { useTranslations } from "next-intl"

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
      meta: `✉ï¸ ${e.from} · ${new Date(e.receivedAt).toLocaleString()}`,
      snippet: e.snippet,
      projectId: e.projectId, projectLabel: e.projectCode || e.projectName,
      action: risky ? "log_risk" : task ? "create_task" : "log_minutes",
      actionLabel: risky ? "logAsRisk" : task ? "createTask" : "logAsNote",
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
      action: "log_minutes", actionLabel: "logMinutes",
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
      actionLabel: c.hasTaskMention ? "createTask" : "logAsNote",
      data: c.hasTaskMention
        ? { title: c.content?.slice(0, 80), description: c.content }
        : { content: `Teams (${c.channelName}) ${c.sender}: ${c.content}` },
    })
  }
  return items
}

export function M365SmartInbox({ connected }: { connected: boolean }) {
  const mi = useTranslations("m365SmartInbox")
  const [items, setItems]     = useState<Item[] | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError]     = useState("")
  const [applied, setApplied] = useState<Record<string,string>>({})
  const [connLost, setConnLost] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string>("")
  const [days, setDays] = useState(7)
  const [unreadOnly, setUnreadOnly] = useState(false)

  async function syncNow() {
    setSyncing(true); setError("")
    try {
      const res = await fetch(`/api/m365/sync?days=${days}&unread=${unreadOnly ? 1 : 0}`)
      const d   = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error || (res.status === 503
          ? "The integration flag is not enabled on the server."
          : "Sync failed — check your Microsoft connection."))
        setItems(null); return
      }
      setItems(mapPayload(d.data))
      setConnLost(!!d.data?.connectionError)
      setSyncedAt(new Date().toLocaleTimeString())
    } catch {
      setError("Sync failed — network error.")
    } finally { setSyncing(false) }
  }

  async function apply(it: Item) {
    if (!it.projectId) return
    setApplied(a => ({ ...a, [it.id]: "…" }))
    const res = await fetch(`/api/m365/sync?days=${days}&unread=${unreadOnly ? 1 : 0}`, {
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
          <div style={{ fontSize:13.5, fontWeight:700, color:NAVY }}>{mi("Smart inbox")}</div>
          <div style={{ fontSize:11.5, color:SLATE }}>
            {mi("detectionHint")}
            {syncedAt && ` · ${mi("lastSync",{t:syncedAt})}`}
          </div>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          title={mi("How far back to scan your mailbox")}
          style={{ fontSize:12, padding:"5px 8px", borderRadius:7,
            border:"1px solid var(--border,#E2E8F0)", background:"#fff",
            color:"var(--text-2)", cursor:"pointer", fontFamily:"var(--font)" }}>
          <option value={7}>{mi("Last 7 days")}</option>
          <option value={14}>{mi("Last 14 days")}</option>
          <option value={30}>{mi("Last 30 days")}</option>
        </select>
        <label title={mi("Only messages you haven't opened yet")}
          style={{ display:"flex", alignItems:"center", gap:5, fontSize:12,
            color:"var(--text-2)", cursor:"pointer", userSelect:"none" }}>
          <input type="checkbox" checked={unreadOnly}
            onChange={e => setUnreadOnly(e.target.checked)} />
          {mi("Unread only")}
        </label>
        <button onClick={syncNow} disabled={syncing}
          style={{ padding:"9px 18px", background: syncing ? "#94A3B8" : STEEL, color:"#fff",
            border:"none", borderRadius:8, fontSize:12.5, fontWeight:700,
            cursor: syncing ? "default" : "pointer", fontFamily:"var(--font)" }}>
          {syncing ? mi("Syncing…") : mi("Sync now")}
        </button>
      </div>

      {error && (
        <div style={{ margin:14, padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA",
          borderRadius:8, fontSize:12.5, color:"#B91C1C" }}>{error}</div>
      )}

      {connLost && (
        <div style={{ margin:14, padding:"10px 14px", background:"#FFFBEB", border:"1px solid #FDE68A",
          borderRadius:8, fontSize:12.5, color:"#92400E" }}>
          {mi.rich("connLostRich",{b:c=><b>{c}</b>})}
        </div>
      )}

      {items && items.length === 0 && !error && !connLost && (
        <div style={{ padding:"18px", fontSize:12.5, color:SLATE }}>
          {mi("noItemsHint")}
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
                  : <span style={{ fontSize:10.5, color:"#94A3B8" }}>{mi("No project matched")}</span>}
                {applied[it.id]
                  ? <span style={{ fontSize:11.5, color: applied[it.id].includes("Fail") ? "#B91C1C" : GREEN,
                      fontWeight:600 }}>{applied[it.id]}</span>
                  : (
                    <button onClick={() => apply(it)} disabled={!it.projectId}
                      title={!it.projectId ? mi("noProjectTip") : undefined}
                      style={{ padding:"5px 12px", fontSize:11.5, fontWeight:700,
                        background: it.projectId ? "#ECFDF5" : "#F8FAFC",
                        color: it.projectId ? GREEN : "#CBD5E1",
                        border:`1px solid ${it.projectId ? "#A7F3D0" : "#E2E8F0"}`,
                        borderRadius:8, cursor: it.projectId ? "pointer" : "default",
                        fontFamily:"var(--font)" }}>
                      {mi(it.actionLabel as any)}
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
