-- The language a project is documented in, chosen at import.
-- Without it, a PM who receives an English plan and reports to a Spanish-speaking
-- sponsor has to change a global setting before creating the project — which a
-- new user has no way of knowing.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "docLocale" TEXT;
