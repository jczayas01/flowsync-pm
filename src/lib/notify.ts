// src/lib/notify.ts
import { db } from "@/lib/db"

type NotifyInput = {
  workspaceId: string
  userId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  actorId?: string | null
}

// Create a notification for one user (skips notifying yourself).
export async function notify(input: NotifyInput) {
  if (input.actorId && input.actorId === input.userId) return
  try {
    await db.notification.create({
      data: {
        workspaceId: input.workspaceId,
        userId:      input.userId,
        type:        input.type,
        title:       input.title,
        body:        input.body ?? null,
        link:        input.link ?? null,
        actorId:     input.actorId ?? null,
      },
    })
  } catch { /* never block the main action on a notification failure */ }
}

// Fan-out to many recipients.
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
  const unique = Array.from(new Set(userIds)).filter(u => u && u !== input.actorId)
  await Promise.all(unique.map(userId => notify({ ...input, userId })))
}
