-- Existing and normally-created tasks and attachments remain business data.
-- Acceptance fixtures require a separately authorized, explicit ID-based classification.
ALTER TABLE operational_tasks
  ADD COLUMN data_origin text NOT NULL DEFAULT 'business'
  CONSTRAINT operational_tasks_data_origin_check
  CHECK (data_origin IN ('business', 'acceptance_test'));

ALTER TABLE onboarding_attachments
  ADD COLUMN data_origin text NOT NULL DEFAULT 'business'
  CONSTRAINT onboarding_attachments_data_origin_check
  CHECK (data_origin IN ('business', 'acceptance_test'));
