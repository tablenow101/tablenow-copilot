-- Preserve every existing conversation. Classification of acceptance fixtures is
-- a separate authorized operation using explicit tenant/user/restaurant/run IDs.
ALTER TABLE copilot_runs
  ADD COLUMN data_origin text NOT NULL DEFAULT 'business'
  CONSTRAINT copilot_runs_data_origin_check
  CHECK (data_origin IN ('business', 'acceptance_test'));

-- Stored independently so the restricted context reader needs no access to runs.
ALTER TABLE copilot_messages
  ADD COLUMN data_origin text NOT NULL DEFAULT 'business'
  CONSTRAINT copilot_messages_data_origin_check
  CHECK (data_origin IN ('business', 'acceptance_test'));
