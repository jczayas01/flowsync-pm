-- ============================================================================
-- FlowSync PM — Add HYBRID to the Methodology enum
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================
ALTER TYPE "Methodology" ADD VALUE IF NOT EXISTS 'HYBRID';
