-- clm-schema.sql — Enterprise Contracts / CLM
-- Run in Supabase SQL Editor (prod umwhhfyfcglyaxnzixng) BEFORE pushing. Idempotent.

DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('DRAFT','ACTIVE','EXPIRED','TERMINATED','RENEWED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractInvoiceStatus" AS ENUM ('DRAFT','SENT','PAID','OVERDUE','VOID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customer_contracts (
  id            TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  status        "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "renewalDate" TIMESTAMP(3),
  "autoRenew"   BOOLEAN NOT NULL DEFAULT false,
  "alertDays"   INTEGER NOT NULL DEFAULT 60,
  "lastAlertAt" TIMESTAMP(3),
  "paidSeats"   INTEGER NOT NULL DEFAULT 0,
  "contributorBundles" INTEGER NOT NULL DEFAULT 0,
  "ocrPageCap"  INTEGER,
  "billingCycle" TEXT NOT NULL DEFAULT 'ANNUAL',
  amount        DECIMAL(15,2),
  currency      TEXT NOT NULL DEFAULT 'USD',
  "supportTier" TEXT,
  "responseHours" INTEGER,
  "uptimePct"   DECIMAL(5,2),
  "slaNotes"    TEXT,
  notes         TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "customer_contracts_workspaceId_idx" ON customer_contracts("workspaceId");

CREATE TABLE IF NOT EXISTS contract_invoices (
  id           TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,
  number       TEXT NOT NULL,
  amount       DECIMAL(15,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  "issueDate"  TIMESTAMP(3) NOT NULL,
  "dueDate"    TIMESTAMP(3) NOT NULL,
  "paidDate"   TIMESTAMP(3),
  status       "ContractInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  notes        TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "contract_invoices_contractId_idx" ON contract_invoices("contractId");

CREATE TABLE IF NOT EXISTS contract_documents (
  id             TEXT PRIMARY KEY,
  "contractId"   TEXT NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  "fileName"     TEXT NOT NULL,
  "storagePath"  TEXT NOT NULL,
  "contentType"  TEXT NOT NULL DEFAULT 'application/pdf',
  "sizeBytes"    INTEGER NOT NULL DEFAULT 0,
  "uploadedById" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "contract_documents_contractId_idx" ON contract_documents("contractId");

-- RLS: deny PostgREST (consistent with the rest of the schema)
ALTER TABLE customer_contracts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_documents  ENABLE ROW LEVEL SECURITY;
