-- ============================================================================
-- FlowSync PM — Automation rules
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "trigger"     TEXT NOT NULL,
  "condition"   TEXT,
  "action"      TEXT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "runCount"    INTEGER NOT NULL DEFAULT 0,
  "lastRunAt"   TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_rules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "automation_rules_workspaceId_idx" ON "automation_rules"("workspaceId");
