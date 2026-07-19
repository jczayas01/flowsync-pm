// src/app/api/projects/[projectId]/ai-analyze/apply/route.ts
// POST — turn accepted analyzer suggestions into real project records.
//
// The analyzer's output was read-only: eight good suggestions, then the person
// retyped each into Tasks/Risks by hand. This is the missing last mile —
// scanned quote → analysis → records in the right tabs, one click.
//
// Type routing:
//   task, action_item → Task        (action items are tasks with owners)
//   risk              → Risk        (priority maps to probability/impact)
//   issue             → Issue
//   decision          → Decision    (decision log)
//   document, anything else → Task with the type noted, so nothing is dropped
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/api"

const itemSchema = z.object({
  type:               z.string().min(1),
  title:              z.string().min(1).max(300),
  description:        z.string().max(4000).optional().nullable(),
  priority:           z.string().optional().nullable(),
  suggested_due_date: z.string().optional().nullable(),
  suggested_assignee: z.string().optional().nullable(),
})
const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(30) })

const PRIORITY = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
const prio = (p?: string | null) => PRIORITY.has((p || "").toUpperCase()) ? (p || "").toUpperCase() : "MEDIUM"

// A HIGH-priority risk from a document scan: probability unknown, impact per priority.
const RISK_IMPACT: Record<string, string> = {
  CRITICAL: "CRITICAL", HIGH: "MAJOR", MEDIUM: "MODERATE", LOW: "MINOR",
}

async function nextCode(model: "task" | "risk" | "issue" | "decision", projectId: string, prefix: string) {
  const last = await (db as any)[model].findFirst({
    where: { projectId }, orderBy: { createdAt: "desc" }, select: { code: true },
  })
  const n = last?.code ? parseInt(String(last.code).replace(/^\D+-?/, ""), 10) + 1 : 1
  return `${prefix}-${String(isNaN(n) ? 1 : n).padStart(3, "0")}`
}

function parseDate(s?: string | null): Date | undefined {
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaceId = req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    (session.user as any).activeWorkspaceId
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 })

  const access = await verifyProjectAccess(params.projectId, session.user.id, workspaceId)
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.locked) {
      return NextResponse.json(
        { error: "Your trial has ended — this workspace is read-only until you subscribe in Settings → Billing.", locked: true },
        { status: 402 })
    }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid items" }, { status: 400 })

  // Best-effort assignee match by name or email; unmatched stays unassigned.
  const members = await db.workspaceMember.findMany({
    where:  { workspaceId },
    select: { userId: true, user: { select: { name: true, email: true } } },
  })
  const matchAssignee = (s?: string | null) => {
    if (!s) return undefined
    const needle = s.toLowerCase()
    const hit = members.find(m =>
      m.user.email?.toLowerCase() === needle ||
      (m.user.name && needle.includes(m.user.name.toLowerCase())) ||
      (m.user.name && m.user.name.toLowerCase().includes(needle)))
    return hit?.userId
  }

  const created: { type: string; code: string; title: string }[] = []
  const failed:  { title: string; reason: string }[] = []

  // Sequential on purpose: per-type code generation reads the latest code, so
  // parallel creates would race into duplicate T-00N codes.
  for (const item of parsed.data.items) {
    const t = item.type.toLowerCase().replace(/\s+/g, "_")
    try {
      if (t === "risk") {
        const code = await nextCode("risk", params.projectId, "R")
        const p = prio(item.priority)
        await db.risk.create({ data: {
          projectId: params.projectId, code, title: item.title,
          description: item.description || null,
          probability: "MEDIUM",
          impact: RISK_IMPACT[p] as any,
          score: p === "CRITICAL" ? 20 : p === "HIGH" ? 15 : p === "MEDIUM" ? 9 : 4,
          status: "OPEN" as any,
          ownerId: matchAssignee(item.suggested_assignee) || null,
        }})
        created.push({ type: "risk", code, title: item.title })
      } else if (t === "issue") {
        const code = await nextCode("issue", params.projectId, "I")
        await db.issue.create({ data: {
          projectId: params.projectId, code, title: item.title,
          description: item.description || null,
          priority: prio(item.priority) as any,
          status: "OPEN" as any,
          dueDate: parseDate(item.suggested_due_date) || null,
          ownerId: matchAssignee(item.suggested_assignee) || null,
          raisedById: session.user.id,
        }})
        created.push({ type: "issue", code, title: item.title })
      } else if (t === "decision") {
        const code = await nextCode("decision", params.projectId, "D")
        await db.decision.create({ data: {
          projectId: params.projectId, code, title: item.title,
          description: item.description || null,
          madeById: session.user.id,
          madeAt: new Date(),
        }})
        created.push({ type: "decision", code, title: item.title })
      } else {
        // task, action_item, document, and anything future-shaped
        const code = await nextCode("task", params.projectId, "T")
        const note = (t !== "task" && t !== "action_item") ? `[${t.replace(/_/g, " ")}] ` : ""
        await db.task.create({ data: {
          projectId: params.projectId, code,
          title: item.title,
          description: `${note}${item.description || ""}`.trim() || null,
          status: "TODO" as any,
          priority: prio(item.priority) as any,
          dueDate: parseDate(item.suggested_due_date) || null,
        }})
        created.push({ type: "task", code, title: item.title })
      }
    } catch (e) {
      console.error("[ai-apply]", item.title, e)
      failed.push({ title: item.title, reason: "couldn't create this item" })
    }
  }

  await db.auditLog.create({ data: {
    workspaceId, userId: session.user.id,
    action: "ai.suggestions_applied",
    entityType: "project", entityId: params.projectId,
  }}).catch(() => {})

  return NextResponse.json({ data: { created, failed } })
}
