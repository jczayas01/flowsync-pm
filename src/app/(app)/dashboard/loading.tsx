// src/app/(app)/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {Array.from({length:4}).map((_,i) => (
          <div key={i} style={{ height:80, background:'var(--border)', borderRadius:'var(--radius)',
            animation:'pulse 1.5s ease infinite', opacity:.5+i*.1 }} />
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <div style={{ height:400, background:'var(--border)', borderRadius:'var(--radius)', opacity:.5 }} />
        <div style={{ height:400, background:'var(--border)', borderRadius:'var(--radius)', opacity:.5 }} />
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:.3}}`}</style>
    </div>
  )
}
