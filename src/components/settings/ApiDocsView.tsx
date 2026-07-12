"use client"
// src/components/settings/ApiDocsView.tsx — Public API docs + key management
import { useState } from "react"
import { Badge, EmptyState } from "@/components/ui"

const API_ENDPOINTS = [
  {
    group:"Projects",
    endpoints:[
      { method:"GET",    path:"/api/v1/projects",         desc:"List all projects in the workspace",
        params:[{name:"status",type:"string",desc:"Filter by status: ACTIVE, DRAFT, COMPLETED"},
                {name:"page",  type:"number",desc:"Page number (default: 1)"},
                {name:"limit", type:"number",desc:"Items per page (default: 25, max: 100)"}],
        response:`{ "data": [{ "id": "clx...", "code": "PRJ-001", "name": "Digital Transformation",
  "status": "ACTIVE", "health": "GREEN", "percentComplete": 68,
  "methodology": "WATERFALL", "startDate": "2026-01-01", "endDate": "2026-12-31",
  "budgetTotal": 1200000, "budgetSpent": 820000 }],
  "total": 12, "page": 1, "perPage": 25 }` },
      { method:"POST",   path:"/api/v1/projects",         desc:"Create a new project" },
      { method:"GET",    path:"/api/v1/projects/:id",     desc:"Get a single project with full details" },
      { method:"PATCH",  path:"/api/v1/projects/:id",     desc:"Update project fields" },
      { method:"DELETE", path:"/api/v1/projects/:id",     desc:"Archive a project" },
    ]
  },
  {
    group:"Tasks",
    endpoints:[
      { method:"GET",    path:"/api/v1/tasks",            desc:"List tasks across projects" },
      { method:"POST",   path:"/api/v1/tasks",            desc:"Create a task" },
      { method:"PATCH",  path:"/api/v1/tasks/:id",        desc:"Update task status, assignee, or dates" },
    ]
  },
  {
    group:"Time entries",
    endpoints:[
      { method:"GET",    path:"/api/v1/time",             desc:"List time entries" },
      { method:"POST",   path:"/api/v1/time",             desc:"Log a time entry" },
    ]
  },
  {
    group:"Risks",
    endpoints:[
      { method:"GET",    path:"/api/v1/risks",            desc:"List open risks" },
      { method:"POST",   path:"/api/v1/risks",            desc:"Log a risk" },
      { method:"PATCH",  path:"/api/v1/risks/:id",        desc:"Update risk status or score" },
    ]
  },
  {
    group:"Webhooks",
    endpoints:[
      { method:"GET",    path:"/api/v1/webhooks",         desc:"List configured webhooks" },
      { method:"POST",   path:"/api/v1/webhooks",         desc:"Register a new webhook endpoint" },
      { method:"DELETE", path:"/api/v1/webhooks/:id",     desc:"Delete a webhook" },
    ]
  },
  {
    group:"Portfolio",
    endpoints:[
      { method:"GET",    path:"/api/v1/portfolios",       desc:"List portfolios with rollup metrics" },
      { method:"GET",    path:"/api/v1/programs",         desc:"List programs" },
    ]
  },
]

const METHOD_COLORS: Record<string,{bg:string;color:string}> = {
  GET:    { bg:"#ECFDF5", color:"#059669" },
  POST:   { bg:"#EFF6FF", color:"#1B6CA8" },
  PATCH:  { bg:"#FFFBEB", color:"#92400E" },
  DELETE: { bg:"#FEF2F2", color:"#DC2626" },
  PUT:    { bg:"#F5F3FF", color:"#7C3AED" },
}

interface ApiKey { id:string; name:string; prefix:string; scopes:string[]; lastUsedAt?:string; createdAt:string; isActive:boolean }

