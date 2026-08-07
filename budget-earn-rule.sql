-- How each budget line earns value.
-- Spreading a task's percentage across equipment credits value for meetings held
-- rather than hardware delivered — the reason a CPI can read 1.00 while an
-- advance sits paid against nothing received.
DO $$ BEGIN
  CREATE TYPE "EarnRule" AS ENUM ('EFFORT','ZERO_HUNDRED','FIFTY_FIFTY','MILESTONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS "earnRule" "EarnRule" NOT NULL DEFAULT 'EFFORT';

-- Equipment and materials are the classic 0/100 case: they earn on receipt, not
-- on effort. Existing lines in those categories start there; everything else
-- keeps today's behaviour so no number moves on deploy.
UPDATE budget_items
   SET "earnRule" = 'ZERO_HUNDRED'
 WHERE category IN ('EQUIPMENT','MATERIALS')
   AND "earnRule" = 'EFFORT';
