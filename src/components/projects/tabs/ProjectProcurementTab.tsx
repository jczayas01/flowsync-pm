"use client"
// src/components/projects/tabs/ProjectProcurementTab.tsx
// PM Standard Procurement Management — §2.3.5 Apply Expertise (External Resources)
// Tracks contracts, POs, SOWs, MSAs, NDAs per project

import { useState } from "react"
import { usePermissions } from "@/lib/rbac/usePermissions"
import { useRouter } from "next/navigation"
import { AIScanPanel } from "@/components/shared/AIScanPanel"
import { Avatar } from "@/components/ui"

const TYPE_CFG: Record<string,{label:string;color:string;bg:string}> = {
  CONTRACT:       { label:"Contract",       color:"#1B6CA8", bg:"#EFF6FF" },
  PURCHASE_ORDER: { label:"Purchase Order", color:"#059669", bg:"#ECFDF5" },
  SOW:            { label:"SOW",            color:"#7C3AED", bg:"#F5F3FF" },
  MSA:            { label:"MSA",            color:"#0E7490", bg:"#ECFEFF" },
  NDA:            { label:"NDA",            color:"#64748B", bg:"#F8FAFC" },
  OTHER:          { label:"Other",          color:"#94A3B8", bg:"#F8FAFC" },
}
const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  DRAFT:     { label:"Draft",     color:"#64748B", bg:"#F8FAFC" },
  ACTIVE:    { label:"Active",    color:"#059669", bg:"#ECFDF5" },
  COMPLETED: { label:"Completed", color:"#1B6CA8", bg:"#EFF6FF" },
  CANCELLED: { label:"Cancelled", color:"#DC2626", bg:"#FEF2F2" },
  ON_HOLD:   { label:"On Hold",   color:"#D97706", bg:"#FFFBEB" },
}

