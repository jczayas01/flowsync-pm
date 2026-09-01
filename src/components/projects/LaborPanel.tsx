"use client"
// src/components/projects/LaborPanel.tsx
// The entire labour UI, replacing the labour plan / week grid / single entry
// trio. One row per assigned person; the only editable field is allocation %.
// Everything else is read-only arithmetic, shown so the number is auditable
// rather than magic.
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { dateLocale } from "@/lib/date-locale"

type Row = {
  userId: string; name: string; allocation: number; costRate: number | null
  since: string; through: string; workingDays: number; hours: number
  cost: number; missingRate: boolean; sinceIsOverride: boolean
}

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n)

export function LaborPanel({ projectId, workspaceId, canEdit, currency = "USD", onChanged }: {
  projectId: string; workspaceId?: string; canEdit?: boolean
  currency?: string; onChanged?: () => void
}) {
  const t = useTranslations("budget")
  const router = useRouter()

  const [rows, setRows]           = useState<Row[] | null>(null)
  const [totalCost, setTotalCost] = useState(0)
  const [totalHours, setTotalHours] = useState(0)
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const H = () => ({
    "Content-Type": "application/json",
    ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
  })

  async function load() {
    setError(null)
    const r = await fetch(`/api/projects/${projectId}/labor`, {
      headers: workspaceId ? { "x-workspace-id": workspaceId } : {}, cache: "no-store",
    }).catch(() => null)
    if (!r || !r.ok) { setError(t("labor_load_failed")); setRows([]); return }
    // ok() wraps the payload as { data: ... }
    const d = await r.json().catch(() => null)
    const p = d?.data ?? d
    setRows(p?.rows ?? [])
    setTotalCost(Number(p?.totalCost || 0))
    setTotalHours(Number(p?.totalHours || 0))
    setHoursPerDay(Number(p?.hoursPerDay || 8))
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId])

  async function save(body: Record<string, unknown>) {
    setBusy(true); setError(null)
    const r = await fetch(`/api/projects/${projectId}/labor`, {
      method: "PATCH", headers: H(), body: JSON.stringify(body),
    }).catch(() => null)
    setBusy(false)
    if (!r || !r.ok) {
      const d = r ? await r.json().catch(() => ({})) : {}
      setError((d as any)?.error || t("labor_save_failed")); return
    }
    await load()
    onChanged?.(); router.refresh()
  }

  const th: React.CSSProperties = {
    padding: "7px 14px", textAlign: "left", fontSize: 10, fontWeight: 600,
    color: "var(--text-3)", letterSpacing: ".05em", textTransform: "uppercase",
    borderBottom: "1px solid var(--border)",
  }
  const td: React.CSSProperties = { padding: "9px 14px", fontSize: 12, color: "var(--text-2)" }
  const mono: React.CSSProperties = { ...td, fontFamily: "monospace" }

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
      padding: "14px 16px", marginBottom: 14 }}>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("labor_title")}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          {t("labor_hours_per_day")}{" "}
          <input type="number" min={1} max={24} step={0.5} defaultValue={hoursPerDay}
            disabled={!canEdit || busy}
            onBlur={e => {
              const v = Number(e.target.value)
              if (v > 0 && v <= 24 && v !== hoursPerDay) save({ hoursPerDay: v })
            }}
            style={{ width: 52, padding: "2px 6px", fontSize: 11, borderRadius: 4,
              border: "1px solid var(--border)", fontFamily: "monospace" }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>
        {t("labor_formula")}
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "var(--red,#DC2626)", marginBottom: 8 }}>{error}</div>
      )}

      {rows === null ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 0" }}>…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 0" }}>
          {t("labor_empty")}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th style={th}>{t("labor_person")}</th>
              <th style={th}>{t("labor_rate")}</th>
              <th style={th}>{t("labor_allocation")}</th>
              <th style={th}>{t("labor_since")}</th>
              <th style={th}>{t("labor_days")}</th>
              <th style={th}>{t("labor_hours")}</th>
              <th style={th}>{t("labor_cost")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.userId} style={{ borderBottom: "1px solid var(--surface-1,#F1F5F9)" }}>
                <td style={{ ...td, color: "var(--text)", fontWeight: 500 }}>{r.name}</td>
                <td style={mono}>
                  {r.costRate ? `${money(r.costRate, currency)}/h` : (
                    <span style={{ color: "var(--amber,#D97706)" }}>{t("labor_no_rate")}</span>
                  )}
                </td>
                <td style={td}>
                  <input type="number" min={0} max={100} step={5} defaultValue={r.allocation}
                    disabled={!canEdit || busy}
                    onBlur={e => {
                      const v = Math.round(Number(e.target.value))
                      if (v >= 0 && v <= 100 && v !== r.allocation)
                        save({ userId: r.userId, allocation: v })
                    }}
                    style={{ width: 58, padding: "3px 6px", fontSize: 12, borderRadius: 4,
                      border: "1px solid var(--border)", fontFamily: "monospace" }} /> %
                </td>
                <td style={{ ...td, color: "var(--text-3)" }}>
                  <input type="date" defaultValue={String(r.since).slice(0, 10)}
                    disabled={!canEdit || busy}
                    title={r.sinceIsOverride ? t("labor_since_override") : t("labor_since_default")}
                    onBlur={e => {
                      const v = e.target.value
                      if (v && v !== String(r.since).slice(0, 10))
                        save({ userId: r.userId, laborSince: new Date(v + "T00:00:00.000Z").toISOString() })
                    }}
                    style={{ padding: "3px 6px", fontSize: 11, borderRadius: 4,
                      border: `1px solid ${r.sinceIsOverride ? "var(--steel)" : "var(--border)"}`,
                      fontFamily: "monospace", color: "var(--text-2)" }} />
                </td>
                <td style={mono}>{r.workingDays}</td>
                <td style={mono}>{r.hours.toFixed(1)}h</td>
                <td style={{ ...mono, fontWeight: 600, color: "var(--text)" }}>
                  {money(r.cost, currency)}
                </td>
              </tr>
            ))}
            <tr style={{ background: "var(--surface)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--text)" }} colSpan={5}>
                {t("labor_total")}
              </td>
              <td style={{ ...mono, fontWeight: 600 }}>{totalHours.toFixed(1)}h</td>
              <td style={{ ...mono, fontWeight: 700, color: "var(--text)" }}>
                {money(totalCost, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {rows && rows.some(r => r.missingRate) && (
        <div style={{ fontSize: 11, color: "var(--amber,#D97706)", marginTop: 10 }}>
          {t("labor_rate_hint")}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>
        {t("labor_line_note")}
      </div>
    </div>
  )
}
