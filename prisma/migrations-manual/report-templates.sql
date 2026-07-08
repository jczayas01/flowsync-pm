-- ============================================================================
-- FlowSync PM — Report templates migration
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "report_templates" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "audience"    TEXT NOT NULL DEFAULT 'TEAM',
  "sections"    JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "report_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "report_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "report_templates_workspaceId_idx" ON "report_templates"("workspaceId");
