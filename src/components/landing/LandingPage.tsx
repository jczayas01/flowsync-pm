"use client"
// src/components/landing/LandingPage.tsx
import { RequestDemoModal } from "@/components/marketing/RequestDemoModal"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"

const NAV_LINKS = [
  { href:"#features", label:"Features" },
  { href:"#who",      label:"Who it's for" },
  { href:"#pricing",  label:"Pricing" },
  { href:"#faq",      label:"FAQ" },
]

const FEATURES = [
  { icon:"📊", title:"Interactive Gantt + critical path", color:"#EFF6FF", tag:"Waterfall", tagColor:"#1B6CA8",
    desc:"Drag-and-drop scheduling with FS/SS/FF dependencies, baseline overlays, and critical path highlighting. Export to PDF or share a live link." },
  { icon:"💰", title:"Budget tracking with EVM", color:"#ECFDF5", tag:"Built-in", tagColor:"#059669",
    desc:"Planned value, earned value, CPI, SPI, EAC, and VAC calculated automatically from your task data. No spreadsheet required." },
  { icon:"🤖", title:"AI status report generation", color:"#F5F3FF", tag:"AI-powered", tagColor:"#7C3AED",
    desc:"One click produces a complete weekly status report — accomplishments, risks, milestones, budget — drafted by AI, reviewed by you." },
  { icon:"📧", title:"M365 deep integration", color:"#ECFEFF", tag:"Microsoft 365", tagColor:"#0891B2",
    desc:"Outlook emails auto-tagged to projects. Teams meetings logged as decisions. Planner tasks synced bidirectionally." },
  { icon:"🔒", title:"Enterprise security & RBAC", color:"#FEF2F2", tag:"Enterprise", tagColor:"#DC2626",
    desc:"8 role levels, 67 permissions, TOTP 2FA, SCIM provisioning, Azure AD SSO, IP allowlisting, and a full audit log ready for enterprise compliance reviews." },
  { icon:"⚡", title:"No-code automation engine", color:"#FFFBEB", tag:"Automation", tagColor:"#92400E",
    desc:"28 trigger types, 20 action types, 40+ recipe templates. WHEN a task is overdue → notify PM and flag the project amber. Build in minutes." },
]

const PLANS = [
  { name:"Trial", price:0, ea:null, color:"var(--text)",
    desc:"Two months free, full product. Card on file; converts to Starter unless you cancel.",
    features:["Everything unlocked","Unlimited projects","AI document import","Bilingual EN / ES"],
    missing:[],
    cta:"Start free trial", ctaStyle:"outline" },
  { name:"Starter", price:19, ea:null, color:"#fff", featured:false,
    desc:"For small teams and independent PMs. Flat per user, no tiers to decode.",
    features:["Unlimited projects","All 3 methodologies","AI co-pilot & reports","Budget tracking + EVM","Risk register","Document templates"],
    missing:[],
    cta:"Start free trial", ctaStyle:"steel" },
  { name:"Business", price:39, ea:null, color:"var(--text)", featured:true,
    desc:"For PMOs. Pay for the people who drive the work — everyone else comes in bundles.",
    features:["Everything in Starter","$20/mo per 10 contributor seats","Portfolio & program hierarchy","SSO — Microsoft & Google","Executive dashboard","Full governance suite","Email support"],
    missing:[],
    cta:"Start free trial", ctaStyle:"amber" },
]

const FAQS = [
  { q:"Can I try it before paying?",
    a:"Yes. Every account starts with a two-month free trial of the full product — no feature limits. We ask for a card at sign-up so the trial converts to Starter automatically when it ends; cancel any time before then and you're not charged." },
  { q:"Does it really support Waterfall, Agile, and Scrum in one workspace?",
    a:"Yes — all three share the same underlying data model. A Waterfall project shows phases and a Gantt. Agile shows a backlog and sprint board. Scrum adds ceremonies and velocity. You can run all three simultaneously." },
  { q:"How deep is the Microsoft 365 integration?",
    a:"FlowSync PM connects to Microsoft 365 via the Graph API — emails, Teams meetings, and Planner tasks sync automatically with your projects. This is a native integration, not a Zapier connector." },
  { q:"Is it suitable for regulated industries?",
    a:"Yes. The platform includes a comprehensive audit log, consent tracking, document watermarking, and role-based data controls. Pre-built compliance templates are available for Business and Enterprise plans." },
  { q:"Do I pay for everyone on the team?",
    a:"No. On Business you pay per user only for the roles that drive and govern the work — sponsors, PMO directors, program and project managers, product owners, PMO analysts. Everyone who contributes or just needs visibility — team members, stakeholders, clients, external resources — comes in bundles at $20/mo per 10 people." },
]

