"use client"
// src/components/projects/ProjectSettingsModal.tsx
// ⚙️ Project Settings v1 — AI response style + Phase management.
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CustomFieldsBlock, saveCustomFieldValues, type CFValues } from "@/components/shared/CustomFieldsBlock"

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
  const ps = useTranslations("projectSettings")
  const cf = useTranslations("customFields")
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [projStatus, setProjStatus] = useState<string>("")
  const [dangerBusy, setDangerBusy] = useState(false)
  const [phases, setPhases]     = useState<any[]>([])
  const [aiStyle, setAiStyle]   = useState("PROFESSIONAL")
  const [aiLanguage, setAiLanguage] = useState("AUTO")
  const [savingAi, setSavingAi] = useState(false)
  const [aiSaved, setAiSaved]   = useState(false)
  const [busy, setBusy]         = useState<string | null>(null)
  const [newPhase, setNewPhase] = useState("")
  // The API has accepted a new name and code since the beginning; nothing in the
  // UI ever asked for one. A project named during a hurried import kept that name
  // forever, and the only workaround was to delete it and start over.
  const [pName, setPName]   = useState("")
  const [pCode, setPCode]   = useState("")
  const [idBusy, setIdBusy] = useState(false)
  const [idSaved, setIdSaved] = useState(false)
  const [cfValues, setCfValues] = useState<CFValues>({})
  const [cfBusy, setCfBusy] = useState(false)
  const [cfSaved, setCfSaved] = useState(false)
  async function saveCustomFields() {
    setCfBusy(true); setCfSaved(false)
    const ok = await saveCustomFieldValues("project", projectId, cfValues, projectId)
    setCfBusy(false); if (ok) { setCfSaved(true); router.refresh() }
  }

  async function saveIdentity() {
    if (!pName.trim()) return
    setIdBusy(true); setIdSaved(false)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pName.trim(), code: pCode.trim() || undefined }),
    }).catch(() => null)
    setIdBusy(false)
    if (res?.ok) { setIdSaved(true); router.refresh(); setTimeout(() => setIdSaved(false), 2500) }
    else {
      const d = await res?.json().catch(() => null)
      alert(d?.error || ps("renameFailed"))
    }
  }
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
      try {
        const pr = await fetch(`/api/projects/${projectId}`)
        const pd = await pr.json().catch(() => ({}))
        setProjStatus(pd?.data?.status || "")
        setPName(d?.data?.name || d?.name || "")
        setPCode(d?.data?.code || d?.code || "")
      } catch {}
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

  async function movePhase(idx: number, dir: -1 | 1) {
    const a = phases[idx], b = phases[idx + dir]
    if (!a || !b) return
    // Optimistic: swap locally first — the UI answers the click instantly.
    const next = [...phases]
    next[idx] = { ...b, order: a.order }
    next[idx + dir] = { ...a, order: b.order }
    setPhases(next.sort((x, y) => x.order - y.order))
    // Persist both sides; on any failure, reload truth from the server.
    const patch = (id: string, order: number) =>
      fetch(`/api/projects/${projectId}/phases/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      })
    const [r1, r2] = await Promise.all([patch(a.id, b.order), patch(b.id, a.order)])
    if (!r1.ok || !r2.ok) { setError("Reorder failed — refreshing"); await reload() }
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
      if (!res.ok) { setError(d?.error || ps("deleteFailed")); return }
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
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>⚙️ {ps("Project Settings")}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none",
            fontSize: 18, cursor: "pointer", color: "var(--text-3)" }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 32, fontSize: 13, color: "var(--text-3)" }}>{ps("Loading…")}</div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Project identity ── */}
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", marginBottom: 4 }}>
                ✏️ {ps("Project name and code")}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 10px", lineHeight: 1.6 }}>
                The name appears on every report, export and deck. The code prefixes task and
                risk identifiers — changing it does not renumber anything already created.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label style={{ flex: "1 1 220px", fontSize: 11, color: "var(--text-3)" }}>
                  {ps("Name")}
                  <input value={pName} disabled={!canManage}
                    onChange={e => setPName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveIdentity() }}
                    style={{ width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 13,
                      borderRadius: "var(--radius)", border: "1px solid var(--border)",
                      fontFamily: "var(--font)", color: "var(--text)",
                      background: canManage ? "#fff" : "var(--surface)" }} />
                </label>
                <label style={{ flex: "0 0 110px", fontSize: 11, color: "var(--text-3)" }}>
                  {ps("Code")}
                  <input value={pCode} disabled={!canManage}
                    onChange={e => setPCode(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") saveIdentity() }}
                    style={{ width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 13,
                      borderRadius: "var(--radius)", border: "1px solid var(--border)",
                      fontFamily: "monospace", color: "var(--text)",
                      background: canManage ? "#fff" : "var(--surface)" }} />
                </label>
                {canManage && (
                  <button onClick={saveIdentity} disabled={idBusy || !pName.trim()}
                    style={{ padding: "9px 16px", background: "var(--steel)", color: "#fff",
                      border: "none", borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                      fontFamily: "var(--font)", cursor: idBusy ? "wait" : "pointer" }}>
                    {idBusy ? ps("Saving…") : idSaved ? "✓ "+ps("Saved") : ps("Save")}
                  </button>
                )}
              </div>
            </section>

            {/* ── Custom fields (workspace-defined) ── */}
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", marginBottom: 4 }}>
                🧩 {cf("sectionTitle")}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 4px", lineHeight: 1.6 }}>
                {cf("projectHelp")}
              </p>
              <CustomFieldsBlock entity="project" entityId={projectId}
                values={cfValues} onChange={setCfValues} compact />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={saveCustomFields} disabled={cfBusy}
                  style={{ padding: "7px 14px", background: "var(--steel)", color: "#fff", border: "none",
                    borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                    fontFamily: "var(--font)", cursor: cfBusy ? "wait" : "pointer" }}>
                  {cfBusy ? ps("Saving…") : cfSaved ? "✓ " + ps("Saved") : ps("Save")}
                </button>
              </div>
            </section>

            {/* ── AI response style ── */}
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", marginBottom: 4 }}>
                🤖 {ps("AI response style")}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 10px", lineHeight: 1.6 }}>
                {ps("aiStyleHint")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <div style={lbl}>{ps("Tone")}</div>
                  <select style={{ ...inp, width: "100%", cursor: "pointer" }} value={aiStyle}
                    disabled={!canManage}
                    onChange={e => setAiStyle(e.target.value)}>
                    <option value="PROFESSIONAL">{ps("tonePro")}</option>
                    <option value="FORMAL">{ps("toneFormal")}</option>
                    <option value="CONCISE">{ps("toneConcise")}</option>
                    <option value="DETAILED">{ps("toneDetailed")}</option>
                  </select>
                </div>
                <div>
                  <div style={lbl}>{ps("Language")}</div>
                  <select style={{ ...inp, width: "100%", cursor: "pointer" }} value={aiLanguage}
                    disabled={!canManage}
                    onChange={e => setAiLanguage(e.target.value)}>
                    <option value="AUTO">{ps("langAuto")}</option>
                    <option value="EN">English</option>
                    <option value="ES">Español</option>
                  </select>
                </div>
                {canManage && (
                  <button onClick={saveAi} disabled={savingAi}
                    style={{ padding: "9px 16px", background: "var(--steel)", color: "#fff", border: "none",
                      borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                      fontFamily: "var(--font)", cursor: savingAi ? "wait" : "pointer" }}>
                    {savingAi ? ps("Saving…") : aiSaved ? "✓ "+ps("Saved") : ps("Save")}
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
                {ps("phasesHint")}
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
                          onClick={() => movePhase(idx, -1)}
                          title={ps("Move up")}
                          style={{ padding: "3px 8px", background: "#fff", border: "1px solid var(--border)",
                            borderRadius: 6, fontSize: 11, cursor: idx === 0 ? "not-allowed" : "pointer",
                            opacity: idx === 0 ? 0.4 : 1, fontFamily: "var(--font)" }}>↑</button>
                        <button disabled={idx === phases.length - 1 || !!busy}
                          onClick={() => movePhase(idx, 1)}
                          title={ps("Move down")}
                          style={{ padding: "3px 8px", background: "#fff", border: "1px solid var(--border)",
                            borderRadius: 6, fontSize: 11,
                            cursor: idx === phases.length - 1 ? "not-allowed" : "pointer",
                            opacity: idx === phases.length - 1 ? 0.4 : 1, fontFamily: "var(--font)" }}>↓</button>
                        <button disabled={!!busy}
                          onClick={() => deletePhase(ph)}
                          title={ps("Delete phase")}
                          style={{ padding: "3px 8px", background: "#fff", border: "1px solid #FECACA",
                            borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer",
                            fontFamily: "var(--font)" }}>🗑</button>
                      </>
                    )}
                  </div>
                ))}
                {!phases.length && (
                  <div style={{ fontSize: 12, color: "var(--text-3)", padding: 8 }}>
                    {ps("noPhases")}
                  </div>
                )}
              </div>

              {/* Task-move dialog for a non-empty phase */}
              {deleting && (
                <div style={{ marginTop: 10, padding: 12, background: "#FFFBEB",
                  border: "1px solid #FDE68A", borderRadius: "var(--radius)" }}>
                  <div style={{ fontSize: 12, color: "#92400E", marginBottom: 8 }}>
                    {ps.rich("phaseHasTasks",{n:deleting._count?.tasks||0, name:deleting.name, b:(c:any)=><strong>{c}</strong>})}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select style={{ ...inp, cursor: "pointer" }} value={moveTarget}
                      onChange={e => setMoveTarget(e.target.value)}>
                      <option value="none">{ps("Unphased (no phase)")}</option>
                      {phases.filter(x => x.id !== deleting.id).map(x =>
                        <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <button onClick={() => deletePhase(deleting, moveTarget)}
                      style={{ padding: "7px 14px", background: "#DC2626", color: "#fff", border: "none",
                        borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                        fontFamily: "var(--font)", cursor: "pointer" }}>
                      {ps("Move tasks & delete phase")}
                    </button>
                    <button onClick={() => setDeleting(null)}
                      style={{ padding: "7px 12px", background: "#fff", border: "1px solid var(--border)",
                        borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer",
                        fontFamily: "var(--font)", color: "var(--text-2)" }}>{ps("Cancel")}</button>
                  </div>
                </div>
              )}

              {canManage && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input style={{ ...inp, flex: 1 }} placeholder={ps("New phase name…")} value={newPhase}
                    onChange={e => setNewPhase(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addPhase() }} />
                  <button onClick={addPhase} disabled={!newPhase.trim() || busy === "new"}
                    style={{ padding: "8px 16px", background: "var(--steel)", color: "#fff", border: "none",
                      borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
                      fontFamily: "var(--font)",
                      cursor: !newPhase.trim() ? "not-allowed" : "pointer",
                      opacity: !newPhase.trim() ? 0.6 : 1 }}>
                    ＋ {ps("Add phase")}
                  </button>
                </div>
              )}
            </section>

            {canManage && (
              <section style={{ marginTop: 8, border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", background: "#FEF2F2" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#B91C1C", marginBottom: 6 }}>{ps("Danger zone")}</div>
                <div style={{ fontSize: 11.5, color: "#7F1D1D", lineHeight: 1.5, marginBottom: 10 }}>
                  {projStatus === "ARCHIVED"
                    ? "This project is archived. Permanent deletion removes the project and ALL its data (tasks, risks, budget, documents, reports). This cannot be undone."
                    : "Archiving hides the project from active views. It can be deleted permanently afterwards. Only roles granted deletion rights in Settings → Roles can do this."}
                </div>
                {projStatus !== "ARCHIVED" ? (
                  <button disabled={dangerBusy}
                    onClick={async () => {
                      if (!confirm(ps("confirmArchive"))) return
                      setDangerBusy(true)
                      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
                      setDangerBusy(false)
                      if (!res.ok) { const d = await res.json().catch(()=>({})); setError(d?.error || "Not allowed to archive"); return }
                      setProjStatus("ARCHIVED"); router.refresh()
                    }}
                    style={{ padding: "7px 14px", background: "#fff", border: "1px solid #FCA5A5", borderRadius: "var(--radius)",
                      fontSize: 12, fontWeight: 600, color: "#B91C1C", cursor: "pointer", fontFamily: "var(--font)" }}>
                    {ps("Archive project")}
                  </button>
                ) : (
                  <button disabled={dangerBusy}
                    onClick={async () => {
                      const word = prompt(ps('promptDelete'))
                      if (word !== "DELETE") return
                      setDangerBusy(true)
                      const res = await fetch(`/api/projects/${projectId}?permanent=1`, { method: "DELETE" })
                      setDangerBusy(false)
                      if (!res.ok) { const d = await res.json().catch(()=>({})); setError(d?.error || ps("notAllowedDelete")); return }
                      window.location.href = "/projects"
                    }}
                    style={{ padding: "7px 14px", background: "#B91C1C", border: "none", borderRadius: "var(--radius)",
                      fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "var(--font)" }}>
                    {ps("Delete permanently")}
                  </button>
                )}
              </section>
            )}

            {error && <div style={{ fontSize: 12, color: "#B91C1C" }}>✗ {error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
