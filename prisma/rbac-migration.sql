-- FlowSync PM — RBAC role migration
-- Run this after updating the Prisma schema enum values
-- Or use: npx prisma db push

-- Update UserRole enum to match new RBAC definitions
-- In Prisma, update the enum in schema.prisma to:
--
-- enum UserRole {
--   SYSTEM_ADMIN
--   ADMIN
--   SUPER_USER
--   PROGRAM_MANAGER
--   PROJECT_MANAGER
--   TEAM_MEMBER
--   READ_ONLY
--   CLIENT
-- }
--
-- Then run: npx prisma db push
-- This will add new enum values without dropping existing data.

-- Map old roles to new roles (run manually if migrating existing data)
-- UPDATE workspace_members SET role = 'ADMIN'           WHERE role = 'OWNER';
-- UPDATE workspace_members SET role = 'PROJECT_MANAGER' WHERE role = 'PM';
-- UPDATE workspace_members SET role = 'TEAM_MEMBER'     WHERE role = 'MEMBER';
-- UPDATE workspace_members SET role = 'CLIENT'          WHERE role = 'CLIENT'; -- unchanged
-- UPDATE workspace_members SET role = 'READ_ONLY'       WHERE role = 'VIEWER';

-- System admins — store emails in env variable SYSTEM_ADMIN_EMAILS
-- or create a dedicated table:
CREATE TABLE IF NOT EXISTS system_admins (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
