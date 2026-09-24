import { expect, it } from "vitest";
import Fastify from "fastify";
import { registerAccountRecoveryRoutes } from "./account-recovery-routes.js";
it("retires every legacy recovery endpoint with a clear transition response", async()=>{
 const app=Fastify();
 await registerAccountRecoveryRoutes(app);
 for(const action of ["read","replace","acknowledge"]) {
  const response=await app.inject({method:"POST",url:`/v1/account/backup-codes/${action}`,payload:{}});
  expect(response.statusCode).toBe(410);
  expect(response.json().error.code).toBe("ACCOUNT_METHOD_CHANGED");
 }
 await app.close();
});
