-- Email verification at signup — run in Supabase SQL Editor BEFORE deploying.
-- Project: umwhhfyfcglyaxnzixng (VERIFY the URL before running).

-- 1) Token table (mirrors password_reset_tokens)
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_tokenHash_key"
  ON "email_verification_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx"
  ON "email_verification_tokens"("userId");

ALTER TABLE "email_verification_tokens"
  ADD CONSTRAINT "email_verification_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) CRITICAL BACKFILL: mark every existing user as verified so nobody is
--    locked out when the sign-in gate deploys.
UPDATE "users" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL;
