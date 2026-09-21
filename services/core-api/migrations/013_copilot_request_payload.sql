-- Preserve the exact optional input used by an idempotent conversation request.
-- No document contents, credentials, existing messages or reports are rewritten.
ALTER TABLE copilot_runs ADD COLUMN request_payload jsonb;
ALTER TABLE copilot_runs ADD CONSTRAINT copilot_runs_request_payload_shape
  CHECK (request_payload IS NULL OR (
    jsonb_typeof(request_payload) = 'object'
    AND jsonb_typeof(request_payload->'attachmentIds') = 'array'
  ));
