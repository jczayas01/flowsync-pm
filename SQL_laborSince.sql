-- SQL_laborSince.sql — RUN THIS IN SUPABASE **BEFORE** git push.
-- Project: umwhhfyfcglyaxnzixng  (confirm top-left before running)
--
-- Adds the per-person labour start date. Nullable, so existing rows are
-- untouched and fall back to the project's start date automatically.

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS "laborSince" TIMESTAMP(3);

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'project_members' AND column_name = 'laborSince';
