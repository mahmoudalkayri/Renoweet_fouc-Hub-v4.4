const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const osHtml=fs.readFileSync('Renoweet-OS-Drive-v2.2.html','utf8');
const mergeSource=osHtml.slice(osHtml.indexOf('function cloneSafe('),osHtml.indexOf('async function connectWorkbook('));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(saveSection,cacheOk=true){
 const timers=new Map(),statuses=[],cache=[];let id=0;
 const c={console:{error(){}},db:{projects:[{id:'job',title:'Work',payments:[]}],bookkeeping:[],deleted:[]},
  structuredClone:clone,today:()=> '2026-10-01',nowStamp:()=> '2026-10-01T12:00:00Z',
  RenoweetDrive:{currentYear:()=>2026,clone,saveSection,hasAccessToken:()=>false},
  document:{getElementById:()=>null,addEventListener(){}},navigator:{onLine:true},
  addEventListener(){},setTimeout(fn,delay){timers.set(++id,{fn,delay});return id},clearTimeout(i){timers.delete(i)},
  cacheBrowserState:async dirty=>{cache.push(dirty);return cacheOk},resetProjectShadows(){},render(){},dbState(_on,title){statuses.push(title)},toast(){},alert(){},
  connectWorkbook(){},saveWorkbook(){},scheduleSave(){},persist(){},backupHTML(){},lastSyncedDb:null,
  mergeDatabases(_base,local){return {merged:clone(local),stats:{conflicts:0}}}};
 c.window=c;vm.createContext(c);vm.runInContext(mergeSource,c);vm.runInContext(fs.readFileSync('renoweet-os-drive-adapter-v3.6.js','utf8'),c);
 const api=c.renoweetDriveOS;api.state.connected=true;api.state.baseline=clone(c.db);
 return {c,api,timers,statuses,cache};
}
async function until(predicate){for(let i=0;i<30&&!predicate();i++)await Promise.resolve();assert.ok(predicate(),'async operation reached the expected stage')}
const result=(payload,rev)=>({data:{os:clone(payload),meta:{sections:{osRevision:rev}}},sectionRevision:rev});
(async()=>{
 // An unchanged open editor must not stamp a new edit after each verified save.
 let draftWrites=0,saveCount=0;
 const open=fixture(async(_section,payload)=>result(payload,++saveCount));
 Object.assign(open.c,{currentProjectId:'job',currentTab:'intake',formDirty:true,draftProject:null,projectDraftTimer:null,localCacheDirty:true,
  getP:()=>open.c.db.projects[0],updateProjectFromVisibleForm(){},projectDraftStorageKey:()=> 'draft',
  localStorage:{setItem(){draftWrites++}},nowStamp:()=>`2026-10-01T12:00:${String(draftWrites+1).padStart(2,'0')}Z`});
 vm.runInContext(osHtml.slice(osHtml.indexOf('function saveProjectDraftRecoveryNow('),osHtml.indexOf('function queueProjectDraftRecovery(')),open.c);
 assert.equal(await open.api.save(false),true,'A dirty editor with no newer field changes should finish syncing');
 assert.equal(open.api.state.syncPending,false);assert.equal(draftWrites,0);
 // Actual editor input arriving during verification is captured once, then sync settles.
 let finish,editorSaves=0,visibleTitle='Work',draftCount=0;
 const editor=fixture(async(_section,payload)=>{editorSaves++;if(editorSaves===1)await new Promise(resolve=>{finish=resolve});return result(payload,editorSaves)});
 Object.assign(editor.c,{currentProjectId:'job',currentTab:'intake',formDirty:true,draftProject:null,projectDraftTimer:null,localCacheDirty:true,
  getP:()=>editor.c.db.projects[0],updateProjectFromVisibleForm:p=>{p.title=visibleTitle},projectDraftStorageKey:()=> 'draft',
  localStorage:{setItem(){draftCount++}},nowStamp:()=>`2026-10-01T12:00:${String(draftCount+1).padStart(2,'0')}Z`});
 vm.runInContext(osHtml.slice(osHtml.indexOf('function saveProjectDraftRecoveryNow('),osHtml.indexOf('function queueProjectDraftRecovery(')),editor.c);
 const editorSave=editor.api.save(true);await until(()=>finish);visibleTitle='Edited during saving';finish();
 assert.equal(await editorSave,true);assert.equal(editor.c.db.projects[0].title,visibleTitle);
 assert.equal(editorSaves,2);assert.equal(draftCount,1);assert.equal(editor.api.state.syncPending,false);
 // A payment entered while Drive is verifying must survive and be saved next.
 let release,calls=[];
 const f=fixture(async(_section,payload)=>{calls.push(clone(payload));if(calls.length===1)return new Promise(resolve=>{release=()=>{const saved=result(payload,1);saved.data.os.projects[0].customerId='customer-1';resolve(saved)}});return result(payload,2)});
 const first=f.api.save(false);await until(()=>release);
 f.c.db.projects[0].payments.push({id:'pay-1',amount:500});f.c.scheduleSave();release();
 assert.equal(await first,false);assert.equal(f.c.db.projects[0].payments[0].amount,500);
 assert.equal(f.c.db.projects[0].customerId,'customer-1');assert.equal(f.api.state.syncPending,true);assert.equal(f.cache.at(-1),true);
 assert.equal(f.statuses.at(-1),'Saved locally • syncing newer changes');
 assert.ok([...f.timers.values()].some(t=>t.delay===300));
 assert.equal(await f.api.save(false),true);assert.equal(calls.length,2);
 assert.equal(calls[1].projects[0].payments.length,1);assert.equal(f.api.state.syncPending,false);
 assert.equal(f.cache.at(-1),false);
 // Manual saves wait for an existing request and verify the newer payment serially.
 let unblock,active=0,maxActive=0,manualCalls=[];
 const m=fixture(async(_section,payload)=>{active++;maxActive=Math.max(active,maxActive);manualCalls.push(clone(payload));
  if(manualCalls.length===1)await new Promise(resolve=>{unblock=resolve});active--;return result(payload,manualCalls.length)});
 const automatic=m.api.save(false);await until(()=>unblock);
 m.c.db.projects[0].payments.push({id:'pay-2',amount:250});m.c.scheduleSave();
 const manual=m.api.save(true);unblock();await automatic;assert.equal(await manual,true);
 assert.equal(maxActive,1);assert.equal(manualCalls.at(-1).projects[0].payments[0].amount,250);
 assert.equal(m.api.state.syncPending,false);
 // Integrity errors retain the local payment and do not enter an automatic retry loop.
 let failures=0;const bad=fixture(async()=>{failures++;const e=new Error('Checksum mismatch');e.name='RenoweetIntegrityError';throw e});
 bad.c.db.projects[0].payments.push({id:'pay-3',amount:125});bad.c.scheduleSave();
 assert.equal(await bad.api.save(true),false);assert.equal(failures,1);
 assert.equal(bad.c.db.projects[0].payments[0].amount,125);assert.equal(bad.api.state.syncPending,true);
 assert.ok(![...bad.timers.values()].some(t=>[300,2000].includes(t.delay)));
 // Failure to persist the local safety copy prevents any Drive write.
 let writes=0;const noCache=fixture(async()=>{writes++},false);
 assert.equal(await noCache.api.save(false),false);assert.equal(writes,0);
 console.log('OS save concurrency and local safety checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
