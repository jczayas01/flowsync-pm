-- Control accounts: link schedule tasks to the budget line they consume, so
-- earned value is computed per line from its own work instead of spreading the
-- project's overall percentage across every line.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "budgetItemId" TEXT;

CREATE INDEX IF NOT EXISTS "tasks_budgetItemId_idx" ON tasks("budgetItemId");

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS "tasks_budgetItemId_fkey";
ALTER TABLE tasks
  ADD CONSTRAINT "tasks_budgetItemId_fkey"
  FOREIGN KEY ("budgetItemId") REFERENCES budget_items(id) ON DELETE SET NULL;
