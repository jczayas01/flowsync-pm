// src/app/api/cron/due-reminders/route.ts
// Call once per day from a scheduler (e.g. Vercel Cron or an external cron) to
// notify assignees of tasks due within the next 2 days.
// If CRON_SECRET is set, requests must include ?secret=... (or Authorization: Bearer ...).
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyMany } from "@/lib/notify"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = new URL(req.url).searchParams.get("secret") ||
      (req.headers.get("authorization") || "").replace("Bearer ", "")
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const horizon = new Date(now); horizon.setDate(horizon.getDate() + 2); horizon.setHours(23, 59, 59, 999)

  const tasks = await db.task.findMany({
    where: {
      status:  { notIn: ["DONE", "CANCELLED"] },
      dueDate: { gte: start, lte: horizon },
    },
    select: {
      id: true, title: true, dueDate: true,
      project:   { select: { workspaceId: true } },
      assignees: { select: { userId: true } },
    },
  })

  let notified = 0
  for (const t of tasks) {
    if (!t.project?.workspaceId || !t.assignees.length) continue
    await notifyMany(t.assignees.map(a => a.userId), {
      workspaceId: t.project.workspaceId,
      type: "DUE_SOON",
      title: `Task due soon: "${t.title}"`,
      link: "/my-tasks",
    })
    notified += t.assignees.length
  }

  return NextResponse.json({ ok: true, tasks: tasks.length, notifications: notified })
}
