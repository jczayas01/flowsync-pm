"use client"
// src/components/projects/ProjectSettingsModal.tsx
// ⚙️ Project Settings v1 — AI response style + Phase management.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const inp: React.CSSProperties = {
  padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)",
  fontSize: 13, fontFamily: "var(--font)", color: "var(--text)", background: "#fff",
}
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
  letterSpacing: ".05em", marginBottom: 4,
}

export function ProjectSettingsModal({ projectId, onClose }: {
  projectId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [phases, setPhases]     = useState<any[]>([])
  const [aiStyle, setAiStyle]   = useState("PROFESSIONAL")
  const [aiLanguage, setAiLanguage] = useState("AUTO")
  const [savingAi, setSavingAi] = useState(false)
  const [aiSaved, setAiSaved]   = useState(false)
  const [busy, setBusy]         = useState<string | null>(null)
  const [newPhase, setNewPhase] = useState("")
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState("")
  const [deleting, setDeleting] = useState<any | null>(null)  // phase pending task-move choice
  const [moveTarget, setMoveTarget] = useState("none")
  const [error, setError]       = useState("")

  async function reload() {
    const res = await fetch(`/api/projects/${projectId}/phases`)
    const d = await res.json().catch(() => null)
    if (res.ok) {
      setPhases(d?.data?.phases || [])
      setCanManage(!!d?.data?.canManage)
      const st = d?.data?.settings || {}
      setAiStyle(st.aiStyle || "PROFESSIONAL")
      setAiLanguage(st.aiLanguage || "AUTO")
    } else setError(d?.error || "Could not load settings")
    setLoading(false)
  }
  useEffect(() => { reload() }, [projectId])

  async function saveAi() {
    setSavingAi(true); setAiSaved(false); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { aiStyle, aiLanguage } }),
      })
      if (!res.ok) { const d = await res.json().catch(()=>({})); setError(d?.error || "Save failed"); return }
      setAiSaved(true)
      setTimeout(() => setAiSaved(false), 2500)
    } finally { setSavingAi(false) }
  }

  async function phasePatch(phaseId: string, body: any) {
    setBusy(phaseId); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/phases/${phaseId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json().catch(()=>({})); setError(d?.error || "Update failed"); return }
      await reload()
      router.refresh()
    } finally { setBusy(null) }
  }

  async function addPhase() {
    if (!newPhase.trim()) return
    setBusy("new"); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPhase.trim() }),
      })
      if (!res.ok) { const d = await res.json().catch(()=>({})); setError(d?.error || "Could not add phase"); return }
      setNewPhase("")
      await reload()
      router.refresh()
    } finally { setBusy(null) }
  }

  async function deletePhase(phase: any, moveTo?: string) {
    setBusy(phase.id); setError("")
    try {
      const qs = moveTo ? `?moveTo=${moveTo}` : ""
      const res = await fetch(`/api/projects/${projectId}/phases/${phase.id}${qs}`, { method: "DELETE" })
      const d = await res.json().catch(() => ({}))
      if (res.status === 409) { setDeleting(phase); setMoveTarget("none"); return }
      if (!res.ok) { setError(d?.error || "Delete failed"); return }
      setDeleting(null)
      await reload()
      router.refresh()
    } finally { setBusy(null) }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,.45)",
      zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(640px, 100%)",
        background: "#fff", borderRadius: 12, boxShadow: "0 24px 64px rgba(13,27,42,.25)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px",
          borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>⚙️ Project Settings</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none",
            fontSize: 18, cursor: "pointer", color: "var(--text-3)" }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 32, fontSize: 13, color: "var(--text-3)" }}>Loading…</div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── AI response style ── */}
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", marginBottom: 4 }}>
                🤖 AI response style
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Applies to every AI feature in this project — reports, brief, analyzer, and all document scans.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <div style={lbl}>Tone</div>
                  <select style={{ ...inp, width: "100%", cursor: "pointer" }} value={aiStyle}
                    disabled={!canManage}
                    onChange={e => setAiStyle(e.target.value)}>
                    <option value="PROFESSIONAL">Professional (default)</option>
                    <option value="FORMAL">Formal — executive register</option>
                    <option value="CONCISE">Concise — essentials only</option>
                    <option value="DETAILED">Detailed — thorough</option>
                  </select>
                </div>
                <div>
                  <div style={lbl}>Language</div>
                  <select style={{ ...inp, width: "100%", cursor: "pointer" }} value={aiLanguage}
                    disabled={!canManage}
                    onChange={e => setAiLanguage(e.target.value)}>
                    <option value="AUTO">Match documents (auto)</option>
                    <option value="EN">English</option>
                    <option value="ES">Español</option>
                  </select>
                </div>
                {canManage && (
                  <button onClick={saveAi} disabled={savingAi}
                    style={{ padding: "9px 16px", background: "var(--steel)", color: "#fff", border: "none",
                      borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                      fontFamily: "var(--font)", cursor: savingAi ? "wait" : "pointer" }}>
                    {savingAi ? "Saving…" : aiSaved ? "✓ Saved" : "Save"}
                  </button>
                )}
              </div>
            </section>

            {/* ── Phases ── */}
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", marginBottom: 4 }}>
                📋 Phases
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Rename, reorder, add, or remove this project's phases. Tasks are never deleted —
                removing a phase asks where its tasks should go.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {phases.map((ph, idx) => (
                  <div key={ph.id} style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: "var(--radius)",
                    opacity: busy === ph.id ? 0.6 : 1 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                      background: ph.color || "var(--steel)" }} />
                    {renaming === ph.id ? (
                      <input autoFocus value={renameVal} style={{ ...inp, flex: 1, padding: "4px 8px" }}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && renameVal.trim()) {
                            phasePatch(ph.id, { name: renameVal.trim() }); setRenaming(null)
                          }
                          if (e.key === "Escape") setRenaming(null)
                        }}
                        onBlur={() => {
                          if (renameVal.trim() && renameVal.trim() !== ph.name)
                            phasePatch(ph.id, { name: renameVal.trim() })
                          setRenaming(null)
                        }} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)",
                        cursor: canManage ? "text" : "default" }}
                        title={canManage ? "Click to rename" : undefined}
                        onClick={() => { if (canManage) { setRenaming(ph.id); setRenameVal(ph.name) } }}>
                        {ph.name}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {ph._count?.tasks ?? 0} task{(ph._count?.tasks ?? 0) !== 1 ? "s" : ""}
                    </span>
                    {canManage && (
                      <>
                        <button disabled={idx === 0 || !!busy}
                          onClick={() => phasePatch(ph.id, { order: phases[idx - 1].order })}
                          title="Move up"
                          style={{ padding: "3px 8px", background: "#fff", border: "1px solid var(--border)",
                            borderRadius: 6, fontSize: 11, cursor: idx === 0 ? "not-allowed" : "pointer",
                            opacity: idx === 0 ? 0.4 : 1, fontFamily: "var(--font)" }}>↑</button>
                        <button disabled={idx === phases.length - 1 || !!busy}
                          onClick={() => phasePatch(ph.id, { order: phases[idx + 1].order })}
                          title="Move down"
                          style={{ padding: "3px 8px", background: "#fff", border: "1px solid var(--border)",
                            borderRadius: 6, fontSize: 11,
                            cursor: idx === phases.length - 1 ? "not-allowed" : "pointer",
                            opacity: idx === phases.length - 1 ? 0.4 : 1, fontFamily: "var(--font)" }}>↓</button>
                        <button disabled={!!busy}
                          onClick={() => deletePhase(ph)}
                          title="Delete phase"
                          style={{ padding: "3px 8px", background: "#fff", border: "1px solid #FECACA",
                            borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer",
                            fontFamily: "var(--font)" }}>🗑</button>
                      </>
                    )}
                  </div>
                ))}
                {!phases.length && (
                  <div style={{ fontSize: 12, color: "var(--text-3)", padding: 8 }}>
                    No phases yet — add the first one below.
                  </div>
                )}
              </div>

              {/* Task-move dialog for a non-empty phase */}
              {deleting && (
                <div style={{ marginTop: 10, padding: 12, background: "#FFFBEB",
                  border: "1px solid #FDE68A", borderRadius: "var(--radius)" }}>
                  <div style={{ fontSize: 12, color: "#92400E", marginBottom: 8 }}>
                    <strong>"{deleting.name}"</strong> contains {deleting._count?.tasks} task(s).
                    Where should they go?
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select style={{ ...inp, cursor: "pointer" }} value={moveTarget}
                      onChange={e => setMoveTarget(e.target.value)}>
                      <option value="none">Unphased (no phase)</option>
                      {phases.filter(x => x.id !== deleting.id).map(x =>
                        <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <button onClick={() => deletePhase(deleting, moveTarget)}
                      style={{ padding: "7px 14px", background: "#DC2626", color: "#fff", border: "none",
                        borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                        fontFamily: "var(--font)", cursor: "pointer" }}>
                      Move tasks & delete phase
                    </button>
                    <button onClick={() => setDeleting(null)}
                      style={{ padding: "7px 12px", background: "#fff", border: "1px solid var(--border)",
                        borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer",
                        fontFamily: "var(--font)", color: "var(--text-2)" }}>Cancel</button>
                  </div>
                </div>
              )}

              {canManage && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input style={{ ...inp, flex: 1 }} placeholder="New phase name…" value={newPhase}
                    onChange={e => setNewPhase(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addPhase() }} />
                  <button onClick={addPhase} disabled={!newPhase.trim() || busy === "new"}
                    style={{ padding: "8px 16px", background: "var(--steel)", color: "#fff", border: "none",
                      borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                      fontFamily: "var(--font)",
                      cursor: !newPhase.trim() ? "not-allowed" : "pointer",
                      opacity: !newPhase.trim() ? 0.6 : 1 }}>
                    ＋ Add phase
                  </button>
                </div>
              )}
            </section>

            {error && <div style={{ fontSize: 12, color: "#B91C1C" }}>✗ {error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
