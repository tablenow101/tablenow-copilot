# Security policy

Report vulnerabilities privately to `security@tablenow.io`. Do not open a public issue containing credentials, personal data, tenant identifiers or exploit details.

## Baseline controls

- Passwordless codes are short-lived, hashed with a deployment-specific pepper, single-use and rate-limited.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` outside local development.
- Mutating browser requests require a double-submit CSRF token and an allowed origin.
- Every business record carries `tenant_id`; repositories scope queries and PostgreSQL RLS adds defense in depth.
- Copilot tools never write directly to PostgreSQL. Sensitive actions require explicit human approval and are audited.
- Secrets are runtime environment variables. They are never compiled into browser bundles.
- Production refuses fixed OTPs, weak secrets, wildcard origins and demo-mode configuration.

## Supported pilot branch

Security updates are applied to `main`. Local customer nodes receive signed container releases after pilot acceptance; automatic unattended updates are disabled by default.
