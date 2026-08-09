"use client"
// src/components/settings/WebhooksView.tsx
import { useState } from "react"
import { useTranslations } from "next-intl"
import { dateLocale } from "@/lib/date-locale"
import { Badge, EmptyState } from "@/components/ui"

const WEBHOOK_EVENTS = [
  { id:"project.created",       category:"Projects" },
  { id:"project.updated",       category:"Projects" },
  { id:"project.health_changed",category:"Projects" },
  { id:"task.created",          category:"Tasks" },
  { id:"task.status_changed",   category:"Tasks" },
  { id:"task.overdue",          category:"Tasks" },
  { id:"milestone.approaching", category:"Milestones" },
  { id:"milestone.completed",   category:"Milestones" },
  { id:"risk.created",          category:"Risks" },
  { id:"risk.score_high",       category:"Risks" },
  { id:"member.invited",        category:"Team" },
  { id:"invoice.sent",          category:"Billing" },
  { id:"invoice.paid",          category:"Billing" },
]
const CAT_KEY: Record<string,string> = {
  Projects:"catProjects", Tasks:"catTasks", Milestones:"catMilestones",
  Risks:"catRisks", Team:"catTeam", Billing:"catBilling",
}

interface Webhook { id:string; url:string; events:string[]; isActive:boolean; secret:string; createdAt:string; lastTriggeredAt?:string; successCount:number; errorCount:number }

