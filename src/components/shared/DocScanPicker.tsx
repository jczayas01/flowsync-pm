"use client"
// src/components/shared/DocScanPicker.tsx
// Week-grouped multi-select of project documents, used by AI scan features
// (Risks "Scan documents", Budget "Scan documents", and future M365 sources).
import { useEffect, useState } from "react"

export function DocScanPicker({ projectId, workspaceId, scanning, onScan }: {
  projectId: string
  workspaceId: string
  scanning: boolean
  onScan: (documentIds: string[]) => void
}) {
  const [docs, setDocs]         = useState<any[]|null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true
    fetch(`/api/projects/${projectId}/documents?workspaceId=${workspaceId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { if (live) setDocs(d?.data || []) })
      .catch(() => { if (live) setDocs([]) })
    return () => { live = false }
  }, [projectId, workspaceId])

  const weekStartOf = (d: any) => {
    const dt = new Date(d); const day = dt.getDay()
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0,0,0,0)
    return dt
  }
  const thisWeekTs = weekStartOf(new Date()).getTime()
  const weekLabel = (s: Date) => {
    if (s.getTime() === thisWeekTs) return "This week"
    const end = new Date(s); end.setDate(s.getDate() + 6)
    const f = (d: Date) => d.toLocaleDateString("en-US", { month:"short", day:"numeric" })
    return `Week of ${f(s)} – ${f(end)}, ${end.getFullYear()}`
  }
  const groups = (() => {
    const gs: { start: Date; docs: any[] }[] = []
    for (const doc of docs || []) {
      const start = weekStartOf(doc.weekOf || doc.createdAt)
      const g = gs.find(x => x.start.getTime() === start.getTime())
      if (g) g.docs.push(doc); else gs.push({ start, docs: [doc] })
    }
    gs.sort((a, b) => b.start.getTime() - a.start.getTime())
    return gs
  })()

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  if (docs === null) return <div style={{ fontSize:12, color:"var(--text-3)", padding:8 }}>Loading documents…</div>
  if (!docs.length)  return <div style={{ fontSize:12, color:"var(--text-3)", padding:8 }}>No documents in this project yet — upload files in the Docs tab first.</div>

  return (
    <div>
      <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:8 }}>
        Pick a week to open its documents. Checking a week selects all its documents.
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:220, overflowY:"auto" }}>
        {groups.map((g, gi) => {
          const key = g.start.toISOString()
          const open = openWeeks.has(key) || (openWeeks.size === 0 && gi === 0)
          const allChecked = g.docs.every((d: any) => selected.has(d.id))
          const someChecked = g.docs.some((d: any) => selected.has(d.id))
          return (
            <div key={key}>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 6px",
                background:"#fff", border:"1px solid var(--border)", borderRadius:6 }}>
                <input type="checkbox" checked={allChecked}
                  ref={el => { if (el) el.indeterminate = !allChecked && someChecked }}
                  onChange={() => setSelected(prev => {
                    const next = new Set(prev)
                    if (allChecked) g.docs.forEach((d: any) => next.delete(d.id))
                    else g.docs.forEach((d: any) => next.add(d.id))
                    return next
                  })} />
                <button onClick={() => setOpenWeeks(prev => {
                    const next = new Set(prev.size === 0 ? [groups[0]?.start.toISOString()].filter(Boolean) as string[] : [...prev])
                    next.has(key) ? next.delete(key) : next.add(key)
                    return next
                  })}
                  style={{ flex:1, display:"flex", alignItems:"center", gap:6, background:"none",
                    border:"none", cursor:"pointer", fontFamily:"var(--font)",
                    fontSize:12, fontWeight:700, color:"var(--text-2)", textAlign:"left" }}>
                  <span style={{ fontSize:10 }}>{open ? "▼" : "▶"}</span>
                  {weekLabel(g.start)}
                  <span style={{ marginLeft:"auto", fontWeight:400, color:"var(--text-3)" }}>
                    {g.docs.length} file{g.docs.length !== 1 ? "s" : ""}
                  </span>
                </button>
              </div>
              {open && (
                <div style={{ display:"flex", flexDirection:"column", gap:4, padding:"6px 4px 8px 28px" }}>
                  {g.docs.map((f: any) => (
                    <label key={f.id} style={{ display:"flex", alignItems:"center", gap:8,
                      fontSize:13, color:"var(--text)", cursor:"pointer" }}>
                      <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={() => onScan([...selected])} disabled={scanning || selected.size === 0}
        style={{ marginTop:10, padding:"7px 16px", background:"var(--steel)", color:"#fff",
          border:"none", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
          fontFamily:"var(--font)",
          cursor: scanning || selected.size === 0 ? "not-allowed" : "pointer",
          opacity: scanning || selected.size === 0 ? 0.6 : 1 }}>
        {scanning ? "⏳ Scanning…" : `🤖 Scan ${selected.size || ""} document${selected.size === 1 ? "" : "s"} →`}
      </button>
    </div>
  )
}
