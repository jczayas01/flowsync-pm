-- ============================================================================
-- FlowSync PM — Automation execution logs
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "automation_logs" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "ruleId"      TEXT,
  "ruleName"    TEXT NOT NULL,
  "trigger"     TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "message"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "automation_logs_workspaceId_idx" ON "automation_logs"("workspaceId");
