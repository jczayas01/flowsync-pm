"use client"
// src/components/projects/TaskIntegrityPanel.tsx
// Collapsed strip above the task grid. Stays quiet when the data is clean;
// when it is not, it names the rows that are distorting earned value and opens
// them for fixing. Deliberately not a modal — it should be ignorable.
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { checkTasks, summarize, IntegrityFinding } from "@/lib/task-integrity"

export function TaskIntegrityPanel({ tasks, onOpenTask }: {
  tasks: any[]
  onOpenTask?: (taskId: string) => void
}) {
  const t = useTranslations("tasksTab")
  const [open, setOpen] = useState(false)

  const findings = useMemo(() => checkTasks(tasks || []), [tasks])
  const s = useMemo(() => summarize(findings), [findings])

  if (!findings.length) return null

  const label = (f: IntegrityFinding) => {
    switch (f.code) {
      case "finish_before_start":   return t("integrity_finish_before_start")
      case "progress_before_start": return t("integrity_progress_before_start")
      case "complete_not_done":     return t("integrity_complete_not_done")
      case "done_not_complete":     return t("integrity_done_not_complete")
      case "progress_no_dates":     return t("integrity_progress_no_dates")
      case "no_estimate":           return t("integrity_no_estimate")
      default:                      return f.code
    }
  }

  const amber = "#D97706", red = "#DC2626"
  const tone  = s.errors > 0 ? red : amber

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid var(--border)",
      padding: "7px 14px", flexShrink: 0 }}>

      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontFamily: "var(--font)", textAlign: "left" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: tone,
          border: `1px solid ${tone}`, borderRadius: 4, padding: "1px 6px" }}>
          {s.errors > 0 ? s.errors : s.warnings}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
          {t("integrity_title")}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {s.evm > 0 ? t("integrity_evm_warning") : t("integrity_subtitle")}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto",
          border: "1px solid var(--border)", borderRadius: 6 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {findings.map((f, i) => (
                <tr key={`${f.taskId}-${f.code}-${i}`}
                  onClick={() => onOpenTask?.(f.taskId)}
                  style={{ borderBottom: "1px solid var(--surface-1,#F1F5F9)",
                    cursor: onOpenTask ? "pointer" : "default" }}>
                  <td style={{ padding: "6px 10px", width: 8 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6,
                      borderRadius: 3, background: f.severity === "error" ? red : amber }} />
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 11, fontFamily: "monospace",
                    color: "var(--text-2)", whiteSpace: "nowrap" }}>{f.taskCode}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12, color: "var(--text)",
                    maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap" }}>{f.title}</td>
                  <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-2)" }}>
                    {label(f)}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 11, fontFamily: "monospace",
                    color: "var(--text-3)", whiteSpace: "nowrap" }}>{f.detail}</td>
                  <td style={{ padding: "6px 10px", fontSize: 10, textAlign: "right",
                    color: f.affectsEvm ? tone : "transparent", whiteSpace: "nowrap" }}>
                    {f.affectsEvm ? t("integrity_evm_tag") : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
