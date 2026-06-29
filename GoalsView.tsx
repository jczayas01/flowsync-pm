-- FlowSync PM — Phase 3 schema additions
-- Run: psql $DATABASE_URL < prisma/phase3-schema.sql

-- Custom fields
CREATE TABLE IF NOT EXISTS custom_fields (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  field_type   TEXT NOT NULL,  -- text|number|date|select|multiselect|checkbox|url|email|currency
  entity       TEXT NOT NULL,  -- project|task
  required     BOOLEAN DEFAULT FALSE,
  options      JSONB,          -- for select/multiselect
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Custom field values
CREATE TABLE IF NOT EXISTS custom_field_values (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  custom_field_id TEXT NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id       TEXT NOT NULL,   -- project or task ID
  value_text      TEXT,
  value_number    DECIMAL(15,4),
  value_date      DATE,
  value_boolean   BOOLEAN,
  value_json      JSONB,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cfv_entity ON custom_field_values(entity_id);

-- Project documents (wiki)
CREATE TABLE IF NOT EXISTS project_documents (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  content    TEXT NOT NULL DEFAULT '[]',   -- JSON array of DocBlocks
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  events           TEXT[] NOT NULL DEFAULT '{}',
  secret           TEXT NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE,
  success_count    INTEGER DEFAULT 0,
  error_count      INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  webhook_id   TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  payload      JSONB,
  status_code  INTEGER,
  response     TEXT,
  duration_ms  INTEGER,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,  -- bcrypt hash of the raw key
  prefix       TEXT NOT NULL,         -- first 12 chars for display
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  is_active    BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Member skills
ALTER TABLE users ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- White-label workspace fields
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS custom_domain        TEXT UNIQUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_name           TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS support_email        TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS favicon_url          TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS accent_color         TEXT DEFAULT '#F59E0B';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS hide_proaxis_branding BOOLEAN DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS domain_verified      BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_workspace ON custom_fields(workspace_id);
