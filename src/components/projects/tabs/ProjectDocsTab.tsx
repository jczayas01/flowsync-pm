"use client"
// src/components/projects/tabs/ProjectDocsTab.tsx
// Three-panel Docs tab: Files | Project Brief | AI Analyzer
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"
import { ProjectBrief } from "@/components/projects/ProjectBrief"
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
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
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
  const [tab, setTab] = useState<"files"|"brief"|"ai">("files")

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError(""); setUploadSuccess("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method:"POST", body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || "Upload failed")
      } else {
        setFiles(f => [data.data, ...f])
        setUploadSuccess(`${file.name} uploaded successfully`)
        setTimeout(() => setUploadSuccess(""), 4000)
        router.refresh()
      }
    } catch {
      setUploadError("Network error — please try again")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
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

  // ── AI ANALYZER ────────────────────────────────
  const [aiContent, setAiContent] = useState("")
  const [aiContentType, setAiContentType] = useState("email")
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiError, setAiError] = useState("")
  const [aiUploading, setAiUploading] = useState(false)
  const aiFileRef = useRef<HTMLInputElement>(null)

  async function handleAiFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiUploading(true); setAiError("")
    try {
      const lower = file.name.toLowerCase()
      const needsServer = /\.(docx?|pdf|xlsx|pptx)$/.test(lower)

      let text = ""
      if (needsServer) {
        // Word/PDF can't be read in the browser — extract text server-side
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`/api/projects/${projectId}/ai-analyze/extract?workspaceId=${workspaceId}`, {
          method: "POST", body: fd,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Could not read file")
        text = data.text || ""
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error("Failed to read file"))
          reader.readAsText(file)
        })
      }
      setAiContent(text.slice(0, 12000)) // limit to 12k chars
      // Auto-detect content type from filename
      const name = file.name.toLowerCase()
      if (name.includes("minute") || name.includes("meeting")) setAiContentType("meeting_notes")
      else if (name.includes("email") || name.includes("mail"))  setAiContentType("email")
      else if (name.includes("report") || name.includes("status")) setAiContentType("status_report")
      else setAiContentType("notes")
    } catch (err: any) {
      setAiError(err?.message || "Could not read file — try a .txt, .docx, or .pdf, or paste the content manually")
    } finally {
      setAiUploading(false)
      if (aiFileRef.current) aiFileRef.current.value = ""
    }
  }

  // Report generator
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
  const [reportHealth, setReportHealth] = useState("GREEN")
  const [reportNotes, setReportNotes] = useState("")
  const [reportPeriodStart, setReportPeriodStart] = useState(weekStart.toISOString().split("T")[0])
  const [reportPeriodEnd,   setReportPeriodEnd]   = useState(weekEnd.toISOString().split("T")[0])
  const [reportGenerating, setReportGenerating] = useState(false)
  const [reportResult, setReportResult] = useState<any>(null)
  const [reportError, setReportError] = useState("")
  const [savingReport, setSavingReport] = useState(false)
  const [reportSaved, setReportSaved] = useState(false)

  async function analyzeContent() {
    if (!aiContent.trim()) return
    setAiAnalyzing(true); setAiError(""); setAiResult(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-analyze`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"analyze_content", content:aiContent, contentType:aiContentType }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error || "Analysis failed"); return }
      setAiResult(data.data)
    } catch { setAiError("Network error") }
    finally { setAiAnalyzing(false) }
  }

  async function generateReport() {
    setReportGenerating(true); setReportError(""); setReportResult(null); setReportSaved(false)
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-analyze`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          action:"generate_status_report",
          health:reportHealth, additionalNotes:reportNotes,
          periodStart:reportPeriodStart, periodEnd:reportPeriodEnd,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setReportError(data.error || "Generation failed"); return }
      setReportResult(data.data)
    } catch { setReportError("Network error") }
    finally { setReportGenerating(false) }
  }

  const [saveReportError, setSaveReportError] = useState("")

  async function saveReport() {
    if (!reportResult) return
    setSavingReport(true); setSaveReportError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/status-updates`, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          type: "WEEKLY_STATUS",
          health: reportHealth,
          periodStart: new Date(reportPeriodStart + "T00:00:00.000Z").toISOString(),
          periodEnd:   new Date(reportPeriodEnd   + "T00:00:00.000Z").toISOString(),
          percentComplete: reportResult.percent_complete || 0,
          summary:         reportResult.summary,
          accomplishments: reportResult.accomplishments,
          nextSteps:       reportResult.next_steps,
          risks:           reportResult.risks,
          issues:          reportResult.issues,
        }),
      })
      if (res.ok) {
        setReportSaved(true)
        // Don't rely on router.refresh() — navigate directly to Reports tab
        // so the user can see their saved report immediately
      } else {
        const d = await res.json().catch(() => ({}))
        setSaveReportError(d.error || `Save failed (${res.status})`)
      }
    } catch {
      setSaveReportError("Network error — please try again")
    } finally { setSavingReport(false) }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Tab selector */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"0 16px", display:"flex", gap:0, flexShrink:0 }}>
        {[
          { id:"files", label:"📎 Files" },
          { id:"brief", label:"📄 Project Brief" },
          { id:"ai",    label:"🤖 AI Assistant" },
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

      {/* ── FILES TAB ── */}
      {tab === "files" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
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
              <input ref={fileRef} type="file" style={{ display:"none" }} onChange={handleUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" />
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
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                {files.map(doc => (
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
                    <div style={{ display:"flex", gap:8, marginTop:4 }}>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECT BRIEF TAB ── */}
      {tab === "brief" && (
        <ProjectBrief
          projectId={projectId}
          project={project}
          members={members}
          workspaceName={workspaceName}
        />
      )}

      {/* ── AI ASSISTANT TAB ── */}
      {tab === "ai" && (
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:20 }}>

            {/* SECTION 1: Content Analyzer */}
            <div style={{ background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)",
                background:"linear-gradient(135deg,#1B6CA808,#7C3AED08)" }}>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>
                  🤖 Content Analyzer
                </div>
                <div style={{ fontSize:12, color:"var(--text-3)", marginTop:3 }}>
                  Paste an email, Teams meeting transcript, or notes — AI extracts action items,
                  risks, and decisions and suggests where they belong in this project.
                </div>
              </div>

              <div style={{ padding:18 }}>
                <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
                  <label style={{ fontSize:12, fontWeight:500, color:"var(--text-2)", flexShrink:0 }}>
                    Content type:
                  </label>
                  <select value={aiContentType} onChange={e => setAiContentType(e.target.value)}
                    style={{ ...inp, width:"auto", flex:1 }}>
                    {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {/* Upload document button */}
                  <input ref={aiFileRef} type="file"
                    accept=".txt,.md,.csv,.json,.xml,.log,.text,.docx,.doc,.pdf,.xlsx,.pptx"
                    style={{ display:"none" }}
                    onChange={handleAiFileUpload} />
                  <button onClick={() => aiFileRef.current?.click()} disabled={aiUploading}
                    title="Upload a document (.docx, .pdf, .xlsx, .pptx, .txt, .md, .csv) to analyze"
                    style={{ padding:"7px 14px", background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)", whiteSpace:"nowrap",
                      display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                    {aiUploading ? "⏳ Reading…" : "📎 Upload file"}
                  </button>
                </div>
                {aiContent && (
                  <div style={{ fontSize:11, color:"var(--text-4)", marginBottom:6 }}>
                    {aiContent.length.toLocaleString()} characters loaded
                    <button onClick={()=>{setAiContent("");setAiResult(null)}}
                      style={{ marginLeft:10, fontSize:11, color:"var(--red)", background:"none",
                        border:"none", cursor:"pointer", fontFamily:"var(--font)" }}>
                      × Clear
                    </button>
                  </div>
                )}

                <textarea value={aiContent} onChange={e => setAiContent(e.target.value)}
                  rows={8} placeholder={
                    aiContentType === "email"
                      ? "Paste your email here...\n\nFrom: john@example.com\nSubject: Project Status Update\n\nHi team, I wanted to update you on..."
                      : aiContentType === "teams_meeting"
                      ? "Paste your Teams meeting transcript here...\n\n[00:00] Juan Carlos: Good morning everyone...\n[00:15] María: Thanks for joining..."
                      : "Paste your content here..."
                  }
                  style={{ ...inp, resize:"vertical", lineHeight:1.65, marginBottom:12, fontFamily:"monospace", fontSize:12 }} />

                {aiError && (
                  <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
                    padding:"9px 12px", borderRadius:"var(--radius)", fontSize:12, marginBottom:12 }}>
                    ✗ {aiError}
                  </div>
                )}

                <button onClick={analyzeContent} disabled={aiAnalyzing || !aiContent.trim()}
                  style={{ padding:"10px 22px", background:"var(--steel)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                    cursor:aiAnalyzing||!aiContent.trim() ? "not-allowed" : "pointer",
                    fontFamily:"var(--font)", opacity:!aiContent.trim() ? 0.5 : 1 }}>
                  {aiAnalyzing ? "🤔 Analyzing…" : "Analyze content →"}
                </button>

                {/* AI Result */}
                {aiResult && (
                  <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:14 }}>
                    {/* Summary + sentiment */}
                    <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:14 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:"var(--text)",
                          textTransform:"uppercase", letterSpacing:".05em" }}>Summary</span>
                        {aiResult.sentiment && (
                          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                            background:`${SENTIMENT_COLOR[aiResult.sentiment]}18`,
                            color:SENTIMENT_COLOR[aiResult.sentiment] }}>
                            {aiResult.sentiment}
                          </span>
                        )}
                        {aiResult.recommended_health && (
                          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                            background:`${HEALTH_COLOR[aiResult.recommended_health]}18`,
                            color:HEALTH_COLOR[aiResult.recommended_health] }}>
                            {HEALTH_LABEL[aiResult.recommended_health]}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.7, margin:0 }}>
                        {aiResult.summary}
                      </p>
                    </div>

                    {/* Suggestions */}
                    {aiResult.suggestions?.length > 0 && (
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--text)",
                          textTransform:"uppercase", letterSpacing:".05em", marginBottom:10 }}>
                          💡 Suggested Actions ({aiResult.suggestions.length})
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          {aiResult.suggestions.map((s: any, i: number) => (
                            <div key={i} style={{ background:"#fff", border:"1px solid var(--border)",
                              borderRadius:"var(--radius)", padding:"10px 14px",
                              borderLeft:`3px solid ${
                                s.type==="risk"?"var(--red)":
                                s.type==="task"?"var(--steel)":"var(--amber)"
                              }` }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                                  borderRadius:4, textTransform:"uppercase", letterSpacing:".05em",
                                  background:"var(--surface)", color:"var(--text-3)" }}>
                                  {s.type.replace("_"," ")}
                                </span>
                                {s.priority && (
                                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px",
                                    borderRadius:4, textTransform:"uppercase",
                                    color:s.priority==="CRITICAL"||s.priority==="HIGH"?"var(--red)":"var(--text-3)",
                                    background:s.priority==="CRITICAL"||s.priority==="HIGH"?"#FEF2F2":"var(--surface)" }}>
                                    {s.priority}
                                  </span>
                                )}
                                {s.suggested_due_date && (
                                  <span style={{ fontSize:11, color:"var(--text-3)", marginLeft:"auto" }}>
                                    Due: {s.suggested_due_date}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:3 }}>
                                {s.title}
                              </div>
                              <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>
                                {s.description}
                              </div>
                              {s.suggested_assignee && (
                                <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>
                                  👤 {s.suggested_assignee}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key decisions + action items */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {aiResult.key_decisions?.length > 0 && (
                        <div style={{ background:"#EFF6FF", borderRadius:"var(--radius)", padding:14 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"var(--steel)",
                            marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>
                            ⚡ Key Decisions
                          </div>
                          {aiResult.key_decisions.map((d: string, i: number) => (
                            <div key={i} style={{ fontSize:12, color:"var(--text-2)",
                              lineHeight:1.6, marginBottom:4 }}>
                              • {d}
                            </div>
                          ))}
                        </div>
                      )}
                      {aiResult.action_items?.length > 0 && (
                        <div style={{ background:"#ECFDF5", borderRadius:"var(--radius)", padding:14 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"var(--green)",
                            marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>
                            ✓ Action Items
                          </div>
                          {aiResult.action_items.map((a: string, i: number) => (
                            <div key={i} style={{ fontSize:12, color:"var(--text-2)",
                              lineHeight:1.6, marginBottom:4 }}>
                              • {a}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {aiResult.risks_identified?.length > 0 && (
                      <div style={{ background:"#FEF2F2", borderRadius:"var(--radius)", padding:14 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--red)",
                          marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>
                          ⚠ Risks Identified
                        </div>
                        {aiResult.risks_identified.map((r: string, i: number) => (
                          <div key={i} style={{ fontSize:12, color:"#991B1B", lineHeight:1.6, marginBottom:4 }}>
                            • {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: AI Status Report Generator */}
            <div style={{ background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)",
                background:"linear-gradient(135deg,#05966908,#1B6CA808)" }}>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>
                  📊 AI Status Report Generator
                </div>
                <div style={{ fontSize:12, color:"var(--text-3)", marginTop:3 }}>
                  AI reads your project data — tasks completed, risks, budget, milestones — and writes
                  a complete weekly status report. Review and save to Reports tab with one click.
                </div>
              </div>

              <div style={{ padding:18 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:600,
                      color:"var(--text-2)", marginBottom:5, textTransform:"uppercase" }}>
                      Period start
                    </label>
                    <input type="date" style={inp} value={reportPeriodStart}
                      onChange={e => setReportPeriodStart(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:600,
                      color:"var(--text-2)", marginBottom:5, textTransform:"uppercase" }}>
                      Period end
                    </label>
                    <input type="date" style={inp} value={reportPeriodEnd}
                      onChange={e => setReportPeriodEnd(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:600,
                      color:"var(--text-2)", marginBottom:5, textTransform:"uppercase" }}>
                      Current health
                    </label>
                    <select value={reportHealth} onChange={e => setReportHealth(e.target.value)}
                      style={{ ...inp, color:HEALTH_COLOR[reportHealth], fontWeight:600, cursor:"pointer" }}>
                      {Object.entries(HEALTH_LABEL).map(([v,l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:600,
                    color:"var(--text-2)", marginBottom:5, textTransform:"uppercase" }}>
                    Additional context (optional)
                  </label>
                  <textarea rows={3} value={reportNotes} onChange={e => setReportNotes(e.target.value)}
                    placeholder="Any context to include — major decisions made, blockers, upcoming events..."
                    style={{ ...inp, resize:"vertical", lineHeight:1.65 }} />
                </div>

                {reportError && (
                  <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
                    padding:"9px 12px", borderRadius:"var(--radius)", fontSize:12, marginBottom:12 }}>
                    ✗ {reportError}
                  </div>
                )}

                <button onClick={generateReport} disabled={reportGenerating}
                  style={{ padding:"10px 22px", background:"#059669", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                    cursor:reportGenerating ? "wait" : "pointer", fontFamily:"var(--font)" }}>
                  {reportGenerating ? "🤔 Generating…" : "Generate status report →"}
                </button>

                {/* Generated report preview */}
                {reportResult && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      marginBottom:14 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>
                        ✓ Report generated — review and save
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={generateReport} disabled={reportGenerating}
                          style={{ padding:"7px 14px", background:"#fff", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                            fontFamily:"var(--font)", color:"var(--text-2)" }}>
                          Regenerate
                        </button>
                        {!reportSaved ? (
                          <button onClick={saveReport} disabled={savingReport}
                            style={{ padding:"7px 16px", background:"var(--steel)",
                              color:"#fff", border:"none", borderRadius:"var(--radius)", fontSize:12,
                              fontWeight:500, cursor:savingReport ? "wait" : "pointer",
                              fontFamily:"var(--font)" }}>
                            {savingReport ? "Saving…" : "Save to Reports tab"}
                          </button>
                        ) : (
                          <a href={`/projects/${projectId}/reports`}
                            style={{ padding:"7px 16px", background:"var(--green)",
                              color:"#fff", border:"none", borderRadius:"var(--radius)", fontSize:12,
                              fontWeight:500, textDecoration:"none", fontFamily:"var(--font)",
                              display:"inline-flex", alignItems:"center", gap:5 }}>
                            ✓ Saved — View in Reports →
                          </a>
                        )}
                      </div>
                      {saveReportError && (
                        <div style={{ fontSize:12, color:"var(--red)", marginTop:6 }}>
                          ✗ {saveReportError}
                        </div>
                      )}
                    </div>

                    <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:18,
                      display:"flex", flexDirection:"column", gap:14 }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                          textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                          Executive Summary
                        </div>
                        <p style={{ fontSize:13, lineHeight:1.75, color:"var(--text-2)", margin:0,
                          whiteSpace:"pre-line" }}>
                          {reportResult.summary}
                        </p>
                      </div>
                      {reportResult.accomplishments && (
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--green)",
                            textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                            ✓ Accomplishments
                          </div>
                          <p style={{ fontSize:13, lineHeight:1.75, color:"var(--text-2)", margin:0,
                            whiteSpace:"pre-line" }}>
                            {reportResult.accomplishments}
                          </p>
                        </div>
                      )}
                      {reportResult.next_steps && (
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--steel)",
                            textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                            → Next Period
                          </div>
                          <p style={{ fontSize:13, lineHeight:1.75, color:"var(--text-2)", margin:0,
                            whiteSpace:"pre-line" }}>
                            {reportResult.next_steps}
                          </p>
                        </div>
                      )}
                      {reportResult.risks && (
                        <div style={{ background:"#FFFBEB", borderRadius:"var(--radius)",
                          padding:12, border:"1px solid #FDE68A" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#92400E",
                            textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
                            ⚠ Risks
                          </div>
                          <p style={{ fontSize:12, lineHeight:1.65, color:"#78350F", margin:0,
                            whiteSpace:"pre-line" }}>
                            {reportResult.risks}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
