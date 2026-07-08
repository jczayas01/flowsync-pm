-- FlowSync PM — Automation Engine schema
-- Add these tables after the main schema

CREATE TABLE IF NOT EXISTS automation_rules (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  scope           TEXT NOT NULL DEFAULT 'project',  -- workspace|project|program
  is_active       BOOLEAN DEFAULT TRUE,
  -- Trigger
  trigger_type    TEXT NOT NULL,
  trigger_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Conditions (array)
  conditions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Actions (ordered array)
  actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Origin
  recipe_id       TEXT,   -- which recipe template it was created from
  -- Stats
  run_count       INTEGER DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  last_error      TEXT,
  -- Meta
  created_by_id   TEXT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_rules_workspace   ON automation_rules(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_rules_project     ON automation_rules(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_rules_trigger     ON automation_rules(workspace_id, trigger_type);

CREATE TABLE IF NOT EXISTS automation_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule_id       TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  entity_id     TEXT,
  success       BOOLEAN NOT NULL,
  actions_run   INTEGER DEFAULT 0,
  skipped       BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  log_entries   JSONB DEFAULT '[]'::jsonb,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_logs_rule      ON automation_logs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_logs_workspace ON automation_logs(workspace_id, created_at DESC);
