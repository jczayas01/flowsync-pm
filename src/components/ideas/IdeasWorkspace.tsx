"use client"
// src/components/ideas/IdeasWorkspace.tsx
// The project nursery. Left: idea backlog grouped by maturity. Right: the
// selected idea — business basics, meeting log, reference links, and a
// weighted solution-comparison matrix (criteria × options, 0–5 scores,
// weighted totals, live winner). "Promote to project" is the graduation:
// creates a DRAFT project and freezes the idea as PROMOTED.

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { dateLocale } from "@/lib/date-locale"

const uid = () => Math.random().toString(36).slice(2, 10)

const STATUS_META: Record<string, { color: string; bg: string }> = {
  IDEA:      { color: "#64748B", bg: "#F1F5F9" },
  EXPLORING: { color: "#1D4ED8", bg: "#EFF6FF" },
  COMPARING: { color: "#B45309", bg: "#FEF3C7" },
  READY:     { color: "#059669", bg: "#ECFDF5" },
  PROMOTED:  { color: "#7C3AED", bg: "#F5F3FF" },
  ARCHIVED:  { color: "#94A3B8", bg: "#F8FAFC" },
}
const STATUSES = ["IDEA","EXPLORING","COMPARING","READY","PROMOTED","ARCHIVED"]

