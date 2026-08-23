"use client"
// src/components/shared/TimeLogPanel.tsx
// Logs hours against a task or project. This is the missing human link in the
// chain resources → cost: a TimeEntry is what postLaborActuals turns into
// labour actuals on the budget line of the task it was logged against.
//
// Rate resolution (server-side, in that order): the rate typed here → the
// member's costRate from Settings → Team → nothing (hours recorded, no cost).

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

type Entry = {
  id: string; hours: number; date: string; description?: string | null
  billable: boolean; hourlyRate?: number | null; costPostedAt?: string | null
  user?: { id: string; name: string }
  task?: { id: string; code?: string | null; title: string } | null
}

export function TimeLogPanel({ projectId, taskId, taskTitle, workspaceId, compact, onLogged }: {
  projectId: string
  taskId?: string
  taskTitle?: string
  workspaceId?: string
  compact?: boolean
  onLogged?: () => void
}) {
  const t = useTranslations("time")
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [hours, setHours] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [desc, setDesc] = useState("")
  const [billable, setBillable] = useState(true)
  const [rate, setRate] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Task context: the estimate to work against, and the budget line the cost
  // lands on. Without a line, postLaborActuals has nowhere to charge the hours.
  const [task, setTask] = useState<any>(null)
  const [budgetLines, setBudgetLines] = useState<any[]>([])
  const [budgetItemId, setBudgetItemId] = useState<string>("")
  const [savingLine, setSavingLine] = useState(false)

  const H = () => ({ "Content-Type": "application/json", ...(workspaceId ? { "x-workspace-id": workspaceId } : {}) })

  async function load() {
    const q = new URLSearchParams({ projectId, perPage: "50" })
    const r = await fetch(`/api/time?${q}`, { headers: workspaceId ? { "x-workspace-id": workspaceId } : {}, cache: "no-store" })
    const d = await r.json().catch(() => ({}))
    const rows: Entry[] = d?.data?.entries || d?.entries || d?.data || []
    setEntries(taskId ? rows.filter(e => e.task?.id === taskId) : rows)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, taskId])

  useEffect(() => {
    // Budget lines are needed in both modes so the user can see (task) or pick
    // (project-level entry) where the cost goes.
    fetch(`/api/projects/${projectId}/budget`, {
      headers: workspaceId ? { "x-workspace-id": workspaceId } : {}, cache: "no-store" })
      .then(r => r.json()).then(d => setBudgetLines(d?.data?.items || d?.data || d?.items || []))
      .catch(() => {})
    if (!taskId) return
    fetch(`/api/tasks/${taskId}`, { headers: workspaceId ? { "x-workspace-id": workspaceId } : {}, cache: "no-store" })
      .then(r => r.json()).then(d => {
        const tk = d?.data || d
        setTask(tk)
        if (tk?.budgetItemId) setBudgetItemId(tk.budgetItemId)
      }).catch(() => {})
  }, [projectId, taskId, workspaceId])

  /** Assign the budget line on the task — that is the control account
   *  postLaborActuals reads, so setting it here makes the cost flow. */
  async function assignLine(id: string) {
    setBudgetItemId(id)
    if (!taskId) return
    setSavingLine(true)
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: H(),
        body: JSON.stringify({ budgetItemId: id || null }) })
    } finally { setSavingLine(false) }
  }

  async function submit() {
    const h = Number(hours)
    // Client-side guard so the user sees WHY, instead of a bare "Validation
    // failed" from the server schema (min 0.25, max 24 — one entry is one day).
    if (!h || Number.isNaN(h)) { setMsg({ ok: false, text: t("errHours") }); return }
    if (h < 0.25) { setMsg({ ok: false, text: t("errMin") }); return }
    if (h > 24)   { setMsg({ ok: false, text: t("errMax") }); return }
    if (taskId && !budgetItemId && budgetLines.length > 0) {
      setMsg({ ok: false, text: t("errNoLine") }); return
    }
    setBusy(true); setMsg(null)
    try {
      const res = await fetch("/api/time", {
        method: "POST", headers: H(),
        body: JSON.stringify({
          projectId, taskId: taskId || null,
          date: new Date(date + "T12:00:00Z").toISOString(),
          hours: h, description: desc || undefined, billable,
          ...(rate ? { hourlyRate: Number(rate) } : {}),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = d?.details && typeof d.details === "object"
          ? Object.entries(d.details).map(([k, v]) => `${k}: ${v}`).join(" · ") : ""
        setMsg({ ok: false, text: detail || d?.error || t("errSave") }); return
      }
      setHours(""); setDesc(""); setRate("")
      setMsg({ ok: true, text: t("logged", { h }) })
      await load(); onLogged?.()
      setTimeout(() => setMsg(null), 4000)
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return
    const r = await fetch(`/api/time/${id}`, { method: "DELETE", headers: H() })
    if (r.ok) { await load(); onLogged?.() } else setMsg({ ok: false, text: t("errDelete") })
  }

  const total = (entries || []).reduce((s, e) => s + Number(e.hours || 0), 0)
  const posted = (entries || []).filter(e => e.costPostedAt).reduce((s, e) => s + Number(e.hours || 0), 0)

  const inp: React.CSSProperties = { padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6,
    fontSize: 13, fontFamily: "var(--font)", background: "#fff", color: "var(--text)", boxSizing: "border-box" }
  const lbl: React.CSSProperties = { display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--text-3)", marginBottom: 3 }

  return (
    <div style={{ marginTop: compact ? 10 : 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8,
        paddingBottom: 5, borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          {t("title")}
        </span>
        {taskTitle && <span style={{ fontSize: 11, color: "var(--text-3)" }}>· {taskTitle}</span>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
          {t("totalHours", { h: total.toLocaleString("en-US", { maximumFractionDigits: 2 }) })}
          {posted > 0 && <span style={{ color: "var(--green,#059669)", marginLeft: 8 }}>
            {t("postedHours", { h: posted.toLocaleString("en-US", { maximumFractionDigits: 2 }) })}</span>}
        </span>
      </div>

      {/* Task context — what was estimated vs what has been logged */}
      {taskId && task && (() => {
        const est = Number(task.estimatedHours || 0)
        const pct = Math.min(100, Math.max(0, Number(task.percentComplete || 0)))
        const rem = task.remainingHours != null ? Number(task.remainingHours) : est * (1 - pct / 100)
        const over = est > 0 && total > est
        return (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
            background: "var(--surface,#F8FAFC)", border: "1px solid var(--border)", borderRadius: 8,
            padding: "9px 12px", marginBottom: 10, fontSize: 12 }}>
            <span><span style={{ color: "var(--text-3)" }}>{t("taskEstimate")}: </span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{est ? `${est} h` : "—"}</b></span>
            <span><span style={{ color: "var(--text-3)" }}>{t("taskLogged")}: </span>
              <b style={{ color: over ? "var(--red,#DC2626)" : "var(--steel)", fontVariantNumeric: "tabular-nums" }}>
                {total.toFixed(2)} h</b></span>
            <span><span style={{ color: "var(--text-3)" }}>{t("taskRemaining")}: </span>
              <b style={{ color: "#B45309", fontVariantNumeric: "tabular-nums" }}>{rem.toFixed(2)} h</b></span>
            <span><span style={{ color: "var(--text-3)" }}>{t("taskProgress")}: </span>
              <b>{pct}%</b></span>
            {over && <span style={{ color: "var(--red,#DC2626)", fontWeight: 700 }}>
              {t("overEstimate", { h: (total - est).toFixed(2) })}</span>}
          </div>
        )
      })()}

      {/* Budget line — the control account the hours charge to */}
      {budgetLines.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>{t("budgetLine")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={budgetItemId} onChange={e => assignLine(e.target.value)} disabled={savingLine}
              style={{ ...inp, minWidth: 280, cursor: "pointer" }}>
              <option value="">{t("noLine")}</option>
              {budgetLines.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.plannedCost ? ` — $${Number(b.plannedCost).toLocaleString("en-US")}` : ""}
                </option>
              ))}
            </select>
            {savingLine && <span style={{ fontSize: 11, color: "var(--text-3)" }}>…</span>}
            {taskId && budgetItemId && !savingLine &&
              <span style={{ fontSize: 11, color: "var(--green,#059669)", fontWeight: 600 }}>✓ {t("lineSaved")}</span>}
            {!budgetItemId &&
              <span style={{ fontSize: 11, color: "#B45309" }}>{t("noLineWarn")}</span>}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: compact
        ? "80px 130px 1fr auto" : "90px 140px 1fr 110px auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <div>
          <label style={lbl}>{t("hours")}</label>
          <input style={{ ...inp, borderColor: Number(hours) > 24 ? "var(--red,#DC2626)" : undefined }}
            type="number" step="0.25" min="0.25" max="24" value={hours}
            onChange={e => setHours(e.target.value)} placeholder="0.00"
            title={t("hoursHint")}
            onKeyDown={e => { if (e.key === "Enter") submit() }} />
        </div>
        <div>
          <label style={lbl}>{t("date")}</label>
          <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>{t("description")}</label>
          <input style={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("descPh")}
            onKeyDown={e => { if (e.key === "Enter") submit() }} />
        </div>
        {!compact && (
          <div>
            <label style={lbl}>{t("rateOverride")}</label>
            <input style={inp} type="number" step="0.01" min="0" value={rate}
              onChange={e => setRate(e.target.value)} placeholder={t("ratePh")} />
          </div>
        )}
        <button onClick={submit} disabled={busy}
          style={{ padding: "8px 14px", background: "var(--steel)", color: "#fff", border: "none",
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer",
            fontFamily: "var(--font)", whiteSpace: "nowrap", height: 34 }}>
          {busy ? "…" : t("log")}
        </button>
      </div>

      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11.5, color: "var(--text-2)",
        cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} />
        {t("billable")}
      </label>

      {msg && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8,
        color: msg.ok ? "var(--green,#059669)" : "var(--red,#DC2626)" }}>{msg.ok ? "✓ " : "✗ "}{msg.text}</div>}

      {entries && entries.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {entries.slice(0, compact ? 5 : 15).map(e => (
            <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 11px",
              borderBottom: "1px solid var(--surface-1,#F1F5F9)", fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 52, fontVariantNumeric: "tabular-nums" }}>
                {Number(e.hours).toFixed(2)} h
              </span>
              <span style={{ color: "var(--text-3)", minWidth: 84 }}>
                {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
              </span>
              <span style={{ color: "var(--text-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }}>
                {e.description || (e.task ? e.task.title : "—")}
              </span>
              {e.user?.name && <span style={{ color: "var(--text-3)", fontSize: 11 }}>{e.user.name}</span>}
              {!e.billable && <span style={{ fontSize: 10, color: "var(--text-3)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "0 6px" }}>{t("nonBillable")}</span>}
              {e.costPostedAt
                ? <span title={t("postedTitle")} style={{ fontSize: 10.5, color: "var(--green,#059669)", fontWeight: 700 }}>{t("posted")}</span>
                : <span title={t("pendingTitle")} style={{ fontSize: 10.5, color: "#B45309", fontWeight: 700 }}>{t("pending")}</span>}
              {!e.costPostedAt && (
                <button onClick={() => remove(e.id)} title={t("delete")}
                  style={{ border: "none", background: "none", color: "var(--red,#DC2626)", cursor: "pointer",
                    fontSize: 12, padding: "0 2px" }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      {entries && entries.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>{t("empty")}</div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 8, lineHeight: 1.6 }}>{t("footnote")}</div>
    </div>
  )
}
