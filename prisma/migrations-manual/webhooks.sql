-- ============================================================================
-- FlowSync PM — Webhooks
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id"              TEXT PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL,
  "url"             TEXT NOT NULL,
  "events"          TEXT[] NOT NULL DEFAULT '{}'::text[],
  "secret"          TEXT NOT NULL,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "lastTriggeredAt" TIMESTAMP(3),
  "successCount"    INTEGER NOT NULL DEFAULT 0,
  "errorCount"      INTEGER NOT NULL DEFAULT 0,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhooks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "webhooks_workspaceId_idx" ON "webhooks"("workspaceId");
