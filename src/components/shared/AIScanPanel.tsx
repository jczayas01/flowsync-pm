"use client"
// src/components/shared/AIScanPanel.tsx
// Self-contained "🤖 Scan documents" button + dropdown review panel.
// Drop it next to any tab's create button:
//   <AIScanPanel projectId=.. workspaceId=.. domain="issues"
//     renderCandidate={(c)=>..} commit={async (chosen)=>failedCount} />
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DocScanPicker } from "@/components/shared/DocScanPicker"

export function AIScanPanel({ projectId, workspaceId, domain, commitLabel, renderCandidate, commit }: {
  projectId: string
  workspaceId: string
  domain: "issues" | "changes" | "decisions" | "requirements" | "lessons" | "benefits"
  commitLabel: string                               // e.g. "to issue log"
  renderCandidate: (c: any) => React.ReactNode      // card body (checkbox handled here)
  commit: (chosen: any[]) => Promise<number>        // returns count of failures
}) {
  const router = useRouter()
  const [open, setOpen]             = useState(false)
  // The dropdown is right-anchored, so a button near the left edge would push
  // 620px of panel off-screen. Measure on open and flip the anchor if needed.
  const btnRef                      = useRef<HTMLButtonElement>(null)
  const [anchorLeft, setAnchorLeft] = useState(false)
  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const w = Math.min(620, window.innerWidth * 0.92)
    setAnchorLeft(r.right - w < 8)
  }, [open])
  const [scanning, setScanning]     = useState(false)
  const [error, setError]           = useState("")
  const [candidates, setCandidates] = useState<any[]|null>(null)
  const [skipped, setSkipped]       = useState<{name:string;reason:string}[]>([])
  const [picked, setPicked]         = useState<Set<number>>(new Set())
  const [committing, setCommitting] = useState(false)

  async function runScan(documentIds: string[]) {
    setScanning(true); setError(""); setCandidates(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-scan?workspaceId=${workspaceId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, documentIds }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setError(d?.error || `Scan failed (${res.status})`); return }
      const c = d?.data?.candidates || []
      setSkipped(d?.data?.skippedDocs || [])
      setCandidates(c)
      setPicked(new Set(c.map((_: any, i: number) => i)))
    } catch { setError("Connection lost — try again") }
    finally { setScanning(false) }
  }

  async function doCommit() {
    if (!candidates || committing) return
    const chosen = candidates.filter((_, i) => picked.has(i))
    if (!chosen.length) return
    setCommitting(true); setError("")
    try {
      const failed = await commit(chosen)
      if (failed) setError(`${failed} item(s) could not be added`)
      setCandidates(null); setOpen(false)
      router.refresh()
    } catch { setError("Connection lost — try again") }
    finally { setCommitting(false) }
  }

  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <button ref={btnRef} onClick={() => { setOpen(o => !o); setCandidates(null); setError("") }}
        title="AI-scan project documents and add findings here"
        style={{ padding:"7px 14px", background:"#fff", color:"var(--text-2)",
          border:"1px solid var(--border)", borderRadius:"var(--radius)", fontSize:12,
          fontWeight:500, cursor:"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap" }}>
        🤖 Scan documents
      </button>

      {open && (
        <div style={{ position:"absolute", ...(anchorLeft ? { left:0 } : { right:0 }), top:"calc(100% + 6px)", zIndex:120,
          width:"min(620px, 92vw)", background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:10, boxShadow:"0 12px 32px rgba(13,27,42,.14)", padding:14 }}>
          {!candidates ? (
            <DocScanPicker projectId={projectId} workspaceId={workspaceId}
              scanning={scanning} onScan={runScan} />
          ) : (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:8 }}>
                {candidates.length
                  ? `Found ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} — review and add:`
                  : "Nothing relevant found in the selected documents."}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:320, overflowY:"auto" }}>
                {candidates.map((c: any, i: number) => (
                  <label key={i} style={{ display:"flex", gap:10, alignItems:"flex-start",
                    padding:"10px 12px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", cursor:"pointer" }}>
                    <input type="checkbox" checked={picked.has(i)} style={{ marginTop:3 }}
                      onChange={() => setPicked(prev => {
                        const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n
                      })} />
                    <div style={{ flex:1, minWidth:0 }}>
                      {renderCandidate(c)}
                      {c.evidence && (
                        <div style={{ fontSize:11, color:"var(--text-3)", fontStyle:"italic", marginTop:3 }}>
                          "{c.evidence}" — {c.sourceDoc}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
                {candidates.length > 0 && (
                <button onClick={doCommit} disabled={committing || picked.size === 0}
                  style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
                    borderRadius:"var(--radius)", fontSize:12, fontWeight:500, fontFamily:"var(--font)",
                    cursor: committing || picked.size === 0 ? "not-allowed" : "pointer",
                    opacity: committing || picked.size === 0 ? 0.6 : 1 }}>
                  {committing ? "Adding…" : `＋ Add ${picked.size} ${commitLabel}`}
                </button>
                )}
                <button onClick={() => setCandidates(null)}
                  style={{ padding:"7px 12px", background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                    fontFamily:"var(--font)", color:"var(--text-2)" }}>
                  ← Pick different documents
                </button>
                <button onClick={() => setOpen(false)}
                  style={{ marginLeft:"auto", padding:"7px 10px", background:"none", border:"none",
                    fontSize:12, cursor:"pointer", fontFamily:"var(--font)", color:"var(--text-3)" }}>
                  Close
                </button>
              </div>
            </div>
          )}
          {skipped.length > 0 && candidates && (
            <div style={{ fontSize:11, color:"#B45309", marginTop:8 }}>
              ⚠ Skipped: {skipped.map(x => `${x.name} (${x.reason})`).join(" · ")}
            </div>
          )}
          {error && <div style={{ fontSize:12, color:"#B91C1C", marginTop:8 }}>✗ {error}</div>}
        </div>
      )}
    </div>
  )
}
