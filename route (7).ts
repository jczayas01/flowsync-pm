"use client"
// src/components/reports/ReportBuilderView.tsx
import { useState } from "react"

// ── Block types ────────────────────────────────
const BLOCK_TYPES = [
  { id:"text",       icon:"📝", label:"Text / narrative",   desc:"Free-form rich text block" },
  { id:"kpi",        icon:"📊", label:"KPI metrics row",    desc:"Up to 4 metric tiles in a row" },
  { id:"tasks",      icon:"✅", label:"Task table",         desc:"Filtered list of project tasks" },
  { id:"risks",      icon:"⚠",  label:"Risk register",      desc:"Open risks by score" },
  { id:"gantt",      icon:"📅", label:"Gantt snapshot",     desc:"Mini Gantt for the selected date range" },
  { id:"budget",     icon:"💰", label:"Budget summary",     desc:"Budget vs actuals with EVM metrics" },
  { id:"milestones", icon:"🎯", label:"Milestones",         desc:"Upcoming and completed milestones" },
  { id:"health",     icon:"🟢", label:"Health summary",     desc:"Portfolio or project health overview" },
  { id:"chart",      icon:"📈", label:"Chart",              desc:"Bar, line, or pie chart" },
]

interface ReportBlock {
  id:     string
  type:   string
  title:  string
  config: Record<string,any>
}

const INITIAL_BLOCKS: ReportBlock[] = [
  { id:"b1", type:"text",  title:"Executive summary",   config:{ content:"This report covers project status for the period..." } },
  { id:"b2", type:"kpi",   title:"Key metrics",         config:{ metrics:["completion","budget","risks","milestones"] } },
  { id:"b3", type:"gantt", title:"Schedule overview",   config:{ range:"30d" } },
  { id:"b4", type:"risks", title:"Open risks (score ≥9)", config:{ minScore:9, status:"OPEN" } },
]

