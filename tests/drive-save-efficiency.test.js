'use strict';
const assert=require('node:assert/strict');
const CorePath=require('node:path').resolve(__dirname,'../renoweet-drive-core-v3.0.js');
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
global.window=global;global.localStorage=storage();global.sessionStorage=storage();
sessionStorage.setItem('renoweet_google_access_token_v1','test-token');
require(CorePath);
const Core=global.RenoweetDrive;
const files=new Map();let serial=1,moves=0;const requests=[];
function put(id,name,mimeType,parents,text=''){const f={id,name,mimeType,parents:[...parents],text};files.set(id,f);return f}
function output(f){return {id:f.id,name:f.name,mimeType:f.mimeType,parents:[...f.parents],modifiedTime:'2026-09-26T00:00:00Z',version:'1'}}
const folder='application/vnd.google-apps.folder';
put('root-folder','Renoweet Data',folder,['root']);
put('old-active','Active',folder,['root-folder']);
put('old-proofs','Proofs',folder,['root-folder']);
put('old-proof-year','2026',folder,['old-proofs']);
put('old-q1','Q1',folder,['old-proof-year']);
put('old-q2','Q2',folder,['old-proof-year']);
put('existing-year','2026',folder,['root-folder']);
put('existing-proofs','Proofs',folder,['existing-year']);
put('existing-q2','Q2',folder,['existing-proofs']);
put('receipt-2','EXP-20260401-General.pdf','application/pdf',['old-q2'],'second receipt');
put('new-receipt','EXP-20260501-General.pdf','application/pdf',['existing-q2'],'new layout receipt');
put('receipt-1','EXP-20260101-General.pdf','application/pdf',['old-q1'],'receipt bytes');
put('manifest','Renoweet-manifest.json','application/json',['root-folder'],JSON.stringify({schema:'renoweet.manifest',schemaVersion:2,activeYear:2026,years:{'2026':{activeFileId:'live'}}}));
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})}
global.fetch=async (raw,opts={})=>{
 requests.push({url:String(raw),method:opts.method||'GET'});const url=new URL(raw),parts=url.pathname.split('/'),id=parts[parts.length-1],method=opts.method||'GET';
 if(url.pathname.endsWith('/files')&&method==='GET'){
  const q=url.searchParams.get('q')||'',n=q.match(/name='([^']+)'/)?.[1],parent=q.match(/'([^']+)' in parents/)?.[1],mime=q.match(/mimeType='([^']+)'/)?.[1];
  return json({files:[...files.values()].filter(f=>(!n||f.name===n)&&(!parent||f.parents.includes(parent))&&(!mime||f.mimeType===mime)).map(output)});
 }
 if(method==='POST'&&url.pathname.endsWith('/files')){
  let meta,text='';
  if(opts.body instanceof Blob){const body=await opts.body.text();meta=JSON.parse(body.match(/Content-Type: application\/json; charset=UTF-8\r\n\r\n([^\r]+)/)[1]);text=body.match(/\r\nContent-Type: application\/json\r\n\r\n([\s\S]*?)\r\n--renoweet_/)[1]}
  else meta=JSON.parse(opts.body);
  const f=put('created-'+serial++,meta.name,meta.mimeType,meta.parents||[],text);return json(output(f));
 }
 const f=files.get(id);if(!f)return json({error:'missing'},404);
 if(method==='PATCH'&&url.searchParams.has('addParents')){
  assert.ok(f.parents.includes(url.searchParams.get('removeParents')),'move must use the actual old parent');
  f.parents=f.parents.filter(x=>x!==url.searchParams.get('removeParents'));
  f.parents.push(url.searchParams.get('addParents'));moves++;return json(output(f));
 }
 if(method==='PATCH'){f.text=String(opts.body);return json(output(f))}
 if(url.searchParams.get('alt')==='media')return new Response(f.text);
 return json(output(f));
};

(async()=>{
 const original=await Core.sealCanonical({...Core.blankCanonical(2026),os:{projects:[{id:'prj1',title:'Original',customer:{id:'cus1',name:'Customer'},estimate:[],materials:[],documents:[],payments:[],purchaseOrders:[],activity:[],followUps:[],checklist:[]}],bookkeeping:[],deleted:[]}});
 put('live','Renoweet-2026.json','application/json',['existing-year'],JSON.stringify(original));
 await Core.loadYear(2026);requests.length=0;
 const same=await Core.saveSection('os',Core.clone(original.os),{year:2026,sectionRevision:0,forceRecovery:true});
 assert.equal(same.unchanged,true);assert.equal(same.sectionRevision,0);
 assert.equal(requests.filter(r=>r.method==='POST'||r.method==='PATCH'||r.method==='DELETE').length,0,'Unchanged saves never write or create backups');
 assert.equal(requests.filter(r=>r.url.includes('/live?alt=media')).length,1,'The verified database read is reused');
 const change=Core.clone(original.os);change.projects[0].title='Payment recorded';change.projects[0].payments.push({id:'pay1',date:'2026-09-30',amount:500,status:'Received'});requests.length=0;
 const saved=await Core.saveSection('os',change,{year:2026,sectionRevision:0,forceRecovery:true});
 assert.equal(saved.sectionRevision,1);assert.equal(saved.data.os.projects[0].payments[0].amount,500);
 assert.equal(requests.filter(r=>r.url.includes('/live?alt=media')).length,2,'Changed saves read the live data and verify the uploaded data');
 const rootChecks=requests.filter(r=>{const u=new URL(r.url);return u.searchParams.get('q')?.includes("name='Renoweet Data'")});assert.equal(rootChecks.length,1,'Folder checks are reused only within this save');
 const backups=[...files.values()].filter(f=>/^Renoweet-2026-r/.test(f.name));assert.equal(backups.length,1);assert.equal(JSON.parse(backups[0].text).os.projects[0].title,'Original','Pre-write recovery snapshot is retained');
 await assert.rejects(()=>Core.saveSection('os',change,{year:2026,sectionRevision:0}),e=>e.name==='RenoweetConflictError');
 put('duplicate-live','Renoweet-2026.json','application/json',['existing-year'],files.get('live').text);
 await assert.rejects(()=>Core.saveSection('os',change,{year:2026,sectionRevision:1}),e=>e.name==='RenoweetDuplicateDatabaseError');files.delete('duplicate-live');
 const realFetch=global.fetch;let patched=false;global.fetch=async(raw,opts={})=>{const response=await realFetch(raw,opts);if((opts.method||'GET')==='PATCH'&&String(raw).includes('/live?'))patched=true;if(patched&&String(raw).includes('/live?alt=media')){const x=JSON.parse(await response.text());x.os.projects[0].title='Tampered';return new Response(JSON.stringify(x))}return response};
 const next=Core.clone(saved.data.os);next.projects[0].title='Next';await assert.rejects(()=>Core.saveSection('os',next,{year:2026,sectionRevision:1}),e=>e.name==='RenoweetIntegrityError');global.fetch=realFetch;
 console.log('Efficient saves retain identity, conflict, backup and checksum protection.');
})().catch(e=>{console.error(e);process.exitCode=1});
