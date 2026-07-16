"use client"
// src/components/templates/TemplatesView.tsx
import { useLocale } from "next-intl"
import { DocTemplateLibrary } from "@/components/templates/DocTemplateLibrary"
import { DateField } from "@/components/shared/DatePicker"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui"

// ── Card shape (normalized from the built-in library / workspace templates) ──
type TplCard = {
  id:string; name:string; icon:string; industry:string; methodology:string;
  difficulty:string; weeks:number; isPremium:boolean; price:number; rating:number;
  uses:number; author:string; featured:boolean; color:string; desc:string;
  tags:string[]; phases:number; tasks:number; milestones:number;
}
function normalize(t:any):TplCard {
  const phases = Array.isArray(t.phases) ? t.phases : []
  return {
    id:t.id, name:t.name, icon:t.icon||"\ud83d\udcc1", industry:t.industry||"", methodology:t.methodology,
    difficulty:t.difficulty||"", weeks:t.estimatedWeeks||0, isPremium:!!t.isPremium,
    price:(t.price||0)/100, // library stores price in cents; cards display dollars
    rating:t.rating||0, uses:t.usageCount||0, author:t.author||"", featured:!!t.featured,
    color:t.color||"#1B6CA8", desc:t.description||"", tags:Array.isArray(t.tags)?t.tags:[],
    phases:phases.length,
    tasks:phases.reduce((n:number,ph:any)=>n+((ph.tasks?.length)||0),0),
    milestones:phases.reduce((n:number,ph:any)=>n+((ph.milestones?.length)||0),0),
  }
}

const CATS = [
  { id:"all",          label:"All",          icon:"\u2b50" },
  { id:"featured",     label:"Featured",     icon:"\ud83c\udf1f" },
  { id:"IT",           label:"IT & Tech",    icon:"\ud83d\udcbb" },
  { id:"Technology",   label:"Software",     icon:"\ud83d\ude80" },
  { id:"Construction", label:"Construction", icon:"\ud83c\udfd7" },
  { id:"Manufacturing", label:"Manufacturing", icon:"\ud83c\udfed" },
  { id:"Finance",      label:"Finance",      icon:"\ud83d\udcbc" },
  { id:"Operations",   label:"Operations",   icon:"\u2699\ufe0f" },
  { id:"Professional Services", label:"Prof. Services", icon:"\ud83e\udd1d" },
]

const METHOD_COLORS: Record<string,string> = {
  WATERFALL:"#1B6CA8", AGILE:"#059669", SCRUM:"#7C3AED", HYBRID:"#0891B2"
}

