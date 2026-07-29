"use client"
// src/components/projects/tabs/ProjectAIOverviewTab.tsx
// The ingestion orchestrator: one extraction pass per selected document
// (via the existing ai-analyze route, which owns dedupe + the distribution
// ledger), findings fanned out into per-tab groups for review, then applied
// through the existing apply route. Per-tab scanners remain for scoped work —
// this tab is the "read everything, route everything" front door.
import { useState } from "react"
import { useRouter } from "next/navigation"

const TAB_OF: Record<string, { label: string; icon: string; slug: string }> = {
  task:            { label: "Tasks",     icon: "✓",  slug: "tasks" },
  action_item:     { label: "Tasks",     icon: "✓",  slug: "tasks" },
  risk:            { label: "Risks",     icon: "⚠",  slug: "risks" },
  milestone:       { label: "Milestones",icon: "◆",  slug: "gantt" },
  decision:        { label: "Decisions", icon: "⚡", slug: "decisions" },
  change_request:  { label: "Changes",   icon: "🔄", slug: "changes" },
  lesson:          { label: "Lessons",   icon: "📚", slug: "lessons" },
  meeting_minutes: { label: "Meetings",  icon: "📝", slug: "meetings" },
  status_update:   { label: "Dashboard", icon: "⊞",  slug: "" },
  document:        { label: "Docs",      icon: "📁", slug: "docs" },
}

