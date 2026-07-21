-- Secondary brand color for workspace branding (reports/present accents).
-- Run in Supabase SQL Editor BEFORE deploying. Project: umwhhfyfcglyaxnzixng (VERIFY).
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT NOT NULL DEFAULT '#F59E0B';