export function ApiDocsView({ apiKeys:initialKeys, workspaceId, role }:{
  apiKeys:any[]; workspaceId:string; role:string
}) {
  const canManage = ["SUPER_ADMIN","OWNER","ADMIN"].includes(role)
  const [tab, setTab]           = useState<"keys"|"docs"|"sandbox">("keys")
  const [keys, setKeys]         = useState<ApiKey[]>(initialKeys)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey]     = useState({ name:"", scopes:["projects:read","tasks:read"] })
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState("")
  const [createdKey, setCreatedKey] = useState<string|null>(null)
  const [openEndpoint, setOpenEndpoint] = useState<string|null>(null)
  const [sandboxResult, setSandboxResult] = useState<string>("")
  const [sandboxLoading, setSandboxLoading] = useState(false)
  const [sandboxApiKey, setSandboxApiKey]   = useState("")
  const [sandboxEndpoint, setSandboxEndpoint] = useState("GET /api/v1/projects")

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000) }

  const SCOPES = [
    "projects:read","projects:write",
    "tasks:read","tasks:write",
    "time:read","time:write",
    "risks:read","risks:write",
    "portfolio:read",
    "webhooks:manage",
    "team:read",
  ]

  function toggleScope(scope:string) {
    setNewKey(k=>({
      ...k,
      scopes:k.scopes.includes(scope)
        ? k.scopes.filter(s=>s!==scope)
        : [...k.scopes,scope]
    }))
  }

  async function createKey(e:React.FormEvent) {
    e.preventDefault()
    if(!newKey.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/api-keys", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ name:newKey.name, scopes:newKey.scopes })
      })
      if(!res.ok){ const e2=await res.json().catch(()=>({})); throw new Error(e2.error||"Create failed") }
      const { data } = await res.json()
      setKeys(k=>[...k, data.apiKey])
      setCreatedKey(data.key)
      setCreating(false)
      setNewKey({name:"",scopes:["projects:read","tasks:read"]})
      showToast("✓ API key created — copy it now, it won't be shown again")
    } catch(err:any){ showToast("✗ "+(err.message||"Create failed")) }
    finally { setSaving(false) }
  }

  async function revokeKey(id:string) {
    if(!confirm("Revoke this API key? Any integrations using it will stop working immediately.")) return
    const res = await fetch(`/api/api-keys/${id}`, { method:"DELETE" })
    if(res.ok){ setKeys(k=>k.map(key=>key.id===id?{...key,isActive:false}:key)); showToast("Key revoked") }
    else showToast("✗ Revoke failed")
  }

  async function runSandbox() {
    setSandboxLoading(true); setSandboxResult("")
    try {
      const [method, path] = sandboxEndpoint.split(" ")
      const res = await fetch(path.replace("/api/v1/","/api/"), {
        headers:{ "Authorization":`Bearer ${sandboxApiKey}` }
      })
      const data = await res.json()
      setSandboxResult(JSON.stringify(data, null, 2))
    } catch(e:any) {
      setSandboxResult(`// Error: ${e.message}`)
    } finally { setSandboxLoading(false) }
  }

  async function copyKey(key:string) {
    await navigator.clipboard.writeText(key).catch(()=>{})
    showToast("✓ Copied to clipboard")
  }

  return (
    <div style={{maxWidth:860,position:"relative"}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:4}}>API & integrations</h2>
        <p style={{fontSize:13,color:"var(--text-3)"}}>
          Manage API keys, explore the REST API, and test endpoints in the sandbox.
        </p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid var(--border)",marginBottom:20}}>
        {[["keys","🔑 API keys"],["docs","📖 API reference"],["sandbox","🧪 Sandbox"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id as any)}
            style={{padding:"9px 16px",border:"none",background:"none",cursor:"pointer",
              fontFamily:"var(--font)",fontSize:12,fontWeight:500,
              color:tab===id?"var(--steel)":"var(--text-3)",
              borderBottom:tab===id?"2px solid var(--steel)":"2px solid transparent",
              marginBottom:-1}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── API KEYS TAB ── */}
      {tab==="keys"&&(
        <>
          {createdKey&&(
            <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"var(--radius)",
              padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:"#065F46",marginBottom:8}}>
                ✓ Your new API key — copy it now, it won't be shown again
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <code style={{fontFamily:"monospace",fontSize:13,color:"#065F46",flex:1,
                  background:"#fff",padding:"8px 12px",borderRadius:6,
                  border:"1px solid #A7F3D0",wordBreak:"break-all"}}>
                  {createdKey}
                </code>
                <button onClick={()=>copyKey(createdKey)}
                  style={{padding:"8px 14px",background:"var(--green)",color:"#fff",border:"none",
                    borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",
                    fontFamily:"var(--font)",flexShrink:0}}>
                  Copy
                </button>
              </div>
              <button onClick={()=>setCreatedKey(null)}
                style={{marginTop:8,fontSize:11,color:"#059669",background:"none",border:"none",
                  cursor:"pointer",fontFamily:"var(--font)"}}>
                I've saved it — dismiss
              </button>
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>
              API keys ({keys.filter(k=>k.isActive).length} active)
            </div>
            {canManage&&(
              <button onClick={()=>setCreating(true)}
                style={{padding:"7px 14px",background:"var(--steel)",color:"#fff",border:"none",
                  borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
                + Create API key
              </button>
            )}
          </div>

          {creating&&(
            <form onSubmit={createKey}
              style={{background:"#fff",border:"2px solid var(--steel)",borderRadius:"var(--radius)",
                padding:20,marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>New API key</div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                  Key name *
                </label>
                <input autoFocus value={newKey.name} onChange={e=>setNewKey(k=>({...k,name:e.target.value}))}
                  placeholder="e.g. Zapier integration, Power BI connector"
                  style={{width:"100%",padding:"9px 12px",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",fontSize:13,fontFamily:"var(--font)",
                    color:"var(--text)",outline:"none"}} />
              </div>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:8}}>
                  Scopes ({newKey.scopes.length} selected)
                </label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {SCOPES.map(scope=>(
                    <button key={scope} type="button" onClick={()=>toggleScope(scope)}
                      style={{padding:"4px 10px",border:"1px solid var(--border)",borderRadius:20,
                        fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
                        background:newKey.scopes.includes(scope)?"var(--steel-pale,#EFF6FF)":"#fff",
                        color:newKey.scopes.includes(scope)?"var(--steel)":"var(--text-3)",
                        borderColor:newKey.scopes.includes(scope)?"var(--steel)":"var(--border)"}}>
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button type="button" onClick={()=>setCreating(false)}
                  style={{padding:"8px 16px",background:"#fff",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",fontSize:13,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
                  Cancel
                </button>
                <button type="submit" disabled={!newKey.name.trim()||saving}
                  style={{padding:"8px 20px",background:"var(--steel)",color:"#fff",border:"none",
                    borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",
                    opacity:!newKey.name.trim()?0.5:1}}>
                  {saving?"Creating…":"Create key"}
                </button>
              </div>
            </form>
          )}

          {keys.length===0&&!creating?(
            <EmptyState icon="🔑" title="No API keys yet"
              description="Create an API key to connect FlowSync PM to Zapier, Power BI, or any custom integration." />
          ):(
            <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden"}}>
              {keys.map(key=>(
                <div key={key.id} style={{padding:"12px 16px",borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                  display:"flex",alignItems:"center",gap:12,opacity:key.isActive?1:0.5}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{key.name}</span>
                      <Badge variant={key.isActive?"green":"gray"}>
                        {key.isActive?"Active":"Revoked"}
                      </Badge>
                    </div>
                    <div style={{fontSize:11,fontFamily:"monospace",color:"var(--text-3)",marginBottom:3}}>
                      {key.prefix}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:3}}>
                      {key.scopes.map(s=>(
                        <span key={s} style={{fontSize:10,padding:"1px 6px",borderRadius:3,
                          background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-3)"}}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:"var(--text-3)"}}>
                      Created {new Date(key.createdAt).toLocaleDateString("en-US", {dateStyle:"medium", timeZone:"UTC" })}
                      {key.lastUsedAt&&` · Last used ${new Date(key.lastUsedAt).toLocaleDateString("en-US", {dateStyle:"medium", timeZone:"UTC" })}`}
                    </div>
                  </div>
                  {canManage&&key.isActive&&(
                    <button onClick={()=>revokeKey(key.id)}
                      style={{padding:"5px 12px",background:"none",border:"1px solid var(--border)",
                        borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",
                        color:"var(--text-3)",transition:"all .15s"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor="var(--red)";e.currentTarget.style.color="var(--red)"}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)"}}>
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Auth info */}
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",
            borderRadius:"var(--radius)",padding:16,marginTop:16}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text)",marginBottom:8}}>Authentication</div>
            <p style={{fontSize:12,color:"var(--text-3)",marginBottom:8,lineHeight:1.65}}>
              All API requests must include your API key in the Authorization header:
            </p>
            <code style={{display:"block",fontFamily:"monospace",fontSize:12,
              background:"var(--navy,#0D1B2A)",color:"#34D399",padding:"10px 14px",
              borderRadius:6,lineHeight:1.65}}>
              Authorization: Bearer pxpm_your_api_key_here
            </code>
            <p style={{fontSize:11,color:"var(--text-3)",marginTop:8}}>
              Base URL: <code style={{fontFamily:"monospace"}}>https://flowsyncpm.com/api/v1</code>
              {" · "}Rate limit: 1,000 requests/hour per key
            </p>
          </div>
        </>
      )}

      {/* ── API DOCS TAB ── */}
      {tab==="docs"&&(
        <div>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",
            borderRadius:"var(--radius)",padding:"12px 16px",marginBottom:16,
            display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:18}}>📖</span>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>REST API v1</div>
              <div style={{fontSize:12,color:"var(--text-3)"}}>
                Base URL: <code style={{fontFamily:"monospace",fontSize:11}}>https://flowsyncpm.com/api/v1</code>
                {" · "}All responses are JSON · Authentication via Bearer token
              </div>
            </div>
          </div>
          {API_ENDPOINTS.map(group=>(
            <div key={group.group} style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",
                textTransform:"uppercase",marginBottom:8}}>
                {group.group}
              </div>
              <div style={{background:"#fff",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",overflow:"hidden"}}>
                {group.endpoints.map((ep,i)=>{
                  const mc = METHOD_COLORS[ep.method]||{bg:"#F8FAFC",color:"#64748B"}
                  const key = `${ep.method}:${ep.path}`
                  const isOpen = openEndpoint===key
                  return (
                    <div key={key} style={{borderBottom:i<group.endpoints.length-1?"1px solid var(--surface-1,#F1F5F9)":"none"}}>
                      <button onClick={()=>setOpenEndpoint(isOpen?null:key)}
                        style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
                          border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font)",
                          textAlign:"left",transition:"background .1s"}}
                        onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                        onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,
                          background:mc.bg,color:mc.color,minWidth:52,textAlign:"center",flexShrink:0}}>
                          {ep.method}
                        </span>
                        <code style={{fontFamily:"monospace",fontSize:12,color:"var(--text-2)",flex:1}}>
                          {ep.path}
                        </code>
                        <span style={{fontSize:12,color:"var(--text-3)",flex:2,textAlign:"left"}}>{ep.desc}</span>
                        <span style={{fontSize:10,color:"var(--text-4)"}}>{isOpen?"▲":"▼"}</span>
                      </button>
                      {isOpen&&(
                        <div style={{padding:"12px 14px",borderTop:"1px solid var(--border)",
                          background:"var(--surface)"}}>
                          {ep.params&&ep.params.length>0&&(
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:11,fontWeight:600,color:"var(--text-3)",
                                letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}}>
                                Query parameters
                              </div>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                {ep.params.map(p=>(
                                  <tr key={p.name} style={{borderBottom:"1px solid var(--border)"}}>
                                    <td style={{padding:"6px 8px",fontFamily:"monospace",color:"var(--steel)",width:120}}>{p.name}</td>
                                    <td style={{padding:"6px 8px",color:"var(--text-3)",width:70}}>{p.type}</td>
                                    <td style={{padding:"6px 8px",color:"var(--text-2)"}}>{p.desc}</td>
                                  </tr>
                                ))}
                              </table>
                            </div>
                          )}
                          {ep.response&&(
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:"var(--text-3)",
                                letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}}>
                                Example response
                              </div>
                              <pre style={{fontFamily:"monospace",fontSize:11,
                                background:"var(--navy,#0D1B2A)",color:"#34D399",
                                padding:"12px 14px",borderRadius:6,overflowX:"auto",
                                lineHeight:1.65,margin:0}}>
                                {ep.response}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SANDBOX TAB ── */}
      {tab==="sandbox"&&(
        <div>
          <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"var(--radius)",
            padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400E"}}>
            ⚠ The sandbox calls your live workspace. Use a read-only API key.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                API key
              </label>
              <input value={sandboxApiKey} onChange={e=>setSandboxApiKey(e.target.value)}
                placeholder="pxpm_…"
                style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",fontSize:12,fontFamily:"monospace",
                  color:"var(--text)",outline:"none"}} />
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                Endpoint
              </label>
              <select value={sandboxEndpoint} onChange={e=>setSandboxEndpoint(e.target.value)}
                style={{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",
                  color:"var(--text)",outline:"none",appearance:"none" as const}}>
                {API_ENDPOINTS.flatMap(g=>g.endpoints.filter(ep=>ep.method==="GET").map(ep=>(
                  <option key={`${ep.method} ${ep.path.replace("/api/v1/","/api/")}`}
                    value={`${ep.method} ${ep.path.replace("/api/v1/","/api/")}`}>
                    {ep.method} {ep.path}
                  </option>
                )))}
              </select>
            </div>
          </div>
          <button onClick={runSandbox} disabled={!sandboxApiKey.trim()||sandboxLoading}
            style={{padding:"9px 20px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",
              fontFamily:"var(--font)",marginBottom:14,opacity:!sandboxApiKey.trim()?0.5:1}}>
            {sandboxLoading?"Sending request…":"▶ Run request"}
          </button>
          {sandboxResult&&(
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-3)",letterSpacing:".05em",
                textTransform:"uppercase",marginBottom:6}}>
                Response
              </div>
              <pre style={{fontFamily:"monospace",fontSize:12,
                background:"var(--navy,#0D1B2A)",color:"#34D399",
                padding:"14px 16px",borderRadius:"var(--radius)",overflowX:"auto",
                lineHeight:1.65,maxHeight:400,margin:0}}>
                {sandboxResult}
              </pre>
            </div>
          )}
          {!sandboxResult&&!sandboxLoading&&(
            <div style={{textAlign:"center",padding:"32px 24px",color:"var(--text-3)",
              fontSize:13,border:"1px dashed var(--border)",borderRadius:"var(--radius)"}}>
              Enter your API key, select an endpoint, and click Run request to see the live response.
            </div>
          )}
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
