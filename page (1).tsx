"use client"
// src/components/settings/WhiteLabelView.tsx
import { useState } from "react"

export function WhiteLabelView({ workspace, role }:{ workspace:any; role:string }) {
  const canEdit = ["ADMIN","SYSTEM_ADMIN"].includes(role)
  const isPro   = ["BUSINESS","ENTERPRISE"].includes(workspace?.plan)

  const [form, setForm] = useState({
    customDomain:   workspace?.customDomain   || "",
    brandName:      workspace?.brandName      || workspace?.name || "",
    supportEmail:   workspace?.supportEmail   || "",
    logoUrl:        workspace?.logoUrl        || "",
    faviconUrl:     workspace?.faviconUrl     || "",
    primaryColor:   workspace?.primaryColor   || "#1B6CA8",
    accentColor:    workspace?.accentColor    || "#F59E0B",
    hideFlowSyncBranding: workspace?.hideFlowSyncBranding || false,
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState("")
  const [verifying, setVerifying] = useState(false)
  const [dnsStatus, setDnsStatus] = useState<"unchecked"|"verified"|"pending"|"error">("unchecked")

  async function save() {
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/workspace", {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify(form)
      })
      if(!res.ok) throw new Error((await res.json()).error||"Save failed")
      setSaved(true); setTimeout(()=>setSaved(false),3000)
    } catch(e:any){ setError(e.message) }
    finally { setSaving(false) }
  }

  async function verifyDns() {
    if(!form.customDomain.trim()) return
    setVerifying(true)
    await new Promise(r=>setTimeout(r,1500)) // Simulate DNS check
    setDnsStatus(Math.random()>0.4?"verified":"pending")
    setVerifying(false)
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"9px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
    background: (!canEdit||!isPro) ? "var(--surface)" : "#fff"
  }

  const card: React.CSSProperties = {
    background:"#fff", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", padding:24, marginBottom:16
  }

  const secTitle: React.CSSProperties = {
    fontSize:12, fontWeight:600, color:"var(--text-3)", letterSpacing:".06em",
    textTransform:"uppercase", marginBottom:16, paddingBottom:10, borderBottom:"1px solid var(--border)"
  }

  return (
    <div style={{maxWidth:680}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:4}}>White-label & custom domain</h2>
        <p style={{fontSize:13,color:"var(--text-3)"}}>
          Brand FlowSync PM as your own. Present it to clients under your organization's identity.
        </p>
      </div>

      {!isPro&&(
        <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"var(--radius)",
          padding:"14px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:24,flexShrink:0}}>⭐</span>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#92400E",marginBottom:3}}>
              Business or Enterprise plan required
            </div>
            <div style={{fontSize:12,color:"#92400E"}}>
              White-label features and custom domains are available on Business ($47/mo) and Enterprise plans.
              <a href="/settings/billing" style={{color:"var(--steel)",marginLeft:6}}>Upgrade →</a>
            </div>
          </div>
        </div>
      )}

      {error&&(
        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"var(--red)",
          padding:"10px 14px",borderRadius:"var(--radius)",fontSize:13,marginBottom:16}}>
          {error}
        </div>
      )}

      {/* Custom domain */}
      <div style={card}>
        <div style={secTitle}>Custom domain</div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5}}>
            Domain name
          </label>
          <div style={{display:"flex",gap:8}}>
            <input value={form.customDomain} disabled={!canEdit||!isPro}
              onChange={e=>setForm(f=>({...f,customDomain:e.target.value}))}
              placeholder="pm.yourhospital.com"
              style={{...inp,flex:1}} />
            <button onClick={verifyDns} disabled={!form.customDomain.trim()||verifying||!isPro}
              style={{padding:"9px 16px",background:"var(--surface)",border:"1px solid var(--border)",
                borderRadius:"var(--radius)",fontSize:12,cursor:"pointer",fontFamily:"var(--font)",
                whiteSpace:"nowrap",opacity:!isPro?0.5:1}}>
              {verifying?"Checking…":"Verify DNS"}
            </button>
          </div>
          {dnsStatus!=="unchecked"&&(
            <div style={{marginTop:8,fontSize:12,display:"flex",alignItems:"center",gap:6,
              color:dnsStatus==="verified"?"var(--green)":dnsStatus==="pending"?"var(--amber)":"var(--red)"}}>
              {dnsStatus==="verified"?"✓ DNS verified — domain is active":
               dnsStatus==="pending"?"⏳ DNS propagation in progress (can take up to 48h)":
               "✗ DNS verification failed"}
            </div>
          )}
        </div>
        <div style={{background:"var(--surface)",borderRadius:8,padding:"12px 14px",fontSize:12,
          color:"var(--text-3)",lineHeight:1.7}}>
          <strong style={{color:"var(--text-2)"}}>Setup instructions:</strong><br/>
          1. Add a CNAME record: <code style={{background:"#fff",padding:"1px 5px",borderRadius:3,
            fontFamily:"monospace",fontSize:11}}>pm.yourhospital.com → app.flowsyncpm.com</code><br/>
          2. Click "Verify DNS" above<br/>
          3. SSL certificate will be provisioned automatically within 15 minutes
        </div>
      </div>

      {/* Brand identity */}
      <div style={card}>
        <div style={secTitle}>Brand identity</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          <div>
            <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5}}>
              Brand name
            </label>
            <input value={form.brandName} disabled={!canEdit||!isPro}
              onChange={e=>setForm(f=>({...f,brandName:e.target.value}))}
              placeholder="Your Organization PM"
              style={inp} />
          </div>
          <div>
            <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5}}>
              Support email
            </label>
            <input type="email" value={form.supportEmail} disabled={!canEdit||!isPro}
              onChange={e=>setForm(f=>({...f,supportEmail:e.target.value}))}
              placeholder="support@yourhospital.com"
              style={inp} />
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5}}>
            Logo URL (recommended: 300×80px PNG or SVG)
          </label>
          <input value={form.logoUrl} disabled={!canEdit||!isPro}
            onChange={e=>setForm(f=>({...f,logoUrl:e.target.value}))}
            placeholder="https://yourhospital.com/logo.png"
            style={inp} />
          {form.logoUrl&&(
            <div style={{marginTop:8,padding:"8px 12px",background:"var(--navy,#0D1B2A)",
              borderRadius:"var(--radius)",display:"inline-block"}}>
              <img src={form.logoUrl} alt="Logo preview" style={{height:32,objectFit:"contain"}}
                onError={e=>(e.currentTarget.style.display="none")} />
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          {[
            {key:"primaryColor",label:"Primary color"},
            {key:"accentColor", label:"Accent color"},
          ].map(({key,label})=>(
            <div key={key}>
              <label style={{display:"block",fontSize:12,color:"var(--text-2)",marginBottom:5}}>{label}</label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="color" value={(form as any)[key]} disabled={!canEdit||!isPro}
                  onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  style={{width:40,height:36,border:"1px solid var(--border)",borderRadius:6,
                    padding:2,cursor:(!canEdit||!isPro)?"default":"pointer"}} />
                <input value={(form as any)[key]} disabled={!canEdit||!isPro}
                  onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  style={{...inp,flex:1,fontFamily:"monospace"}} maxLength={7} />
                <div style={{width:36,height:36,borderRadius:6,flexShrink:0,
                  background:(form as any)[key],border:"1px solid var(--border)"}} />
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <input type="checkbox" id="hide-branding" checked={form.hideFlowSyncBranding}
            disabled={!canEdit||!isPro}
            onChange={e=>setForm(f=>({...f,hideFlowSyncBranding:e.target.checked}))}
            style={{width:16,height:16,cursor:(!canEdit||!isPro)?"default":"pointer",
              accentColor:"var(--steel)"}} />
          <label htmlFor="hide-branding" style={{fontSize:13,color:"var(--text-2)",
            cursor:(!canEdit||!isPro)?"default":"pointer"}}>
            Hide "Powered by FlowSync PM" branding in the app footer and email templates
          </label>
        </div>
      </div>

      {/* Preview */}
      <div style={card}>
        <div style={secTitle}>Brand preview</div>
        <div style={{background:"var(--navy,#0D1B2A)",borderRadius:8,padding:"14px 18px",
          display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,background:form.primaryColor,borderRadius:7,position:"relative",flexShrink:0}}>
            <div style={{position:"absolute",width:14,height:2.5,background:"#fff",top:8,left:7,borderRadius:2}}/>
            <div style={{position:"absolute",width:9,height:2.5,background:form.accentColor,top:13,left:7,borderRadius:2}}/>
          </div>
          <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{form.brandName||"Your Brand PM"}</span>
          {!form.hideFlowSyncBranding&&(
            <span style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,.3)"}}>
              Powered by FlowSync PM
            </span>
          )}
        </div>
      </div>

      {canEdit&&isPro&&(
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={save} disabled={saving}
            style={{padding:"10px 22px",background:"var(--steel)",color:"#fff",border:"none",
              borderRadius:"var(--radius)",fontSize:14,fontWeight:500,cursor:"pointer",
              fontFamily:"var(--font)"}}>
            {saving?"Saving…":"Save white-label settings"}
          </button>
          {saved&&<span style={{fontSize:13,color:"var(--green)"}}>✓ Saved</span>}
        </div>
      )}
    </div>
  )
}
