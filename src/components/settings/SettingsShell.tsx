"use client"
// src/components/settings/SettingsShell.tsx — Phase 3 settings tabs
import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href:"/settings/workspace",    label:"Workspace",       icon:"🏢" },
  { href:"/settings/team",         label:"Team",            icon:"👥" },
  { href:"/settings/billing",      label:"Billing",         icon:"💳" },
  { href:"/settings/security",     label:"Security",        icon:"🔒" },
  { href:"/settings/roles",        label:"Roles",           icon:"🎭" },
  { href:"/settings/custom-fields",label:"Custom fields",   icon:"⚙️" },
  { href:"/settings/report-templates", label:"Report Templates", icon:"📈" },
  { href:"/settings/white-label",  label:"White-label",     icon:"🎨" },
  { href:"/settings/integrations", label:"Integrations",    icon:"🪟" },
  { href:"/settings/webhooks",     label:"Webhooks",        icon:"🔗" },
  { href:"/settings/api",          label:"API",             icon:"🔑" },
]

export function SettingsShell({ children }:{ children:React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"0 24px",flexShrink:0}}>
        <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",padding:"14px 0 0"}}>Settings</h1>
        <div style={{display:"flex",gap:0,marginTop:8,overflowX:"auto"}}>
          {TABS.map(tab=>(
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
