"use client"
// src/components/landing/LandingPage.tsx
// Public landing page. The product is live — this page sells a free trial, not a waitlist.
//
// Thesis: the buyer already has a project plan, written in Word or Excel, that isn't
// doing any work. The hero shows that document BECOMING a running project — the import
// sequence is choreographed on load: filename → bars draw themselves → KPIs land →
// the AT RISK stamp. That animation is the signature; everything else stays quiet
// (scroll reveals, glass nav, hover lifts) so the one bold thing carries the page.
// prefers-reduced-motion disables all of it.

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { RequestDemoModal } from "@/components/marketing/RequestDemoModal"
import { LogoMark, Wordmark } from "@/components/shared/Logo"

// ── Tokens ───────────────────────────────────────────────────────────────────
const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", GREEN = "#059669"
const INK = "#0F172A", SLATE = "#64748B", MUTED = "#94A3B8", LINE = "#E2E8F0", PAPER = "#F8FAFC"
// Project work is coded — WBS numbers, milestone IDs, CPI values. The app renders
// those in monospace; the page borrows the same vernacular rather than inventing one.
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

const NAV_LINKS = [
  { href:"#import",   label:"How it works" },
  { href:"#who",      label:"Who it's for" },
  { href:"#features", label:"Features" },
  { href:"#pricing",  label:"Pricing" },
  { href:"#faq",      label:"FAQ" },
]

// What the AI pulls out of an uploaded plan — the counts are what a real import produces.
const EXTRACTED = [
  { code:"1.0",      label:"Phases & milestones", desc:"Every phase, its dates, and the milestone that closes it." },
  { code:"TASK",     label:"Tasks with dates & effort", desc:"Names, start and finish, estimated hours, dependencies, owners." },
  { code:"RISK-001", label:"Risks, scored",        desc:"Probability × impact, response strategy, and who owns it." },
  { code:"$",        label:"Budget lines",         desc:"Cost categories and planned amounts, ready for EVM." },
  { code:"REQ-001",  label:"Requirements",         desc:"Functional and non-functional, with acceptance criteria." },
  { code:"GOV",      label:"Governance documents", desc:"Charter, WBS dictionary, quality plan, minutes, handover." },
]

const AUDIENCES = [
  { role:"PMO directors", accent:STEEL,
    line:"You need every project on one view, held to one standard.",
    points:["Portfolio and program hierarchy","Phase gates that actually gate","Governance artifacts in one repository","Standards enforced, not suggested"] },
  { role:"Project managers", accent:AMBER,
    line:"You need the plan to stay true without living in a spreadsheet.",
    points:["Gantt with critical path and baselines","Risk, issue, change and decision registers","AI-drafted status reports","Resource workload across projects"] },
  { role:"Sponsors & executives", accent:GREEN,
    line:"You need the answer before you have to ask for it.",
    points:["Health, CPI and SPI at a glance","Approvals where you already are","Benefits tracked against the business case","No seat cost — you're in the bundle"] },
]

const FEATURES = [
  { icon:"📊", title:"Interactive Gantt + critical path", color:"#EFF6FF", tag:"Predictive", tagColor:STEEL,
    desc:"Drag-and-drop scheduling with FS/SS/FF dependencies, baseline overlays, and critical path highlighting. Export to PDF or share a live link." },
  { icon:"💰", title:"Budget tracking with EVM", color:"#ECFDF5", tag:"Built-in", tagColor:GREEN,
    desc:"Planned value, earned value, CPI, SPI, EAC and VAC calculated from your task data. No spreadsheet required." },
  { icon:"🤖", title:"AI status reports", color:"#F5F3FF", tag:"AI-powered", tagColor:"#7C3AED",
    desc:"One click produces a weekly status report — accomplishments, risks, milestones, budget — drafted by AI, reviewed by you." },
  { icon:"📄", title:"Document template library", color:"#FFFBEB", tag:"18 templates", tagColor:"#92400E",
    desc:"Charter, WBS, risk register, minutes, handover and more, in Word and Excel. Fill one in, upload it, and it populates the project." },
  { icon:"🔒", title:"Roles, permissions and audit", color:"#FEF2F2", tag:"Enterprise", tagColor:"#DC2626",
    desc:"Granular role levels, two-factor auth, Microsoft and Google SSO, and a full audit log ready for a compliance review." },
  { icon:"🌐", title:"Bilingual, end to end", color:"#ECFEFF", tag:"EN / ES", tagColor:"#0891B2",
    desc:"Every screen, every report, every generated document works in English and Spanish. Switch language without losing your place." },
]

const PLANS = [
  { name:"Trial", price:0, suffix:"", featured:false,
    tagline:"Two months free, the whole product.",
    note:"No card required. Subscribe any time during the trial — you keep every remaining free day.",
    features:["Everything unlocked","Unlimited projects","AI document import","Bilingual EN / ES"],
    cta:"Start free trial" },
  { name:"Starter", price:19, suffix:"/user/mo", featured:false,
    tagline:"For small teams and independent PMs.",
    note:"Flat per user. No tiers to decode.",
    features:["Unlimited projects","Predictive, Agile & Hybrid","AI import & status reports","Budget tracking + EVM","Risk & issue registers","Document templates"],
    cta:"Start free trial" },
  { name:"Business", price:39, suffix:"/user/mo", featured:true,
    tagline:"For PMOs running a portfolio.",
    note:"Paid seats for the roles that drive the work. Everyone else: $20/mo per 10.",
    features:["Everything in Starter","$20/mo per 10 contributor seats","Portfolio & program hierarchy",
      "AI reads scanned documents (200 pages/mo)","SSO — Microsoft & Google","Executive dashboard & approvals","Resource workload engine","Full governance suite","Email support"],
    cta:"Start free trial" },
]

