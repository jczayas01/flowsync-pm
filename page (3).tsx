"use client"
// src/components/resources/SkillsView.tsx
import { useState } from "react"
import { Avatar, Badge, EmptyState } from "@/components/ui"

const SKILL_CATEGORIES = [
  "Healthcare IT", "Technical", "Management", "Compliance", "Design", "Finance", "Construction"
]

const SAMPLE_MEMBERS = [
  { id:"u1", name:"Juan Carlos Zayas", role:"ADMIN", avatarUrl:null,
    skills:["Project Management","Healthcare IT","HIPAA Compliance","HL7/FHIR","Stakeholder Management"] },
  { id:"u2", name:"Ana González",      role:"PROJECT_MANAGER", avatarUrl:null,
    skills:["HIPAA Compliance","Risk Management","Healthcare IT","Documentation"] },
  { id:"u3", name:"Luis Rodriguez",    role:"PROJECT_MANAGER", avatarUrl:null,
    skills:["Cloud Architecture","AWS","Azure","DevOps","Network Engineering"] },
  { id:"u4", name:"María Acevedo",     role:"TEAM_MEMBER", avatarUrl:null,
    skills:["Training & Development","Change Management","Healthcare IT"] },
  { id:"u5", name:"Carlos Méndez",     role:"TEAM_MEMBER", avatarUrl:null,
    skills:["HL7/FHIR","SQL","System Integration","EHR Systems"] },
]

