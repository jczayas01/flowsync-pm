"use client"
// src/components/settings/SettingsShell.tsx — Phase 3 settings tabs
import Link from "next/link"
import { usePathname } from "next/navigation"
import { can as rbacCan, mapDbRoleToRbac } from "@/lib/rbac/roles"
import { limitsForPlan } from "@/lib/stripe/plan-limits"

// Each tab carries the role permission and (where relevant) the plan
// feature that must be present — same sources the server gates use.
const TABS = [
  { href:"/settings/workspace",    label:"Workspace",       icon:"🏢", perm:"workspace:view_settings" },
  { href:"/settings/team",         label:"Team",            icon:"👥", perm:"users:view" },
  { href:"/settings/billing",      label:"Billing",         icon:"💳", perm:"workspace:edit_settings" },
  { href:"/settings/security",     label:"Security",        icon:"🔒", perm:"workspace:view_settings" },
  { href:"/settings/roles",        label:"Roles",           icon:"🎭" },
  { href:"/settings/custom-fields",label:"Custom fields",   icon:"⚙️", perm:"workspace:edit_settings" },
  { href:"/settings/report-templates", label:"Report Templates", icon:"📈", perm:"projects:create" },
  { href:"/settings/white-label",  label:"White-label",     icon:"🎨", perm:"workspace:edit_branding", planFeature:"whiteLabel" },
  { href:"/settings/integrations", label:"Integrations",    icon:"🪟", perm:"workspace:manage_integrations", planFeature:"m365" },
  { href:"/settings/webhooks",     label:"Webhooks",        icon:"🔗", perm:"workspace:manage_integrations", planFeature:"apiAccess" },
  { href:"/settings/api",          label:"API",             icon:"🔑", perm:"workspace:manage_integrations", planFeature:"apiAccess" },
] as any[]

export function SettingsShell({ children, role = "", plan = "" }:{
  children:React.ReactNode; role?:string; plan?:string
}) {
  const pathname = usePathname()
  const rbacRole = mapDbRoleToRbac(role as any)
  const limits   = limitsForPlan(plan)
  const visible  = TABS.filter(t =>
    (!t.perm || rbacCan(rbacRole, t.perm)) &&
    (!t.planFeature || !!(limits as any)[t.planFeature]))
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"0 24px",flexShrink:0}}>
        <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",padding:"14px 0 0"}}>Settings</h1>
        <div style={{display:"flex",gap:0,marginTop:8,overflowX:"auto"}}>
          {visible.map(tab=>(
            <Link key={tab.href} href={tab.href}
              style={{display:"flex",alignItems:"center",gap:5,padding:"10px 12px",
                fontSize:12,fontWeight:500,textDecoration:"none",whiteSpace:"nowrap",
                borderBottom:pathname===tab.href?"2px solid var(--steel)":"2px solid transparent",
                color:pathname===tab.href?"var(--steel)":"var(--text-3)",
                marginBottom:-1,transition:"color .15s"}}>
              <span style={{fontSize:13}}>{tab.icon}</span>{tab.label}
            </Link>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:24}}>{children}</div>
    </div>
  )
}
