-- A task can consume more than one budget line.
-- `share` is the portion of the task's effort attributable to that line (0-1).
-- Null means "split evenly", so linking two lines needs no extra input.
CREATE TABLE IF NOT EXISTS task_budget_lines (
  id             TEXT PRIMARY KEY,
  "taskId"       TEXT NOT NULL REFERENCES tasks(id)        ON DELETE CASCADE,
  "budgetItemId" TEXT NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  share          DECIMAL(6,4),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_budget_lines_task_line_key"
  ON task_budget_lines("taskId", "budgetItemId");
CREATE INDEX IF NOT EXISTS "task_budget_lines_budgetItemId_idx"
  ON task_budget_lines("budgetItemId");

-- Carry every existing single link into the new table so no earned value moves
-- the moment this ships.
INSERT INTO task_budget_lines (id, "taskId", "budgetItemId", share)
SELECT gen_random_uuid()::text, t.id, t."budgetItemId", NULL
  FROM tasks t
 WHERE t."budgetItemId" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM task_budget_lines l
      WHERE l."taskId" = t.id AND l."budgetItemId" = t."budgetItemId"
   );
