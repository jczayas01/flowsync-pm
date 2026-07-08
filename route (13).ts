"use client"
// src/components/documents/DocumentEditor.tsx
// Rich-text project wiki editor — block-based, stored per project
import { useState, useRef, useCallback } from "react"

interface DocBlock {
  id:      string
  type:    "h1"|"h2"|"h3"|"p"|"bullet"|"numbered"|"code"|"quote"|"divider"|"callout"
  content: string
  meta?:   { calloutType?:"info"|"warning"|"success"|"danger"; language?:string }
}

const BLOCK_ICONS: Record<string,string> = {
  h1:"H1", h2:"H2", h3:"H3", p:"¶",
  bullet:"•", numbered:"1.", code:"</>",
  quote:""", divider:"—", callout:"💡",
}

const CALLOUT_COLORS = {
  info:    { bg:"#EFF6FF", border:"#BFDBFE", icon:"💡", color:"#1E40AF" },
  warning: { bg:"#FFFBEB", border:"#FDE68A", icon:"⚠️", color:"#92400E" },
  success: { bg:"#ECFDF5", border:"#A7F3D0", icon:"✅", color:"#065F46" },
  danger:  { bg:"#FEF2F2", border:"#FECACA", icon:"🚨", color:"#991B1B" },
}

function uid() { return `b${Date.now()}-${Math.random().toString(36).slice(2,7)}` }

const DEFAULT_BLOCKS: DocBlock[] = [
  { id:uid(), type:"h1",     content:"Project documentation" },
  { id:uid(), type:"p",      content:"Use this space for meeting notes, decisions, technical specifications, and any other project documentation." },
  { id:uid(), type:"h2",     content:"Meeting notes" },
  { id:uid(), type:"p",      content:"" },
  { id:uid(), type:"h2",     content:"Technical decisions" },
  { id:uid(), type:"callout",content:"Record key architectural and technical decisions here so the team has context.",
    meta:{ calloutType:"info" } },
  { id:uid(), type:"h2",     content:"Open items" },
  { id:uid(), type:"bullet", content:"" },
]

export function DocumentEditor({ projectId, workspaceId, initialBlocks, readonly=false }:{
  projectId:string; workspaceId:string; initialBlocks?:DocBlock[]; readonly?:boolean
}) {
  const [blocks, setBlocks]   = useState<DocBlock[]>(initialBlocks || DEFAULT_BLOCKS)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [focused, setFocused] = useState<string|null>(null)
  const [showMenu,setShowMenu]= useState<string|null>(null)
  const refs = useRef<Record<string,HTMLElement|null>>({})

  // ── Block operations ─────────────────────────────
  function updateContent(id:string, content:string) {
    setBlocks(b => b.map(bl => bl.id===id ? {...bl,content} : bl))
    setSaved(false)
  }

  function addBlock(afterId:string, type:DocBlock["type"]="p") {
    const idx = blocks.findIndex(b=>b.id===afterId)
    const newBlock:DocBlock = { id:uid(), type, content:"", meta:{} }
    setBlocks(b=>[...b.slice(0,idx+1), newBlock, ...b.slice(idx+1)])
    setTimeout(()=>refs.current[newBlock.id]?.focus(), 50)
    setShowMenu(null)
  }

  function deleteBlock(id:string) {
    if(blocks.length<=1) return
    const idx = blocks.findIndex(b=>b.id===id)
    setBlocks(b=>b.filter(bl=>bl.id!==id))
    const prevId = blocks[idx-1]?.id
    if(prevId) setTimeout(()=>refs.current[prevId]?.focus(), 50)
  }

  function changeType(id:string, type:DocBlock["type"]) {
    setBlocks(b=>b.map(bl=>bl.id===id?{...bl,type,meta:{}}:bl))
    setShowMenu(null)
    setTimeout(()=>refs.current[id]?.focus(), 50)
  }

  function handleKeyDown(e:React.KeyboardEvent, block:DocBlock) {
    if(e.key==="Enter" && !e.shiftKey) {
      e.preventDefault()
      const nextType = ["bullet","numbered"].includes(block.type) && !block.content ? "p" :
                       ["bullet","numbered"].includes(block.type) ? block.type : "p"
      if(["bullet","numbered"].includes(block.type) && !block.content) {
        changeType(block.id,"p"); return
      }
      addBlock(block.id, nextType)
    }
    if(e.key==="Backspace" && !block.content) {
      e.preventDefault()
      if(block.type!=="p") { changeType(block.id,"p"); return }
      deleteBlock(block.id)
    }
    if(e.key==="/" && !block.content) {
      e.preventDefault()
      setShowMenu(block.id)
    }
  }

  // ── Save ──────────────────────────────────────────
  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/documents`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ blocks, workspaceId })
      })
      setSaved(true)
      setTimeout(()=>setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  // ── Render block ──────────────────────────────────
  function renderBlock(block:DocBlock) {
    const isFocused = focused===block.id
    const baseStyle: React.CSSProperties = {
      width:"100%", border:"none", outline:"none", background:"transparent",
      fontFamily:"var(--font)", resize:"none", wordBreak:"break-word",
      caretColor:"var(--steel)",
    }

    const STYLES: Record<string,React.CSSProperties> = {
      h1:       { fontSize:30, fontWeight:700, color:"var(--text)",     lineHeight:1.2, padding:"4px 0" },
      h2:       { fontSize:22, fontWeight:600, color:"var(--text)",     lineHeight:1.3, padding:"4px 0" },
      h3:       { fontSize:17, fontWeight:600, color:"var(--text-2)",   lineHeight:1.4, padding:"3px 0" },
      p:        { fontSize:14, color:"var(--text-2)", lineHeight:1.75,  padding:"2px 0" },
      bullet:   { fontSize:14, color:"var(--text-2)", lineHeight:1.75,  padding:"2px 0" },
      numbered: { fontSize:14, color:"var(--text-2)", lineHeight:1.75,  padding:"2px 0" },
      code:     { fontSize:13, fontFamily:"monospace", color:"#7C3AED", lineHeight:1.65,
                  background:"#F5F3FF", padding:"12px 16px", borderRadius:8, border:"1px solid #DDD6FE" },
      quote:    { fontSize:15, fontStyle:"italic", color:"var(--text-3)", lineHeight:1.75,
                  borderLeft:"3px solid var(--border-strong,#CBD5E1)", paddingLeft:16, padding:"4px 0 4px 16px" },
    }

    if(block.type==="divider") {
      return (
        <div key={block.id} style={{margin:"12px 0",position:"relative"}}
          onClick={()=>!readonly&&addBlock(block.id)}>
          <hr style={{border:"none",borderTop:"2px solid var(--border)",margin:0}}/>
        </div>
      )
    }

    if(block.type==="callout") {
      const ct = block.meta?.calloutType||"info"
      const cc = CALLOUT_COLORS[ct]
      return (
        <div key={block.id} style={{background:cc.bg,border:`1px solid ${cc.border}`,
          borderRadius:8,padding:"12px 16px",margin:"4px 0",display:"flex",gap:10,position:"relative"}}>
          <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{cc.icon}</span>
          <textarea value={block.content} readOnly={readonly}
            ref={el=>{ refs.current[block.id]=el }}
            style={{...baseStyle,flex:1,fontSize:14,color:cc.color,lineHeight:1.65,minHeight:24}}
            placeholder="Type a callout message…"
            onFocus={()=>setFocused(block.id)} onBlur={()=>setFocused(null)}
            onChange={e=>updateContent(block.id,e.target.value)}
            onKeyDown={e=>handleKeyDown(e,block)}
            rows={Math.max(1,block.content.split("
").length)} />
        </div>
      )
    }

    const prefix = block.type==="bullet" ? (
      <span style={{color:"var(--text-3)",fontSize:16,flexShrink:0,marginTop:3,width:18}}>•</span>
    ) : block.type==="numbered" ? (
      <span style={{color:"var(--text-3)",fontSize:13,flexShrink:0,marginTop:4,width:22,fontWeight:600}}>
        {blocks.filter(b=>b.type==="numbered").indexOf(block)+1}.
      </span>
    ) : null

    return (
      <div key={block.id} style={{display:"flex",gap:4,position:"relative",
        paddingLeft:isFocused&&!readonly?28:0,transition:"padding .15s"}}
        onMouseOver={e=>{if(!readonly)e.currentTarget.style.paddingLeft="28px"}}
        onMouseOut={e=>{if(!isFocused)e.currentTarget.style.paddingLeft="0px"}}>

        {/* Left handle */}
        {!readonly&&(
          <div style={{position:"absolute",left:0,top:6,display:"flex",alignItems:"center",gap:1,
            opacity:isFocused?1:0,transition:"opacity .1s"}}>
            <button onClick={()=>setShowMenu(showMenu===block.id?null:block.id)}
              style={{width:12,height:20,background:"none",border:"none",cursor:"pointer",
                color:"var(--text-4)",fontSize:16,lineHeight:1,padding:0,display:"flex",
                alignItems:"center",justifyContent:"center"}}
              title="Change block type">
              +
            </button>
          </div>
        )}

        {prefix}

        {block.type==="code" ? (
          <textarea value={block.content} readOnly={readonly}
            ref={el=>{ refs.current[block.id]=el }}
            style={{...baseStyle,...STYLES.code,flex:1,minHeight:60}}
            placeholder="// code here…"
            onFocus={()=>setFocused(block.id)} onBlur={()=>setFocused(null)}
            onChange={e=>updateContent(block.id,e.target.value)}
            onKeyDown={e=>handleKeyDown(e,block)}
            rows={Math.max(2,block.content.split("
").length)} />
        ) : (
          <textarea value={block.content} readOnly={readonly}
            ref={el=>{ refs.current[block.id]=el }}
            style={{...baseStyle,...(STYLES[block.type]||STYLES.p),flex:1,minHeight:24}}
            placeholder={block.type==="h1"?"Untitled":block.type==="h2"?"Heading 2":
              block.type==="h3"?"Heading 3":block.type==="quote"?"Quote…":
              block.type==="bullet"||block.type==="numbered"?"List item…":
              "Start typing — press / for commands…"}
            onFocus={()=>setFocused(block.id)} onBlur={()=>setFocused(null)}
            onChange={e=>updateContent(block.id,e.target.value)}
            onKeyDown={e=>handleKeyDown(e,block)}
            rows={1} />
        )}

        {/* Block type menu */}
        {showMenu===block.id&&(
          <div style={{position:"absolute",top:32,left:24,background:"#fff",
            border:"1px solid var(--border)",borderRadius:"var(--radius)",
            boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:50,overflow:"hidden",
            minWidth:200}}>
            <div style={{padding:"8px 12px",fontSize:10,fontWeight:600,
              color:"var(--text-3)",letterSpacing:".06em",textTransform:"uppercase",
              borderBottom:"1px solid var(--border)"}}>
              Turn into
            </div>
            {[
              {type:"h1",label:"Heading 1",icon:"H1"},
              {type:"h2",label:"Heading 2",icon:"H2"},
              {type:"h3",label:"Heading 3",icon:"H3"},
              {type:"p", label:"Paragraph", icon:"¶"},
              {type:"bullet",   label:"Bullet list",   icon:"•"},
              {type:"numbered", label:"Numbered list",  icon:"1."},
              {type:"code",     label:"Code block",    icon:"</>"},
              {type:"quote",    label:"Block quote",   icon:'"'},
              {type:"callout",  label:"Callout",       icon:"💡"},
              {type:"divider",  label:"Divider",       icon:"—"},
            ].map(opt=>(
              <button key={opt.type} onClick={()=>changeType(block.id,opt.type as any)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                  padding:"8px 12px",border:"none",background:"none",cursor:"pointer",
                  fontFamily:"var(--font)",fontSize:13,color:"var(--text)",textAlign:"left",
                  transition:"background .1s"}}
                onMouseOver={e=>(e.currentTarget.style.background="var(--surface)")}
                onMouseOut={e=>(e.currentTarget.style.background="none")}>
                <span style={{width:24,fontSize:11,fontFamily:"monospace",
                  color:"var(--text-3)",fontWeight:600}}>
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Toolbar */}
      {!readonly&&(
        <div style={{background:"#fff",borderBottom:"1px solid var(--border)",
          padding:"8px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{fontSize:12,color:"var(--text-3)"}}>
            {blocks.length} block{blocks.length!==1?"s":""}
          </span>
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            {saved&&<span style={{fontSize:12,color:"var(--green)",display:"flex",
              alignItems:"center",gap:4}}>✓ Saved</span>}
            <button onClick={save} disabled={saving}
              style={{padding:"6px 14px",background:"var(--steel)",color:"#fff",border:"none",
                borderRadius:"var(--radius)",fontSize:12,fontWeight:500,cursor:"pointer",
                fontFamily:"var(--font)",opacity:saving?0.7:1}}>
              {saving?"Saving…":"Save"}
            </button>
          </div>
        </div>
      )}

      {/* Editor canvas */}
      <div style={{flex:1,overflowY:"auto",padding:"32px 48px",background:"#fff"}}
        onClick={()=>setShowMenu(null)}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          {blocks.map(block=>renderBlock(block))}
          {!readonly&&(
            <div onClick={()=>addBlock(blocks[blocks.length-1]?.id||"","p")}
              style={{padding:"8px 0",color:"var(--text-4)",fontSize:13,cursor:"text",
                marginTop:8}}>
              Click to add a new block…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
