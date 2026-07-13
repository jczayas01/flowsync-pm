"use client"
// src/components/projects/tabs/ProjectTeamTab.tsx
// Full PM Standard role taxonomy — role picker with descriptions,
// RACI display, methodology relevance, and access logic summary

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui"
import { PROJECT_ROLES_ORDERED, ROLE_LAYERS, getRoleDef, RACI_BY_ROLE, getRolesForMethodology, type ProjectRoleKey } from "@/lib/roles"

const ACCESS_ROLES = [
  { value:"PM",     label:"PM — full edit access" },
  { value:"MEMBER", label:"Member — edit own tasks" },
  { value:"VIEWER", label:"Viewer — read only" },
  { value:"CLIENT", label:"Client — limited view" },
]

export function ProjectTeamTab({ projectId, members, availableToAdd, methodology }: {
  projectId: string; members: any[]; availableToAdd: any[]; methodology?: string
}) {
  const router = useRouter()
  const [savingId, setSavingId]     = useState<string|null>(null)
  const [addOpen, setAddOpen]       = useState(false)
  const [addSearch, setAddSearch]   = useState("")
  const [addingUserId, setAddingUserId] = useState<string|null>(null)
  const [hoverRole, setHoverRole]   = useState<ProjectRoleKey|null>(null)
  const [showRoleGuide, setShowRoleGuide] = useState(false)

  const meth = (methodology || "WATERFALL") as "WATERFALL"|"AGILE"|"SCRUM"
  const availableRoles = getRolesForMethodology(meth)

  async function updateMember(memberId: string, patch: Record<string,any>) {
    setSavingId(memberId)
    try {
      await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(patch),
      })
      router.refresh()
    } finally { setSavingId(null) }
  }

  async function addMember(userId: string) {
    setAddingUserId(userId)
    try {
      await fetch(`/api/projects/${projectId}/members`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ userId, role:"MEMBER", projectRole:"TEAM_MEMBER", allocation:100 }),
      })
      setAddOpen(false); setAddSearch("")
      router.refresh()
    } finally { setAddingUserId(null) }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member from the project?")) return
    setSavingId(memberId)
    try {
      await fetch(`/api/projects/${projectId}/members/${memberId}`, { method:"DELETE" })
      router.refresh()
    } finally { setSavingId(null) }
  }

  const filteredAvailable = availableToAdd.filter(u =>
    !members.find(m => m.userId === u.id) &&
    (u.name?.toLowerCase().includes(addSearch.toLowerCase()) ||
     u.email?.toLowerCase().includes(addSearch.toLowerCase()))
  )

  // Group by layer
  const grouped = ROLE_LAYERS.map(layer => ({
    ...layer,
    members: members.filter(m => {
      const def = getRoleDef(m.projectRole)
      return def.layer === layer.key
    }),
  })).filter(g => g.members.length > 0)

  const ungrouped = members.filter(m => !m.projectRole)

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 11px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ fontSize:12, color:"var(--text-3)" }}>
          {members.length} member{members.length!==1?"s":""} · {meth} project
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={()=>setShowRoleGuide(g=>!g)}
            style={{ padding:"6px 12px", background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
              fontFamily:"var(--font)", color:"var(--text-2)" }}>
            {showRoleGuide ? "Hide role guide" : "📖 PM Standard role guide"}
          </button>
          <button onClick={()=>setAddOpen(a=>!a)}
            style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff", border:"none",
              borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            {addOpen ? "Cancel" : "+ Add member"}
          </button>
        </div>
      </div>

      {/* PM Standard Role Guide */}
      {showRoleGuide && (
        <div style={{ background:"#F8FAFC", borderBottom:"1px solid var(--border)",
          padding:16, maxHeight:380, overflowY:"auto" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:12 }}>
            PM Standard Project Role Taxonomy — {meth} methodology
          </div>
          {ROLE_LAYERS.map(layer => {
            const layerRoles = availableRoles.filter(r => r.layer === layer.key)
            if (!layerRoles.length) return null
            return (
              <div key={layer.key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:".06em", color:layer.color, marginBottom:6 }}>
                  {layer.label}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:8 }}>
                  {layerRoles.map(role => (
                    <div key={role.value}
                      style={{ background:"#fff", border:`1px solid ${role.bg}`,
                        borderRadius:"var(--radius)", padding:"10px 12px",
                        borderLeft:`3px solid ${role.color}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:role.color }}>{role.label}</span>
                        <span style={{ fontSize:9, padding:"1px 6px", borderRadius:8,
                          background:role.bg, color:role.color, fontWeight:700 }}>
                          {RACI_BY_ROLE[role.value]}
                        </span>
                        {role.methodologies[0] !== "ALL" && (
                          <span style={{ fontSize:9, color:"var(--text-4)" }}>
                            {role.methodologies.join("/")} only
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-3)", lineHeight:1.5 }}>
                        {role.description}
                      </div>
                      <div style={{ fontSize:9, color:"var(--text-4)", marginTop:4 }}>
                        {role.standardRef}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add member panel */}
      {addOpen && (
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:14 }}>
          <input style={{...inp, marginBottom:10}} value={addSearch}
            onChange={e=>setAddSearch(e.target.value)}
            placeholder="Search by name or email..." autoFocus />
          {filteredAvailable.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--text-3)", textAlign:"center", padding:"8px 0" }}>
              {addSearch ? "No matching users found" : "All workspace members are already on this project"}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
              {filteredAvailable.map(u => (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 12px", background:"#fff", borderRadius:"var(--radius)",
                  border:"1px solid var(--border)" }}>
                  <Avatar name={u.name} avatarUrl={u.avatarUrl} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{u.name}</div>
                    <div style={{ fontSize:11, color:"var(--text-3)" }}>{u.email}</div>
                  </div>
                  <button onClick={()=>addMember(u.id)} disabled={addingUserId===u.id}
                    style={{ padding:"6px 14px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:12,
                      cursor:"pointer", fontFamily:"var(--font)" }}>
                    {addingUserId===u.id ? "Adding…" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Member list */}
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {members.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>No team members yet</div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:380, margin:"0 auto 20px" }}>
              Add team members and assign their PM governance best practices roles to define who does what on this project.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth:860, margin:"0 auto", display:"flex", flexDirection:"column", gap:14 }}>

            {/* Grouped by layer */}
            {grouped.map(group => (
              <div key={group.key}>
                <div style={{ fontSize:10, fontWeight:700, color:group.color,
                  textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>
                  {group.label}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {group.members.map(m => {
                    const def   = getRoleDef(m.projectRole)
                    const raci  = RACI_BY_ROLE[m.projectRole as ProjectRoleKey] || "I"
                    const isSaving = savingId === m.id
                    return (
                      <div key={m.id}
                        style={{ background:"#fff", border:"1px solid var(--border)",
                          borderRadius:"var(--radius)", padding:"12px 16px",
                          display:"flex", alignItems:"center", gap:14,
                          borderLeft:`3px solid ${def.color}` }}>
                        {/* Avatar */}
                        <Avatar name={m.user?.name} avatarUrl={m.user?.avatarUrl} size={36} />

                        {/* Name + title */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>
                            {m.user?.name}
                          </div>
                          <div style={{ fontSize:11, color:"var(--text-3)" }}>{m.user?.email}</div>
                        </div>

                        {/* Role badge + RACI */}
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ padding:"3px 9px", borderRadius:10, fontSize:10,
                                fontWeight:700, color:def.color, background:def.bg }}>
                                {def.shortLabel}
                              </span>
                              <span title={`RACI: ${raci === "R"?"Responsible":raci === "A"?"Accountable":raci === "C"?"Consulted":"Informed"}`}
                                style={{ width:20, height:20, borderRadius:"50%",
                                  background:def.color, color:"#fff", fontSize:9,
                                  fontWeight:800, display:"flex", alignItems:"center",
                                  justifyContent:"center", cursor:"help" }}>
                                {raci}
                              </span>
                            </div>
                            <div style={{ fontSize:9, color:"var(--text-4)", marginTop:3, textAlign:"right" }}>
                              {def.canApprove ? "✓ Can approve" : "Can edit tasks"}
                              {def.canEdit ? "" : " · Read-only"}
                            </div>
                          </div>
                        </div>

                        {/* Allocation */}
                        <div style={{ textAlign:"center", flexShrink:0 }}>
                          <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>
                            {m.allocation}%
                          </div>
                          <div style={{ fontSize:9, color:"var(--text-4)" }}>allocated</div>
                        </div>

                        {/* Role selector */}
                        <select value={m.projectRole || ""} disabled={isSaving}
                          onChange={e => updateMember(m.id, { projectRole: e.target.value || null })}
                          style={{ padding:"5px 8px", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:11, fontFamily:"var(--font)",
                            color:"var(--text-2)", cursor:"pointer", maxWidth:160 }}>
                          <option value="">— No role —</option>
                          {PROJECT_ROLES_ORDERED.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>

                        {/* Allocation editor */}
                        <input type="number" min={0} max={100}
                          defaultValue={m.allocation}
                          onBlur={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v !== m.allocation)
                              updateMember(m.id, { allocation:v })
                          }}
                          style={{ width:60, padding:"5px 8px", border:"1px solid var(--border)",
                            borderRadius:"var(--radius)", fontSize:12, textAlign:"center",
                            fontFamily:"var(--font)", color:"var(--text)" }} />

                        {/* Remove */}
                        <button onClick={()=>removeMember(m.id)} disabled={isSaving}
                          style={{ padding:"5px 10px", background:"#FEF2F2",
                            border:"1px solid #FECACA", borderRadius:"var(--radius)",
                            fontSize:11, color:"var(--red)", cursor:"pointer",
                            fontFamily:"var(--font)" }}>
                          {isSaving ? "…" : "Remove"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Unassigned role members */}
            {ungrouped.length > 0 && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)",
                  textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>
                  No role assigned
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {ungrouped.map(m => (
                    <div key={m.id}
                      style={{ background:"#fff", border:"1px solid var(--border)",
                        borderRadius:"var(--radius)", padding:"12px 16px",
                        display:"flex", alignItems:"center", gap:14 }}>
                      <Avatar name={m.user?.name} avatarUrl={m.user?.avatarUrl} size={36} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{m.user?.name}</div>
                        <div style={{ fontSize:11, color:"var(--text-3)" }}>{m.user?.email}</div>
                      </div>
                      <select value="" onChange={e => updateMember(m.id, { projectRole: e.target.value })}
                        style={{ padding:"5px 8px", border:"1px solid #FBBF24",
                          borderRadius:"var(--radius)", fontSize:11, fontFamily:"var(--font)",
                          color:"var(--text-2)", cursor:"pointer", maxWidth:160,
                          background:"#FFFBEB" }}>
                        <option value="">⚠ Assign role…</option>
                        {PROJECT_ROLES_ORDERED.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button onClick={()=>removeMember(m.id)}
                        style={{ padding:"5px 10px", background:"#FEF2F2",
                          border:"1px solid #FECACA", borderRadius:"var(--radius)",
                          fontSize:11, color:"var(--red)", cursor:"pointer",
                          fontFamily:"var(--font)" }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