const GANTT_BARS = [
  { name:"Initiation",    color:"#059669", start:0,  width:12, pct:100 },
  { name:"Requirements",  color:"#1B6CA8", start:11, width:22, pct:100 },
  { name:"Configuration", color:"#7C3AED", start:22, width:30, pct:80  },
  { name:"Testing",       color:"#0891B2", start:52, width:20, pct:20  },
  { name:"Go-live",       color:"#F59E0B", start:72, width:12, pct:0   },
]
const TODAY_X = 64

export default function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [email,    setEmail]    = useState("")
  const [email2,   setEmail2]   = useState("")
  const [joined,   setJoined]   = useState(false)
  const [joined2,  setJoined2]  = useState(false)
  const [openFaq,  setOpenFaq]  = useState<number|null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [spots,    setSpots]    = useState(187)
  const ganttRef  = useRef<boolean>(false)
  const [barsReady,setBarsReady]= useState(false)

  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>40)
    window.addEventListener("scroll",onScroll,{passive:true})
    return()=>window.removeEventListener("scroll",onScroll)
  },[])

  useEffect(()=>{
    const t=setTimeout(()=>setBarsReady(true),400)
    return()=>clearTimeout(t)
  },[])

  function handleWaitlist(e:React.FormEvent, which:"hero"|"cta") {
    e.preventDefault()
    if(which==="hero"){ setJoined(true); setSpots(s=>Math.max(0,s-1)) }
    else { setJoined2(true); setSpots(s=>Math.max(0,s-1)) }
  }

  const nav: React.CSSProperties = {
    position:"fixed", top:0, left:0, right:0, zIndex:200,
    background:"rgba(13,27,42,.96)",
    backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
    borderBottom:"1px solid rgba(255,255,255,.06)",
    boxShadow:scrolled?"0 4px 32px rgba(0,0,0,.4)":"none",
    transition:"box-shadow .2s",
  }

  return (
    <div style={{fontFamily:"var(--font,system-ui,sans-serif)",color:"var(--text,#0F172A)",overflowX:"hidden"}}>

      {/* NAV */}
      <nav style={nav}>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px",height:60,
          display:"flex",alignItems:"center",gap:0}}>
          <Link href="/" style={{display:"flex",alignItems:"center",gap:9,textDecoration:"none",marginRight:32}}>
            <div style={{width:30,height:30,background:"#1B6CA8",borderRadius:8,position:"relative",flexShrink:0}}>
              <div style={{position:"absolute",width:14,height:2.5,background:"#fff",top:8,left:8,borderRadius:2}}/>
              <div style={{position:"absolute",width:9,height:2.5,background:"#F59E0B",top:13,left:8,borderRadius:2}}/>
            </div>
            <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>
              FlowSync <span style={{color:"#F59E0B"}}>PM</span>
            </span>
          </Link>
          <div style={{display:"flex",flex:1}}>
            {NAV_LINKS.map(l=>(
              <a key={l.href} href={l.href}
                style={{padding:"0 14px",height:60,display:"flex",alignItems:"center",
                  fontSize:13,fontWeight:500,color:"rgba(255,255,255,.55)",textDecoration:"none",
                  transition:"color .15s"}}>
                {l.label}
              </a>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={() => setDemoOpen(true)}
              style={{fontSize:13,color:"rgba(255,255,255,.5)",background:"none",border:"none",
                cursor:"pointer",padding:"0 12px",fontFamily:"inherit"}}>
              Request a demo
            </button>
            <Link href="/auth/signin"
              style={{fontSize:13,color:"rgba(255,255,255,.5)",textDecoration:"none",padding:"0 12px"}}>
              Sign in
            </Link>
            <Link href="/auth/signup"
              style={{padding:"8px 16px",background:"#F59E0B",color:"#0D1B2A",borderRadius:8,
                fontSize:13,fontWeight:700,textDecoration:"none"}}>
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{background:"#0D1B2A",paddingTop:148,paddingBottom:80,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,
          background:"radial-gradient(ellipse 80% 60% at 60% -10%,rgba(27,108,168,.22) 0%,transparent 70%)",
          pointerEvents:"none"}}/>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:64,alignItems:"center"}}>

            {/* Left */}
            <div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,
                background:"rgba(245,158,11,.12)",border:"1px solid rgba(245,158,11,.25)",
                color:"#F59E0B",fontSize:12,fontWeight:600,padding:"5px 14px",
                borderRadius:20,marginBottom:24,letterSpacing:".05em"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#F59E0B",
                  animation:"pulse 2s infinite"}}/>
                Live now · Free for 2 months
              </div>
              <h1 style={{fontFamily:"inherit",fontSize:"clamp(36px,5vw,62px)",fontWeight:700,
                lineHeight:1.08,letterSpacing:"-.03em",color:"#fff",marginBottom:20}}>
                Project management<br/>built for <span style={{color:"#F59E0B"}}>real</span> PMOs
              </h1>
              <p style={{fontSize:17,lineHeight:1.7,color:"rgba(255,255,255,.55)",marginBottom:36,maxWidth:480}}>
                Waterfall, Agile, and Scrum in one platform. Built-in M365 integration, EVM budget tracking, enterprise audit logs, and AI-generated status reports.
              </p>
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <Link href="/auth/signup"
                  style={{padding:"14px 26px",background:"#F59E0B",color:"#0D1B2A",
                    borderRadius:10,fontSize:14,fontWeight:700,textDecoration:"none",
                    whiteSpace:"nowrap"}}>
                  Start free trial →
                </Link>
                <button onClick={()=>setDemoOpen(true)}
                  style={{padding:"14px 24px",background:"rgba(255,255,255,.06)",color:"#fff",
                    border:"1.5px solid rgba(255,255,255,.15)",borderRadius:10,fontSize:14,
                    fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  Request a demo
                </button>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",display:"flex",alignItems:"center",gap:6}}>
                🔒 No credit card. No spam. Unsubscribe any time.
              </div>
              {/* Stats */}
              <div style={{display:"flex",gap:32,marginTop:40,paddingTop:32,
                borderTop:"1px solid rgba(255,255,255,.08)"}}>
                {[["3","Methodologies"],["47+","Templates"],["$0","Free tier"]].map(([v,l])=>(
                  <div key={l}>
                    <div style={{fontSize:26,fontWeight:700,color:"#fff",lineHeight:1}}>{v}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt widget */}
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",
              borderRadius:14,overflow:"hidden",
              boxShadow:"0 32px 80px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)"}}>
              {/* Title bar */}
              <div style={{background:"rgba(255,255,255,.05)",borderBottom:"1px solid rgba(255,255,255,.07)",
                padding:"10px 14px",display:"flex",alignItems:"center",gap:7}}>
                {["#FF5F57","#FFBD2E","#28CA41"].map(c=>(
                  <div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>
                ))}
                <span style={{fontSize:11,color:"rgba(255,255,255,.4)",marginLeft:6,fontWeight:500}}>
                  Digital Transformation · PRJ-001
                </span>
                <span style={{marginLeft:"auto",fontSize:9,fontWeight:600,padding:"2px 7px",
                  borderRadius:4,background:"rgba(5,150,105,.2)",color:"#34D399"}}>
                  🟢 On track
                </span>
              </div>
              {/* Gantt bars */}
              <div style={{padding:16}}>
                {/* Month labels */}
                <div style={{display:"flex",marginBottom:10,paddingLeft:110}}>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"].map(m=>(
                    <div key={m} style={{flex:1,fontSize:9,color:"rgba(255,255,255,.25)",
                      fontWeight:500,textAlign:"center"}}>
                      {m}
                    </div>
                  ))}
                </div>
                {/* Bars */}
                {GANTT_BARS.map((bar,i)=>(
                  <div key={bar.name} style={{display:"grid",gridTemplateColumns:"110px 1fr",
                    gap:0,marginBottom:8,alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,paddingRight:8}}>
                      <div style={{width:7,height:7,borderRadius:2,background:bar.color,flexShrink:0}}/>
                      <span style={{fontSize:10,fontWeight:500,color:"rgba(255,255,255,.6)",
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {bar.name}
                      </span>
                    </div>
                    <div style={{position:"relative",height:20,borderRadius:3,
                      background:"rgba(255,255,255,.04)"}}>
                      {/* Today marker */}
                      <div style={{position:"absolute",top:0,bottom:0,left:`${TODAY_X}%`,
                        width:1.5,background:"#F59E0B",opacity:.8,zIndex:5}}/>
                      {/* Track */}
                      <div style={{position:"absolute",top:3,height:14,borderRadius:3,
                        background:`${bar.color}20`,border:`1px solid ${bar.color}40`,
                        left:barsReady?`${bar.start}%`:"0%",
                        width:barsReady?`${bar.width}%`:"0%",
                        transition:"left 1.2s cubic-bezier(.25,.46,.45,.94), width 1.2s cubic-bezier(.25,.46,.45,.94)",
                        transitionDelay:`${i*0.12}s`}}>
                        <span style={{fontSize:9,fontWeight:600,color:bar.color,paddingLeft:5}}>
                          {bar.pct>0?`${bar.pct}%`:""}
                        </span>
                      </div>
                      {/* Progress */}
                      {bar.pct>0&&(
                        <div style={{position:"absolute",top:3,height:14,borderRadius:3,
                          background:bar.color,opacity:.85,
                          left:barsReady?`${bar.start}%`:"0%",
                          width:barsReady?`${bar.width*bar.pct/100}%`:"0%",
                          transition:"left 1.3s cubic-bezier(.25,.46,.45,.94), width 1.3s cubic-bezier(.25,.46,.45,.94)",
                          transitionDelay:`${i*0.12+0.1}s`}}/>
                      )}
                    </div>
                  </div>
                ))}
                {/* Health strip */}
                <div style={{borderTop:"1px solid rgba(255,255,255,.06)",marginTop:10,paddingTop:10,
                  display:"flex",gap:12}}>
                  {[["#059669","5 on track"],["#F59E0B","2 at risk"],["#DC2626","1 overdue"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(255,255,255,.4)"}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c}}/>
                      {l}
                    </div>
                  ))}
                </div>
                {/* KPIs */}
                <div style={{borderTop:"1px solid rgba(255,255,255,.06)",marginTop:10,paddingTop:10,
                  display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0}}>
                  {[["68%","Complete"],["CPI 0.94","Cost perf."],["$820K","Spent"],["Dec","On schedule"]].map(([v,l],i)=>(
                    <div key={l} style={{textAlign:"center",borderRight:i<3?"1px solid rgba(255,255,255,.06)":"none",padding:"0 8px"}}>
                      <div style={{fontSize:14,fontWeight:700,color:i===1?"#F59E0B":i===3?"#059669":"#fff"}}>{v}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.3)",marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}`}</style>
      </section>

      {/* PROBLEM */}
      <section style={{padding:"96px 0"}}>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px"}}>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase",
            color:"#F59E0B",marginBottom:10}}>
            Why teams choose FlowSync PM
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,40px)",fontWeight:600,lineHeight:1.2,
            letterSpacing:"-.02em",color:"var(--text,#0F172A)",marginBottom:48,maxWidth:560}}>
            Most PM tools weren't built for how PMOs actually work
          </h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,
            background:"#E2E8F0",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
            {[
              { n:"01", title:"One methodology per platform",
                body:"Your Waterfall IT projects and Agile dev teams live in different tools. Status reports are assembled manually from three sources every Monday." },
              { n:"02", title:"Budget tracking lives in Excel",
                body:"Your PM tool tracks tasks. Earned value, CPI, and SPI live in a spreadsheet someone updates manually — when they remember to." },
              { n:"03", title:"M365 is an afterthought",
                body:"Project emails arrive in Outlook, meeting notes sit in Teams, tasks get duplicated in Planner. No system of record. Your PM tool doesn't know your calendar exists." },
            ].map(c=>(
              <div key={c.n} style={{background:"#fff",padding:"32px 28px"}}>
                <div style={{fontSize:52,fontWeight:700,color:"#E2E8F0",lineHeight:1,marginBottom:12}}>{c.n}</div>
                <div style={{fontSize:17,fontWeight:600,color:"var(--text,#0F172A)",marginBottom:8}}>{c.title}</div>
                <p style={{fontSize:14,lineHeight:1.65,color:"#64748B",margin:0}}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{padding:"96px 0",background:"#F1F5F9"}} id="features">
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px"}}>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase",color:"#F59E0B",marginBottom:10}}>
            Platform capabilities
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,40px)",fontWeight:600,lineHeight:1.2,letterSpacing:"-.02em",
            color:"var(--text,#0F172A)",marginBottom:48}}>
            Everything a PMO needs, nothing it doesn't
          </h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {FEATURES.map(f=>(
              <div key={f.title} style={{background:"#fff",border:"1px solid #E2E8F0",
                borderRadius:10,padding:"28px 24px",transition:"all .2s"}}
                onMouseOver={e=>{e.currentTarget.style.borderColor="#1B6CA8";e.currentTarget.style.boxShadow="0 8px 28px rgba(27,108,168,.1)";e.currentTarget.style.transform="translateY(-2px)"}}
                onMouseOut={e=>{e.currentTarget.style.borderColor="#E2E8F0";e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none"}}>
                <div style={{width:44,height:44,borderRadius:10,background:f.color,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:20,marginBottom:16}}>
                  {f.icon}
                </div>
                <div style={{fontSize:16,fontWeight:600,color:"var(--text,#0F172A)",marginBottom:7}}>{f.title}</div>
                <p style={{fontSize:13,lineHeight:1.6,color:"#64748B",marginBottom:12,margin:"0 0 12px"}}>{f.desc}</p>
                <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:4,
                  background:f.color,color:f.tagColor}}>
                  {f.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{padding:"96px 0"}} id="pricing">
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px"}}>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase",color:"#F59E0B",marginBottom:10}}>
            Get started
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,40px)",fontWeight:600,lineHeight:1.2,letterSpacing:"-.02em",
            color:"var(--text,#0F172A)",marginBottom:12}}>
            Start running projects properly
          </h2>
          <p style={{fontSize:17,color:"#64748B",marginBottom:40,maxWidth:520,lineHeight:1.7}}>
            Two months free, the whole product. Import a real plan and see it working in 30 seconds.
          </p>
          {/* Early banner */}
          <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",
            borderRadius:10,padding:"14px 20px",display:"flex",alignItems:"center",gap:14,
            marginBottom:36,flexWrap:"wrap"}}>
            <span style={{fontSize:22}}>⚡</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:"var(--text,#0F172A)",marginBottom:2}}>
                You only pay for the people who drive the work
              </div>
              <div style={{fontSize:13,color:"#64748B"}}>
                Managers and sponsors are paid seats. Your team, stakeholders and clients come in bundles — $20/mo per 10.
              </div>
            </div>
            <div style={{fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:6,
              background:"#F59E0B",color:"#0D1B2A",flexShrink:0}}>
              {spots} / 200 spots left
            </div>
          </div>
          {/* Plan cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {PLANS.map(plan=>(
              <div key={plan.name} style={{borderRadius:12,padding:"32px 28px",
                border:plan.featured?"1px solid rgba(255,255,255,.1)":"1px solid #E2E8F0",
                background:plan.featured?"#0D1B2A":"#fff",position:"relative",
                transition:"all .2s"}}>
                {plan.featured&&(
                  <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",
                    background:"#F59E0B",color:"#0D1B2A",fontSize:11,fontWeight:700,
                    padding:"4px 14px",borderRadius:20,whiteSpace:"nowrap"}}>
                    Most popular
                  </div>
                )}
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",
                  color:plan.featured?"rgba(255,255,255,.5)":"#64748B",marginBottom:10}}>
                  {plan.name}
                </div>
                <div style={{fontSize:38,fontWeight:700,lineHeight:1,color:plan.color,marginBottom:4}}>
                  ${plan.ea||plan.price}
                  {plan.price>0&&<span style={{fontSize:18,fontWeight:400,opacity:.6}}>/mo</span>}
                </div>
                {plan.price>0&&(
                  <div style={{fontSize:12,color:plan.featured?"rgba(255,255,255,.4)":"#64748B",marginBottom:6}}>
                    per user · billed monthly
                  </div>
                )}
                {plan.name==="Trial"&&(
                  <div style={{fontSize:12,fontWeight:600,padding:"3px 9px",borderRadius:5,
                    background:"rgba(5,150,105,.1)",color:"#059669",
                    display:"inline-block",marginBottom:16}}>
                    2 months free, then $19/user
                  </div>
                )}
                {!plan.ea&&<div style={{marginBottom:plan.featured?0:16}}/>}
                <p style={{fontSize:13,color:plan.featured?"rgba(255,255,255,.5)":"#64748B",
                  marginBottom:20,lineHeight:1.55}}>
                  {plan.desc}
                </p>
                <ul style={{listStyle:"none",marginBottom:24,display:"flex",flexDirection:"column",gap:8}}>
                  {plan.features.map(f=>(
                    <li key={f} style={{fontSize:13,display:"flex",alignItems:"flex-start",gap:8,
                      color:plan.featured?"rgba(255,255,255,.8)":"#334155"}}>
                      <span style={{color:plan.featured?"#34D399":"#059669",flexShrink:0,marginTop:1}}>✓</span>
                      {f}
                    </li>
                  ))}
                  {plan.missing.map(f=>(
                    <li key={f} style={{fontSize:13,display:"flex",alignItems:"flex-start",gap:8,color:"#94A3B8"}}>
                      <span style={{flexShrink:0,marginTop:1}}>—</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup"
                  style={{display:"block",textAlign:"center",padding:"12px 20px",borderRadius:8,
                    fontSize:13,fontWeight:600,textDecoration:"none",
                    background:plan.ctaStyle==="amber"?"#F59E0B":plan.ctaStyle==="steel"?"#1B6CA8":"transparent",
                    color:plan.ctaStyle==="amber"?"#0D1B2A":plan.ctaStyle==="steel"?"#fff":plan.featured?"rgba(255,255,255,.6)":"#334155",
                    border:plan.ctaStyle==="outline"?"1px solid #E2E8F0":"none"}}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* ── Enterprise ── */}
          <div style={{marginTop:28,background:"#0D1B2A",borderRadius:14,padding:"28px 32px",
            display:"flex",alignItems:"center",justifyContent:"space-between",gap:24,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:260}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",
                color:"#F59E0B",marginBottom:8}}>
                Enterprise
              </div>
              <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:8,lineHeight:1.3}}>
                Running a PMO, a portfolio, or a regulated program?
              </div>
              <div style={{fontSize:13.5,color:"rgba(255,255,255,.65)",lineHeight:1.65,maxWidth:520}}>
                Custom pricing, SSO and directory sync, white-labeling, a data processing agreement,
                and personal onboarding — set up by the person who built the platform.
                Your team and stakeholders come in bundles, so you only pay for the people who
                actually drive the work.
              </div>
            </div>
            <button onClick={() => setDemoOpen(true)}
              style={{padding:"13px 26px",background:"#F59E0B",color:"#0D1B2A",border:"none",
                borderRadius:9,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                whiteSpace:"nowrap",flexShrink:0}}>
              Request a demo →
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{padding:"96px 0",background:"#F1F5F9"}} id="faq">
        <div style={{maxWidth:740,margin:"0 auto",padding:"0 24px"}}>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase",color:"#F59E0B",marginBottom:10}}>
            Common questions
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,40px)",fontWeight:600,letterSpacing:"-.02em",
            color:"var(--text,#0F172A)",marginBottom:40}}>
            FAQ
          </h2>
          <div style={{border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
            {FAQS.map((faq,i)=>(
              <div key={i} style={{borderBottom:i<FAQS.length-1?"1px solid #E2E8F0":"none"}}>
                <button onClick={()=>setOpenFaq(openFaq===i?null:i)}
                  style={{width:"100%",padding:"20px 24px",display:"flex",alignItems:"center",
                    justifyContent:"space-between",gap:16,cursor:"pointer",fontFamily:"inherit",
                    fontSize:15,fontWeight:500,color:"var(--text,#0F172A)",background:"#fff",
                    border:"none",textAlign:"left",transition:"background .15s"}}
                  onMouseOver={e=>(e.currentTarget.style.background="#F8FAFC")}
                  onMouseOut={e=>(e.currentTarget.style.background="#fff")}>
                  {faq.q}
                  <span style={{fontSize:18,color:"#94A3B8",transition:"transform .2s",flexShrink:0,
                    transform:openFaq===i?"rotate(180deg)":"none"}}>▾</span>
                </button>
                {openFaq===i&&(
                  <div style={{fontSize:14,lineHeight:1.7,color:"#64748B",
                    padding:"0 24px 20px",borderTop:"1px solid #F1F5F9"}}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{background:"#0D1B2A",padding:"96px 0",textAlign:"center",position:"relative",overflow:"hidden"}}
        id="waitlist">
        <div style={{position:"absolute",inset:0,
          background:"radial-gradient(ellipse 60% 80% at 50% 100%,rgba(27,108,168,.2) 0%,transparent 70%)",
          pointerEvents:"none"}}/>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px",position:"relative"}}>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase",
            color:"#F59E0B",textAlign:"center",marginBottom:10}}>
            Start free
          </div>
          <h2 style={{fontSize:"clamp(24px,3.5vw,40px)",fontWeight:600,color:"#fff",
            letterSpacing:"-.02em",marginBottom:12}}>
            Your PMO deserves better tools
          </h2>
          <p style={{fontSize:16,color:"rgba(255,255,255,.5)",marginBottom:32,lineHeight:1.65,
            maxWidth:420,margin:"0 auto 32px"}}>
            Two months free, the whole product. Import one of your real project plans and see it running in 30 seconds.
          </p>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:14,flexWrap:"wrap"}}>
            <Link href="/auth/signup"
              style={{padding:"14px 28px",background:"#F59E0B",color:"#0D1B2A",borderRadius:10,
                fontSize:14,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>
              Start free trial →
            </Link>
            <button onClick={()=>setDemoOpen(true)}
              style={{padding:"14px 24px",background:"rgba(255,255,255,.06)",color:"#fff",
                border:"1.5px solid rgba(255,255,255,.15)",borderRadius:10,fontSize:14,
                fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
              Request a demo
            </button>
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.3)",textAlign:"center"}}>
            Free for 2 months · Cancel any time before it converts · Bilingual EN / ES
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:"#080F17",borderTop:"1px solid rgba(255,255,255,.05)",padding:"56px 0 32px"}}>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:40,marginBottom:48}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
                <div style={{width:28,height:28,background:"#1B6CA8",borderRadius:7,position:"relative",flexShrink:0}}>
                  <div style={{position:"absolute",width:13,height:2,background:"#fff",top:8,left:7,borderRadius:2}}/>
                  <div style={{position:"absolute",width:8,height:2,background:"#F59E0B",top:13,left:7,borderRadius:2}}/>
                </div>
                <span style={{fontWeight:700,fontSize:14,color:"#fff"}}>FlowSync <span style={{color:"#F59E0B"}}>PM</span></span>
              </div>
              <p style={{fontSize:13,color:"rgba(255,255,255,.35)",lineHeight:1.65,maxWidth:240,margin:"0 0 12px"}}>
                Enterprise project management for PMOs, portfolios, and multi-project organizations.
              </p>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,
                padding:"4px 10px",borderRadius:5,background:"rgba(5,150,105,.15)",color:"#34D399"}}>
                🔒 Enterprise-ready
              </div>
            </div>
            {[
              { title:"Product",  links:["Features","Pricing","Templates","Changelog","API docs"] },
              { title:"Solutions",links:["PMO & Enterprise","Portfolio & Programs","Consultants","IT & Cloud"] },
              { title:"Company",  links:["About","Contact sales","Support","Privacy policy","Terms"] },
            ].map(col=>(
              <div key={col.title}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",
                  color:"rgba(255,255,255,.3)",marginBottom:14}}>
                  {col.title}
                </div>
                {col.links.map(l=>(
                  <a key={l} href="#"
                    style={{display:"block",fontSize:13,color:"rgba(255,255,255,.45)",
                      textDecoration:"none",marginBottom:10,transition:"color .15s"}}
                    onMouseOver={e=>(e.currentTarget.style.color="rgba(255,255,255,.8)")}
                    onMouseOut={e=>(e.currentTarget.style.color="rgba(255,255,255,.45)")}>
                    {l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:24,
            display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>© 2026 FlowSync PM. All rights reserved.</div>
            <div style={{display:"flex",gap:20}}>
              {["Privacy","Terms","Security","Status"].map(l=>(
                <a key={l} href="#" style={{fontSize:12,color:"rgba(255,255,255,.25)",textDecoration:"none"}}>
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
      <RequestDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} source="landing" />
    </div>
  )
}
