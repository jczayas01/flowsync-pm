// src/components/dashboard/DashboardView.tsx
"use client"

import { useTranslations } from "next-intl"
import { useState } from 'react'
import Link from 'next/link'
import { WelcomeBanner } from './WelcomeBanner'
import { can as rbacCan, mapDbRoleToRbac, ROLE_LEVEL } from '@/lib/rbac/roles'

// ── Helpers ──────────────────────────────────
function healthColor(h: string) {
  return h === 'GREEN' ? 'var(--green)' : h === 'AMBER' ? 'var(--amber)' : 'var(--red)'
}
function healthBg(h: string) {
  return h === 'GREEN' ? '#ECFDF5' : h === 'AMBER' ? '#FFFBEB' : '#FEF2F2'
}
function healthLabel(h: string) {
  return h === 'GREEN' ? 'On track' : h === 'AMBER' ? 'At risk' : 'Off track'
}
function daysUntil(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / 86400000)
}
function fmtDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'UTC' })
}
function fmtCurrency(n: number, currency = 'USD') {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(n)
}

// ── Main component ───────────────────────────
export function DashboardView({ projects, milestones, risks, activity,
  healthCounts, workspaceId, userRole = 'MEMBER' }: {
  projects:     any[]
  milestones:   any[]
  risks:        any[]
  activity:     any[]
  healthCounts: { GREEN:number; AMBER:number; RED:number }
  workspaceId:  string
  userRole?:    string
}) {
  const rbac = mapDbRoleToRbac(userRole)
  const lvl  = ROLE_LEVEL[rbac] ?? 0
  const can  = (p:string) => rbacCan(rbac, p as any)
  const t = useTranslations("dashboard")
  const quickActions = [
    { href:'/my-tasks',  label:t('myTasks'),       icon:'✔',  show:true },
    { href:'/projects',  label:t('newProject'),    icon:'＋', show:can('projects:create') },
    { href:'/intake',    label:t('submitIdea'), icon:'💡', show:lvl > 5 },
    { href:'/executive', label:t('executiveView'), icon:'👔', show:can('projects:view_all') },
  ].filter(a => a.show)

  const [methodFilter, setMethodFilter] = useState<string>('ALL')
  const methodCounts = projects.reduce((acc:any, p:any) => { acc[p.methodology] = (acc[p.methodology]||0)+1; return acc }, {})
  const methodChips = ['ALL','WATERFALL','AGILE','SCRUM'].filter(m => m==='ALL' || methodCounts[m])
  const shownProjects = methodFilter==='ALL' ? projects : projects.filter((p:any) => p.methodology===methodFilter)
  const totalBudget = projects.reduce((s,p) => s + Number(p.budgetTotal||0), 0)
  const totalSpent  = projects.reduce((s,p) => s + Number(p.budgetSpent||0), 0)
  const avgComplete = projects.length
    ? Math.round(projects.reduce((s,p) => s + Number(p.percentComplete||0), 0) / projects.length)
    : 0

  // Panel style shared across cards
  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:20 }}>

      {/* Welcome banner (shown after onboarding) */}
      <WelcomeBanner workspaceName="your workspace" />

      {/* ── Quick actions (role-aware launchpad) ── */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {quickActions.map(a => (
          <Link key={a.href} href={a.href}
            style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 16px',
              background: a.label==='New Project' ? 'var(--steel)' : '#fff',
              color: a.label==='New Project' ? '#fff' : 'var(--text-2)',
              border:'1px solid ' + (a.label==='New Project' ? 'var(--steel)' : 'var(--border)'),
              borderRadius:'var(--radius)', textDecoration:'none', fontSize:13, fontWeight:500,
              fontFamily:'var(--font)' }}>
            <span style={{ fontSize:14 }}>{a.icon}</span> {a.label}
          </Link>
        ))}
        <button onClick={async () => {
            const btn = document.getElementById("deck-btn-dash") as HTMLButtonElement | null
            if (btn) { btn.disabled = true; btn.textContent = "Building…" }
            try {
              const res = await fetch(`/api/workspace/export-pptx`, {
                method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
                body: JSON.stringify({ flavor:"DASHBOARD" }),
              })
              if (!res.ok) { alert("Deck generation failed"); return }
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a"); a.href = url; a.download = "Portfolio_Dashboard_Deck.pptx"; a.click()
              URL.revokeObjectURL(url)
            } finally { if (btn) { btn.disabled = false; btn.textContent = t("deck") } }
          }}
          id="deck-btn-dash"
          style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 16px',
            background:'#fff', color:'var(--text-2)', border:'1px solid var(--border)',
            borderRadius:'var(--radius)', fontSize:13, fontWeight:500, cursor:'pointer',
            fontFamily:'var(--font)' }}>
          🎬 Deck
        </button>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:t('Active projects'), value:projects.length, sub:`${healthCounts.RED} ${t('at risk')}`,
            subColor: healthCounts.RED > 0 ? 'var(--red)' : 'var(--text-3)', icon:'📁' },
          { label:t('Overall completion'), value:`${avgComplete}%`,
            sub: projects.length===1 ? t('project progress') : t('across all projects'),
            hint:'Simple average of each project\u2019s % complete', subColor:'var(--text-3)', icon:'📊' },
          { label:t('Total budget'), value:fmtCurrency(totalBudget), sub:`${fmtCurrency(totalSpent)} ${t('spent')}`,
            hint: totalBudget>0 ? `${Math.round((totalSpent/totalBudget)*100)}% of budget spent` : undefined,
            subColor: totalBudget > 0 && totalSpent/totalBudget > .9 ? 'var(--red)' : 'var(--text-3)', icon:'💰' },
          { label:t('Open high risks'), value:risks.length, sub:t('score ≥ 9'),
            hint:'Risks with probability × impact score of 9 or higher',
            subColor: risks.length > 0 ? 'var(--amber)' : 'var(--text-3)', icon:'⚠' },
        ].map((kpi:any) => (
          <div key={kpi.label} title={kpi.hint || undefined} style={{ ...card, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>{kpi.icon}</span>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:500,
                textTransform:'uppercase', letterSpacing:'.05em' }}>
                {kpi.label}
              </span>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color:'var(--text)', lineHeight:1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize:11, color:kpi.subColor, marginTop:4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Health strip ── */}
      <div style={{ ...card, padding:'12px 16px', marginBottom:16,
        display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-2)' }}>
          {projects.length === 1 ? t('Project health') : t('Portfolio health')}
        </span>
        {[
          { key:'GREEN', label:'On track' },
          { key:'AMBER', label:'At risk'  },
          { key:'RED',   label:'Off track'},
        ].map(h => (
          <div key={h.key} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:healthColor(h.key) }}/>
            <span style={{ fontSize:13, fontWeight:600, color:healthColor(h.key) }}>
              {healthCounts[h.key as 'GREEN'|'AMBER'|'RED']}
            </span>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>{h.label}</span>
          </div>
        ))}
        <div style={{ marginLeft:'auto' }}
          title={`${healthCounts.GREEN} on track · ${healthCounts.AMBER} at risk · ${healthCounts.RED} off track`}>
          <div style={{ height:6, width:200, background:'var(--border)', borderRadius:3,
            overflow:'hidden', display:'flex' }}>
            {['GREEN','AMBER','RED'].map(h => {
              const count = healthCounts[h as 'GREEN'|'AMBER'|'RED']
              const pct   = projects.length ? (count/projects.length)*100 : 0
              return pct > 0 ? (
                <div key={h} style={{ width:`${pct}%`, background:healthColor(h), transition:'width .5s' }}/>
              ) : null
            })}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>

        {/* Projects table */}
        <div style={card}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t('activeProjectsSection')}</span>
            <Link href="/projects" style={{ fontSize:12, color:'var(--steel)', textDecoration:'none' }}>
              {t('View all')} →
            </Link>
          </div>
          {methodChips.length > 2 && (
            <div style={{ display:'flex', gap:6, padding:'8px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
              {methodChips.map(m => (
                <button key={m} onClick={()=>setMethodFilter(m)}
                  style={{ padding:'3px 10px', fontSize:11, borderRadius:12, cursor:'pointer', fontFamily:'var(--font)',
                    border:'1px solid ' + (methodFilter===m ? 'var(--steel)' : 'var(--border)'),
                    background: methodFilter===m ? 'var(--steel)' : '#fff',
                    color: methodFilter===m ? '#fff' : 'var(--text-3)' }}>
                  {m==='ALL' ? 'All' : m.charAt(0)+m.slice(1).toLowerCase()}{m!=='ALL' ? ` ${methodCounts[m]}` : ''}
                </button>
              ))}
            </div>
          )}
          {projects.length === 0 ? (
            <div style={{ padding:'32px 20px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📁</div>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--text)', marginBottom:6 }}>
                No projects yet
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>
                Create your first project or install a template to get started.
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <Link href="/templates" style={{ padding:'7px 14px', border:'1px solid var(--border)',
                  borderRadius:'var(--radius)', fontSize:12, color:'var(--text-2)', textDecoration:'none' }}>
                  Browse templates
                </Link>
                <Link href="/projects" style={{ padding:'7px 14px', background:'var(--steel)',
                  borderRadius:'var(--radius)', fontSize:12, color:'#fff', textDecoration:'none',
                  fontWeight:500 }}>
                  + New project
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 90px 80px 70px',
                gap:10, padding:'7px 16px',
                fontSize:10, fontWeight:600, color:'var(--text-3)',
                letterSpacing:'.05em', textTransform:'uppercase',
                borderBottom:'1px solid var(--surface-1,#F1F5F9)' }}>
                <div/>
                <div>Project</div>
                <div>Progress</div>
                <div>Budget</div>
                <div>Health</div>
              </div>
              {shownProjects.slice(0, 8).map(p => {
                const budgetPct = Number(p.budgetTotal) > 0
                  ? Math.round(Number(p.budgetSpent) / Number(p.budgetTotal) * 100)
                  : 0
                const pm = p.members?.[0]?.user
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    style={{ display:'grid', gridTemplateColumns:'auto 1fr 90px 80px 70px',
                      gap:10, padding:'10px 16px', alignItems:'center', textDecoration:'none',
                      borderBottom:'1px solid var(--surface-1,#F1F5F9)',
                      transition:'background .1s' }}
                    onMouseOver={e => (e.currentTarget.style.background='var(--surface)')}
                    onMouseOut={e  => (e.currentTarget.style.background='transparent')}
                  >
                    <div style={{ width:8, height:8, borderRadius:'50%',
                      background:healthColor(p.health), flexShrink:0 }}/>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--text)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>
                        {p.code} · {p.methodology}
                        {pm && ` · ${pm.name.split(' ')[0]}`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:3 }}>
                        {p.percentComplete}%
                      </div>
                      <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${p.percentComplete}%`,
                          background:healthColor(p.health), borderRadius:3 }}/>
                      </div>
                    </div>
                    <div style={{ fontSize:11,
                      color: budgetPct > 90 ? 'var(--red)' : budgetPct > 75 ? 'var(--amber)' : 'var(--text-3)' }}>
                      {budgetPct}% spent
                    </div>
                    <div>
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px',
                        borderRadius:4, background:healthBg(p.health), color:healthColor(p.health) }}>
                        {healthLabel(p.health)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Upcoming milestones */}
          <div style={card}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)',
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t('milestones30')}</span>
              <span style={{ fontSize:20 }}>🎯</span>
            </div>
            {milestones.length === 0 ? (
              <div style={{ padding:'20px 14px', textAlign:'center',
                fontSize:12, color:'var(--text-3)' }}>
                {t('No milestones in the next 30 days')}
              </div>
            ) : (
              <div>
                {milestones.slice(0, 5).map(m => {
                  const days = daysUntil(m.dueDate)
                  return (
                    <Link key={m.id} href={`/projects/${m.projectId}`}
                      style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px',
                        borderBottom:'1px solid var(--surface-1,#F1F5F9)', textDecoration:'none',
                        transition:'background .1s' }}
                      onMouseOver={e => (e.currentTarget.style.background='var(--surface)')}
                      onMouseOut={e  => (e.currentTarget.style.background='transparent')}
                    >
                      <span style={{ fontSize:12 }}>◇</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--text)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>
                          {m.project?.name}
                        </div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, flexShrink:0,
                        color: days <= 3 ? 'var(--red)' : days <= 7 ? 'var(--amber)' : 'var(--text-3)' }}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* High risks */}
          <div style={card}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)',
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t('highScoreRisks')}</span>
              <span style={{ fontSize:20 }}>⚠️</span>
            </div>
            {risks.length === 0 ? (
              <div style={{ padding:'20px 14px', textAlign:'center',
                fontSize:12, color:'var(--text-3)' }}>
                No high-score open risks
              </div>
            ) : (
              <div>
                {risks.slice(0, 5).map(r => (
                  <Link key={r.id} href={`/projects/${r.projectId}/risks`}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
                      borderBottom:'1px solid var(--surface-1,#F1F5F9)', textDecoration:'none',
                      transition:'background .1s' }}
                    onMouseOver={e => (e.currentTarget.style.background='var(--surface)')}
                    onMouseOut={e  => (e.currentTarget.style.background='transparent')}
                  >
                    <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                      background: r.score >= 15 ? 'var(--red-pale,#FEF2F2)' : '#FFFBEB',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700,
                      color: r.score >= 15 ? 'var(--red)' : 'var(--amber)' }}>
                      {r.score}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>
                        {r.project?.name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div style={card}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t('recentActivity')}</span>
          <Link href="/settings/security" style={{ fontSize:12, color:'var(--steel)', textDecoration:'none' }}>
            Audit log →
          </Link>
        </div>
        {activity.length === 0 ? (
          <div style={{ padding:'24px 16px', textAlign:'center', fontSize:12, color:'var(--text-3)' }}>
            No recent activity
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))' }}>
            {activity.slice(0, 6).map((a, i) => (
              <div key={a.id} style={{ padding:'10px 16px',
                borderBottom: i < activity.length - 1 ? '1px solid var(--surface-1,#F1F5F9)' : 'none',
                borderRight: i % 2 === 0 ? '1px solid var(--surface-1,#F1F5F9)' : 'none',
                display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0,
                  background:'linear-gradient(135deg,var(--steel),var(--steel-2,#2481C8))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, fontWeight:700, color:'#fff' }}>
                  {(a.user?.name || 'S').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5 }}>
                    <strong>{a.user?.name || 'System'}</strong>{' '}
                    {a.action.replace('.',' ').replace('_',' ')}
                  </div>
                  <div suppressHydrationWarning style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                    {new Date(a.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