const FAQS = [
  { q:"Can I try it before paying?",
    a:"Yes. Every account starts with a two-month free trial of the full product, with no feature limits — and no credit card. When you're ready, subscribe from Settings → Billing; if you do it during the trial, your card isn't charged until the trial actually ends. If two months pass and you haven't subscribed, nothing is charged — your work stays safe and read-only until you do." },
  { q:"Do I pay for everyone on the team?",
    a:"No. On Business you pay per user only for the roles that drive and govern the work: sponsors, PMO directors, program and project managers, product owners, PMO analysts. Everyone who contributes or just needs visibility — team members, stakeholders, clients, external resources — comes in bundles at $20/mo per 10 people." },
  { q:"What can it actually read from my plan?",
    a:"Upload a project plan in Word, Excel or PDF and it extracts phases, milestones, tasks with dates and effort, risks with scoring, budget lines, and requirements. You review everything before it commits — nothing is written to your project until you approve it." },
  { q:"Does it support Waterfall, Agile and Hybrid in one workspace?",
    a:"Yes — all three share the same data model. A predictive project shows phases and a Gantt. An agile one shows a backlog and sprint board. Hybrid runs both. You can run all three at once, in one portfolio." },
  { q:"Is it suitable for regulated or audited work?",
    a:"The platform keeps a full audit log, role-based data controls, and a governance repository holding charter, quality plan, decisions, minutes and handover records. Enterprise adds a Data Processing Agreement and custom terms." },
]

const GANTT_BARS = [
  { name:"Initiation",    code:"1.0", color:GREEN,  start:0,  width:12, pct:100 },
  { name:"Requirements",  code:"2.0", color:STEEL,  start:11, width:22, pct:100 },
  { name:"Configuration", code:"3.0", color:"#7C3AED", start:22, width:30, pct:80 },
  { name:"Testing",       code:"4.0", color:"#0891B2", start:52, width:20, pct:20 },
  { name:"Go-live",       code:"5.0", color:AMBER,  start:72, width:12, pct:0 },
]
const TODAY_X = 64

