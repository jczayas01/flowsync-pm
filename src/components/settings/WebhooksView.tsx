"use client"
// src/components/settings/WebhooksView.tsx
import { useState } from "react"
import { Badge, EmptyState } from "@/components/ui"

const WEBHOOK_EVENTS = [
  { id:"project.created",      label:"Project created",         category:"Projects" },
  { id:"project.updated",      label:"Project updated",         category:"Projects" },
  { id:"project.health_changed",label:"Project health changed", category:"Projects" },
  { id:"task.created",         label:"Task created",            category:"Tasks" },
  { id:"task.status_changed",  label:"Task status changed",     category:"Tasks" },
  { id:"task.overdue",         label:"Task overdue",            category:"Tasks" },
  { id:"milestone.approaching",label:"Milestone approaching",   category:"Milestones" },
  { id:"milestone.completed",  label:"Milestone completed",     category:"Milestones" },
  { id:"risk.created",         label:"Risk logged",             category:"Risks" },
  { id:"risk.score_high",      label:"High-score risk detected",category:"Risks" },
  { id:"member.invited",       label:"Team member invited",     category:"Team" },
  { id:"invoice.sent",         label:"Invoice sent",            category:"Billing" },
  { id:"invoice.paid",         label:"Invoice paid",            category:"Billing" },
]

interface Webhook { id:string; url:string; events:string[]; isActive:boolean; secret:string; createdAt:string; lastTriggeredAt?:string; successCount:number; errorCount:number }

