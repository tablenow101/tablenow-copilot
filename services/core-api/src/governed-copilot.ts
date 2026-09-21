import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { withTenant, type Database, type Transaction, type ModelProvider } from '@tablenow/provider-adapters';
import { assessService, serviceAssessmentText, type ServiceContext, type ServiceAssessment } from '@tablenow/agent-runtime';
import { authGuard } from './auth.js';
import type { AuthActor } from './types.js';
import { getConfig } from './environment.js';
import { conversationSurfaceSchema, conversationPrompt, readConversationDetails, type ConversationDetails } from './copilot-conversation.js';
import { readPrivateAttachment, type ExtractedAttachment } from './attachment-content.js';

type Run = { id: string; input_hash: string; status: string; attempt: number; lease_until: Date; answer: string | null; mode: string | null; report: ServiceAssessment | null; request_payload: ReplayRequest | null };
const requestSchema = z.object({restaurantId:z.uuid(),message:z.string().trim().min(2).max(4000),idempotencyKey:z.uuid().optional(),attachmentIds:z.array(z.uuid()).max(3).refine(ids=>new Set(ids).size===ids.length).optional(),context:conversationSurfaceSchema.optional()}).strict();
const observationSchema = z.object({restaurantId:z.uuid(),idempotencyKey:z.uuid(),kind:z.enum(['decision','outcome']),body:z.string().trim().min(2).max(2000)}).strict();
const fingerprint = (s:string) => createHash('sha256').update(s).digest('hex');
type ReplayRequest = { attachmentIds: string[]; context?: z.infer<typeof conversationSurfaceSchema> };
function requestFingerprint(message: string, request: ReplayRequest): string {
  // The historical message-only request and the dashboard default are equivalent.
  const defaultContext = !request.context || (request.context.surface === 'dashboard' && !request.context.step);
  return fingerprint(!request.attachmentIds.length && defaultContext ? message : JSON.stringify([message, request.attachmentIds, request.context ?? null]));
}


export async function inRestaurant<T>(database:Database, actor:AuthActor, restaurantId:string, callback:(tx:Transaction)=>Promise<T>):Promise<T> {
  if (!actor.userId || actor.actorType !== 'user') throw new Error('USER_REQUIRED');
  return withTenant(database,actor.tenantId,async tx=>{
    await tx`select set_config('app.restaurant_id',${restaurantId},true), set_config('app.user_id',${actor.userId},true), set_config('app.platform_admin','false',true)`;
    const [restaurant] = await tx`select id from restaurants where tenant_id=${actor.tenantId} and id=${restaurantId}`;
    if (!restaurant) throw new Error('RESTAURANT_NOT_FOUND');
    return callback(tx);
  });
}
export async function readServiceContext(database:Database,actor:AuthActor,restaurantId:string):Promise<ServiceContext & ConversationDetails> {
  return inRestaurant(database,actor,restaurantId,async tx=>{
    await tx`set local role tablenow_context_reader`;
    const [restaurant]=await tx<ServiceContext['restaurant'][]>`select id,name,timezone,capacity,is_demo from restaurants where tenant_id=${actor.tenantId} and id=${restaurantId}`;
    if (!restaurant) throw new Error('RESTAURANT_NOT_FOUND');
    const reservations=await tx<ServiceContext['reservations']>`select id,party_size,starts_at,status,updated_at from reservations where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and (starts_at at time zone ${restaurant.timezone})::date=(now() at time zone ${restaurant.timezone})::date order by starts_at,id limit 501`;
    if(reservations.length>500) throw new Error('CONTEXT_TOO_LARGE');
    const shifts=await tx<ServiceContext['shifts']>`select id,status,starts_at,ends_at from team_shifts where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and (starts_at at time zone ${restaurant.timezone})::date <= (now() at time zone ${restaurant.timezone})::date and (ends_at at time zone ${restaurant.timezone})::date >= (now() at time zone ${restaurant.timezone})::date order by starts_at limit 501`;
    if(shifts.length>500) throw new Error('CONTEXT_TOO_LARGE');
    const decisions=await tx<ServiceContext['decisions']>`select id,title,description,priority from decisions where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and status='open' order by case priority when 'critical' then 0 when 'high' then 1 else 2 end,created_at limit 8`;
    const tasks=await tx<ServiceContext['tasks']>`select id,title,status from operational_tasks where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and data_origin='business' and category!='supplier' and status in ('open','in_progress') order by created_at limit 10`;
    const layout=await tx<{id:string;capacity:number}[]>`select id,maximum_party_size as capacity from dining_tables where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and active order by id`;
    const restaurantRules=await tx<ServiceContext['restaurantRules']>`select id,confirmed_facts,unknown_fields from onboarding_first_results where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} order by created_at desc limit 1`;

    const knowledge=await tx<ServiceContext['knowledge']>`select id,topic,source_uri,version,body from business_knowledge.records where status='approved' and valid_from<=now() and (valid_until is null or valid_until>now()) and topic in ('reservations','operations','analysis') and not exists (select 1 from business_knowledge.records newer where newer.source_uri=records.source_uri and newer.version>records.version and newer.status='approved' and newer.valid_from<=now() and (newer.valid_until is null or newer.valid_until>now())) order by source_date desc limit 8`;
    const capacity=layout.reduce((sum,t)=>sum+t.capacity,0);
    const conversation = await readConversationDetails(tx, actor, restaurantId);
    return {restaurant,observedAt:new Date().toISOString(),reservations,shifts,decisions,tasks,profile:capacity>0?{capacity}:null,layoutSources:layout.map(t=>t.id),restaurantRules,knowledge,...conversation};
  });
}

