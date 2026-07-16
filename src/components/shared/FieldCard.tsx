// src/components/shared/FieldCard.tsx
// Read view for free-text document fields, styled to match the WBS Dictionary
// entry card — accent rail, monospace label chip, formatted content. Used by
// Governance and the Quality tab so every document section reads the same way.
"use client"

export function FieldCard({ label, value, icon }: { label: string; value: string; icon?: string }) {
  const empty = !value?.trim()
  return (
    <div style={{ background:"var(--surface)", borderRadius:"var(--radius)",
      padding:"12px 16px", border:"1px solid var(--border)",
      borderLeft:`3px solid ${empty ? "var(--border)" : "var(--steel)"}` }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <span style={{ fontSize:10, fontFamily:"monospace", fontWeight:700,
          color: empty ? "var(--text-4)" : "var(--steel)", flexShrink:0, padding:"2px 6px",
          background: empty ? "var(--surface-2,#F1F5F9)" : "#EFF6FF", borderRadius:4,
          whiteSpace:"nowrap", textTransform:"uppercase", letterSpacing:".03em" }}>
          {icon ? `${icon} ` : ""}{label}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          {empty ? (
            <div style={{ fontSize:12, color:"var(--text-4)", fontStyle:"italic" }}>Not documented yet</div>
          ) : (
            <p style={{ fontSize:12.5, color:"var(--text-2)", margin:0, lineHeight:1.6,
              whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{value}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Right-aligned Edit / Cancel toggle — same placement as WBS's "+ Add WBS entry". */
export function EditToggle({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
      <button onClick={onClick}
        style={{ padding:"8px 16px", background: editing ? "#fff" : "var(--steel)",
          color: editing ? "var(--text-2)" : "#fff",
          border: editing ? "1px solid var(--border)" : "none",
          borderRadius:"var(--radius)", fontSize:12, cursor:"pointer", fontFamily:"var(--font)" }}>
        {editing ? "Cancel" : "✏️ Edit"}
      </button>
    </div>
  )
}
