import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { randomUUID,createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '@tablenow/provider-adapters';
import { createTestDatabase } from './testing/pglite.js';
import { seedOwnerFixture,ownerEmail } from './testing/owner-fixture.js';
import { inRestaurant,readServiceContext } from './governed-copilot.js';
import type { AuthActor } from './types.js';
let app:FastifyInstance, db:Database, fixture:Awaited<ReturnType<typeof seedOwnerFixture>>,actor:AuthActor;
let headers:Record<string,string>;
beforeAll(async()=>{
  for(const [key,value] of Object.entries({NODE_ENV:'test',APP_ENV:'test',DATABASE_URL:'postgres://test:test@localhost/test',PUBLIC_ORIGIN:'http://localhost:3000',SESSION_SECRET:'s'.repeat(48),OTP_PEPPER:'p'.repeat(48),PLATFORM_ADMIN_EMAIL:'admin@tablenow.test',EMAIL_TRANSPORT:'log',AUTH_FIXED_OTP:'424242',LOG_LEVEL:'silent'}))vi.stubEnv(key,value);
  ({sql:db}=await createTestDatabase()); fixture=await seedOwnerFixture(db);
  actor={tenantId:fixture.tenantId,userId:fixture.userId,actorId:fixture.userId,actorType:'user',role:'owner',email:ownerEmail,displayName:'Test',tenantName:'Test',tenantSlug:'test',onboardingComplete:true,csrfHash:null};
  const {buildApp}=await import('./app.js');app=await buildApp({database:db,email:{send:async()=>undefined}});
  await app.inject({method:'POST',url:'/v1/auth/request-code',payload:{email:ownerEmail}});
  const login=await app.inject({method:'POST',url:'/v1/auth/verify-code',payload:{email:ownerEmail,code:'424242'}});
  expect(login.statusCode).toBe(200);
  headers={origin:'http://localhost:3000',cookie:login.cookies.map(c=>`${c.name}=${c.value}`).join('; '),'x-csrf-token':login.cookies.find(c=>c.name==='tn_csrf')!.value};
},60000);
afterAll(async()=>{await app?.close();await db?.end();vi.unstubAllEnvs();});
const post=(message:string,key=randomUUID())=>app.inject({method:'POST',url:'/v1/operating/chat',headers,payload:{restaurantId:fixture.restaurantId,message,idempotencyKey:key}});
describe('governed service foundations on real embedded PostgreSQL',()=>{
  it('preserves owner edits, role and completion when the Preview seed is replayed',async()=>{
    const {seed}=await import('./seed.js');
    await seed(db);
    const [lab]=await db<{id:string}[]>`select id from tenants where slug='tablenow-lab'`;
    expect(lab).toBeTruthy();
    await db`update restaurants set name='Nom confirmé par le propriétaire' where tenant_id=${lab!.id}`;
    await db`update users set display_name='Nom conservé' where email='admin@tablenow.test'`;
    await db`update memberships set role='owner' where tenant_id=${lab!.id}`;
    await db`update onboarding_profiles set completed_at='2026-09-10T12:00:00Z' where tenant_id=${lab!.id}`;
    await seed(db);
    expect((await db`select name from restaurants where tenant_id=${lab!.id}`)[0]!.name).toBe('Nom confirmé par le propriétaire');
    expect((await db`select display_name from users where email='admin@tablenow.test'`)[0]!.display_name).toBe('Nom conservé');
    expect((await db`select role from memberships where tenant_id=${lab!.id}`)[0]!.role).toBe('owner');
    expect(new Date(String((await db`select completed_at from onboarding_profiles where tenant_id=${lab!.id}`)[0]!.completed_at)).toISOString()).toContain('2026-09-10');
  });
  it('treats seeded completion as incomplete until a profile is finalized',async()=>{
    const session=await app.inject({method:'GET',url:'/v1/auth/session',headers});
    expect(session.json().tenant.onboardingComplete).toBe(false);
    expect((await app.inject({method:'GET',url:'/v1/onboarding',headers})).statusCode).toBe(200);
  });
  it('executes a service scenario, records evidence and deduplicates committed retries',async()=>{
    await db`insert into team_shifts(tenant_id,restaurant_id,team_member_name,role_title,starts_at,ends_at,status) values(${fixture.tenantId},${fixture.restaurantId},'Recette absence','Salle',now()-interval '1 hour',now()+interval '2 hours','absent')`;
    const key=randomUUID(),message='Service chargé : réservation modifiée, client en retard et absence en salle. Vérifions la capacité.';
    const first=await post(message,key);
    expect(first.statusCode,first.body).toBe(200);
    expect(first.json().report).toMatchObject({externalAction:false,specialists:['reservations','operations']});
    expect(first.json().report.conflicts.length).toBeGreaterThan(0);
    expect(first.json().answer).toContain('occupation simultanée');
    expect(first.json().report.uncertainties.join(' ')).toContain('retard');
    const replay=await post(message,key);
    expect(replay.json().runId).toBe(first.json().runId);
    expect(await db`select id from copilot_messages where run_id=${first.json().runId}`).toHaveLength(2);
    expect(await db`select run_id from copilot_contexts where run_id=${first.json().runId}`).toHaveLength(0);
    expect((await post('Message différent',key)).statusCode).toBe(409);
    const note={restaurantId:fixture.restaurantId,idempotencyKey:randomUUID(),kind:'decision',body:'Je maintiens les réservations et confirme la répartition des postes.'};
    for(let i=0;i<2;i++)expect((await app.inject({method:'POST',url:`/v1/operating/runs/${first.json().runId}/observations`,headers,payload:note})).json()).toEqual({saved:true,externalAction:false});
    expect(await db`select id from copilot_observations where run_id=${first.json().runId}`).toHaveLength(1);
    const history=await app.inject({method:'GET',url:`/v1/operating/runs?restaurantId=${fixture.restaurantId}`,headers});
    expect(history.json().runs[0].report.sources.length).toBeGreaterThan(0);
    expect(history.json().observations[0].body).toBe(note.body);
    expect(await db`select id from jobs where job_type='agent.execute'`).toHaveLength(0);
  });
  it('blocks private design/auth access, tenant and restaurant leakage, and common knowledge writes at SQL role level',async()=>{
    await db.unsafe("CREATE SCHEMA project_memory");
    await db.unsafe("CREATE TABLE project_memory.secret_design(value text)");
    await db.unsafe("INSERT INTO project_memory.secret_design VALUES ('PRIVATE DESIGN')");
    const [second]=await db<{id:string}[]>`insert into restaurants(tenant_id,name,slug,is_demo) values(${fixture.tenantId},'Other restaurant','other-isolation',false) returning id`;
    const [other]=await db<{id:string}[]>`insert into tenants(name,slug) values('Other tenant','other-isolation') returning id`;
    const [foreign]=await db<{id:string}[]>`insert into restaurants(tenant_id,name,slug,is_demo) values(${other!.id},'Foreign','foreign-isolation',false) returning id`;
    const seen=await inRestaurant(db,actor,fixture.restaurantId,async tx=>{await tx`set local role tablenow_context_reader`;return tx`select id from restaurants`;});
    expect(seen.map(r=>r.id)).toEqual([fixture.restaurantId]);
    for(const query of ['select * from project_memory.secret_design','select * from account_credentials',"insert into business_knowledge.records(topic,source_uri,source_date,version,body,status) values('operations','fixture:test',current_date,1,'Private data','candidate')"])
      await expect(inRestaurant(db,actor,fixture.restaurantId,async tx=>{await tx`set local role tablenow_context_reader`;return tx.unsafe(query);})).rejects.toThrow(/permission denied/);
    expect((await app.inject({method:'GET',url:`/v1/operating/runs?restaurantId=${foreign!.id}`,headers})).statusCode).toBe(404);
    expect((await app.inject({method:'GET',url:`/v1/operating/runs?restaurantId=${second!.id}`,headers})).json().runs).toEqual([]);
  });
  it('only retrieves current approved evaluated knowledge, never candidates or expired revisions',async()=>{
    await db`insert into business_knowledge.records(topic,source_uri,source_date,version,body,status,evaluation) values('operations','fixture:service-rule',current_date,1,'OLD','approved','synthetic evaluation'),('operations','fixture:service-rule',current_date,2,'CURRENT','approved','synthetic evaluation'),('operations','fixture:private-candidate',current_date,1,'UNREVIEWED','candidate',null)`;
    await db`insert into business_knowledge.records(topic,source_uri,source_date,version,body,status,evaluation,valid_from,valid_until) values('operations','fixture:expired',current_date,1,'EXPIRED','approved','synthetic evaluation',now()-interval '2 days',now()-interval '1 day')`;
    const context=await readServiceContext(db,actor,fixture.restaurantId);
    expect(context.knowledge.map(k=>k.body)).toEqual(['CURRENT']);
  });
  it('persists provider failure, resumes explicitly and fences concurrent duplicates',async()=>{
    const {buildApp}=await import('./app.js');
    let calls=0; const key=randomUUID();
    const modelApp=await buildApp({database:db,email:{send:async()=>undefined},model:{complete:async prompt=>{
      calls++;
      expect(JSON.stringify(prompt)).not.toContain('PRIVATE DESIGN');
      expect(Object.keys(prompt.context)).toEqual(['assessment','restaurantRules','knowledge']);
      if(calls===1)throw new Error('Provider error containing sensitive details');
      return {text:'Faire confirmer la capacité applicable.',model:'test-model',inputTokens:10,outputTokens:8,estimatedCostEur:0};
    }}});
    const payload={restaurantId:fixture.restaurantId,message:'Préparons le service après une panne',idempotencyKey:key};
    try{
      const failed=await modelApp.inject({method:'POST',url:'/v1/operating/chat',headers,payload});
      expect(failed.statusCode).toBe(503); expect(failed.body).not.toContain('sensitive');
      const retried=await modelApp.inject({method:'POST',url:'/v1/operating/chat',headers,payload});
      expect(retried.statusCode,retried.body).toBe(200);
      expect(retried.json().mode).toBe('ai');
      const [stored]=await db`select status,attempt from copilot_runs where request_key=${key}`;
      expect(stored).toMatchObject({status:'succeeded',attempt:2});
      await modelApp.inject({method:'POST',url:'/v1/operating/chat',headers,payload});
      expect(calls).toBe(2);
      expect(await db`select id from copilot_messages where run_id=${retried.json().runId}`).toHaveLength(2);
    }finally{await modelApp.close();}
    const expired=randomUUID(), text='Old interrupted run';
    const hash=createHash('sha256').update(text).digest('hex');
    await db`insert into copilot_runs(tenant_id,restaurant_id,user_id,request_key,input_hash,message,lease_until) values(${fixture.tenantId},${fixture.restaurantId},${fixture.userId},${expired},${hash},${text},now()-interval '1 minute')`;
    expect((await post(text,expired)).statusCode).toBe(200);
    const [resumed]=await db`select attempt,status from copilot_runs where request_key=${expired}`;
    expect(resumed).toMatchObject({attempt:2,status:'succeeded'});
    const active=randomUUID();
    await db`insert into copilot_runs(tenant_id,restaurant_id,user_id,request_key,input_hash,message) values(${fixture.tenantId},${fixture.restaurantId},${fixture.userId},${active},${hash},${text})`;
    expect((await post(text,active)).json().error.code).toBe('COPILOT_RUNNING');
    await db`update copilot_runs set status='failed',attempt=3 where request_key=${active}`;
    expect((await post(text,active)).json().error.code).toBe('COPILOT_ATTEMPTS_EXHAUSTED');
  });
  it('rejects unauthenticated, unprivileged and cross-user requests',async()=>{
    expect((await app.inject({method:'POST',url:'/v1/operating/chat',payload:{}})).statusCode).toBe(401);
    expect((await app.inject({method:'POST',url:'/v1/operating/chat',headers:{cookie:headers.cookie!},payload:{}})).statusCode).toBe(403);
    await db`update memberships set role='viewer' where tenant_id=${fixture.tenantId} and user_id=${fixture.userId}`;
    try{expect((await post('Préparons le service')).statusCode).toBe(403);}finally{await db`update memberships set role='owner' where tenant_id=${fixture.tenantId} and user_id=${fixture.userId}`;}
  });
});