export function TemplatesView({ workspaceTemplates, workspaceId, filters }:{
  workspaceTemplates:any[]; workspaceId:string; filters:any
}) {
  const locale = useLocale() as "en" | "es"
  const es = locale === "es"
  const [section,  setSection]  = useState<"projects"|"documents">("projects")
  const [cat,      setCat]      = useState("all")
  const [method,   setMethod]   = useState("all")
  const [freeOnly, setFreeOnly] = useState(false)
  const [search,   setSearch]   = useState(filters.q||"")
  const [selected, setSelected] = useState<TplCard|null>(null)
  const [templates, setTemplates] = useState<TplCard[]>([])
  const [loading,   setLoading]   = useState(true)
  const [installing,setInstalling]=useState(false)
  const [installName,setInstallName]=useState("")
  const [installDate,setInstallDate]=useState(new Date().toISOString().split("T")[0])
  const [toast,    setToast]    = useState("")

  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const r=await fetch("/api/templates",{ headers:{ "x-workspace-id": workspaceId } })
        const j=await r.json()
        const built=(j?.data?.builtIn||[]).map(normalize)
        if(live) setTemplates(built)
      }catch{ /* leave list empty on failure */ }
      finally{ if(live) setLoading(false) }
    })()
    return ()=>{ live=false }
  },[workspaceId])

  function showToast(msg:string) {
    setToast(msg); setTimeout(()=>setToast(""),3000)
  }

  const filtered = templates.filter(t=>{
    if(cat==="featured" && !t.featured) return false
    if(cat!=="all" && cat!=="featured" && t.industry!==cat) return false
    if(method!=="all" && t.methodology!==method) return false
    if(freeOnly && t.isPremium) return false
    if(search){
      const q=search.toLowerCase()
      return t.name.toLowerCase().includes(q)||t.desc.toLowerCase().includes(q)||
        t.tags.some(tag=>tag.toLowerCase().includes(q))
    }
    return true
  })

  async function install() {
    if(!selected||!installName.trim()) return
    setInstalling(true)
    try {
      const res = await fetch("/api/templates?action=install", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ templateId:selected.id, projectName:installName, startDate:new Date(installDate).toISOString() })
      })
      if(!res.ok) throw new Error((await res.json()).error||"Install failed")
      showToast(`✓ "${installName}" created from template`)
      setSelected(null); setInstallName(""); setInstalling(false)
    } catch(e:any){ showToast(`✗ ${e.message}`); setInstalling(false) }
  }

  const sel: React.CSSProperties = {
    padding:"6px 22px 6px 9px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
    color:"var(--text)", appearance:"none" as const, cursor:"pointer",
    background:"#fff",
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",position:"relative"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"14px 20px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",marginBottom:2}}>
              {es ? "Plantillas" : "Templates"}
            </h1>
            <p style={{fontSize:12,color:"var(--text-3)"}}>
              {section === "projects"
                ? `${templates.length} ${es ? "plantillas de proyecto" : "project templates"} · ${workspaceTemplates.length} ${es ? "del espacio de trabajo" : "workspace"}`
                : (es ? "Formatos en blanco para cualquier tipo de proyecto" : "Blank forms for any type of project")}
            </p>
          </div>
          <button style={{padding:"8px 16px",background:"var(--steel)",color:"#fff",border:"none",
            borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            📤 Publish template
          </button>
        </div>
        <div style={{display:"flex",gap:6,marginTop:12}}>
          {([["projects", es ? "🏗 Plantillas de proyecto" : "🏗 Project templates"],
             ["documents", es ? "📄 Plantillas de documentos" : "📄 Document templates"]] as const).map(([id,label])=>(
            <button key={id} onClick={()=>setSection(id as any)}
              style={{padding:"7px 14px",borderRadius:"var(--radius)",fontSize:12.5,fontWeight:600,
                cursor:"pointer",fontFamily:"var(--font)",
                border: section===id ? "none" : "1px solid var(--border)",
                background: section===id ? "var(--navy,#0D1B2A)" : "#fff",
                color: section===id ? "#fff" : "var(--text-2)"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === "documents" ? (
        <div style={{flex:1,overflowY:"auto",padding:"14px 20px",background:"var(--surface-2,#F8FAFC)"}}>
          <DocTemplateLibrary locale={locale} />
        </div>
      ) : (
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:180,background:"#fff",borderRight:"1px solid var(--border)",
          padding:12,flexShrink:0,overflowY:"auto"}}>
          <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",letterSpacing:".07em",
            textTransform:"uppercase",marginBottom:8,padding:"0 4px"}}>
            Industry
          </div>
          {CATS.map(c=>(
            <button key={c.id} onClick={()=>setCat(c.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
                border:"none",background:cat===c.id?"var(--steel-pale,#EFF6FF)":"transparent",
                borderRadius:"var(--radius)",cursor:"pointer",fontFamily:"var(--font)",
                fontSize:13,fontWeight:cat===c.id?500:400,
                color:cat===c.id?"var(--steel)":"var(--text-2)",marginBottom:2,textAlign:"left"}}>
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
          <div style={{height:1,background:"var(--border)",margin:"10px 4px"}}/>
          <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",letterSpacing:".07em",
            textTransform:"uppercase",marginBottom:8,padding:"0 4px"}}>
            Methodology
          </div>
          {["all","WATERFALL","AGILE","SCRUM","HYBRID"].map(m=>(
            <button key={m} onClick={()=>setMethod(m)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 10px",
                border:"none",background:method===m?"var(--steel-pale,#EFF6FF)":"transparent",
                borderRadius:"var(--radius)",cursor:"pointer",fontFamily:"var(--font)",fontSize:12,
                color:method===m?"var(--steel)":"var(--text-2)",marginBottom:1,textAlign:"left"}}>
              {m==="all"?"All methodologies":m}
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {/* Filter bar */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <input placeholder="Search templates…" value={search}
              onChange={e=>setSearch(e.target.value)}
              style={{padding:"7px 11px",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",
                outline:"none",width:200}} />
            <button onClick={()=>setFreeOnly(f=>!f)}
              style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",
                fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
                background:freeOnly?"var(--green-pale,#ECFDF5)":"#fff",
                color:freeOnly?"var(--green)":"var(--text-3)",
                borderColor:freeOnly?"var(--green)":"var(--border)",fontWeight:freeOnly?600:400}}>
              Free only
            </button>
            <span style={{fontSize:12,color:"var(--text-3)",marginLeft:4}}>
              {filtered.length} template{filtered.length!==1?"s":""}
            </span>
          </div>

          {/* Featured row — hidden while any filter narrows the list */}
          {cat==="all"&&!search&&method==="all"&&!loading&&(
            <div style={{marginBottom:24}}>
              <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:12}}>
                🌟 Featured templates
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {filtered.filter(t=>t.featured).map(t=><TemplateCard key={t.id} t={t} onSelect={setSelected}/>)}
              </div>
            </div>
          )}

          {/* All results */}
          <div>
            {cat!=="all"||search||method!=="all"?(
              <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:12}}>
                {search?`Results for "${search}"`:method!=="all"&&cat==="all"?`${method} templates`:CATS.find(c=>c.id===cat)?.label+" templates"}
              </div>
            ):(
              <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:12}}>
                All templates
              </div>
            )}
            {filtered.length===0?(
              <div style={{textAlign:"center",padding:"40px 24px",fontSize:13,color:"var(--text-3)"}}>
                <div style={{fontSize:32,marginBottom:8}}>{loading?"\u23f3":"\ud83d\udd0d"}</div>
                {loading?"Loading templates…":"No templates match your filters."}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {filtered.map(t=><TemplateCard key={t.id} t={t} onSelect={setSelected}/>)}
              </div>
            )}
          </div>

          {/* Workspace templates */}
          {workspaceTemplates.length>0&&(
            <div style={{marginTop:28}}>
              <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:12}}>
                🏢 Workspace templates
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {workspaceTemplates.map(t=>(
                  <div key={t.id} style={{background:"#fff",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",padding:16,cursor:"pointer"}}>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:4}}>{t.name}</div>
                    <div style={{fontSize:12,color:"var(--text-3)"}}>{t.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Install modal */}
      {selected&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",zIndex:200,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:480,
            boxShadow:"0 24px 64px rgba(0,0,0,.2)",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>
                Install: {selected.name}
              </div>
              <button onClick={()=>setSelected(null)}
                style={{fontSize:22,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer",lineHeight:1}}>
                ×
              </button>
            </div>
            <div style={{padding:20}}>
              {/* Template summary */}
              <div style={{background:"var(--surface)",borderRadius:"var(--radius)",
                padding:"12px 14px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:28}}>{selected.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:3}}>{selected.name}</div>
                  <div style={{display:"flex",gap:8,fontSize:11}}>
                    <span style={{color:METHOD_COLORS[selected.methodology],fontWeight:600}}>{selected.methodology}</span>
                    <span style={{color:"var(--text-3)"}}>·</span>
                    <span style={{color:"var(--text-3)"}}>{selected.phases} phases</span>
                    <span style={{color:"var(--text-3)"}}>·</span>
                    <span style={{color:"var(--text-3)"}}>{selected.tasks} tasks</span>
                    <span style={{color:"var(--text-3)"}}>·</span>
                    <span style={{color:"var(--text-3)"}}>{selected.milestones} milestones</span>
                  </div>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5,fontWeight:500}}>
                  Project name <span style={{color:"var(--red)"}}>*</span>
                </label>
                <input autoFocus value={installName} onChange={e=>setInstallName(e.target.value)}
                  placeholder={`e.g. ${selected.name} 2026`}
                  style={{width:"100%",padding:"9px 12px",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",fontSize:13,fontFamily:"var(--font)",
                    color:"var(--text)",outline:"none"}} />
              </div>
              <div style={{marginBottom:20}}>
                <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5,fontWeight:500}}>
                  Start date
                </label>
                <DateField  value={installDate}
                  onChange={e=>setInstallDate(e.target.value)}
                  style={{width:"100%",padding:"9px 12px",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",fontSize:13,fontFamily:"var(--font)",
                    color:"var(--text)",outline:"none"}} />
              </div>
            </div>
            <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",
              display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>setSelected(null)}
                style={{padding:"9px 18px",background:"#fff",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",fontSize:13,cursor:"pointer",fontFamily:"var(--font)",
                  color:"var(--text-2)"}}>
                Cancel
              </button>
              <button onClick={install} disabled={!installName.trim()||installing}
                style={{padding:"9px 18px",background:installName.trim()?"var(--steel)":"var(--border)",
                  color:installName.trim()?"#fff":"var(--text-3)",border:"none",
                  borderRadius:"var(--radius)",fontSize:13,fontWeight:500,
                  cursor:installName.trim()?"pointer":"not-allowed",fontFamily:"var(--font)"}}>
                {installing?"Installing…":"Install template →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
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

function TemplateCard({ t, onSelect }:{t:TplCard; onSelect:(t:TplCard)=>void}) {
  const methodColor = METHOD_COLORS[t.methodology]
  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"var(--radius)",
      overflow:"hidden",cursor:"pointer",transition:"all .18s"}}
      onMouseOver={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.1)"}}
      onMouseOut={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
      <div style={{padding:"16px 16px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <span style={{fontSize:28}}>{t.icon}</span>
          <div style={{display:"flex",gap:5,flexDirection:"column",alignItems:"flex-end"}}>
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,
              background:methodColor+"15",color:methodColor}}>
              {t.methodology}
            </span>
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,
              background:t.isPremium?"#FFFBEB":"#ECFDF5",
              color:t.isPremium?"#92400E":"var(--green)"}}>
              {t.isPremium?`$${t.price}`:"Free"}
            </span>
          </div>
        </div>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:5,lineHeight:1.3}}>{t.name}</div>
        <div style={{fontSize:11,color:"var(--text-3)",lineHeight:1.55,marginBottom:10}}>{t.desc}</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {t.tags.slice(0,3).map(tag=>(
            <span key={tag} style={{fontSize:9,fontWeight:600,padding:"2px 6px",
              borderRadius:3,background:"var(--surface-1,#F1F5F9)",color:"var(--text-3)"}}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div style={{padding:"9px 14px",background:"var(--surface)",
        borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:11,color:"var(--text-3)",display:"flex",gap:10}}>
          <span>⏱ {t.weeks}w</span>
          <span>⭐ {t.rating}</span>
          <span>📥 {t.uses.toLocaleString("en-US")}</span>
        </div>
        <button onClick={()=>onSelect(t)}
          style={{padding:"5px 12px",background:t.isPremium?"var(--amber)":"var(--steel)",
            color:t.isPremium?"var(--navy,#0D1B2A)":"#fff",border:"none",borderRadius:6,
            fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)"}}>
          {t.isPremium?`Buy $${t.price}`:"Use free →"}
        </button>
      </div>
    </div>
  )
}
