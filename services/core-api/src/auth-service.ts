import type { Database, EmailSender, Transaction } from "@tablenow/provider-adapters";
import { accessCodeEmail, constantTimeEqual, hashSecret, randomDigits, randomToken } from "@tablenow/provider-adapters";
import { getConfig } from "./environment.js";

interface AccessTarget {
  tenantId: string;
  purpose: "sign_in" | "invite_acceptance";
}

export interface VerifiedSession {
  sessionToken: string;
  csrfToken: string;
  maxAgeSeconds: number;
  tenantId: string;
  userId: string;
}

export class AuthService {
  public constructor(
    private readonly database: Database,
    private readonly email: EmailSender,
  ) {}

  public async requestCode(email: string, tenantSlug?: string): Promise<void> {
    const config = getConfig();
    const target = await this.findAccessTarget(email, tenantSlug);
    if (!target) return;

    const code = config.AUTH_FIXED_OTP || randomDigits(6);
    const expiresAt = new Date(Date.now() + config.OTP_TTL_MINUTES * 60_000);
    const codeHash = hashSecret(`${email}:${code}`, config.OTP_PEPPER);
    await this.database.begin(async (transaction) => {
      await transaction`
        update otp_challenges set consumed_at = now()
        where email = ${email} and consumed_at is null
      `;
      await transaction`
        insert into otp_challenges (tenant_id, email, code_hash, purpose, expires_at)
        values (${target.tenantId}, ${email}, ${codeHash}, ${target.purpose}, ${expiresAt})
      `;
    });

    const message = accessCodeEmail(code, config.OTP_TTL_MINUTES);
    await this.email.send({ to: email, ...message });
  }

  public async verifyCode(
    email: string,
    code: string,
    context: { ip: string; userAgent: string | undefined },
  ): Promise<VerifiedSession> {
    const config = getConfig();
    const candidateHash = hashSecret(`${email}:${code}`, config.OTP_PEPPER);
    const sessionToken = randomToken();
    const csrfToken = randomToken(24);
    const tokenHash = hashSecret(sessionToken, config.SESSION_SECRET);
    const csrfHash = hashSecret(csrfToken, config.SESSION_SECRET);
    const maxAgeSeconds = config.SESSION_TTL_HOURS * 60 * 60;
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
    const ipHash = hashSecret(context.ip, config.SESSION_SECRET);

    return this.database.begin(async (transaction) => {
      const [challenge] = await transaction<{
        id: string;
        tenant_id: string | null;
        code_hash: string;
        attempts: number;
        purpose: "sign_in" | "invite_acceptance";
      }[]>`
        select id, tenant_id, code_hash, attempts, purpose
        from otp_challenges
        where email = ${email} and consumed_at is null and expires_at > now()
        order by created_at desc
        limit 1
        for update
      `;
      if (!challenge || !challenge.tenant_id || challenge.attempts >= 5 || !constantTimeEqual(challenge.code_hash, candidateHash)) {
        if (challenge) await transaction`update otp_challenges set attempts = attempts + 1 where id = ${challenge.id}`;
        throw new Error("INVALID_CODE");
      }
      await transaction`update otp_challenges set consumed_at = now() where id = ${challenge.id}`;

      const [existingUser] = await transaction<{ id: string }[]>`
        select id from users where email = ${email} and status = 'active'
      `;
      let userId = existingUser?.id;
      if (!userId) {
        const [created] = await transaction<{ id: string }[]>`
          insert into users (email) values (${email}) returning id
        `;
        userId = created?.id;
      }
      if (!userId) throw new Error("USER_CREATE_FAILED");

      if (challenge.purpose === "invite_acceptance") {
        const [invitation] = await transaction<{ id: string; role: string }[]>`
          select id, role from invitations
          where tenant_id = ${challenge.tenant_id} and email = ${email}
            and status = 'pending' and expires_at > now()
          order by created_at desc limit 1 for update
        `;
        if (!invitation) throw new Error("INVITATION_EXPIRED");
        await transaction`
          insert into memberships (tenant_id, user_id, role)
          values (${challenge.tenant_id}, ${userId}, ${invitation.role})
          on conflict (tenant_id, user_id) do update set role = excluded.role
        `;
        await transaction`
          update invitations set status = 'accepted', accepted_at = now() where id = ${invitation.id}
        `;
      }

      const [membership] = await transaction<{ role: string }[]>`
        select role from memberships where tenant_id = ${challenge.tenant_id} and user_id = ${userId}
      `;
      if (!membership) throw new Error("ACCESS_REVOKED");

      await transaction`
        insert into sessions (token_hash, user_id, tenant_id, csrf_hash, ip_hash, user_agent, expires_at)
        values (${tokenHash}, ${userId}, ${challenge.tenant_id}, ${csrfHash}, ${ipHash}, ${context.userAgent || null}, ${expiresAt})
      `;
      await transaction`update users set last_login_at = now() where id = ${userId}`;
      await transaction`
        insert into privacy_preferences (tenant_id, user_id)
        values (${challenge.tenant_id}, ${userId})
        on conflict (tenant_id, user_id) do nothing
      `;
      await audit(transaction, challenge.tenant_id, userId, "auth.signed_in", "session", tokenHash.slice(0, 12));
      return { sessionToken, csrfToken, maxAgeSeconds, tenantId: challenge.tenant_id, userId };
    }) as Promise<VerifiedSession>;
  }

  public async revokeSession(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    const config = getConfig();
    const tokenHash = hashSecret(sessionToken, config.SESSION_SECRET);
    await this.database`delete from sessions where token_hash = ${tokenHash}`;
  }

  private async findAccessTarget(email: string, tenantSlug?: string): Promise<AccessTarget | null> {
    const [invitation] = await this.database<{ tenant_id: string }[]>`
      select i.tenant_id
      from invitations i
      join tenants t on t.id = i.tenant_id
      where i.email = ${email} and i.status = 'pending' and i.expires_at > now()
        and (${tenantSlug || null}::text is null or t.slug = ${tenantSlug || null})
      order by i.created_at desc limit 1
    `;
    if (invitation) return { tenantId: invitation.tenant_id, purpose: "invite_acceptance" };

    const [membership] = await this.database<{ tenant_id: string }[]>`
      select m.tenant_id
      from memberships m
      join users u on u.id = m.user_id and u.status = 'active'
      join tenants t on t.id = m.tenant_id and t.status in ('pilot', 'active')
      where u.email = ${email}
        and (${tenantSlug || null}::text is null or t.slug = ${tenantSlug || null})
      order by m.created_at desc limit 1
    `;
    return membership ? { tenantId: membership.tenant_id, purpose: "sign_in" } : null;
  }
}

async function audit(
  transaction: Transaction,
  tenantId: string,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await transaction`
    insert into audit_events (tenant_id, actor_id, actor_type, action, resource_type, resource_id)
    values (${tenantId}, ${actorId}, 'user', ${action}, ${resourceType}, ${resourceId})
  `;
}
