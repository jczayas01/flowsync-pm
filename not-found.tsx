"use client"
// src/components/settings/BillingLegalNotice.tsx
// Legal notice shown on billing/upgrade pages
import Link from "next/link"

export function BillingLegalNotice() {
  return (
    <div style={{
      background: "var(--surface,#F8FAFC)",
      border:     "1px solid var(--border,#E2E8F0)",
      borderRadius: "var(--radius,8px)",
      padding:    "14px 16px",
      marginTop:  16,
    }}>
      <div style={{ fontSize:12, color:"var(--text-3,#64748B)", lineHeight:1.75 }}>
        <strong style={{ color:"var(--text-2,#475569)" }}>Before subscribing, please review:</strong>
        {" "}
        <Link href="/terms" target="_blank"
          style={{ color:"var(--steel,#1B6CA8)", textDecoration:"none", fontWeight:500 }}>
          Terms of Service
        </Link>
        {" · "}
        <Link href="/privacy" target="_blank"
          style={{ color:"var(--steel,#1B6CA8)", textDecoration:"none", fontWeight:500 }}>
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/refund" target="_blank"
          style={{ color:"var(--steel,#1B6CA8)", textDecoration:"none", fontWeight:500 }}>
          Refund Policy
        </Link>
        <br/>
        By subscribing, you agree to our Terms of Service and authorize us to charge your payment
        method on a recurring basis. You can cancel anytime.{" "}
        <strong>30-day money-back guarantee</strong> for new subscribers.
        {" "}Puerto Rico customers: applicable IVU tax will be applied.
      </div>
    </div>
  )
}
