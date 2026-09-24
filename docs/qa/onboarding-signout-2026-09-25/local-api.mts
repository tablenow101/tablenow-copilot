import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../../../services/core-api/src/testing/pglite.ts';
Object.assign(process.env,{NODE_ENV:'test',APP_ENV:'test',DATABASE_URL:'postgres://test:test@localhost/test',PUBLIC_ORIGIN:'http://localhost:3102',SESSION_SECRET:randomBytes(32).toString('hex'),OTP_PEPPER:randomBytes(32).toString('hex'),PLATFORM_ADMIN_EMAIL:'admin@tablenow.test',EMAIL_TRANSPORT:'smtp',SMTP_HOST:'test.invalid',SMTP_USER:'fixture',SMTP_PASSWORD:'fixture',AI_PROVIDER:'deterministic',LOG_LEVEL:'silent',GOOGLE_OAUTH_CLIENT_ID:'fixture.apps.googleusercontent.com',GOOGLE_OAUTH_CLIENT_SECRET:'fixture-only'});
const {sql}=await createTestDatabase();
const inbox=new Map<string,{text:string;html:string}>();
const {buildApp}=await import('../../../services/core-api/src/app.ts');
const {seal}=await import('../../../services/core-api/src/account-crypto.ts');
const app=await buildApp({database:sql,email:{send:async m=>{if(!m.to.endsWith('@tablenow.test')) throw new Error('Only local fixtures allowed');inbox.set(m.to,{text:m.text,html:m.html});}}});
app.get('/__test/inbox/:email',async(req,reply)=>{const email=(req.params as {email:string}).email;reply.header('cache-control','no-store');return inbox.get(email)||{};});
const password=randomBytes(18).toString('hex');
await writeFile('/private/tmp/tn-otp-replacement-fixture.json',JSON.stringify({password}),{mode:0o600});
for(const device of ['mobile','desktop']){
 const email=`existing-${device}@tablenow.test`;
 const signup=await app.inject({method:'POST',url:'/v1/account/signup',payload:{email,password},headers:{origin:'http://localhost:3102'}});
 const cookie=signup.cookies.filter(c=>c.value).map(c=>`${c.name}=${c.value}`).join('; ');
 const code=inbox.get(email)!.text.match(/\b\d{6}\b/)![0];
 const verified=await app.inject({method:'POST',url:'/v1/account/verify-email',payload:{code},headers:{cookie,origin:'http://localhost:3102'}});
 if(verified.statusCode!==200) throw new Error('Fixture creation failed');
 await sql`update account_credentials set totp_secret=${seal('historic-private-local-fixture',process.env.SESSION_SECRET!)} where user_id in(select id from users where email=${email})`;
}
await app.listen({host:'127.0.0.1',port:4105});
console.log('Isolated OTP recipe ready: local database, local mailbox, no external messages.');
process.on('SIGINT',()=>{void app.close().then(()=>sql.end());});
