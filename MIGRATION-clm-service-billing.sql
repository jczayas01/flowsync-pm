-- MIGRATION-clm-service-billing.sql
-- FlowSync PM — CLM: billable service delivery + fixed-fee onboarding milestones.
-- RUN THIS IN SUPABASE (project ref umwhhfyfcglyaxnzixng) BEFORE `git push`.
-- Idempotent: safe to re-run.

BEGIN;

-- ── 1. Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ServiceCategory" AS ENUM ('ONBOARDING','TRAINING','SERVICE_REQUEST','CHANGE_CONFIG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceEntryStatus" AS ENUM ('DRAFT','APPROVED','INVOICED','WRITTEN_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingMilestoneStatus" AS ENUM ('PENDING','COMPLETED','INVOICED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. New columns on customer_contracts ────────────────────────────────────
ALTER TABLE "customer_contracts"
  ADD COLUMN IF NOT EXISTS "serviceHourlyRate" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "onboardingFee"     DECIMAL(15,2);

-- ── 3. contract_service_entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contract_service_entries" (
  "id"          TEXT PRIMARY KEY,
  "contractId"  TEXT NOT NULL,
  "entryDate"   TIMESTAMP(3) NOT NULL,
  "category"    "ServiceCategory"    NOT NULL DEFAULT 'SERVICE_REQUEST',
  "description" TEXT NOT NULL,
  "hours"       DECIMAL(8,2)  NOT NULL,
  "rate"        DECIMAL(12,2) NOT NULL,
  "amount"      DECIMAL(15,2) NOT NULL,
  "billable"    BOOLEAN NOT NULL DEFAULT true,
  "status"      "ServiceEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "performedBy" TEXT,
  "notes"       TEXT,
  "invoiceId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. contract_onboarding_milestones ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contract_onboarding_milestones" (
  "id"            TEXT PRIMARY KEY,
  "contractId"    TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "amount"        DECIMAL(15,2) NOT NULL,
  "targetDate"    TIMESTAMP(3),
  "completedDate" TIMESTAMP(3),
  "status"        "OnboardingMilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "invoiceId"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. Foreign keys ─────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "contract_service_entries"
    ADD CONSTRAINT "contract_service_entries_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "customer_contracts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_service_entries"
    ADD CONSTRAINT "contract_service_entries_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "contract_invoices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_onboarding_milestones"
    ADD CONSTRAINT "contract_onboarding_milestones_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "customer_contracts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_onboarding_milestones"
    ADD CONSTRAINT "contract_onboarding_milestones_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "contract_invoices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "contract_service_entries_contractId_entryDate_idx"
  ON "contract_service_entries"("contractId","entryDate");
CREATE INDEX IF NOT EXISTS "contract_service_entries_contractId_status_idx"
  ON "contract_service_entries"("contractId","status");
CREATE INDEX IF NOT EXISTS "contract_service_entries_invoiceId_idx"
  ON "contract_service_entries"("invoiceId");

CREATE INDEX IF NOT EXISTS "contract_onboarding_milestones_contractId_sortOrder_idx"
  ON "contract_onboarding_milestones"("contractId","sortOrder");
CREATE INDEX IF NOT EXISTS "contract_onboarding_milestones_invoiceId_idx"
  ON "contract_onboarding_milestones"("invoiceId");

CREATE INDEX IF NOT EXISTS "customer_contracts_status_endDate_idx"
  ON "customer_contracts"("status","endDate");

COMMIT;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'customer_contracts'
--     AND column_name IN ('serviceHourlyRate','onboardingFee');
-- SELECT to_regclass('public.contract_service_entries'),
--        to_regclass('public.contract_onboarding_milestones');