export function ReportBuilderView({ projectId, workspaceId }:{
  projectId?:string; workspaceId:string
}) {
  const [blocks, setBlocks]       = useState<ReportBlock[]>(INITIAL_BLOCKS)
  const [preview, setPreview]     = useState(false)
  const [generating, setGenerating]= useState(false)
  const [saving, setSaving]       = useState(false)
  const [reportName, setReportName]= useState("Weekly Status Report")
  const [dragging, setDragging]   = useState<string|null>(null)
  const [dragOver, setDragOver]   = useState<string|null>(null)
  const [selected, setSelected]   = useState<string|null>("b1")
  const [toast, setToast]         = useState("")

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000) }

  function addBlock(type:string) {
    const bt = BLOCK_TYPES.find(b=>b.id===type)
    const newBlock: ReportBlock = {
      id:     `b${Date.now()}`,
      type,
      title:  bt?.label || type,
      config: {},
    }
    setBlocks(b=>[...b,newBlock])
    setSelected(newBlock.id)
  }

  function removeBlock(id:string) {
    setBlocks(b=>b.filter(bl=>bl.id!==id))
    if(selected===id) setSelected(null)
  }

  function moveBlock(id:string, dir:"up"|"down") {
    setBlocks(b=>{
      const idx = b.findIndex(bl=>bl.id===id)
      if(dir==="up"&&idx===0) return b
      if(dir==="down"&&idx===b.length-1) return b
      const arr = [...b]
      const swap = dir==="up"?idx-1:idx+1
      ;[arr[idx],arr[swap]]=[arr[swap],arr[idx]]
      return arr
    })
  }

  function updateBlock(id:string, updates:Partial<ReportBlock>) {
    setBlocks(b=>b.map(bl=>bl.id===id?{...bl,...updates}:bl))
  }

  async function generateWithAI() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/ai`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"generate_report_layout",
          projectId,
          reportName,
          existingBlocks:blocks.map(b=>b.type),
        })
      })
      if(!res.ok) throw new Error()
      showToast("✓ AI optimised report layout")
    } catch { showToast("AI generation requires project context") }
    finally { setGenerating(false) }
  }

  async function saveReport() {
    setSaving(true)
    try {
      const res = await fetch("/api/reports", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ projectId, name:reportName, blocks, workspaceId })
      })
      if(!res.ok) throw new Error((await res.json()).error||"Save failed")
      showToast("✓ Report saved")
    } catch(e:any){ showToast(`✗ ${e.message}`) }
    finally { setSaving(false) }
  }

  const selBlock = blocks.find(b=>b.id===selected)

  // ── Preview renderer ──────────────────────────
  function renderBlock(block: ReportBlock) {
    const card: React.CSSProperties = {
      background:"#fff", border:"1px solid var(--border)",
      borderRadius:"var(--radius)", padding:20, marginBottom:14
    }
    switch(block.type) {
      case "text":
        return (
          <div style={card}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:10}}>{block.title}</h3>
            <p style={{fontSize:13,color:"var(--text-2)",lineHeight:1.7,margin:0}}>
              {block.config.content || "Text content goes here..."}
            </p>
          </div>
        )
      case "kpi":
        return (
          <div style={card}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:12}}>{block.title}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[
                {label:"Completion",value:"68%",  color:"var(--steel)"},
                {label:"CPI",       value:"0.94", color:"var(--amber)"},
                {label:"Open risks",value:"4",    color:"var(--red)"},
                {label:"Milestones",value:"3",    color:"var(--green)"},
              ].map(k=>(
                <div key={k.label} style={{textAlign:"center",padding:"12px 8px",
                  background:"var(--surface)",borderRadius:8}}>
                  <div style={{fontSize:24,fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:4}}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        )
      case "gantt":
        return (
          <div style={card}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:12}}>{block.title}</h3>
            <div style={{background:"var(--surface)",borderRadius:8,padding:12}}>
              {["Initiation","Requirements","Configuration"].map((phase,i)=>(
                <div key={phase} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:11,color:"var(--text-3)",width:120,flexShrink:0}}>{phase}</span>
                  <div style={{flex:1,height:14,background:"var(--border)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${[100,100,80][i]}%`,borderRadius:3,
                      background:["#059669","#1B6CA8","#7C3AED"][i]}}/>
                  </div>
                  <span style={{fontSize:11,color:"var(--text-3)",width:36,textAlign:"right"}}>
                    {[100,100,80][i]}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      case "risks":
        return (
          <div style={card}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:12}}>{block.title}</h3>
            {[
              {title:"Legacy data migration failure",score:20,cat:"Technical"},
              {title:"Staff resistance to new system",score:12,cat:"People"},
              {title:"HL7 interface delays",          score:9, cat:"Integration"},
            ].map(r=>(
              <div key={r.title} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 0",borderBottom:"1px solid var(--surface-1,#F1F5F9)"}}>
                <div style={{width:30,height:30,borderRadius:6,flexShrink:0,
                  background:r.score>=15?"#FEF2F2":r.score>=9?"#FFFBEB":"#EFF6FF",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,
                  color:r.score>=15?"var(--red)":r.score>=9?"var(--amber)":"var(--steel)"}}>
                  {r.score}
                </div>
                <span style={{flex:1,fontSize:13,color:"var(--text)"}}>{r.title}</span>
                <span style={{fontSize:11,color:"var(--text-3)"}}>{r.cat}</span>
              </div>
            ))}
          </div>
        )
      case "milestones":
        return (
          <div style={card}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:12}}>{block.title}</h3>
            {[
              {name:"Requirements sign-off",date:"Jul 15",done:true},
              {name:"UAT begin",            date:"Sep 1", done:false},
              {name:"Go-live",              date:"Dec 15",done:false},
            ].map(m=>(
              <div key={m.name} style={{display:"flex",alignItems:"center",gap:10,
                padding:"8px 0",borderBottom:"1px solid var(--surface-1,#F1F5F9)"}}>
                <span style={{color:m.done?"var(--green)":"var(--amber)",fontSize:12}}>
                  {m.done?"◆":"◇"}
                </span>
                <span style={{flex:1,fontSize:13,color:m.done?"var(--text-3)":"var(--text)",
                  textDecoration:m.done?"line-through":"none"}}>
                  {m.name}
                </span>
                <span style={{fontSize:11,color:"var(--text-3)"}}>{m.date}</span>
              </div>
            ))}
          </div>
        )
      case "budget":
        return (
          <div style={card}>
            <h3 style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:12}}>{block.title}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[
                {label:"Total budget",  value:"$1.2M",  color:"var(--text)"},
                {label:"Spent (AC)",    value:"$820K",  color:"var(--amber)"},
                {label:"Earned value",  value:"$780K",  color:"var(--steel)"},
              ].map(m=>(
                <div key={m.label} style={{textAlign:"center",padding:"10px",
                  background:"var(--surface)",borderRadius:8}}>
                  <div style={{fontSize:20,fontWeight:700,color:m.color,lineHeight:1}}>{m.value}</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:"68%",background:"var(--amber)",borderRadius:4}}/>
            </div>
            <div style={{fontSize:11,color:"var(--text-3)",marginTop:4}}>68% of budget utilised</div>
          </div>
        )
      default:
        return (
          <div style={{...card,padding:16,textAlign:"center",color:"var(--text-3)",fontSize:13}}>
            {BLOCK_TYPES.find(b=>b.id===block.type)?.icon} {block.title}
          </div>
        )
    }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",position:"relative"}}>

      {/* Toolbar */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"10px 20px",
        display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap"}}>
        <input value={reportName} onChange={e=>setReportName(e.target.value)}
          style={{padding:"7px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",
            fontSize:14,fontWeight:500,fontFamily:"var(--font)",color:"var(--text)",
            outline:"none",minWidth:240}} />
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={generateWithAI} disabled={generating}
            style={{padding:"7px 14px",background:generating?"var(--surface)":"var(--purple-pale,#F5F3FF)",
              color:generating?"var(--text-3)":"#7C3AED",border:"1px solid #7C3AED30",
              borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            {generating?"Generating…":"⚡ AI optimize layout"}
          </button>
          <button onClick={()=>setPreview(p=>!p)}
            style={{padding:"7px 14px",background:preview?"var(--navy,#0D1B2A)":"var(--surface)",
              color:preview?"#fff":"var(--text-2)",border:"1px solid var(--border)",
              borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            {preview?"← Edit":"👁 Preview"}
          </button>
          <button onClick={saveReport} disabled={saving}
            style={{padding:"7px 14px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            {saving?"Saving…":"Save report"}
          </button>
          <button style={{padding:"7px 14px",background:"#fff",color:"var(--text-2)",
            border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:12,
            fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            ⬇ Export PDF
          </button>
        </div>
      </div>

      {preview ? (
        /* ── PREVIEW MODE ── */
        <div style={{flex:1,overflowY:"auto",padding:24,background:"var(--surface)"}}>
          <div style={{maxWidth:760,margin:"0 auto"}}>
            <h1 style={{fontSize:22,fontWeight:600,color:"var(--text)",marginBottom:4}}>{reportName}</h1>
            <p style={{fontSize:13,color:"var(--text-3)",marginBottom:28}}>
              Generated {new Date().toLocaleDateString("en-US",{dateStyle:"long"})}
            </p>
            {blocks.map(block=>renderBlock(block))}
          </div>
        </div>
      ) : (
        /* ── BUILDER MODE ── */
        <div style={{flex:1,display:"grid",gridTemplateColumns:"200px 1fr 240px",overflow:"hidden"}}>

          {/* Left: Block palette */}
          <div style={{borderRight:"1px solid var(--border)",background:"#fff",
            overflowY:"auto",padding:12}}>
            <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",letterSpacing:".07em",
              textTransform:"uppercase",marginBottom:10,padding:"0 4px"}}>
              Add block
            </div>
            {BLOCK_TYPES.map(bt=>(
              <button key={bt.id} onClick={()=>addBlock(bt.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 10px",
                  border:"none",background:"transparent",borderRadius:"var(--radius)",
                  cursor:"pointer",fontFamily:"var(--font)",marginBottom:2,
                  textAlign:"left",transition:"background .1s"}}
                onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                <span style={{fontSize:16,flexShrink:0}}>{bt.icon}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:"var(--text)"}}>{bt.label}</div>
                  <div style={{fontSize:10,color:"var(--text-3)"}}>{bt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Centre: Canvas */}
          <div style={{overflowY:"auto",padding:20,background:"var(--surface)"}}>
            {blocks.length===0?(
              <div style={{textAlign:"center",padding:"48px 24px",color:"var(--text-3)"}}>
                <div style={{fontSize:40,marginBottom:12}}>📄</div>
                <div style={{fontSize:14,fontWeight:500,color:"var(--text)",marginBottom:6}}>
                  Your report canvas is empty
                </div>
                <div style={{fontSize:13}}>Click blocks in the left panel to add them.</div>
              </div>
            ):(
              blocks.map((block,idx)=>(
                <div key={block.id}
                  onClick={()=>setSelected(block.id)}
                  style={{background:"#fff",border:`2px solid ${selected===block.id?"var(--steel)":"var(--border)"}`,
                    borderRadius:"var(--radius)",marginBottom:10,overflow:"hidden",
                    cursor:"pointer",transition:"all .15s",
                    boxShadow:selected===block.id?"0 0 0 3px rgba(27,108,168,.12)":"none"}}>
                  {/* Block header */}
                  <div style={{padding:"8px 12px",borderBottom:"1px solid var(--border)",
                    display:"flex",alignItems:"center",gap:8,background:"var(--surface)"}}>
                    <span style={{fontSize:14}}>{BLOCK_TYPES.find(bt=>bt.id===block.type)?.icon}</span>
                    <span style={{flex:1,fontSize:12,fontWeight:500,color:"var(--text)"}}>{block.title}</span>
                    <div style={{display:"flex",gap:2}}>
                      <button onClick={e=>{e.stopPropagation();moveBlock(block.id,"up")}}
                        style={{width:22,height:22,border:"none",background:"none",cursor:"pointer",
                          fontSize:11,color:"var(--text-3)",fontFamily:"var(--font)"}}>↑</button>
                      <button onClick={e=>{e.stopPropagation();moveBlock(block.id,"down")}}
                        style={{width:22,height:22,border:"none",background:"none",cursor:"pointer",
                          fontSize:11,color:"var(--text-3)",fontFamily:"var(--font)"}}>↓</button>
                      <button onClick={e=>{e.stopPropagation();removeBlock(block.id)}}
                        style={{width:22,height:22,border:"none",background:"none",cursor:"pointer",
                          fontSize:14,color:"var(--text-3)",fontFamily:"var(--font)"}}>×</button>
                    </div>
                  </div>
                  {/* Block preview */}
                  <div style={{padding:12,pointerEvents:"none"}}>
                    {renderBlock(block)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Properties */}
          <div style={{borderLeft:"1px solid var(--border)",background:"#fff",overflowY:"auto",padding:16}}>
            <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",letterSpacing:".07em",
              textTransform:"uppercase",marginBottom:12}}>
              Block properties
            </div>
            {!selBlock?(
              <div style={{fontSize:12,color:"var(--text-3)"}}>Select a block to edit its properties.</div>
            ):(
              <div>
                <div style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:11,color:"var(--text-2)",fontWeight:500,marginBottom:4}}>
                    Block title
                  </label>
                  <input value={selBlock.title}
                    onChange={e=>updateBlock(selBlock.id,{title:e.target.value})}
                    style={{width:"100%",padding:"7px 9px",border:"1px solid var(--border)",
                      borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",
                      color:"var(--text)",outline:"none"}} />
                </div>
                {selBlock.type==="text"&&(
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:11,color:"var(--text-2)",fontWeight:500,marginBottom:4}}>
                      Content
                    </label>
                    <textarea value={selBlock.config.content||""}
                      onChange={e=>updateBlock(selBlock.id,{config:{...selBlock.config,content:e.target.value}})}
                      rows={5}
                      style={{width:"100%",padding:"7px 9px",border:"1px solid var(--border)",
                        borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",
                        color:"var(--text)",outline:"none",resize:"vertical",lineHeight:1.5}} />
                  </div>
                )}
                {selBlock.type==="risks"&&(
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:11,color:"var(--text-2)",fontWeight:500,marginBottom:4}}>
                      Minimum risk score
                    </label>
                    <input type="number" min={1} max={25}
                      value={selBlock.config.minScore||9}
                      onChange={e=>updateBlock(selBlock.id,{config:{...selBlock.config,minScore:Number(e.target.value)}})}
                      style={{width:"100%",padding:"7px 9px",border:"1px solid var(--border)",
                        borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",
                        color:"var(--text)",outline:"none"}} />
                  </div>
                )}
                {selBlock.type==="gantt"&&(
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:11,color:"var(--text-2)",fontWeight:500,marginBottom:4}}>
                      Date range
                    </label>
                    <select value={selBlock.config.range||"30d"}
                      onChange={e=>updateBlock(selBlock.id,{config:{...selBlock.config,range:e.target.value}})}
                      style={{width:"100%",padding:"7px 9px",border:"1px solid var(--border)",
                        borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",
                        color:"var(--text)",outline:"none",appearance:"none" as const}}>
                      <option value="7d">Next 7 days</option>
                      <option value="30d">Next 30 days</option>
                      <option value="90d">Next 90 days</option>
                      <option value="all">Full project</option>
                    </select>
                  </div>
                )}
                <div style={{padding:"10px 12px",background:"var(--surface)",borderRadius:"var(--radius)",
                  fontSize:12,color:"var(--text-3)"}}>
                  <strong style={{display:"block",marginBottom:4,color:"var(--text-2)"}}>Block type</strong>
                  {BLOCK_TYPES.find(bt=>bt.id===selBlock.type)?.desc}
                </div>
              </div>
            )}
          </div>
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
