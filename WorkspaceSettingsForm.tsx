"use client"
// src/components/legal/BAARequestFlow.tsx
// BAA request flow for healthcare customers (HIPAA)
import { useState } from "react"

type BAAStatus = "none" | "pending" | "sent" | "signed"

interface BAAState {
  status:       BAAStatus
  requestedAt?: string
  sentAt?:      string
  signedAt?:    string
  coveredEntity?: string
}

export function BAARequestFlow({ workspaceId, plan, initialState }: {
  workspaceId: string
  plan:        string
  initialState?: BAAState
}) {
  const [state, setState] = useState<BAAState>(initialState || { status: "none" })
  const [form, setForm]   = useState({
    organizationName:  "",
    organizationType:  "",
    contactName:       "",
    contactEmail:      "",
    hipaaRole:         "",
    phiTypes:          [] as string[],
  })
  const [submitting, setSubmitting] = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [error,      setError]      = useState("")

  const isPaidPlan = ["BUSINESS","ENTERPRISE","CONSULTANT"].includes(plan)

  const PHI_TYPES = [
    "Patient demographic information",
    "Clinical notes and diagnoses",
    "Lab results and test data",
    "Medication and prescription data",
    "Insurance and billing information",
    "Medical images and radiology",
    "Mental health records",
    "Other PHI",
  ]

  const ORG_TYPES = [
    "Hospital or health system",
    "Physician practice or clinic",
    "Health insurance plan",
    "Healthcare clearinghouse",
    "Business associate of a covered entity",
    "Healthcare technology vendor",
    "Research institution",
    "Other healthcare organization",
  ]

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organizationName || !form.contactEmail || !form.hipaaRole) {
      setError("Please fill in all required fields.")
      return
    }
    setSubmitting(true); setError("")
    try {
      await fetch("/api/legal/baa-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, workspaceId }),
      })
      setState({ status: "pending", requestedAt: new Date().toISOString(),
        coveredEntity: form.organizationName })
      setShowForm(false)
    } catch {
      setError("Submission failed. Please email legal@flowsyncpm.com directly.")
    } finally { setSubmitting(false) }
  }

  function togglePHI(type: string) {
    setForm(f => ({
      ...f,
      phiTypes: f.phiTypes.includes(type)
        ? f.phiTypes.filter(t => t !== type)
        : [...f.phiTypes, type],
    }))
  }

  const STATUS_CONFIG = {
    none:    { icon: "📋", color: "var(--text-3)", bg: "var(--surface)",     label: "Not requested"  },
    pending: { icon: "⏳", color: "#92400E",       bg: "#FFFBEB",            label: "Under review"   },
    sent:    { icon: "📧", color: "var(--steel)",  bg: "var(--steel-pale,#EFF6FF)", label: "Sent for signature" },
    signed:  { icon: "✅", color: "var(--green)",  bg: "#ECFDF5",            label: "BAA executed"   },
  }
  const sc = STATUS_CONFIG[state.status]

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 11px", border: "1px solid var(--border)",
    borderRadius: "var(--radius,8px)", fontSize: 13, fontFamily: "var(--font)",
    color: "var(--text)", outline: "none", background: "#fff",
  }
  const sel: React.CSSProperties = {
    ...inp, appearance: "none" as const, cursor: "pointer",
    background: "#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394A3B8'/%3E%3C/svg%3E") right 10px center no-repeat",
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Business Associate Agreement (BAA)
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.65 }}>
          Required under HIPAA for any organization that stores or processes Protected Health
          Information (PHI) using FlowSync PM. Without an executed BAA, PHI must not be entered
          into the platform.
        </p>
      </div>

      {/* Status card */}
      <div style={{ background: sc.bg, border: `1px solid ${sc.color}30`,
        borderRadius: "var(--radius,8px)", padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{sc.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: sc.color, marginBottom: 2 }}>
            BAA Status: {sc.label}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            {state.status === "none"    && "No BAA has been requested for this workspace."}
            {state.status === "pending" && `Requested ${state.requestedAt ? new Date(state.requestedAt).toLocaleDateString("en-US",{dateStyle:"medium"}) : ""} · Our legal team will contact you within 2 business days.`}
            {state.status === "sent"    && `BAA sent to ${state.coveredEntity || "your organization"} for signature via DocuSign.`}
            {state.status === "signed"  && `BAA executed on ${state.signedAt ? new Date(state.signedAt).toLocaleDateString("en-US",{dateStyle:"long"}) : ""}. PHI may be processed on this workspace.`}
          </div>
        </div>
        {state.status === "signed" && (
          <a href="/api/legal/baa-download" target="_blank"
            style={{ padding: "6px 12px", background: "var(--green)", color: "#fff",
              borderRadius: "var(--radius,8px)", fontSize: 11, fontWeight: 600,
              textDecoration: "none", flexShrink: 0 }}>
            ⬇ Download BAA
          </a>
        )}
      </div>

      {/* Plan gate */}
      {!isPaidPlan && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: "var(--radius,8px)", padding: "12px 16px",
          fontSize: 13, color: "#92400E", marginBottom: 16 }}>
          ⭐ BAA execution requires the <strong>Business or Enterprise plan</strong>.{" "}
          <a href="/settings/billing" style={{ color: "var(--steel)", fontWeight: 500 }}>
            Upgrade your plan →
          </a>
        </div>
      )}

      {/* HIPAA info box */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius,8px)", padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)",
          marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span>ℹ️</span> What is a BAA?
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.7, margin: 0 }}>
          A Business Associate Agreement (BAA) is a legal contract required by HIPAA (45 CFR
          §164.504(e)) between a Covered Entity (your healthcare organization) and a Business
          Associate (FlowSync PM) who will access, transmit, or store Protected Health Information
          (PHI) on the Covered Entity&apos;s behalf. Storing PHI in FlowSync PM without an executed
          BAA is a HIPAA violation.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <a href="/legal/baa-template" target="_blank"
            style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none", fontWeight: 500 }}>
            📄 View BAA template
          </a>
          <span style={{ color: "var(--border)" }}>·</span>
          <a href="https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>
            HHS HIPAA guidance ↗
          </a>
        </div>
      </div>

      {/* Request form */}
      {state.status === "none" && !showForm && isPaidPlan && (
        <button onClick={() => setShowForm(true)}
          style={{ padding: "10px 22px", background: "var(--steel)", color: "#fff",
            border: "none", borderRadius: "var(--radius,8px)", fontSize: 13,
            fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)" }}>
          Request BAA
        </button>
      )}

      {showForm && (
        <form onSubmit={submitRequest}
          style={{ background: "#fff", border: "2px solid var(--steel)",
            borderRadius: "var(--radius,8px)", padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>
            BAA Request Form
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA",
              color: "var(--red)", padding: "9px 12px", borderRadius: "var(--radius,8px)",
              fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500,
                color: "var(--text-2)", marginBottom: 4 }}>
                Organization name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input value={form.organizationName} required
                onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))}
                placeholder="Sistema de Salud Menonita" style={inp} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500,
                color: "var(--text-2)", marginBottom: 4 }}>
                Organization type <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <select value={form.organizationType} required
                onChange={e => setForm(f => ({ ...f, organizationType: e.target.value }))}
                style={sel}>
                <option value="">Select…</option>
                {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500,
                color: "var(--text-2)", marginBottom: 4 }}>
                HIPAA Compliance Contact Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input value={form.contactName} required
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="Privacy Officer name" style={inp} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500,
                color: "var(--text-2)", marginBottom: 4 }}>
                Contact Email <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input type="email" value={form.contactEmail} required
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                placeholder="privacy@yourhospital.com" style={inp} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500,
              color: "var(--text-2)", marginBottom: 4 }}>
              Your HIPAA role <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <select value={form.hipaaRole} required
              onChange={e => setForm(f => ({ ...f, hipaaRole: e.target.value }))} style={sel}>
              <option value="">Select your organization&apos;s HIPAA role…</option>
              <option value="covered_entity">Covered Entity (health plan, provider, or clearinghouse)</option>
              <option value="business_associate">Business Associate of a Covered Entity</option>
              <option value="subcontractor">Subcontractor of a Business Associate</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500,
              color: "var(--text-2)", marginBottom: 8 }}>
              Types of PHI to be processed (select all that apply)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {PHI_TYPES.map(type => {
                const checked = form.phiTypes.includes(type)
                return (
                  <div key={type} onClick={() => togglePHI(type)}
                    style={{ padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                      fontSize: 12, fontWeight: checked ? 600 : 400,
                      border: `1.5px solid ${checked ? "var(--steel)" : "var(--border)"}`,
                      background: checked ? "var(--steel-pale,#EFF6FF)" : "#fff",
                      color: checked ? "var(--steel)" : "var(--text-3)",
                      transition: "all .15s", userSelect: "none" }}>
                    {type}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Acknowledgment */}
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius,8px)",
            padding: "12px 14px", marginBottom: 16, fontSize: 12,
            color: "var(--text-3)", lineHeight: 1.65 }}>
            By submitting this request, you confirm that your organization intends to use
            FlowSync PM to process Protected Health Information and requires a Business Associate
            Agreement under HIPAA. Our legal team will review your request and send a BAA for
            electronic signature via DocuSign within 2 business days.
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: "9px 16px", background: "#fff",
                border: "1px solid var(--border)", borderRadius: "var(--radius,8px)",
                fontSize: 13, cursor: "pointer", fontFamily: "var(--font)",
                color: "var(--text-2)" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              style={{ padding: "9px 22px", background: "var(--steel)", color: "#fff",
                border: "none", borderRadius: "var(--radius,8px)", fontSize: 13,
                fontWeight: 500, cursor: submitting ? "wait" : "pointer",
                fontFamily: "var(--font)", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting…" : "Submit BAA request →"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
