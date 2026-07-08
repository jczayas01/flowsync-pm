// src/components/onboarding/OnboardingWizard.tsx
"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────
type Step = 'workspace' | 'methodology' | 'project' | 'team'

interface FormData {
  // Step 1
  workspaceName: string
  timezone:      string
  currency:      string
  // Step 2
  methodology: 'WATERFALL' | 'AGILE' | 'SCRUM' | ''
  // Step 3
  projectName: string
  startDate:   string
  templateId:  string
  // Step 4
  invites: { email: string; role: string }[]
}

const STEPS: Step[] = ['workspace', 'methodology', 'project', 'team']

const STEP_META = {
  workspace:   { num: 1, label: 'Workspace',   icon: '🏢' },
  methodology: { num: 2, label: 'Methodology', icon: '⚙️' },
  project:     { num: 3, label: 'First project', icon: '📁' },
  team:        { num: 4, label: 'Invite team',   icon: '👥' },
}

const TIMEZONES = [
  'America/Puerto_Rico', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Phoenix',
  'Europe/London', 'Europe/Madrid', 'UTC',
]

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
]

const ROLES = [
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'TEAM_MEMBER',     label: 'Team Member'     },
  { value: 'READ_ONLY',       label: 'Read-Only'       },
  { value: 'CLIENT',          label: 'Client / External' },
]

