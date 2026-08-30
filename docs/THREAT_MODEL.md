# Threat model

| Threat | Boundary | Primary controls | Residual action |
| --- | --- | --- | --- |
| Stolen sign-in code | Email ↔ API | 10-minute OTP, five attempts, rate limiting, constant-time hash comparison | require secure mailbox and revoke sessions |
| Cross-tenant access | API ↔ PostgreSQL | tenant-scoped repository, forced RLS, non-superuser application role, tests | add database integration tests in hosted CI |
| CSRF/session theft | Browser ↔ API | HttpOnly session, double-submit CSRF, origin check, SameSite, HTTPS Secure cookies | rotate secrets after compromise |
| Prompt/tool abuse | Model ↔ operations | policy harness, typed tools, human approval, role checks, idempotency, audit | evaluate each new tool before enabling |
| MCP bypass | MCP ↔ product | bearer-scoped node identity; MCP calls API only | rotate per-node token and restrict process access |
| Lost restaurant node | Physical host | local credentials, recommended full-disk encryption, backups | client must secure hardware and revoke node token |
| Compromised provider | Optional cloud adapter | disabled by default, interchangeable adapters, minimization, DPA/register | vendor and transfer assessment |
| Destructive update | Deployment ↔ data | immutable migrations, checksum, automatic pre-update backup, restore runbook | recovery drills |

Out of scope for the initial pilot: payment card processing, biometric identity, autonomous HR decisions and public self-registration.
