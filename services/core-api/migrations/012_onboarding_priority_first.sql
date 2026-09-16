ALTER TABLE onboarding_drafts
  ALTER COLUMN current_section SET DEFAULT 'priorities';

UPDATE onboarding_drafts
SET current_section = 'priorities'
WHERE status = 'draft'
  AND current_section = 'establishment'
  AND confirmed_sections = '{}'::text[];
