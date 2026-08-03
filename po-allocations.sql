-- Split a purchase order across several budget lines.
-- A $150K vendor contract that is $100K implementation and $50K training now
-- posts two expenses on completion — one per line — instead of loading the
-- whole amount onto a single line.
CREATE TABLE IF NOT EXISTS procurement_allocations (
  id                  TEXT PRIMARY KEY,
  "procurementItemId" TEXT NOT NULL REFERENCES procurement_items(id) ON DELETE CASCADE,
  "budgetItemId"      TEXT NOT NULL REFERENCES budget_items(id)      ON DELETE CASCADE,
  amount              DECIMAL(15,2) NOT NULL,
  note                TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "procurement_allocations_item_line_key"
  ON procurement_allocations("procurementItemId", "budgetItemId");
CREATE INDEX IF NOT EXISTS "procurement_allocations_budgetItemId_idx"
  ON procurement_allocations("budgetItemId");
