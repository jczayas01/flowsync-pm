-- FlowSync PM — Security schema additions
-- Run after main schema is in place

-- 2FA fields on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled      BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_confirmed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts   INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until            TIMESTAMPTZ;

-- Workspace security settings
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS require_2fa          BOOLEAN DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS require_2fa_roles    TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ip_allowlist         TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS max_sessions         INTEGER DEFAULT 10;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS session_timeout_mins INTEGER DEFAULT 480;

-- Project role delegation
CREATE TABLE IF NOT EXISTS project_delegations (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_user_id  TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  to_user_id    TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  reason        TEXT,
  granted_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  UNIQUE(project_id, from_user_id, to_user_id)
);

-- Consent records
CREATE TABLE IF NOT EXISTS consent_records (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tos_version     TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  accepted_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);

-- Indexes for audit log performance
CREATE INDEX IF NOT EXISTS idx_audit_workspace_action ON audit_logs(workspace_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_user_created     ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity           ON audit_logs(entity_type, entity_id);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires);
