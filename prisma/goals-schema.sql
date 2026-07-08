-- Goals & OKR tracking schema
CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL DEFAULT 'QUARTERLY',
  quarter      TEXT,
  status       TEXT NOT NULL DEFAULT 'DRAFT',
  progress     INTEGER DEFAULT 0,
  owner_id     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS key_results (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  goal_id       TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  progress      INTEGER DEFAULT 0,
  target        NUMERIC DEFAULT 100,
  current_value NUMERIC DEFAULT 0,
  unit          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_key_results_goal ON key_results(goal_id);
