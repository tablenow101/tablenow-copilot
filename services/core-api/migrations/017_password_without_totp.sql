-- Keep every existing factor intact; allow a verified password account without mandatory enrollment.
ALTER TABLE account_credentials ALTER COLUMN totp_secret DROP NOT NULL;
