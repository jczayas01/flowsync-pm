"use client"
// src/components/help/HelpCenter.tsx
// In-app Help Center — Q&A, Glossary, Feature walkthroughs, Keyboard shortcuts

import { useState, useRef } from "react"

const GLOSSARY = [
  { term:"BAC",      full:"Budget at Completion",        def:"The total planned cost of the project. BAC is the baseline against which all EVM calculations are made." },
  { term:"CPI",      full:"Cost Performance Index",      def:"CPI = EV / AC. A CPI of 1.0 means on budget. Below 1.0 = over budget. Above 1.0 = under budget." },
  { term:"SPI",      full:"Schedule Performance Index",  def:"SPI = EV / PV. Below 1.0 = behind schedule. Above 1.0 = ahead of schedule." },
  { term:"EV",       full:"Earned Value",                def:"The budgeted value of work actually performed. EV = BAC × % Complete." },
  { term:"AC",       full:"Actual Cost",                 def:"The actual cost incurred for work performed during a given period." },
  { term:"PV",       full:"Planned Value",               def:"The authorized budget assigned to scheduled work." },
  { term:"EAC",      full:"Estimate at Completion",      def:"EAC = BAC / CPI. The expected total cost at project completion based on current performance." },
  { term:"ETC",      full:"Estimate to Complete",        def:"ETC = EAC − AC. How much more money is needed to finish the project." },
  { term:"VAC",      full:"Variance at Completion",      def:"VAC = BAC − EAC. Projected budget overrun (negative) or saving (positive)." },
  { term:"TCPI",     full:"To-Complete Performance Index",def:"TCPI = (BAC − EV) / (BAC − AC). The cost efficiency needed to meet the original budget." },
  { term:"WBS",      full:"Work Breakdown Structure",    def:"A hierarchical decomposition of project scope into deliverables and work packages." },
  { term:"RTM",      full:"Requirements Traceability Matrix", def:"A document that links requirements to the tasks, test cases, and deliverables that implement or verify them." },
  { term:"CR",       full:"Change Request",              def:"A formal proposal to modify any aspect of the project (scope, schedule, cost, quality)." },
  { term:"RACI",     full:"Responsible, Accountable, Consulted, Informed", def:"A matrix defining roles and responsibilities for each task or deliverable." },
  { term:"Baseline", full:"Project Baseline",            def:"The approved version of scope, schedule, or cost that can only be changed through formal change control." },
  { term:"Critical Path", full:"Critical Path Method",  def:"The longest sequence of dependent tasks that determines the minimum project duration." },
  { term:"Float",    full:"Schedule Float / Slack",      def:"The amount of time a task can be delayed without delaying the project end date." },
  { term:"Risk",     full:"Project Risk",                def:"An uncertain event or condition that, if it occurs, has a positive or negative effect on project objectives." },
  { term:"P×I",      full:"Probability × Impact",        def:"Risk score calculated by multiplying probability (1-5) by impact (1-5). Higher scores = higher priority." },
  { term:"PMO",      full:"Project Management Office",   def:"A department that defines and maintains standards for project management across the organization." },
  { term:"Phase Gate",full:"Phase Gate Review",          def:"A formal decision point at the end of a project phase where leadership decides to proceed, hold, or cancel." },
  { term:"Earned Value",full:"Earned Value Management", def:"A technique integrating scope, schedule, and cost to objectively measure project performance." },
  { term:"Milestone",full:"Project Milestone",           def:"A significant point or event in the project, typically marking completion of a major deliverable." },
  { term:"Stakeholder",full:"Project Stakeholder",       def:"Any individual, group, or organization that may affect, be affected by, or perceive themselves to be affected by the project." },
  { term:"SOW",      full:"Statement of Work",           def:"A document describing the work to be performed, deliverables, timeline, and standards a vendor must meet." },
]

