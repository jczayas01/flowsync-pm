"use client"
// src/components/projects/NewProjectForm.tsx
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar } from "@/components/ui"

const METHODOLOGIES = [
  { id:"WATERFALL", label:"Waterfall", desc:"Sequential phases with gate approvals", icon:"📊", color:"#1B6CA8" },
  { id:"AGILE",     label:"Agile",     desc:"Iterative delivery with backlogs",      icon:"🔄", color:"#059669" },
  { id:"SCRUM",     label:"Scrum",     desc:"Sprint-based with ceremonies",          icon:"🏃", color:"#7C3AED" },
  { id:"HYBRID",    label:"Hybrid",    desc:"Phased governance with iterative delivery", icon:"🔀", color:"#0891B2" },
]

const CURRENCIES = ["USD","EUR","GBP","MXN"]
const TIMEZONES  = ["America/Puerto_Rico","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","UTC"]

export function NewProjectForm({ workspaceId, members }:{
  workspaceId:string; members:any[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name:           "",
    description:    "",
    methodology:    "WATERFALL",
    priority:       "MEDIUM",
    isConfidential: false,
    economicImpact: "",
    startDate:      new Date().toISOString().split("T")[0],
    endDate:        "",
    budgetTotal:    "",
    currency:       "USD",
    timezone:       "America/New_York",
  })
  const [selectedMembers, setSelectedMembers] = useState<Record<string,{role:string; projectRole:string}>>({})
  const PHASE_LIBRARY = ["Initiation","Planning","Requirements","Design","Development","Execution","Integration","Testing","Deployment","Monitoring & Control","Training","Closure"]
  const [selectedPhases, setSelectedPhases] = useState<string[]>(
    ["Initiation","Planning","Design","Execution","Monitoring & Control","Closure"]
  )
  function togglePhase(name:string) {
    setSelectedPhases(s => s.includes(name) ? s.filter(x=>x!==name) : [...s, name])
  }
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  function toggleMember(userId:string) {
    setSelectedMembers(s => {
      const next = { ...s }
      if (next[userId]) delete next[userId]
      else next[userId] = { role:"MEMBER", projectRole:"TEAM_MEMBER" }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError("Project name is required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/projects", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name:           form.name,
          description:    form.description || undefined,
          methodology:    form.methodology,
          priority:       form.priority,
          isConfidential: form.isConfidential,
          economicImpact: form.economicImpact || undefined,
          startDate:      form.startDate ? new Date(form.startDate).toISOString() : undefined,
          endDate:        form.endDate   ? new Date(form.endDate).toISOString()   : undefined,
          budgetTotal:    form.budgetTotal ? Number(form.budgetTotal) : 0,
          currency:       form.currency,
          timezone:       form.timezone,
          phaseNames:     selectedPhases,
          teamMembers: Object.entries(selectedMembers).map(([userId,v]) => ({
            userId, role: v.role, projectRole: v.projectRole,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Failed to create project")
        setSaving(false)
        return
      }
      const { data } = await res.json()
      router.push(`/projects/${data.id}`)
    } catch {
      setError("Network error — please try again")
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"10px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:14, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none", background:"#fff",
  }
  const sel: React.CSSProperties = {
    ...inp, appearance:"none" as const, cursor:"pointer",
    background:"#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E\") right 12px center no-repeat",
  }
  const label: React.CSSProperties = {
    display:"block", fontSize:12, fontWeight:500, color:"var(--text-2)", marginBottom:6,
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"14px 20px", flexShrink:0 }}>
        <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:5 }}>
          <Link href="/projects" style={{ color:"var(--text-3)", textDecoration:"none" }}>Projects</Link>
          {" › "}New project
        </div>
        <h1 style={{ fontSize:17, fontWeight:600, color:"var(--text)" }}>Create new project</h1>
      </div>

      {/* Form */}
      <div style={{ flex:1, overflowY:"auto", padding:24 }}>
        <form onSubmit={handleSubmit} style={{ maxWidth:680, margin:"0 auto" }}>
          {error && (
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"var(--red)",
              padding:"10px 14px", borderRadius:"var(--radius)", fontSize:13, marginBottom:16 }}>
              ✗ {error}
            </div>
          )}

          {/* Basic info */}
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:14 }}>
            <div style={{ marginBottom:14 }}>
              <label style={label}>Project name *</label>
              <input autoFocus value={form.name}
                onChange={e => setForm(f => ({ ...f, name:e.target.value }))}
                placeholder="e.g. CRM Migration, Office Expansion, Product Launch" style={inp} />
            </div>
            <div>
              <label style={label}>Description</label>
              <textarea value={form.description} rows={3}
                onChange={e => setForm(f => ({ ...f, description:e.target.value }))}
                placeholder="What is this project about?"
                style={{ ...inp, resize:"vertical", lineHeight:1.5 }} />
            </div>
          </div>

          {/* Methodology */}
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:14 }}>
            <label style={{ ...label, marginBottom:10 }}>Methodology *</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
              {METHODOLOGIES.map(m => (
                <div key={m.id} onClick={() => setForm(f => ({ ...f, methodology:m.id }))}
                  style={{ border:`2px solid ${form.methodology===m.id ? m.color : "var(--border)"}`,
                    borderRadius:"var(--radius)", padding:14, cursor:"pointer",
                    background: form.methodology===m.id ? `${m.color}08` : "#fff",
                    transition:"all .15s" }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{m.icon}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:3 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-3)", lineHeight:1.4 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase Builder — pick which phases this project will use */}
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:14 }}>
            <label style={label}>Project phases</label>
            <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:10 }}>
              Choose which phases this project will use. Tasks can be organized under any selected phase.
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {PHASE_LIBRARY.map(name => {
                const on = selectedPhases.includes(name)
                return (
                  <button key={name} type="button" onClick={() => togglePhase(name)}
                    style={{ padding:"6px 12px", borderRadius:"var(--radius)", fontSize:12,
                      cursor:"pointer", fontFamily:"var(--font)",
                      border:`1px solid ${on ? "var(--steel)" : "var(--border)"}`,
                      background: on ? "var(--steel)" : "#fff",
                      color: on ? "#fff" : "var(--text-2)", fontWeight: on ? 600 : 400 }}>
                    {on ? "✓ " : ""}{name}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize:11, color:"var(--text-4)", marginTop:10 }}>
              {selectedPhases.length} phase{selectedPhases.length!==1?"s":""} selected
              {selectedPhases.length===0 && " — project will start with no phases"}
            </div>
          </div>

          {/* Dates + budget */}
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <div>
                <label style={label}>Start date</label>
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={label}>End date</label>
                <input type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate:e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
              <div>
                <label style={label}>Total budget</label>
                <input type="number" min={0} value={form.budgetTotal}
                  onChange={e => setForm(f => ({ ...f, budgetTotal:e.target.value }))}
                  placeholder="0" style={inp} />
              </div>
              <div>
                <label style={label}>Currency</label>
                <select style={sel} value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency:e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Timezone</label>
                <select style={sel} value={form.timezone}
                  onChange={e => setForm(f => ({ ...f, timezone:e.target.value }))}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            {/* Priority + Confidential */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }}>
              <div>
                <label style={label}>Project Priority</label>
                <select style={{ ...sel, fontWeight:600,
                  color: form.priority==="CRITICAL"?"#DC2626":
                         form.priority==="HIGH"?"#F59E0B":
                         form.priority==="MEDIUM"?"#1B6CA8":"#64748B" }}
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority:e.target.value }))}>
                  <option value="CRITICAL">🔴 Critical</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="MEDIUM">🔵 Medium</option>
                  <option value="LOW">⚪ Low</option>
                </select>
              </div>
              <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                <label style={{ ...label, marginBottom:12 }}>Confidential Project</label>
                <div onClick={() => setForm(f => ({ ...f, isConfidential:!f.isConfidential }))}
                  style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                  <div style={{ width:40, height:22, borderRadius:11, position:"relative",
                    background: form.isConfidential ? "var(--steel)" : "#CBD5E1",
                    transition:"background .2s" }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff",
                      position:"absolute", top:2, transition:"left .2s",
                      left: form.isConfidential ? 20 : 2,
                      boxShadow:"0 1px 3px rgba(0,0,0,.2)" }} />
                  </div>
                  <span style={{ fontSize:12, color:"var(--text-2)" }}>
                    {form.isConfidential
                      ? "🔒 Confidential — visible to team members only"
                      : "Visible to all workspace members"}
                  </span>
                </div>
              </div>
            </div>

            {/* Economic Impact */}
            <div style={{ marginTop:14 }}>
              <label style={label}>Economic Impact / ROI (optional)</label>
              <textarea rows={2}
                value={form.economicImpact}
                onChange={e => setForm(f => ({ ...f, economicImpact:e.target.value }))}
                placeholder="e.g. Expected to save $200K/year in operational costs, ROI within 18 months..."
                style={{ ...inp, resize:"vertical", lineHeight:1.6 }} />
            </div>
          </div>

          {/* Team members */}
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:20 }}>
            <label style={{ ...label, marginBottom:10 }}>
              Add team members ({Object.keys(selectedMembers).length} selected)
            </label>
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:280, overflowY:"auto" }}>
              {members.map(m => {
                const checked = !!selectedMembers[m.userId]
                return (
                  <div key={m.userId} onClick={() => toggleMember(m.userId)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                      borderRadius:"var(--radius)", cursor:"pointer",
                      background: checked ? "var(--steel-pale,#EFF6FF)" : "transparent",
                      border:`1px solid ${checked ? "var(--steel)" : "transparent"}` }}>
                    <input type="checkbox" checked={checked} readOnly
                      style={{ width:16, height:16, accentColor:"var(--steel)" }} />
                    <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={28} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{m.user.name}</div>
                      <div style={{ fontSize:11, color:"var(--text-3)" }}>{m.user.email}</div>
                    </div>
                    {checked && (
                      <div style={{ display:"flex", gap:6 }}>
                        <select value={selectedMembers[m.userId].projectRole}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSelectedMembers(s => ({ ...s,
                            [m.userId]: { ...s[m.userId], projectRole:e.target.value } }))}
                          title="PM Standard project role"
                          style={{ ...sel, width:160, padding:"4px 22px 4px 8px", fontSize:11 }}>
                          <option value="EXECUTIVE_SPONSOR">Executive Sponsor</option>
                          <option value="SPONSOR">Project Sponsor</option>
                          <option value="STEERING_COMMITTEE">Steering Committee</option>
                          <option value="PMO_DIRECTOR">PMO Director</option>
                          <option value="PMO">PMO Analyst</option>
                          <option value="PM">Project Manager</option>
                          <option value="PRODUCT_OWNER">Product Owner</option>
                          <option value="BUSINESS_ANALYST">Business Analyst</option>
                          <option value="TECH_LEAD">Technical Lead</option>
                          <option value="SCRUM_MASTER">Scrum Master</option>
                          <option value="TEAM_MEMBER">Team Member</option>
                          <option value="STAKEHOLDER">Stakeholder</option>
                          <option value="EXTERNAL_RESOURCE">External Resource</option>
                          <option value="CLIENT">Client</option>
                          <option value="AUDITOR">Auditor</option>
                        </select>
                        <select value={selectedMembers[m.userId].role}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSelectedMembers(s => ({ ...s,
                            [m.userId]: { ...s[m.userId], role:e.target.value } }))}
                          title="Access level"
                          style={{ ...sel, width:100, padding:"4px 22px 4px 8px", fontSize:11 }}>
                          <option value="PM">PM access</option>
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                          <option value="CLIENT">Client</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Link href="/projects"
              style={{ padding:"10px 20px", border:"1px solid var(--border)",
                borderRadius:"var(--radius)", color:"var(--text-2)", textDecoration:"none",
                fontSize:14, background:"#fff" }}>
              Cancel
            </Link>
            <button type="submit" disabled={saving || !form.name.trim()}
              style={{ padding:"10px 24px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:14, fontWeight:500,
                cursor:saving?"wait":"pointer", opacity:!form.name.trim()?0.5:1 }}>
              {saving ? "Creating…" : "Create project →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
