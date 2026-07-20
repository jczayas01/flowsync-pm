// src/components/settings/DeleteRolesPanel.tsx
"use client"
// Admin panel: which workspace roles may delete Projects / Programs /
// Portfolios. SUPER_ADMIN and OWNER are always on and shown locked.
import { useEffect, useState } from "react"

const ENTITIES = [
  { key: "project",   label: "Projects",   hint: "Archive first, then delete permanently" },
  { key: "program",   label: "Programs",   hint: "Projects inside are released, not deleted" },
  { key: "portfolio", label: "Portfolios", hint: "Must be emptied of programs first" },
] as const

const ROLE_NAMES: Record<string,string> = {
  SUPER_ADMIN: "Super Admin", OWNER: "Owner", ADMIN: "Admin",
  PMO_DIRECTOR: "PMO Director", PROGRAM_MANAGER: "Program Manager", PM: "Project Manager",
}

export function DeleteRolesPanel({ workspaceId = "" }: { workspaceId?: string }) {
  const [roles, setRoles]           = useState<Record<string,string[]> | null>(null)
  const [assignable, setAssignable] = useState<string[]>([])
  const [alwaysOn, setAlwaysOn]     = useState<string[]>([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")

  useEffect(() => {
    fetch("/api/settings/delete-roles", { headers: workspaceId ? { "x-workspace-id": workspaceId } : {} })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setRoles(d.data.roles); setAssignable(d.data.assignable); setAlwaysOn(d.data.alwaysOn)
      })
      .catch(() => setError("Could not load deletion permissions (admin only)."))
  }, [workspaceId])

  async function toggle(entity: string, role: string) {
    if (!roles) return
    const has  = roles[entity].includes(role)
    const next = { ...roles, [entity]: has ? roles[entity].filter(r => r !== role) : [...roles[entity], role] }
    setRoles(next); setSaving(true); setError("")
    const res = await fetch("/api/settings/delete-roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(workspaceId ? { "x-workspace-id": workspaceId } : {}) },
      body: JSON.stringify({ [entity]: next[entity] }),
    })
    setSaving(false)
    if (!res.ok) { setError("Save failed — change reverted."); setRoles(roles) }
  }

  if (error && !roles) return null
  if (!roles) return null

  return (
    <div style={{ background:"#fff", border:"1px solid var(--border)", borderRadius:10, marginTop:18 }}>
      <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>
          🗑 Deletion permissions {saving && <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:400 }}>· saving…</span>}
        </div>
        <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:2 }}>
          Choose which roles may delete each item type. Owner and Super Admin always can.
        </div>
        {error && <div style={{ fontSize:11.5, color:"#DC2626", marginTop:4 }}>{error}</div>}
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", padding:"8px 16px", color:"var(--text-3)", fontWeight:600 }}>Item</th>
              {[...alwaysOn, ...assignable].map(r => (
                <th key={r} style={{ padding:"8px 10px", color:"var(--text-3)", fontWeight:600, whiteSpace:"nowrap" }}>
                  {ROLE_NAMES[r] || r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTITIES.map(e => (
              <tr key={e.key} style={{ borderTop:"1px solid var(--surface-1,#F1F5F9)" }}>
                <td style={{ padding:"10px 16px" }}>
                  <div style={{ fontWeight:600, color:"var(--text)" }}>{e.label}</div>
                  <div style={{ fontSize:10.5, color:"var(--text-3)" }}>{e.hint}</div>
                </td>
                {alwaysOn.map(r => (
                  <td key={r} style={{ textAlign:"center" }}>
                    <input type="checkbox" checked disabled title="Always allowed" />
                  </td>
                ))}
                {assignable.map(r => (
                  <td key={r} style={{ textAlign:"center" }}>
                    <input type="checkbox"
                      checked={roles[e.key]?.includes(r) || false}
                      onChange={() => toggle(e.key, r)}
                      style={{ cursor:"pointer", accentColor:"#059669" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
