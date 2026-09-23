ALTER TABLE account_challenges
  DROP CONSTRAINT account_challenges_stage_check;

ALTER TABLE account_challenges
  ADD CONSTRAINT account_challenges_stage_check
  CHECK (stage IN ('email', 'profile', 'enroll', 'mfa'));
