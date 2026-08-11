// src/lib/ai-guard.ts
// Single enforcement point for workspace AI governance.
//
// Every AI route calls aiGuard() before touching the Anthropic API. Two jobs:
// (1) honor the workspace-level aiEnabled kill switch — enforced server-side,
//     so disabling AI in settings genuinely disables it, not just hides it;
// (2) leave an audit trail: every call and every block lands in AuditLog as
//     action "ai.call" / "ai.blocked" with the feature name in entityId, the
//     same table the OCR meter already uses — auditable per workspace with
//     zero new infrastructure.
//
// The log write is fire-and-forget: an audit hiccup must never take the
// feature down with it.

import { db } from "@/lib/db"

export const AI_DISABLED_ERROR =
  "AI features are disabled for this workspace by policy / " +
  "Las funciones de IA están desactivadas en este workspace por política"

export async function aiGuard(
  workspaceId: string,
  feature: string,
  userId?: string | null,
  projectId?: string | null,
): Promise<boolean> {
  let enabled = true
  try {
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { aiEnabled: true } as any,
    }) as any
    enabled = ws?.aiEnabled !== false
  } catch { /* unknown workspace: let the route's own auth handle it */ }

  db.auditLog.create({
    data: {
      workspaceId,
      userId:     userId || null,
      action:     enabled ? "ai.call" : "ai.blocked",
      entityType: "AI",
      entityId:   feature,
      after:      projectId ? { projectId } : undefined,
    },
  }).catch(() => {})

  return enabled
}
