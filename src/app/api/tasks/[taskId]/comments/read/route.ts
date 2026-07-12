// POST /api/tasks/:taskId/comments/read — mark this task's activity as read for me
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function POST(_req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.commentRead.upsert({
    where:  { taskId_userId: { taskId: params.taskId, userId: session.user.id } },
    create: { taskId: params.taskId, userId: session.user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  })

  return NextResponse.json({ data: { read: true } })
}
