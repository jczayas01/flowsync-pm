// src/components/onboarding/OnboardingWizard.tsx
"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

// ─── Types ───────────────────────────────────
type Step = 'workspace' | 'methodology' | 'team'

interface FormData {
  // Step 1
  workspaceName: string
  timezone:      string
  currency:      string
  // Step 2
  methodology: 'WATERFALL' | 'AGILE' | 'SCRUM' | 'HYBRID' | ''
  // Step 3
  projectName: string
  startDate:   string
  templateId:  string
  // Step 4
  invites: { email: string; role: string }[]
}

const STEPS: Step[] = ['workspace', 'methodology', 'team']

const STEP_META = {
  workspace:   { num: 1, icon: '🏢' },
  methodology: { num: 2, icon: '⚙️' },
  team:        { num: 3, icon: '👥' },
}

const TIMEZONES = [
  'America/Puerto_Rico', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Phoenix',
  'Europe/London', 'Europe/Madrid', 'UTC',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'MXN']

const ROLES = ['PROJECT_MANAGER', 'TEAM_MEMBER', 'READ_ONLY', 'CLIENT']

const METHODOLOGIES = [
  { id: 'WATERFALL', icon: '📋', color: '#1B6CA8', bg: '#EFF6FF' },
  { id: 'AGILE', icon: '🔄', color: '#059669', bg: '#ECFDF5' },
  { id: 'SCRUM', icon: '🏃', color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'HYBRID', icon: '🔀', color: '#D97706', bg: '#FFFBEB' },
]

// ─── Main component ───────────────────────────
export function OnboardingWizard({ userId, userName, userEmail = '' }: {
  userId:    string
  userEmail: string
  userName: string
}) {
  const ob = useTranslations('onboarding')
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
  const firstName  = userName.split(' ')[0] || ob('there')

  // Validate current step before advancing
  function canAdvance(): boolean {
    if (step === 'workspace')   return form.workspaceName.trim().length >= 2
    if (step === 'methodology') return form.methodology !== ''
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
            name:        form.projectName.trim() || ob('My First Project'),
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
      setError(e.message || ob('setupFailed'))
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
                {ob(('step.' + s) as any)}
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
                  {ob('welcome', { name: firstName })}
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  {ob('workspaceIntro')}
                </p>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={s.label}>{ob('Organization name')} <span style={{ color:'var(--amber)' }}>*</span></label>
                <input
                  type="text"
                  placeholder={ob('orgPlaceholder')}
                  value={form.workspaceName}
                  onChange={e => setForm(f => ({ ...f, workspaceName: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && advance()}
                  autoFocus
                  style={s.input}
                />
                {form.workspaceName.trim().length > 0 && form.workspaceName.trim().length < 2 && (
                  <div style={{ fontSize:11,color:'rgba(220,38,38,.8)',marginTop:4 }}>
                    {ob('minChars')}
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
                <div>
                  <label style={s.label}>{ob('Timezone')}</label>
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
                  <label style={s.label}>{ob('Currency')}</label>
                  <div style={{ position:'relative' }}>
                    <select
                      value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      style={s.select}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c} style={{ background:'#1a2d40' }}>{ob(('cur.' + c) as any)}</option>
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
                  {ob('Continue →')}
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
                  {ob('methodologyTitle')}
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  {ob('methodologyIntro')}
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
                              {ob(('m.' + m.id) as any)}
                            </span>
                            {selected && (
                              <span style={{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:4,
                                background:m.color,color:'#fff' }}>{ob('Selected')}</span>
                            )}
                          </div>
                          <div style={{ fontSize:12,color:selected?`${m.color.replace('#','rgba(')},.9)`:
                            'rgba(255,255,255,.4)',fontWeight:500,marginBottom:6 }}>
                            {ob(('m.' + m.id + '_tagline') as any)}
                          </div>
                          <p style={{ fontSize:12,color:'rgba(255,255,255,.4)',lineHeight:1.6,marginBottom:8 }}>
                            {ob(('m.' + m.id + '_desc') as any)}
                          </p>
                          {selected && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                              {['f1','f2','f3','f4'].map(f => (
                                <span key={f} style={{ fontSize:10,fontWeight:600,padding:'2px 8px',
                                  borderRadius:4,background:`${m.color}25`,color:m.color }}>
                                  ✓ {ob(('m.' + m.id + '.' + f) as any)}
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
                <button style={s.btnBack} onClick={back}>{ob('← Back')}</button>
                <button
                  style={s.btnPrimary}
                  onClick={advance}
                  disabled={!canAdvance()}
                >
                  {ob('Continue →')}
                </button>
              </div>
            </>
          )}

          {/* ════════════════════════
              STEP 3: FIRST PROJECT
          ════════════════════════ */}
          {step === 'team' && (
            <>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontSize:22,fontWeight:600,color:'#fff',marginBottom:6 }}>
                  {ob('Invite your team')}
                </h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,.45)',lineHeight:1.65 }}>
                  {ob('teamIntroA')}{' '}
                  <strong style={{ color:'rgba(255,255,255,.7)' }}>{form.workspaceName}</strong>.{' '}
                  {ob('teamIntroB')}
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {form.invites.map((invite, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto',
                    gap:8, alignItems:'center' }}>
                    <input
                      type="email"
                      placeholder={ob('invitePlaceholder')}
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
                        {ROLES.map(rv => (
                          <option key={rv} value={rv} style={{ background:'#1a2d40' }}>
                            {ob(('role.' + rv) as any)}
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
                <span style={{ fontSize:16 }}>+</span> {ob('Add another person')}
              </button>

              {/* Setup summary */}
              <div style={{ background:'rgba(27,108,168,.12)', border:'1px solid rgba(27,108,168,.25)',
                borderRadius:10, padding:'14px 16px', marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em',
                  textTransform:'uppercase', color:'rgba(27,108,168,.8)', marginBottom:10 }}>
                  {ob('Your workspace summary')}
                </div>
                {[
                  [ob('sum_workspace'),   form.workspaceName],
                  [ob('sum_methodology'), form.methodology ? ob(('m.' + form.methodology) as any) : '—'],
                  [ob('sum_project'),     form.projectName || (form.templateId ? ob('From template') : ob('noneAddLater'))],
                  [ob('sum_timezone'),    form.timezone],
                  [ob('sum_currency'),    form.currency],
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
                <button style={s.btnBack} onClick={back} disabled={loading}>{ob('← Back')}</button>
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
                      {ob('Setting up…')}
                    </span>
                  ) : (
                    form.invites.some(i => i.email.trim()) ? ob('Get started →') : ob('Skip & launch →')
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Footer note ── */}
        <p style={{ textAlign:'center', fontSize:11,
          color:'rgba(255,255,255,.2)', marginTop:20, lineHeight:1.6 }}>
          {ob('footerNote', { n: stepIdx + 1, total: STEPS.length })}
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
