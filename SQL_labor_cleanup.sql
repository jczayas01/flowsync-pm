-- SQL_labor_cleanup.sql — run in Supabase (project umwhhfyfcglyaxnzixng)
-- Removes the data the old timesheet model left behind. Safe to run AFTER the
-- deploy: nothing in the new code reads any of it.
--
-- Run the SELECTs first to see what you are about to delete.

-- ── 1. What is there now ─────────────────────────────────────────────────
SELECT count(*) AS time_entries FROM time_entries;

SELECT bi.id, p.name AS project, bi.name, bi."actualCost"
FROM budget_items bi
JOIN projects p ON p.id = bi."projectId"
WHERE bi.category = 'LABOR'
  AND bi.name IN ('Labor (time tracking)', 'Labour — Total', 'Labour - Total');

SELECT count(*) AS orphan_expenses
FROM expenses e
JOIN budget_items bi ON bi.id = e."budgetItemId"
WHERE bi.category = 'LABOR'
  AND bi.name IN ('Labor (time tracking)', 'Labour — Total', 'Labour - Total');

-- ── 2. Delete ────────────────────────────────────────────────────────────
BEGIN;

-- Expenses posted by the old cron / direct-mode poster.
DELETE FROM expenses e
USING budget_items bi
WHERE bi.id = e."budgetItemId"
  AND bi.category = 'LABOR'
  AND bi.name IN ('Labor (time tracking)', 'Labour — Total', 'Labour - Total');

-- The auto-managed labour lines themselves. The new model creates its own
-- line named exactly 'Labor' and keeps it in sync, so these must go or the
-- project would carry two labour lines.
DELETE FROM budget_items
WHERE category = 'LABOR'
  AND name IN ('Labor (time tracking)', 'Labour — Total', 'Labour - Total');

-- All timesheet rows. Nothing writes these any more.
DELETE FROM time_entries;

-- Re-derive budgetSpent from whatever lines remain, so no project keeps a
-- total that included the deleted expenses.
UPDATE projects p
SET "budgetSpent" = COALESCE((
  SELECT SUM(bi."actualCost") FROM budget_items bi WHERE bi."projectId" = p.id
), 0);

COMMIT;

-- ── 3. Verify ────────────────────────────────────────────────────────────
SELECT count(*) AS time_entries_left FROM time_entries;
SELECT id, name, "budgetSpent" FROM projects ORDER BY "updatedAt" DESC LIMIT 10;

-- Note: the time_entries table and its columns are intentionally LEFT IN PLACE.
-- Dropping them would require a Prisma schema change and a second migration;
-- an empty unused table costs nothing and keeps this deploy schema-free.
