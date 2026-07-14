// src/app/(app)/settings/roles/page.tsx
// Role & Permissions reference page — visual matrix

"use client"

import { PERMISSIONS, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_LEVEL, type AnyRole, type Permission } from "@/lib/rbac/roles"

// Derived from the RBAC module — any role added there shows up here automatically,
// ordered highest-access first.
const ROLES: AnyRole[] = (Object.keys(ROLE_LEVEL) as AnyRole[])
  .sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a])

const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "System", perms: ["system:access","system:admin","system:assign_admin"] },
  { label: "Workspace", perms: ["workspace:view_settings","workspace:edit_branding","workspace:edit_settings","workspace:manage_integrations","workspace:view_audit_log"] },
  { label: "Users", perms: ["users:view","users:invite","users:remove","users:assign_role","users:assign_admin_role"] },
  { label: "Intake", perms: ["intake:submit","intake:view_all","intake:review_pm","intake:approve_sponsor","intake:convert"] },
  { label: "Projects", perms: ["projects:view_all","projects:view_assigned","projects:create","projects:edit","projects:delete","projects:archive","projects:set_confidential","projects:view_confidential","projects:manage_members","projects:export"] },
  { label: "Programs", perms: ["programs:view","programs:create","programs:edit","programs:manage_projects"] },
  { label: "Tasks", perms: ["tasks:view_all","tasks:view_assigned","tasks:create","tasks:edit_any","tasks:edit_assigned","tasks:delete","tasks:assign","tasks:update_progress"] },
  { label: "Files", perms: ["files:upload","files:download","files:download_sensitive","files:delete"] },
  { label: "Budget", perms: ["budget:view","budget:edit","budget:view_details","budget:export"] },
  { label: "Risks & Changes", perms: ["risks:view","risks:create","risks:edit","changes:view","changes:create","changes:approve"] },
  { label: "Reports", perms: ["reports:view","reports:create","reports:export","reports:share_external"] },
  { label: "Notifications", perms: ["notifications:receive_task","notifications:receive_project","notifications:receive_billing"] },
  { label: "AI & M365", perms: ["ai:use_copilot","ai:generate_reports","m365:connect","m365:sync"] },
]

const ROLE_COLORS: Record<string, string> = {
  SYSTEM_ADMIN:    "#DC2626",
  ADMIN:           "#1B6CA8",
  SUPER_USER:      "#7C3AED",
  PMO_DIRECTOR:    "#0D9488",
  EXECUTIVE:       "#B45309",
  PROGRAM_MANAGER: "#0891B2",
  PROJECT_MANAGER: "#059669",
  TEAM_MEMBER:     "#F59E0B",
  READ_ONLY:       "#64748B",
  CLIENT:          "#94A3B8",
}

// Roles that can be granted from Settings → Team. System roles are platform-managed.
const ASSIGNABLE: AnyRole[] = ["ADMIN","PMO_DIRECTOR","EXECUTIVE","PROGRAM_MANAGER","PROJECT_MANAGER","TEAM_MEMBER","READ_ONLY","CLIENT"]

// Project-level roles — assigned per project in the project's Team tab.
const PROJECT_ROLES: { role: string; label: string; desc: string }[] = [
  { role:"SPONSOR",            label:"Sponsor",             desc:"Owns the business case; approves the project and major changes" },
  { role:"EXECUTIVE_SPONSOR",  label:"Executive Sponsor",   desc:"Senior leadership champion; escalation point and approver" },
  { role:"PMO",                label:"PMO",                 desc:"Governance oversight; standards, gates, and approvals" },
  { role:"PMO_DIRECTOR",       label:"PMO Director",        desc:"Heads the PMO function across the portfolio" },
  { role:"PM",                 label:"Project Manager",     desc:"Runs the project day to day; owns schedule, budget, and delivery" },
  { role:"PROGRAM_MANAGER",    label:"Program Manager",     desc:"Coordinates this project within its program" },
  { role:"STEERING_COMMITTEE", label:"Steering Committee",  desc:"Gate reviews and strategic direction" },
  { role:"PRODUCT_OWNER",      label:"Product Owner",       desc:"Owns the backlog and priorities (agile delivery)" },
  { role:"SCRUM_MASTER",       label:"Scrum Master",        desc:"Facilitates agile ceremonies and removes impediments" },
  { role:"TECH_LEAD",          label:"Tech Lead",           desc:"Technical direction and solution decisions" },
  { role:"BUSINESS_ANALYST",   label:"Business Analyst",    desc:"Requirements, process analysis, and documentation" },
  { role:"TEAM_MEMBER",        label:"Team Member",         desc:"Delivers assigned work on this project" },
  { role:"STAKEHOLDER",        label:"Stakeholder",         desc:"Affected by or interested in outcomes; kept informed" },
  { role:"EXTERNAL_RESOURCE",  label:"External Resource",   desc:"Contracted contributor from outside the organization" },
  { role:"CLIENT",             label:"Client",              desc:"External customer view, limited to Tasks and Docs" },
  { role:"AUDITOR",            label:"Auditor",             desc:"Read access for compliance and audit review" },
]

