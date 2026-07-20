-- Workspace settings blob (delete-role configuration lives here).
-- Run in Supabase SQL Editor BEFORE deploying. Project: umwhhfyfcglyaxnzixng (VERIFY).
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
