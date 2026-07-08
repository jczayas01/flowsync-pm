// src/app/500.tsx — custom 500 page
export default function ServerError() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#F8FAFC', fontFamily:'system-ui,sans-serif', padding:24 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'monospace', fontSize:72, fontWeight:700, color:'#E2E8F0', lineHeight:1, marginBottom:16 }}>500</div>
        <h1 style={{ fontSize:20, fontWeight:600, color:'#0F172A', marginBottom:8 }}>Server error</h1>
        <p style={{ fontSize:14, color:'#64748B', marginBottom:24 }}>We had a problem on our end. Please try again in a moment.</p>
        <a href="/dashboard" style={{ padding:'10px 20px', background:'#1B6CA8', color:'#fff',
          borderRadius:8, textDecoration:'none', fontSize:14, fontWeight:500 }}>
          Back to dashboard
        </a>
      </div>
    </div>
  )
}
