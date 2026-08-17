"use client"
// src/components/shared/CustomFieldsBlock.tsx
// Drop-in section for any create/edit form. Loads the workspace's active
// custom fields for `entity`, renders the right input per type, and reports
// values up through onChange. Saving is the parent's job (call
// saveCustomFieldValues after the entity exists — on create you don't have an
// id until the POST returns).
//
// Renders nothing when the workspace has defined no fields, so forms stay
// clean for customers who don't use the feature.

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

export type CFDef = { id: string; name: string; fieldType: string; options?: any;
  required: boolean; description?: string | null }
export type CFValues = Record<string, string | null>

export async function loadCustomFields(entity: "project" | "task", entityId: string | undefined,
  workspaceId?: string): Promise<{ fields: CFDef[]; values: CFValues }> {
  const q = new URLSearchParams({ entity, ...(entityId ? { entityId } : {}) })
  const r = await fetch(`/api/custom-fields/values?${q}`, {
    headers: workspaceId ? { "x-workspace-id": workspaceId } : {}, cache: "no-store" })
  const d = await r.json().catch(() => ({}))
  return { fields: d?.data?.fields || [], values: d?.data?.values || {} }
}

export async function saveCustomFieldValues(entity: "project" | "task", entityId: string,
  values: CFValues, projectId?: string, workspaceId?: string): Promise<boolean> {
  if (!Object.keys(values).length) return true
  const r = await fetch(`/api/custom-fields/values`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(workspaceId ? { "x-workspace-id": workspaceId } : {}) },
    body: JSON.stringify({ entity, entityId, projectId, values }),
  })
  return r.ok
}

/** Human-readable value for display (chips, detail panels, exports). */
export function formatCustomValue(f: CFDef, v: string | null | undefined): string {
  if (v == null || v === "") return "—"
  switch (f.fieldType) {
    case "checkbox": return v === "true" ? "✓" : "—"
    case "currency": { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : v }
    case "date": { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { timeZone: "UTC" }) }
    case "multiselect": return v.split("|").filter(Boolean).join(", ")
    default: return v
  }
}

export function CustomFieldsBlock({ entity, entityId, workspaceId, values, onChange, compact }: {
  entity: "project" | "task"
  entityId?: string
  workspaceId?: string
  values: CFValues
  onChange: (next: CFValues) => void
  compact?: boolean
}) {
  const t = useTranslations("customFields")
  const [fields, setFields] = useState<CFDef[] | null>(null)

  useEffect(() => {
    let alive = true
    loadCustomFields(entity, entityId, workspaceId).then(r => {
      if (!alive) return
      setFields(r.fields)
      // seed existing values once, without clobbering edits already typed
      if (entityId && Object.keys(r.values).length) onChange({ ...r.values, ...values })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entityId, workspaceId])

  if (!fields || fields.length === 0) return null

  const inp: React.CSSProperties = { width: "100%", padding: compact ? "6px 9px" : "8px 11px",
    border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "var(--font)",
    background: "#fff", color: "var(--text)", boxSizing: "border-box" }
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600,
    color: "var(--text-3)", marginBottom: 4 }
  const set = (id: string, v: string | null) => onChange({ ...values, [id]: v })

  return (
    <div style={{ marginTop: compact ? 10 : 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
        letterSpacing: ".06em", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
        {t("sectionTitle")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
        gap: compact ? 8 : 12 }}>
        {fields.map(f => {
          const v = values[f.id] ?? ""
          const opts: string[] = Array.isArray(f.options) ? f.options : []
          const req = f.required ? " *" : ""
          const field = (() => {
            switch (f.fieldType) {
              case "number":
              case "currency":
                return <input style={inp} type="number" step={f.fieldType === "currency" ? "0.01" : "any"}
                  value={v} onChange={e => set(f.id, e.target.value)} />
              case "date":
                return <input style={inp} type="date" value={v} onChange={e => set(f.id, e.target.value)} />
              case "checkbox":
                return (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)",
                    cursor: "pointer", padding: "6px 0" }}>
                    <input type="checkbox" checked={v === "true"} onChange={e => set(f.id, e.target.checked ? "true" : "false")} />
                    {t("yes")}
                  </label>
                )
              case "select":
                return (
                  <select style={{ ...inp, cursor: "pointer" }} value={v} onChange={e => set(f.id, e.target.value)}>
                    <option value="">—</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )
              case "multiselect": {
                const chosen = new Set(v.split("|").filter(Boolean))
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 0" }}>
                    {opts.map(o => (
                      <label key={o} style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12,
                        padding: "3px 8px", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer",
                        background: chosen.has(o) ? "#EFF6FF" : "#fff", color: chosen.has(o) ? "var(--steel)" : "var(--text-2)" }}>
                        <input type="checkbox" checked={chosen.has(o)} style={{ display: "none" }}
                          onChange={e => { const n = new Set(chosen); e.target.checked ? n.add(o) : n.delete(o); set(f.id, [...n].join("|")) }} />
                        {o}
                      </label>
                    ))}
                  </div>
                )
              }
              case "url":
                return <input style={inp} type="url" placeholder="https://" value={v} onChange={e => set(f.id, e.target.value)} />
              case "email":
                return <input style={inp} type="email" value={v} onChange={e => set(f.id, e.target.value)} />
              default:
                return <input style={inp} type="text" value={v} onChange={e => set(f.id, e.target.value)} />
            }
          })()
          return (
            <div key={f.id}>
              <label style={lbl}>{f.name}{req}</label>
              {field}
              {f.description && <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 3 }}>{f.description}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Read-only chips for detail views. Renders nothing if no fields/values. */
export function CustomFieldsDisplay({ entity, entityId, workspaceId, title }: {
  entity: "project" | "task"; entityId: string; workspaceId?: string; title?: string
}) {
  const t = useTranslations("customFields")
  const [data, setData] = useState<{ fields: CFDef[]; values: CFValues } | null>(null)
  useEffect(() => { loadCustomFields(entity, entityId, workspaceId).then(setData) }, [entity, entityId, workspaceId])
  if (!data || !data.fields.length) return null
  const filled = data.fields.filter(f => (data.values[f.id] ?? "") !== "")
  if (!filled.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
        letterSpacing: ".06em", marginBottom: 6 }}>{title || t("sectionTitle")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {filled.map(f => (
          <span key={f.id} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 12,
            background: "var(--surface,#F8FAFC)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
            <span style={{ color: "var(--text-3)" }}>{f.name}: </span>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatCustomValue(f, data.values[f.id])}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