export function WebhooksView({ webhooks:initialWebhooks, workspaceId, role }:{
  webhooks:any[]; workspaceId:string; role:string
}) {
  const wh_ = useTranslations("webhooks")
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
      if(!res.ok){ const e2=await res.json().catch(()=>({})); throw new Error(e2.error||wh_("errCreate")) }
      const { data } = await res.json()
      const newWebhook:Webhook = { ...data.webhook, secret:data.secret }
      setWebhooks(w=>[...w,newWebhook])
      showToast(wh_("toastCreated"))
      setShowSecret(newWebhook.id)
      setCreating(false)
      setForm({url:"",events:[]})
    } catch(err:any){ showToast("✗ "+(err.message||wh_("errCreate"))) }
    finally { setSaving(false) }
  }

  async function deleteWebhook(id:string) {
    if(!confirm(wh_("deleteConfirm"))) return
    const res = await fetch(`/api/webhooks/${id}`, { method:"DELETE" })
    if(res.ok){ setWebhooks(w=>w.filter(wh=>wh.id!==id)); showToast(wh_("toastDeleted")) }
    else showToast(wh_("toastDeleteFailed"))
  }

  async function testWebhook(id:string) {
    setTesting(id)
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method:"POST" })
      const { data } = await res.json()
      if(data?.delivered) showToast(wh_("toastTestOk",{status:data.status}))
      else showToast(`✗ ${data?.error||wh_("errDelivery")}`)
      setWebhooks(w=>w.map(wh=>wh.id===id?{...wh, lastTriggeredAt:new Date().toISOString(),
        ...(data?.delivered?{successCount:(wh.successCount||0)+1}:{errorCount:(wh.errorCount||0)+1})}:wh))
    } catch { showToast(wh_("toastTestFailed")) }
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
          {wh_("headerDesc")}
        </p>
      </div>

      {/* Zapier / Make callout */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          { name:"Zapier", logo:"⚡", desc:wh_("zapierDesc"), url:"https://zapier.com" },
          { name:"Make",   logo:"🔄", desc:wh_("makeDesc"), url:"https://make.com" },
        ].map(p=>(
          <div key={p.name} style={{background:"#fff",border:"1px solid var(--border)",
            borderRadius:"var(--radius)",padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:24,flexShrink:0}}>{p.logo}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{p.name}</div>
              <div style={{fontSize:11,color:"var(--text-3)",marginBottom:6}}>{p.desc}</div>
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                style={{fontSize:11,color:"var(--steel)",textDecoration:"none",fontWeight:500}}>
                {wh_("connectVia",{name:p.name})}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Webhooks list */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>
          {wh_("webhookCount",{n:webhooks.length})}
        </div>
        {canEdit&&(
          <button onClick={()=>setCreating(true)}
            style={{padding:"7px 14px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            {wh_("+ New webhook")}
          </button>
        )}
      </div>

      {/* Create form */}
      {creating&&(
        <form onSubmit={createWebhook}
          style={{background:"#fff",border:"2px solid var(--steel)",borderRadius:"var(--radius)",
            padding:20,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>
            {wh_("New webhook")}
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
              {wh_("Endpoint URL *")}
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
              {wh_("eventsToSend",{n:form.events.length})}
            </label>
            {Object.entries(eventsByCategory).map(([cat,events])=>(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--text-3)",
                  letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>
                  {wh_(CAT_KEY[cat] as any)}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {events.map(ev=>(
                    <button key={ev.id} type="button" onClick={()=>toggleEvent(ev.id)}
                      style={{padding:"4px 10px",border:"1px solid var(--border)",borderRadius:6,
                        fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
                        background:form.events.includes(ev.id)?"var(--steel-pale,#EFF6FF)":"#fff",
                        color:form.events.includes(ev.id)?"var(--steel)":"var(--text-3)",
                        borderColor:form.events.includes(ev.id)?"var(--steel)":"var(--border)"}}>
                      {wh_(("ev."+ev.id) as any)}
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
              {wh_("Cancel")}
            </button>
            <button type="submit" disabled={!form.url.trim()||form.events.length===0||saving}
              style={{padding:"8px 20px",background:"var(--steel)",color:"#fff",border:"none",
                borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",
                opacity:(!form.url.trim()||form.events.length===0)?0.5:1}}>
              {saving?wh_("Creating…"):wh_("Create webhook")}
            </button>
          </div>
        </form>
      )}

      {webhooks.length===0&&!creating?(
        <EmptyState icon="🔗" title={wh_("No webhooks configured")}
          description={wh_("emptyDesc")} />
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
                      <span style={{fontSize:10,color:"var(--text-4)"}}>{wh_("moreEvents",{n:wh.events.length-5})}</span>
                    )}
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"var(--text-3)"}}>
                    <span style={{color:"var(--green)"}}>{wh_("sentCount",{n:wh.successCount})}</span>
                    {wh.errorCount>0&&<span style={{color:"var(--red)"}}>{wh_("errorCount",{n:wh.errorCount})}</span>}
                    {wh.lastTriggeredAt&&(
                      <span>{wh_("lastTriggered",{date:new Date(wh.lastTriggeredAt).toLocaleDateString(dateLocale(), {month:"short",day:"numeric", timeZone:"UTC" })})}</span>
                    )}
                  </div>
                  {showSecret===wh.id&&(
                    <div style={{marginTop:8,background:"#FFFBEB",border:"1px solid #FDE68A",
                      borderRadius:6,padding:"8px 12px",fontSize:11}}>
                      <strong style={{color:"#92400E"}}>{wh_("secretLabel")}</strong><br/>
                      <code style={{fontFamily:"monospace",color:"#92400E",fontSize:12}}>{wh.secret}</code>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>testWebhook(wh.id)} disabled={testing===wh.id}
                    style={{padding:"5px 10px",background:"var(--surface)",border:"1px solid var(--border)",
                      borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
                    {testing===wh.id?wh_("Sending…"):wh_("Test")}
                  </button>
                  {canEdit&&(
                    <button onClick={()=>deleteWebhook(wh.id)}
                      style={{padding:"5px 10px",background:"none",border:"1px solid var(--border)",
                        borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",
                        color:"var(--text-3)",transition:"all .15s"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor="var(--red)";e.currentTarget.style.color="var(--red)"}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)"}}>
                      {wh_("Delete")}
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
