import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { newTotpSecret, passwordHash, seal, totpAt } from "./account-crypto.js";
import { createTestDatabase } from "./testing/pglite.js";
let app: FastifyInstance;
let db: Database;
let n = 1;
const inbox: Array<{ to: string; text: string }> = [];
const cookies = (r: { cookies: { name: string; value: string }[] }) => r.cookies.filter(c => c.value).map(c => `${c.name}=${c.value}`).join("; ");
const post = (path: string, payload: object, cookie = "") => app.inject({ method: "POST", url: `/v1/account/${path}`, payload, headers: { cookie, origin: "http://localhost:3000" }, remoteAddress: `127.2.0.${n++}` });
function proof(email: string) {
  const link = inbox.findLast(m => m.to === email)!.text.match(/http:\/\/localhost:3000\/verify-email#[^\s]+/)![0];
  const fragment = new URLSearchParams(new URL(link).hash.slice(1));
  return { challenge: fragment.get("challenge"), code: fragment.get("code") };
}
beforeAll(async () => {
  for (const [key,value] of Object.entries({NODE_ENV:"test",APP_ENV:"test",DATABASE_URL:"postgres://test:test@localhost/test",PUBLIC_ORIGIN:"http://localhost:3000",SESSION_SECRET:"s".repeat(48),OTP_PEPPER:"p".repeat(48),PLATFORM_ADMIN_EMAIL:"admin@tablenow.test",EMAIL_TRANSPORT:"smtp",SMTP_HOST:"test.invalid",SMTP_USER:"test",SMTP_PASSWORD:"test",LOG_LEVEL:"silent"})) vi.stubEnv(key,value);
  ({sql:db}=await createTestDatabase());
  const { buildApp }=await import("./app.js");
  app=await buildApp({ database:db,email:{send:async m=>{inbox.push(m);}} });
},60_000);
afterAll(async()=>{await app?.close();await db?.end();vi.unstubAllEnvs();});
it("registers without a name through a single-use link, including in a different browser, then accepts the password",async()=>{
 const email="split-new@tablenow.test",password="Une phrase de test 2026!";
 const start=await post("signup",{email,password,delivery:"link"});
 expect(start.statusCode,start.body).toBe(202);
 expect((await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(start)}})).statusCode).toBe(401);
 const credentials=proof(email);
 const confirmed=await post("verify-email",credentials);
 expect(confirmed.statusCode,confirmed.body).toBe(200);
 expect(confirmed.json()).toEqual({authenticated:true});
 const session=await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(confirmed)}});
 expect(session.json().tenant.onboardingComplete).toBe(false);
 expect((await post("verify-email",credentials)).statusCode).toBe(400);
 expect((await post("login",{email,password:"incorrect"})).statusCode).toBe(400);
 const login=await post("login",{email,password});
 expect(login.json()).toEqual({authenticated:true});
 const resumed=await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(login)}});
 expect(resumed.json().user.id).toBe(session.json().user.id);
});
it("never creates an account from passwordless login and rejects expired links", async()=>{
 const email="unknown-login@tablenow.test";
 const start=await post("access",{email});
 const code=inbox.findLast(m=>m.to===email)!.text.match(/\b\d{6}\b/)![0];
 expect((await post("verify-email",{code},cookies(start))).json().error.code).toBe("ACCOUNT_SIGNUP_REQUIRED");
 expect(await db`select id from users where email=${email}`).toHaveLength(0);
 const exp="expired-link@tablenow.test";
 await post("signup",{email:exp,password:"Une phrase de test 2026!",delivery:"link"});
 await db`update account_challenges set expires_at=now()-interval '1 second' where email=${exp}`;
 expect((await post("verify-email",proof(exp))).statusCode).toBe(410);
});
it("guides a verified unknown login to signup without revealing account existence before the proof", async()=>{
 const email="verified-unknown@tablenow.test";
 const start=await post("login",{email});
 expect(start.statusCode).toBe(202);
 const code=inbox.findLast(m=>m.to===email)!.text.match(/\b\d{6}\b/)![0];
 const cookie=cookies(start);
 const wrong=await post("verify-email",{code:"invalid"},cookie);
 expect(wrong.json().error.code).toBe("ACCOUNT_CODE_INVALID");
 const verified=await post("verify-email",{code},cookie);
 expect(verified.statusCode).toBe(409);
 expect(verified.json().error.code).toBe("ACCOUNT_SIGNUP_REQUIRED");
 expect(verified.cookies.some(c=>c.name==="tn_session"&&c.value)).toBe(false);
 expect(await db`select id from users where email=${email}`).toHaveLength(0);
 const [challenge]=await db`select attempts,consumed_at is not null as consumed from account_challenges where email=${email}`;
 expect(challenge).toMatchObject({attempts:2,consumed:true});
 expect((await post("verify-email",{code},cookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
});
it("changes a password only after a fresh reset link and revokes older sessions",async()=>{
 const email="split-new@tablenow.test",password="Une phrase remplacee 2026!";
 const old=await post("login",{email,password:"Une phrase de test 2026!"});
 const reset=await post("reset",{email,password,delivery:"link"});
 expect(reset.statusCode).toBe(202);
 expect((await post("login",{email,password})).statusCode).toBe(400);
 const verified=await post("verify-email",proof(email));
 expect(verified.json()).toEqual({authenticated:true});
 expect((await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(old)}})).statusCode).toBe(401);
 expect((await post("login",{email,password})).json()).toEqual({authenticated:true});
});

it("accepts the reset mailbox proof once without an additional app code",async()=>{
 const {seedOwnerFixture}=await import("./testing/owner-fixture.js");
 const owner=await seedOwnerFixture(db),email="protected-link@tablenow.test",secret=newTotpSecret();
 await db`update users set email=${email} where id=${owner.userId}`;
 await db`insert into account_credentials(user_id,password_hash,totp_secret) values (${owner.userId},${await passwordHash("Ancienne phrase de test 2026!")},${seal(secret,"s".repeat(48))})`;
 const password="Nouvelle phrase de test 2026!";
 await post("reset",{email,password,delivery:"link"});
 const verified=await post("verify-email",proof(email));
 expect(verified.json()).toEqual({authenticated:true});
 expect((await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(verified)}})).statusCode).toBe(200);
 expect((await post("verify-email",proof(email))).statusCode).toBe(400);
 expect((await post("login",{email,password})).json().stage).toBe("email");
});

it("replaces the existing Authenticator check with an email code only for a protected login",async()=>{
 const email="returning-otp@tablenow.test",password="Une phrase de test 2026!";
 await post("signup",{email,password,delivery:"link"});
 const signup=await post("verify-email",proof(email));
 const session=await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(signup)}});
 await db`update account_credentials set totp_secret=${seal(newTotpSecret(),"s".repeat(48))} where user_id=${session.json().user.id}`;
 const login=await post("login",{email,password});
 expect(login.statusCode).toBe(202);
 expect(login.json().stage).toBe("email");
 expect(cookies(login)).not.toContain("tn_session");
 const code=inbox.findLast(m=>m.to===email)!.text.match(/\b\d{6}\b/)![0];
 const verified=await post("verify-email",{code},cookies(login));
 expect(verified.json()).toEqual({authenticated:true});
 expect((await app.inject({url:"/v1/auth/session",headers:{cookie:cookies(verified)}})).statusCode).toBe(200);
});
