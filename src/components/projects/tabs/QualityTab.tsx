"use client"
// src/components/projects/tabs/QualityTab.tsx
// Quality Management — Quality Plan + Quality Checklist per deliverable

import { FieldCard, EditToggle } from "@/components/shared/FieldCard"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { DateField } from "@/components/shared/DatePicker"
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"

// Labels match the Governance → Quality Plan section (same underlying record).
const QMP_FIELDS = [
  { key:"qualityStandards",  label:"Standards",       icon:"📏" },
  { key:"qualityObjectives", label:"Objectives",      icon:"🎯" },
  { key:"roles",             label:"Roles",           icon:"👥" },
  { key:"processes",         label:"QA Processes",    icon:"⚙️" },
  { key:"tools",             label:"QC Tools",        icon:"🛠" },
  { key:"metrics",           label:"Metrics",         icon:"📊" },
  { key:"audits",            label:"Audit Schedule",  icon:"🔍" },
  { key:"nonConformance",    label:"Non-Conformance", icon:"⚠️" },
]

const CHECKLIST_STATUS = {
  PENDING:  { label:"Pending",  color:"#64748B", bg:"#F8FAFC" },
  PASS:     { label:"Pass ✓",   color:"#059669", bg:"#ECFDF5" },
  FAIL:     { label:"Fail ✗",   color:"#DC2626", bg:"#FEF2F2" },
  NA:       { label:"N/A",      color:"#94A3B8", bg:"#F1F5F9" },
}

const inp: React.CSSProperties = {
  width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
  borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
  color:"var(--text)", outline:"none",
}
const lbl: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
  textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
}