const FAQS = [
  { q:"What does CPI < 1.0 mean?", a:"Your project is over budget. You're spending more money than the value of work completed. A CPI of 0.8 means for every $1 spent, you're only getting $0.80 of planned work done." },
  { q:"What's the difference between a Portfolio, Program, and Project?", a:"A Portfolio is a collection of programs and projects aligned to strategic objectives. A Program is a group of related projects managed together to achieve benefits not available individually. A Project is a temporary endeavor to create a unique product, service, or result." },
  { q:"When should I create a Change Request?", a:"Any time there's a proposed modification to scope, schedule, cost, quality, or resources. Even small changes should be documented to maintain accurate baselines and audit trails." },
  { q:"What's the difference between a Baseline and a Snapshot?", a:"A Baseline is a formally approved reference point — once approved it's locked and can only be changed through formal change control. A snapshot is an informal point-in-time record. FlowSync PM uses formal baselines for scope, schedule, and cost." },
  { q:"How is Critical Path calculated?", a:"The critical path is the longest chain of dependent tasks. Any delay to a critical path task delays the entire project. FlowSync PM uses a forward/backward pass algorithm — tasks with zero float are on the critical path and show a ⚡ badge." },
  { q:"What's the difference between Risk and Issue?", a:"A Risk is a potential future event that may or may not occur. An Issue is a risk that has already occurred and needs immediate attention. Log risks proactively, issues reactively." },
  { q:"How do I add a project to a Portfolio?", a:"Go to the project Dashboard tab. You'll see a Portfolio selector row below the stakeholder strip. Select the portfolio from the dropdown — it saves immediately." },
  { q:"What does the P×I heat map show?", a:"Probability × Impact. Each risk is plotted on a 5×5 grid. Red cells (score 15-25) are critical risks requiring immediate response. Green cells (1-4) are low priority. The heat map shows your overall risk exposure at a glance." },
  { q:"What's the difference between an Access Role and a Governance/Project Role?", a:"They answer different questions. Your Access Role (set in Settings → Team) controls your permissions — what you can see and change across the workspace, and you have exactly one. A Governance/Project Role (Sponsor, Stakeholder, Business Analyst, etc.) is a title applied on a specific project for documentation and reporting; it does not grant or remove permissions. The same person can be 'Sponsor' on one project and 'Stakeholder' on another while keeping a single Access Role." },
  { q:"Can one person hold multiple roles — e.g., be a Sponsor and also have tasks to work on?", a:"Yes. Give the person the highest Access Role they need (for a sponsoring executive, usually Executive or PMO Director), then record their other hats using Governance/Project Roles on the project (Executive Sponsor, Stakeholder, etc.). Access Roles are cumulative, so a senior role never removes hands-on abilities — the person still appears in My Tasks, can update their assigned tasks, post contributions, and receive notifications like anyone else. Their workflow is unaffected." },
  { q:"Can an Executive or PMO Director be assigned tasks?", a:"Yes. Because permissions are cumulative, higher roles keep every lower capability, including doing task work. Assign them tasks normally — they'll see them in My Tasks and get bell notifications just like a Team Member." },
  { q:"How do I stop someone from approving their own intake idea (separation of duties)?", a:"Intake submissions can be evaluated by Executive and PMO Director roles. If the submitter also holds one of those roles, the system currently allows self-approval — it only ever prevents changing your own Access Role. If your governance requires separation of duties, assign a different person as the intake evaluator so ideas are reviewed by someone other than the submitter. The audit log records who submitted, reviewed, approved, and converted each item." },
]

const SHORTCUTS = [
  { key:"G then D",    action:"Go to Dashboard" },
  { key:"G then T",    action:"Go to Tasks" },
  { key:"G then G",    action:"Go to Gantt" },
  { key:"G then R",    action:"Go to Risks" },
  { key:"N",           action:"New item (context-sensitive)" },
  { key:"Escape",      action:"Close modal / cancel" },
  { key:"Enter",       action:"Save / confirm" },
  { key:"Ctrl + /",    action:"Open help" },
  { key:"Ctrl + K",    action:"Command palette (coming soon)" },
]

