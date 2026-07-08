-- ============================================================================
-- FlowSync PM — Custom fields: add description + isActive
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
ALTER TABLE "custom_fields" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "custom_fields" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
