-- ============================================================================
-- FlowSync PM — Goals & OKRs migration
-- Run once in Supabase → SQL Editor. Safe to re-run (drops any old placeholder
-- goals tables first, then creates the real schema matching prisma/schema.prisma).
-- ============================================================================

-- Remove any earlier placeholder tables/types (the old goals-schema.sql, if it
-- was ever run). No real data existed since Goals had no working create path.
DROP TABLE IF EXISTS "goal_projects" CASCADE;
DROP TABLE IF EXISTS "key_results" CASCADE;
DROP TABLE IF EXISTS "goals" CASCADE;
DROP TYPE  IF EXISTS "GoalStatus" CASCADE;
DROP TYPE  IF EXISTS "GoalType" CASCADE;

CREATE TYPE "GoalType"   AS ENUM ('ANNUAL', 'QUARTERLY', 'MONTHLY');
CREATE TYPE "GoalStatus" AS ENUM ('DRAFT', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'ACHIEVED', 'MISSED');

CREATE TABLE "goals" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "type"        "GoalType"   NOT NULL DEFAULT 'ANNUAL',
  "quarter"     TEXT,
  "status"      "GoalStatus" NOT NULL DEFAULT 'DRAFT',
  "progress"    INTEGER      NOT NULL DEFAULT 0,
  "ownerId"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "goals_ownerId_fkey"     FOREIGN KEY ("ownerId")     REFERENCES "users"("id")      ON DELETE SET NULL
);
CREATE INDEX "goals_workspaceId_idx" ON "goals"("workspaceId");

CREATE TABLE "key_results" (
  "id"           TEXT PRIMARY KEY,
  "goalId"       TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "target"       DOUBLE PRECISION NOT NULL DEFAULT 100,
  "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unit"         TEXT,
  "progress"     INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "key_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE
);
CREATE INDEX "key_results_goalId_idx" ON "key_results"("goalId");

CREATE TABLE "goal_projects" (
  "id"        TEXT PRIMARY KEY,
  "goalId"    TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  CONSTRAINT "goal_projects_goalId_fkey"    FOREIGN KEY ("goalId")    REFERENCES "goals"("id")    ON DELETE CASCADE,
  CONSTRAINT "goal_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "goal_projects_goalId_projectId_key" ON "goal_projects"("goalId", "projectId");
CREATE INDEX "goal_projects_goalId_idx"    ON "goal_projects"("goalId");
CREATE INDEX "goal_projects_projectId_idx" ON "goal_projects"("projectId");
