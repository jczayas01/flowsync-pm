"use client"
// src/components/layout/NotificationBell.tsx
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

function timeAgo(d:string) {
  const s = Math.floor((Date.now() - new Date(d).getTime())/1000)
  if (s < 60) return "just now"
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h/24); return `${days}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [items, setItems]   = useState<any[]>([])
  const [unread, setUnread] = useState(0)

  async function load() {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) { const d = await res.json(); setItems(d.items || []); setUnread(d.unread || 0) }
    } catch { /* polling: ignore transient fetch errors */ }
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])

  async function markAll() {
    setItems(is => is.map(i => ({ ...i, read:true }))); setUnread(0)
    try { await fetch("/api/notifications", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ all:true }) }) } catch { /* optimistic; ignore if mark-all fails */ }
  }
  async function openItem(it:any) {
    if (!it.read) {
      setUnread(u => Math.max(0, u-1))
      setItems(is => is.map(i => i.id===it.id ? { ...i, read:true } : i))
      fetch("/api/notifications", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: it.id }) }).catch(()=>{})
    }
    setOpen(false)
    if (it.link) router.push(it.link)
  }

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => { setOpen(o => !o); if (!open) load() }}
        title="Notifications"
        style={{ position:"relative", background:"none", border:"none", cursor:"pointer",
          fontSize:16, padding:6, color:"#CBD5E1", lineHeight:1 }}>
        🔔
        {unread > 0 && (
          <span style={{ position:"absolute", top:0, right:0, minWidth:15, height:15, padding:"0 3px",
            background:"#DC2626", color:"#fff", fontSize:9, fontWeight:700, borderRadius:8,
            display:"flex", alignItems:"center", justifyContent:"center", boxSizing:"border-box" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{ position:"fixed", inset:0, zIndex:998 }} />
          <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, width:320, maxHeight:420,
            background:"#fff", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            boxShadow:"0 8px 28px rgba(0,0,0,0.16)", zIndex:999, overflow:"hidden", display:"flex", flexDirection:"column",
            fontFamily:"var(--font)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"10px 14px", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text-1)" }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAll}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--steel)", fontFamily:"var(--font)" }}>
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ overflowY:"auto" }}>
              {items.length === 0 ? (
                <div style={{ padding:"28px 16px", textAlign:"center", fontSize:12.5, color:"var(--text-3)" }}>
                  You're all caught up.
                </div>
              ) : items.map(it => (
                <div key={it.id} onClick={() => openItem(it)}
                  style={{ display:"flex", gap:10, padding:"11px 14px", cursor:"pointer",
                    borderTop:"1px solid var(--border)", background: it.read ? "#fff" : "#EFF6FF" }}>
                  <span style={{ flexShrink:0, width:7, height:7, borderRadius:"50%", marginTop:5,
                    background: it.read ? "transparent" : "var(--steel)" }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:500, color:"var(--text-1)" }}>{it.title}</div>
                    {it.body && <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:2,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.body}</div>}
                    <div style={{ fontSize:10.5, color:"var(--text-4)", marginTop:2 }}>{timeAgo(it.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