function hasPermission(role: AnyRole, perm: Permission): boolean {
  return PERMISSIONS[role]?.[perm] === true
}

export default function RolesPage() {
  const colW = 88

  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 16px", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── How roles work: the two layers ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }} className="fs-cols-2">
        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"14px 16px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#1B6CA8", marginBottom:6 }}>🏢 Workspace roles (this page)</div>
          <div style={{ fontSize:12, color:"#334155", lineHeight:1.55 }}>
            One per person, set in <strong>Settings → Team</strong>. Controls platform access — what
            someone can see and do across the whole workspace. The matrix below is the full permission
            reference for these roles.
          </div>
        </div>
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"14px 16px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#059669", marginBottom:6 }}>📁 Project roles (per project)</div>
          <div style={{ fontSize:12, color:"#334155", lineHeight:1.55 }}>
            Assigned in each project's <strong>Team tab</strong> and can differ per project — a workspace
            Team Member can be the PM of one project and an Auditor on another. Project approvals accept
            either layer: the project's Sponsor / Executive Sponsor / PMO, <em>or</em> a workspace
            Owner / Admin / PMO Director.
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
          Roles & permissions
        </h1>
        <p style={{ fontSize: 13, color: "#64748B" }}>
          Complete permission matrix for all roles in FlowSync PM.
          Role assignment is hierarchical — you can only assign roles below your own level.
        </p>
      </div>

      {/* Role cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 28 }}>
        {ROLES.map(role => (
          <div key={role} style={{ background: "#fff", border: `1px solid #E2E8F0`, borderRadius: 8, padding: "12px 14px", borderTop: `3px solid ${ (ROLE_COLORS[role] || "#64748B")}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color:  (ROLE_COLORS[role] || "#64748B"), marginBottom: 4 }}>{ROLE_LABELS[role]}
                  {!ASSIGNABLE.includes(role) && (
                    <div style={{ fontSize:8, fontWeight:700, color:"#94A3B8", letterSpacing:".04em", marginTop:2 }}>SYSTEM</div>
                  )}</div>
            <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>{ROLE_DESCRIPTIONS[role]}</div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", borderBottom: "1px solid #E2E8F0", width: 220, position: "sticky", left: 0, background: "#F8FAFC" }}>
                  Permission
                </th>
                {ROLES.map(role => (
                  <th key={role} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 600, color:  (ROLE_COLORS[role] || "#64748B"), borderBottom: "1px solid #E2E8F0", width: colW, whiteSpace: "nowrap" }}>
                    {ROLE_LABELS[role].split(" ")[0]}
                    <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 400 }}>
                      {ROLE_LABELS[role].split(" ").slice(1).join(" ")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(group => (
                <>
                  <tr key={`group-${group.label}`}>
                    <td colSpan={ROLES.length + 1}
                      style={{ padding: "8px 14px", background: "#F1F5F9", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid #E2E8F0", borderTop: "1px solid #E2E8F0" }}>
                      {group.label}
                    </td>
                  </tr>
                  {group.perms.map((perm, pi) => (
                    <tr key={perm} style={{ background: pi % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                      <td style={{ padding: "7px 14px", fontSize: 11, color: "#334155", borderBottom: "1px solid #F1F5F9", position: "sticky", left: 0, background: pi % 2 === 0 ? "#fff" : "#FAFBFF", fontFamily: "monospace" }}>
                        {perm}
                      </td>
                      {ROLES.map(role => {
                        const allowed = hasPermission(role, perm)
                        return (
                          <td key={role} style={{ textAlign: "center", borderBottom: "1px solid #F1F5F9", width: colW }}>
                            {allowed
                              ? <span style={{ color: "#059669", fontSize: 15 }}>✓</span>
                              : <span style={{ color: "#E2E8F0", fontSize: 13 }}>—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Project roles reference ── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#0D1B2A", marginBottom:4 }}>📁 Project roles</div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:12 }}>
          Assigned per project in the project's <strong>Team</strong> tab — independent of the workspace role above.
        </div>
        <div className="fs-cols-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {PROJECT_ROLES.map(r => (
            <div key={r.role} style={{ display:"flex", gap:10, alignItems:"flex-start",
              background:"#fff", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 12px" }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#059669", background:"#F0FDF4",
                border:"1px solid #BBF7D0", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap", flexShrink:0 }}>
                {r.label}
              </span>
              <span style={{ fontSize:11.5, color:"#475569", lineHeight:1.5 }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: "#94A3B8" }}>
        ✓ = Permitted  · — = Denied  · CLIENT permissions can be extended per project by the Project Manager
      </div>
    </div>
  )
}
