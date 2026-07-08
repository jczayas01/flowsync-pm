// src/components/ui/index.tsx
// Shared UI primitives used across all pages

import React from 'react'

// ── Page Header ──
export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode
}) {
  return (
    <div style={{ background:'#fff', borderBottom:'1px solid var(--border)',
      padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between',
      flexShrink:0, flexWrap:'wrap', gap:10 }}>
      <div>
        <h1 style={{ fontSize:17, fontWeight:600, color:'var(--text)', lineHeight:1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{subtitle}</p>}
      </div>
      {action && <div style={{ display:'flex', gap:8, alignItems:'center' }}>{action}</div>}
    </div>
  )
}

// ── Badge ──
export function Badge({ children, variant = 'gray' }: {
  children: React.ReactNode
  variant?: 'green'|'amber'|'red'|'blue'|'gray'|'purple'|'teal'
}) {
  const colors: Record<string, {bg:string;color:string}> = {
    green:  {bg:'var(--green-pale,#ECFDF5)',  color:'var(--green)'},
    amber:  {bg:'#FFFBEB',                     color:'#92400E'},
    red:    {bg:'var(--red-pale,#FEF2F2)',     color:'var(--red)'},
    blue:   {bg:'var(--steel-pale,#EFF6FF)',   color:'var(--steel)'},
    gray:   {bg:'var(--surface-1,#F1F5F9)',    color:'var(--text-3)'},
    purple: {bg:'#F5F3FF',                     color:'#7C3AED'},
    teal:   {bg:'#ECFEFF',                     color:'#0D9488'},
  }
  const c = colors[variant] || colors.gray
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3,
      fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5,
      background:c.bg, color:c.color, whiteSpace:'nowrap' }}>
      {children}
    </span>
  )
}

// ── Health Badge ──
export function HealthBadge({ health }: { health: 'GREEN'|'AMBER'|'RED' }) {
  const map = { GREEN:{v:'green',label:'On track'}, AMBER:{v:'amber',label:'At risk'}, RED:{v:'red',label:'Off track'} }
  const { v, label } = map[health]
  return <Badge variant={v as any}>{label}</Badge>
}

// ── Button ──
export function Button({ children, onClick, variant='primary', size='md', disabled, type='button', style }: {
  children:  React.ReactNode
  onClick?:  () => void
  variant?:  'primary'|'outline'|'ghost'|'danger'|'amber'
  size?:     'sm'|'md'|'lg'
  disabled?: boolean
  type?:     'button'|'submit'
  style?:    React.CSSProperties
}) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { background:'var(--steel)', color:'#fff', border:'none' },
    outline: { background:'#fff', color:'var(--text-2)', border:'1px solid var(--border)' },
    ghost:   { background:'transparent', color:'var(--text-3)', border:'none' },
    danger:  { background:'var(--red)', color:'#fff', border:'none' },
    amber:   { background:'var(--amber)', color:'var(--navy)', border:'none' },
  }
  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding:'5px 11px', fontSize:12 },
    md: { padding:'8px 16px', fontSize:13 },
    lg: { padding:'11px 22px', fontSize:14 },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ display:'inline-flex', alignItems:'center', gap:6, borderRadius:'var(--radius)',
        fontFamily:'var(--font)', fontWeight:500, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1, transition:'all .15s',
        ...variants[variant], ...sizes[size], ...style }}>
      {children}
    </button>
  )
}

// ── Card ──
export function Card({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', ...style }}>
      {children}
    </div>
  )
}

// ── Stat Card ──
export function StatCard({ label, value, sub, color }: {
  label:string; value:string|number; sub?:string; color?:string
}) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)',
      padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500,
        textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
        {label}
      </div>
      <div style={{ fontSize:24, fontWeight:700, color: color || 'var(--text)', lineHeight:1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ── Empty State ──
export function EmptyState({ icon, title, description, action }: {
  icon:string; title:string; description?:string; action?:React.ReactNode
}) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:6 }}>{title}</div>
      {description && (
        <div style={{ fontSize:13, color:'var(--text-3)', maxWidth:340, margin:'0 auto',
          lineHeight:1.6, marginBottom:20 }}>{description}</div>
      )}
      {action}
    </div>
  )
}

// ── Avatar ──
export function Avatar({ name, avatarUrl, size=28 }: {
  name?:string|null; avatarUrl?:string|null; size?:number
}) {
  const safeName = name && name.trim() ? name.trim() : "?"
  if (avatarUrl) {
    return <img src={avatarUrl} alt={safeName}
      style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:'linear-gradient(135deg,var(--steel),var(--steel-2))',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: Math.round(size*0.4), fontWeight:700, color:'#fff' }}>
      {safeName.slice(0,2).toUpperCase()}
    </div>
  )
}

// ── Progress Bar ──
export function ProgressBar({ value, color, height=6 }: {
  value:number; color?:string; height?:number
}) {
  const barColor = color || (value >= 90 ? 'var(--red)' : value >= 75 ? 'var(--amber)' : 'var(--steel)')
  return (
    <div style={{ height, background:'var(--border)', borderRadius:height/2, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,value)}%`,
        background:barColor, borderRadius:height/2, transition:'width .4s ease' }} />
    </div>
  )
}

// ── Spinner ──
export function Spinner({ size=20 }: { size?:number }) {
  return (
    <div style={{ width:size, height:size, border:`2px solid var(--border)`,
      borderTopColor:'var(--steel)', borderRadius:'50%',
      animation:'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
