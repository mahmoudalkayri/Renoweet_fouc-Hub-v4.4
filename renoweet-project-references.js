/* Project numbers are issued with quotations; original IDs remain the identity keys. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RenoweetProjectReferences=api})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const known=new Map(),pending=new Map(),pattern=/^P(\d{2})-(\d{3,})$/;
 const text=v=>String(v??'').trim();
 function valid(v){const m=text(v).match(pattern);return !!m&&Number.isSafeInteger(Number(m[2]))&&Number(m[2])>0}
 function internalId(p){return text(typeof p==='string'?p:p?.['Project ID']||p?.osProjectId||p?.id)}
 function explicit(p){return valid(p?.projectNumber)?p.projectNumber:valid(p?.['Project number'])?p['Project number']:valid(p?.osProjectReference)?p.osProjectReference:''}
 function yearOf(p,fallback){const m=text(p?.quote?.date).match(/^((?:19|20|21)\d{2})/);return m?Number(m[1]):Number(fallback)||new Date().getFullYear()}
 function deletedProject(row){let p=null;try{const raw=row?.['Original JSON']||row?.['Original record'];p=typeof raw==='string'?JSON.parse(raw):raw}catch{}return p?.id?p:row?.['Project ID']?{id:row['Project ID'],projectNumber:row['Project number']}:null}
 function records(os){return [...(os?.projects||[]),...(os?.deleted||[]).map(deletedProject).filter(Boolean)]}
 function ensure(os,{year,remote=null}={}){
  if(!os||typeof os!=='object')return {changed:false,assigned:0,collisions:0};
  const all=new Map([...records(os),...records(remote)].map(p=>[internalId(p),p]));
  const registry=new Map(),used=new Map(),counters={2026:40},claims=[];let collisions=0;
  for(const source of [remote,os]){if(!source)continue;for(const [y,n] of Object.entries(source.projectNumberCounters||{}))if(/^\d{4}$/.test(y)&&Number.isSafeInteger(n)&&n>=0)counters[y]=Math.max(counters[y]||0,n);
   const map=new Map(records(source).map(p=>[internalId(p),p])),ids=new Set([...Object.keys(source.projectNumberRegistry||{}),...map.keys()]);
   for(const id of [...ids].sort()){if(!id||id==='__proto__'||id==='constructor')continue;const stored=source.projectNumberRegistry?.[id],ref=valid(stored)?stored:explicit(map.get(id));if(valid(ref))claims.push({id,ref})}
  }
  for(const {id,ref} of claims){const m=ref.match(pattern),y=2000+Number(m[1]);counters[y]=Math.max(counters[y]||0,Number(m[2]));if(registry.has(id))continue;if(used.has(ref)&&used.get(ref)!==id){collisions++;continue}registry.set(id,ref);used.set(ref,id)}
  let assigned=0;
  // Only previously numbered records can be repaired here. Leads and legacy projects never receive a number during loading or migration.
  for(const id of [...new Set(claims.map(c=>c.id))].sort()){if(registry.has(id))continue;const original=claims.find(c=>c.id===id),y=2000+Number(original.ref.slice(1,3));let n=(counters[y]||0)+1,ref;do{if(!Number.isSafeInteger(n))throw Error('Project number sequence exhausted.');ref=`P${String(y).slice(-2)}-${String(n++).padStart(3,'0')}`}while(used.has(ref));counters[y]=n-1;registry.set(id,ref);used.set(ref,id);assigned++}
  const saved=Object.fromEntries([...registry].sort(([a],[b])=>a.localeCompare(b)));let changed=false;
  if(JSON.stringify(os.projectNumberCounters||{})!==JSON.stringify(counters)){os.projectNumberCounters=counters;changed=true}
  if(registry.size&&JSON.stringify(os.projectNumberRegistry||{})!==JSON.stringify(saved)){os.projectNumberRegistry=saved;changed=true}
  for(const p of os.projects||[]){const ref=registry.get(internalId(p));if(ref&&p.projectNumber!==ref){p.projectNumber=ref;changed=true}}
  for(const [id,ref] of registry)known.set(id,ref);
  return {changed,assigned,collisions};
 }
 function eligible(p,os){if(!p?.id)return false;if(explicit(p))return true;
  if((os?.bookkeeping||[]).some(r=>text(r['Project ID'])===p.id)||p.invoice?.bookkeepingQueuedAt||p.invoice?.bookkeepingStatus||(p.invoiceDocuments||[]).some(d=>d.status!=='Cancelled'))return false;
  if(p.projectNumberPolicyVersion===1)return true;
  return !['sent','accepted','declined','rejected','approved'].includes(text(p.quote?.status).toLowerCase())&&!['quoted','approved','in progress','completed'].includes(text(p.stage).toLowerCase());
 }
 function reserve(p,os,{year}={}){const id=internalId(p);if(explicit(p))return explicit(p);if(!eligible(p,os))return '';ensure(os,{year});if(pending.has(id))return pending.get(id).number;const y=yearOf(p,year),used=new Set(Object.values(os.projectNumberRegistry||{}));for(const x of pending.values())used.add(x.number);let n=(os.projectNumberCounters?.[y]||0)+1,number;do{number=`P${String(y).slice(-2)}-${String(n++).padStart(3,'0')}`}while(used.has(number));pending.set(id,{number,year:y});return number}
 function validateReservation(p,os){const r=pending.get(internalId(p));if(!r)return true;const other=Object.entries(os?.projectNumberRegistry||{}).find(([id,num])=>id!==p.id&&num===r.number);if(other)throw Error('This project number was used on another device while the quotation was being prepared. Refresh and send again.');return true}
 function commit(p,os,options={}){if(explicit(p)){ensure(os,options);return explicit(p)}if(!eligible(p,os))return '';reserve(p,os,options);validateReservation(p,os);const r=pending.get(p.id);if(!r)return '';p.projectNumber=r.number;p.projectNumberPolicyVersion=1;p.projectNumberYear=r.year;os.projectNumberCounters=Object.assign({2026:40},os.projectNumberCounters||{});os.projectNumberCounters[r.year]=Math.max(os.projectNumberCounters[r.year]||0,Number(r.number.split('-')[1]));os.projectNumberRegistry={...(os.projectNumberRegistry||{}),[p.id]:r.number};known.set(p.id,r.number);pending.delete(p.id);return r.number}
 function release(p){pending.delete(internalId(p))}
 function register(os,options={}){if(!os)return;const view={projects:(os.projects||[]).map(p=>({id:p.id,projectNumber:p.projectNumber})),deleted:os.deleted||[],projectNumberRegistry:os.projectNumberRegistry,projectNumberCounters:os.projectNumberCounters};ensure(view,options)}
 function get(p){const id=internalId(p);return pending.get(id)?.number||known.get(id)||explicit(p)||id}
 function reference(p){const id=internalId(p),value=known.get(id)||explicit(p);return valid(value)?value:''}
 return {valid,yearOf,ensure,eligible,reserve,validateReservation,commit,release,register,get,reference};
});
