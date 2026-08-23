"use client"
// src/components/shared/TimesheetGrid.tsx
// Week grid: rows are the tasks you're assigned, columns are Mon–Sun. This is
// how Harvest, Replicon and P6 capture time, and why one-entry-at-a-time forms
// lose to them — a week of work is 30 seconds here instead of 15 separate saves.
//
// Cells hold hours. Save writes only what changed. Submitting sends the week
// for approval; only approved hours reach the budget.

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

type Task = { id: string; code?: string | null; title: string; projectId: string
  project?: { name?: string; code?: string } | null; budgetItemId?: string | null }
type Entry = { id: string; taskId?: string | null; projectId: string; date: string
  hours: number; status?: string; costPostedAt?: string | null; billable: boolean }

const DAY = 86400000
const iso = (d: Date) => d.toISOString().slice(0, 10)
function mondayOf(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7          // Mon = 0
  return new Date(x.getTime() - dow * DAY)
}

export function TimesheetGrid({ projectId, workspaceId, userId, onChanged }: {
  projectId?: string; workspaceId?: string; userId?: string; onChanged?: () => void
}) {
  const t = useTranslations("timesheet")
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})   // `${taskId}|${date}` → hours
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY)), [weekStart])
  const H = (): Record<string, string> => ({ "Content-Type": "application/json", ...(workspaceId ? { "x-workspace-id": workspaceId } : {}) })
  const hdr = (): Record<string, string> => (workspaceId ? { "x-workspace-id": workspaceId } : {})

  async function load() {
    setLoading(true)
    try {
      const from = iso(weekStart), to = iso(new Date(weekStart.getTime() + 6 * DAY))
      const [tr, er] = await Promise.all([
        fetch(`/api/tasks?${new URLSearchParams({ ...(projectId ? { projectId } : {}),
          ...(userId ? { assigneeId: userId } : {}), perPage: "100" })}`,
          { headers: hdr(), cache: "no-store" }),
        fetch(`/api/time?${new URLSearchParams({ ...(projectId ? { projectId } : {}), from, to, perPage: "200" })}`,
          { headers: hdr(), cache: "no-store" }),
      ])
      const td = await tr.json().catch(() => ({}))
      const ed = await er.json().catch(() => ({}))
      const rows: Task[] = td?.data?.items || td?.data || td?.items || []
      setTasks(rows.filter(Boolean))
      const ents: Entry[] = (ed?.data?.entries || ed?.entries || []).map((e: any) => ({
        ...e, hours: Number(e.hours || 0), taskId: e.task?.id || e.taskId || null,
      }))
      setEntries(ents)
      const seed: Record<string, string> = {}
      for (const e of ents) {
        if (!e.taskId) continue
        const k = `${e.taskId}|${String(e.date).slice(0, 10)}`
        seed[k] = String((Number(seed[k] || 0) + e.hours).toFixed(2))
      }
      setDraft(seed)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, weekStart.getTime()])

  const original = useMemo(() => {
    const o: Record<string, number> = {}
    for (const e of entries) {
      if (!e.taskId) continue
      const k = `${e.taskId}|${String(e.date).slice(0, 10)}`
      o[k] = (o[k] || 0) + e.hours
    }
    return o
  }, [entries])

  const changed = useMemo(() =>
    Object.keys(draft).filter(k => Number(draft[k] || 0) !== (original[k] || 0)), [draft, original])

  const dayTotal = (d: Date) => tasks.reduce((s, tk) => s + Number(draft[`${tk.id}|${iso(d)}`] || 0), 0)
  const rowTotal = (tk: Task) => days.reduce((s, d) => s + Number(draft[`${tk.id}|${iso(d)}`] || 0), 0)
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0)

  // Status of a cell that already exists — drives the lock and the colour.
  const cellState = (taskId: string, date: string) => {
    const es = entries.filter(e => e.taskId === taskId && String(e.date).slice(0, 10) === date)
    if (!es.length) return null
    if (es.some(e => e.costPostedAt)) return "POSTED"
    if (es.every(e => e.status === "APPROVED")) return "APPROVED"
    if (es.some(e => e.status === "SUBMITTED")) return "SUBMITTED"
    if (es.some(e => e.status === "REJECTED")) return "REJECTED"
    return "DRAFT"
  }

  async function save(submit = false) {
    if (!changed.length) { setMsg({ ok: false, text: t("nothingToSave") }); return }
    setBusy(true); setMsg(null)
    let written = 0, failed = 0
    try {
      for (const key of changed) {
        const [taskId, date] = key.split("|")
        const want = Number(draft[key] || 0)
        const existing = entries.filter(e => e.taskId === taskId && String(e.date).slice(0, 10) === date)
        const editable = existing.filter(e => !e.costPostedAt)

        // Replace the day's editable entries with a single one — a timesheet
        // cell is one number, not a growing pile of duplicates.
        for (const e of editable) {
          await fetch(`/api/time/${e.id}`, { method: "DELETE", headers: hdr() }).catch(() => {})
        }
        if (want <= 0) continue
        const task = tasks.find(x => x.id === taskId)
        const r = await fetch("/api/time", {
          method: "POST", headers: H(),
          body: JSON.stringify({
            projectId: task?.projectId || projectId, taskId,
            date: new Date(date + "T12:00:00Z").toISOString(),
            hours: want, billable: true,
            ...(submit ? { status: "SUBMITTED" } : {}),
          }),
        })
        r.ok ? written++ : failed++
      }
      setMsg(failed
        ? { ok: false, text: t("savedPartial", { n: written, f: failed }) }
        : { ok: true, text: submit ? t("submitted", { n: written }) : t("saved", { n: written }) })
      await load(); onChanged?.()
      setTimeout(() => setMsg(null), 6000)
    } finally { setBusy(false) }
  }

  const shift = (w: number) => setWeekStart(new Date(weekStart.getTime() + w * 7 * DAY))
  const isToday = (d: Date) => iso(d) === iso(new Date())
  const isWeekend = (d: Date) => [5, 6].includes((d.getUTCDay() + 6) % 7)

  const cellStyle = (state: string | null, weekend: boolean): React.CSSProperties => ({
    width: "100%", padding: "6px 4px", textAlign: "center", fontSize: 13,
    border: "1px solid " + (state === "REJECTED" ? "#FCA5A5" : "var(--border)"),
    borderRadius: 5, fontFamily: "var(--font)", boxSizing: "border-box",
    background: state === "POSTED" ? "#F1F5F9" : state === "APPROVED" ? "#ECFDF5"
      : state === "SUBMITTED" ? "#EFF6FF" : state === "REJECTED" ? "#FEF2F2"
      : weekend ? "#FAFAFA" : "#fff",
    color: state === "POSTED" ? "var(--text-3)" : "var(--text)",
    fontVariantNumeric: "tabular-nums",
  })

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={() => shift(-1)} style={navBtn}>←</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
          {" – "}
          {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
        </span>
        <button onClick={() => shift(1)} style={navBtn}>→</button>
        <button onClick={() => setWeekStart(mondayOf(new Date()))} style={{ ...navBtn, width: "auto", padding: "0 10px" }}>
          {t("thisWeek")}
        </button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-2)" }}>
          {t("weekTotal")}: <b style={{ fontSize: 15, color: weekTotal > 60 ? "#B45309" : "var(--text)",
            fontVariantNumeric: "tabular-nums" }}>{weekTotal.toFixed(2)} h</b>
        </span>
      </div>

      {loading ? <div style={{ padding: 20, color: "var(--text-3)", fontSize: 13 }}>…</div>
        : tasks.length === 0 ? (
        <div style={{ padding: 20, color: "var(--text-3)", fontSize: 13, textAlign: "center",
          border: "1px dashed var(--border)", borderRadius: 8 }}>{t("noTasks")}</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "var(--surface,#F8FAFC)" }}>
                <th style={{ ...th, textAlign: "left", minWidth: 240 }}>{t("task")}</th>
                {days.map(d => (
                  <th key={iso(d)} style={{ ...th, width: 72,
                    background: isToday(d) ? "var(--steel-pale,#EFF6FF)" : undefined,
                    color: isToday(d) ? "var(--steel)" : "var(--text-3)" }}>
                    <div>{d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</div>
                    <div style={{ fontWeight: 400, fontSize: 10 }}>
                      {d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", timeZone: "UTC" })}</div>
                  </th>
                ))}
                <th style={{ ...th, width: 66 }}>{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(tk => (
                <tr key={tk.id}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--surface-1,#F1F5F9)" }}>
                    <div style={{ fontSize: 12.5, color: "var(--text)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{tk.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                      {tk.code || ""}{tk.project?.name ? ` · ${tk.project.name}` : ""}
                      {!tk.budgetItemId && <span style={{ color: "#B45309" }}> · {t("noBudgetLine")}</span>}
                    </div>
                  </td>
                  {days.map(d => {
                    const k = `${tk.id}|${iso(d)}`
                    const st = cellState(tk.id, iso(d))
                    const locked = st === "POSTED" || st === "APPROVED"
                    return (
                      <td key={k} style={{ padding: 3, borderBottom: "1px solid var(--surface-1,#F1F5F9)" }}>
                        <input value={draft[k] ?? ""} disabled={locked}
                          onChange={e => setDraft({ ...draft, [k]: e.target.value.replace(/[^\d.]/g, "") })}
                          placeholder="—" title={st ? t("state_" + st) : undefined}
                          style={cellStyle(st, isWeekend(d))} />
                      </td>
                    )
                  })}
                  <td style={{ padding: "6px 8px", textAlign: "center", fontSize: 12.5, fontWeight: 700,
                    borderBottom: "1px solid var(--surface-1,#F1F5F9)", fontVariantNumeric: "tabular-nums" }}>
                    {rowTotal(tk).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "var(--surface,#F8FAFC)" }}>
                <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: ".05em" }}>{t("dayTotal")}</td>
                {days.map(d => {
                  const v = dayTotal(d)
                  return (
                    <td key={iso(d)} style={{ padding: "8px 4px", textAlign: "center", fontSize: 12.5,
                      fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      color: v > 8 ? "#B45309" : v > 0 ? "var(--text)" : "var(--text-3)" }}>
                      {v > 0 ? v.toFixed(2) : "—"}
                    </td>
                  )
                })}
                <td style={{ padding: "8px 4px", textAlign: "center", fontSize: 13, fontWeight: 800,
                  fontVariantNumeric: "tabular-nums" }}>{weekTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {msg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600,
        color: msg.ok ? "var(--green,#059669)" : "var(--red,#DC2626)" }}>{msg.ok ? "✓ " : "✗ "}{msg.text}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {changed.length > 0 ? t("unsaved", { n: changed.length }) : t("allSaved")}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => save(false)} disabled={busy || !changed.length} style={btn(false)}>
            {busy ? "…" : t("save")}
          </button>
          <button onClick={() => save(true)} disabled={busy || !changed.length} style={btn(true)}>
            {t("submitWeek")}
          </button>
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 8, lineHeight: 1.7 }}>
        {t("legend")}<br />{t("footnote")}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: "7px 6px", textAlign: "center", fontSize: 10.5,
  fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em",
  borderBottom: "1.5px solid var(--border)" }
const navBtn: React.CSSProperties = { width: 30, height: 28, border: "1px solid var(--border)",
  background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "var(--text-2)",
  fontFamily: "var(--font)" }
const btn = (primary: boolean): React.CSSProperties => ({ padding: "8px 16px", fontSize: 12.5,
  fontWeight: 700, borderRadius: 6, cursor: "pointer", fontFamily: "var(--font)",
  background: primary ? "var(--steel)" : "#fff", color: primary ? "#fff" : "var(--text-2)",
  border: primary ? "none" : "1px solid var(--border)" })
