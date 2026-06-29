"use client"
// src/components/layout/AppShell.tsx — with legal footer
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LegalFooter } from "@/components/legal/LegalFooter"

interface Workspace { id:string; name:string; logoUrl?:string|null; plan:string }
interface User      { id:string; name:string; email:string; avatarUrl?:string }

const NAV = [
  { href:"/dashboard",  icon:"⊞",  label:"Dashboard"  },
  { href:"/projects",   icon:"📁",  label:"Projects"   },
  { href:"/portfolio",  icon:"📊",  label:"Portfolio"  },
  { href:"/resources",  icon:"👥",  label:"Resources"  },
  { href:"/skills",     icon:"🎓",  label:"Skills"     },
  { href:"/automation", icon:"⚡",  label:"Automation" },
  { href:"/templates",  icon:"📦",  label:"Templates"  },
  { href:"/goals",      icon:"🎯",  label:"Goals"      },
  { href:"/reports",    icon:"📈",  label:"Reports"    },
]

const SETTINGS_NAV = [
  { href:"/settings/workspace",     label:"Workspace"          },
  { href:"/settings/team",          label:"Team"               },
  { href:"/settings/billing",       label:"Billing"            },
  { href:"/settings/security",      label:"Security"           },
  { href:"/settings/roles",         label:"Roles"              },
  { href:"/settings/custom-fields", label:"Custom fields"      },
  { href:"/settings/white-label",   label:"White-label"        },
  { href:"/settings/webhooks",      label:"Webhooks"           },
  { href:"/settings/api",           label:"API & integrations" },
]

export function AppShell({ user, workspace, userRole, children }: {
  user: User; workspace: Workspace; userRole: string; children: React.ReactNode
}) {
  const pathname  = usePathname()
  const [menu, setMenu] = useState(false)
  const isSettings = pathname.startsWith("/settings")

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--surface)" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width:196, background:"var(--navy,#0D1B2A)", display:"flex",
        flexDirection:"column", flexShrink:0, borderRight:"1px solid rgba(255,255,255,.06)" }}>

        {/* Logo + workspace */}
        <div style={{ padding:"13px 11px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
          <Link href="/dashboard"
            style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", marginBottom:9 }}>
            <div style={{ width:27, height:27, background:"var(--steel,#1B6CA8)", borderRadius:7,
              position:"relative", flexShrink:0 }}>
              <div style={{ position:"absolute", width:13, height:2.5, background:"#fff", top:7, left:7, borderRadius:2 }}/>
              <div style={{ position:"absolute", width:8, height:2.5, background:"var(--amber,#F59E0B)", top:12, left:7, borderRadius:2 }}/>
            </div>
            <span style={{ fontWeight:700, fontSize:13, color:"#fff" }}>
              FlowSync <span style={{ color:"var(--amber,#F59E0B)" }}>PM</span>
            </span>
          </Link>
          <div style={{ background:"rgba(255,255,255,.07)", borderRadius:5, padding:"5px 9px",
            fontSize:11, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              fontWeight:500, color:"rgba(255,255,255,.75)", flex:1 }}>
              {workspace.name}
            </span>
            <span style={{ fontSize:9, opacity:.5, marginLeft:4 }}>▾</span>
          </div>
        </div>

        {/* Main nav */}
        <nav style={{ flex:1, padding:"8px 7px", overflowY:"auto" }}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 9px",
                borderRadius:6, marginBottom:1, textDecoration:"none",
                background: isActive(item.href) ? "rgba(27,108,168,.3)" : "transparent",
                color:      isActive(item.href) ? "#fff" : "rgba(255,255,255,.45)",
                fontSize:12, fontWeight: isActive(item.href) ? 500 : 400, transition:"all .15s" }}>
              <span style={{ fontSize:13, width:17, textAlign:"center" }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {isSettings && (
            <>
              <div style={{ fontSize:9, fontWeight:600, letterSpacing:".08em",
                textTransform:"uppercase", color:"rgba(255,255,255,.25)", padding:"12px 9px 5px" }}>
                Settings
              </div>
              {SETTINGS_NAV.map(item => (
                <Link key={item.href} href={item.href}
                  style={{ display:"block", padding:"6px 9px", borderRadius:5, marginBottom:1,
                    textDecoration:"none", fontSize:11,
                    background: pathname === item.href ? "rgba(27,108,168,.3)" : "transparent",
                    color:      pathname === item.href ? "#fff" : "rgba(255,255,255,.38)" }}>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Settings + user */}
        <div style={{ padding:"8px 7px", borderTop:"1px solid rgba(255,255,255,.06)", position:"relative" }}>
          <Link href="/settings/workspace"
            style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 9px",
              borderRadius:5, textDecoration:"none",
              background: isSettings ? "rgba(255,255,255,.07)" : "transparent" }}>
            <span style={{ fontSize:13 }}>⚙</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,.45)" }}>Settings</span>
          </Link>
          <div onClick={() => setMenu(!menu)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 9px",
              borderRadius:5, cursor:"pointer",
              background: menu ? "rgba(255,255,255,.07)" : "transparent" }}>
            <div style={{ width:24, height:24, borderRadius:"50%",
              background:"linear-gradient(135deg,var(--steel,#1B6CA8),#2481C8)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:700, color:"#fff", flexShrink:0 }}>
              {user.name.slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:500, color:"rgba(255,255,255,.8)",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {user.name}
              </div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,.35)" }}>
                {userRole.replace(/_/g," ")}
              </div>
            </div>
          </div>
          {menu && (
            <div style={{ position:"absolute", bottom:"100%", left:7, right:7,
              background:"#1a2d40", border:"1px solid rgba(255,255,255,.1)",
              borderRadius:8, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,.4)", zIndex:100 }}>
              <div style={{ padding:"9px 11px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
                <div style={{ fontSize:11, fontWeight:500, color:"#fff" }}>{user.name}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.4)" }}>{user.email}</div>
              </div>
              <Link href="/privacy" target="_blank"
                style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 11px",
                  fontSize:11, color:"rgba(255,255,255,.5)", textDecoration:"none" }}>
                <span>🔒</span> Privacy Policy
              </Link>
              <button onClick={() => signOut({ callbackUrl:"/auth/signin" })}
                style={{ width:"100%", padding:"9px 11px", background:"none", border:"none",
                  textAlign:"left", fontSize:12, color:"rgba(255,255,255,.6)",
                  cursor:"pointer", fontFamily:"var(--font)",
                  display:"flex", alignItems:"center", gap:7, borderTop:"1px solid rgba(255,255,255,.06)" }}>
                <span>🚪</span> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content + legal footer ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        <main style={{ flex:1, overflow:"hidden", minWidth:0 }}>
          {children}
        </main>
        <LegalFooter />
      </div>
    </div>
  )
}