export function IdeasWorkspace({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("ideas")
  const router = useRouter()
  const [items, setItems]   = useState<any[]>([])
  const [selId, setSelId]   = useState<string>("")
  const [item, setItem]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [err, setErr]       = useState("")

  const load = useCallback(async () => {
    const r = await fetch("/api/ideas", { headers: { "x-workspace-id": workspaceId } })
    const d = await r.json().catch(() => ({}))
    setItems(d?.data?.items || []); setLoading(false)
  }, [workspaceId])
  useEffect(() => { load() }, [load])

  const loadOne = useCallback(async (id: string) => {
    const r = await fetch(`/api/ideas/${id}`, { headers: { "x-workspace-id": workspaceId } })
    const d = await r.json().catch(() => ({}))
    if (d?.data?.item) setItem(d.data.item)
  }, [workspaceId])
  useEffect(() => { if (selId) loadOne(selId); else setItem(null) }, [selId, loadOne])

  const [scanning, setScanning] = useState<"" | "idea" | "option">("")

  /** Upload a document to /api/ideas/scan and apply the AI prefill.
   *  mode "idea": fills ONLY fields the user hasn't typed yet — a scan must
   *  never silently overwrite human input. mode "option": appends extracted
   *  options to the comparison matrix. */
  async function scanDoc(mode: "idea" | "option", file: File) {
    if (!file || scanning) return
    if (file.size > 4 * 1024 * 1024) { setErr(t("scanTooBig")); return }
    setScanning(mode); setErr("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("mode", mode)
      const res = await fetch("/api/ideas/scan", {
        method: "POST", headers: { "x-workspace-id": workspaceId }, body: fd,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d?.error || t("scanFailed")); return }
      const r = d?.data?.result || {}
      if (mode === "idea") {
        const upd: any = {}
        const fill = (k: string, v: any) => {
          if (v != null && v !== "" && !(item as any)[k]) upd[k] = v
        }
        fill("summary", r.summary); fill("problem", r.problem)
        fill("goal", r.goal); fill("sponsor", r.sponsor)
        fill("estCost", r.estCost); fill("estBenefit", r.estBenefit)
        fill("targetDate", r.targetDate)
        if (r.title && (!item.title || /^(Nueva idea|New idea)/i.test(item.title))) upd.title = r.title
        if (!Object.keys(upd).length) { setErr(t("scanNothingNew")); return }
        setItem({ ...item, ...upd })
        await patch(upd, true)
      } else {
        const opts = Array.isArray(r.options) ? r.options : []
        if (!opts.length) { setErr(t("scanNoOptions")); return }
        const cmp = item.comparison || { criteria: [], options: [] }
        const added = opts.slice(0, 4).map((o: any) => ({
          id: Math.random().toString(36).slice(2, 10),
          name: String(o.name || "Option").slice(0, 120),
          vendor: o.vendor ? String(o.vendor).slice(0, 120) : undefined,
          cost: Number(o.cost) > 0 ? Number(o.cost) : undefined,
          costNote: o.costNote ? String(o.costNote).slice(0, 60) : undefined,
          pros: o.pros ? String(o.pros).slice(0, 600) : undefined,
          cons: o.cons ? String(o.cons).slice(0, 600) : undefined,
          specs: (o.specs && typeof o.specs === "object") ? o.specs : {},
          scores: {},
        }))
        const next = { ...cmp, options: [...cmp.options, ...added] }
        setItem({ ...item, comparison: next })
        await patch({ comparison: next })
      }
    } finally { setScanning("") }
  }

  async function patch(body: any, refreshList = false) {
    if (!item) return
    setSaving(true); setErr("")
    try {
      const r = await fetch(`/api/ideas/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify(body),
      })
      if (!r.ok) { const d = await r.json().catch(()=>({})); setErr(d?.error || t("saveFailed")); return }
      await loadOne(item.id)
      if (refreshList) load()
    } finally { setSaving(false) }
  }

  async function createIdea() {
    if (!newTitle.trim()) return
    const r = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    const d = await r.json().catch(() => ({}))
    setNewTitle("")
    await load()
    if (d?.data?.id) setSelId(d.data.id)
  }

  async function promote() {
    if (!item) return
    if (!confirm(t("promoteConfirm"))) return
    const r = await fetch(`/api/ideas/${item.id}?action=promote`, {
      method: "POST", headers: { "x-workspace-id": workspaceId },
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d?.error || t("saveFailed")); return }
    if (d?.data?.projectId) router.push(`/projects/${d.data.projectId}`)
  }

  async function removeIdea() {
    if (!item) return
    if (!confirm(t("deleteConfirm"))) return
    await fetch(`/api/ideas/${item.id}`, { method: "DELETE",
      headers: { "x-workspace-id": workspaceId } })
    setSelId(""); load()
  }

  // ── styles ──
  const inp: React.CSSProperties = { width: "100%", padding: "7px 10px", fontSize: 12.5,
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    fontFamily: "var(--font)", color: "var(--text)", background: "#fff", boxSizing: "border-box" }
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--text-3)",
    textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 4 }
  const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 16 }
  const secTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text)",
    marginBottom: 10 }
  const miniBtn: React.CSSProperties = { padding: "4px 10px", fontSize: 11, fontWeight: 600,
    border: "1px solid var(--border)", borderRadius: 6, background: "#fff",
    color: "var(--text-2)", cursor: "pointer", fontFamily: "var(--font)" }

  const chip = (st: string) => {
    const m = STATUS_META[st] || STATUS_META.IDEA
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
      color: m.color, background: m.bg, whiteSpace: "nowrap" }}>{t("st_" + st)}</span>
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }} className="fs-wrap">
      {/* ── Backlog ── */}
      <div style={{ width: 320, minWidth: 260, borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", background: "var(--surface,#F8FAFC)" }}>
        <div style={{ padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>💡 {t("title")}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{t("subtitle")}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input style={{ ...inp, flex: 1 }} placeholder={t("newPlaceholder")}
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createIdea()} />
            <button onClick={createIdea} disabled={!newTitle.trim()}
              style={{ ...miniBtn, background: "var(--steel,#1B6CA8)", color: "#fff",
                border: "none", opacity: newTitle.trim() ? 1 : .5 }}>＋</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 14px" }}>
          {loading && <div style={{ fontSize: 12, color: "var(--text-3)", padding: 10 }}>…</div>}
          {!loading && items.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-3)", padding: 10 }}>{t("empty")}</div>
          )}
          {STATUSES.map(st => {
            const group = items.filter(i => i.status === st)
            if (!group.length) return null
            return (
              <div key={st} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: STATUS_META[st].color,
                  textTransform: "uppercase", letterSpacing: ".06em", padding: "0 4px 4px" }}>
                  {t("st_" + st)} · {group.length}
                </div>
                {group.map(i => (
                  <div key={i.id} onClick={() => setSelId(i.id)}
                    style={{ padding: "9px 10px", borderRadius: "var(--radius)", cursor: "pointer",
                      background: selId === i.id ? "#fff" : "transparent",
                      border: selId === i.id ? "1px solid var(--border)" : "1px solid transparent",
                      marginBottom: 2 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{i.title}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
                      {i.estCost != null && <>~${Number(i.estCost).toLocaleString("en-US")} · </>}
                      {(i.comparison as any)?.options?.length
                        ? t("optCount", { n: (i.comparison as any).options.length }) + " · " : ""}
                      {i.createdBy?.name || ""}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Detail ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {!item ? (
          <div style={{ display: "grid", placeItems: "center", height: "100%",
            color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: 30 }}>
            <div>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
              {t("pickOne")}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
            {err && <div style={{ fontSize: 12, color: "#DC2626" }}>{err}</div>}

            {/* Header */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input style={{ ...inp, flex: "1 1 320px", fontSize: 16, fontWeight: 700 }}
                value={item.title}
                onChange={e => setItem({ ...item, title: e.target.value })}
                onBlur={() => patch({ title: item.title }, true)} />
              <select value={item.status}
                onChange={e => { setItem({ ...item, status: e.target.value }); patch({ status: e.target.value }, true) }}
                style={{ ...inp, width: "auto", cursor: "pointer" }}>
                {STATUSES.map(s2 => <option key={s2} value={s2}>{t("st_" + s2)}</option>)}
              </select>
              {chip(item.status)}
              {item.status !== "PROMOTED" ? (
                <button onClick={promote} title={t("promoteTitle")}
                  style={{ ...miniBtn, background: "#7C3AED", color: "#fff", border: "none",
                    padding: "7px 14px", fontSize: 12 }}>
                  🚀 {t("promote")}
                </button>
              ) : item.promotedProjectId && (
                <a href={`/projects/${item.promotedProjectId}`}
                  style={{ ...miniBtn, textDecoration: "none", color: "#7C3AED",
                    border: "1px solid #DDD6FE", padding: "7px 14px", fontSize: 12 }}>
                  {t("openProject")} →
                </a>
              )}
              <label style={{ ...miniBtn, cursor: scanning ? "wait" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 5 }}
                title={t("scanIdeaTitle")}>
                {scanning === "idea" ? "…" : <>🤖 {t("scanIdea")}</>}
                <input type="file" accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.csv,.png,.jpg,.jpeg"
                  style={{ display: "none" }} disabled={!!scanning}
                  onChange={e => { const f = e.target.files?.[0]; if (f) scanDoc("idea", f); e.target.value = "" }} />
              </label>
              <button onClick={removeIdea} style={{ ...miniBtn, color: "#DC2626" }}>✕</button>
            </div>

            {/* Business basics */}
            <div style={card}>
              <div style={secTitle}>{t("basicsTitle")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>{t("summary")}</label>
                  <textarea style={{ ...inp, minHeight: 54, resize: "vertical" }}
                    value={item.summary || ""} onChange={e => setItem({ ...item, summary: e.target.value })}
                    onBlur={() => patch({ summary: item.summary || null })} />
                </div>
                <div>
                  <label style={lbl}>{t("problem")}</label>
                  <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }}
                    value={item.problem || ""} onChange={e => setItem({ ...item, problem: e.target.value })}
                    onBlur={() => patch({ problem: item.problem || null })} />
                </div>
                <div>
                  <label style={lbl}>{t("goal")}</label>
                  <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }}
                    value={item.goal || ""} onChange={e => setItem({ ...item, goal: e.target.value })}
                    onBlur={() => patch({ goal: item.goal || null })} />
                </div>
                <div>
                  <label style={lbl}>{t("sponsor")}</label>
                  <input style={inp} value={item.sponsor || ""}
                    onChange={e => setItem({ ...item, sponsor: e.target.value })}
                    onBlur={() => patch({ sponsor: item.sponsor || null })} />
                </div>
                <div>
                  <label style={lbl}>{t("estCost")}</label>
                  <input style={inp} type="number" min="0" value={item.estCost ?? ""}
                    onChange={e => setItem({ ...item, estCost: e.target.value === "" ? null : Number(e.target.value) })}
                    onBlur={() => patch({ estCost: item.estCost }, true)} />
                </div>
                <div>
                  <label style={lbl}>{t("estBenefit")}</label>
                  <input style={inp} type="number" min="0" value={item.estBenefit ?? ""}
                    onChange={e => setItem({ ...item, estBenefit: e.target.value === "" ? null : Number(e.target.value) })}
                    onBlur={() => patch({ estBenefit: item.estBenefit })} />
                </div>
                <div>
                  <label style={lbl}>{t("targetDate")}</label>
                  <input style={inp} type="date"
                    value={item.targetDate ? String(item.targetDate).slice(0, 10) : ""}
                    onChange={e => setItem({ ...item, targetDate: e.target.value || null })}
                    onBlur={() => patch({ targetDate: item.targetDate })} />
                </div>
              </div>
              {item.estCost != null && item.estBenefit != null && item.estCost > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700,
                  color: item.estBenefit >= item.estCost ? "#059669" : "#DC2626" }}>
                  {t("roi")}: {(((item.estBenefit - item.estCost) / item.estCost) * 100).toFixed(0)}%
                </div>
              )}
            </div>

            <ComparisonMatrix item={item} setItem={setItem} patch={patch}
              t={t} inp={inp} lbl={lbl} card={card} secTitle={secTitle} miniBtn={miniBtn}  scanDoc={scanDoc} scanning={scanning} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="fs-cols-1-m">
              <MeetingLog item={item} setItem={setItem} patch={patch}
                t={t} inp={inp} card={card} secTitle={secTitle} miniBtn={miniBtn} />
              <LinksPanel item={item} setItem={setItem} patch={patch}
                t={t} inp={inp} card={card} secTitle={secTitle} miniBtn={miniBtn} />
            </div>

            {/* Decision */}
            <div style={card}>
              <div style={secTitle}>{t("decisionTitle")}</div>
              <textarea style={{ ...inp, minHeight: 54, resize: "vertical" }}
                placeholder={t("decisionPh")}
                value={item.decision || ""} onChange={e => setItem({ ...item, decision: e.target.value })}
                onBlur={() => patch({ decision: item.decision || null })} />
            </div>
            {saving && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{t("saving")}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Weighted comparison matrix ─────────────────────────────────────────────
function ComparisonMatrix({ item, setItem, patch, t, inp, lbl, card, secTitle, miniBtn, scanDoc, scanning }: any) {
  const cmp = item.comparison || { criteria: [], options: [] }
  const set = (next: any) => { setItem({ ...item, comparison: next }); }
  const save = (next: any) => patch({ comparison: next })

  const totalWeight = cmp.criteria.reduce((s: number, c: any) => s + (Number(c.weight) || 0), 0)
  const scoreOf = (o: any) => {
    if (!cmp.criteria.length || !totalWeight) return null
    let s2 = 0
    for (const c of cmp.criteria) s2 += ((o.scores?.[c.id] ?? 0) * (Number(c.weight) || 0))
    return Math.round((s2 / totalWeight) * 100) / 100    // 0–5 weighted
  }
  const scores = cmp.options.map((o: any) => ({ id: o.id, v: scoreOf(o) }))
  const best = scores.reduce((b: any, s2: any) =>
    s2.v != null && (b == null || s2.v > b.v) ? s2 : b, null as any)

  // union of spec labels across options
  const specKeys: string[] = Array.from(new Set(
    cmp.options.flatMap((o: any) => Object.keys(o.specs || {}))))

  const cell: React.CSSProperties = { padding: "6px 8px", fontSize: 12,
    borderBottom: "1px solid var(--border)", verticalAlign: "top" }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ ...secTitle, marginBottom: 0 }}>⚖️ {t("cmpTitle")}</div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t("cmpHint")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button style={miniBtn} onClick={() => {
            const next = { ...cmp, options: [...cmp.options,
              { id: uid(), name: `${t("option")} ${cmp.options.length + 1}`, scores: {}, specs: {} }] }
            set(next); save(next)
          }}>＋ {t("option")}</button>
          <button style={miniBtn} onClick={() => {
            const next = { ...cmp, criteria: [...cmp.criteria,
              { id: uid(), name: t("newCriterion"), weight: 10 }] }
            set(next); save(next)
          }}>＋ {t("criterion")}</button>
          {scanDoc && (
            <label style={{ ...miniBtn, cursor: scanning ? "wait" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 5 }}
              title={t("scanOptionTitle")}>
              {scanning === "option" ? "…" : <>🤖 {t("scanOption")}</>}
              <input type="file" accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.csv,.png,.jpg,.jpeg"
                style={{ display: "none" }} disabled={!!scanning}
                onChange={e => { const f = e.target.files?.[0]; if (f) scanDoc("option", f); e.target.value = "" }} />
            </label>
          )}
        </span>
      </div>
      {totalWeight !== 100 && cmp.criteria.length > 0 && (
        <div style={{ fontSize: 11, color: "#B45309", marginBottom: 6 }}>
          {t("weightWarn", { w: totalWeight })}
        </div>
      )}
      {cmp.options.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 0" }}>{t("cmpEmpty")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ ...cell, minWidth: 190, textAlign: "left", fontSize: 10.5,
                  color: "var(--text-3)", textTransform: "uppercase" }}>{t("criterion")} / {t("weight")}</th>
                {cmp.options.map((o: any) => (
                  <th key={o.id} style={{ ...cell, minWidth: 170, textAlign: "left",
                    background: best?.id === o.id && best?.v != null ? "#ECFDF5" : undefined }}>
                    <input style={{ ...inp, fontWeight: 700 }} value={o.name}
                      onChange={e => set({ ...cmp, options: cmp.options.map((x: any) =>
                        x.id === o.id ? { ...x, name: e.target.value } : x) })}
                      onBlur={() => save(item.comparison)} />
                    <input style={{ ...inp, marginTop: 4 }} placeholder={t("vendor")}
                      value={o.vendor || ""}
                      onChange={e => set({ ...cmp, options: cmp.options.map((x: any) =>
                        x.id === o.id ? { ...x, vendor: e.target.value } : x) })}
                      onBlur={() => save(item.comparison)} />
                    <input style={{ ...inp, marginTop: 4 }} type="number" min="0"
                      placeholder={t("cost")} value={o.cost ?? ""}
                      onChange={e => set({ ...cmp, options: cmp.options.map((x: any) =>
                        x.id === o.id ? { ...x, cost: e.target.value === "" ? null : Number(e.target.value) } : x) })}
                      onBlur={() => save(item.comparison)} />
                    <button style={{ ...miniBtn, marginTop: 4, color: "#DC2626" }}
                      onClick={() => { const next = { ...cmp,
                        options: cmp.options.filter((x: any) => x.id !== o.id) }
                        set(next); save(next) }}>✕</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.criteria.map((c: any) => (
                <tr key={c.id}>
                  <td style={cell}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...inp, flex: 1 }} value={c.name}
                        onChange={e => set({ ...cmp, criteria: cmp.criteria.map((x: any) =>
                          x.id === c.id ? { ...x, name: e.target.value } : x) })}
                        onBlur={() => save(item.comparison)} />
                      <input style={{ ...inp, width: 58 }} type="number" min="0" max="100"
                        value={c.weight}
                        onChange={e => set({ ...cmp, criteria: cmp.criteria.map((x: any) =>
                          x.id === c.id ? { ...x, weight: Number(e.target.value) || 0 } : x) })}
                        onBlur={() => save(item.comparison)} />
                      <button style={{ ...miniBtn, color: "#DC2626", padding: "4px 7px" }}
                        onClick={() => { const next = { ...cmp,
                          criteria: cmp.criteria.filter((x: any) => x.id !== c.id) }
                          set(next); save(next) }}>✕</button>
                    </div>
                  </td>
                  {cmp.options.map((o: any) => (
                    <td key={o.id} style={{ ...cell,
                      background: best?.id === o.id && best?.v != null ? "#ECFDF5" : undefined }}>
                      <select value={o.scores?.[c.id] ?? ""}
                        onChange={e => {
                          const v = e.target.value === "" ? undefined : Number(e.target.value)
                          const next = { ...cmp, options: cmp.options.map((x: any) =>
                            x.id === o.id ? { ...x, scores: { ...(x.scores || {}),
                              ...(v === undefined ? {} : { [c.id]: v }) } } : x) }
                          set(next); save(next)
                        }}
                        style={{ ...inp, cursor: "pointer" }}>
                        <option value="">—</option>
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
              {specKeys.concat([""]).map((k, ki) => (
                <tr key={"spec" + ki}>
                  <td style={{ ...cell, fontSize: 11, color: "var(--text-3)" }}>
                    {ki === 0 && specKeys.length === 0
                      ? <SpecAdder cmp={cmp} set={set} save={save} item={item} t={t} inp={inp} />
                      : k || <SpecAdder cmp={cmp} set={set} save={save} item={item} t={t} inp={inp} />}
                  </td>
                  {k !== "" && cmp.options.map((o: any) => (
                    <td key={o.id} style={cell}>
                      <input style={inp} value={o.specs?.[k] || ""}
                        onChange={e => set({ ...cmp, options: cmp.options.map((x: any) =>
                          x.id === o.id ? { ...x, specs: { ...(x.specs || {}), [k]: e.target.value } } : x) })}
                        onBlur={() => save(item.comparison)} />
                    </td>
                  ))}
                  {k === "" && cmp.options.map((o: any) => <td key={o.id} style={cell} />)}
                </tr>
              ))}
              <tr>
                <td style={{ ...cell, fontWeight: 800, borderTop: "2px solid var(--text)" }}>
                  {t("weightedScore")}
                </td>
                {cmp.options.map((o: any) => {
                  const v = scores.find((s2: any) => s2.id === o.id)?.v
                  const isBest = best?.id === o.id && best?.v != null
                  return (
                    <td key={o.id} style={{ ...cell, borderTop: "2px solid var(--text)",
                      fontWeight: 800, fontSize: 15,
                      color: isBest ? "#059669" : "var(--text)",
                      background: isBest ? "#ECFDF5" : undefined }}>
                      {v == null ? "—" : v.toFixed(2)} {isBest && "🏆"}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SpecAdder({ cmp, set, save, item, t, inp }: any) {
  const [v, setV] = useState("")
  return (
    <input style={{ ...inp, fontStyle: "italic" }} placeholder={t("addSpec")}
      value={v} onChange={e => setV(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter" && v.trim()) {
          const key = v.trim()
          const next = { ...cmp, options: cmp.options.map((o: any) =>
            ({ ...o, specs: { ...(o.specs || {}), [key]: o.specs?.[key] || "" } })) }
          set(next); save(next); setV("")
        }
      }} />
  )
}

// ── Meeting log ────────────────────────────────────────────────────────────
function MeetingLog({ item, setItem, patch, t, inp, card, secTitle, miniBtn }: any) {
  const meetings: any[] = item.meetings || []
  const save = (next: any[]) => { setItem({ ...item, meetings: next }); patch({ meetings: next }) }
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ ...secTitle, marginBottom: 0 }}>📝 {t("meetingsTitle")}</div>
        <button style={{ ...miniBtn, marginLeft: "auto" }} onClick={() =>
          save([{ id: uid(), date: new Date().toISOString().slice(0, 10), title: "", notes: "" },
            ...meetings])}>＋</button>
      </div>
      {meetings.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{t("meetingsEmpty")}</div>
      )}
      {meetings.map((m: any) => (
        <div key={m.id} style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...inp, width: 130 }} type="date" value={m.date || ""}
              onChange={e => save(meetings.map(x => x.id === m.id ? { ...x, date: e.target.value } : x))} />
            <input style={{ ...inp, flex: 1 }} placeholder={t("meetingTitlePh")} value={m.title || ""}
              onChange={e => setItem({ ...item, meetings: meetings.map(x => x.id === m.id ? { ...x, title: e.target.value } : x) })}
              onBlur={() => patch({ meetings: item.meetings })} />
            <button style={{ ...miniBtn, color: "#DC2626" }}
              onClick={() => save(meetings.filter(x => x.id !== m.id))}>✕</button>
          </div>
          <textarea style={{ ...inp, marginTop: 6, minHeight: 44, resize: "vertical" }}
            placeholder={t("meetingNotesPh")} value={m.notes || ""}
            onChange={e => setItem({ ...item, meetings: meetings.map(x => x.id === m.id ? { ...x, notes: e.target.value } : x) })}
            onBlur={() => patch({ meetings: item.meetings })} />
        </div>
      ))}
    </div>
  )
}

// ── Reference links ────────────────────────────────────────────────────────
function LinksPanel({ item, setItem, patch, t, inp, card, secTitle, miniBtn }: any) {
  const links: any[] = item.links || []
  const save = (next: any[]) => { setItem({ ...item, links: next }); patch({ links: next }) }
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ ...secTitle, marginBottom: 0 }}>🔗 {t("linksTitle")}</div>
        <button style={{ ...miniBtn, marginLeft: "auto" }} onClick={() =>
          save([...links, { id: uid(), name: "", url: "" }])}>＋</button>
      </div>
      {links.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{t("linksEmpty")}</div>
      )}
      {links.map((l: any) => (
        <div key={l.id} style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)",
          padding: "8px 0", alignItems: "center" }}>
          <input style={{ ...inp, flex: "0 0 38%" }} placeholder={t("linkNamePh")} value={l.name || ""}
            onChange={e => setItem({ ...item, links: links.map(x => x.id === l.id ? { ...x, name: e.target.value } : x) })}
            onBlur={() => patch({ links: item.links })} />
          <input style={{ ...inp, flex: 1 }} placeholder="https://…" value={l.url || ""}
            onChange={e => setItem({ ...item, links: links.map(x => x.id === l.id ? { ...x, url: e.target.value } : x) })}
            onBlur={() => patch({ links: item.links })} />
          {l.url && <a href={l.url} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: "var(--steel,#1B6CA8)", textDecoration: "none" }}>↗</a>}
          <button style={{ ...miniBtn, color: "#DC2626" }}
            onClick={() => save(links.filter(x => x.id !== l.id))}>✕</button>
        </div>
      ))}
    </div>
  )
}