const WALKTHROUGHS = [
  { icon:"📋", title:"Tasks Tab", steps:[
    "Click a phase header (➔ arrow) to expand/collapse tasks in that phase",
    "Click any cell directly to edit inline — Status, Priority, Assignee, Dates, % Complete",
    "Use the blue action toolbar at the top to add, move, indent, or delete tasks",
    "Check the checkbox on a row to select it — bulk actions appear in the toolbar",
    "Click ⋯ on any row for the full action menu",
    "Click Edit or double-click a task to open the side panel for full details",
  ]},
  { icon:"📊", title:"Gantt Chart", steps:[
    "Drag bars left/right to reschedule tasks",
    "Drag the right edge of a bar to resize duration",
    "Click ➔ phase headers to collapse/expand phases",
    "Purple striped bars show the original baseline dates",
    "⚡ badges mark critical path tasks",
    "Use Week/Month/Quarter buttons to change the time scale",
    "Hover over a task name to see the ⋯ action menu",
  ]},
  { icon:"💰", title:"Budget & EVM", steps:[
    "Click + Add item to add a budget line item",
    "Click Edit on any row to change planned or actual amounts",
    "CPI and SPI update automatically from your actuals",
    "EAC shows projected final cost based on current CPI",
    "Green = under budget, Red = over budget",
    "Lock baselines before the project starts to enable variance analysis",
  ]},
  { icon:"⚠", title:"Risk Management", steps:[
    "Use the Heat Map tab to see overall risk exposure",
    "Click Register to see the full list",
    "Toggle Threats/Opportunities to filter",
    "Set Probability (1-5) × Impact (1-5) to get the P×I score",
    "High-score risks (≥15) appear in red — assign a response strategy immediately",
    "Mark risks as Triggered if they occur — log the resulting Issue",
  ]},
  { icon:"📐", title:"Governance Hub", steps:[
    "Click the Governance tab in any project",
    "Use the left nav to switch between Team Charter, WBS, Requirements, Quality Plan, Meetings, Handover",
    "Click ⬇ Download template to get a pre-filled Word template",
    "Fill out the template offline, then click 🤖 Upload & AI ingest",
    "The AI reads your completed document and auto-populates the project fields",
  ]},
  { icon:"✨", title:"AI Reports", steps:[
    "Go to the Reports tab",
    "Click ✨ AI Generate Report",
    "Select the report type — Status, Executive Brief, Phase Gate, EVM, or Risk Summary",
    "Select your audience — the AI tailors the language accordingly",
    "Click Generate — the AI reads live project data and produces the report",
    "Download as Word (.docx) or Print directly from the browser",
  ]},
  { icon:"👥", title:"Roles & Multiple Hats", steps:[
    "Understand the two systems: Access Roles (permissions, one per person, set in Settings → Team) vs Governance/Project Roles (titles on a project, descriptive only)",
    "Access Roles are cumulative — a higher role keeps every ability beneath it, so senior people can still do hands-on task work",
    "For someone with several hats, set their Access Role to the highest they need (e.g., Executive or PMO Director for a sponsor)",
    "Record their other hats as Governance/Project Roles on the project (Executive Sponsor, Stakeholder, etc.) — these don't change permissions",
    "Assign them tasks normally — they'll appear in My Tasks and receive bell notifications like anyone else",
    "For intake, if you need separation of duties, ensure the evaluator is a different person than the submitter",
  ]},
]

