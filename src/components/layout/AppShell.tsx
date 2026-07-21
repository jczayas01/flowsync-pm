"use client"
// src/components/layout/AppShell.tsx — Phase 3 final nav
import { useTranslations } from "next-intl"
import { limitsForPlan } from "@/lib/stripe/plan-limits"
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { HelpCenter } from "@/components/help/HelpCenter"
import { can as rbacCan, mapDbRoleToRbac, ROLE_LEVEL } from "@/lib/rbac/roles"
import { PermissionsProvider } from "@/lib/rbac/usePermissions"
import { NotificationBell } from "@/components/layout/NotificationBell"

interface Workspace { id:string; name:string; logoUrl?:string|null; plan:string; trialEndsAt?:Date|string|null }
interface User      { id:string; name:string; email:string; avatarUrl?:string }

const NAV = [
  // Overview (no section header — sits at the top)
  { href:"/dashboard",  icon:"⊞",  label:"Dashboard", minLevel:30 },

  // Executive — strategic oversight
  { href:"/executive",  icon:"👔",  label:"Executive",  perm:"projects:view_all", planFeature:"executiveDash", section:"Executive" },
  { href:"/goals",      icon:"🎯",  label:"Goals",     minLevel:50, section:"Executive" },

  // Portfolio — high-level project structure (the hierarchy)
  { href:"/portfolio",  icon:"📊",  label:"Portfolio",  perm:"projects:view_all", planFeature:"portfolio", section:"Portfolio", children:[
    { href:"/programs", icon:"🗂",  label:"Programs", perm:"programs:view" },
    { href:"/projects", icon:"📁",  label:"Projects"   },
  ]},

  // Operations — low-level, day-to-day project work
  { href:"/my-tasks",   icon:"✔",  label:"My Tasks",   section:"Operations" },
  { href:"/intake",     icon:"💡",  label:"Intake",     minLevel:10, section:"Operations" },
  { href:"/resources",  icon:"👥",  label:"Resources",  minLevel:50, section:"Operations" },
  { href:"/skills",     icon:"🎓",  label:"Skills",     minLevel:50, section:"Operations" },
  { href:"/templates",  icon:"📦",  label:"Templates",  perm:"projects:create", section:"Operations" },
  { href:"/automation", icon:"⚡",  label:"Automation", perm:"workspace:manage_integrations", section:"Operations" },
] as any[]

const SETTINGS_NAV = [
  { href:"/settings/workspace",    label:"Workspace",       perm:"workspace:view_settings" },
  { href:"/settings/team",         label:"Team",            perm:"users:view" },
  { href:"/settings/billing",      label:"Billing",         perm:"workspace:edit_settings" },
  { href:"/settings/security",     label:"Security",        perm:"workspace:view_settings" },
  { href:"/settings/roles",        label:"Roles"            },
  { href:"/settings/custom-fields",label:"Custom fields",   perm:"workspace:edit_settings" },
  { href:"/settings/white-label",  label:"White-label",     perm:"workspace:edit_branding", planFeature:"whiteLabel" },
  { href:"/settings/webhooks",     label:"Webhooks",        perm:"workspace:manage_integrations", planFeature:"apiAccess" },
  { href:"/settings/api",          label:"API & integrations", perm:"workspace:manage_integrations", planFeature:"apiAccess" },
] as any[]

