// src/components/shared/GuideButton.tsx
// A small "?" that opens the Help Center on the walkthrough for the current screen.
//
// The point is context: a person stuck on the Gantt shouldn't land on a generic FAQ
// list and go hunting. They press ? where they are and get the Gantt steps.
//
//   <GuideButton topic="gantt" />
//
// `topic` must match a walkthrough id in HelpCenter: import · tasks · gantt · budget
// · risks · governance · templates · reports · m365 · resources · roles
"use client"
import { useState } from "react"
import { HelpCenter } from "@/components/help/HelpCenter"

export function GuideButton({ topic, label }: { topic: string; label?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={label || "Show me how this works"}
        aria-label={label || "Open the guide for this screen"}
        style={{
          display:"inline-flex", alignItems:"center", gap:5,
          padding: label ? "6px 11px" : "0", width: label ? "auto" : 24, height:24,
          justifyContent:"center", borderRadius: label ? "var(--radius)" : "50%",
          border:"1px solid var(--border)", background:"#fff", color:"var(--text-3)",
          fontSize: label ? 12 : 12.5, fontWeight:600, cursor:"pointer",
          fontFamily:"var(--font)", flexShrink:0, lineHeight:1,
        }}>
        <span aria-hidden>?</span>
        {label && <span>{label}</span>}
      </button>
      {open && <HelpCenter topic={topic} onClose={() => setOpen(false)} />}
    </>
  )
}
