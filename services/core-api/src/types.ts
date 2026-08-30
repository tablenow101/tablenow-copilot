import type { Role } from "@tablenow/contracts";

export interface AuthActor {
  actorType: "user" | "node";
  actorId: string;
  userId: string | null;
  tenantId: string;
  role: Role;
  email: string | null;
  displayName: string | null;
  tenantName: string;
  tenantSlug: string;
  onboardingComplete: boolean;
  csrfHash: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    actor: AuthActor | null;
  }
}
