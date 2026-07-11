// src/app/api/m365/webhook/route.ts
// Receives push notifications from Microsoft Graph
// Called by Graph when new mail/events arrive matching our subscriptions

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { detectProjectEmails } from "@/lib/m365/outlook"

// Graph sends a validation token on subscription creation — must echo it back
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("validationToken")
  if (token) {
    return new NextResponse(decodeURIComponent(token), {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }
  return new NextResponse("OK", { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const notifications = body.value || []

    for (const notif of notifications) {
      // Validate client state matches our secret
      const clientState = notif.clientState || ""
      if (!clientState.startsWith("flowsync-")) continue

      const userId = clientState.replace("flowsync-", "")
      const resourceData = notif.resourceData || {}

      // Handle new email
      if (notif.subscriptionId && notif.changeType === "created") {
        // Trigger async detection (don't block the webhook response)
        detectProjectEmails(userId).then(async (emails) => {
          // Store detected updates as notifications
          for (const email of emails.slice(0, 5)) {
            if (!email.projectId) continue

            // Get workspace for this project
            const project = await db.project.findUnique({
              where:  { id: email.projectId },
              select: { workspaceId: true },
            })
            if (!project) continue

            // Create notification for the user
            await db.notification.create({
              data: {
                userId,
                type:       "MENTION",
                title:      `M365: ${email.subject}`,
                body:       email.suggestedAction || email.snippet,
              },
            }).catch(() => {})
          }
        }).catch(console.error)
      }
    }

    return new NextResponse(null, { status: 202 })
  } catch (e) {
    console.error("[Webhook]", e)
    return new NextResponse(null, { status: 200 }) // Always return 200 to Graph
  }
}
