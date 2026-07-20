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
  { q:"How do I get my existing project plan into FlowSync PM?", a:"Projects → + New project → Import from plan, then upload the Word, Excel or PDF you already have. The AI reads it and lists what it found — phases, tasks with dates and effort, risks, budget lines — and you approve each item before anything is written. If it missed something, the document usually didn't state it clearly; add it there, re-upload, and it fills in." },
  { q:"What's the difference between the template library and AI ingest?", a:"They're two halves of the same loop. Templates → Document templates gives you blank forms (charter, WBS, risk register, minutes, handover). Six of them are marked 🤖 AI-readable: fill one in, upload it under the project's Governance tab, and FlowSync reads it back and populates the project. Download → fill → upload → done." },
  { q:"I signed in with Microsoft. Why isn't Microsoft 365 connected?", a:"Signing in with Microsoft only proves who you are. Reading your mail, calendar and tasks is a separate permission that you grant deliberately: Settings → Integrations → Connect Microsoft 365. Microsoft will show you exactly what's being requested, and you can disconnect at any time." },
  { q:"What happens when my free trial ends?", a:"The two-month trial covers the whole product with no feature limits, and no credit card is needed to start. Subscribe from Settings → Billing whenever you’re ready — pay during the trial and your card isn’t charged until the trial actually ends. If the trial ends without a subscription, nothing is charged and your data stays safe; access is limited until you subscribe." },
  { q:"Do I pay for every person I add?", a:"On Business, no. Paid seats are for the roles that drive and govern the work — sponsors, PMO directors, program and project managers, product owners, PMO analysts. Everyone else — team members, stakeholders, clients, external resources — comes in bundles at $20/mo per 10 people." },
  { q:"Can I work in Spanish?", a:"Yes. Every screen, report and generated document works in English and Spanish, including the document templates. Switch language in Settings — you stay on the same page." },
  { q:"Why is a task missing from the workload view?", a:"Resource workload only counts tasks that have both dates and an effort estimate. A task with no estimate is flagged rather than silently counted as zero, and a task with no dates shows as Unscheduled. Done and Cancelled work is excluded by design." },
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
  { key:"Ctrl + D",  action:"Tasks — copy the cell above down the column" },
  { key:"Escape",    action:"Close a modal or cancel an edit" },
  { key:"Enter",     action:"Save or confirm in a form" },
  { key:"Tab",       action:"Move to the next field" },
]


// `id` lets a Guide button deep-link straight to the relevant walkthrough.
const WALKTHROUGHS = [
  { id:"import", icon:"📥", title:"Import a plan (start here)", steps:[
    "Projects → + New project → Import from plan, or open a project and use Import",
    "Upload the plan you already have — Word, Excel or PDF",
    "The AI reads it and lists what it found: phases, tasks with dates and effort, risks, budget lines",
    "Review every row before committing — nothing is written until you approve it",
    "Uncheck anything it misread, then Commit — the project is built in one step",
    "If something is missing, the document usually didn't say it. Add it, re-upload, and it fills in",
  ]},
  { id:"tasks", icon:"📋", title:"Tasks", steps:[
    "Click a phase header (➔ arrow) to expand or collapse tasks in that phase",
    "Click any cell to edit inline — Status, Priority, Assignee, Dates, % Complete",
    "Use the toolbar at the top to add, move, indent, or delete tasks",
    "Tick a row's checkbox to select it — bulk actions appear in the toolbar",
    "Ctrl + D copies the value from the cell above down the column",
    "Click Edit, or double-click a task, to open the full side panel",
  ]},
  { id:"gantt", icon:"📊", title:"Gantt chart", steps:[
    "Drag bars left or right to reschedule",
    "Drag the right edge of a bar to change duration",
    "Click ➔ phase headers to collapse or expand phases",
    "Purple striped bars are the baseline — the dates you originally committed to",
    "⚡ marks tasks on the critical path: delay one and the project end date moves",
    "Week / Month / Quarter change the time scale",
  ]},
  { id:"budget", icon:"💰", title:"Budget & EVM", steps:[
    "Click + Add item to add a budget line",
    "Click Edit on any row to change planned or actual amounts",
    "CPI and SPI recalculate from your actuals — no spreadsheet needed",
    "EAC projects the final cost at the current rate of spend",
    "Green is under budget, red is over",
    "Lock a baseline before work starts, or there's nothing to measure variance against",
  ]},
  { id:"risks", icon:"⚠", title:"Risks", steps:[
    "Heat Map shows overall exposure; Register lists everything",
    "Toggle Threats / Opportunities to filter",
    "Probability (1–5) × Impact (1–5) gives the P×I score",
    "Anything scoring 15+ shows red — give it a response strategy and an owner now",
    "Mark a risk Triggered when it happens, then log the resulting Issue",
    "🤖 Scan documents reads an uploaded document and proposes risks you may have missed",
  ]},
  { id:"governance", icon:"📐", title:"Governance", steps:[
    "Open the Governance tab in any project",
    "Use the left nav for Team Charter, WBS, Requirements, Quality Plan, Meetings, Handover",
    "Each section shows what's documented and what isn't — empty fields say 'Not documented yet'",
    "Click ✏️ Edit to change a section, then Save to return to the read view",
    "🤖 Upload & AI ingest reads a completed document and fills the section in",
    "Six document templates map to these sections — download one from Templates → Document templates",
  ]},
  { id:"templates", icon:"📄", title:"Document templates", steps:[
    "Templates → 📄 Document templates",
    "Eighteen blank forms — charter, WBS, risk register, minutes, handover and more",
    "Word for forms, Excel for registers, in English or Spanish depending on your language",
    "Filter by phase, or show only 🤖 AI-readable ones",
    "AI-readable templates round-trip: fill one in, upload it under Governance, and the project updates itself",
    "The Task & Schedule Plan template imports straight into a project",
  ]},
  { id:"reports", icon:"✨", title:"AI reports", steps:[
    "Go to the Reports tab",
    "Click ✨ AI Generate Report",
    "Pick the type — Status, Executive Brief, Phase Gate, EVM, or Risk Summary",
    "Pick the audience — the AI adjusts the language to match",
    "Generate: it reads live project data, so the numbers are current, not typed",
    "Download as Word, or print from the browser. Read it before you send it",
  ]},
  { id:"m365", icon:"🪟", title:"Microsoft 365", steps:[
    "Settings → Integrations → Connect Microsoft 365",
    "Signing in with Microsoft only proves who you are — mail and calendar access is a separate permission",
    "Microsoft shows a consent screen listing exactly what you're granting",
    "Once connected: project email gets tagged, meetings are detected, Planner tasks stay in step",
    "You can disconnect any time from your Microsoft account",
    "Connecting affects only your own account, not the workspace",
  ]},
  { id:"resources", icon:"🧑\u200d💻", title:"Resource workload", steps:[
    "Resources shows who is over-committed, and when",
    "Load is calculated from remaining effort on tasks that have dates",
    "Tasks without an estimate are flagged — they're invisible to the calculation otherwise",
    "Tasks with no dates appear as Unscheduled rather than being silently dropped",
    "Done and Cancelled work is excluded",
    "A member's allocation % caps their availability — it doesn't create work",
  ]},
  { id:"roles", icon:"👥", title:"Roles & multiple hats", steps:[
    "Two systems: Access Roles (permissions, one per person, Settings → Team) and Governance/Project Roles (titles on a project, descriptive only)",
    "Access Roles are cumulative — a senior role keeps every ability beneath it",
    "For someone wearing several hats, set the Access Role to the highest they need",
    "Record the other hats as Governance/Project Roles — these never change permissions",
    "Assign them tasks normally: they appear in My Tasks and get notifications like anyone else",
    "For intake, if you need separation of duties, make the evaluator someone other than the submitter",
  ]},
]

