// src/app/api/notifications/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

// GET — recent notifications + unread count
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take:    30,
    }),
    db.notification.count({ where: { userId: session.user.id, read: false } }),
  ])
  return NextResponse.json({ items, unread })
}

// PATCH — mark one (body {id}) or all (body {all:true}) as read
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body?.all) {
    await db.notification.updateMany({ where: { userId: session.user.id, read: false }, data: { read: true } })
  } else if (body?.id) {
    await db.notification.updateMany({ where: { id: body.id, userId: session.user.id }, data: { read: true } })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — remove a single notification (?id=) or every read one (?read=1).
// Marking as read hides the badge but the list still grows forever; people
// want to clear it.
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (id) {
    await db.notification.deleteMany({ where: { id, userId: session.user.id } })
    return NextResponse.json({ ok: true, deleted: 1 })
  }
  if (url.searchParams.get("read") === "1") {
    const r = await db.notification.deleteMany({ where: { userId: session.user.id, read: true } })
    return NextResponse.json({ ok: true, deleted: r.count })
  }
  return NextResponse.json({ error: "Pass ?id= or ?read=1" }, { status: 400 })
}
