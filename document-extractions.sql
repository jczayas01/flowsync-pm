-- Distribution ledger: which items were created from which document/content.
-- Run in Supabase SQL Editor BEFORE deploying. Project: umwhhfyfcglyaxnzixng (VERIFY).
CREATE TABLE IF NOT EXISTS "document_extractions" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "documentId"  TEXT,
  "sourceLabel" TEXT,
  "fingerprint" TEXT NOT NULL,
  "itemType"    TEXT NOT NULL,
  "itemId"      TEXT,
  "itemCode"    TEXT,
  "title"       TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "document_extractions_projectId_fingerprint_key"
  ON "document_extractions"("projectId","fingerprint");
CREATE INDEX IF NOT EXISTS "document_extractions_documentId_idx"
  ON "document_extractions"("documentId");
DO $$ BEGIN
  ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- RLS to match the rest of the schema hardening
ALTER TABLE "document_extractions" ENABLE ROW LEVEL SECURITY;
