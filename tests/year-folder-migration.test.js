'use strict';
const assert=require('node:assert/strict');
const CorePath=require('node:path').resolve(__dirname,'../renoweet-drive-core-v3.0.js');
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
global.window=global;global.localStorage=storage();global.sessionStorage=storage();
sessionStorage.setItem('renoweet_google_access_token_v1','test-token');
require(CorePath);
const Core=global.RenoweetDrive;
const files=new Map();let serial=1,moves=0;
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
 const url=new URL(raw),parts=url.pathname.split('/'),id=parts[parts.length-1],method=opts.method||'GET';
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
 const canonical=await Core.sealCanonical(Core.blankCanonical(2026));
 files.set('live',put('live','Renoweet-2026.json','application/json',['old-active'],JSON.stringify(canonical)));
 const original=files.get('live').text;
 const pre=await Core.loadExistingYear(2026);
 assert.equal(pre.file.id,'live');assert.deepEqual(pre.file.parents,['old-active'],'normal read must not silently migrate');
 const preview=await Core.planYearOrganization(2026);
 assert.equal(preview.needsLiveMove,true);assert.equal(preview.proofCount,2);
 const result=await Core.organizeYear(2026);
 assert.equal(result.movedProofs,2);
 const year=[...files.values()].find(f=>f.name==='2026'&&f.parents.includes('root-folder'));
 const yearProofs=[...files.values()].find(f=>f.name==='Proofs'&&f.parents.includes(year.id));
 assert.deepEqual(files.get('live').parents,[year.id]);assert.equal(files.get('live').text,original);
 assert.deepEqual(files.get('old-q1').parents,[yearProofs.id]);assert.deepEqual(files.get('receipt-1').parents,['old-q1'],'receipt ID and containing folder are preserved');
 assert.deepEqual(files.get('receipt-2').parents,['existing-q2'],'an old receipt merges by ID into an existing new quarter');
 assert.deepEqual(files.get('new-receipt').parents,['existing-q2'],'new-layout receipt is untouched');
 const backup=files.get(result.backupId);assert.equal(backup.text,original,'pre-move backup must be byte-identical');
 assert.ok(backup.parents.some(id=>files.get(id)?.name==='Recovery'));
 const after=await Core.loadExistingYear(2026);assert.equal(after.file.id,'live');
 const moveCount=moves;assert.equal((await Core.organizeYear(2026)).alreadyOrganized,true);assert.equal(moves,moveCount,'rerunning the action is safe');
 put('duplicate-live','Renoweet-2026.json','application/json',['old-active'],original);
 await assert.rejects(()=>Core.planYearOrganization(2026),e=>e.name==='RenoweetDuplicateDatabaseError','a second live JSON must block migration');
 assert.equal(moves,moveCount,'duplicate detection must not move files');
 console.log('Year-folder migration and receipt IDs verified.');
})().catch(e=>{console.error(e);process.exitCode=1});