export default function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [openFaq, setOpenFaq]   = useState<number | null>(0)
  const [scrolled, setScrolled] = useState(false)
  const [importSecs, setImportSecs] = useState(0)
  const [runId, setRunId] = useState(0)          // each increment replays the import
  const [heroY, setHeroY] = useState(0)          // parallax depth on the hero card
  const rootRef = useRef<HTMLDivElement>(null)

  // Glass nav after the page moves.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Scroll reveals: one observer, elements opt in with the .rv class and
  // stagger via --i. Fires once each — a page that keeps animating gets tiring.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const els = rootRef.current?.querySelectorAll(".rv")
    if (!els?.length) return
    if (reduce) { els.forEach(el => el.classList.add("in")); return }
    const ob = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); ob.unobserve(e.target) }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" })
    els.forEach(el => ob.observe(el))

    // $197 counts up the first time the pricing band reveals.
    const priceEl = rootRef.current?.querySelector(".fs-197")
    let priceOb: IntersectionObserver | null = null
    if (priceEl && !reduce) {
      priceOb = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return
        priceOb?.disconnect()
        let v = 0
        const id = setInterval(() => {
          v += Math.ceil((197 - v) / 6) || 1
          if (v >= 197) { v = 197; clearInterval(id) }
          priceEl.textContent = "$" + v
        }, 40)
      }, { threshold: .5 })
      priceOb.observe(priceEl)
    }
    return () => { ob.disconnect(); priceOb?.disconnect() }
  }, [])

  // The import counter ticks to 31s while the Gantt draws itself, then the whole
  // sequence replays every 9s — a demo reel. runId keys the card so CSS
  // animations restart with each cycle.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setImportSecs(31); return }
    let v = 0
    setImportSecs(0)
    const id = setInterval(() => {
      v += Math.ceil((31 - v) / 7) || 1
      if (v >= 31) { v = 31; clearInterval(id) }
      setImportSecs(v)
    }, 60)
    return () => clearInterval(id)
  }, [runId])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setRunId(r => r + 1), 9000)
    return () => clearInterval(id)
  }, [])

  // Gentle parallax: the hero card drifts against the scroll, adding depth.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setHeroY(window.scrollY * -0.06)) }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={rootRef} style={{ background:"#fff", color:INK, fontFamily:"var(--font)" }}>
      <style>{`
        .fs-hero { display:grid; grid-template-columns:1fr; gap:48px; align-items:center; }
        .fs-grid3 { display:grid; grid-template-columns:1fr; gap:16px; }
        .fs-grid2 { display:grid; grid-template-columns:1fr; gap:14px; }
        .fs-band  { display:flex; flex-direction:column; gap:20px; }
        @media (min-width:900px) {
          .fs-hero  { grid-template-columns:1.05fr .95fr; gap:56px; }
          .fs-grid3 { grid-template-columns:repeat(3,1fr); }
          .fs-grid2 { grid-template-columns:repeat(2,1fr); }
          .fs-band  { flex-direction:row; align-items:center; gap:36px; }
        }
        .fs-link { transition:color .15s ease; }
        .fs-link:hover { color:#fff !important; }

        /* ── Load choreography: hero copy rises in sequence ─────────────── */
        @keyframes fsUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        .fs-l1,.fs-l2,.fs-l3,.fs-l4,.fs-l5 { opacity:0; animation:fsUp .7s cubic-bezier(.16,1,.3,1) forwards; }
        .fs-l1 { animation-delay:.05s } .fs-l2 { animation-delay:.15s }
        .fs-l3 { animation-delay:.28s } .fs-l4 { animation-delay:.42s } .fs-l5 { animation-delay:.55s }

        /* ── The signature: the import sequence ─────────────────────────── */
        @keyframes fsCard { from { opacity:0; transform:translateY(22px) scale(.985); }
                            to   { opacity:1; transform:none; } }
        .fs-shot { animation:fsCard .8s cubic-bezier(.16,1,.3,1) .25s both; }
        @keyframes fsBar { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        .fs-bar { transform-origin:left center; animation:fsBar .9s cubic-bezier(.16,1,.3,1) both; }
        @keyframes fsPop { 0% { opacity:0; transform:scale(.6); } 70% { transform:scale(1.06); } 100% { opacity:1; transform:scale(1); } }
        .fs-stamp { animation:fsPop .45s cubic-bezier(.16,1,.3,1) 2s both; }
        @keyframes fsFade { from { opacity:0; } to { opacity:1; } }
        .fs-kpi { opacity:0; animation:fsFade .6s ease forwards; }
        @keyframes fsPulse { 0%,100% { opacity:.5; } 50% { opacity:.9; } }
        .fs-today { animation:fsPulse 3.2s ease-in-out 2.4s infinite; }

        /* ── Ambient aurora — brand colors, barely there, very slow ─────── */
        @keyframes fsDriftA { 0%,100% { transform:translate(0,0); } 50% { transform:translate(4%,6%); } }
        @keyframes fsDriftB { 0%,100% { transform:translate(0,0); } 50% { transform:translate(-5%,-4%); } }
        .fs-auroraA { animation:fsDriftA 18s ease-in-out infinite; }
        .fs-auroraB { animation:fsDriftB 22s ease-in-out infinite; }

        /* ── Scroll reveals ─────────────────────────────────────────────── */
        .rv { opacity:0; transform:translateY(18px);
              transition:opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
              transition-delay:calc(var(--i,0) * 90ms); }
        .rv.in { opacity:1; transform:none; }

        /* ── Micro-interactions ─────────────────────────────────────────── */
        .fs-card { transition:transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s ease, border-color .22s ease; }
        .fs-card:hover { transform:translateY(-4px); box-shadow:0 16px 36px rgba(13,27,42,.1); border-color:${STEEL}55 !important; }
        .fs-cta { transition:transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s ease; }
        .fs-cta:hover { transform:translateY(-1px) scale(1.02); box-shadow:0 8px 24px rgba(245,158,11,.35); }
        .fs-ghost { transition:background .18s ease, border-color .18s ease; }
        .fs-ghost:hover { background:rgba(255,255,255,.11) !important; border-color:rgba(255,255,255,.3) !important; }
        .fs-faq-a { display:grid; grid-template-rows:0fr; transition:grid-template-rows .32s cubic-bezier(.16,1,.3,1); }
        .fs-faq-a.open { grid-template-rows:1fr; }
        .fs-faq-a > div { overflow:hidden; }

        a:focus-visible, button:focus-visible, summary:focus-visible {
          outline:2px solid ${AMBER}; outline-offset:3px; border-radius:6px;
        }
        /* Headline shimmer — amber with a slow light sweep */
        .fs-shimmer {
          background:linear-gradient(110deg, ${AMBER} 20%, #FFD57E 40%, ${AMBER} 60%);
          background-size:220% 100%;
          -webkit-background-clip:text; background-clip:text;
          color:transparent; -webkit-text-fill-color:transparent;
          animation:fsShimmer 5.5s ease-in-out infinite;
        }
        @keyframes fsShimmer { 0%,100% { background-position:110% 0; } 50% { background-position:-10% 0; } }

        /* Floating vernacular chips around the hero card */
        .fs-chip { position:absolute; z-index:2; font-family:${MONO}; font-size:10.5px; font-weight:700;
          padding:6px 11px; border-radius:8px; background:rgba(13,27,42,.88); color:#E2E8F0;
          border:1px solid rgba(255,255,255,.16); box-shadow:0 10px 26px rgba(0,0,0,.35);
          backdrop-filter:blur(6px); pointer-events:none; display:none; }
        @media (min-width:900px) { .fs-chip { display:block; } }
        .fs-chipA { top:-14px; right:-22px; color:#FCA5A5; animation:fsFloatA 6.5s ease-in-out infinite; }
        .fs-chipB { bottom:64px; left:-30px; color:#6EE7B7; animation:fsFloatB 7.5s ease-in-out 1s infinite; }
        .fs-chipC { bottom:-12px; right:24px; color:#FCD34D; animation:fsFloatA 8s ease-in-out .5s infinite; }
        @keyframes fsFloatA { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-9px); } }
        @keyframes fsFloatB { 0%,100% { transform:translateY(0); } 50% { transform:translateY(8px); } }

        /* Capability marquee */
        .fs-marquee { display:flex; width:max-content; animation:fsMarquee 34s linear infinite; }
        .fs-marquee:hover { animation-play-state:paused; }
        @keyframes fsMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }

        /* CTA shine sweep */
        .fs-cta { position:relative; overflow:hidden; }
        .fs-cta::after { content:""; position:absolute; top:0; bottom:0; left:-80%; width:50%;
          background:linear-gradient(105deg, transparent, rgba(255,255,255,.55), transparent);
          transform:skewX(-20deg); transition:left .5s ease; }
        .fs-cta:hover::after { left:130%; }

        @media (prefers-reduced-motion:reduce) {
          .fs-shimmer { animation:none; background:none; color:${AMBER}; -webkit-text-fill-color:${AMBER}; }
          .fs-chip, .fs-marquee { animation:none; }
          .fs-cta::after { display:none; }
          .fs-l1,.fs-l2,.fs-l3,.fs-l4,.fs-l5,.fs-shot,.fs-bar,.fs-stamp,.fs-kpi { animation:none; opacity:1; transform:none; }
          .fs-today,.fs-auroraA,.fs-auroraB { animation:none; }
          .rv { opacity:1; transform:none; transition:none; }
          .fs-card,.fs-card:hover,.fs-cta,.fs-cta:hover { transition:none; transform:none; }
          .fs-faq-a { transition:none; }
        }
      `}</style>

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav style={{ position:"sticky", top:0, zIndex:100,
        background: scrolled ? "rgba(13,27,42,.88)" : "rgba(13,27,42,.35)",
        backdropFilter: scrolled ? "blur(14px) saturate(1.4)" : "blur(4px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,.1)" : "1px solid transparent",
        boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,.25)" : "none",
        transition:"background .3s ease, border-color .3s ease, box-shadow .3s ease, backdrop-filter .3s ease" }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px", height:60,
          display:"flex", alignItems:"center", gap:8 }}>
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none", marginRight:14 }}>
            <LogoMark size={26} radius={7} />
            <Wordmark size={15} />
          </Link>

          <div style={{ display:"flex", gap:2, marginRight:"auto" }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className="fs-link"
                style={{ fontSize:13, color:"rgba(255,255,255,.5)", textDecoration:"none",
                  padding:"6px 10px", borderRadius:6, whiteSpace:"nowrap" }}>
                {l.label}
              </a>
            ))}
          </div>

          <button onClick={() => setDemoOpen(true)} className="fs-link"
            style={{ fontSize:13, color:"rgba(255,255,255,.5)", background:"none", border:"none",
              cursor:"pointer", padding:"6px 10px", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            Request a demo
          </button>
          <Link href="/auth/signin" className="fs-link"
            style={{ fontSize:13, color:"rgba(255,255,255,.5)", textDecoration:"none", padding:"6px 10px" }}>
            Sign in
          </Link>
          <Link href="/auth/signup" className="fs-cta"
            style={{ padding:"8px 16px", background:AMBER, color:NAVY, borderRadius:8,
              fontSize:13, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
            Start free
          </Link>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{ background:NAVY, padding:"92px 0 100px", position:"relative",
        overflow:"hidden", marginTop:-60, paddingTop:152 }}>
        {/* Ambient: two brand-color fields drifting almost imperceptibly */}
        <div aria-hidden className="fs-auroraA" style={{ position:"absolute", top:"-20%", right:"-10%",
          width:"70%", height:"80%", borderRadius:"50%", filter:"blur(80px)",
          background:"radial-gradient(circle, rgba(27,108,168,.30) 0%, transparent 65%)",
          pointerEvents:"none" }} />
        <div aria-hidden className="fs-auroraB" style={{ position:"absolute", bottom:"-30%", left:"-8%",
          width:"55%", height:"70%", borderRadius:"50%", filter:"blur(90px)",
          background:"radial-gradient(circle, rgba(245,158,11,.10) 0%, transparent 60%)",
          pointerEvents:"none" }} />
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px", position:"relative" }}>
          <div className="fs-hero">
            {/* Left */}
            <div>
              <div className="fs-l1" style={{ display:"inline-flex", alignItems:"center", gap:7, marginBottom:22,
                padding:"5px 12px", borderRadius:100, background:"rgba(5,150,105,.14)",
                border:"1px solid rgba(5,150,105,.3)" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#34D399" }} />
                <span style={{ fontSize:11.5, fontWeight:600, color:"#34D399", letterSpacing:".02em" }}>
                  Live now · Free for two months
                </span>
              </div>

              <h1 style={{ fontSize:"clamp(34px,4.6vw,58px)", fontWeight:800, lineHeight:1.06,
                letterSpacing:"-.035em", color:"#fff", marginBottom:20 }}>
                <span className="fs-l2" style={{ display:"block" }}>Your plan is already written.</span>
                <span className="fs-l3 fs-shimmer" style={{ display:"block" }}>Turn it into a live project.</span>
              </h1>

              <p className="fs-l4" style={{ fontSize:17, lineHeight:1.65, color:"rgba(255,255,255,.6)",
                marginBottom:30, maxWidth:490 }}>
                FlowSync PM reads the project document you already have — Word, Excel, PDF — and
                builds the whole thing: phases, tasks, dates, risks, budget. Then it keeps it
                governed, with EVM, phase gates and reporting your sponsor will actually read.
              </p>

              <div className="fs-l5">
                <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                  <Link href="/auth/signup" className="fs-cta"
                    style={{ padding:"14px 26px", background:AMBER, color:NAVY, borderRadius:10,
                      fontSize:14.5, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
                    Start free trial →
                  </Link>
                  <button onClick={() => setDemoOpen(true)} className="fs-ghost"
                    style={{ padding:"14px 24px", background:"rgba(255,255,255,.06)", color:"#fff",
                      border:"1.5px solid rgba(255,255,255,.16)", borderRadius:10, fontSize:14.5,
                      fontWeight:600, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    Request a demo
                  </button>
                </div>
                <p style={{ fontSize:12.5, color:"rgba(255,255,255,.35)", lineHeight:1.6 }}>
                  No credit card required. Two months of the full product, then subscribe only if
                  it earned it.
                </p>
              </div>
            </div>

            {/* Right — the signature: a document visibly BECOMING a project.
                Replays every 9s (key={runId}); floats on scroll (parallax). */}
            <div style={{ position:"relative", transform:`translateY(${heroY}px)`, willChange:"transform" }}>
              <div aria-hidden className="fs-chip fs-chipA">RISK-001 · scored 15</div>
              <div aria-hidden className="fs-chip fs-chipB">✓ 47 tasks imported</div>
              <div aria-hidden className="fs-chip fs-chipC">$ 1.2M → EVM</div>
            <div key={runId} className="fs-shot" style={{ background:"#fff", borderRadius:14, overflow:"hidden",
              boxShadow:"0 28px 70px rgba(0,0,0,.42)", border:"1px solid rgba(255,255,255,.1)" }}>
              {/* Provenance — the whole pitch in one strip, counter ticking */}
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px",
                background:"#EFF6FF", borderBottom:`1px solid ${LINE}` }}>
                <span style={{ fontSize:13 }}>📄</span>
                <span style={{ fontFamily:MONO, fontSize:11, color:STEEL, fontWeight:600 }}>
                  Project_Plan.docx
                </span>
                <span style={{ color:MUTED, fontSize:11 }}>→</span>
                <span style={{ fontSize:11, color:SLATE }}>imported in</span>
                <span style={{ fontFamily:MONO, fontSize:11, color:GREEN, fontWeight:700,
                  minWidth:26, display:"inline-block" }}>{importSecs}s</span>
                <span style={{ marginLeft:"auto", fontFamily:MONO, fontSize:10, color:MUTED }}>PRJ-006</span>
              </div>

              {/* Title bar */}
              <div style={{ padding:"14px 16px 10px", borderBottom:`1px solid ${LINE}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:INK }}>ERP Rollout — Phase 2</div>
                  <span className="fs-stamp" style={{ fontSize:9.5, fontWeight:700, padding:"2px 7px", borderRadius:4,
                    background:"#FFFBEB", color:"#B45309", fontFamily:MONO }}>AT RISK</span>
                </div>
                <div style={{ fontSize:11, color:MUTED, marginTop:3 }}>
                  5 phases · 47 tasks · 12 risks · $1.2M budget
                </div>
              </div>

              {/* Gantt — bars draw themselves in, staggered like a real import */}
              <div style={{ padding:"12px 16px 6px" }}>
                <div style={{ display:"flex", marginBottom:8, paddingLeft:96 }}>
                  {["Jan","Mar","May","Jul","Sep"].map(m => (
                    <div key={m} style={{ flex:1, fontSize:9, color:MUTED, fontFamily:MONO }}>{m}</div>
                  ))}
                </div>
                {GANTT_BARS.map((b, bi) => (
                  <div key={b.name} style={{ display:"flex", alignItems:"center", marginBottom:7 }}>
                    <div style={{ width:96, display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                      <span style={{ fontFamily:MONO, fontSize:9, color:MUTED }}>{b.code}</span>
                      <span style={{ fontSize:10.5, color:SLATE, whiteSpace:"nowrap",
                        overflow:"hidden", textOverflow:"ellipsis" }}>{b.name}</span>
                    </div>
                    <div style={{ flex:1, height:16, background:PAPER, borderRadius:4, position:"relative" }}>
                      <div aria-hidden className="fs-today" style={{ position:"absolute", left:`${TODAY_X}%`, top:-3, bottom:-3,
                        width:1.5, background:"#DC2626", opacity:.5 }} />
                      <div className="fs-bar" style={{ position:"absolute", left:`${b.start}%`, width:`${b.width}%`,
                        top:0, bottom:0, background:b.color, borderRadius:4, opacity:.22,
                        animationDelay:`${.55 + bi * .16}s` }} />
                      <div className="fs-bar" style={{ position:"absolute", left:`${b.start}%`, width:`${b.width * b.pct / 100}%`,
                        top:0, bottom:0, background:b.color, borderRadius:4,
                        animationDelay:`${.7 + bi * .16}s` }} />
                    </div>
                    <div className="fs-kpi" style={{ width:32, textAlign:"right", fontFamily:MONO, fontSize:9.5,
                      color: b.pct === 100 ? GREEN : SLATE, animationDelay:`${.9 + bi * .16}s` }}>{b.pct}%</div>
                  </div>
                ))}
              </div>

              {/* KPI strip — lands after the bars, like results arriving */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderTop:`1px solid ${LINE}` }}>
                {[["68%","Complete",INK],["0.94","CPI","#B45309"],["$820K","Spent",INK],["M3","Next gate",STEEL]].map(([v,l,c], ki) => (
                  <div key={l} className="fs-kpi" style={{ padding:"10px 8px", textAlign:"center",
                    borderRight:`1px solid ${LINE}`, animationDelay:`${1.5 + ki * .12}s` }}>
                    <div style={{ fontFamily:MONO, fontSize:14, fontWeight:700, color:c as string }}>{v}</div>
                    <div style={{ fontSize:9, color:MUTED, textTransform:"uppercase", letterSpacing:".05em", marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Capability marquee — the product's vocabulary, in motion */}
        <div style={{ marginTop:64, borderTop:"1px solid rgba(255,255,255,.08)",
          borderBottom:"1px solid rgba(255,255,255,.08)", overflow:"hidden", position:"relative" }}>
          <div className="fs-marquee">
            {[0,1].map(dup => (
              <div key={dup} aria-hidden={dup === 1} style={{ display:"flex", flexShrink:0 }}>
                {["AI document import","Gantt + critical path","EVM built-in","Phase gates","Risk registers",
                  "AI status reports","Reads scanned PDFs","English · Español","Microsoft & Google SSO",
                  "Portfolio hierarchy","18 templates","Full audit log"].map(t => (
                  <span key={t} style={{ fontFamily:MONO, fontSize:11, letterSpacing:".08em",
                    textTransform:"uppercase", color:"rgba(255,255,255,.38)", padding:"13px 0",
                    whiteSpace:"nowrap", display:"inline-flex", alignItems:"center" }}>
                    {t}<span style={{ color:AMBER, margin:"0 22px", opacity:.6 }}>·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IMPORT ────────────────────────────────────────────── */}
      <section id="import" style={{ padding:"84px 0", background:"#fff" }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px" }}>
          <div className="rv" style={{ maxWidth:640, marginBottom:44 }}>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:".1em",
              textTransform:"uppercase", color:STEEL, marginBottom:12 }}>
              How it works
            </div>
            <h2 style={{ fontSize:"clamp(26px,3.4vw,40px)", fontWeight:700, lineHeight:1.18,
              letterSpacing:"-.025em", marginBottom:14 }}>
              One document in. A governed project out.
            </h2>
            <p style={{ fontSize:16.5, color:SLATE, lineHeight:1.65 }}>
              Most tools hand you an empty workspace and wish you luck. Upload the plan you already
              wrote and FlowSync PM reads it, shows you exactly what it found, and waits for your
              approval before writing a single row.
            </p>
          </div>

          <div className="fs-grid3">
            {EXTRACTED.map((e, i) => (
              <div key={e.label} className="fs-card rv" 
                style={{ ["--i" as any]: i % 3, border:`1px solid ${LINE}`, borderRadius:12, padding:"18px 18px 20px",
                  borderLeft:`3px solid ${STEEL}` }}>
                <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:STEEL,
                  background:"#EFF6FF", display:"inline-block", padding:"2px 7px",
                  borderRadius:4, marginBottom:10 }}>{e.code}</div>
                <div style={{ fontSize:14.5, fontWeight:700, marginBottom:5 }}>{e.label}</div>
                <div style={{ fontSize:13, color:SLATE, lineHeight:1.6 }}>{e.desc}</div>
              </div>
            ))}
          </div>

          <div className="rv" style={{ marginTop:26, padding:"16px 20px", background:PAPER,
            borderRadius:12, border:`1px solid ${LINE}`, fontSize:13.5, color:SLATE, lineHeight:1.65 }}>
            <strong style={{ color:INK }}>It works in reverse too.</strong>{" "}
            Download a blank charter, WBS or quality plan from the template library, fill it in,
            upload it, and the project updates itself. Eighteen templates, Word and Excel, English
            and Spanish.
          </div>
        </div>
      </section>

      {/* ── WHO ───────────────────────────────────────────────── */}
      <section id="who" style={{ padding:"84px 0", background:PAPER, borderTop:`1px solid ${LINE}`, borderBottom:`1px solid ${LINE}` }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px" }}>
          <div className="rv" style={{ maxWidth:640, marginBottom:40 }}>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:".1em",
              textTransform:"uppercase", color:STEEL, marginBottom:12 }}>
              Who it's for
            </div>
            <h2 style={{ fontSize:"clamp(26px,3.4vw,40px)", fontWeight:700, lineHeight:1.18,
              letterSpacing:"-.025em" }}>
              Three people, one source of truth
            </h2>
          </div>

          <div className="fs-grid3">
            {AUDIENCES.map((a, i) => (
              <div key={a.role} className="fs-card rv"
                style={{ ["--i" as any]: i, background:"#fff", border:`1px solid ${LINE}`,
                  borderRadius:12, padding:"22px 20px", borderTop:`3px solid ${a.accent}` }}>
                <div style={{ fontSize:15.5, fontWeight:700, marginBottom:7 }}>{a.role}</div>
                <div style={{ fontSize:13.5, color:SLATE, lineHeight:1.6, marginBottom:16 }}>{a.line}</div>
                <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex",
                  flexDirection:"column", gap:8 }}>
                  {a.points.map(p => (
                    <li key={p} style={{ display:"flex", gap:8, fontSize:13, color:INK, lineHeight:1.5 }}>
                      <span style={{ color:a.accent, flexShrink:0, fontWeight:700 }}>·</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section id="features" style={{ padding:"84px 0", background:"#fff" }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px" }}>
          <div className="rv" style={{ maxWidth:640, marginBottom:40 }}>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:".1em",
              textTransform:"uppercase", color:STEEL, marginBottom:12 }}>
              Features
            </div>
            <h2 style={{ fontSize:"clamp(26px,3.4vw,40px)", fontWeight:700, lineHeight:1.18,
              letterSpacing:"-.025em", marginBottom:14 }}>
              The depth a PMO needs, without the enterprise tax
            </h2>
            <p style={{ fontSize:16.5, color:SLATE, lineHeight:1.65 }}>
              Everything below ships today. No roadmap promises, no "coming soon" badges.
            </p>
          </div>

          <div className="fs-grid3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="fs-card rv"
                style={{ ["--i" as any]: i % 3, border:`1px solid ${LINE}`, borderRadius:12, padding:"20px", background:"#fff" }}>
                <div style={{ width:38, height:38, borderRadius:9, background:f.color,
                  display:"grid", placeItems:"center", fontSize:18, marginBottom:14 }}>{f.icon}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7, flexWrap:"wrap" }}>
                  <div style={{ fontSize:14.5, fontWeight:700, lineHeight:1.3 }}>{f.title}</div>
                  <span style={{ fontFamily:MONO, fontSize:9, fontWeight:700, padding:"2px 6px",
                    borderRadius:4, background:`${f.tagColor}14`, color:f.tagColor,
                    whiteSpace:"nowrap" }}>{f.tag}</span>
                </div>
                <div style={{ fontSize:13, color:SLATE, lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      <section id="pricing" style={{ padding:"84px 0", background:PAPER, borderTop:`1px solid ${LINE}` }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px" }}>
          <div className="rv" style={{ maxWidth:640, marginBottom:32 }}>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:".1em",
              textTransform:"uppercase", color:STEEL, marginBottom:12 }}>
              Pricing
            </div>
            <h2 style={{ fontSize:"clamp(26px,3.4vw,40px)", fontWeight:700, lineHeight:1.18,
              letterSpacing:"-.025em", marginBottom:14 }}>
              Pay for the people who drive the work
            </h2>
            <p style={{ fontSize:16.5, color:SLATE, lineHeight:1.65 }}>
              Every other tool charges full price for the person who logs in twice a month to look at
              a chart. We don't.
            </p>
          </div>

          {/* The worked example — the argument, in numbers */}
          <div className="fs-band rv" style={{ background:NAVY, borderRadius:14, padding:"24px 28px", marginBottom:24 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:6 }}>
                A PMO with 3 managers and 40 contributors
              </div>
              <div style={{ fontSize:13.5, color:"rgba(255,255,255,.55)", lineHeight:1.65 }}>
                The three who run projects are paid seats. The other forty — team members,
                stakeholders, clients, executives — come in four bundles of ten.
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, flexShrink:0 }}>
              <div style={{ fontFamily:MONO, fontSize:13, color:"rgba(255,255,255,.45)" }}>
                3 × $39 + 4 × $20 =
              </div>
              <div className="fs-197" style={{ fontFamily:MONO, fontSize:32, fontWeight:800, color:AMBER, lineHeight:1 }}>
                $197
              </div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,.45)" }}>/mo</div>
            </div>
          </div>

          {/* Plans */}
          <div className="fs-grid3">
            {PLANS.map((p, i) => (
              <div key={p.name} className="fs-card rv"
                style={{ ["--i" as any]: i, background:"#fff", borderRadius:14, overflow:"hidden",
                  border: p.featured ? `2px solid ${AMBER}` : `1px solid ${LINE}`,
                  boxShadow: p.featured ? "0 12px 36px rgba(245,158,11,.14)" : "none",
                  display:"flex", flexDirection:"column" }}>
                {p.featured && (
                  <div style={{ background:AMBER, color:NAVY, textAlign:"center", padding:"5px",
                    fontSize:10.5, fontWeight:800, letterSpacing:".08em", textTransform:"uppercase" }}>
                    Most popular
                  </div>
                )}
                <div style={{ padding:"22px 22px 0" }}>
                  <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:SLATE,
                    textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>{p.name}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:3, marginBottom:6 }}>
                    <span style={{ fontSize:40, fontWeight:800, letterSpacing:"-.03em", lineHeight:1 }}>
                      ${p.price}
                    </span>
                    {p.suffix && <span style={{ fontSize:14, color:MUTED, fontWeight:500 }}>{p.suffix}</span>}
                  </div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:INK, marginBottom:4 }}>{p.tagline}</div>
                  <div style={{ fontSize:12.5, color:SLATE, lineHeight:1.55, marginBottom:18, minHeight:36 }}>
                    {p.note}
                  </div>
                </div>
                <div style={{ padding:"0 22px", flex:1 }}>
                  <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex",
                    flexDirection:"column", gap:9 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ display:"flex", gap:9, fontSize:13, lineHeight:1.5 }}>
                        <span style={{ color:GREEN, flexShrink:0, fontWeight:700 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ padding:22 }}>
                  <Link href="/auth/signup" className={p.featured ? "fs-cta" : undefined}
                    style={{ display:"block", textAlign:"center", padding:"11px", borderRadius:9,
                      background: p.featured ? AMBER : NAVY, color: p.featured ? NAVY : "#fff",
                      fontSize:13.5, fontWeight:700, textDecoration:"none" }}>
                    {p.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="fs-band rv" style={{ marginTop:20, background:"#fff", border:`1px solid ${LINE}`,
            borderLeft:`3px solid ${NAVY}`, borderRadius:14, padding:"24px 28px" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:".08em",
                textTransform:"uppercase", color:NAVY, marginBottom:8 }}>Enterprise</div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:8, lineHeight:1.3 }}>
                Running a portfolio, or a regulated program?
              </div>
              <div style={{ fontSize:13.5, color:SLATE, lineHeight:1.65, maxWidth:560 }}>
                Custom pricing, directory sync and advanced SSO, white-labeling, a Data Processing
                Agreement, custom terms — and onboarding run by the person who built the platform.
              </div>
            </div>
            <button onClick={() => setDemoOpen(true)}
              style={{ padding:"13px 26px", background:NAVY, color:"#fff", border:"none",
                borderRadius:9, fontSize:14, fontWeight:700, cursor:"pointer",
                fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 }}>
              Request a demo →
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" style={{ padding:"84px 0", background:"#fff" }}>
        <div style={{ maxWidth:800, margin:"0 auto", padding:"0 24px" }}>
          <div className="rv">
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:".1em",
              textTransform:"uppercase", color:STEEL, marginBottom:12 }}>
              FAQ
            </div>
            <h2 style={{ fontSize:"clamp(26px,3.4vw,40px)", fontWeight:700, lineHeight:1.18,
              letterSpacing:"-.025em", marginBottom:32 }}>
              Questions worth answering
            </h2>
          </div>

          <div className="rv" style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {FAQS.map((f, i) => (
              <div key={f.q} style={{ borderBottom:`1px solid ${LINE}` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:14,
                    padding:"18px 4px", background:"none", border:"none", cursor:"pointer",
                    textAlign:"left", fontFamily:"inherit" }}>
                  <span style={{ fontSize:15, fontWeight:600, color:INK, flex:1, lineHeight:1.4 }}>{f.q}</span>
                  <span aria-hidden style={{ fontSize:18, color:MUTED, flexShrink:0,
                    transform: openFaq === i ? "rotate(45deg)" : "none", transition:"transform .25s cubic-bezier(.16,1,.3,1)" }}>+</span>
                </button>
                <div className={`fs-faq-a${openFaq === i ? " open" : ""}`}>
                  <div>
                    <div style={{ padding:"0 4px 20px", fontSize:14, color:SLATE, lineHeight:1.7, maxWidth:680 }}>
                      {f.a}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section style={{ background:NAVY, padding:"84px 0", textAlign:"center",
        position:"relative", overflow:"hidden" }}>
        <div aria-hidden className="fs-auroraB" style={{ position:"absolute", bottom:"-40%", left:"20%",
          width:"60%", height:"90%", borderRadius:"50%", filter:"blur(90px)",
          background:"radial-gradient(circle, rgba(27,108,168,.25) 0%, transparent 65%)",
          pointerEvents:"none" }} />
        <div className="rv" style={{ maxWidth:640, margin:"0 auto", padding:"0 24px", position:"relative" }}>
          <h2 style={{ fontSize:"clamp(26px,3.4vw,40px)", fontWeight:700, color:"#fff",
            letterSpacing:"-.025em", marginBottom:14, lineHeight:1.18 }}>
            Bring a real plan. See it running.
          </h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,.5)", marginBottom:30, lineHeight:1.65 }}>
            Two months free, the whole product. The fastest way to judge this is to upload a project
            document you already have and watch what comes back.
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:16 }}>
            <Link href="/auth/signup" className="fs-cta"
              style={{ padding:"14px 28px", background:AMBER, color:NAVY, borderRadius:10,
                fontSize:14.5, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
              Start free trial →
            </Link>
            <button onClick={() => setDemoOpen(true)} className="fs-ghost"
              style={{ padding:"14px 24px", background:"rgba(255,255,255,.06)", color:"#fff",
                border:"1.5px solid rgba(255,255,255,.16)", borderRadius:10, fontSize:14.5,
                fontWeight:600, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              Request a demo
            </button>
          </div>
          <p style={{ fontSize:12.5, color:"rgba(255,255,255,.3)" }}>
            Free for two months · No credit card required · English and Español
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ background:NAVY, borderTop:"1px solid rgba(255,255,255,.08)", padding:"36px 0" }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px",
          display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <LogoMark size={22} radius={6} />
            <Wordmark size={13.5} />
          </div>
          <div style={{ display:"flex", gap:18, marginLeft:"auto", flexWrap:"wrap" }}>
            <Link href="/pricing" className="fs-link"
              style={{ fontSize:12.5, color:"rgba(255,255,255,.4)", textDecoration:"none" }}>Pricing</Link>
            <Link href="/legal/terms" className="fs-link"
              style={{ fontSize:12.5, color:"rgba(255,255,255,.4)", textDecoration:"none" }}>Terms</Link>
            <Link href="/legal/dpa" className="fs-link"
              style={{ fontSize:12.5, color:"rgba(255,255,255,.4)", textDecoration:"none" }}>DPA</Link>
            <Link href="/auth/signin" className="fs-link"
              style={{ fontSize:12.5, color:"rgba(255,255,255,.4)", textDecoration:"none" }}>Sign in</Link>
          </div>
          <div style={{ fontSize:11.5, color:"rgba(255,255,255,.25)", width:"100%" }}>
            © 2026 FlowSync PM · Built for PMOs, in English and Español
          </div>
        </div>
      </footer>

      <RequestDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} source="landing" />
    </div>
  )
}