export function SkillsView({ members: initialMembers, workspaceId }:{
  members:any[]; workspaceId:string
}) {
  const members = initialMembers.length>0 ? initialMembers : SAMPLE_MEMBERS
  const isDemo  = initialMembers.length===0

  const [search,       setSearch]       = useState("")
  const [filterSkill,  setFilterSkill]  = useState("")
  const [editMember,   setEditMember]   = useState<string|null>(null)
  const [localMembers, setLocalMembers] = useState(members)
  const [newSkill,     setNewSkill]     = useState("")
  const [toast,        setToast]        = useState("")

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000) }

  // All unique skills across the workspace
  const allSkills = [...new Set(localMembers.flatMap(m=>m.skills||[]))].sort()

  const filtered = localMembers.filter(m=>{
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.skills||[]).some((s:string)=>s.toLowerCase().includes(search.toLowerCase()))
    const matchSkill = !filterSkill || (m.skills||[]).includes(filterSkill)
    return matchSearch && matchSkill
  })

  function addSkill(memberId:string) {
    if(!newSkill.trim()) return
    setLocalMembers(ms=>ms.map(m=>m.id===memberId
      ? {...m, skills:[...(m.skills||[]), newSkill.trim()]}
      : m
    ))
    setNewSkill("")
    showToast(`✓ Skill added`)
  }

  function removeSkill(memberId:string, skill:string) {
    setLocalMembers(ms=>ms.map(m=>m.id===memberId
      ? {...m, skills:(m.skills||[]).filter((s:string)=>s!==skill)}
      : m
    ))
  }

  async function saveSkills(memberId:string) {
    const member = localMembers.find(m=>m.id===memberId)
    try {
      await fetch(`/api/users/${memberId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ skills: member?.skills })
      })
      showToast("✓ Skills saved")
    } catch { showToast("✗ Save failed") }
    setEditMember(null)
  }

  // Skill frequency for the bubble chart
  const skillFreq = allSkills.map(skill=>({
    skill,
    count:localMembers.filter(m=>(m.skills||[]).includes(skill)).length,
    members:localMembers.filter(m=>(m.skills||[]).includes(skill)).map(m=>m.name),
  })).sort((a,b)=>b.count-a.count)

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"14px 20px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",marginBottom:2}}>
              Skill directory
            </h1>
            <p style={{fontSize:12,color:"var(--text-3)"}}>
              {localMembers.length} team member{localMembers.length!==1?"s":""} · {allSkills.length} unique skills
              {isDemo&&" · "}{isDemo&&<span style={{color:"var(--amber)",fontWeight:500}}>Sample data</span>}
            </p>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:20}}>

        {/* Skill cloud */}
        <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"var(--radius)",
          padding:16,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:12}}>
            Skills across your team
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {skillFreq.map(({skill,count})=>{
              const size = 10 + count*2
              const active = filterSkill===skill
              return (
                <button key={skill} onClick={()=>setFilterSkill(active?"":skill)}
                  title={`${count} team member${count!==1?"s":""} have this skill`}
                  style={{padding:`${Math.max(4,count*2)}px ${Math.max(10,count*4)}px`,
                    border:`1.5px solid ${active?"var(--steel)":"var(--border)"}`,
                    borderRadius:20, fontSize:Math.max(11,10+count),fontWeight:500,
                    cursor:"pointer",fontFamily:"var(--font)",
                    background:active?"var(--steel-pale,#EFF6FF)":"#fff",
                    color:active?"var(--steel)":"var(--text-2)",
                    transition:"all .15s"}}>
                  {skill}
                  <span style={{marginLeft:5,fontSize:10,opacity:.7,fontWeight:600}}>×{count}</span>
                </button>
              )
            })}
          </div>
          {filterSkill&&(
            <div style={{marginTop:10,fontSize:12,color:"var(--steel)",display:"flex",
              alignItems:"center",gap:8}}>
              Filtering by: <strong>{filterSkill}</strong>
              <button onClick={()=>setFilterSkill("")}
                style={{background:"none",border:"none",cursor:"pointer",
                  color:"var(--text-3)",fontSize:16,lineHeight:1}}>×</button>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{marginBottom:14,display:"flex",gap:8}}>
          <input placeholder="Search members or skills…" value={search}
            onChange={e=>setSearch(e.target.value)}
            style={{padding:"7px 11px",border:"1px solid var(--border)",borderRadius:"var(--radius)",
              fontSize:12,fontFamily:"var(--font)",outline:"none",width:240}} />
          <span style={{fontSize:12,color:"var(--text-3)",display:"flex",alignItems:"center"}}>
            {filtered.length} member{filtered.length!==1?"s":""}
          </span>
        </div>

        {/* Member skill cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
          {filtered.map(m=>{
            const isEditing = editMember===m.id
            return (
              <div key={m.id} style={{background:"#fff",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",padding:16,
                borderColor:isEditing?"var(--steel)":"var(--border)",
                borderWidth:isEditing?2:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size={36}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{m.name}</div>
                    <div style={{fontSize:11,color:"var(--text-3)"}}>
                      {m.role?.replace(/_/g," ")}
                    </div>
                  </div>
                  <button onClick={()=>setEditMember(isEditing?null:m.id)}
                    style={{fontSize:11,color:"var(--steel)",background:"none",border:"none",
                      cursor:"pointer",fontFamily:"var(--font)",fontWeight:500}}>
                    {isEditing?"Done":"Edit"}
                  </button>
                </div>

                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:isEditing?12:0}}>
                  {(m.skills||[]).map((skill:string)=>(
                    <div key={skill} style={{display:"flex",alignItems:"center",gap:4,
                      padding:"3px 10px",borderRadius:20,fontSize:12,
                      background:filterSkill===skill?"var(--steel-pale,#EFF6FF)":"var(--surface)",
                      border:`1px solid ${filterSkill===skill?"var(--steel)":"var(--border)"}`,
                      color:filterSkill===skill?"var(--steel)":"var(--text-2)"}}>
                      {skill}
                      {isEditing&&(
                        <button onClick={()=>removeSkill(m.id,skill)}
                          style={{background:"none",border:"none",cursor:"pointer",
                            fontSize:14,color:"var(--text-3)",lineHeight:1,padding:0}}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {(m.skills||[]).length===0&&(
                    <span style={{fontSize:12,color:"var(--text-4)"}}>No skills listed</span>
                  )}
                </div>

                {isEditing&&(
                  <div>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      <input value={newSkill} onChange={e=>setNewSkill(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addSkill(m.id) } }}
                        placeholder="Add skill…" autoFocus
                        style={{flex:1,padding:"6px 9px",border:"1px solid var(--border)",
                          borderRadius:"var(--radius)",fontSize:12,fontFamily:"var(--font)",outline:"none"}} />
                      <button onClick={()=>addSkill(m.id)}
                        style={{padding:"6px 12px",background:"var(--surface)",
                          border:"1px solid var(--border)",borderRadius:"var(--radius)",
                          fontSize:12,cursor:"pointer",fontFamily:"var(--font)"}}>
                        Add
                      </button>
                    </div>
                    {/* Quick suggestions */}
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:10,color:"var(--text-3)",marginBottom:4}}>
                        Common skills:
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {["Project Management","HIPAA Compliance","HL7/FHIR","Risk Management",
                          "Agile/Scrum","SQL","Power BI","SharePoint","Azure","Change Management"]
                          .filter(s=>!(m.skills||[]).includes(s))
                          .slice(0,6)
                          .map(s=>(
                          <button key={s} onClick={()=>{
                            setLocalMembers(ms=>ms.map(mm=>mm.id===m.id
                              ?{...mm,skills:[...(mm.skills||[]),s]}:mm))
                          }}
                            style={{padding:"2px 8px",background:"none",
                              border:"1px dashed var(--border-strong,#CBD5E1)",borderRadius:20,
                              fontSize:11,cursor:"pointer",fontFamily:"var(--font)",
                              color:"var(--text-3)",transition:"all .1s"}}
                            onMouseOver={e=>{e.currentTarget.style.borderColor="var(--steel)";e.currentTarget.style.color="var(--steel)"}}
                            onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border-strong)";e.currentTarget.style.color="var(--text-3)"}}>
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={()=>saveSkills(m.id)}
                      style={{width:"100%",padding:"7px",background:"var(--steel)",color:"#fff",
                        border:"none",borderRadius:"var(--radius)",fontSize:12,fontWeight:500,
                        cursor:"pointer",fontFamily:"var(--font)"}}>
                      Save skills
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

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
