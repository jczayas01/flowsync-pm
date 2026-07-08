-- FlowSync PM — Portfolio + Time tracking schema additions
-- Run after main schema

-- Portfolio
CREATE TABLE IF NOT EXISTS portfolios (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT '#1B6CA8',
  owner_id      TEXT REFERENCES users(id),
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  budget_total  DECIMAL(15,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Program
CREATE TABLE IF NOT EXISTS programs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  portfolio_id  TEXT REFERENCES portfolios(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT '#059669',
  manager_id    TEXT REFERENCES users(id),
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  budget_total  DECIMAL(15,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add program_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS program_id TEXT REFERENCES programs(id) ON DELETE SET NULL;

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id),
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id       TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  invoice_id    TEXT,
  date          DATE NOT NULL,
  hours         DECIMAL(5,2) NOT NULL,
  description   TEXT,
  is_billable   BOOLEAN DEFAULT TRUE,
  hourly_rate   DECIMAL(10,2) DEFAULT 0,
  amount        DECIMAL(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_user    ON time_entries(user_id, date DESC);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  issuer_name     TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  client_email    TEXT NOT NULL,
  client_address  TEXT,
  currency        TEXT DEFAULT 'USD',
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate        DECIMAL(5,2)  DEFAULT 0,
  tax_amount      DECIMAL(12,2) DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid     DECIMAL(12,2) DEFAULT 0,
  due_date        DATE,
  issued_at       TIMESTAMPTZ DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_by_id   TEXT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_idx   INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  quantity    DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_project   ON invoices(project_id);

-- Workspace billing settings
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS invoice_tax_rate    DECIMAL(5,2)  DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS invoice_prefix      TEXT DEFAULT 'INV';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS billing_address     TEXT;
