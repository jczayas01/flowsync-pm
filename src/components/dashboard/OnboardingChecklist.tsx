"use client"
// src/components/dashboard/OnboardingChecklist.tsx
// First-run checklist shown in dashboard until all items are complete

import { useState, useEffect } from "react"
import Link from "next/link"

interface ChecklistItem {
  id:       string
  label:    string
  desc:     string
  href:     string
  cta:      string
  icon:     string
  done:     boolean
}

interface Props {
  projectCount:  number
  memberCount:   number
  hasM365:       boolean
  hasAutomation: boolean
  hasTemplate:   boolean
  workspaceName: string
}

export function OnboardingChecklist({
  projectCount, memberCount, hasM365, hasAutomation, hasTemplate, workspaceName
}: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded,  setExpanded]  = useState(true)

  const items: ChecklistItem[] = [
    {
      id:    "workspace",
      label: "Set up your workspace",
      desc:  "Add your organization name, logo, and brand color.",
      href:  "/settings/workspace",
      cta:   "Open settings",
      icon:  "🏢",
      done:  true, // Always done — they created the workspace
    },
    {
      id:    "project",
      label: "Create your first project",
      desc:  "Start a new project or install one of our 47 industry templates.",
      href:  "/projects",
      cta:   "Create project",
      icon:  "📁",
      done:  projectCount > 0,
    },
    {
      id:    "team",
      label: "Invite your team",
      desc:  "Add colleagues so they can collaborate on projects.",
      href:  "/settings/team",
      cta:   "Invite members",
      icon:  "👥",
      done:  memberCount > 1,
    },
    {
      id:    "template",
      label: "Explore the template marketplace",
      desc:  "Ready-made templates for IT, construction, finance, and more.",
      href:  "/templates",
      cta:   "Browse templates",
      icon:  "📦",
      done:  hasTemplate,
    },
    {
      id:    "m365",
      label: "Connect Microsoft 365",
      desc:  "Auto-tag project emails, sync Planner tasks, and log Teams meetings.",
      href:  "/settings/workspace#integrations",
      cta:   "Connect M365",
      icon:  "🔵",
      done:  hasM365,
    },
  ]

  const doneCount = items.filter(i => i.done).length
  const pct       = Math.round((doneCount / items.length) * 100)
  const allDone   = doneCount === items.length

  // Persist dismissal in localStorage
  useEffect(() => {
    const key = `onboarding-dismissed-${workspaceName}`
    if (localStorage.getItem(key) === "1") setDismissed(true)
  }, [workspaceName])

  function dismiss() {
    const key = `onboarding-dismissed-${workspaceName}`
    localStorage.setItem(key, "1")
    setDismissed(true)
  }

  if (dismissed || allDone) return null

  return (
    <div style={{
      background: "#fff", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", marginBottom: 16, overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: "14px 18px", display: "flex", alignItems: "center",
          gap: 12, cursor: "pointer", borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Get started with FlowSync PM
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              background: "var(--steel-pale,#EFF6FF)", color: "var(--steel)" }}>
              {doneCount}/{items.length} complete
            </span>
          </div>
          <div style={{ height: 5, background: "var(--surface-1,#F1F5F9)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--steel)",
              borderRadius: 3, transition: "width .5s ease" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{pct}%</span>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            style={{ fontSize: 18, color: "var(--text-3)", background: "none", border: "none",
              cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}
            title="Dismiss checklist"
          >
            ×
          </button>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{
                padding: "14px 18px",
                borderBottom: i < items.length - 1 ? "1px solid var(--surface-1,#F1F5F9)" : "none",
                borderRight: i % 2 === 0 ? "1px solid var(--surface-1,#F1F5F9)" : "none",
                display: "flex", gap: 12, alignItems: "flex-start",
                opacity: item.done ? 0.55 : 1,
                background: item.done ? "var(--surface)" : "#fff",
                transition: "background .1s",
              }}
            >
              {/* Icon / checkmark */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: item.done ? 16 : 18,
                background: item.done ? "var(--green-pale,#ECFDF5)" : "var(--surface-1,#F1F5F9)",
                color: item.done ? "var(--green)" : "inherit",
              }}>
                {item.done ? "✓" : item.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)",
                  marginBottom: 2, textDecoration: item.done ? "line-through" : "none" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, marginBottom: 8 }}>
                  {item.desc}
                </div>
                {!item.done && (
                  <Link href={item.href}
                    style={{ fontSize: 12, fontWeight: 500, color: "var(--steel)",
                      textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {item.cta} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