export function WebhooksView({ webhooks:initialWebhooks, workspaceId, role }:{
  webhooks:any[]; workspaceId:string; role:string
}) {
  const canEdit = ["SUPER_ADMIN","OWNER","ADMIN"].includes(role)
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState({ url:"", events:[] as string[] })
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState("")
  const [testing, setTesting]   = useState<string|null>(null)
  const [showSecret, setShowSecret] = useState<string|null>(null)

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000) }

  function toggleEvent(eventId:string) {
    setForm(f=>({
      ...f,
      events: f.events.includes(eventId)
        ? f.events.filter(e=>e!==eventId)
        : [...f.events, eventId]
    }))
  }

  async function createWebhook(e:React.FormEvent) {
    e.preventDefault()
    if(!form.url.trim()||form.events.length===0) return
    setSaving(true)
    try {
      const res = await fetch("/api/webhooks", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ url:form.url, events:form.events })
      })
      if(!res.ok){ const e2=await res.json().catch(()=>({})); throw new Error(e2.error||"Create failed") }
      const { data } = await res.json()
      const newWebhook:Webhook = { ...data.webhook, secret:data.secret }
      setWebhooks(w=>[...w,newWebhook])
      showToast("✓ Webhook created — save your secret, it won't be shown again")
      setShowSecret(newWebhook.id)
      setCreating(false)
      setForm({url:"",events:[]})
    } catch(err:any){ showToast("✗ "+(err.message||"Failed to create webhook")) }
    finally { setSaving(false) }
  }

  async function deleteWebhook(id:string) {
    if(!confirm("Delete this webhook? Events will stop being sent immediately.")) return
    const res = await fetch(`/api/webhooks/${id}`, { method:"DELETE" })
    if(res.ok){ setWebhooks(w=>w.filter(wh=>wh.id!==id)); showToast("Webhook deleted") }
    else showToast("✗ Delete failed")
  }

  async function testWebhook(id:string) {
    setTesting(id)
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method:"POST" })
      const { data } = await res.json()
      if(data?.delivered) showToast(`✓ Test delivered (HTTP ${data.status})`)
      else showToast(`✗ ${data?.error||"Delivery failed"}`)
      setWebhooks(w=>w.map(wh=>wh.id===id?{...wh, lastTriggeredAt:new Date().toISOString(),
        ...(data?.delivered?{successCount:(wh.successCount||0)+1}:{errorCount:(wh.errorCount||0)+1})}:wh))
    } catch { showToast("✗ Test failed") }
    finally { setTesting(null) }
  }

  async function toggleWebhook(id:string) {
    const cur = webhooks.find(w=>w.id===id); if(!cur) return
    setWebhooks(w=>w.map(wh=>wh.id===id?{...wh,isActive:!wh.isActive}:wh))
    await fetch(`/api/webhooks/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ isActive:!cur.isActive }) }).catch(()=>{})
  }

  const eventsByCategory = WEBHOOK_EVENTS.reduce((acc,e)=>{
    if(!acc[e.category]) acc[e.category]=[]
    acc[e.category].push(e)
    return acc
  },{} as Record<string,typeof WEBHOOK_EVENTS>)

  return (
    <div style={{maxWidth:760,position:"relative"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:4}}>
          Webhooks & integrations
        </h2>
        <p style={{fontSize:13,color:"var(--text-3)"}}>
          Send real-time event notifications to Zapier, Make, Slack, or any HTTP endpoint.
        </p>
      </div>

      {/* Zapier / Make callout */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          { name:"Zapier", logo:"⚡", desc:"Connect to 6,000+ apps", url:"https://zapier.com" },
          { name:"Make",   logo:"🔄", desc:"Visual automation builder", url:"https://make.com" },
        ].map(p=>(
          <div key={p.name} style={{background:"#fff",border:"1px solid var(--border)",
            borderRadius:"var(--radius)",padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:24,flexShrink:0}}>{p.logo}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{p.name}</div>
              <div style={{fontSize:11,color:"var(--text-3)",marginBottom:6}}>{p.desc}</div>
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                style={{fontSize:11,color:"var(--steel)",textDecoration:"none",fontWeight:500}}>
                Connect via {p.name} →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Webhooks list */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>
          Webhooks ({webhooks.length})
        </div>
        {canEdit&&(
          <button onClick={()=>setCreating(true)}
            style={{padding:"7px 14px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            + New webhook
          </button>
        )}
      </div>

      {/* Create form */}
      {creating&&(
        <form onSubmit={createWebhook}
          style={{background:"#fff",border:"2px solid var(--steel)",borderRadius:"var(--radius)",
            padding:20,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>
            New webhook
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
              Endpoint URL *
            </label>
            <input autoFocus value={form.url}
              onChange={e=>setForm(f=>({...f,url:e.target.value}))}
              placeholder="https://hooks.zapier.com/hooks/catch/…"
              style={{width:"100%",padding:"9px 12px",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",fontSize:13,fontFamily:"var(--font)",
                color:"var(--text)",outline:"none"}} />
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:8}}>
              Events to send * ({form.events.length} selected)
            </label>
            {Object.entries(eventsByCategory).map(([cat,events])=>(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--text-3)",
                  letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>
                  {cat}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {events.map(ev=>(
                    <button key={ev.id} type="button" onClick={()=>toggleEvent(ev.id)}
                      style={{padding:"4px 10px",border:"1px solid var(--border)",borderRadius:6,
                        fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
                        background:form.events.includes(ev.id)?"var(--steel-pale,#EFF6FF)":"#fff",
                        color:form.events.includes(ev.id)?"var(--steel)":"var(--text-3)",
                        borderColor:form.events.includes(ev.id)?"var(--steel)":"var(--border)"}}>
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setCreating(false)}
              style={{padding:"8px 16px",background:"#fff",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",fontSize:13,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
              Cancel
            </button>
            <button type="submit" disabled={!form.url.trim()||form.events.length===0||saving}
              style={{padding:"8px 20px",background:"var(--steel)",color:"#fff",border:"none",
                borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",
                opacity:(!form.url.trim()||form.events.length===0)?0.5:1}}>
              {saving?"Creating…":"Create webhook"}
            </button>
          </div>
        </form>
      )}

      {webhooks.length===0&&!creating?(
        <EmptyState icon="🔗" title="No webhooks configured"
          description="Add a webhook endpoint to send real-time events to Zapier, Make, or any HTTP endpoint." />
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {webhooks.map(wh=>(
            <div key={wh.id} style={{background:"#fff",border:"1px solid var(--border)",
              borderRadius:"var(--radius)",overflow:"hidden",
              opacity:wh.isActive?1:0.6}}>
              <div style={{padding:"12px 16px",display:"flex",alignItems:"flex-start",gap:12}}>
                {/* Toggle */}
                <button onClick={()=>toggleWebhook(wh.id)}
                  style={{width:36,height:20,borderRadius:10,border:"none",cursor:"pointer",
                    position:"relative",flexShrink:0,marginTop:2,transition:"background .2s",
                    background:wh.isActive?"var(--green)":"var(--border-strong,#CBD5E1)"}}>
                  <div style={{position:"absolute",top:2,width:16,height:16,borderRadius:"50%",
                    background:"#fff",transition:"left .2s",left:wh.isActive?18:2}}/>
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontFamily:"monospace",color:"var(--text)",
                    marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {wh.url}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                    {wh.events.slice(0,5).map(e=>(
                      <span key={e} style={{fontSize:10,padding:"1px 6px",borderRadius:3,
                        background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-3)"}}>
                        {e}
                      </span>
                    ))}
                    {wh.events.length>5&&(
                      <span style={{fontSize:10,color:"var(--text-4)"}}>+{wh.events.length-5} more</span>
                    )}
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"var(--text-3)"}}>
                    <span style={{color:"var(--green)"}}>✓ {wh.successCount} sent</span>
                    {wh.errorCount>0&&<span style={{color:"var(--red)"}}>✗ {wh.errorCount} errors</span>}
                    {wh.lastTriggeredAt&&(
                      <span>Last triggered {new Date(wh.lastTriggeredAt).toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })}</span>
                    )}
                  </div>
                  {showSecret===wh.id&&(
                    <div style={{marginTop:8,background:"#FFFBEB",border:"1px solid #FDE68A",
                      borderRadius:6,padding:"8px 12px",fontSize:11}}>
                      <strong style={{color:"#92400E"}}>Signing secret (save this now — shown once):</strong><br/>
                      <code style={{fontFamily:"monospace",color:"#92400E",fontSize:12}}>{wh.secret}</code>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>testWebhook(wh.id)} disabled={testing===wh.id}
                    style={{padding:"5px 10px",background:"var(--surface)",border:"1px solid var(--border)",
                      borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
                    {testing===wh.id?"Sending…":"Test"}
                  </button>
                  {canEdit&&(
                    <button onClick={()=>deleteWebhook(wh.id)}
                      style={{padding:"5px 10px",background:"none",border:"1px solid var(--border)",
                        borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",
                        color:"var(--text-3)",transition:"all .15s"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor="var(--red)";e.currentTarget.style.color="var(--red)"}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)"}}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          background:"var(--navy,#0D1B2A)",color:"#fff",padding:"10px 20px",borderRadius:9,
          fontSize:13,zIndex:999,boxShadow:"0 8px 24px rgba(0,0,0,.25)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
    </div>
  )
}
