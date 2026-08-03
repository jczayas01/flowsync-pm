-- Approved vs revised budget: editing a line used to erase the number the
-- sponsor signed off on. approvedCost keeps that figure so variance against the
-- approved plan stays auditable, and a change request's effect is visible.
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS "approvedCost" DECIMAL(15,2);
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS "approvedAt"   TIMESTAMP(3);

-- Seed: today's planned figures become the approved baseline for existing lines.
UPDATE budget_items
   SET "approvedCost" = "plannedCost", "approvedAt" = NOW()
 WHERE "approvedCost" IS NULL;
