-- ocr-packs.sql — OCR add-on packs. Run in Supabase BEFORE pushing. Idempotent.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS "ocrPageAddons" INTEGER NOT NULL DEFAULT 0;
