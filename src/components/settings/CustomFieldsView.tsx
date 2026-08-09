"use client"
// src/components/settings/CustomFieldsView.tsx
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Badge, EmptyState } from "@/components/ui"

type FieldType = "text"|"number"|"date"|"select"|"multiselect"|"checkbox"|"url"|"email"|"currency"

interface CustomField {
  id:       string
  name:     string
  type:     FieldType
  entity:   "project"|"task"
  required: boolean
  options?: string[]  // for select/multiselect
  description?: string
  isActive: boolean
}

const FIELD_TYPE_META: Record<FieldType,{icon:string;label:string;desc:string}> = {
  text:        { icon:"Aa",   label:"cfText",         desc:"cfTextDesc" },
  number:      { icon:"#",    label:"cfNumber",        desc:"cfNumberDesc" },
  date:        { icon:"📅",   label:"cfDate",          desc:"cfDateDesc" },
  select:      { icon:"▾",    label:"cfDropdown",      desc:"cfDropdownDesc" },
  multiselect: { icon:"☑",    label:"cfMultiselect",  desc:"cfMultiselectDesc" },
  checkbox:    { icon:"✓",    label:"cfCheckbox",      desc:"cfCheckboxDesc" },
  url:         { icon:"🔗",   label:"cfUrl",           desc:"cfUrlDesc" },
  email:       { icon:"@",    label:"cfEmail",         desc:"cfEmailDesc" },
  currency:    { icon:"$",    label:"cfCurrency",      desc:"cfCurrencyDesc" },
}

// Field rows are loaded from the server (see the settings page) — no sample data.


