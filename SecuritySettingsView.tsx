"use client"
// src/components/automation/AutomationView.tsx
import { useState } from "react"
import { Badge, EmptyState } from "@/components/ui"

// ── Recipe library ─────────────────────────────
const RECIPES = [
  { id:"task-overdue",       icon:"⏰", name:"Task overdue alert",         trigger:"TASK_OVERDUE",       action:"NOTIFY_PM",            desc:"Notify the PM when a task passes its due date." },
  { id:"health-red",         icon:"🔴", name:"Project goes red",           trigger:"PROJECT_HEALTH_RED",  action:"NOTIFY_STAKEHOLDERS",  desc:"Alert all stakeholders when project health drops to RED." },
  { id:"milestone-soon",     icon:"🎯", name:"Milestone approaching",      trigger:"MILESTONE_DUE_SOON",  action:"SEND_EMAIL",           desc:"Email the team 7 days before a milestone is due." },
  { id:"budget-80",          icon:"💰", name:"Budget at 80%",              trigger:"BUDGET_THRESHOLD",    action:"NOTIFY_PM",            desc:"Alert the PM when budget spend reaches 80%." },
  { id:"task-done",          icon:"✅", name:"Task completed → next task", trigger:"TASK_STATUS_CHANGED", action:"UPDATE_TASK_STATUS",   desc:"Auto-activate the next task when the current one completes." },
  { id:"weekly-report",      icon:"📊", name:"Weekly status report",       trigger:"SCHEDULE_WEEKLY",     action:"GENERATE_AI_REPORT",   desc:"Generate and email an AI status report every Monday morning." },
  { id:"risk-high",          icon:"⚠",  name:"High risk logged",           trigger:"RISK_CREATED",        action:"NOTIFY_SPONSOR",       desc:"Notify the project sponsor when a high-score risk is logged." },
  { id:"member-invited",     icon:"👥", name:"New member welcome",         trigger:"MEMBER_ADDED",        action:"SEND_EMAIL",           desc:"Send a welcome email when a new member joins the workspace." },
  { id:"project-created",    icon:"📁", name:"Project created checklist",  trigger:"PROJECT_CREATED",     action:"CREATE_TASKS",         desc:"Auto-create a standard kickoff task checklist on new projects." },
  { id:"change-approved",    icon:"↻",  name:"Change request approved",    trigger:"CHANGE_APPROVED",     action:"UPDATE_BASELINE",      desc:"Update the project baseline when a change request is approved." },
]

const TRIGGERS = [
  { group:"Tasks",    items:["TASK_CREATED","TASK_STATUS_CHANGED","TASK_OVERDUE","TASK_ASSIGNED"] },
  { group:"Projects", items:["PROJECT_CREATED","PROJECT_HEALTH_RED","PROJECT_HEALTH_AMBER","PROJECT_COMPLETED","BUDGET_THRESHOLD"] },
  { group:"Schedule", items:["SCHEDULE_DAILY","SCHEDULE_WEEKLY","SCHEDULE_MONTHLY","MILESTONE_DUE_SOON"] },
  { group:"Risks",    items:["RISK_CREATED","RISK_STATUS_CHANGED","CHANGE_APPROVED"] },
  { group:"Team",     items:["MEMBER_ADDED","USER_ROLE_CHANGED"] },
]

const ACTIONS = [
  "NOTIFY_PM","NOTIFY_STAKEHOLDERS","NOTIFY_SPONSOR","SEND_EMAIL","SEND_SLACK",
  "UPDATE_TASK_STATUS","UPDATE_PROJECT_HEALTH","UPDATE_BASELINE",
  "CREATE_TASKS","GENERATE_AI_REPORT","LOG_AUDIT_EVENT",
]

const TRIGGER_LABEL: Record<string,string> = {
  TASK_CREATED:"Task created", TASK_STATUS_CHANGED:"Task status changes",
  TASK_OVERDUE:"Task becomes overdue", TASK_ASSIGNED:"Task is assigned",
  PROJECT_CREATED:"Project created", PROJECT_HEALTH_RED:"Project health → RED",
  PROJECT_HEALTH_AMBER:"Project health → AMBER", PROJECT_COMPLETED:"Project completed",
  BUDGET_THRESHOLD:"Budget threshold reached",
  SCHEDULE_DAILY:"Every day at 9am", SCHEDULE_WEEKLY:"Every Monday at 9am",
  SCHEDULE_MONTHLY:"1st of every month", MILESTONE_DUE_SOON:"Milestone due in 7 days",
  RISK_CREATED:"Risk logged", RISK_STATUS_CHANGED:"Risk status changes",
  CHANGE_APPROVED:"Change request approved",
  MEMBER_ADDED:"Member added to workspace", USER_ROLE_CHANGED:"User role changed",
}

