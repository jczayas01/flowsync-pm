-- Project documents (wiki) table
CREATE TABLE IF NOT EXISTS project_documents (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
