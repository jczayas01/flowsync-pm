// src/app/api/tasks/[taskId]/comments/route.ts
// Contributions / notes on a task (reuses the Comment model).
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { notifyMany } from "@/lib/notify"

async function resolveWorkspace(req: NextRequest, session: any) {
  return req.headers.get("x-workspace-id") ||
    new URL(req.url).searchParams.get("workspaceId") ||
    session?.user?.activeWorkspaceId || null
}

// GET — list contributions for a task (newest first)
export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const comments = await db.comment.findMany({
    where:   { taskId: params.taskId },
    orderBy: { createdAt: "desc" },
    take:    50,
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json({ comments })
}

// POST — add a contribution/note to a task
export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const content = (body?.content || "").toString().trim()
  if (!content) return NextResponse.json({ error: "Empty note" }, { status: 400 })
  if (content.length > 5000) return NextResponse.json({ error: "Note too long" }, { status: 400 })

  // Must be an assignee of the task OR a member of its project
  const task = await db.task.findUnique({
    where:  { id: params.taskId },
    select: { id: true, projectId: true, assignees: { where: { userId: session.user.id }, select: { id: true } } },
  })
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  const isAssignee = task.assignees.length > 0
  const isMember = await db.projectMember.findFirst({
    where: { projectId: task.projectId, userId: session.user.id }, select: { id: true },
  })
  if (!isAssignee && !isMember) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 })
  }

  const comment = await db.comment.create({
    data: { content, authorId: session.user.id, taskId: params.taskId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  })

  // Notify the task's other assignees + anyone @mentioned
  try {
    const info = await db.task.findUnique({
      where: { id: params.taskId },
      select: { title:true, projectId:true, project:{ select:{ workspaceId:true } },
        assignees:{ select:{ userId:true } } },
    })
    if (info?.project?.workspaceId) {
      const ws = info.project.workspaceId
      // Contribution notification to co-assignees
      await notifyMany(info.assignees.map(a => a.userId), {
        workspaceId: ws,
        actorId: session.user.id,
        type: "COMMENT",
        title: `New contribution on "${info.title}"`,
        body: content.slice(0, 140),
        link: "/my-tasks",
      })
      // @mention notifications — match @tokens against project members' names
      const tokens = Array.from(new Set((content.match(/@([\p{L}][\p{L}'-]*)/gu) || []).map(t => t.slice(1).toLowerCase())))
      if (tokens.length) {
        const members = await db.projectMember.findMany({
          where: { projectId: params.taskId ? info.projectId : undefined },
          select: { userId: true, user: { select: { name: true } } },
        })
        const mentioned = members
          .filter(m => { const first = (m.user?.name || "").split(" ")[0].toLowerCase(); return tokens.includes(first) })
          .map(m => m.userId)
        await notifyMany(mentioned, {
          workspaceId: ws,
          actorId: session.user.id,
          type: "MENTION",
          title: `You were mentioned on "${info.title}"`,
          body: content.slice(0, 140),
          link: "/my-tasks",
        })
      }
    }
  } catch { /* ignore */ }

  return NextResponse.json({ comment })
}