export function HelpCenter({ onClose }: { onClose:()=>void }) {
  const [tab, setTab]         = useState<"faq"|"glossary"|"walkthrough"|"shortcuts">("faq")
  const [search, setSearch]   = useState("")
  const [aiQ, setAiQ]         = useState("")
  const [aiA, setAiA]         = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number|null>(null)

  const filteredGlossary = GLOSSARY.filter(g =>
    !search || g.term.toLowerCase().includes(search.toLowerCase()) ||
    g.def.toLowerCase().includes(search.toLowerCase())
  )

  const filteredFaqs = FAQS.filter(f =>
    !search || f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  )

  async function askAI() {
    if (!aiQ.trim()) return
    setAiLoading(true); setAiA("")
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "anthropic-version":"2023-06-01" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:500,
          messages:[{ role:"user", content:`You are a project management expert assistant for FlowSync PM, an enterprise project management platform. Answer this PM question concisely in 2-4 sentences:\n\n${aiQ}` }]
        }),
      })
      const d = await res.json()
      setAiA(d.content?.[0]?.text || "Sorry, I couldn't generate an answer.")
    } catch { setAiA("Network error — please try again.") }
    finally { setAiLoading(false) }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000,
      display:"flex", alignItems:"flex-end", justifyContent:"flex-end" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:"min(500px,95vw)", height:"85vh", background:"#fff",
          borderRadius:"12px 0 0 0", display:"flex", flexDirection:"column",
          boxShadow:"-8px 0 40px rgba(0,0,0,.2)" }}>

        {/* Header */}
        <div style={{ background:"var(--steel)", padding:"16px 20px", color:"#fff",
          display:"flex", alignItems:"center", gap:10, flexShrink:0, borderRadius:"12px 0 0 0" }}>
          <span style={{ fontSize:20 }}>❓</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700 }}>Help Center</div>
            <div style={{ fontSize:11, opacity:.6 }}>PM Best Practices · FlowSync PM Guide</div>
          </div>
          <button onClick={onClose}
            style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff",
              borderRadius:6, cursor:"pointer", fontSize:16, padding:"4px 10px",
              fontFamily:"var(--font)" }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search help, glossary, FAQs..."
            style={{ width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
              color:"var(--text)", outline:"none" }} />
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          {[
            { id:"faq",        label:"FAQ" },
            { id:"glossary",   label:"Glossary" },
            { id:"walkthrough",label:"Guides" },
            { id:"shortcuts",  label:"Shortcuts" },
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as any)}
              style={{ flex:1, padding:"8px", fontSize:11, fontWeight:500, cursor:"pointer",
                background:"none", border:"none",
                borderBottom:`2px solid ${tab===t.id?"var(--steel)":"transparent"}`,
                color:tab===t.id?"var(--steel)":"var(--text-3)",
                fontFamily:"var(--font)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:16 }}>

          {/* FAQ */}
          {tab==="faq" && (
            <>
              {/* AI Q&A */}
              <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE",
                borderRadius:"var(--radius)", padding:14, marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--steel)", marginBottom:8 }}>
                  ✨ Ask AI a PM question
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input value={aiQ} onChange={e=>setAiQ(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&askAI()}
                    placeholder="e.g. When should I escalate a risk?"
                    style={{ flex:1, padding:"7px 10px", border:"1px solid #BFDBFE",
                      borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
                      color:"var(--text)", outline:"none" }} />
                  <button onClick={askAI} disabled={aiLoading||!aiQ.trim()}
                    style={{ padding:"7px 14px", background:"var(--steel)", color:"#fff",
                      border:"none", borderRadius:"var(--radius)", fontSize:12,
                      cursor:"pointer", fontFamily:"var(--font)",
                      opacity:(!aiQ.trim()||aiLoading)?0.5:1 }}>
                    {aiLoading?"…":"Ask"}
                  </button>
                </div>
                {aiA && (
                  <div style={{ marginTop:10, fontSize:12, color:"var(--text)", lineHeight:1.6,
                    background:"#fff", padding:10, borderRadius:"var(--radius)" }}>
                    {aiA}
                  </div>
                )}
              </div>

              {filteredFaqs.map((faq,i)=>(
                <div key={i} style={{ marginBottom:8, border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", overflow:"hidden" }}>
                  <div onClick={()=>setExpandedFaq(expandedFaq===i?null:i)}
                    style={{ padding:"12px 14px", cursor:"pointer", display:"flex",
                      alignItems:"center", justifyContent:"space-between",
                      background:expandedFaq===i?"#EFF6FF":"#fff" }}>
                    <span style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{faq.q}</span>
                    <span style={{ color:"var(--text-4)", fontSize:12,
                      transform:expandedFaq===i?"rotate(0)":"rotate(-90deg)",
                      display:"inline-block", transition:"transform .15s", flexShrink:0 }}>▼</span>
                  </div>
                  {expandedFaq===i && (
                    <div style={{ padding:"10px 14px", fontSize:12, color:"var(--text-2)",
                      lineHeight:1.7, borderTop:"1px solid var(--border)" }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Glossary */}
          {tab==="glossary" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {filteredGlossary.map((g,i)=>(
                <div key={i} style={{ padding:"12px 14px", background:"#fff",
                  border:"1px solid var(--border)", borderRadius:"var(--radius)" }}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"var(--steel)" }}>{g.term}</span>
                    <span style={{ fontSize:11, color:"var(--text-4)" }}>{g.full}</span>
                  </div>
                  <p style={{ fontSize:12, color:"var(--text-2)", margin:0, lineHeight:1.6 }}>{g.def}</p>
                </div>
              ))}
            </div>
          )}

          {/* Walkthroughs */}
          {tab==="walkthrough" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {WALKTHROUGHS.map((w,i)=>(
                <div key={i} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", padding:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"var(--text)",
                    marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                    <span>{w.icon}</span>{w.title}
                  </div>
                  {w.steps.map((step,j)=>(
                    <div key={j} style={{ display:"flex", gap:8, marginBottom:7 }}>
                      <span style={{ width:20, height:20, borderRadius:"50%",
                        background:"var(--steel)", color:"#fff", fontSize:10, fontWeight:700,
                        display:"inline-flex", alignItems:"center", justifyContent:"center",
                        flexShrink:0 }}>{j+1}</span>
                      <span style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Shortcuts */}
          {tab==="shortcuts" && (
            <div style={{ background:"#fff", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", overflow:"hidden" }}>
              {SHORTCUTS.map((s,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 14px", borderBottom:"1px solid var(--surface-1,#F1F5F9)" }}>
                  <kbd style={{ padding:"3px 8px", background:"var(--surface)",
                    border:"1px solid var(--border)", borderRadius:4, fontSize:11,
                    fontFamily:"monospace", color:"var(--text)", flexShrink:0 }}>
                    {s.key}
                  </kbd>
                  <span style={{ fontSize:12, color:"var(--text-2)" }}>{s.action}</span>
                </div>
              ))}
              <div style={{ padding:"10px 14px", fontSize:11, color:"var(--text-4)" }}>
                More shortcuts coming soon. Press Ctrl+/ to open help from anywhere.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
