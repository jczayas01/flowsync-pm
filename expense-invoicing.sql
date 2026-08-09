-- The invoicing cycle.
-- An invoice received is a liability; an invoice paid is a cost against cash.
-- Collapsing the two is how a project reports budget remaining while unpaid
-- invoices sit in someone's inbox.
DO $$ BEGIN
  CREATE TYPE "ExpenseStatus" AS ENUM ('RECEIVED','APPROVED','PAID','DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status "ExpenseStatus" NOT NULL DEFAULT 'PAID';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS "dueDate"   TIMESTAMP(3);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS "paidDate"  TIMESTAMP(3);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS retainage   DECIMAL(15,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS "procurementItemId" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_status_idx" ON expenses(status);

-- Everything already recorded represents money spent and is already counted in
-- each line's actual cost, so it starts as PAID. Nothing moves on deploy.
UPDATE expenses SET status = 'PAID', "paidDate" = COALESCE("paidDate", date)
 WHERE status IS NULL OR "paidDate" IS NULL;
