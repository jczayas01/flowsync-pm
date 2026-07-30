-- Add BLOCKED to the TaskStatus enum.
-- Run this ALONE in the Supabase SQL editor BEFORE pushing the code:
-- Postgres cannot use a newly added enum value in the same transaction that
-- adds it, so do not combine this with any SELECT that references 'BLOCKED'.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'BLOCKED' AFTER 'IN_REVIEW';

-- Verify separately, after the ALTER has committed:
-- SELECT unnest(enum_range(NULL::"TaskStatus"));
