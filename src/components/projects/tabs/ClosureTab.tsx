"use client"
// src/components/projects/tabs/ClosureTab.tsx
// PM Best Practices — Project Closure Checklist

import { useState } from "react"
import { useRouter } from "next/navigation"

const CHECKLIST = [
  { section:"Deliverables", items:[
    { key:"deliverablesAccepted",  label:"All deliverables formally accepted by client/sponsor" },
    { key:"acceptanceDocSigned",   label:"Acceptance documentation signed and filed" },
  ]},
  { section:"Knowledge Transfer", items:[
    { key:"knowledgeTransferred",  label:"Knowledge transferred to operations/support team" },
    { key:"documentationComplete", label:"All project documentation completed and archived" },
  ]},
  { section:"Financial", items:[
    { key:"finalBudgetReported",   label:"Final budget report completed and submitted" },
    { key:"contractsClosed",       label:"All vendor contracts formally closed" },
  ]},
  { section:"Team", items:[
    { key:"teamReleased",          label:"Team members formally released from project" },
    { key:"performanceReviewed",   label:"Team performance reviews completed" },
  ]},
  { section:"Lessons Learned", items:[
    { key:"lessonsDocumented",     label:"Lessons learned documented in the Lessons tab" },
    { key:"lessonsShared",         label:"Lessons shared with the wider organization/PMO" },
  ]},
  { section:"Benefits", items:[
    { key:"benefitsHandedOver",    label:"Benefits realization plan handed over to business owner" },
  ]},
  { section:"Final Report", items:[
    { key:"finalReportComplete",   label:"Final project report completed and distributed" },
  ]},
]

function calcProgress(closure: any) {
  const allKeys = CHECKLIST.flatMap(s => s.items.map(i => i.key))
  if (!closure) return 0
  const done = allKeys.filter(k => closure[k]).length
  return Math.round((done / allKeys.length) * 100)
}

export function ClosureTab({ projectId, workspaceId, closure, project }: {
  projectId:string; workspaceId:string; closure:any; project:any
}) {
  const router = useRouter()
  const [local, setLocal] = useState<Record<string,boolean>>(closure || {})
  const [saving, setSaving] = useState(false)
  const [closureNotes, setClosureNotes] = useState(closure?.closureNotes||"")
  const progress = calcProgress(local)
  const allDone = progress === 100

  async function toggle(key: string) {
    const newVal = !local[key]
    const updated = { ...local, [key]: newVal }
    setLocal(updated)
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/closure`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ [key]: newVal }),
      })
      router.refresh()
    } finally { setSaving(false) }
  }

  async function saveNotes() {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/closure`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ closureNotes }),
      })
      router.refresh()
    } finally { setSaving(false) }
  }

  async function markClosed() {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/closure`, {
        method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({ closureDate: new Date().toISOString(), closureNotes }),
      })
      await fetch(`/api/projects/${projectId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ status:"COMPLETED" }),
      })
      router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflowY:"auto" }}>
      {/* Header */}
      <div style={{ background: allDone?"var(--green)":"var(--steel)", padding:"20px 24px", color:"#fff", flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>
          {allDone ? "✓ Ready to close" : "Project Closure Checklist"}
        </div>
        <div style={{ fontSize:13, opacity:.8, marginBottom:12 }}>
          PM Standard closing process · {project?.name} ({project?.code})
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1, height:8, background:"rgba(255,255,255,.3)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress}%`, background:"#fff", borderRadius:4, transition:"width .4s" }} />
          </div>
          <span style={{ fontSize:14, fontWeight:700 }}>{progress}%</span>
        </div>
      </div>

      <div style={{ flex:1, padding:20, display:"flex", flexDirection:"column", gap:16 }}>
        {CHECKLIST.map(section => (
          <div key={section.section} style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", overflow:"hidden" }}>
            <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)",
              background:"var(--surface)", fontSize:12, fontWeight:700, color:"var(--text-2)",
              textTransform:"uppercase", letterSpacing:".05em" }}>
              {section.section}
            </div>
            {section.items.map(item => {
              const checked = !!local[item.key]
              return (
                <div key={item.key} onClick={()=>toggle(item.key)}
                  style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px",
                    borderBottom:"1px solid var(--surface-1,#F1F5F9)", cursor:"pointer",
                    background:checked?"#F0FDF4":"#fff", transition:"background .15s" }}>
                  <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                    border:`2px solid ${checked?"var(--green)":"var(--border)"}`,
                    background:checked?"var(--green)":"#fff",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {checked && <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:13, color:checked?"#065F46":"var(--text-2)",
                    textDecoration:checked?"line-through":"none", opacity:checked?.8:1 }}>
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>
        ))}

        {/* Closure notes */}
        <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:16 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
            Closure Notes
          </label>
          <textarea rows={4} value={closureNotes} onChange={e=>setClosureNotes(e.target.value)}
            placeholder="Final notes on project closure — what was achieved, key outcomes, handover details..."
            style={{ width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
              lineHeight:1.65, resize:"vertical", outline:"none", color:"var(--text)", marginBottom:10 }} />
          <button onClick={saveNotes} disabled={saving}
            style={{ padding:"7px 14px", background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)",
              color:"var(--text-2)" }}>
            Save notes
          </button>
        </div>

        {/* Close project button */}
        {allDone && !closure?.closureDate && (
          <div style={{ background:"#ECFDF5", border:"2px solid var(--green)",
            borderRadius:"var(--radius)", padding:20, textAlign:"center" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#065F46", marginBottom:6 }}>
              All checklist items complete
            </div>
            <div style={{ fontSize:13, color:"#047857", marginBottom:16 }}>
              The project is ready to be formally closed. This will mark the project status as Completed.
            </div>
            <button onClick={markClosed} disabled={saving}
              style={{ padding:"10px 24px", background:"var(--green)", color:"#fff", border:"none",
                borderRadius:"var(--radius)", fontSize:14, fontWeight:700, cursor:"pointer",
                fontFamily:"var(--font)" }}>
              {saving?"Closing…":"✓ Formally Close Project"}
            </button>
          </div>
        )}
        {closure?.closureDate && (
          <div style={{ background:"#ECFDF5", border:"1px solid var(--green)",
            borderRadius:"var(--radius)", padding:14, textAlign:"center",
            fontSize:13, color:"#065F46", fontWeight:600 }}>
            ✓ Project formally closed on {new Date(closure.closureDate).toLocaleDateString("en-US", {month:"long",day:"numeric",year:"numeric", timeZone:"UTC" })}
          </div>
        )}
      </div>
    </div>
  )
}
