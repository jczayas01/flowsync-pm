-- Which forecasting assumption a project's EAC uses.
-- CPI          = BAC / CPI                       (current performance continues)
-- PLANNED      = AC + (BAC - EV)                 (the variance was a one-off)
-- CPI_SPI      = AC + (BAC - EV) / (CPI * SPI)   (schedule pressure keeps costing)
-- MANUAL       = AC + a re-estimate entered by the PM
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "eacMethod" TEXT DEFAULT 'CPI';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "eacManualEtc" DECIMAL(15,2);
