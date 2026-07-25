-- budget-automation.sql — run in Supabase SQL Editor (prod umwhhfyfcglyaxnzixng) BEFORE pushing.
-- Idempotent: safe to re-run.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS "autoEv" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS "budgetItemId" TEXT,
  ADD COLUMN IF NOT EXISTS "expensePostedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procurement_items_budgetItemId_fkey'
  ) THEN
    ALTER TABLE procurement_items
      ADD CONSTRAINT "procurement_items_budgetItemId_fkey"
      FOREIGN KEY ("budgetItemId") REFERENCES budget_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name='procurement_items';