export function registerGovernedCopilot(app:FastifyInstance,database:Database,model?:ModelProvider) {
  app.post('/v1/operating/chat',{preHandler:authGuard(database,'copilot.propose'),config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async request=>{
    const input=requestSchema.parse(request.body), actor=request.actor!;
    const key=input.idempotencyKey ?? randomUUID();
    const replayRequest: ReplayRequest = { attachmentIds: input.attachmentIds ?? [], ...(input.context ? { context: input.context } : {}) };
    const hash=requestFingerprint(input.message,replayRequest);
    const run=await inRestaurant(database,actor,input.restaurantId,async tx=>{
      await tx`delete from copilot_contexts where tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and expires_at<=now()`;
      const [created]=await tx<Run[]>`insert into copilot_runs(tenant_id,restaurant_id,user_id,request_key,input_hash,message,request_payload) values(${actor.tenantId},${input.restaurantId},${actor.userId},${key},${hash},${input.message},${tx.json(replayRequest)}) on conflict(tenant_id,restaurant_id,user_id,request_key) do nothing returning *`;
      if(created)return created;
      const [existing]=await tx<Run[]>`select * from copilot_runs where tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and request_key=${key} and data_origin='business' for update`;
      if(!existing)throw new Error('NOT_FOUND');
      if(existing.input_hash!==hash)throw new Error('COPILOT_KEY_CONFLICT');
      if(existing.status==='succeeded')return existing;
      if(existing.status==='running' && new Date(existing.lease_until)>new Date())throw new Error('COPILOT_RUNNING');
      if(existing.attempt>=3)throw new Error('COPILOT_ATTEMPTS_EXHAUSTED');
      const [resumed]=await tx<Run[]>`update copilot_runs set status='running',attempt=attempt+1,lease_until=now()+interval '45 seconds',error_code=null,updated_at=now() where id=${existing.id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and data_origin='business' returning *`;
      return resumed!;
    });
    if(run.status==='succeeded')return {saved:true,answer:run.answer,mode:run.mode,runId:run.id,report:run.report};
    try {
      const context=await readServiceContext(database,actor,input.restaurantId);
      const report=assessService(input.message,context);
      const documents: ExtractedAttachment[] = [];
      for (const id of input.attachmentIds ?? []) {
        const file = await readPrivateAttachment(database, actor, id);
        if (!file) throw new Error('COPILOT_ATTACHMENT_UNAVAILABLE');
        if (file.extraction.status !== 'extracted') throw new Error('COPILOT_ATTACHMENT_UNREADABLE');
        documents.push(file);
        report.sources.push({id:`document:${file.id}`,label:`Document fourni : ${file.name}`});
        if (file.extraction.truncated) report.uncertainties.push(`${file.name} : seuls les 12 000 premiers caractères sont disponibles ; la suite n’a pas été analysée.`);
      }
      if (documents.length && !model) throw new Error('COPILOT_AI_NOT_CONFIGURED');
      await inRestaurant(database,actor,input.restaurantId,async tx=>{
        const [current] = await tx`select id from copilot_runs where id=${run.id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and data_origin='business' and status='running' and attempt=${run.attempt} and lease_until>now() for update`;
        if(!current)throw new Error('COPILOT_LEASE_EXPIRED');
        await tx`insert into copilot_contexts(run_id,tenant_id,restaurant_id,user_id,payload) values(${run.id},${actor.tenantId},${input.restaurantId},${actor.userId},${tx.json(JSON.parse(JSON.stringify(context)))}) on conflict(run_id) do update set payload=excluded.payload,expires_at=now()+interval '15 minutes'`;
      });
      let answer=serviceAssessmentText(report), mode='summary';
      if(model) {
        const config=getConfig();
        await withTenant(database,actor.tenantId,async tx=>{
          await tx`select pg_advisory_xact_lock(hashtext(${`ai-budget:${actor.tenantId}`}))`;
          const [used]=await tx<{cost:number}[]>`select estimated_cost_eur::float8 as cost from agent_usage_daily where tenant_id=${actor.tenantId} and usage_date=current_date`;
          if((used?.cost??0)+0.01>config.AI_MAX_DAILY_EUR)throw new Error('AI_DAILY_BUDGET_EXCEEDED');
          await tx`insert into agent_usage_daily(tenant_id,estimated_cost_eur) values(${actor.tenantId},0.01) on conflict(tenant_id,usage_date) do update set estimated_cost_eur=agent_usage_daily.estimated_cost_eur+0.01`;
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const result=await Promise.race([model.complete(conversationPrompt({message:input.message,service:context,report,details:context,documents,...(input.context ? {surface:input.context} : {})})),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('COPILOT_TIMEOUT')),30000);})]);
          // A draft generated by a model never replaces the authoritative calculations.
          if(!result.text.trim() || /(?:j'ai|nous avons)\s+(?:envoyé|réservé|modifié|connecté)/i.test(result.text))throw new Error('COPILOT_OUTPUT_REJECTED');
          answer=[result.text.slice(0,4500),...(documents.length ? [`Documents fournis à cette réponse : ${documents.map(file=>`${file.name}${file.extraction.truncated ? ' (extrait partiel)' : ''}`).join(', ')}. Informations à confirmer par vous.`] : []),"Aucune action externe n’a été exécutée."].join('\n\n'); mode='ai';
          await withTenant(database,actor.tenantId,async tx=>{await tx`update agent_usage_daily set estimated_cost_eur=estimated_cost_eur+${result.estimatedCostEur === null ? 0 : Math.max(0,result.estimatedCostEur-0.01)},input_tokens=input_tokens+${result.inputTokens ?? 0},output_tokens=output_tokens+${result.outputTokens ?? 0} where tenant_id=${actor.tenantId} and usage_date=current_date`;});
        } finally {if(timer)clearTimeout(timer);}
      }
      await inRestaurant(database,actor,input.restaurantId,async tx=>{
        const [saved]=await tx`update copilot_runs set status='succeeded',report=${tx.json(JSON.parse(JSON.stringify(report)))},answer=${answer},mode=${mode},updated_at=now() where id=${run.id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and data_origin='business' and status='running' and attempt=${run.attempt} and lease_until>now() returning id`;
        if(!saved)throw new Error('COPILOT_LEASE_EXPIRED');
        await tx`insert into copilot_messages(tenant_id,restaurant_id,user_id,role,body,mode,run_id,created_at) values(${actor.tenantId},${input.restaurantId},${actor.userId},'user',${input.message},'user',${run.id},now()),(${actor.tenantId},${input.restaurantId},${actor.userId},'assistant',${answer},${mode},${run.id},now()+interval '1 microsecond')`;
        await tx`delete from copilot_contexts where run_id=${run.id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId}`;
      });
      return {saved:true,answer,mode,runId:run.id,report};
    } catch(error) {
      const code=error instanceof Error && /^(COPILOT_|AI_DAILY_|CONTEXT_)/.test(error.message)?error.message:'COPILOT_PROVIDER_FAILED';
      await inRestaurant(database,actor,input.restaurantId,async tx=>{
        await tx`update copilot_runs set status='failed',error_code=${code},updated_at=now() where id=${run.id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and data_origin='business' and status='running' and attempt=${run.attempt}`;
        await tx`delete from copilot_contexts where run_id=${run.id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and exists(select 1 from copilot_runs where id=${run.id} and data_origin='business' and attempt=${run.attempt} and status='failed')`;
      });
      throw new Error(code);
    }
  });
  app.get('/v1/operating/runs',{preHandler:authGuard(database,'copilot.propose')},async request=>{
    const {restaurantId}=z.object({restaurantId:z.uuid()}).strict().parse(request.query);
    const actor=request.actor!;
    return inRestaurant(database,actor,restaurantId,async tx=>{
      const storedRuns=await tx`select input_hash,request_payload,id,status,attempt,request_key as "requestKey",lease_until as "leaseUntil",message,report,answer,mode,error_code as "errorCode",created_at as "createdAt" from copilot_runs where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and user_id=${actor.userId} and data_origin='business' order by created_at desc limit 30`;
      const observations=await tx`select id,run_id as "runId",kind,body,created_at as "createdAt" from copilot_observations where tenant_id=${actor.tenantId} and restaurant_id=${restaurantId} and user_id=${actor.userId} and exists(select 1 from copilot_runs r where r.id=copilot_observations.run_id and r.tenant_id=${actor.tenantId} and r.restaurant_id=${restaurantId} and r.user_id=${actor.userId} and r.data_origin='business') order by created_at desc limit 100`;
      // A legacy row is reconstructible only when its message-only fingerprint agrees.
      // Never invent a missing document selection or onboarding step.
      const runs=storedRuns.map(({input_hash,request_payload,...run})=>({
        ...run,request:request_payload ?? (input_hash===fingerprint(String(run.message)) ? {attachmentIds:[]} : null),
      }));
      return {runs,observations};
    });
  });
  app.post('/v1/operating/runs/:id/observations',{preHandler:authGuard(database,'tenant.manage')},async request=>{
    const {id}=z.object({id:z.uuid()}).parse(request.params), input=observationSchema.parse(request.body),actor=request.actor!;
    return inRestaurant(database,actor,input.restaurantId,async tx=>{
      const [run]=await tx`select id from copilot_runs where id=${id} and tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and data_origin='business' and status='succeeded' for update`;
      if(!run)throw new Error('NOT_FOUND');
      const [saved]=await tx`insert into copilot_observations(tenant_id,restaurant_id,user_id,run_id,request_key,kind,body) values(${actor.tenantId},${input.restaurantId},${actor.userId},${id},${input.idempotencyKey},${input.kind},${input.body}) on conflict(tenant_id,restaurant_id,user_id,request_key) do nothing returning id`;
      if(!saved){const [prior]=await tx`select id,body,kind,run_id from copilot_observations where tenant_id=${actor.tenantId} and restaurant_id=${input.restaurantId} and user_id=${actor.userId} and request_key=${input.idempotencyKey}`;if(prior?.body!==input.body||prior?.kind!==input.kind||prior?.run_id!==id)throw new Error('COPILOT_KEY_CONFLICT');}
      return {saved:true,externalAction:false};
    });
  });
}
