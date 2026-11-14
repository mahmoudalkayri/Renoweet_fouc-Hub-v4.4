'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto,createHash}=require('node:crypto');
const src=fs.readFileSync('renoweet-progress-drive.js','utf8'),context={structuredClone,crypto:webcrypto,Blob};vm.createContext(context);vm.runInContext(src,context);
const E=context.RenoweetProgressDrive,hash=async value=>createHash('sha256').update(value).digest('hex'),copy=structuredClone;
const picture='data:image/png;base64,aaaa',workspace=(projects=[])=>({schema:'renoweet.progress',version:1,company:{name:'Renoweet',logo:picture},projects});
const project=(id,name=id)=>({id,meta:{name},activities:[{id:'a',code:'1',notes:'',progress:0}],reports:[],draft:{summary:'',nextSteps:'',photos:[{id:'photo',data:picture}]}});
const report=id=>({id,seq:1,title:'Progress 1',createdAt:'2026-11-14T10:00:00Z',company:{logo:picture},photos:[{id:'photo',data:picture}],progress:40});
function server(){
 let n=0;const files=new Map(),photos=new Map();let scans=null,failWrite=false;
 const api={folder:async(_id,create)=>({id:'shared-folder',create}),list:async()=>copy(scans||[...files.values()].map(f=>f.meta)),
  read:async id=>{if(files.has(id))return files.get(id).body;if(photos.has(id))return photos.get(id);throw Error('missing Drive file')},
  image:async(_folder,_digest,data)=>{const id='photo-'+(++n);photos.set(id,data);return id},
  write:async(_folder,name,body,parents)=>{if(failWrite)throw Error('network disconnected');const id='rev-'+(++n),meta={id,name,appProperties:Object.fromEntries(parents.map((v,i)=>['p'+String(i).padStart(2,'0'),v]))};files.set(id,{meta,body});return meta}};
 return {api,files,photos,freeze:()=>scans=[...files.values()].map(f=>f.meta),unfreeze:()=>scans=null,fail:v=>failWrite=v};
}
const run=(s,data,known,options={})=>E.sync({store:s.api,workspace:data,known,hash,validate:x=>{assert.equal(x.schema,'renoweet.progress');for(const p of x.projects)for(const photo of p.draft.photos)assert.equal(photo.data,picture)},...options});
async function checkTransport(){
 const coreSource=fs.readFileSync('renoweet-drive-core-v3.0.js','utf8'),mem=()=>{const kv=new Map();return {getItem:key=>kv.get(key)||null,setItem:(key,value)=>kv.set(key,String(value)),removeItem:key=>kv.delete(key)}};
 const sessionStorage=mem(),localStorage=mem(),files=[],items=new Map(),requests=[];
 sessionStorage.setItem('renoweet_google_access_token_v1','test-token');
 const json=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 const http=async(url,opt)=>{
  const u=new URL(url),q=u.searchParams.get('q'),method=opt.method||'GET';requests.push([method,u.pathname]);
  assert.equal(opt.headers.get('Authorization'),'Bearer test-token');
  if(q){
   const exact=/name='([^']+)'/.exec(q)?.[1],prefix=/name contains '([^']+)'/.exec(q)?.[1],parent=/'([^']+)' in parents/.exec(q)?.[1],folders=q.includes('google-apps.folder');
   return json({files:files.filter(f=>(!exact||f.name===exact)&&(!prefix||f.name.includes(prefix))&&(!parent||f.parents?.includes(parent))&&(!folders||f.mimeType==='application/vnd.google-apps.folder'))});
  }
  if(method==='POST'){
   let meta,text;
   if(u.pathname.startsWith('/upload/')){
    const raw=await opt.body.text(),pieces=raw.split('\r\n\r\n');
    meta=JSON.parse(pieces[1].split('\r\n')[0]);text=pieces[2].split('\r\n--rw_progress_')[0];
   }else meta=JSON.parse(opt.body);
   const file={...meta,id:'file-'+(files.length+1)};files.push(file);if(text!==undefined)items.set(file.id,text);return json(file);
  }
  if(u.searchParams.get('alt')==='media')return new Response(items.get(u.pathname.split('/').pop()));
  throw Error('Unexpected Drive call: '+u);
 };
 const c={structuredClone,crypto:webcrypto,Blob,TextEncoder,Headers,AbortController,setTimeout,clearTimeout,URLSearchParams,localStorage,sessionStorage,fetch:http};c.window=c;
 vm.createContext(c);vm.runInContext(coreSource,c);
 const core=c.RenoweetDrive,record=workspace([project('transport')]);record.projects[0].reports=[report('one')];
 const result=await E.sync({store:core.progressStore(),workspace:record,hash:core.sha256Text,validate:()=>{}});
 assert(result.uploaded);assert.equal(files.filter(x=>x.name.startsWith('Progress-')).length,1);
 assert.equal(files.filter(x=>x.name.startsWith('Image-')).length,1);
 assert(!requests.some(([method])=>method==='PATCH'||method==='DELETE'),'Progress sync cannot overwrite any OS or report file.');
 assert(!files.some(x=>/^Renoweet-\d/.test(x.name)));
 const imageFile=files.find(x=>x.name.startsWith('Image-'));assert.equal(items.get(imageFile.id),picture);
 const original=files.find(x=>x.name==='Progress Reports');files.push({...original,id:'duplicate-folder'});
 await assert.rejects(core.progressStore().folder(original.id),/More than one/);
}
(async()=>{
 const s=server(),first=workspace([project('one')]);first.projects[0].reports=[report('r1')];
 const a=await run(s,first);assert(a.uploaded);assert(a.hasData);assert.equal(s.photos.size,1,'Identical logo and photos are stored once');assert.equal(s.files.size,1);assert(![...s.files.values()][0].body.includes('data:image'));
 const b=await run(s,workspace());assert(!b.uploaded);assert.equal(b.workspace.projects[0].reports[0].photos[0].data,picture);
 const original=copy(b.workspace),local=copy(b.workspace),remote=copy(b.workspace);
 local.projects[0].draft.summary='From laptop';local.projects[0].reports.push(report('laptop'));
 remote.projects[0].draft.nextSteps='From phone';remote.projects[0].reports.push(report('phone'));
 s.freeze();await run(s,local,a.meta);await run(s,remote,b.meta);s.unfreeze();
 const merged=await run(s,workspace());assert(merged.uploaded);assert.equal(merged.workspace.projects[0].draft.summary,'From laptop');assert.equal(merged.workspace.projects[0].draft.nextSteps,'From phone');assert.equal(merged.workspace.projects[0].reports.length,3);assert.equal(s.photos.size,1);
 const x=copy(merged.workspace),y=copy(merged.workspace);x.projects[0].activities[0].progress=25;y.projects[0].activities[0].progress=50;x.projects[0].reports.push(report('x'));y.projects[0].reports.push(report('y'));
 await run(s,x,merged.meta);const count=s.files.size;
 await assert.rejects(run(s,y,merged.meta),e=>e.name==='ProgressDriveConflict'&&e.paths.some(p=>p.includes('progress')));assert.equal(s.files.size,count);
 const resolved=await run(s,y,merged.meta,{prefer:'drive'});assert.equal(resolved.workspace.projects[0].activities[0].progress,25);assert.equal(resolved.workspace.projects[0].reports.length,5);
 const newData=copy(resolved.workspace);newData.projects.push(project('two'));s.fail(true);await assert.rejects(run(s,newData,resolved.meta),/network disconnected/);s.fail(false);
 assert.equal((await run(s,workspace())).workspace.projects.length,1,'A failed save leaves the verified Drive version intact.');
 const success=await run(s,newData,resolved.meta);assert.equal(success.workspace.projects.length,2);
 const deleted=await run(s,workspace(),success.meta);assert.equal(deleted.workspace.projects.length,2,'Browser deletion cannot erase the Drive copy.');
 const attached=await run(s,workspace(),{}, {readOnly:true});assert.equal(attached.workspace.projects.length,2);
 const id=success.meta.heads[0],head=[...s.files.values()].find(f=>f.meta.name.includes(id)),saved=head.body;
 head.body=head.body.replace('From laptop','Tampered');await assert.rejects(run(s,workspace()),/checksum/);head.body=saved;
 const storedPhoto=[...s.photos.keys()][0];s.photos.set(storedPhoto,'changed');await assert.rejects(run(s,{...workspace(),company:{name:'Default'}}),/image failed verification/);s.photos.set(storedPhoto,picture);
 s.files.delete(head.meta.id);await assert.rejects(run(s,original,success.meta),/missing from Drive/);
 await assert.rejects(run(server(),original,{folderId:'wrong-folder'}),/different Progress Reports folder/);
 const old=workspace([project('a')]),l=copy(old),r=copy(old);l.projects[0].activities[0].notes='laptop';r.projects[0].activities[0].progress=77;
 const combined=E.merge(old,l,r);assert.equal(combined.projects[0].activities[0].notes,'laptop');assert.equal(combined.projects[0].activities[0].progress,77);
 await checkTransport();
 console.log('Progress Drive checks passed: verified photo deduplication, new-device restore, parallel revisions, draft conflicts with report union, failed writes, checksum and photo validation, account binding, and recovery guards.');
})().catch(error=>{console.error(error);process.exitCode=1});
