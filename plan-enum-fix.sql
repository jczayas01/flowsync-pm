-- Fix: Postgres "Plan" enum drifted behind schema.prisma — STARTER and
-- PROFESSIONAL (at least) are missing, so plan changes fail with 22P02.
-- Run in Supabase SQL Editor. Project: umwhhfyfcglyaxnzixng (VERIFY URL).
-- ADD VALUE IF NOT EXISTS is safe to re-run; existing values are skipped.
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'FREE';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'PRO';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'PROFESSIONAL';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'CONSULTANT';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';
-- Verify: should list all seven values
SELECT unnest(enum_range(NULL::"Plan"));
