"use client"
// src/components/projects/M365ImportModal.tsx
// OneDrive / SharePoint picker for the Docs tab. One-way snapshot import —
// selected files are copied into the project's documents.

import { useEffect, useState } from "react"

interface Item {
  id: string; name: string; isFolder: boolean; size: number
  mimeType: string | null; driveId: string
}
interface Crumb { label: string; itemId?: string }

const fmtSize = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

export function M365ImportModal({ projectId, workspaceId, onClose, onImported }: {
  projectId: string; workspaceId?: string
  onClose: () => void; onImported: (docs: any[]) => void
}) {
  const [tab, setTab] = useState<"onedrive" | "sharepoint">("onedrive")
  const [items, setItems] = useState<Item[]>([])
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "OneDrive" }])
  const [driveId, setDriveId] = useState<string | null>(null) // sharepoint drive
  const [sites, setSites] = useState<{ id: string; name: string }[] | null>(null)
  const [drives, setDrives] = useState<{ id: string; name: string }[] | null>(null)
  const [siteQ, setSiteQ] = useState("")
  const [sel, setSel] = useState<Record<string, Item>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [importing, setImporting] = useState<string>("")

  const H: Record<string, string> = workspaceId ? { "x-workspace-id": workspaceId } : {}

  async function api(qs: string) {
    setLoading(true); setError("")
    const res = await fetch(`/api/m365/files?${qs}`, { headers: H }).catch(() => null)
    setLoading(false)
    if (!res) { setError("Network error"); return null }
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d?.error || `Failed (${res.status})`); return null }
    return d.data
  }

  async function openOneDrive(itemId?: string, label?: string) {
    const d = await api(`view=onedrive${itemId ? `&itemId=${itemId}` : ""}`)
    if (!d) return
    setItems(d.items)
    setCrumbs(c => itemId ? [...c, { label: label || "…", itemId }] : [{ label: "OneDrive" }])
  }
  async function loadSites(q = "") {
    const d = await api(`view=sites&q=${encodeURIComponent(q)}`)
    if (d) { setSites(d.sites); setDrives(null); setItems([]); setCrumbs([{ label: "SharePoint" }]) }
  }
  async function openSite(siteId: string, name: string) {
    const d = await api(`view=siteDrives&siteId=${encodeURIComponent(siteId)}`)
    if (d) { setDrives(d.drives); setSites(null); setCrumbs([{ label: "SharePoint" }, { label: name }]) }
  }
  async function openDrive(dId: string, name: string, itemId?: string) {
    const d = await api(`view=drive&driveId=${encodeURIComponent(dId)}${itemId ? `&itemId=${itemId}` : ""}`)
    if (!d) return
    setDriveId(dId); setSites(null); setDrives(null)
    setItems(d.items)
    setCrumbs(c => itemId ? [...c, { label: name, itemId }] : [...c.slice(0, 2), { label: name }])
  }

  useEffect(() => { openOneDrive() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchTab(t: "onedrive" | "sharepoint") {
    setTab(t); setSel({}); setItems([]); setError("")
    if (t === "onedrive") { setSites(null); setDrives(null); openOneDrive() }
    else loadSites()
  }

  function crumbTo(i: number) {
    const c = crumbs[i]
    if (tab === "onedrive") {
      if (i === 0) openOneDrive()
      else openOneDrive(c.itemId, c.label)
      setCrumbs(crumbs.slice(0, i + (i === 0 ? 1 : 0)))
      if (i > 0) setCrumbs(crumbs.slice(0, i + 1))
    } else {
      if (i === 0) loadSites(siteQ)
    }
  }

  async function doImport() {
    const files = Object.values(sel)
    if (!files.length) return
    const list = files.map(f => ({ driveId: f.driveId, itemId: f.id }))
    setImporting(`Importing 1/${files.length}…`)
    const res = await fetch(`/api/projects/${projectId}/documents/import-m365`, {
      method: "POST", headers: { "Content-Type": "application/json", ...H },
      body: JSON.stringify({ files: list }),
    }).catch(() => null)
    setImporting("")
    if (!res) { setError("Network error"); return }
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d?.error || `Import failed (${res.status})`); return }
    const { imported, failed } = d.data || {}
    if (failed?.length) setError(failed.map((f: any) => `${f.name}: ${f.reason}`).join(" · "))
    if (imported?.length) { onImported(imported); if (!failed?.length) onClose() }
  }

  const selCount = Object.keys(sel).length

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,.5)",
      zIndex: 70, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14,
        width: "min(680px,100%)", maxHeight: "86vh", display: "flex", flexDirection: "column",
        overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border,#E2E8F0)",
          display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Import from Microsoft 365</div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "none",
            fontSize: 18, cursor: "pointer", color: "var(--text-3)" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 20px 0" }}>
          {(["onedrive", "sharepoint"] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                border: "1px solid var(--border,#E2E8F0)", cursor: "pointer",
                background: tab === t ? "var(--steel,#1B6CA8)" : "#fff",
                color: tab === t ? "#fff" : "var(--text-2)" }}>
              {t === "onedrive" ? "OneDrive" : "SharePoint"}
            </button>
          ))}
        </div>

        {tab === "sharepoint" && sites !== null && (
          <div style={{ padding: "10px 20px 0", display: "flex", gap: 8 }}>
            <input value={siteQ} onChange={e => setSiteQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadSites(siteQ)}
              placeholder="Search sites…" style={{ flex: 1, padding: "7px 10px",
                border: "1px solid var(--border,#E2E8F0)", borderRadius: 8, fontSize: 12.5 }} />
            <button onClick={() => loadSites(siteQ)} style={{ padding: "7px 14px", borderRadius: 8,
              border: "1px solid var(--border,#E2E8F0)", background: "#fff", fontSize: 12.5,
              fontWeight: 600, cursor: "pointer" }}>Search</button>
          </div>
        )}

        <div style={{ padding: "8px 20px 0", fontSize: 12, color: "var(--text-3)",
          display: "flex", gap: 4, flexWrap: "wrap" }}>
          {crumbs.map((c, i) => (
            <span key={i}>
              <button onClick={() => crumbTo(i)} style={{ border: "none", background: "none",
                color: i === crumbs.length - 1 ? "var(--text-1)" : "var(--steel,#1B6CA8)",
                fontWeight: i === crumbs.length - 1 ? 700 : 500, cursor: "pointer", padding: 0,
                fontSize: 12 }}>{c.label}</button>
              {i < crumbs.length - 1 && <span style={{ margin: "0 4px" }}>›</span>}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px", minHeight: 220 }}>
          {loading && <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)",
            fontSize: 13 }}>Loading…</div>}
          {!loading && sites?.map(s => (
            <button key={s.id} onClick={() => openSite(s.id, s.name)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
                textAlign: "left", padding: "9px 10px", border: "none", background: "none",
                borderBottom: "1px solid var(--surface-1,#F1F5F9)", cursor: "pointer",
                fontSize: 13 }}>
              <span>🏢</span> {s.name}
            </button>
          ))}
          {!loading && drives?.map(d0 => (
            <button key={d0.id} onClick={() => openDrive(d0.id, d0.name)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
                textAlign: "left", padding: "9px 10px", border: "none", background: "none",
                borderBottom: "1px solid var(--surface-1,#F1F5F9)", cursor: "pointer",
                fontSize: 13 }}>
              <span>🗂️</span> {d0.name}
            </button>
          ))}
          {!loading && !sites && !drives && items.map(it => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderBottom: "1px solid var(--surface-1,#F1F5F9)",
              fontSize: 13 }}>
              {it.isFolder ? (
                <button onClick={() =>
                  tab === "onedrive" ? openOneDrive(it.id, it.name) : openDrive(it.driveId, it.name, it.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, flex: 1,
                    textAlign: "left", border: "none", background: "none", cursor: "pointer",
                    fontSize: 13, padding: 0 }}>
                  <span>📁</span> <b>{it.name}</b>
                </button>
              ) : (
                <>
                  <input type="checkbox" checked={!!sel[it.id]}
                    onChange={e => setSel(s => {
                      const n = { ...s }
                      if (e.target.checked) n[it.id] = it; else delete n[it.id]
                      return n
                    })} />
                  <span>📄</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap" }}>{it.name}</span>
                  <span style={{ color: "var(--text-3)", fontSize: 11.5 }}>{fmtSize(it.size)}</span>
                </>
              )}
            </div>
          ))}
          {!loading && !sites && !drives && !items.length && !error && (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
              Empty folder.
            </div>
          )}
        </div>

        {error && <div style={{ margin: "0 20px 8px", padding: "8px 12px", background: "#FEF2F2",
          border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#B91C1C" }}>{error}</div>}

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border,#E2E8F0)",
          display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {selCount ? `${selCount} file${selCount === 1 ? "" : "s"} selected · max 25 MB each`
              : "Select files to copy into this project's Docs"}
          </span>
          <button onClick={doImport} disabled={!selCount || !!importing}
            style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 9, border: "none",
              background: selCount ? "var(--steel,#1B6CA8)" : "#CBD5E1", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: selCount ? "pointer" : "default" }}>
            {importing || `Import${selCount ? ` (${selCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  )
}