export function QualityTab({ projectId, workspaceId, qmp, checklists, tasks }: {
  projectId:string; workspaceId:string; qmp:any; checklists:any[]; tasks:any[]
}) {
  const { can } = usePermissions()
  const q = useTranslations("qualityTab")
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"plan"|"checklist">("plan")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showAddChecklist, setShowAddChecklist] = useState(false)

  // QMP form
  const [editing, setEditing] = useState(false)
  const [qmpForm, setQmpForm] = useState({
    qualityStandards:  qmp?.qualityStandards  ||"",
    qualityObjectives: qmp?.qualityObjectives ||"",
    roles:             qmp?.roles             ||"",
    processes:         qmp?.processes         ||"",
    tools:             qmp?.tools             ||"",
    metrics:           qmp?.metrics           ||"",
    audits:            qmp?.audits            ||"",
    nonConformance:    qmp?.nonConformance     ||"",
  })

  // Governance ingest writes this same record — re-seed when fresh data arrives,
  // otherwise the tab shows stale values until it is remounted.
  useEffect(() => {
    setQmpForm({
      qualityStandards:  qmp?.qualityStandards||"",
      qualityObjectives: qmp?.qualityObjectives||"",
      roles:             qmp?.roles||"",
      processes:         qmp?.processes||"",
      tools:             qmp?.tools||"",
      metrics:           qmp?.metrics||"",
      audits:            qmp?.audits||"",
      nonConformance:    qmp?.nonConformance||"",
    })
  }, [qmp])

  // Checklist form
  const [checklistForm, setChecklistForm] = useState({
    deliverable:"", criteria:"", inspector:"", scheduledDate:"",
  })

  async function saveQmp() {
    setSaving(true); setError(""); setSuccess("")
    try {
      const res = await fetch(`/api/projects/${projectId}/quality-plan`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body:JSON.stringify(qmpForm),
      })
      if (!res.ok) { setError("Save failed"); return }
      setSuccess("Quality Plan saved ✓")
      setTimeout(()=>setSuccess(""),3000)
      router.refresh()
    } finally { setSaving(false) }
  }

  async function addChecklist() {
    if (!checklistForm.deliverable.trim()) { setError(q("Deliverable name required")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/quality-checklist`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body:JSON.stringify(checklistForm),
      })
      if (!res.ok) { setError(q("Failed to add checklist")); return }
      setShowAddChecklist(false)
      setChecklistForm({ deliverable:"", criteria:"", inspector:"", scheduledDate:"" })
      router.refresh()
    } finally { setSaving(false) }
  }

  async function updateChecklistStatus(id:string, status:string) {
    await fetch(`/api/projects/${projectId}/quality-checklist/${id}`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
      body:JSON.stringify({ status }),
    })
    router.refresh()
  }

  const passCount = checklists.filter(c=>c.status==="PASS").length
  const totalCount = checklists.length

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:"var(--steel)", padding:"12px 20px", color:"#fff", flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:700 }}>✅ {q("Quality Management")}</div>
        <div style={{ fontSize:11, opacity:.6, marginTop:2 }}>
          {q("qmSubtitle")}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)",
        background:"#fff", flexShrink:0 }}>
        {[
          { id:"plan",      label:q("Quality Plan") },
          { id:"checklist", label:q("checklistTabLabel",{p:passCount,t:totalCount}) },
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id as any)}
            style={{ padding:"10px 18px", fontSize:12, fontWeight:500, cursor:"pointer",
              background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===t.id?"var(--steel)":"transparent"}`,
              color:activeTab===t.id?"var(--steel)":"var(--text-3)",
              fontFamily:"var(--font)", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {(error||success) && (
          <div style={{ padding:"9px 14px", borderRadius:"var(--radius)", marginBottom:14,
            background:success?"#ECFDF5":"#FEF2F2", color:success?"var(--green)":"var(--red)",
            fontSize:12, border:`1px solid ${success?"#BBF7D0":"#FECACA"}` }}>
            {error||success}
          </div>
        )}

        {/* QUALITY PLAN */}
        {activeTab==="plan" && (
          <div style={{ background:"#fff", borderRadius:"var(--radius)",
            border:"1px solid var(--border)", padding:24 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)",
              marginBottom:4 }}>{q("Quality Management Plan")}</div>
            <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:18 }}>
              {q("qmpRef")}
            </div>
            <EditToggle editing={editing} onClick={()=>setEditing(e=>!e)} />

            {!editing ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {QMP_FIELDS.map(({key,label,icon})=>(
                  <FieldCard key={key} label={q(label as any)} icon={icon} value={(qmpForm as any)[key]} />
                ))}
              </div>
            ) : (
              <>
                {QMP_FIELDS.map(({key,label})=>(
                  <div key={key} style={{ marginBottom:14 }}>
                    <label style={lbl}>{q(label as any)}</label>
                    <textarea rows={3} style={{...inp,resize:"vertical",lineHeight:1.6}}
                      value={(qmpForm as any)[key]}
                      onChange={e=>setQmpForm(f=>({...f,[key]:e.target.value}))}
                      placeholder={`${q(label as any)}...`} />
                  </div>
                ))}
                <button onClick={async()=>{ await saveQmp(); setEditing(false) }} disabled={saving}
                  style={{ padding:"10px 22px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                    cursor:"pointer", fontFamily:"var(--font)" }}>
                  {saving?q("Saving…"):q("💾 Save Quality Plan")}
                </button>
              </>
            )}
          </div>
        )}

        {/* CHECKLIST */}
        {activeTab==="checklist" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:13, color:"var(--text-3)" }}>
                {totalCount === 0 ? q("No checklist items yet") : q("itemsPassed",{p:passCount,t:totalCount})}
              </div>
              {can("projects:edit") && (
                <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain="quality"
                  commitLabel={q("to the checklist")}
                  renderCandidate={(c:any)=>(
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.deliverable}</div>
                      {Array.isArray(c.items) && c.items.length > 0 && (
                        <ul style={{ margin:"4px 0 0 16px", padding:0, fontSize:11.5, color:"var(--text-3)", lineHeight:1.6 }}>
                          {c.items.slice(0,6).map((it:string,i:number)=><li key={i}>{it}</li>)}
                        </ul>
                      )}
                      {c.evidence && (
                        <div style={{ fontSize:11, color:"var(--text-4)", fontStyle:"italic", marginTop:4 }}>
                          "{c.evidence}" — {c.sourceDoc}
                        </div>
                      )}
                    </div>
                  )}
                  commit={async (chosen:any[]) => {
                    const rs = await Promise.all(chosen.map(c => fetch(`/api/projects/${projectId}/quality-checklist`, {
                      method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
                      body: JSON.stringify({
                        deliverable: String(c.deliverable || "").slice(0,300),
                        criteria: Array.isArray(c.items) ? c.items.join("\n") : (c.notes || null),
                      }),
                    }).catch(() => null)))
                    return rs.filter(r => !r?.ok).length
                  }} />
              )}
              {can("projects:edit") && (<button onClick={()=>setShowAddChecklist(s=>!s)}
                style={{ padding:"7px 14px", background:showAddChecklist?"#fff":"var(--steel)",
                  color:showAddChecklist?"var(--text-2)":"#fff",
                  border:showAddChecklist?"1px solid var(--border)":"none",
                  borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                  fontFamily:"var(--font)" }}>
                {showAddChecklist?q("Cancel"):q("+ Add checklist item")}
              </button>)}
            </div>

            {showAddChecklist && (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", padding:16, marginBottom:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:10 }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <label style={lbl}>{q("Deliverable / Item *")}</label>
                    <input style={inp} value={checklistForm.deliverable}
                      onChange={e=>setChecklistForm(f=>({...f,deliverable:e.target.value}))}
                      placeholder={q("phDeliverable")} />
                  </div>
                  <div style={{ gridColumn:"1/-1" }}>
                    <label style={lbl}>{q("Acceptance Criteria")}</label>
                    <textarea rows={2} style={{...inp,resize:"vertical"}}
                      value={checklistForm.criteria}
                      onChange={e=>setChecklistForm(f=>({...f,criteria:e.target.value}))}
                      placeholder={q("phCriteria")} />
                  </div>
                  <div>
                    <label style={lbl}>{q("Inspector")}</label>
                    <input style={inp} value={checklistForm.inspector}
                      onChange={e=>setChecklistForm(f=>({...f,inspector:e.target.value}))}
                      placeholder={q("phInspector")} />
                  </div>
                  <div>
                    <label style={lbl}>{q("Scheduled date")}</label>
                    <DateField  style={inp} value={checklistForm.scheduledDate}
                      onChange={e=>setChecklistForm(f=>({...f,scheduledDate:e.target.value}))} />
                  </div>
                </div>
                <button onClick={addChecklist} disabled={saving||!checklistForm.deliverable.trim()}
                  style={{ padding:"8px 18px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:12,
                    cursor:"pointer", fontFamily:"var(--font)",
                    opacity:!checklistForm.deliverable.trim()?0.5:1 }}>
                  {saving?q("Saving…"):q("Add item")}
                </button>
              </div>
            )}

            {checklists.length === 0 && !showAddChecklist ? (
              <div style={{ textAlign:"center", padding:"50px 20px" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
                  {q("noItemsTitle")}
                </div>
                <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:400,
                  margin:"0 auto 16px", lineHeight:1.6 }}>
                  {q("noItemsBody")}
                </div>
                <button onClick={()=>setShowAddChecklist(true)}
                  style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                    border:"none", borderRadius:"var(--radius)", fontSize:13,
                    cursor:"pointer", fontFamily:"var(--font)" }}>
                  {q("+ Add first item")}
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {checklists.map(item=>{
                  const sc = (CHECKLIST_STATUS as any)[item.status||"PENDING"] || CHECKLIST_STATUS.PENDING
                  return (
                    <div key={item.id} style={{ background:"#fff", border:"1px solid var(--border)",
                      borderRadius:"var(--radius)", padding:"12px 16px",
                      display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                          marginBottom:2 }}>{item.deliverable}</div>
                        {item.criteria && (
                          <div style={{ fontSize:11, color:"var(--text-3)" }}>{item.criteria}</div>
                        )}
                        {item.inspector && (
                          <div style={{ fontSize:10, color:"var(--text-4)", marginTop:3 }}>
                            {q("Inspector")}: {item.inspector}
                          </div>
                        )}
                      </div>
                      <select
                        value={item.status||"PENDING"}
                        onChange={e=>updateChecklistStatus(item.id, e.target.value)}
                        style={{ padding:"5px 10px", fontSize:11, fontWeight:700,
                          borderRadius:"var(--radius)", cursor:"pointer",
                          border:`1px solid ${sc.color}30`,
                          background:sc.bg, color:sc.color,
                          fontFamily:"var(--font)", appearance:"none" as const }}>
                        {Object.entries(CHECKLIST_STATUS).map(([k,v])=>(
                          <option key={k} value={k}>{q(v.label as any)}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