export function ProjectAIOverviewTab({ projectId, workspaceId, documents, fromImport = false, driverName = "" }: {
  projectId: string; workspaceId: string; documents: { id: string; name: string; createdAt?: string }[]
  fromImport?: boolean; driverName?: string
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<Set<string>>(
    // Arriving from project creation: the driver already built the skeleton —
    // preselect everything else for distribution.
    new Set(documents.filter(d => !(fromImport && driverName && d.name === driverName)).map(d => d.id))
  )
  const [phase, setPhase] = useState<"idle" | "running" | "review" | "applying" | "done">("idle")
  const [progress, setProgress] = useState("")
  const [findings, setFindings] = useState<any[]>([])          // suggestions + sourceDoc
  const [excluded, setExcluded] = useState<Set<string>>(new Set()) // finding keys
  const [applied, setApplied] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const hdr = workspaceId ? { "x-workspace-id": workspaceId } : ({} as Record<string, string>)
  const key = (f: any) => `${f.sourceDocId}:${f.type}:${f.title}`

  async function run() {
    setPhase("running"); setFindings([]); setErrors([]); setExcluded(new Set())
    const docs = documents.filter(d => picked.has(d.id))
    const all: any[] = []
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]
      setProgress(`Reading ${i + 1}/${docs.length}: ${d.name}`)
      try {
        // Per-document extraction via the analyzer's own endpoint — full 8K
        // per doc, OCR for scans, per-doc failure reasons.
        const lr = await fetch(`/api/projects/${projectId}/ai-analyze/extract?workspaceId=${workspaceId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: [d.id] }),
        })
        const ld = await lr.json().catch(() => null)
        if (!lr.ok) {
          setErrors(e => [...e, `${d.name}: ${ld?.error || "couldn't read"}`]); continue
        }
        const text = ld?.text || ""
        if (!text || text.length < 40) { setErrors(e => [...e, `${d.name}: no readable text`]); continue }
        setProgress(`Analyzing ${i + 1}/${docs.length}: ${d.name}`)
        const ar = await fetch(`/api/projects/${projectId}/ai-analyze`, {
          method: "POST", headers: { "Content-Type": "application/json", ...hdr },
          body: JSON.stringify({ action: "analyze_content", contentType: "document", content: text }),
        })
        const ad = await ar.json().catch(() => null)
        if (!ar.ok) { setErrors(e => [...e, `${d.name}: ${ad?.error || ar.status}`]); continue }
        const sugs = ad?.data?.suggestions || ad?.suggestions || []
        for (const sg of sugs) all.push({ ...sg, sourceDoc: d.name, sourceDocId: d.id })
      } catch { setErrors(e => [...e, `${d.name}: connection failed`]) }
    }
    // Already-known findings start unchecked — dedupe is the ledger's verdict.
    setExcluded(new Set(all.filter(f => f.existing).map(f => key(f))))
    setFindings(all)
    setPhase(all.length ? "review" : "idle")
    if (!all.length) setErrors(e => [...e, "No findings — the selected documents produced no suggestions."])
  }

  async function applyAll() {
    setPhase("applying")
    const chosen = findings.filter(f => !excluded.has(key(f)))
    // Apply per source document so the ledger records the right source label.
    const bySrc = new Map<string, any[]>()
    for (const f of chosen) bySrc.set(f.sourceDoc, [...(bySrc.get(f.sourceDoc) || []), f])
    const results: any[] = []
    for (const [src, items] of Array.from(bySrc.entries())) {
      setProgress(`Applying ${items.length} from ${src}`)
      const r = await fetch(`/api/projects/${projectId}/ai-analyze/apply?workspaceId=${workspaceId}`, {
        method: "POST", headers: { "Content-Type": "application/json", ...hdr },
        body: JSON.stringify({ suggestions: items, sourceLabel: src }),
      }).catch(() => null)
      const d = await r?.json().catch(() => null)
      if (r?.ok) results.push(...(d?.data?.created || []))
      else setErrors(e => [...e, `${src}: ${d?.error || "apply failed"}`])
    }
    setApplied(results); setPhase("done"); router.refresh()
  }

  const groups = Object.entries(
    findings.reduce((acc: Record<string, any[]>, f) => {
      const g = (TAB_OF[f.type] || TAB_OF.document).label
      acc[g] = [...(acc[g] || []), f]; return acc
    }, {})
  )

  const chosenCount = findings.filter(f => !excluded.has(key(f))).length

  return (
    <div style={{ padding: "20px 24px", maxWidth: 980 }}>
      <div style={{ marginBottom: 6, fontSize: 17, fontWeight: 800, color: "var(--text)" }}>
        🤖 AI Overview
      </div>
      <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.65, margin: "0 0 18px", maxWidth: 640 }}>
        Reads every selected project document in one pass and routes the findings to their tabs —
        tasks, risks, milestones, decisions, change requests, lessons, meetings. You approve before
        anything is created; items the project already knows arrive pre-unchecked.
      </p>

      {fromImport && phase === "idle" && (
        <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 10,
          padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#1E3A8A", lineHeight: 1.6 }}>
          ✅ Project created{driverName ? <> from <strong>{driverName}</strong></> : null}.
          The other documents are attached but not yet read — analyze them below to distribute
          their tasks, risks, decisions, change requests and milestones into their tabs.
        </div>
      )}
      {(phase === "idle" || phase === "running") && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)", marginBottom: 10 }}>
            Documents ({picked.size}/{documents.length} selected)
          </div>
          {documents.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>
              No documents yet — upload them in the Docs tab first.
            </div>
          )}
          {documents.map(d => (
            <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0",
              fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={picked.has(d.id)}
                onChange={() => setPicked(p => { const n = new Set(p); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n })} />
              📄 {d.name}
            </label>
          ))}
          <button onClick={run} disabled={phase === "running" || picked.size === 0}
            style={{ marginTop: 14, padding: "10px 22px", background: "var(--steel)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 700,
              cursor: phase === "running" ? "wait" : "pointer", fontFamily: "var(--font)", opacity: picked.size ? 1 : .5 }}>
            {phase === "running" ? `⏳ ${progress}` : `🤖 Analyze ${picked.size} document${picked.size === 1 ? "" : "s"} →`}
          </button>
        </div>
      )}

      {phase === "review" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
              {findings.length} findings · {chosenCount} selected
            </span>
            <button onClick={() => setPhase("idle")} style={{ fontSize: 12, color: "var(--steel)",
              background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
              ← different documents
            </button>
          </div>
          {groups.map(([label, items]) => (
            <div key={label} style={{ border: "1px solid var(--border)", borderRadius: 12,
              padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase",
                letterSpacing: ".05em", color: "var(--text-2)", marginBottom: 8 }}>
                {(TAB_OF[items[0].type] || TAB_OF.document).icon} {label}
                <span style={{ color: "var(--text-4)", fontWeight: 500 }}> · {items.length}</span>
              </div>
              {items.map((f: any) => {
                const k = key(f); const off = excluded.has(k)
                return (
                  <label key={k} style={{ display: "flex", gap: 9, alignItems: "flex-start",
                    padding: "6px 0", borderTop: "1px solid var(--surface-1,#F1F5F9)", cursor: "pointer",
                    opacity: off ? .55 : 1 }}>
                    <input type="checkbox" checked={!off} style={{ marginTop: 3 }}
                      onChange={() => setExcluded(x => { const n = new Set(x); n.has(k) ? n.delete(k) : n.add(k); return n })} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{f.title}</span>
                      {f.existing && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#047857",
                          background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8,
                          padding: "1px 7px", marginLeft: 8 }}>
                          ✓ already added{f.existing.similar ? " (similar)" : ""} · {f.existing.code}
                        </span>
                      )}
                      {f.description && (
                        <span style={{ display: "block", fontSize: 12, color: "var(--text-3)",
                          lineHeight: 1.5, marginTop: 2 }}>{f.description}</span>
                      )}
                      <span style={{ display: "block", fontSize: 10.5, color: "var(--text-4)", marginTop: 2 }}>
                        from {f.sourceDoc}{f.suggested_due_date ? ` · due ${f.suggested_due_date}` : ""}
                        {f.suggested_phase ? ` · ${f.suggested_phase}` : ""}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          ))}
          <button onClick={applyAll} disabled={chosenCount === 0}
            style={{ padding: "11px 24px", background: "var(--steel)", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--font)", opacity: chosenCount ? 1 : .5 }}>
            ➕ Add {chosenCount} to project
          </button>
        </>
      )}

      {phase === "applying" && (
        <div style={{ textAlign: "center", padding: "50px 20px", fontSize: 14, color: "var(--text-2)" }}>
          ⏳ {progress}
        </div>
      )}

      {phase === "done" && (
        <div style={{ border: "1px solid #A7F3D0", background: "#ECFDF5", borderRadius: 12,
          padding: "18px 20px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#047857", marginBottom: 8 }}>
            ✅ {applied.length} items distributed
          </div>
          <div style={{ fontSize: 13, color: "#065F46", lineHeight: 1.7 }}>
            {Object.entries(applied.reduce((a: Record<string, number>, c: any) => {
              const lbl = (TAB_OF[c.type] || TAB_OF.document).label
              a[lbl] = (a[lbl] || 0) + 1; return a
            }, {})).map(([lbl, n]) => `${lbl}: ${n}`).join(" · ")}
          </div>
          <button onClick={() => { setPhase("idle"); setFindings([]); setApplied([]) }}
            style={{ marginTop: 12, fontSize: 12.5, color: "var(--steel)", background: "none",
              border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px",
              cursor: "pointer", fontFamily: "var(--font)" }}>
            Run again
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--red)", lineHeight: 1.6 }}>
          {errors.map((e, i) => <div key={i}>✗ {e}</div>)}
        </div>
      )}
    </div>
  )
}
