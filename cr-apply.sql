-- Change requests that act, not just record.
-- scheduleDays and budgetLineId turn a described impact into an applicable one;
-- appliedAt/appliedSummary record what approval actually did.
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS "scheduleDays"   INTEGER;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS "budgetLineId"   TEXT;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS "appliedAt"      TIMESTAMP(3);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS "appliedSummary" TEXT;