function fmtDate(d:any) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC" })
}
function fmtCurrency(n:number|null|undefined, currency="USD") {
  if (!n) return "—"
  if (n>=1_000_000) return `${currency} ${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `${currency} ${(n/1_000).toFixed(0)}K`
  return `${currency} ${n.toLocaleString("en-US")}`
}

export function ProjectProcurementTab({ projectId, items, members, workspaceId }: {
  projectId:string; items:any[]; members:any[]; workspaceId:string
}) {
  const { can } = usePermissions()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")
  const [deleting, setDeleting] = useState<string|null>(null)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [selectedVendor, setSelectedVendor] = useState<string|null>(null)
  const [editItem, setEditItem]   = useState<any|null>(null)
  const [editF, setEditF]         = useState<any>({})
  const [savingEdit, setSavingEdit] = useState(false)

  function openEditItem(it: any) {
    setEditItem(it)
    setEditF({
      title: it.title||"", vendorName: it.vendorName||"", vendorContact: it.vendorContact||"",
      vendorEmail: it.vendorEmail||"", vendorPhone: it.vendorPhone||"", vendorLocation: it.vendorLocation||"",
      ownerId: it.ownerId||"", type: it.type||"OTHER", status: it.status||"DRAFT",
      poNumber: it.poNumber||"", contractRef: it.contractRef||"",
      value: it.value != null ? String(it.value) : "", currency: it.currency||"USD",
      startDate: it.startDate ? String(it.startDate).slice(0,10) : "",
      endDate:   it.endDate   ? String(it.endDate).slice(0,10)   : "",
      deliverables: it.deliverables||"", notes: it.notes||"",
    })
  }

  async function patchItem(itemId: string, body: any) {
    const res = await fetch(`/api/projects/${projectId}/procurement/${itemId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d?.error||`Update failed (${res.status})`); return false }
    router.refresh()
    return true
  }

  async function saveItemEdit() {
    if (!editF.title?.trim() || !editF.vendorName?.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const okd = await patchItem(editItem.id, {
        title: editF.title.trim(), vendorName: editF.vendorName.trim(),
        vendorContact: editF.vendorContact||null, vendorEmail: editF.vendorEmail||"",
        vendorPhone: editF.vendorPhone||null, vendorLocation: editF.vendorLocation||null,
        ownerId: editF.ownerId||null,
        type: editF.type, status: editF.status,
        poNumber: editF.poNumber||null, contractRef: editF.contractRef||null,
        value: editF.value !== "" ? Number(editF.value)||0 : null,
        currency: editF.currency||"USD",
        startDate: editF.startDate||null, endDate: editF.endDate||null,
        deliverables: editF.deliverables||null, notes: editF.notes||null,
      })
      if (okd) setEditItem(null)
    } finally { setSavingEdit(false) }
  }

  const [form, setForm] = useState({
    vendorName:"", vendorContact:"", vendorEmail:"", vendorPhone:"", vendorLocation:"",
    type:"CONTRACT", title:"", poNumber:"", contractRef:"",
    value:"", currency:"USD", startDate:"", endDate:"",
    status:"ACTIVE", deliverables:"", notes:"", ownerId:"",
  })

  function resetForm() {
    setForm({ vendorName:"", vendorContact:"", vendorEmail:"", vendorPhone:"", vendorLocation:"",
      type:"CONTRACT", title:"", poNumber:"", contractRef:"",
      value:"", currency:"USD", startDate:"", endDate:"",
      status:"ACTIVE", deliverables:"", notes:"", ownerId:"" })
  }

  async function save() {
    if (!form.vendorName.trim() || !form.title.trim()) {
      setError("Vendor name and title are required"); return
    }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement`, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
        body: JSON.stringify({
          ...form,
          value: form.value ? Number(form.value) : null,
          startDate: form.startDate || null,
          endDate:   form.endDate   || null,
          ownerId:   form.ownerId   || null,
          vendorEmail: form.vendorEmail || null,
          vendorPhone: form.vendorPhone || null,
          vendorLocation: form.vendorLocation || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>({}))
        setError(d.error || "Failed to save"); return
      }
      setShowForm(false); resetForm(); router.refresh()
    } finally { setSaving(false) }
  }

  async function del(itemId:string) {
    if (!confirm("Delete this procurement item?")) return
    setDeleting(itemId)
    try {
      await fetch(`/api/projects/${projectId}/procurement/${itemId}`, {
        method:"DELETE", headers:{"x-workspace-id":workspaceId},
      })
      router.refresh()
    } finally { setDeleting(null) }
  }

  // Summary stats
  const totalValue     = items.reduce((s,i)=>s+(i.value||0),0)
  const activeCount    = items.filter(i=>i.status==="ACTIVE").length
  const expiringCount  = items.filter(i=>{
    if (!i.endDate) return false
    const days = Math.ceil((new Date(i.endDate).getTime()-Date.now())/86400000)
    return days>0 && days<=30
  }).length

  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:13, fontFamily:"var(--font)",
    color:"var(--text)", outline:"none",
  }
  const lblE: React.CSSProperties = { fontSize:9, fontWeight:700, color:"var(--text-4)",
    textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }
  const lbl: React.CSSProperties = {
    display:"block", fontSize:10, fontWeight:700, color:"var(--text-3)",
    textTransform:"uppercase", letterSpacing:".05em", marginBottom:5,
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"10px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <div style={{ display:"flex", gap:16, fontSize:12 }}>
          <span style={{ color:"var(--text-2)" }}>
            <strong style={{ color:"var(--text)" }}>{items.length}</strong> items
          </span>
          <span style={{ color:"#059669" }}>
            <strong>{activeCount}</strong> active
          </span>
          {expiringCount > 0 && (
            <span style={{ color:"#D97706", fontWeight:600 }}>
              ⚠ {expiringCount} expiring in 30 days
            </span>
          )}
          {totalValue > 0 && (
            <span style={{ color:"var(--text-3)" }}>
              Total value: <strong>{fmtCurrency(totalValue)}</strong>
            </span>
          )}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={()=>{ setShowForm(s=>!s); setError("") }}
            style={{ padding:"7px 14px", background:showForm?"#fff":"var(--steel)", color:showForm?"var(--text-2)":"#fff",
              border:showForm?"1px solid var(--border)":"none", borderRadius:"var(--radius)",
              fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font)" }}>
            {showForm ? "Cancel" : "+ Add vendor/contract"}
          </button>
          <AIScanPanel projectId={projectId} workspaceId={workspaceId} domain={"procurement" as any}
            commitLabel="to procurement"
            renderCandidate={(c: any) => (
              <div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.title}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4,
                    background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text-3)" }}>
                    {c.type || "OTHER"}
                  </span>
                  {Number(c.value) > 0 && (
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--steel)" }}>
                      {Number(c.value).toLocaleString("en-US", { style:"currency", currency: (c.currency && String(c.currency).length===3 ? c.currency : "USD"), maximumFractionDigits:0 })}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:"var(--text-2)" }}>
                  {c.vendorName}{c.poNumber ? ` · ${c.poNumber}` : ""}{c.startDate ? ` · ${c.startDate}${c.endDate ? " → " + c.endDate : ""}` : ""}
                </div>
              </div>
            )}
            commit={async (chosen: any[]) => {
              const TYPES = ["CONTRACT","PURCHASE_ORDER","SOW","MSA","NDA","OTHER"]
              const iso = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v||"")) ? String(v) : null
              const rs = await Promise.all(chosen.map(c => fetch(`/api/projects/${projectId}/procurement`, {
                method:"POST", headers:{"Content-Type":"application/json","x-workspace-id":workspaceId},
                body: JSON.stringify({
                  title: String(c.title||"").slice(0,300),
                  vendorName: String(c.vendorName||"Unknown vendor").slice(0,200),
                  vendorContact: c.vendorContact ? String(c.vendorContact).slice(0,200) : null,
                  vendorPhone: c.vendorPhone ? String(c.vendorPhone).slice(0,50) : null,
                  vendorLocation: c.vendorLocation ? String(c.vendorLocation).slice(0,300) : null,
                  type: TYPES.includes(c.type) ? c.type : "OTHER",
                  poNumber: c.poNumber ? String(c.poNumber).slice(0,100) : null,
                  contractRef: c.contractRef ? String(c.contractRef).slice(0,100) : null,
                  value: Number(c.value) > 0 ? Number(c.value) : null,
                  currency: c.currency && String(c.currency).length === 3 ? String(c.currency).toUpperCase() : "USD",
                  startDate: iso(c.startDate),
                  endDate: iso(c.endDate),
                  status: "DRAFT",
                  deliverables: c.deliverables ? String(c.deliverables).slice(0,3000) : null,
                  notes: c.evidence ? `Source: ${c.sourceDoc} — "${String(c.evidence).slice(0,200)}"` : null,
                }),
              })))
              return rs.filter(r => !r.ok).length
            }} />
        </div>
      </div>

      {/* PM Standard strip */}
      <div style={{ background:"#EFF6FF", borderBottom:"1px solid #BFDBFE",
        padding:"7px 16px", fontSize:11, color:"#1E40AF", flexShrink:0 }}>
        PM Standard — Procurement — External Resources & Procurement Management ·
        Track contracts, purchase orders, SOWs, and vendor relationships
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:14 }}>

        {/* Add form */}
        {showForm && (
          <div style={{ background:"#fff", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:16 }}>
              New Procurement Item
            </div>
            {error && (
              <div style={{ color:"var(--red)", fontSize:12, marginBottom:12 }}>✗ {error}</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label style={lbl}>Vendor / Supplier name *</label>
                <input style={inp} value={form.vendorName}
                  onChange={e=>setForm(f=>({...f,vendorName:e.target.value}))}
                  placeholder="e.g. Acme Software Solutions" />
              </div>
              <div>
                <label style={lbl}>Type *</label>
                <select style={{...inp,cursor:"pointer"}} value={form.type}
                  onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {Object.entries(TYPE_CFG).map(([v,c])=>(
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Title / Description *</label>
                <input style={inp} value={form.title}
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder="e.g. Software Development Services — Phase 1" />
              </div>
              <div>
                <label style={lbl}>Vendor contact</label>
                <input style={inp} value={form.vendorContact}
                  onChange={e=>setForm(f=>({...f,vendorContact:e.target.value}))}
                  placeholder="Contact person name" />
              </div>
              <div>
                <label style={lbl}>Vendor email</label>
                <input type="email" style={inp} value={form.vendorEmail}
                  onChange={e=>setForm(f=>({...f,vendorEmail:e.target.value}))}
                  placeholder="contact@vendor.com" />
              </div>
              <div>
                <label style={lbl}>Vendor phone</label>
                <input style={inp} value={form.vendorPhone}
                  onChange={e=>setForm(f=>({...f,vendorPhone:e.target.value}))}
                  placeholder="+1 …" />
              </div>
              <div>
                <label style={lbl}>Vendor location</label>
                <input style={inp} value={form.vendorLocation}
                  onChange={e=>setForm(f=>({...f,vendorLocation:e.target.value}))}
                  placeholder="City / address — logistics" />
              </div>
              <div>
                <label style={lbl}>PO / Contract number</label>
                <input style={inp} value={form.poNumber}
                  onChange={e=>setForm(f=>({...f,poNumber:e.target.value}))}
                  placeholder="PO-2026-001" />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={{...inp,cursor:"pointer"}} value={form.status}
                  onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {Object.entries(STATUS_CFG).map(([v,c])=>(
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Contract value</label>
                <div style={{ display:"flex", gap:6 }}>
                  <select style={{...inp,width:70,cursor:"pointer"}} value={form.currency}
                    onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                    {["USD","EUR","GBP","MXN","CAD"].map(c=><option key={c}>{c}</option>)}
                  </select>
                  <input type="number" min={0} style={{...inp,flex:1}} value={form.value}
                    onChange={e=>setForm(f=>({...f,value:e.target.value}))}
                    placeholder="0.00" />
                </div>
              </div>
              <div>
                <label style={lbl}>Start date</label>
                <input type="date" style={inp} value={form.startDate}
                  onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>End / Expiry date</label>
                <input type="date" style={inp} value={form.endDate}
                  onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Internal owner</label>
                <select style={{...inp,cursor:"pointer"}} value={form.ownerId}
                  onChange={e=>setForm(f=>({...f,ownerId:e.target.value}))}>
                  <option value="">Select owner…</option>
                  {members.map(m=>(
                    <option key={m.userId||m.user?.id} value={m.userId||m.user?.id}>
                      {m.user?.name||"Unknown"}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Key deliverables</label>
                <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                  value={form.deliverables}
                  onChange={e=>setForm(f=>({...f,deliverables:e.target.value}))}
                  placeholder="List of key deliverables expected from this vendor…" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Notes</label>
                <textarea rows={2} style={{...inp,resize:"vertical",lineHeight:1.6}}
                  value={form.notes}
                  onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Additional notes, terms, or context…" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Quote / Proposal document URL</label>
                <input style={inp} value={(form as any).attachmentUrl||""}
                  onChange={e=>setForm(f=>({...f,attachmentUrl:e.target.value} as any))}
                  placeholder="Paste a link to the vendor quote, proposal, or contract (Google Drive, SharePoint, etc.)" />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={save} disabled={saving||!form.vendorName.trim()||!form.title.trim()}
                style={{ padding:"9px 20px", background:"var(--steel)", color:"#fff",
                  border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                  cursor:"pointer", fontFamily:"var(--font)",
                  opacity:(!form.vendorName.trim()||!form.title.trim())?0.5:1 }}>
                {saving?"Saving…":"Save"}
              </button>
              <button onClick={()=>{ setShowForm(false); resetForm(); setError("") }}
                style={{ padding:"9px 18px", background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", fontSize:13, cursor:"pointer",
                  fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Summary strip ── */}
        {items.length > 0 && (() => {
          const totalVal = items.reduce((a,i)=>a+(Number(i.value)||0), 0)
          const nActive = items.filter(i=>i.status==="ACTIVE").length
          const nDraft  = items.filter(i=>i.status==="DRAFT").length
          const nExp    = items.filter(i=>i.endDate && i.status==="ACTIVE" &&
            (new Date(i.endDate).getTime()-Date.now())/86400000 <= 30 &&
            (new Date(i.endDate).getTime()-Date.now()) > 0).length
          return (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",
              gap:10, marginBottom:16 }}>
              {[
                { l:"Total contracted", v: fmtCurrency(totalVal), c:"var(--steel)" },
                { l:"Active",  v:String(nActive), c:"#059669" },
                { l:"Draft — needs review", v:String(nDraft), c: nDraft>0?"#D97706":"var(--text-3)" },
                { l:"Expiring ≤30d", v:String(nExp), c: nExp>0?"var(--red)":"var(--text-3)" },
              ].map((k,i)=>(
                <div key={i} style={{ background:"#fff", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", padding:"10px 14px" }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)",
                    textTransform:"uppercase", letterSpacing:".06em", marginBottom:2 }}>{k.l}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ── Vendor directory (index cards) ── */}
        {items.length > 0 && (() => {
          const vendors = Object.values(items.reduce((acc: any, i: any) => {
            const k = i.vendorName || "Unknown vendor"
            acc[k] = acc[k] || { name:k, contact:i.vendorContact, email:i.vendorEmail, phone:i.vendorPhone, location:i.vendorLocation, count:0, total:0 }
            acc[k].count++; acc[k].total += Number(i.value)||0
            if (!acc[k].contact && i.vendorContact) acc[k].contact = i.vendorContact
            if (!acc[k].email && i.vendorEmail) acc[k].email = i.vendorEmail
            if (!acc[k].phone && i.vendorPhone) acc[k].phone = i.vendorPhone
            if (!acc[k].location && i.vendorLocation) acc[k].location = i.vendorLocation
            return acc
          }, {})) as any[]
          return (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
                Vendors ({vendors.length})
                {selectedVendor && (
                  <button onClick={()=>setSelectedVendor(null)}
                    style={{ marginLeft:10, padding:"2px 8px", fontSize:10, background:"#fff",
                      border:"1px solid var(--border)", borderRadius:10, cursor:"pointer",
                      fontFamily:"var(--font)", color:"var(--text-2)" }}>✕ Show all</button>
                )}
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {vendors.map((v:any) => (
                  <div key={v.name} onClick={()=>setSelectedVendor(sv=>sv===v.name?null:v.name)}
                    style={{ width:220, background: selectedVendor===v.name?"#EFF6FF":"#fff",
                      border:`1px solid ${selectedVendor===v.name?"var(--steel)":"var(--border)"}`,
                      borderTop:`3px solid ${selectedVendor===v.name?"var(--steel)":"#CBD5E1"}`,
                      borderRadius:"var(--radius)", padding:"10px 14px", cursor:"pointer" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</div>
                    {(v.contact || v.email) && (
                      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {v.contact}{v.contact && v.email ? " · " : ""}{v.email}
                      </div>
                    )}
                    {(v.phone || v.location) && (
                      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {v.phone}{v.phone && v.location ? " · " : ""}{v.location}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:"var(--text-2)", marginTop:6, fontWeight:600 }}>
                      {v.count} agreement{v.count!==1?"s":""}{v.total>0 ? ` · ${fmtCurrency(v.total)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Items list */}
        {items.length === 0 && !showForm ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:16, fontWeight:600, color:"var(--text)", marginBottom:8 }}>
              No procurement items yet
            </div>
            <div style={{ fontSize:13, color:"var(--text-3)", maxWidth:420, margin:"0 auto 20px", lineHeight:1.7 }}>
              Track contracts, purchase orders, SOWs, and vendor relationships for this project.
              PM Standard — Procurement — External Resources.
            </div>
            {can("projects:edit") && (<button onClick={()=>setShowForm(true)}
              style={{ padding:"10px 20px", background:"var(--steel)", color:"#fff",
                border:"none", borderRadius:"var(--radius)", fontSize:13, fontWeight:500,
                cursor:"pointer", fontFamily:"var(--font)" }}>
              + Add first vendor/contract
            </button>)}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {(() => {
              const visible = selectedVendor ? items.filter((i:any)=>i.vendorName===selectedVendor) : items
              const gm: Record<string, any[]> = {}
              for (const it of visible) { const k = it.vendorName || "Unknown vendor"; (gm[k] = gm[k] || []).push(it) }
              const groups = Object.entries(gm).sort((a,b) =>
                b[1].reduce((sm:number,i:any)=>sm+(Number(i.value)||0),0) -
                a[1].reduce((sm:number,i:any)=>sm+(Number(i.value)||0),0))
              return groups.map(([vname, gitems]) => (
                <div key={vname}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                    background:"var(--surface)", borderTop:"1px solid var(--border)",
                    borderBottom:"1px solid var(--border)", marginTop:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--text)" }}>🏢 {vname}</span>
                    <span style={{ fontSize:11, color:"var(--text-3)" }}>
                      {gitems.length} agreement{gitems.length !== 1 ? "s" : ""} · {fmtCurrency(gitems.reduce((sm:number,i:any)=>sm+(Number(i.value)||0),0))}
                    </span>
                  </div>
                  {gitems.map(item => {
              const tc = TYPE_CFG[item.type]   || TYPE_CFG.OTHER
              const sc = STATUS_CFG[item.status] || STATUS_CFG.ACTIVE
              const isExpanded = expanded === item.id
              const daysLeft = item.endDate
                ? Math.ceil((new Date(item.endDate).getTime()-Date.now())/86400000)
                : null
              const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
              const isExpired  = daysLeft !== null && daysLeft <= 0

              return (
                <div key={item.id}
                  style={{ background:"#fff", border:`1px solid ${isExpiring?"#FDE68A":"var(--border)"}`,
                    borderRadius:"var(--radius)", overflow:"hidden",
                    borderLeft:`3px solid ${tc.color}` }}>
                  {/* Header row */}
                  <div style={{ padding:"12px 16px", display:"flex",
                    alignItems:"center", gap:12, cursor:"pointer" }}
                    onClick={()=>setExpanded(isExpanded?null:item.id)}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                      borderRadius:8, color:tc.color, background:tc.bg, flexShrink:0 }}>
                      {tc.label}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>
                        {item.vendorName}
                        {item.poNumber && ` · ${item.poNumber}`}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                      {item.value && (
                        <span style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>
                          {fmtCurrency(item.value, item.currency)}
                        </span>
                      )}
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
                        borderRadius:8, color:sc.color, background:sc.bg }}>
                        {sc.label}
                      </span>
                      {isExpiring && (
                        <span style={{ fontSize:10, fontWeight:700, color:"#D97706" }}>
                          ⚠ {daysLeft}d left
                        </span>
                      )}
                      {isExpired && item.status==="ACTIVE" && (
                        <span style={{ fontSize:10, fontWeight:700, color:"#DC2626" }}>
                          EXPIRED
                        </span>
                      )}
                      <span style={{ fontSize:11, color:"var(--text-4)",
                        transform:isExpanded?"rotate(0deg)":"rotate(-90deg)",
                        display:"inline-block", transition:"transform .15s" }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"14px 16px",
                      background:"var(--surface)" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12,
                        marginBottom:12 }}>
                        {[
                          { l:"Start date",    v:fmtDate(item.startDate) },
                          { l:"End date",      v:fmtDate(item.endDate)   },
                          { l:"Internal owner",v:item.owner?.name||"—"   },
                          { l:"Vendor phone",  v:item.vendorPhone||"—" },
                          { l:"Vendor location", v:item.vendorLocation||"—" },
                          { l:"Vendor contact",v:item.vendorContact||"—" },
                          { l:"Vendor email",  v:item.vendorEmail||"—"   },
                          { l:"Contract ref",  v:item.contractRef||"—"   },
                        ].map((f,i)=>(
                          <div key={i}>
                            <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)",
                              textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>
                              {f.l}
                            </div>
                            <div style={{ fontSize:12, color:"var(--text)" }}>{f.v}</div>
                          </div>
                        ))}
                      </div>
                      {item.deliverables && (
                        <div style={{ marginBottom:10 }}>
                          <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)",
                            textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
                            Key Deliverables
                          </div>
                          <p style={{ fontSize:12, color:"var(--text-2)", margin:0, lineHeight:1.6,
                            whiteSpace:"pre-line" }}>{item.deliverables}</p>
                        </div>
                      )}
                      {item.notes && (
                        <div style={{ marginBottom:10 }}>
                          <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)",
                            textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
                            Notes
                          </div>
                          <p style={{ fontSize:12, color:"var(--text-2)", margin:0, lineHeight:1.6 }}>
                            {item.notes}
                          </p>
                        </div>
                      )}
                      {item.attachmentUrl && (
                        <div style={{ marginBottom:10 }}>
                          <div style={{ fontSize:9, fontWeight:700, color:"var(--text-4)",
                            textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
                            Quote / Proposal
                          </div>
                          <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize:12, color:"var(--steel)", textDecoration:"none",
                              display:"flex", alignItems:"center", gap:4 }}>
                            📄 View document →
                          </a>
                        </div>
                      )}
                      {editItem?.id === item.id && (
                        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
                          borderRadius:8, padding:12, marginBottom:12, display:"flex",
                          flexDirection:"column", gap:8 }}>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                            <div><div style={lblE}>Title *</div>
                            <input style={inp} placeholder="Title *" value={editF.title}
                              onChange={e=>setEditF((f:any)=>({...f,title:e.target.value}))} /></div>
                            <div><div style={lblE}>Vendor *</div>
                            <input style={inp} placeholder="Vendor *" value={editF.vendorName}
                              onChange={e=>setEditF((f:any)=>({...f,vendorName:e.target.value}))} /></div>
                            <div><div style={lblE}>Contact person</div>
                            <input style={inp} placeholder="Contact person" value={editF.vendorContact}
                              onChange={e=>setEditF((f:any)=>({...f,vendorContact:e.target.value}))} /></div>
                            <div><div style={lblE}>Vendor email</div>
                            <input style={inp} placeholder="Vendor email" value={editF.vendorEmail}
                              onChange={e=>setEditF((f:any)=>({...f,vendorEmail:e.target.value}))} /></div>
                            <div><div style={lblE}>Vendor phone</div>
                            <input style={inp} placeholder="Vendor phone" value={editF.vendorPhone}
                              onChange={e=>setEditF((f:any)=>({...f,vendorPhone:e.target.value}))} /></div>
                            <div><div style={lblE}>Vendor location</div>
                            <input style={inp} placeholder="Vendor location (logistics)" value={editF.vendorLocation}
                              onChange={e=>setEditF((f:any)=>({...f,vendorLocation:e.target.value}))} /></div>
                            <div><div style={lblE}>Internal owner</div>
                            <select style={{...inp,cursor:"pointer"}} value={editF.ownerId}
                              onChange={e=>setEditF((f:any)=>({...f,ownerId:e.target.value}))}>
                              <option value="">Internal owner — unassigned</option>
                              {members.map((m:any)=><option key={m.userId||m.id} value={m.userId||m.id}>{m.user?.name}</option>)}
                            </select></div>
                            <div><div style={lblE}>Type</div>
                            <select style={{...inp,cursor:"pointer"}} value={editF.type}
                              onChange={e=>setEditF((f:any)=>({...f,type:e.target.value}))}>
                              {Object.entries(TYPE_CFG).map(([v,c]:any)=><option key={v} value={v}>{c.label}</option>)}
                            </select></div>
                            <div><div style={lblE}>Status</div>
                            <select style={{...inp,cursor:"pointer"}} value={editF.status}
                              onChange={e=>setEditF((f:any)=>({...f,status:e.target.value}))}>
                              {Object.entries(STATUS_CFG).map(([v,c]:any)=><option key={v} value={v}>{c.label}</option>)}
                            </select></div>
                            <div><div style={lblE}>PO number</div>
                            <input style={inp} placeholder="PO number" value={editF.poNumber}
                              onChange={e=>setEditF((f:any)=>({...f,poNumber:e.target.value}))} /></div>
                            <div><div style={lblE}>Contract ref</div>
                            <input style={inp} placeholder="Contract ref" value={editF.contractRef}
                              onChange={e=>setEditF((f:any)=>({...f,contractRef:e.target.value}))} /></div>
                            <div><div style={lblE}>Value</div>
                            <input style={inp} type="number" placeholder="Value" value={editF.value}
                              onChange={e=>setEditF((f:any)=>({...f,value:e.target.value}))} /></div>
                            <div><div style={lblE}>Currency</div>
                            <input style={inp} placeholder="Currency" value={editF.currency}
                              onChange={e=>setEditF((f:any)=>({...f,currency:e.target.value}))} /></div>
                            <div><div style={lblE}>Start date</div>
                            <input style={inp} type="date" value={editF.startDate}
                              onChange={e=>setEditF((f:any)=>({...f,startDate:e.target.value}))} /></div>
                            <div><div style={lblE}>End date</div>
                            <input style={inp} type="date" value={editF.endDate}
                              onChange={e=>setEditF((f:any)=>({...f,endDate:e.target.value}))} /></div>
                          </div>
                          <div><div style={lblE}>Key deliverables</div>
                          <textarea style={{...inp,resize:"vertical",width:"100%"}} rows={2} placeholder="Key deliverables"
                            value={editF.deliverables}
                            onChange={e=>setEditF((f:any)=>({...f,deliverables:e.target.value}))} /></div>
                          <div style={{ display:"flex", gap:8 }}>
                            <button onClick={saveItemEdit} disabled={savingEdit||!editF.title?.trim()||!editF.vendorName?.trim()}
                              style={{ padding:"7px 16px", background:"var(--steel)", color:"#fff", border:"none",
                                borderRadius:"var(--radius)", fontSize:12, fontWeight:600, fontFamily:"var(--font)",
                                cursor: savingEdit?"wait":"pointer" }}>
                              {savingEdit?"Saving…":"💾 Save changes"}
                            </button>
                            <button onClick={()=>setEditItem(null)}
                              style={{ padding:"7px 12px", background:"#fff", border:"1px solid var(--border)",
                                borderRadius:"var(--radius)", fontSize:12, cursor:"pointer",
                                fontFamily:"var(--font)", color:"var(--text-2)" }}>Cancel</button>
                          </div>
                        </div>
                      )}
                      <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                        {can("projects:edit") && item.status === "DRAFT" && (
                          <button onClick={()=>patchItem(item.id, { status:"ACTIVE" })}
                            title="Promote this draft to an active agreement"
                            style={{ padding:"5px 12px", background:"#ECFDF5",
                              border:"1px solid #A7F3D0", borderRadius:"var(--radius)",
                              fontSize:11, color:"#059669", fontWeight:600, cursor:"pointer",
                              fontFamily:"var(--font)" }}>▶ Activate</button>
                        )}
                        {can("projects:edit") && (
                          <button onClick={()=>openEditItem(item)}
                            style={{ padding:"5px 12px", background:"#fff",
                              border:"1px solid var(--border)", borderRadius:"var(--radius)",
                              fontSize:11, color:"var(--text-2)", cursor:"pointer",
                              fontFamily:"var(--font)" }}>✏️ Edit</button>
                        )}
                        <button onClick={()=>del(item.id)} disabled={deleting===item.id}
                          style={{ padding:"5px 12px", background:"#FEF2F2",
                            border:"1px solid #FECACA", borderRadius:"var(--radius)",
                            fontSize:11, color:"var(--red)", cursor:"pointer",
                            fontFamily:"var(--font)" }}>
                          {deleting===item.id?"…":"Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
                </div>
              ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
