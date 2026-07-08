-- FlowSync PM — Goals / OKR schema
-- Run after main schema

CREATE TABLE IF NOT EXISTS goals (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'DRAFT',
  horizon       TEXT NOT NULL DEFAULT 'ANNUAL',
  start_date    DATE,
  end_date      DATE,
  owner_id      TEXT REFERENCES users(id),
  progress      INTEGER DEFAULT 0,
  created_by_id TEXT REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS key_results (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  goal_id     TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  current_val DECIMAL(15,2) DEFAULT 0,
  target_val  DECIMAL(15,2) NOT NULL,
  unit        TEXT DEFAULT '',
  progress    INTEGER DEFAULT 0,
  owner_id    TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_projects (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  goal_id     TEXT NOT NULL REFERENCES goals(id)    ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, project_id)
);

CREATE TABLE IF NOT EXISTS goal_tasks (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  goal_id     TEXT NOT NULL REFERENCES goals(id)  ON DELETE CASCADE,
  task_id     TEXT NOT NULL REFERENCES tasks(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_key_results_goal ON key_results(goal_id);
