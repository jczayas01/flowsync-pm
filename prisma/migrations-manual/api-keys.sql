-- ============================================================================
-- FlowSync PM — API keys
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "keyHash"     TEXT NOT NULL UNIQUE,
  "prefix"      TEXT NOT NULL,
  "scopes"      TEXT[] NOT NULL DEFAULT '{}'::text[],
  "lastUsedAt"  TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"   TIMESTAMP(3),
  CONSTRAINT "api_keys_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "api_keys_workspaceId_idx" ON "api_keys"("workspaceId");
