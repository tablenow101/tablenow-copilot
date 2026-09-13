"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

type Run = { id:string;status:string;requestKey:string;leaseUntil:string;message:string;answer:string|null;report:{sources:{id:string;label:string;version?:number}[];uncertainties:string[];conflicts:string[];recommendations:string[]}|null };
type Observation={id:string;runId:string;kind:string;body:string};
export function CopilotEvidence({restaurantId,revision,canDecide,onRetry}:{restaurantId:string;revision:number;canDecide:boolean;onRetry:(message:string,key:string)=>void}) {
  const [runs,setRuns]=useState<Run[]>([]), [observations,setObservations]=useState<Observation[]>([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef<{body:string;key:string}|null>(null);
  const generation=useRef(0);
  const refresh=useCallback(async()=>{
    const version=++generation.current;
    try{const result=await api<{runs:Run[];observations:Observation[]}>(`/v1/operating/runs?restaurantId=${restaurantId}`);if(version===generation.current){setRuns(result.runs);setObservations(result.observations);setError('');}}
    catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Données indisponibles.');}
  },[restaurantId]);
  useEffect(()=>{void refresh();return()=>{generation.current++;};},[refresh,revision]);
  async function save(event:FormEvent<HTMLFormElement>,id:string){
    event.preventDefault();if(busy)return;
    const form=event.currentTarget,data=new FormData(form);
    const content={restaurantId,body:String(data.get('body')||'').trim(),kind:String(data.get('kind'))};
    const body=JSON.stringify({id,...content});
    if(request.current?.body!==body)request.current={body,key:crypto.randomUUID()};
    setBusy(true);setError('');
    try{await api(`/v1/operating/runs/${id}/observations`,{method:'POST',body:JSON.stringify({...content,idempotencyKey:request.current.key})});request.current=null;form.reset();await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
    finally{setBusy(false);}
  }
  return <section className="tn-card tn-copilot-evidence" aria-label="Sources et décisions">
    <details><summary>Sources et décisions</summary>
      {error&&<p role="alert">{error} <button type="button" className="tn-secondary" onClick={()=>void refresh()}>Réessayer</button></p>}
      {!runs.length&&!error&&<p>Aucune recommandation enregistrée.</p>}
      {runs.map(run=><article key={run.id}>
        <p>{run.message}</p>
        {run.status!=='succeeded'?<div><p role="status">{run.status==='running'?'Demande en cours':'Demande interrompue'}</p><button type="button" className="tn-secondary" onClick={()=>onRetry(run.message,run.requestKey)}>Reprendre cette demande</button></div>:<>
          {run.report&&<>
            <p>Sources</p><ul>{run.report.sources.map(source=><li key={source.id}>{source.label}{source.version?` · version ${source.version}`:''}</li>)}</ul>
            <p>Incertitudes</p><ul>{[...run.report.conflicts,...run.report.uncertainties].map(text=><li key={text}>{text}</li>)}</ul>
          </>}
          {observations.filter(o=>o.runId===run.id).map(o=><p key={o.id}><strong>{o.kind==='decision'?'Décision':'Résultat observé'} : </strong>{o.body}</p>)}
          {canDecide&&<form onSubmit={event=>void save(event,run.id)}>
            <label>Décision ou résultat<select name="kind" defaultValue="decision"><option value="decision">Décision</option><option value="outcome">Résultat observé</option></select></label>
            <label>Votre note<textarea name="body" required minLength={2} maxLength={2000}/></label>
            <button className="tn-secondary" disabled={busy}>Enregistrer</button>
          </form>}
        </>}
      </article>)}
    </details>
  </section>;
}