const METHODOLOGIES = [
  {
    id: 'WATERFALL',
    icon: '📋',
    name: 'Waterfall',
    tagline: 'Sequential phases with approval gates',
    desc: 'Best for projects with defined scope, fixed budgets, and regulatory requirements. Common in construction, ERP deployments, and regulated programs.',
    features: ['Phase-gate approvals', 'Baseline management', 'Full Gantt scheduling', 'EVM budget tracking'],
    color: '#1B6CA8',
    bg: '#EFF6FF',
  },
  {
    id: 'AGILE',
    icon: '🔄',
    name: 'Agile',
    tagline: 'Iterative delivery with continuous feedback',
    desc: 'Best for projects where requirements evolve. Work in sprints, deliver incrementally, and respond to change without losing control of scope.',
    features: ['Sprint planning board', 'Backlog management', 'Velocity tracking', 'Burndown charts'],
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'SCRUM',
    icon: '🏃',
    name: 'Scrum',
    tagline: 'Full Scrum framework with all ceremonies',
    desc: 'Full Scrum implementation — daily standups, sprint reviews, retrospectives, definition of done, and story point estimation built in.',
    features: ['Full ceremony support', 'Story point estimation', 'Sprint retrospectives', 'Velocity & capacity'],
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
]

const TEMPLATES = [
  {
    id: 'system-implementation',
    icon: '🧩',
    name: 'System Implementation',
    desc: '36-week Waterfall · 5 phases · compliance checkpoints',
    methodology: 'WATERFALL',
    color: '#059669',
  },
  {
    id: 'software-dev-scrum',
    icon: '🏃',
    name: 'Software Development (Scrum)',
    desc: '12-week Scrum · Backlog · Sprint board · DoD',
    methodology: 'SCRUM',
    color: '#7C3AED',
  },
  {
    id: 'cloud-migration',
    icon: '☁️',
    name: 'Cloud Migration (AWS/Azure)',
    desc: '24-week Waterfall · Discovery → Cutover',
    methodology: 'WATERFALL',
    color: '#0891B2',
  },
  {
    id: 'regulatory-compliance',
    icon: '🔒',
    name: 'Compliance Program',
    desc: '16-week · Risk analysis · Policy library',
    methodology: 'WATERFALL',
    color: '#DC2626',
  },
  {
    id: 'saas-product-launch',
    icon: '🚀',
    name: 'SaaS Product Launch',
    desc: '24-week Scrum · MVP → Beta → Launch',
    methodology: 'SCRUM',
    color: '#7C3AED',
  },
  {
    id: 'web-platform',
    icon: '📱',
    name: 'Web Platform Launch',
    desc: '20-week Agile · integrations · accessibility standards',
    methodology: 'AGILE',
    color: '#1B6CA8',
  },
]

// ─── Main component ───────────────────────────
export function OnboardingWizard({ userId, userName, userEmail = '' }: {
  userId:    string
  userEmail: string
  userName: string
}) {
  const router  = useRouter()
  const [step, setStep]       = useState<Step>('workspace')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [animating, setAnimating] = useState(false)
  const [form, setForm] = useState<FormData>({
    workspaceName: '',
    timezone:      'America/Puerto_Rico',
    currency:      'USD',
    methodology:   '',
    projectName:   '',
    startDate:     new Date().toISOString().split('T')[0],
    templateId:    '',
    invites:       [{ email: '', role: 'TEAM_MEMBER' }],
  })

  const stepIdx    = STEPS.indexOf(step)
  const firstName  = userName.split(' ')[0] || 'there'

  // Validate current step before advancing
  function canAdvance(): boolean {
    if (step === 'workspace')   return form.workspaceName.trim().length >= 2
    if (step === 'methodology') return form.methodology !== ''
    if (step === 'project')     return true  // project name optional
    return true
  }

  function advance() {
    if (!canAdvance()) return
    const next = STEPS[stepIdx + 1]
    if (!next) { finish(); return }
    setAnimating(true)
    setTimeout(() => { setStep(next); setAnimating(false) }, 220)
    setError('')
  }

  function back() {
    const prev = STEPS[stepIdx - 1]
    if (!prev) return
    setAnimating(true)
    setTimeout(() => { setStep(prev); setAnimating(false) }, 220)
    setError('')
  }

  function addInvite() {
    setForm(f => ({ ...f, invites: [...f.invites, { email: '', role: 'TEAM_MEMBER' }] }))
  }

  function removeInvite(i: number) {
    setForm(f => ({ ...f, invites: f.invites.filter((_, idx) => idx !== i) }))
  }

  function updateInvite(i: number, field: 'email' | 'role', value: string) {
    setForm(f => {
      const invites = [...f.invites]
      invites[i] = { ...invites[i], [field]: value }
      return { ...f, invites }
    })
  }

  // Filter templates to match selected methodology
  const relevantTemplates = form.methodology
    ? TEMPLATES.filter(t => t.methodology === form.methodology)
    : TEMPLATES

  async function finish() {
    setLoading(true)
    setError('')
    try {
      // 1. Create or update workspace
      let ws = null
      try {
        const wsRes = await fetch('/api/workspace', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     form.workspaceName.trim(),
            timezone: form.timezone,
            currency: form.currency,
          }),
        })
        if (wsRes.ok) {
          const d = await wsRes.json()
          ws = d.data
        } else {
          // Workspace already exists — update it
          await fetch('/api/workspace', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name:     form.workspaceName.trim(),
              timezone: form.timezone,
              currency: form.currency,
            }),
          }).catch(() => null)
        }
      } catch { /* continue even if workspace step fails */ }

      // 2. Create first project (if name provided or template selected)
      if (form.projectName.trim() || form.templateId) {
        const projRes = await fetch('/api/projects', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:        form.projectName.trim() || 'My First Project',
            methodology: form.methodology || 'WATERFALL',
            startDate:   form.startDate,
            templateId:  form.templateId || undefined,
          }),
        })
        if (!projRes.ok) {
          console.warn('[Onboarding] Project creation failed — continuing')
        }
      }

      // 3. Send invitations (ignore failures)
      const validInvites = form.invites.filter(i => i.email.trim().includes('@'))
      if (validInvites.length) {
        await Promise.allSettled(validInvites.map(inv =>
          fetch('/api/users', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: inv.email.trim(), role: inv.role }),
          })
        ))
      }

      router.push('/dashboard?onboarding=complete')
    } catch (e: any) {
      setError(e.message || 'Setup failed. Please try again.')
      setLoading(false)
    }
  }

  // ─── Shared styles ─────────────────────────
  const s = {
    input: {
      width: '100%', padding: '11px 14px',
      background: 'rgba(255,255,255,.07)',
      border: '1.5px solid rgba(255,255,255,.14)',
      borderRadius: 8, color: '#fff', fontSize: 14,
      fontFamily: 'var(--font)', outline: 'none',
      transition: 'border-color .15s',
    } as React.CSSProperties,
    select: {
      width: '100%', padding: '11px 14px',
      background: 'rgba(255,255,255,.07)',
      border: '1.5px solid rgba(255,255,255,.14)',
      borderRadius: 8, color: '#fff', fontSize: 14,
      fontFamily: 'var(--font)', outline: 'none',
      appearance: 'none' as const,
    } as React.CSSProperties,
    label: {
      display: 'block', fontSize: 12, fontWeight: 500,
      color: 'rgba(255,255,255,.55)', marginBottom: 6,
    } as React.CSSProperties,
    btnPrimary: {
      flex: 2, padding: '13px 20px',
      background: canAdvance() ? 'var(--steel)' : 'rgba(255,255,255,.1)',
      color: canAdvance() ? '#fff' : 'rgba(255,255,255,.3)',
      border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600,
      cursor: canAdvance() ? 'pointer' : 'not-allowed',
      fontFamily: 'var(--font)', transition: 'all .15s',
    } as React.CSSProperties,
    btnBack: {
      flex: 1, padding: '13px 16px',
      background: 'rgba(255,255,255,.07)',
      border: '1px solid rgba(255,255,255,.12)',
      borderRadius: 9, color: 'rgba(255,255,255,.5)',
      fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)',
    } as React.CSSProperties,
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'var(--font)',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* ── Logo ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
          gap:9, marginBottom:36 }}>
          <div style={{ width:30,height:30,background:'var(--steel)',borderRadius:8,position:'relative' }}>
            <div style={{ position:'absolute',width:14,height:2.5,background:'#fff',top:8,left:8,borderRadius:2 }}/>
            <div style={{ position:'absolute',width:9,height:2.5,background:'var(--amber)',top:13,left:8,borderRadius:2 }}/>
          </div>
          <span style={{ fontWeight:700,fontSize:15,color:'#fff' }}>
            FlowSync <span style={{ color:'var(--amber)' }}>PM</span>
          </span>
        </div>

        {/* ── Step progress ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= stepIdx
                  ? i === stepIdx ? 'var(--steel)' : 'rgba(27,108,168,.4)'
                  : 'rgba(255,255,255,.08)',
                transition: 'background .3s',
              }}/>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{
                fontSize:10, fontWeight:600, letterSpacing:'.05em',
                textTransform:'uppercase',
                color: i === stepIdx ? 'var(--steel)'
                  : i < stepIdx ? 'rgba(255,255,255,.3)'
                  : 'rgba(255,255,255,.15)',
                transition: 'color .3s',
                flex:1, textAlign: i===0?'left':i===STEPS.length-1?'right':'center',
              }}>
                {STEP_META[s].label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.09)',
          borderRadius: 14, padding: 32,
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(8px)' : 'none',
          transition: 'opacity .2s ease, transform .2s ease',
        }}>

          {error && (
            <div style={{
              background:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.3)',
              color:'#FCA5A5', padding:'10px 14px', borderRadius:8,
              fontSize:13, marginBottom:20,
            }}>
              {error}
            </div>
          )}

          {/* ════════════════════════
              STEP 1: WORKSPACE
          ════════════════════════ */}
          {step === 'workspace' && (
            <>
              <div style={{ marginBottom:24 }}>
                <h2 style={{ fontSize:22,fontWeight:600,color:'#fff',marginBottom:6 }}>
                  Welcome, {firstName}! 👋
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  Let's set up your workspace. This is where all your projects, team members, and data will live.
                </p>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={s.label}>Organization name <span style={{ color:'var(--amber)' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp, Global Retail Inc., Tech Startup Ltd."
                  value={form.workspaceName}
                  onChange={e => setForm(f => ({ ...f, workspaceName: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && advance()}
                  autoFocus
                  style={s.input}
                />
                {form.workspaceName.trim().length > 0 && form.workspaceName.trim().length < 2 && (
                  <div style={{ fontSize:11,color:'rgba(220,38,38,.8)',marginTop:4 }}>
                    At least 2 characters required
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
                <div>
                  <label style={s.label}>Timezone</label>
                  <div style={{ position:'relative' }}>
                    <select
                      value={form.timezone}
                      onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                      style={s.select}
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz} style={{ background:'#1a2d40' }}>{tz}</option>
                      ))}
                    </select>
                    <span style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                      pointerEvents:'none',color:'rgba(255,255,255,.35)',fontSize:10 }}>▾</span>
                  </div>
                </div>
                <div>
                  <label style={s.label}>Currency</label>
                  <div style={{ position:'relative' }}>
                    <select
                      value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      style={s.select}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code} style={{ background:'#1a2d40' }}>{c.label}</option>
                      ))}
                    </select>
                    <span style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                      pointerEvents:'none',color:'rgba(255,255,255,.35)',fontSize:10 }}>▾</span>
                  </div>
                </div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button
                  style={{ ...s.btnPrimary, flex:1 }}
                  onClick={advance}
                  disabled={!canAdvance()}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ════════════════════════
              STEP 2: METHODOLOGY
          ════════════════════════ */}
          {step === 'methodology' && (
            <>
              <div style={{ marginBottom:24 }}>
                <h2 style={{ fontSize:22,fontWeight:600,color:'#fff',marginBottom:6 }}>
                  How does your team work?
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  Choose your primary methodology. You can use all three in FlowSync PM — this just sets the default for new projects.
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
                {METHODOLOGIES.map(m => {
                  const selected = form.methodology === m.id
                  return (
                    <div
                      key={m.id}
                      onClick={() => setForm(f => ({ ...f, methodology: m.id as any }))}
                      style={{
                        padding:'16px 18px', borderRadius:10, cursor:'pointer',
                        border: selected
                          ? `2px solid ${m.color}`
                          : '1.5px solid rgba(255,255,255,.09)',
                        background: selected
                          ? `${m.color}18`
                          : 'rgba(255,255,255,.03)',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <span style={{ fontSize:26, flexShrink:0, marginTop:1 }}>{m.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                            <span style={{ fontSize:15,fontWeight:600,color:selected ? '#fff':'rgba(255,255,255,.85)' }}>
                              {m.name}
                            </span>
                            {selected && (
                              <span style={{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:4,
                                background:m.color,color:'#fff' }}>Selected</span>
                            )}
                          </div>
                          <div style={{ fontSize:12,color:selected?`${m.color.replace('#','rgba(')},.9)`:
                            'rgba(255,255,255,.4)',fontWeight:500,marginBottom:6 }}>
                            {m.tagline}
                          </div>
                          <p style={{ fontSize:12,color:'rgba(255,255,255,.4)',lineHeight:1.6,marginBottom:8 }}>
                            {m.desc}
                          </p>
                          {selected && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                              {m.features.map(f => (
                                <span key={f} style={{ fontSize:10,fontWeight:600,padding:'2px 8px',
                                  borderRadius:4,background:`${m.color}25`,color:m.color }}>
                                  ✓ {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button
                  style={s.btnPrimary}
                  onClick={advance}
                  disabled={!canAdvance()}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ════════════════════════
              STEP 3: FIRST PROJECT
          ════════════════════════ */}
          {step === 'project' && (
            <>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontSize:22,fontWeight:600,color:'#fff',marginBottom:6 }}>
                  Create your first project
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  Start from scratch or use a template to get a pre-built structure immediately.
                </p>
              </div>

              <div style={{ marginBottom:12 }}>
                <label style={s.label}>Project name</label>
                <input
                  type="text"
                  placeholder="e.g. CRM Migration, Office Expansion, Product Launch 2026"
                  value={form.projectName}
                  onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))}
                  autoFocus
                  style={s.input}
                />
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={s.label}>Target start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  style={s.input}
                />
              </div>

              {/* Template picker */}
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  marginBottom:10 }}>
                  <label style={{ ...s.label, marginBottom:0 }}>
                    Start from a template
                    <span style={{ fontSize:10,color:'rgba(255,255,255,.3)',fontWeight:400,marginLeft:6 }}>
                      optional
                    </span>
                  </label>
                  {form.templateId && (
                    <button
                      onClick={() => setForm(f => ({ ...f, templateId:'' }))}
                      style={{ fontSize:11,color:'rgba(255,255,255,.35)',background:'none',
                        border:'none',cursor:'pointer',fontFamily:'var(--font)' }}
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {relevantTemplates.slice(0,4).map(t => {
                    const selected = form.templateId === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => setForm(f => ({
                          ...f,
                          templateId:  f.templateId === t.id ? '' : t.id,
                          projectName: f.projectName || t.name,
                        }))}
                        style={{
                          padding:'12px 13px', borderRadius:8, cursor:'pointer',
                          border: selected ? `2px solid ${t.color}` : '1.5px solid rgba(255,255,255,.09)',
                          background: selected ? `${t.color}18` : 'rgba(255,255,255,.03)',
                          transition:'all .15s', position:'relative',
                        }}
                      >
                        {selected && (
                          <div style={{ position:'absolute',top:7,right:8,
                            width:16,height:16,borderRadius:'50%',background:t.color,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:9,fontWeight:700,color:'#fff' }}>
                            ✓
                          </div>
                        )}
                        <div style={{ fontSize:20,marginBottom:6 }}>{t.icon}</div>
                        <div style={{ fontSize:12,fontWeight:600,
                          color:selected?'#fff':'rgba(255,255,255,.75)',marginBottom:3,
                          lineHeight:1.3 }}>
                          {t.name}
                        </div>
                        <div style={{ fontSize:10,color:'rgba(255,255,255,.35)',lineHeight:1.4 }}>
                          {t.desc}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {relevantTemplates.length === 0 && (
                  <div style={{ padding:'16px',textAlign:'center',fontSize:12,
                    color:'rgba(255,255,255,.3)',border:'1px dashed rgba(255,255,255,.1)',
                    borderRadius:8 }}>
                    No templates match your methodology — choose any below
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button style={s.btnBack} onClick={back}>← Back</button>
                <button style={s.btnPrimary} onClick={advance}>
                  {form.projectName || form.templateId ? 'Continue →' : 'Skip for now →'}
                </button>
              </div>
            </>
          )}

          {/* ════════════════════════
              STEP 4: INVITE TEAM
          ════════════════════════ */}
          {step === 'team' && (
            <>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontSize:22,fontWeight:600,color:'#fff',marginBottom:6 }}>
                  Invite your team
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  They'll receive an email invitation to join{' '}
                  <strong style={{ color:'rgba(255,255,255,.7)' }}>{form.workspaceName}</strong>.
                  You can always invite more people later.
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {form.invites.map((invite, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto',
                    gap:8, alignItems:'center' }}>
                    <input
                      type="email"
                      placeholder={`colleague@organization.com`}
                      value={invite.email}
                      onChange={e => updateInvite(i, 'email', e.target.value)}
                      style={{ ...s.input, marginBottom:0 }}
                    />
                    <div style={{ position:'relative' }}>
                      <select
                        value={invite.role}
                        onChange={e => updateInvite(i, 'role', e.target.value)}
                        style={{ ...s.select, width:'auto', paddingRight:28, fontSize:12 }}
                      >
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value} style={{ background:'#1a2d40' }}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <span style={{ position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
                        pointerEvents:'none',color:'rgba(255,255,255,.35)',fontSize:9 }}>▾</span>
                    </div>
                    {form.invites.length > 1 && (
                      <button
                        onClick={() => removeInvite(i)}
                        style={{ width:30,height:30,background:'rgba(255,255,255,.06)',
                          border:'1px solid rgba(255,255,255,.1)',borderRadius:6,
                          color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:16,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontFamily:'var(--font)',flexShrink:0 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addInvite}
                style={{ display:'flex', alignItems:'center', gap:6,
                  padding:'9px 14px', background:'rgba(255,255,255,.04)',
                  border:'1.5px dashed rgba(255,255,255,.12)', borderRadius:8,
                  color:'rgba(255,255,255,.45)', fontSize:13, cursor:'pointer',
                  fontFamily:'var(--font)', marginBottom:24, width:'100%',
                  justifyContent:'center', transition:'all .15s' }}
              >
                <span style={{ fontSize:16 }}>+</span> Add another person
              </button>

              {/* Setup summary */}
              <div style={{ background:'rgba(27,108,168,.12)', border:'1px solid rgba(27,108,168,.25)',
                borderRadius:10, padding:'14px 16px', marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em',
                  textTransform:'uppercase', color:'rgba(27,108,168,.8)', marginBottom:10 }}>
                  Your workspace summary
                </div>
                {[
                  ['🏢 Workspace',     form.workspaceName],
                  ['⚙️ Methodology',   form.methodology || '—'],
                  ['📁 First project', form.projectName || (form.templateId ? `From template` : 'None — add later')],
                  ['🌍 Timezone',      form.timezone],
                  ['💵 Currency',      form.currency],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:12, padding:'4px 0',
                    borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ color:'rgba(255,255,255,.4)' }}>{k}</span>
                    <span style={{ color:'rgba(255,255,255,.8)', fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button style={s.btnBack} onClick={back} disabled={loading}>← Back</button>
                <button
                  style={{ ...s.btnPrimary, background:'var(--amber)', color:'var(--navy)',
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.8 : 1 }}
                  onClick={finish}
                  disabled={loading}
                >
                  {loading ? (
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:14,height:14,border:'2px solid rgba(0,0,0,.2)',
                        borderTopColor:'var(--navy)',borderRadius:'50%',
                        display:'inline-block',animation:'spin .7s linear infinite' }} />
                      Setting up…
                    </span>
                  ) : (
                    form.invites.some(i => i.email.trim()) ? 'Get started →' : 'Skip & launch →'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Footer note ── */}
        <p style={{ textAlign:'center', fontSize:11,
          color:'rgba(255,255,255,.2)', marginTop:20, lineHeight:1.6 }}>
          Step {stepIdx + 1} of {STEPS.length} · Your data is encrypted and never shared.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,.25) !important; }
        input:focus { border-color: var(--steel) !important; }
        select option { background: #1a2d40; color: #fff; }
      `}</style>
    </div>
  )
}
