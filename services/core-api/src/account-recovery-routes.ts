import type { FastifyInstance } from "fastify";

/** Retire app-code recovery operations without deleting historic recovery hashes. */
export async function registerAccountRecoveryRoutes(app: FastifyInstance) {
  for (const action of ["replace", "read", "acknowledge"]) {
    app.post(`/v1/account/backup-codes/${action}`, async (_request, reply) => reply.code(410).send({
      error: { code: "ACCOUNT_METHOD_CHANGED", message: "Recommencez la connexion pour recevoir un code par e-mail." },
    }));
  }
}