export function AppShell({ user, workspace, workspaces, userRole, isPlatformAdmin = false, children }:{
  user:User; workspace:Workspace; workspaces:Workspace[]; userRole:string
  isPlatformAdmin?:boolean; children:React.ReactNode
}) {
  const { update } = useSession()
  const [wsOpen, setWsOpen] = useState(false)
  const [wsBusy, setWsBusy] = useState(false)

  async function switchWorkspace(id: string) {
    if (id === workspace.id || wsBusy) { setWsOpen(false); return }
    setWsBusy(true)
    try {
      // The jwt callback validates membership before honoring this — a rogue id
      // is refused server-side, so the client stays simple.
      await update({ activeWorkspaceId: id })
      window.location.href = "/dashboard"   // full reload: every layout re-resolves
    } catch { setWsBusy(false); setWsOpen(false) }
  }
  const pathname    = usePathname()
  const [menu, setMenu] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const t = useTranslations("nav")
  const isSettings  = pathname.startsWith("/settings")
  const [mobileNav, setMobileNav] = useState(false)
  useEffect(() => { setMobileNav(false) }, [pathname])

  function isActive(href:string) {
    if(href==="/dashboard") return pathname==="/dashboard"
    return pathname.startsWith(href)
  }

  const rbacRole = mapDbRoleToRbac(userRole)
  const myLevel  = ROLE_LEVEL[rbacRole] ?? 0
  const can = (p?:string) => !p || rbacCan(rbacRole, p as any)
  // Plan-aware nav: items tagged with planFeature disappear when the
  // workspace's plan doesn't include that feature (same limits the server
  // gates enforce — a Starter workspace shows no Executive/Portfolio links).
  const planLimits = limitsForPlan((workspace as any)?.plan)
  const hasFeature = (f?:string) => !f || !!(planLimits as any)[f]
  const passes = (i:any) => can(i.perm) && (!i.minLevel || myLevel >= i.minLevel) && hasFeature(i.planFeature)
  const navItems = NAV.filter(passes)
  // Emit a section header only when the section changes among *visible* items,
  // so a section that's entirely filtered out for a role leaves no orphan header.
  let __lastSection = ""
  const navWithHeaders = navItems.map((item:any) => {
    const showHeader = !!item.section && item.section !== __lastSection
    __lastSection = item.section || __lastSection
    return { item, showHeader }
  })
  const settingsItems = SETTINGS_NAV.filter(passes)

  return (
    <PermissionsProvider role={userRole}>
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:"var(--surface)"}}>
      <aside className={`fs-sidebar ${mobileNav ? "fs-open" : ""}`}
        style={{width:196,background:"var(--navy,#0D1B2A)",display:"flex",flexDirection:"column",
        flexShrink:0,borderRight:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{padding:"13px 11px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          <Link href="/dashboard" style={{display:"flex",alignItems:"center",gap:8,
            textDecoration:"none",marginBottom:9}}>
            <div style={{width:27,height:27,background:"var(--steel,#1B6CA8)",borderRadius:7,
              position:"relative",flexShrink:0}}>
              <div style={{position:"absolute",width:13,height:2.5,background:"#fff",top:7,left:7,borderRadius:2}}/>
              <div style={{position:"absolute",width:8,height:2.5,background:"var(--amber,#F59E0B)",top:12,left:7,borderRadius:2}}/>
            </div>
            <span style={{fontWeight:700,fontSize:13,color:"#fff"}}>
              FlowSync <span style={{color:"var(--amber,#F59E0B)"}}>PM</span>
            </span>
          </Link>
          <div style={{ position:"relative" }}>
            <button onClick={() => setWsOpen(o => !o)} aria-expanded={wsOpen}
              aria-label="Switch workspace"
              style={{width:"100%",background:"rgba(255,255,255,.07)",borderRadius:5,padding:"5px 9px",
                fontSize:11,color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",
                justifyContent:"space-between",cursor:"pointer",border:"none",fontFamily:"inherit",
                textAlign:"left"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                fontWeight:500,color:"rgba(255,255,255,.75)",flex:1,fontSize:11}}>
                {wsBusy ? "Switching…" : workspace.name}
              </span>
              <span style={{fontSize:9,opacity:.5,marginLeft:4,
                transform: wsOpen ? "rotate(180deg)" : "none", transition:"transform .15s"}}>▾</span>
            </button>

            {wsOpen && (
              <>
                {/* click-away layer */}
                <div onClick={() => setWsOpen(false)}
                  style={{ position:"fixed", inset:0, zIndex:120 }} />
                <div role="listbox" style={{ position:"absolute", top:"calc(100% + 5px)", left:0, right:0,
                  zIndex:121, background:"#13273B", border:"1px solid rgba(255,255,255,.14)",
                  borderRadius:8, boxShadow:"0 16px 40px rgba(0,0,0,.5)", overflow:"hidden",
                  maxHeight:280, overflowY:"auto" }}>
                  {(workspaces || []).map(w => {
                    const current = w.id === workspace.id
                    return (
                      <button key={w.id} role="option" aria-selected={current}
                        onClick={() => switchWorkspace(w.id)}
                        style={{ width:"100%", display:"flex", alignItems:"center", gap:8,
                          padding:"9px 10px", background: current ? "rgba(255,255,255,.08)" : "none",
                          border:"none", cursor: current ? "default" : "pointer",
                          fontFamily:"inherit", textAlign:"left" }}>
                        <span style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                          background:"rgba(27,108,168,.35)", display:"grid", placeItems:"center",
                          fontSize:10, fontWeight:800, color:"#fff" }}>
                          {w.name.slice(0,1).toUpperCase()}
                        </span>
                        <span style={{ flex:1, minWidth:0 }}>
                          <span style={{ display:"block", fontSize:11.5, fontWeight:600,
                            color:"rgba(255,255,255,.85)", overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.name}</span>
                          <span style={{ fontSize:9, color:"rgba(255,255,255,.4)",
                            textTransform:"uppercase", letterSpacing:".04em" }}>{w.plan}</span>
                        </span>
                        {current && <span style={{ color:"var(--amber,#F59E0B)", fontSize:11 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <nav style={{flex:1,padding:"8px 7px",overflowY:"auto"}}>
          {navWithHeaders.map(({item, showHeader}:any)=>(
            <div key={item.href}>
              {showHeader && (
                <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",
                  color:"rgba(255,255,255,.25)",padding:"12px 9px 5px"}}>
                  {t(item.section as any)}
                </div>
              )}
              <Link href={item.href}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 9px",
                  borderRadius:6,marginBottom:1,textDecoration:"none",
                  background:isActive(item.href)?"rgba(27,108,168,.3)":"transparent",
                  color:isActive(item.href)?"#fff":"rgba(255,255,255,.45)",
                  fontSize:12,fontWeight:isActive(item.href)?500:400,transition:"all .15s"}}>
                <span style={{fontSize:13,width:17,textAlign:"center"}}>{item.icon}</span>
                {t(item.label as any)}
              </Link>
              {item.children && (pathname.startsWith(item.href) || item.children.some((c:any) => pathname.startsWith(c.href))) && (
                <div style={{paddingLeft:26,marginBottom:2}}>
                  {item.children.filter((c:any)=>can(c.perm)).map((child:any) => (
                    <Link key={child.href} href={child.href}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"5px 9px",
                        borderRadius:5,marginBottom:1,textDecoration:"none",
                        background:pathname.startsWith(child.href)?"rgba(255,255,255,.1)":"transparent",
                        color:pathname.startsWith(child.href)?"#fff":"rgba(255,255,255,.4)",
                        fontSize:11,fontWeight:pathname.startsWith(child.href)?500:400}}>
                      <span style={{fontSize:12,width:14,textAlign:"center"}}>{child.icon}</span>
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isPlatformAdmin && (
            <>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",
                color:"rgba(255,255,255,.25)",padding:"12px 9px 5px"}}>
                Platform
              </div>
              <Link href="/admin"
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 9px",
                  borderRadius:6,marginBottom:1,textDecoration:"none",
                  background:isActive("/admin")?"rgba(220,38,38,.25)":"transparent",
                  color:isActive("/admin")?"#fff":"rgba(255,255,255,.45)",
                  fontSize:12,fontWeight:isActive("/admin")?500:400}}>
                <span style={{fontSize:13,width:17,textAlign:"center"}}>⚡</span>
                Platform Admin
              </Link>
            </>
          )}

          {isSettings&&(
            <>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",
                color:"rgba(255,255,255,.25)",padding:"12px 9px 5px"}}>
                {t("Settings")}
              </div>
              {settingsItems.map(item=>(
                <Link key={item.href} href={item.href}
                  style={{display:"block",padding:"6px 9px",borderRadius:5,marginBottom:1,
                    textDecoration:"none",fontSize:11,
                    background:pathname===item.href?"rgba(27,108,168,.3)":"transparent",
                    color:pathname===item.href?"#fff":"rgba(255,255,255,.38)"}}>
                  {t(item.label as any)}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div style={{padding:"8px 7px",borderTop:"1px solid rgba(255,255,255,.06)",position:"relative"}}>
          <Link href="/settings/workspace"
            style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",
              borderRadius:5,textDecoration:"none",
              background:isSettings?"rgba(255,255,255,.07)":"transparent"}}>
            <span style={{fontSize:13}}>⚙</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>Settings</span>
          </Link>
          <div onClick={()=>setMenu(!menu)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",
              borderRadius:5,cursor:"pointer",
              background:menu?"rgba(255,255,255,.07)":"transparent"}}>
            <div style={{width:24,height:24,borderRadius:"50%",
              background:"linear-gradient(135deg,var(--steel,#1B6CA8),#2481C8)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>
              {user.name.slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,.8)",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {user.name}
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,.35)"}}>{userRole.replace(/_/g," ")}</div>
            </div>
            <div onClick={e => e.stopPropagation()} style={{ flexShrink:0 }}>
              <NotificationBell />
            </div>
          </div>
          {menu&&(
            <div style={{position:"absolute",bottom:"100%",left:7,right:7,
              background:"#1a2d40",border:"1px solid rgba(255,255,255,.1)",
              borderRadius:"var(--radius,8px)",overflow:"hidden",
              boxShadow:"0 8px 24px rgba(0,0,0,.4)",zIndex:100}}>
              <div style={{padding:"9px 11px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                <div style={{fontSize:11,fontWeight:500,color:"#fff"}}>{user.name}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{user.email}</div>
              </div>
              <button onClick={()=>signOut({callbackUrl:"/auth/signin"})}
                style={{width:"100%",padding:"9px 11px",background:"none",border:"none",
                  textAlign:"left",fontSize:12,color:"rgba(255,255,255,.6)",cursor:"pointer",
                  fontFamily:"var(--font)",display:"flex",alignItems:"center",gap:7}}>
                <span>🚪</span> Sign out
              </button>
            </div>
          )}
        </div>

        {/* Help button */}
        <LocaleSwitcher />
        <button onClick={()=>setHelpOpen(true)}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
            background:"rgba(255,255,255,.06)", border:"none", borderRadius:6,
            cursor:"pointer", width:"100%", color:"rgba(255,255,255,.6)",
            fontFamily:"var(--font)", fontSize:12, marginBottom:6 }}>
          <span style={{ fontSize:14 }}>❓</span>
          <span>{t("Help & Guide")}</span>
        </button>

        {/* Copyright footer */}
        <div style={{ padding:"8px 10px", borderTop:"1px solid rgba(255,255,255,.06)",
          flexShrink:0 }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,.25)", lineHeight:1.5,
            textAlign:"center" }}>
            © 2026 FlowSync PM<br/>
            <a href="/legal" style={{ color:"rgba(255,255,255,.25)", textDecoration:"none" }}>
              Legal & Privacy
            </a>
          </div>
        </div>
      </aside>
      {mobileNav && <div className="fs-backdrop" onClick={() => setMobileNav(false)} />}

      {/* Help Center panel */}
      {helpOpen && <HelpCenter onClose={()=>setHelpOpen(false)} />}

      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {(() => {
          // Trial banner — countdown for the last 14 days, hard bar when expired.
          // Paid plans and legacy no-date workspaces render nothing.
          if (workspace.plan !== "FREE" || !workspace.trialEndsAt) return null
          const days = Math.ceil((new Date(workspace.trialEndsAt).getTime() - Date.now()) / 86400000)
          if (days > 14) return null
          if (days >= 0) return (
            <div style={{ background:"#FFFBEB", borderBottom:"1px solid #FDE68A",
              padding:"9px 20px", fontSize:13, color:"#92400E", display:"flex",
              alignItems:"center", gap:10, justifyContent:"center" }}>
              <span>⏳ Your free trial ends {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}. Nothing is charged unless you subscribe.</span>
              <a href="/settings/billing" style={{ background:"#F59E0B", color:"#0D1B2A",
                padding:"5px 14px", borderRadius:7, fontWeight:700, fontSize:12.5,
                textDecoration:"none", whiteSpace:"nowrap" }}>Subscribe</a>
            </div>
          )
          return (
            <div style={{ background:"#FEF2F2", borderBottom:"1px solid #FECACA",
              padding:"9px 20px", fontSize:13, color:"#991B1B", display:"flex",
              alignItems:"center", gap:10, justifyContent:"center" }}>
              <span>🔒 Your trial has ended — this workspace is read-only. Your data is safe, and you can still view and export everything.</span>
              <a href="/settings/billing" style={{ background:"#DC2626", color:"#fff",
                padding:"5px 14px", borderRadius:7, fontWeight:700, fontSize:12.5,
                textDecoration:"none", whiteSpace:"nowrap" }}>Subscribe to continue</a>
            </div>
          )
        })()}
        <div className="fs-mobilebar">
          <button onClick={() => setMobileNav(true)} aria-label="Menu"
            style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",
              padding:"0 2px",lineHeight:1}}>☰</button>
          <span style={{fontWeight:800,fontSize:14,letterSpacing:".01em"}}>
            FlowSync <span style={{color:"var(--amber,#F59E0B)"}}>PM</span>
          </span>
        </div>
        {children}
      </main>
    </div>
    </PermissionsProvider>
  )
}
