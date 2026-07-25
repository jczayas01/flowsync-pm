-- budget-automation-2.sql — recurring posts + labor actuals + receipt OCR.
-- Run in Supabase (prod umwhhfyfcglyaxnzixng) BEFORE pushing. Idempotent.

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS "costPostedAt" TIMESTAMP(3);

ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS recurrence TEXT,
  ADD COLUMN IF NOT EXISTS "lastRecurredAt" TIMESTAMP(3);

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS "costRate" DECIMAL(10,2);