export function HelpCenter({ onClose, topic }: { onClose:()=>void; topic?:string }) {
  // Opened from a Guide button on a specific screen → land on that walkthrough,
  // not on a generic FAQ list the person then has to search.
  const [tab, setTab]         = useState<"faq"|"glossary"|"walkthrough"|"shortcuts">(topic ? "walkthrough" : "faq")
  const [openWalk, setOpenWalk] = useState<string|null>(topic ?? null)
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
      const res = await fetch("/api/help/ask", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ question: aiQ, context: topic || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      setAiA(res.ok ? (d?.data?.answer || "No answer came back — try rephrasing.")
                    : (d?.error || "Couldn't reach the assistant."))
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

        {/* User Guide downloads — EN + ES, always visible */}
        <div style={{ display:"flex", gap:8, padding:"10px 16px",
          borderBottom:"1px solid var(--border)", flexShrink:0, background:"#F0FDF4" }}>
          <a href="/guides/FlowSync_User_Guide_EN.pdf" target="_blank" rel="noopener"
            style={{ flex:1, textAlign:"center", padding:"7px 10px", fontSize:12, fontWeight:600,
              color:"#047857", background:"#fff", border:"1px solid #A7F3D0", borderRadius:8,
              textDecoration:"none", fontFamily:"var(--font)" }}>
            📘 User Guide (EN)
          </a>
          <a href="/guides/FlowSync_Guia_de_Usuario_ES.pdf" target="_blank" rel="noopener"
            style={{ flex:1, textAlign:"center", padding:"7px 10px", fontSize:12, fontWeight:600,
              color:"#047857", background:"#fff", border:"1px solid #A7F3D0", borderRadius:8,
              textDecoration:"none", fontFamily:"var(--font)" }}>
            📗 Guía de Usuario (ES)
          </a>
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
              {WALKTHROUGHS
                .filter(w => !search ||
                  w.title.toLowerCase().includes(search.toLowerCase()) ||
                  w.steps.some(st => st.toLowerCase().includes(search.toLowerCase())))
                .map(w=>{
                const open = openWalk === w.id
                return (
                <div key={w.id} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", overflow:"hidden",
                  borderLeft:`3px solid ${open ? "var(--steel)" : "var(--border)"}` }}>
                  <button onClick={()=>setOpenWalk(open ? null : w.id)}
                    aria-expanded={open}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:8,
                      padding:"12px 14px", background:"none", border:"none", cursor:"pointer",
                      textAlign:"left", fontFamily:"var(--font)" }}>
                    <span style={{ fontSize:15 }}>{w.icon}</span>
                    <span style={{ fontSize:13.5, fontWeight:700, color:"var(--text)", flex:1 }}>{w.title}</span>
                    <span aria-hidden style={{ fontSize:15, color:"var(--text-3)",
                      transform: open ? "rotate(45deg)" : "none", transition:"transform .15s" }}>+</span>
                  </button>
                  {open && (
                    <div style={{ padding:"0 14px 14px" }}>
                      {w.steps.map((step,j)=>(
                        <div key={j} style={{ display:"flex", gap:8, marginBottom:7 }}>
                          <span style={{ width:20, height:20, borderRadius:"50%",
                            background:"var(--steel)", color:"#fff", fontSize:10, fontWeight:700,
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            flexShrink:0 }}>{j+1}</span>
                          <span style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.55 }}>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )})}
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
