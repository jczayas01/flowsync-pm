// src/app/api/intake/[id]/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, ApiContext } from "@/lib/api"
import { can, mapDbRoleToRbac } from "@/lib/rbac/roles"
import { notify } from "@/lib/notify"

const patchSchema = z.object({
  action:     z.enum(["review","approve","reject","convert"]),
  reviewNote: z.string().max(5000).optional().nullable(),
})

async function updateIntake(ctx: ApiContext, params?: Record<string,string>) {
  const id = params?.id
  if (!id) return err("Intake ID required")

  const body = await ctx.req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return err("Invalid request")
  const { action, reviewNote } = parsed.data

  const role = mapDbRoleToRbac(ctx.userRole as any)
  const CAN_EVAL = ["EXECUTIVE","PMO_DIRECTOR","SUPER_ADMIN","OWNER","ADMIN"]
  if (!CAN_EVAL.includes(role)) return err("Only PMO and C-level can evaluate intake requests", 403)

  const item = await db.projectIntake.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
  if (!item) return notFound("Intake not found")

  // Separation of duties: you cannot approve/convert your own submission
  if ((action === "approve" || action === "convert") && item.submittedById === ctx.userId) {
    return err("You can't approve your own submission — separation of duties requires a different reviewer.", 403)
  }

  if (action === "convert") {
    if (item.convertedProjectId) return err("Already converted")
    const count = await db.project.count({ where: { workspaceId: ctx.workspaceId } })
    const code = `PRJ-${String(count + 1).padStart(3, "0")}`
    const project = await db.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        code,
        name: item.title,
        description: item.description,
        methodology: "WATERFALL",
      },
    })

    // Copy the intake's attachments into the new project's Docs (files already in storage)
    const intakeFiles = await db.intakeFile.findMany({ where: { intakeId: id } }).catch(() => [] as any[])
    if (intakeFiles.length) {
      await db.document.createMany({
        data: intakeFiles.map((f: any) => ({
          projectId: project.id, name: f.name, fileUrl: f.fileUrl,
          fileType: f.fileType, fileSize: f.fileSize, uploadedById: ctx.userId,
        })),
      }).catch(() => {})
    }

    // AI: read the idea + attachments and pre-fill the project (best-effort; never blocks conversion)
    await enrichProjectFromIntake(project.id, item, intakeFiles, ctx.userId).catch(() => {})

    const updated = await db.projectIntake.update({
      where: { id },
      data: { status: "CONVERTED", convertedProjectId: project.id, reviewedById: ctx.userId },
    })
    await notify({
      workspaceId: ctx.workspaceId, userId: item.submittedById, actorId: ctx.userId,
      type: "INTAKE", title: `Your idea "${item.title}" was converted to a project`, link: `/projects/${project.id}`,
    })
    return ok({ item: updated, projectId: project.id })
  }

  const status = action === "review" ? "UNDER_REVIEW"
    : action === "approve" ? "APPROVED" : "REJECTED"
  const updated = await db.projectIntake.update({
    where: { id },
    data: { status, reviewedById: ctx.userId, reviewNote: reviewNote ?? item.reviewNote },
  })
  if (action === "approve" || action === "reject") {
    await notify({
      workspaceId: ctx.workspaceId, userId: item.submittedById, actorId: ctx.userId, type: "INTAKE",
      title: action === "approve" ? `Your idea "${item.title}" was approved` : `Your idea "${item.title}" was not approved`,
      body: reviewNote || undefined, link: "/intake",
    })
  }
  return ok({ item: updated })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withWorkspace(req, updateIntake, params)
}

// ── AI enrichment: read the idea + attachments, pre-fill the project ──
async function enrichProjectFromIntake(projectId: string, item: any, files: any[], userId: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const content: any[] = []
  for (const f of (files || []).slice(0, 3)) {
    try {
      const r = await fetch(f.fileUrl)
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      const nm = String(f.name || "").toLowerCase()
      const isPdf  = (f.fileType || "").includes("pdf") || nm.endsWith(".pdf")
      const isDocx = (f.fileType || "").includes("wordprocessingml") || nm.endsWith(".docx")
      if (isPdf) {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } })
      } else if (isDocx) {
        // Word .docx is a zip archive — extract real text with mammoth (npm i mammoth)
        try {
          const mammoth: any = await import("mammoth")
          const extract = mammoth.extractRawText || mammoth.default?.extractRawText
          const result = await extract({ buffer: buf })
          const text = String(result?.value || "").replace(/\s+/g, " ").slice(0, 12000)
          if (text.trim().length > 20) content.push({ type: "text", text: `--- ${f.name} ---\n${text}` })
        } catch { /* mammoth not installed or unreadable — skip this file */ }
      } else {
        const text = buf.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").slice(0, 12000)
        if (text.trim().length > 20) content.push({ type: "text", text: `--- ${f.name} ---\n${text}` })
      }
    } catch { /* skip unreadable file */ }
  }

  content.push({ type: "text", text:
    `A new project is being created from this intake idea:\n` +
    `Title: ${item.title}\nDescription: ${item.description}\n` +
    `Problem/opportunity: ${item.problem || "—"}\nExpected value: ${item.expectedValue || "—"}\n\n` +
    `Using the idea and any attached document(s), draft the project's setup. ` +
    `Return ONLY valid JSON, no markdown, no commentary:\n` +
    `{"objective":"one concise paragraph","scope":"one concise paragraph of what is in scope","background":"one concise paragraph of context","tasks":["5 to 10 short high-level starter tasks"]}`
  })

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content }] }),
  })
  if (!res.ok) return

  const data = await res.json()
  const raw = (data.content || []).find((b: any) => b.type === "text")?.text || ""
  let ext: any
  try { ext = JSON.parse(raw.replace(/```json\n?|```/g, "").trim()) } catch { return }

  await db.project.update({
    where: { id: projectId },
    data: {
      ...(ext.objective  && { objective:  String(ext.objective).slice(0, 4000) }),
      ...(ext.scope      && { scope:      String(ext.scope).slice(0, 4000) }),
      ...(ext.background && { background: String(ext.background).slice(0, 4000) }),
    },
  }).catch(() => {})

  if (Array.isArray(ext.tasks) && ext.tasks.length) {
    await db.task.createMany({
      data: ext.tasks.slice(0, 10).map((t: any, i: number) => ({
        projectId, code: `T-${String(i + 1).padStart(3, "0")}`,
        title: String(t).slice(0, 200), ownerId: userId, sortOrder: i,
      })),
      skipDuplicates: true,
    }).catch(() => {})
  }
}
