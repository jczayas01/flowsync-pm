"use client"
// src/components/programs/ProgramInsightsPanel.tsx
// The two program-level signals, side by side above the program cards:
// dependencies that cross a project boundary, and people booked past capacity.
// Silent when there is nothing to report — a program with clean links and no
// contention should not carry a permanent empty panel.
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { dateLocale } from "@/lib/date-locale"

type Link = {
  id: string; type: string; lagDays: number
  preceding: { code?: string; title?: string; projectCode?: string; projectName?: string
               dueDate?: string; status?: string }
  dependent: { code?: string; title?: string; projectCode?: string; projectName?: string
               startDate?: string; status?: string }
  breach: { slipDays: number; active: boolean } | null
}
type Person = {
  userId: string; userName: string; peak: number; projects: number; overloadedDays: number
  worst: { start: string; end: string; total: number
           projects: { name?: string; allocation: number }[] } | null
}

const RED = "#DC2626", AMBER = "#D97706"

export function ProgramInsightsPanel({ workspaceId }: { workspaceId?: string }) {
  const t = useTranslations("programs")
  const [links, setLinks]   = useState<Link[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [open, setOpen]     = useState<"links" | "people" | null>(null)
  const [ready, setReady]   = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await fetch("/api/programs/insights", {
        headers: workspaceId ? { "x-workspace-id": workspaceId } : {}, cache: "no-store",
      }).catch(() => null)
      if (!r || !r.ok || cancelled) { setReady(true); return }
      const d = await r.json().catch(() => null)
      const p = d?.data ?? d
      setLinks(p?.links ?? [])
      setPeople(p?.people ?? [])
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [workspaceId])

  const breached = links.filter(l => l.breach?.active)
  if (!ready || (!links.length && !people.length)) return null

  const d = (v?: string) => v
    ? new Date(v).toLocaleDateString(dateLocale(),
        { month: "short", day: "numeric", timeZone: "UTC" })
    : "—"

  const chip = (active: boolean, n: number, label: string, key: "links" | "people") => (
    <button onClick={() => setOpen(o => o === key ? null : key)}
      style={{ display: "flex", alignItems: "center", gap: 7, background: "none",
        border: "1px solid var(--border)", borderRadius: 6, padding: "6px 11px",
        cursor: "pointer", fontFamily: "var(--font)" }}>
      <span style={{ fontSize: 11, fontWeight: 700,
        color: active ? RED : "var(--text-3)" }}>{n}</span>
      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{label}</span>
      <span style={{ fontSize: 10, color: "var(--text-4)" }}>{open === key ? "▲" : "▼"}</span>
    </button>
  )

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 12 }}>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {links.length  > 0 && chip(breached.length > 0, links.length, t("crossLinks"), "links")}
        {people.length > 0 && chip(true, people.length, t("overAllocated"), "people")}
      </div>

      {open === "links" && (
        <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
          {links.map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "7px 0", borderBottom: "1px solid var(--surface-1,#F1F5F9)",
              fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3,
                background: l.breach ? (l.breach.active ? RED : AMBER) : "#059669" }} />
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-3)" }}>
                {l.preceding.projectCode}
              </span>
              <span style={{ color: "var(--text)" }}>{l.preceding.title}</span>
              <span style={{ color: "var(--text-4)", fontSize: 11 }}>
                {d(l.preceding.dueDate)} → {l.type}
                {l.lagDays ? ` +${l.lagDays}d` : ""} →
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-3)" }}>
                {l.dependent.projectCode}
              </span>
              <span style={{ color: "var(--text)" }}>{l.dependent.title}</span>
              <span style={{ color: "var(--text-4)", fontSize: 11 }}>{d(l.dependent.startDate)}</span>
              {l.breach && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600,
                  color: l.breach.active ? RED : AMBER }}>
                  {l.breach.active
                    ? t("slipDays", { n: l.breach.slipDays })
                    : t("predecessorDone")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {open === "people" && (
        <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
          {people.map(p => (
            <div key={p.userId} style={{ padding: "7px 0",
              borderBottom: "1px solid var(--surface-1,#F1F5F9)", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{p.userName}</span>
                <span style={{ fontWeight: 700, color: RED, fontFamily: "monospace" }}>
                  {p.peak}%
                </span>
                <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                  {t("acrossProjects", { n: p.projects })} · {t("daysOver", { n: p.overloadedDays })}
                </span>
              </div>
              {p.worst && (
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                  {d(p.worst.start)} – {d(p.worst.end)}:{" "}
                  {p.worst.projects.map(x => `${x.name} ${x.allocation}%`).join(" + ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
