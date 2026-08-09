"use client"
// src/components/projects/tabs/ProjectDocsTab.tsx
// Three-panel Docs tab: Files | Project Brief | AI Analyzer
import { DateField } from "@/components/shared/DatePicker"
import { dateLocale } from "@/lib/date-locale"
import { M365ImportModal } from "@/components/projects/M365ImportModal"
import { ProjectAIOverviewTab } from "@/components/projects/tabs/ProjectAIOverviewTab"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { usePermissions } from "@/lib/rbac/usePermissions"

const FILE_ICONS: Record<string,string> = {
  "application/pdf": "📄",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.ms-powerpoint": "📑",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📑",
  "text/plain": "📃",
  "text/csv": "📊",
  "image/jpeg": "🖼",
  "image/png": "🖼",
  "image/gif": "🖼",
  "image/webp": "🖼",
}

function fileIcon(type: string) {
  return FILE_ICONS[type] || "📎"
}

function fmtSize(bytes: number) {
  if (bytes > 1_000_000) return `${(bytes/1_000_000).toFixed(1)} MB`
  if (bytes > 1_000)     return `${(bytes/1_000).toFixed(0)} KB`
  return `${bytes} B`
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString(dateLocale(), { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" })
}

const CONTENT_TYPES = [
  { value:"email",         label:"Email" },
  { value:"teams_meeting", label:"Teams meeting transcript" },
  { value:"teams_chat",    label:"Teams chat" },
  { value:"document",      label:"Document / report" },
  { value:"notes",         label:"Meeting notes" },
]

const HEALTH_COLOR: Record<string,string> = {
  GREEN:"#059669", YELLOW:"#F59E0B", RED:"#DC2626", ON_HOLD:"#94A3B8"
}
const HEALTH_LABEL: Record<string,string> = {
  GREEN:"On track", YELLOW:"At risk", RED:"Off track", ON_HOLD:"On hold"
}
const SENTIMENT_COLOR: Record<string,string> = {
  positive:"#059669", neutral:"#64748B", concerning:"#DC2626"
}

export function ProjectDocsTab({ projectId, workspaceId, workspaceName, project, documents, members }: {
  projectId: string; workspaceId: string; workspaceName: string; project: any; documents: any[]; members: any[]
}) {
  const router = useRouter()
  const { can } = usePermissions()
  const canShare = can("projects:edit")
  const [pickerDoc, setPickerDoc] = useState<string|null>(null)

  async function setDocShares(doc:any, userIds:string[]) {
    setFiles(fs => fs.map((d:any) => d.id === doc.id ? { ...d, shares: userIds.map(uid => ({ userId: uid })) } : d))
    try {
      await fetch(`/api/projects/${projectId}/documents/${doc.id}?workspaceId=${workspaceId}`, {
        method:"PATCH", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ shareUserIds: userIds }),
      })
    } catch { /* revert on next load */ }
  }
  function toggleMember(doc:any, userId:string) {
    const current = (doc.shares || []).map((s:any) => s.userId)
    const next = current.includes(userId) ? current.filter((u:string) => u !== userId) : [...current, userId]
    setDocShares(doc, next)
  }
  const [tab, setTab] = useState<"files"|"ai">("files")

  async function toggleShare(doc: any) {
    const next = !doc.sharedWithClient
    setFiles(fs => fs.map((d:any) => d.id === doc.id ? { ...d, sharedWithClient: next } : d))  // optimistic
    try {
      await fetch(`/api/projects/${projectId}/documents/${doc.id}?workspaceId=${workspaceId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithClient: next }),
      })
    } catch {
      setFiles(fs => fs.map((d:any) => d.id === doc.id ? { ...d, sharedWithClient: !next } : d))  // revert
    }
  }

  // ── FILES ──────────────────────────────────────
  const [files, setFiles] = useState(documents)
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState("")
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [deletingId, setDeletingId]     = useState<string|null>(null)
  const [viewingPdf, setViewingPdf]     = useState<{name:string;url:string;kind:"pdf"|"docx";html?:string;loading?:boolean;error?:string}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] = useState(false)
  const [m365Open, setM365Open] = useState(false)

  // Uploads any number of files sequentially; used by the picker (now
  // multi-select) and by drag-and-drop onto the Files area.
  async function uploadMany(list: FileList | File[]) {
    const items = Array.from(list)
    if (!items.length) return
    setUploading(true); setUploadError(""); setUploadSuccess("")
    let okCount = 0
    const errors: string[] = []
    for (let i = 0; i < items.length; i++) {
      const file = items[i]
      setUploadSuccess(items.length > 1 ? `Uploading ${i + 1}/${items.length} — ${file.name}` : "")
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST", body: fd,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) errors.push(`${file.name}: ${data.error || `failed (${res.status})`}`)
        else { setFiles(f => [data.data, ...f]); okCount++ }
      } catch {
        errors.push(`${file.name}: network error`)
      }
    }
    setUploading(false)
    setUploadSuccess(okCount
      ? `${okCount} file${okCount === 1 ? "" : "s"} uploaded successfully`
      : "")
    if (okCount) setTimeout(() => setUploadSuccess(""), 4000)
    setUploadError(errors.join(" · "))
    if (okCount) router.refresh()
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) await uploadMany(e.target.files)
  }

  async function handleDelete(docId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(docId)
    try {
      await fetch(`/api/projects/${projectId}/documents/${docId}`, { method:"DELETE" })
      setFiles(f => f.filter(d => d.id !== docId))
      router.refresh()
    } finally { setDeletingId(null) }
  }

  // ── Week helpers (grouping + reassignment) ──
  const weekStartOf = (d: any) => {
    const dt = new Date(d); const day = dt.getDay()
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0,0,0,0)
    return dt
  }
  const effWeek = (doc: any) => weekStartOf(doc.weekOf || doc.createdAt)
  const thisWeekTs = weekStartOf(new Date()).getTime()
  const weekLabel = (s: Date) => {
    if (s.getTime() === thisWeekTs) return "This week"
    const end = new Date(s); end.setDate(s.getDate() + 6)
    const f = (d: Date) => d.toLocaleDateString(dateLocale(), { month:"short", day:"numeric", timeZone:"UTC" })
    return `Week of ${f(s)} – ${f(end)}, ${end.getFullYear()}`
  }
  function groupByWeek(list: any[]) {
    const groups: { start: Date; docs: any[] }[] = []
    for (const doc of list) {
      const start = effWeek(doc)
      const g = groups.find(x => x.start.getTime() === start.getTime())
      if (g) g.docs.push(doc); else groups.push({ start, docs: [doc] })
    }
    groups.sort((a, b) => b.start.getTime() - a.start.getTime())
    return groups
  }
  // Recent Mondays for the "move to week" menu
  const weekOptions = (() => {
    const opts: Date[] = []
    const base = weekStartOf(new Date())
    for (let i = 0; i < 12; i++) { const d = new Date(base); d.setDate(base.getDate() - i * 7); opts.push(d) }
    return opts
  })()
  const [movingWeekDocId, setMovingWeekDocId] = useState<string | null>(null)

  async function moveDocToWeek(doc: any, weekIso: string | null) {
    const prev = doc.weekOf || null
    setFiles(fs => fs.map((d: any) => d.id === doc.id ? { ...d, weekOf: weekIso } : d))  // optimistic
    setMovingWeekDocId(null)
    try {
      await fetch(`/api/projects/${projectId}/documents/${doc.id}?workspaceId=${workspaceId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOf: weekIso }),
      })
    } catch {
      setFiles(fs => fs.map((d: any) => d.id === doc.id ? { ...d, weekOf: prev } : d))  // revert
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Tab selector */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"0 16px", display:"flex", gap:0, flexShrink:0 }}>
        {[
          { id:"files", label:"📎 Files" },
          { id:"ai",    label:"🤖 AI Analysis" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding:"12px 16px", border:"none", background:"none",
              borderBottom:`2px solid ${tab===t.id ? "var(--steel)" : "transparent"}`,
              fontSize:13, fontWeight:tab===t.id ? 600 : 400,
              color:tab===t.id ? "var(--steel)" : "var(--text-3)",
              cursor:"pointer", fontFamily:"var(--font)", transition:"all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {m365Open && (
        <M365ImportModal projectId={projectId} workspaceId={workspaceId}
          onClose={() => setM365Open(false)}
          onImported={docs => { setFiles(f => [...docs, ...f]); router.refresh() }} />
      )}

      {/* ── FILES TAB ── */}
      {tab === "files" && (
        <div
          onDragOver={e => { e.preventDefault(); if (can("projects:edit")) setDragOver(true) }}
          onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false) }}
          onDrop={e => { e.preventDefault(); setDragOver(false)
            if (can("projects:edit") && e.dataTransfer.files?.length) uploadMany(e.dataTransfer.files) }}
          style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden",
            position:"relative",
            outline: dragOver ? "2px dashed var(--steel)" : "none", outlineOffset: -6 }}>
          {dragOver && (
            <div style={{ position:"absolute", inset:0, zIndex:5, pointerEvents:"none",
              background:"rgba(27,108,168,.06)", display:"grid", placeItems:"center" }}>
              <div style={{ background:"#fff", border:"1.5px dashed var(--steel)", borderRadius:10,
                padding:"12px 22px", fontSize:13, fontWeight:600, color:"var(--steel)" }}>
                Drop files to upload
              </div>
            </div>
          )}
          <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
            padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <span style={{ fontSize:13, color:"var(--text-3)" }}>
              {files.length} document{files.length!==1?"s":""}
            </span>
            {uploadError && (
              <span style={{ fontSize:12, color:"var(--red)" }}>✗ {uploadError}</span>
            )}
            {uploadSuccess && (
              <span style={{ fontSize:12, color:"var(--green)" }}>✓ {uploadSuccess}</span>
            )}
            <div style={{ marginLeft:"auto" }}>
              <input ref={fileRef} type="file" multiple style={{ display:"none" }} onChange={handleUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.msg,.vtt,.json,.xml,.log,.jpg,.jpeg,.png,.gif,.webp" />
              <button onClick={() => setM365Open(true)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
                background:"#fff", color:"var(--text-1)", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", fontSize:13, fontWeight:600, cursor:"pointer",
                fontFamily:"var(--font)" }}>
              <svg width="14" height="14" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
              Import from 365
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", border:"none",
                  borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:uploading?"wait":"pointer", fontFamily:"var(--font)" }}>
                {uploading ? "Uploading…" : "📎 Upload file"}
              </button>
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:16 }}>
            {files.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
                <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:6 }}>
                  No files yet
                </div>
                <div style={{ fontSize:13, color:"var(--text-3)", marginBottom:20 }}>
                  Upload proposals, contracts, meeting minutes, emails, or any project document.
                </div>
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                    fontFamily:"var(--font)" }}>
                  Upload first file
                </button>
                <div style={{ marginTop:10 }}>
                  <button onClick={() => setM365Open(true)}
                    style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px",
                      background:"#fff", color:"var(--text-1)", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:13, fontWeight:600, cursor:"pointer",
                      fontFamily:"var(--font)" }}>
                    <svg width="13" height="13" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
                    Import from Microsoft 365
                  </button>
                </div>
              </div>
            ) : (
              <>
              {/* Inline PDF Viewer */}
      {viewingPdf && (
                <div style={{ marginBottom:16, background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                    borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--text)", flex:1 }}>
                      📄 {viewingPdf.name}
                    </span>
                    <a href={viewingPdf.url} download={viewingPdf.name}
                      style={{ fontSize:11, color:"var(--steel)", textDecoration:"none" }}>
                      ↓ Download
                    </a>
                    <button onClick={()=>setViewingPdf(null)}
                      style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none",
                        cursor:"pointer", fontFamily:"var(--font)" }}>✕ Close</button>
                  </div>
                  {viewingPdf.kind === "pdf" ? (
                    <iframe
                      src={viewingPdf.url}
                      style={{ width:"100%", height:600, border:"none" }}
                      title={viewingPdf.name}
                    />
                  ) : (
                    <div style={{ height:600, overflow:"auto", padding:"24px 28px",
                      background:"#fff", color:"#111", lineHeight:1.6, fontSize:14 }}>
                      {viewingPdf.loading ? (
                        <div style={{ color:"#666", fontSize:13 }}>Rendering preview…</div>
                      ) : viewingPdf.error ? (
                        <div style={{ color:"#666", fontSize:13 }}>
                          {viewingPdf.error} — use ↓ Download to open the file.
                        </div>
                      ) : (
                        <div className="docx-preview"
                          dangerouslySetInnerHTML={{ __html: viewingPdf.html || "" }} />
                      )}
                    </div>
                  )}
                </div>
              )}
              {(() => {
                const groups = groupByWeek(files)
                return groups.map(g => (
                  <div key={g.start.toISOString()} style={{ marginBottom: 18 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0 10px" }}>
                      <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                        letterSpacing:".06em", color:"var(--text-3)", flexShrink:0 }}>
                        {weekLabel(g.start)}
                      </span>
                      <div style={{ flex:1, height:1, background:"var(--border)" }} />
                      <span style={{ fontSize:11, color:"var(--text-3)", flexShrink:0 }}>
                        {g.docs.length} file{g.docs.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                      {g.docs.map(doc => (
                  <div key={doc.id} style={{ background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", padding:14, display:"flex", flexDirection:"column",
                    gap:8, transition:"box-shadow .15s" }}
                    onMouseOver={e => (e.currentTarget.style.boxShadow="var(--shadow-md)")}
                    onMouseOut={e  => (e.currentTarget.style.boxShadow="none")}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                      <span style={{ fontSize:28, flexShrink:0 }}>{fileIcon(doc.fileType)}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {doc.name}
                        </div>
                        {doc.description && (
                          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8,
                      fontSize:11, color:"var(--text-3)" }}>
                      {doc.uploadedBy && <Avatar name={doc.uploadedBy.name} size={16} />}
                      <span>{fmtDate(doc.createdAt)}</span>
                      <span>·</span>
                      <span>{fmtSize(doc.fileSize || 0)}</span>
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                      <button onClick={async () => {
                        const type = doc.fileType || ""
                        const url  = doc.fileUrl
                        const name = String(doc.name || "").toLowerCase()
                        const isDocx = type.includes("wordprocessingml") || type === "application/msword" || name.endsWith(".docx")
                        if (type === "application/pdf") {
                          setViewingPdf({ name:doc.name, url, kind:"pdf" })
                        } else if (type.startsWith("image/")) {
                          window.open(url, "_blank")
                        } else if (isDocx) {
                          setViewingPdf({ name:doc.name, url, kind:"docx", loading:true })
                          try {
                            const res = await fetch(`/api/projects/${projectId}/documents/${doc.id}/preview?workspaceId=${workspaceId}`)
                            const data = await res.json()
                            if (!res.ok) throw new Error(data?.error || "Preview unavailable")
                            setViewingPdf({ name:doc.name, url, kind:"docx", html:data.html })
                          } catch (e:any) {
                            setViewingPdf({ name:doc.name, url, kind:"docx", error:e?.message || "Preview unavailable" })
                          }
                        } else {
                          window.open(url, "_blank")
                        }
                      }}
                        style={{ flex:1, padding:"6px 0", textAlign:"center", background:"var(--surface)",
                          border:"1px solid var(--border)", borderRadius:"var(--radius)",
                          fontSize:12, color:"var(--text-2)", textDecoration:"none",
                          cursor:"pointer", fontFamily:"var(--font)", outline:"none" }}>
                        👁 Preview
                      </button>
                      <a href={doc.fileUrl} download={doc.name}
                        style={{ flex:1, padding:"6px 0", textAlign:"center", background:"var(--surface)",
                          border:"1px solid var(--border)", borderRadius:"var(--radius)",
                          fontSize:12, color:"var(--text-2)", textDecoration:"none",
                          cursor:"pointer", fontFamily:"var(--font)" }}>
                        ↓ Download
                      </a>
                      {canShare && (
                        <div style={{ position:"relative" }}>
                          <button onClick={() => setPickerDoc(pickerDoc===doc.id ? null : doc.id)}
                            title="Share with members or clients"
                            style={{ padding:"6px 10px", borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                              fontFamily:"var(--font)", whiteSpace:"nowrap",
                              background: (doc.shares?.length || doc.sharedWithClient) ? "#ECFDF5" : "#fff",
                              border: "1px solid " + ((doc.shares?.length || doc.sharedWithClient) ? "#6EE7B7" : "var(--border)"),
                              color: (doc.shares?.length || doc.sharedWithClient) ? "#059669" : "var(--text-2)" }}>
                            {(doc.shares?.length || doc.sharedWithClient)
                              ? `✓ Shared${doc.shares?.length ? ` (${doc.shares.length})` : ""}`
                              : "Share"}
                          </button>
                          {pickerDoc===doc.id && (
                            <>
                              <div onClick={()=>setPickerDoc(null)} style={{ position:"fixed", inset:0, zIndex:40 }} />
                              <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0, width:250, maxHeight:300,
                                overflowY:"auto", background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                                boxShadow:"0 8px 24px rgba(0,0,0,.14)", zIndex:41, padding:8 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
                                  letterSpacing:".05em", padding:"4px 6px" }}>Share with members</div>
                                {members.map((m:any) => {
                                  const uid = m.user?.id || m.userId
                                  const checked = (doc.shares||[]).some((s:any)=>s.userId===uid)
                                  return (
                                    <label key={uid} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px",
                                      cursor:"pointer", fontSize:13, borderRadius:5 }}>
                                      <input type="checkbox" checked={checked} onChange={()=>toggleMember(doc, uid)} />
                                      <span style={{ color:"var(--text-1)" }}>{m.user?.name || "Member"}</span>
                                      <span style={{ marginLeft:"auto", fontSize:10, color:"var(--text-4)" }}>
                                        {(m.role||"").replace(/_/g," ")}
                                      </span>
                                    </label>
                                  )
                                })}
                                <div style={{ borderTop:"1px solid var(--border)", marginTop:4, paddingTop:4 }}>
                                  <label style={{ display:"flex", alignItems:"center", gap:8, padding:"6px",
                                    cursor:"pointer", fontSize:13 }}>
                                    <input type="checkbox" checked={!!doc.sharedWithClient} onChange={()=>toggleShare(doc)} />
                                    <span style={{ color:"var(--text-1)" }}>All clients on this project</span>
                                  </label>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <div style={{ position:"relative" }}>
                        <button onClick={() => setMovingWeekDocId(movingWeekDocId===doc.id ? null : doc.id)}
                          title="Move this document to another week"
                          style={{ padding:"6px 10px", background:"#fff", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:12, color:"var(--text-2)",
                            cursor:"pointer", fontFamily:"var(--font)" }}>
                          📅
                        </button>
                        {movingWeekDocId === doc.id && (
                          <div style={{ position:"absolute", right:0, top:"110%", zIndex:20,
                            background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                            boxShadow:"var(--shadow-md)", padding:6, width:230, maxHeight:220, overflowY:"auto" }}>
                            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                              letterSpacing:".05em", color:"var(--text-3)", padding:"4px 6px" }}>
                              Move to week
                            </div>
                            {doc.weekOf && (
                              <button onClick={() => moveDocToWeek(doc, null)}
                                style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 8px",
                                  background:"none", border:"none", fontSize:12, color:"var(--text-2)",
                                  cursor:"pointer", fontFamily:"var(--font)" }}>
                                ↩ Reset to upload week
                              </button>
                            )}
                            {weekOptions.map(w => {
                              const active = effWeek(doc).getTime() === w.getTime()
                              return (
                                <button key={w.toISOString()} disabled={active}
                                  onClick={() => moveDocToWeek(doc, w.toISOString())}
                                  style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 8px",
                                    background: active ? "var(--surface)" : "none", border:"none",
                                    fontSize:12, color: active ? "var(--text-4)" : "var(--text)",
                                    cursor: active ? "default" : "pointer", fontFamily:"var(--font)",
                                    borderRadius:6 }}>
                                  {active ? "✓ " : ""}{weekLabel(w)}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      {can("projects:edit") && (
                      <button onClick={() => handleDelete(doc.id, doc.name)}
                        disabled={deletingId === doc.id}
                        style={{ padding:"6px 10px", background:"#fff", border:"1px solid #FECACA",
                          borderRadius:"var(--radius)", fontSize:12, color:"var(--red)",
                          cursor:"pointer", fontFamily:"var(--font)" }}>
                        {deletingId === doc.id ? "…" : "Delete"}
                      </button>
                      )}
                    </div>
                  </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECT BRIEF TAB ── */}


      {/* ── AI ASSISTANT TAB ── */}
      {tab === "ai" && (
        <div style={{ flex:1, overflowY:"auto" }}>
          {/* One ingestion experience, used here and in the AI Overview tab:
              read documents (or pasted content) → group findings by destination
              tab → approve → apply. Report generation lives in the Reports tab. */}
          <ProjectAIOverviewTab
            projectId={projectId}
            workspaceId={workspaceId}
            documents={files.map((f: any) => ({ id: f.id, name: f.name }))}
          />
        </div>
      )}
    </div>
  )
}
