// src/lib/tasks-unread.ts
// Per-user unread activity counts for task lists.
import { db } from "@/lib/db"

export async function attachUnread<T extends { id: string }>(tasks: T[], userId: string): Promise<(T & { unreadComments: number })[]> {
  if (!tasks.length) return tasks.map(t => ({ ...t, unreadComments: 0 }))
  const ids = tasks.map(t => t.id)
  const [reads, comments] = await Promise.all([
    db.commentRead.findMany({
      where: { userId, taskId: { in: ids } },
      select: { taskId: true, lastReadAt: true },
    }),
    db.comment.findMany({
      where: { taskId: { in: ids }, authorId: { not: userId } },
      select: { taskId: true, createdAt: true },
    }),
  ]).catch(() => [[], []] as any)
  const readMap = new Map((reads as any[]).map(r => [r.taskId, r.lastReadAt.getTime()]))
  const unread = new Map<string, number>()
  for (const c of comments as any[]) {
    const last = readMap.get(c.taskId) || 0
    if (c.createdAt.getTime() > last) unread.set(c.taskId, (unread.get(c.taskId) || 0) + 1)
  }
  return tasks.map(t => ({ ...t, unreadComments: unread.get(t.id) || 0 }))
}
