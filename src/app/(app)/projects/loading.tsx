export default function Loading() {
  return (
    <div style={{ padding:24, display:"flex", flexDirection:"column", gap:10 }}>
      {Array.from({length:6}).map((_,i) => (
        <div key={i} style={{ height:72, background:"var(--border)", borderRadius:"var(--radius)",
          opacity:.6, animation:"pulse 1.5s ease infinite", animationDelay:`${i*100}ms` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:.3}}`}</style>
    </div>
  )
}
