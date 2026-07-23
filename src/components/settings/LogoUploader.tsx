"use client"
// src/components/settings/LogoUploader.tsx
// Drag-drop / click-to-browse logo upload. On success the server stores the
// image and returns a stable app URL; the parent form receives it via
// onUploaded so the Logo URL field and preview update immediately.

import { useRef, useState } from "react"

export function LogoUploader({
  disabled,
  onUploaded,
}: {
  disabled?: boolean
  onUploaded: (logoUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy]   = useState(false)
  const [over, setOver]   = useState(false)
  const [error, setError] = useState("")

  async function send(file: File) {
    if (disabled || busy) return
    setBusy(true); setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/workspace/logo", { method: "POST", body: fd })
      const d   = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || `Upload failed (${res.status})`); return }
      onUploaded(d.data.logoUrl)
    } catch {
      setError("Upload failed — network error.")
    } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault(); setOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) send(f)
        }}
        style={{
          border: `1.5px dashed ${over ? "var(--steel,#1B6CA8)" : "var(--border,#E2E8F0)"}`,
          borderRadius: 8,
          padding: "14px 16px",
          background: over ? "#EFF6FF" : "var(--bg-2,#F8FAFC)",
          color: "var(--text-3,#64748B)",
          fontSize: 12.5,
          textAlign: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          transition: "background .15s ease, border-color .15s ease",
          outline: "none",
        }}
      >
        {busy
          ? "Uploading…"
          : <>Drop a logo here or <span style={{ color: "var(--steel,#1B6CA8)", fontWeight: 600 }}>browse</span> — PNG, JPG, SVG or WebP, up to 1 MB</>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: "none" }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) send(f)
          e.target.value = ""
        }}
      />
      {error && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "#B91C1C" }}>{error}</div>
      )}
    </div>
  )
}