const ACTION_LABEL: Record<string,string> = {
  NOTIFY_PM:"Notify project manager", NOTIFY_STAKEHOLDERS:"Notify all stakeholders",
  NOTIFY_SPONSOR:"Notify project sponsor", SEND_EMAIL:"Send email",
  SEND_SLACK:"Send Slack message", UPDATE_TASK_STATUS:"Update task status",
  UPDATE_PROJECT_HEALTH:"Update project health", UPDATE_BASELINE:"Update project baseline",
  CREATE_TASKS:"Create tasks from template", GENERATE_AI_REPORT:"Generate AI status report",
  LOG_AUDIT_EVENT:"Log to audit trail",
}

interface RuleForm { name:string; trigger:string; condition:string; action:string; isActive:boolean }

export function AutomationView({ rules, recentLogs, workspaceId, userRole }:{
  rules:any[]; recentLogs:any[]; workspaceId:string; userRole:string
}) {
  const [tab, setTab]         = useState<"rules"|"recipes"|"logs">("rules")
  const [building, setBuilding] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState("")
  const [form,     setForm]     = useState<RuleForm>({
    name:"", trigger:"", condition:"", action:"", isActive:true
  })

  // Local rules list (merge with server on mount in real app)
  const [localRules, setLocalRules] = useState<any[]>(rules)

  function showToast(msg:string) { setToast(msg); setTimeout(()=>setToast(""),3000) }

  async function saveRule(e:React.FormEvent) {
    e.preventDefault()
    if(!form.name.trim()||!form.trigger||!form.action) return
    setSaving(true)
    try {
      const res = await fetch("/api/automation/rules", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify(form)
      })
      if(!res.ok) throw new Error((await res.json()).error||"Failed")
      const { data } = await res.json()
      setLocalRules(r=>[data,...r])
      showToast("✓ Automation rule created")
      setBuilding(false)
      setForm({name:"",trigger:"",condition:"",action:"",isActive:true})
    } catch(e:any){ showToast(`✗ ${e.message}`) }
    finally { setSaving(false) }
  }

  async function toggleRule(id:string, isActive:boolean) {
    await fetch(`/api/automation/rules/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({isActive:!isActive})
    })
    setLocalRules(r=>r.map(rule=>rule.id===id?{...rule,isActive:!isActive}:rule))
  }

  async function deleteRule(id:string) {
    if(!confirm("Delete this automation rule?")) return
    await fetch(`/api/automation/rules/${id}`,{method:"DELETE"})
    setLocalRules(r=>r.filter(rule=>rule.id!==id))
    showToast("Rule deleted")
  }

  async function installRecipe(recipe:typeof RECIPES[0]) {
    setSaving(true)
    try {
      const res = await fetch("/api/automation/rules", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          name:recipe.name, trigger:recipe.trigger,
          action:recipe.action, isActive:true
        })
      })
      if(!res.ok) throw new Error()
      const { data } = await res.json()
      setLocalRules(r=>[data,...r])
      showToast(`✓ "${recipe.name}" installed`)
      setTab("rules")
    } catch { showToast("✗ Install failed") }
    finally { setSaving(false) }
  }

  const canManage = !["READ_ONLY","CLIENT","TEAM_MEMBER"].includes(userRole)

  const sel: React.CSSProperties = {
    width:"100%", padding:"9px 26px 9px 10px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", appearance:"none" as const, cursor:"pointer",
    background:"url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E") right 8px center no-repeat #fff",
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",position:"relative"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"14px 20px",flexShrink:0,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:600,color:"var(--text)",marginBottom:2}}>Automation</h1>
          <p style={{fontSize:12,color:"var(--text-3)"}}>
            {localRules.filter(r=>r.isActive).length} active rule{localRules.filter(r=>r.isActive).length!==1?"s":""}
          </p>
        </div>
        {canManage&&!building&&(
          <button onClick={()=>setBuilding(true)}
            style={{padding:"8px 16px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)"}}>
            + New rule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:"1px solid var(--border)",padding:"0 20px",flexShrink:0,display:"flex",gap:0}}>
        {[["rules","⚡ Rules"],["recipes","📦 Recipe library"],["logs","📋 Execution logs"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id as any)}
            style={{padding:"10px 14px",border:"none",background:"none",cursor:"pointer",
              fontFamily:"var(--font)",fontSize:12,fontWeight:500,whiteSpace:"nowrap",
              color:tab===id?"var(--steel)":"var(--text-3)",
              borderBottom:tab===id?"2px solid var(--steel)":"2px solid transparent",marginBottom:-1}}>
            {label}
            {id==="rules"&&localRules.length>0&&(
              <span style={{marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 6px",
                borderRadius:10,background:"var(--steel-pale,#EFF6FF)",color:"var(--steel)"}}>
                {localRules.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:20}}>

        {/* ── RULES TAB ── */}
        {tab==="rules"&&(
          <>
            {/* Builder */}
            {building&&(
              <form onSubmit={saveRule}
                style={{background:"#fff",border:"2px solid var(--steel)",borderRadius:"var(--radius)",
                  padding:20,marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:16,
                  display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:20}}>⚡</span> Build automation rule
                </div>

                {/* Rule name */}
                <div style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:11,fontWeight:500,
                    color:"var(--text-2)",marginBottom:4}}>Rule name *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    placeholder="e.g. Alert PM when task is overdue" autoFocus
                    style={{...sel,padding:"9px 12px",width:"100%"}} />
                </div>

                {/* WHEN block */}
                <div style={{background:"var(--surface)",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",padding:14,marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--steel)",letterSpacing:".08em",
                    textTransform:"uppercase",marginBottom:8}}>
                    WHEN (trigger)
                  </div>
                  <select style={sel} value={form.trigger}
                    onChange={e=>setForm(f=>({...f,trigger:e.target.value}))}>
                    <option value="">Select a trigger…</option>
                    {TRIGGERS.map(g=>(
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map(item=>(
                          <option key={item} value={item}>{TRIGGER_LABEL[item]||item}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* IF block */}
                <div style={{background:"var(--surface)",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",padding:14,marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--amber)",letterSpacing:".08em",
                    textTransform:"uppercase",marginBottom:8}}>
                    IF (condition — optional)
                  </div>
                  <input value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}
                    placeholder="e.g. task.priority = CRITICAL, budget.pct > 80"
                    style={{...sel,padding:"9px 12px",width:"100%"}} />
                  <div style={{fontSize:10,color:"var(--text-3)",marginTop:5}}>
                    Leave blank to run on every trigger. Supports: field = value, field {'>'} number
                  </div>
                </div>

                {/* THEN block */}
                <div style={{background:"var(--surface)",border:"1px solid var(--border)",
                  borderRadius:"var(--radius)",padding:14,marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--green)",letterSpacing:".08em",
                    textTransform:"uppercase",marginBottom:8}}>
                    THEN (action)
                  </div>
                  <select style={sel} value={form.action}
                    onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
                    <option value="">Select an action…</option>
                    {ACTIONS.map(a=>(
                      <option key={a} value={a}>{ACTION_LABEL[a]||a}</option>
                    ))}
                  </select>
                </div>

                {/* Preview */}
                {form.trigger&&form.action&&(
                  <div style={{background:"var(--steel-pale,#EFF6FF)",border:"1px solid rgba(27,108,168,.2)",
                    borderRadius:"var(--radius)",padding:"10px 14px",marginBottom:16,
                    fontSize:13,color:"var(--steel)",lineHeight:1.6}}>
                    <strong>Rule preview:</strong> When <em>{TRIGGER_LABEL[form.trigger]||form.trigger}</em>
                    {form.condition&&<> and <em>{form.condition}</em></>}
                    {" → "}{ACTION_LABEL[form.action]||form.action}
                  </div>
                )}

                <div style={{display:"flex",gap:8}}>
                  <button type="button" onClick={()=>{setBuilding(false);setForm({name:"",trigger:"",condition:"",action:"",isActive:true})}}
                    style={{padding:"9px 16px",background:"#fff",border:"1px solid var(--border)",
                      borderRadius:"var(--radius)",fontSize:13,cursor:"pointer",fontFamily:"var(--font)",color:"var(--text-2)"}}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving||!form.name.trim()||!form.trigger||!form.action}
                    style={{padding:"9px 20px",background:"var(--steel)",color:"#fff",border:"none",
                      borderRadius:"var(--radius)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"var(--font)",
                      opacity:(!form.name.trim()||!form.trigger||!form.action)?0.5:1}}>
                    {saving?"Saving…":"Save rule"}
                  </button>
                </div>
              </form>
            )}

            {/* Rules list */}
            {localRules.length===0&&!building?(
              <EmptyState icon="⚡" title="No automation rules yet"
                description="Create a rule or install one from the recipe library to automate your project workflows." />
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {localRules.map(rule=>(
                  <div key={rule.id} style={{background:"#fff",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",padding:"14px 16px",
                    opacity:rule.isActive?1:0.6,transition:"opacity .2s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <button onClick={()=>toggleRule(rule.id,rule.isActive)}
                        style={{width:36,height:20,borderRadius:10,border:"none",cursor:"pointer",
                          position:"relative",flexShrink:0,transition:"background .2s",
                          background:rule.isActive?"var(--green)":"var(--border-strong,#CBD5E1)"}}>
                        <div style={{position:"absolute",top:2,width:16,height:16,borderRadius:"50%",
                          background:"#fff",transition:"left .2s",
                          left:rule.isActive?18:2}}/>
                      </button>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:3}}>
                          {rule.name}
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11}}>
                          <span style={{background:"var(--steel-pale,#EFF6FF)",color:"var(--steel)",
                            padding:"1px 7px",borderRadius:4,fontWeight:500}}>
                            WHEN {TRIGGER_LABEL[rule.trigger]||rule.trigger}
                          </span>
                          {rule.condition&&(
                            <span style={{background:"#FFFBEB",color:"#92400E",
                              padding:"1px 7px",borderRadius:4,fontWeight:500}}>
                              IF {rule.condition}
                            </span>
                          )}
                          <span style={{background:"#ECFDF5",color:"var(--green)",
                            padding:"1px 7px",borderRadius:4,fontWeight:500}}>
                            THEN {ACTION_LABEL[rule.action]||rule.action}
                          </span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <span style={{fontSize:11,color:"var(--text-3)"}}>
                          {rule.executionCount||0} runs
                        </span>
                        {canManage&&(
                          <button onClick={()=>deleteRule(rule.id)}
                            style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",
                              cursor:"pointer",fontFamily:"var(--font)",padding:"2px 6px",borderRadius:4,
                              transition:"all .15s"}}
                            onMouseOver={e=>{e.currentTarget.style.color="var(--red)";e.currentTarget.style.background="#FEF2F2"}}
                            onMouseOut={e=>{e.currentTarget.style.color="var(--text-3)";e.currentTarget.style.background="none"}}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── RECIPES TAB ── */}
        {tab==="recipes"&&(
          <div>
            <p style={{fontSize:13,color:"var(--text-3)",marginBottom:16,lineHeight:1.65}}>
              Pre-built automation recipes. Install in one click — you can edit them afterward.
            </p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
              {RECIPES.map(recipe=>{
                const alreadyInstalled = localRules.some(r=>r.name===recipe.name)
                return (
                  <div key={recipe.id} style={{background:"#fff",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",padding:16,display:"flex",gap:12,alignItems:"flex-start"}}>
                    <span style={{fontSize:24,flexShrink:0}}>{recipe.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:4}}>{recipe.name}</div>
                      <div style={{fontSize:12,color:"var(--text-3)",lineHeight:1.55,marginBottom:10}}>{recipe.desc}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                        <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,
                          background:"var(--steel-pale,#EFF6FF)",color:"var(--steel)",fontWeight:500}}>
                          {TRIGGER_LABEL[recipe.trigger]||recipe.trigger}
                        </span>
                        <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,
                          background:"#ECFDF5",color:"var(--green)",fontWeight:500}}>
                          {ACTION_LABEL[recipe.action]||recipe.action}
                        </span>
                      </div>
                      <button onClick={()=>!alreadyInstalled&&installRecipe(recipe)}
                        disabled={alreadyInstalled||saving}
                        style={{padding:"6px 14px",background:alreadyInstalled?"var(--surface)":"var(--steel)",
                          color:alreadyInstalled?"var(--text-3)":"#fff",border:"none",borderRadius:6,
                          fontSize:12,fontWeight:500,cursor:alreadyInstalled?"default":"pointer",
                          fontFamily:"var(--font)"}}>
                        {alreadyInstalled?"✓ Installed":"Install recipe"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {tab==="logs"&&(
          recentLogs.length===0?(
            <EmptyState icon="📋" title="No execution logs yet"
              description="Automation execution history will appear here once rules start firing." />
          ):(
            <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",
                display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{fontWeight:600,color:"var(--text)"}}>Last {recentLogs.length} executions</span>
                <span style={{color:"var(--text-3)"}}>Auto-refreshes every 30s</span>
              </div>
              {recentLogs.map(log=>(
                <div key={log.id} style={{display:"flex",alignItems:"center",gap:12,
                  padding:"10px 16px",borderBottom:"1px solid var(--surface-1,#F1F5F9)"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,
                    background:log.status==="SUCCESS"?"var(--green)":log.status==="FAILED"?"var(--red)":"var(--amber)"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:"var(--text)"}}>
                      {log.rule_name||"Unknown rule"}
                    </div>
                    <div style={{fontSize:11,color:"var(--text-3)"}}>
                      Triggered by: {log.trigger_context||"—"}
                    </div>
                  </div>
                  <Badge variant={log.status==="SUCCESS"?"green":log.status==="FAILED"?"red":"amber"}>
                    {log.status||"PENDING"}
                  </Badge>
                  <span style={{fontSize:11,color:"var(--text-3)",flexShrink:0}}>
                    {log.created_at?new Date(log.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

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