export function CustomFieldsView({ workspaceId, role, initialFields=[] }:{ workspaceId:string; role:string; initialFields?:CustomField[] }) {
  const cf = useTranslations("customFields")
  const canEdit = ["SUPER_ADMIN","OWNER","ADMIN"].includes(role)
  const [fields, setFields]   = useState<CustomField[]>(initialFields)
  const [entity, setEntity]   = useState<"project"|"task"|"all">("all")
  const [creating, setCreating]= useState(false)
  const [form, setForm]       = useState<Partial<CustomField>>({
    name:"", type:"text", entity:"project", required:false, isActive:true, options:[]
  })
  const [newOption, setNewOption] = useState("")
  const [saving, setSaving]   = useState(false)
  const [toast,  setToast]    = useState("")

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(""),3000) }

  const filtered = fields.filter(f=>entity==="all"||f.entity===entity)

  function addOption() {
    if(!newOption.trim()) return
    setForm(f=>({...f, options:[...(f.options||[]),newOption.trim()]}))
    setNewOption("")
  }

  function removeOption(opt:string) {
    setForm(f=>({...f,options:(f.options||[]).filter(o=>o!==opt)}))
  }

  async function saveField(e:React.FormEvent) {
    e.preventDefault()
    if(!form.name?.trim()||!form.type||!form.entity) return
    setSaving(true)
    try {
      const res = await fetch("/api/custom-fields", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form, workspaceId})
      })
      if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error||"Save failed") }
      const { data } = await res.json()
      setFields(f=>[...f, data])
      showToast("✓ Custom field created")
      setCreating(false)
      setForm({name:"",type:"text",entity:"project",required:false,isActive:true,options:[]})
    } catch(e:any){ showToast("✗ "+(e.message||"Failed to save")) }
    finally { setSaving(false) }
  }

  async function toggleField(id:string) {
    const cur = fields.find(f=>f.id===id); if(!cur) return
    setFields(f=>f.map(fl=>fl.id===id?{...fl,isActive:!fl.isActive}:fl))
    await fetch(`/api/custom-fields/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ isActive:!cur.isActive }) }).catch(()=>{})
  }

  async function deleteField(id:string) {
    if(!confirm(cf("confirmDelete"))) return
    const res = await fetch(`/api/custom-fields/${id}`, { method:"DELETE" })
    if(res.ok){ setFields(f=>f.filter(fl=>fl.id!==id)); showToast("Field deleted") }
    else showToast("✗ Delete failed")
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 10px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none"
  }
  const selStyle: React.CSSProperties = {
    ...inp, appearance:"none" as const, cursor:"pointer",
    background:"#fff"
  }

  return (
    <div style={{maxWidth:760,position:"relative"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:4}}>{cf("Custom fields")}</h2>
        <p style={{fontSize:13,color:"var(--text-3)"}}>
          Add custom fields to projects and tasks to track data specific to your organization.
        </p>
      </div>

      {/* Entity filter + action */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        {[["all","All fields"],["project","Projects"],["task","Tasks"]].map(([id,label])=>(
          <button key={id} onClick={()=>setEntity(id as any)}
            style={{padding:"6px 12px",border:"1px solid var(--border)",borderRadius:20,
              fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
              background:entity===id?"var(--steel)":"#fff",
              color:entity===id?"#fff":"var(--text-3)",
              borderColor:entity===id?"var(--steel)":"var(--border)"}}>
            {label}
          </button>
        ))}
        {canEdit&&(
          <button onClick={()=>setCreating(true)}
            style={{marginLeft:"auto",padding:"7px 14px",background:"var(--steel)",color:"#fff",
              border:"none",borderRadius:"var(--radius)",fontSize:12,fontWeight:500,
              cursor:"pointer",fontFamily:"var(--font)"}}>
            + New field
          </button>
        )}
      </div>

      {/* Create form */}
      {creating&&(
        <form onSubmit={saveField} style={{background:"#fff",border:"2px solid var(--steel)",
          borderRadius:"var(--radius)",padding:20,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:16}}>
            New custom field
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                {cf("Field name *")}
              </label>
              <input autoFocus value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder={cf("phFieldName")} style={inp} />
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                {cf("Field type *")}
              </label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as any}))}
                style={selStyle}>
                {Object.entries(FIELD_TYPE_META).map(([id,meta])=>(
                  <option key={id} value={id}>{meta.icon} {cf(meta.label as any)}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                {cf("Applied to")}
              </label>
              <select value={form.entity} onChange={e=>setForm(f=>({...f,entity:e.target.value as any}))}
                style={selStyle}>
                <option value="project">{cf("Projects")}</option>
                <option value="task">{cf("Tasks")}</option>
              </select>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:20}}>
              <input type="checkbox" id="req" checked={form.required||false}
                onChange={e=>setForm(f=>({...f,required:e.target.checked}))}
                style={{width:16,height:16,cursor:"pointer",accentColor:"var(--steel)"}} />
              <label htmlFor="req" style={{fontSize:13,color:"var(--text-2)",cursor:"pointer"}}>
                {cf("Required field")}
              </label>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
              {cf("Description (optional)")}
            </label>
            <input value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder={cf("phHelpText")} style={inp} />
          </div>
          {/* Options for select/multiselect */}
          {(form.type==="select"||form.type==="multiselect")&&(
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:11,fontWeight:500,color:"var(--text-2)",marginBottom:4}}>
                {cf("Options")}
              </label>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={newOption} onChange={e=>setNewOption(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addOption() } }}
                  placeholder={cf("Add option…")} style={{...inp,flex:1}} />
                <button type="button" onClick={addOption}
                  style={{padding:"8px 14px",background:"var(--surface)",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",fontSize:12,cursor:"pointer",fontFamily:"var(--font)"}}>
                  {cf("Add")}
                </button>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(form.options||[]).map(opt=>(
                  <div key={opt} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",
                    background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,fontSize:12}}>
                    {opt}
                    <button type="button" onClick={()=>removeOption(opt)}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:14,
                        color:"var(--text-3)",lineHeight:1,padding:0}}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={()=>setCreating(false)}
              style={{padding:"8px 16px",background:"#fff",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",fontSize:13,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
              {cf("Cancel")}
            </button>
            <button type="submit" disabled={!form.name?.trim()||saving}
              style={{padding:"8px 18px",background:"var(--steel)",color:"#fff",border:"none",
                borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",
                opacity:!form.name?.trim()?0.5:1}}>
              {saving?cf("Saving…"):cf("Create field")}
            </button>
          </div>
        </form>
      )}

      {/* Fields list */}
      {filtered.length===0?(
        <EmptyState icon="⚙️" title={cf("No custom fields yet")}
          description={cf("emptyBody",{e:entity==="all"?cf("projectAndTask"):cf(entity as any)})} />
      ):(
        <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 100px 90px 80px auto",
            gap:10,padding:"8px 16px",background:"var(--surface)",borderBottom:"1px solid var(--border)",
            fontSize:10,fontWeight:600,color:"var(--text-3)",letterSpacing:".05em",textTransform:"uppercase"}}>
            <div>{cf("Field")}</div><div>{cf("Type")}</div><div>{cf("Applied to")}</div><div>{cf("Status")}</div><div/>
          </div>
          {filtered.map(field=>{
            const meta = FIELD_TYPE_META[field.type]
            return (
              <div key={field.id}
                style={{display:"grid",gridTemplateColumns:"1fr 100px 90px 80px auto",
                  gap:10,padding:"12px 16px",alignItems:"center",
                  borderBottom:"1px solid var(--surface-1,#F1F5F9)",
                  opacity:field.isActive?1:0.55}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                    <span style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{field.name}</span>
                    {field.required&&(
                      <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,
                        background:"#FEF2F2",color:"var(--red)"}}>{cf("Required")}</span>
                    )}
                  </div>
                  {field.description&&(
                    <div style={{fontSize:11,color:"var(--text-3)"}}>{field.description}</div>
                  )}
                  {field.options&&field.options.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                      {field.options.slice(0,4).map(opt=>(
                        <span key={opt} style={{fontSize:10,padding:"1px 6px",borderRadius:3,
                          background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-3)"}}>
                          {opt}
                        </span>
                      ))}
                      {field.options.length>4&&(
                        <span style={{fontSize:10,color:"var(--text-4)"}}>+{field.options.length-4} more</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
                  <span style={{fontSize:13,color:"var(--text-3)"}}>{meta.icon}</span>
                  <span style={{color:"var(--text-2)"}}>{meta.label}</span>
                </div>
                <div>
                  <Badge variant={field.entity==="project"?"blue":"green"}>
                    {field.entity==="project"?"Project":"Task"}
                  </Badge>
                </div>
                <div>
                  {canEdit?(
                    <button onClick={()=>toggleField(field.id)}
                      style={{width:36,height:20,borderRadius:10,border:"none",cursor:"pointer",
                        position:"relative",transition:"background .2s",
                        background:field.isActive?"var(--green)":"var(--border-strong,#CBD5E1)"}}>
                      <div style={{position:"absolute",top:2,width:16,height:16,borderRadius:"50%",
                        background:"#fff",transition:"left .2s",
                        left:field.isActive?18:2}}/>
                    </button>
                  ):(
                    <Badge variant={field.isActive?"green":"gray"}>
                      {field.isActive?"Active":"Inactive"}
                    </Badge>
                  )}
                </div>
                {canEdit&&(
                  <button onClick={()=>deleteField(field.id)}
                    style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",
                      cursor:"pointer",fontFamily:"var(--font)",padding:"4px 8px",borderRadius:4,
                      transition:"all .15s"}}
                    onMouseOver={e=>{e.currentTarget.style.color="var(--red)";e.currentTarget.style.background="#FEF2F2"}}
                    onMouseOut={e=>{e.currentTarget.style.color="var(--text-3)";e.currentTarget.style.background="none"}}>
                    Delete
                  </button>
                )}
              </div>
            )
          })}
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
