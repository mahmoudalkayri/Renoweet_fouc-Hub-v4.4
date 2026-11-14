/* Independent, immutable Drive revisions for the progress workspace. */
(function(root){
 'use strict';
 const SCHEMA='renoweet.progress.drive',LIMIT=180000000,CAP=300;
 const copy=x=>x===undefined?x:structuredClone(x);
 const canonical=(x)=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const equal=(a,b)=>a===b||canonical(a)===canonical(b);
 const empty=()=>({schema:'renoweet.progress',version:1,company:undefined,projects:[]});
 const key=p=>p.osLink?.id?'os:'+p.osLink.id:'local:'+p.id;
 const idCheck=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
 const hashCheck=hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash);
 const fileCheck=id=>typeof id==='string'&&/^[\w-]{1,160}$/.test(id);
 const conflict=(message,paths=[])=>Object.assign(new Error(message),{name:'ProgressDriveConflict',paths});
 const noSnapshot=()=>new Error('A known Progress Reports revision is missing from Drive. No report data was replaced. Restore the missing files from Drive Trash before syncing.');
 function imageHolders(workspace){
  const out=[];
  if(workspace.company?.logo)out.push([workspace.company,'logo']);
  for(const p of workspace.projects||[]){
   for(const photo of p.draft?.photos||[])out.push([photo,'data']);
   for(const report of p.reports||[]){
    if(report.company?.logo)out.push([report.company,'logo']);
    for(const photo of report.photos||[])out.push([photo,'data']);
   }
  }
  return out;
 }
 async function pack(workspace,hash){
  const data={schema:'renoweet.progress',version:1,company:copy(workspace.company),projects:copy(workspace.projects||[])},images=new Map(),hashes=new Map();
  for(const [holder,k] of imageHolders(data)){
   const value=holder[k];
   if(typeof value!=='string'||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(value)||value.length>=5000000)throw Error('An image in this report workspace is not valid for sync.');
   let digest=hashes.get(value);
   if(!digest){digest=await hash(value);hashes.set(value,digest);images.set(digest,value)}
   holder[k]={image:digest};
  }
  return {data,images};
 }
 function refs(workspace){
  const result=new Set();
  for(const [holder,k] of imageHolders(workspace)){
   if(!hashCheck(holder[k]?.image))throw Error('Invalid image reference in Progress Reports Drive data.');
   result.add(holder[k].image);
  }
  return result;
 }
 function merge(base,local,remote,{prefer=null}={}){
  const differences=[],seen=new Set();
  function clash(path,l,r){
   if(!seen.has(path)){seen.add(path);differences.push(path)}
   return copy(prefer==='drive'?r:l);
  }
  function value(b,l,r,path){
   if(equal(l,r))return copy(l);
   if(equal(b,l))return copy(r);if(equal(b,r))return copy(l);
   if(Array.isArray(l)&&Array.isArray(r)&&[l,r,b||[]].every(list=>Array.isArray(list)&&list.every(item=>item&&typeof item.id==='string')&&new Set(list.map(item=>item.id)).size===list.length)){
    const maps=[b||[],l,r].map(list=>new Map(list.map(item=>[item.id,item])));
    const orders=[b||[],l,r].map(list=>list.map(item=>item.id));
    // Combine separate additions and edits. Keep the order of a single-sided reorder.
    const order=equal(orders[0],orders[1])?orders[2]:orders[1];
    return [...new Set([...order,...orders[1],...orders[2]])].map(id=>value(maps[0].get(id),maps[1].get(id),maps[2].get(id),path+' / '+(maps[1].get(id)?.label||maps[1].get(id)?.code||id))).filter(item=>item!==undefined);
   }
   if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
    return Object.fromEntries([...new Set([...Object.keys(l),...Object.keys(r)])].map(k=>[k,value(b?.[k],l[k],r[k],path+' / '+k)]).filter(([,val])=>val!==undefined));
   }
   return clash(path,l,r);
  }
  function project(b,l,r){
   // Deleting from a browser or restoring JSON never silently erases a cloud project.
   if(!l||!r)return copy(l||r);
   if(equal(l,r))return copy(l);
   const label=l.meta?.name||r.meta?.name||key(l);
   const body=p=>{if(!p)return p;const {id,reports,createdAt,...rest}=p;return rest};
   const draft=!b&&l.id!==r.id&&!equal(body(l),body(r))?clash(label+' / independent drafts',body(l),body(r)):value(body(b),body(l),body(r),label);
   const reportMap=new Map();
   for(const report of [...(l.reports||[]),...(r.reports||[])]){
    const existing=reportMap.get(report.id);
    if(!existing)reportMap.set(report.id,report);
    else if(!equal(existing,report)){
     const fromBase=b?.reports?.find(x=>x.id===report.id);
     const combined=value(fromBase,existing,report,label+' / '+report.title);
     // Clearing local report photos does not discard the verified photo archive.
     const withPhotos=existing.photos?.length?existing:report.photos?.length?report:null;
     if(withPhotos&&combined.photosRemoved){combined.photos=copy(withPhotos.photos);combined.photosRemoved=false;delete combined.photoRecord}
     reportMap.set(report.id,combined);
    }
   }
   const reports=[...reportMap.values()].sort((a,b)=>a.seq-b.seq||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||a.id.localeCompare(b.id));
   return {id:l.id,createdAt:l.createdAt||r.createdAt,...draft,reports};
  }
  const sets=[base,local,remote].map(x=>new Map((x?.projects||[]).map(p=>[key(p),p])));
  const [b,l,r]=sets;
  const projects=[...new Set([...l.keys(),...r.keys()])].map(k=>project(b.get(k),l.get(k),r.get(k)));
  if(projects.length>CAP)throw Error('The combined Drive workspace exceeds 300 projects. Export your local backup before continuing.');
  const lc=local.company,rc=remote.company;
  const company=!lc?copy(rc):!rc?copy(lc):!base?.company&&!local.projects.length?copy(rc):!base?.company&&!remote.projects.length&&local.projects.length?copy(lc):value(base?.company,lc,rc,'Company settings');
  if(differences.length&&!prefer)throw conflict('This device and Drive changed the same draft. Review which draft to keep; saved reports from both copies will be retained.',differences);
  return {schema:'renoweet.progress',version:1,company,projects};
 }
 function graph(files){
  if(files.length>12000)throw Error('The Progress Reports revision list is too large. Export a backup before continuing.');
  const map=new Map();
  for(const file of files){
   const id=/^Progress-([a-f0-9]{32})\.json$/.exec(file.name)?.[1];if(!id)continue;
   const parents=Object.entries(file.appProperties||{}).filter(([k])=>/^p\d{2}$/.test(k)).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);
   if(!fileCheck(file.id)||parents.some(p=>!idCheck(p)||p===id)||new Set(parents).size!==parents.length||map.has(id))throw Error('Conflicting Progress Reports revision files were found in Drive. No files were overwritten.');
   map.set(id,{...file,revision:id,parents});
  }
  const rank=new Map(),children=new Map(),waiting=new Map(),parents=new Set(),queue=[];
  for(const node of map.values()){
   waiting.set(node.revision,node.parents.length);
   if(!node.parents.length){rank.set(node.revision,1);queue.push(node.revision)}
   for(const p of node.parents){
    if(!map.has(p))throw noSnapshot();
    parents.add(p);if(!children.has(p))children.set(p,[]);children.get(p).push(node.revision);
   }
  }
  for(let i=0;i<queue.length;i++){
   const id=queue[i];for(const child of children.get(id)||[]){
    rank.set(child,Math.max(rank.get(child)||0,rank.get(id)+1));
    waiting.set(child,waiting.get(child)-1);if(waiting.get(child)===0)queue.push(child);
   }
  }
  if(queue.length!==map.size)throw Error('The Progress Reports revision history contains a cycle.');
  const heads=[...map.keys()].filter(id=>!parents.has(id)).sort((a,b)=>rank.get(a)-rank.get(b)||a.localeCompare(b));
  function ancestors(ids){
   const out=new Set(),pending=[...ids];while(pending.length){const id=pending.pop();if(out.has(id))continue;out.add(id);pending.push(...map.get(id).parents)}return out;
  }
  function common(a,b){
   const left=ancestors(a);
   return [...ancestors(b)].filter(id=>left.has(id)).sort((a,b)=>rank.get(b)-rank.get(a)||a.localeCompare(b))[0];
  }
  return {map,heads,common};
 }
 async function verify(raw,meta,hash){
  if(typeof raw!=='string'||raw.length>LIMIT)throw Error('The Drive revision is too large.');
  let r;try{r=JSON.parse(raw)}catch{throw Error('A Progress Reports revision in Drive is not valid JSON. No data was overwritten.')}
  if(r?.schema!==SCHEMA||r.version!==1||r.id!==meta.revision||!equal(r.parents,meta.parents)||!hashCheck(r.checksum)||r.workspace?.schema!=='renoweet.progress'||r.workspace.version!==1||!Array.isArray(r.workspace.projects)||r.workspace.projects.length>CAP||!r.images||typeof r.images!=='object'||Array.isArray(r.images))throw Error('Invalid Progress Reports revision in Drive.');
  const ids=new Set();
  for(const project of r.workspace.projects){
   if(!project||typeof project.id!=='string'||ids.has(key(project)))throw Error('A Drive revision contains duplicate project records.');
   ids.add(key(project));
   if(!Array.isArray(project.reports)||new Set(project.reports.map(report=>report?.id)).size!==project.reports.length)throw Error('A Drive revision contains duplicate reports.');
  }
  const {checksum,...payload}=r;
  if(await hash(canonical(payload))!==checksum)throw Error('A Progress Reports revision failed its checksum. No files were overwritten.');
  for(const h of refs(r.workspace))if(!fileCheck(r.images[h]))throw Error('A report image is missing from the Drive revision.');
  return r;
 }
 async function sync({store,workspace,known={},hash,validate,prefer,readOnly=false}){
  const folder=await store.folder(known.folderId||'',!readOnly);
  if(known.folderId&&known.folderId!==folder.id)throw Error('This browser is linked to a different Progress Reports folder. Reconnect with the original Google account.');
  const g=graph(await store.list(folder.id));
  if((known.heads||[]).some(id=>!g.map.has(id)))throw noSnapshot();
  if(g.heads.length>30)throw Error('Too many concurrent Progress Reports revisions. Export your local backup before continuing.');
  const revisions=new Map(),imageIds=new Map();
  async function load(id){
   if(!id)return null;
   if(!revisions.has(id)){
    const meta=g.map.get(id),revision=await verify(await store.read(meta.id),meta,hash);
    revisions.set(id,revision);
    for(const h of refs(revision.workspace))imageIds.set(h,revision.images[h]);
   }
   return revisions.get(id).workspace;
  }
  let remote=null,visited=[];
  for(const id of g.heads){
   const next=await load(id);
   remote=remote?merge(await load(g.common(visited,[id])),remote,next,{prefer}):next;
   visited.push(id);
  }
  const packed=await pack(workspace,hash);
  if(readOnly&&!remote)throw Error('No Progress Reports data is saved in this Drive folder yet.');
  const merged=readOnly?remote:remote?merge(known.base||empty(),packed.data,remote,{prefer}):packed.data;
  if(!readOnly&&new Blob([JSON.stringify(merged)]).size>4700000)throw Error('The report text and metadata exceed the Drive sync limit. Export a backup and remove unneeded draft content.');
  const hydrate=copy(merged),needed=refs(merged),loaded=new Map();
  // Validate actual photos before accepting a remote snapshot in browser storage.
  const missing=[...needed].filter(h=>!packed.images.has(h));
  for(const h of needed)if(packed.images.has(h))loaded.set(h,packed.images.get(h));
  for(let i=0;i<missing.length;i+=4)await Promise.all(missing.slice(i,i+4).map(async h=>{
   if(!fileCheck(imageIds.get(h)))throw Error('A required Progress Reports image is missing in Drive.');
   const image=await store.read(imageIds.get(h));
   if(await hash(image)!==h)throw Error('A Progress Reports image failed verification. The browser copy was kept.');
   loaded.set(h,image);
  }));
  for(const [holder,k] of imageHolders(hydrate))holder[k]=loaded.get(holder[k].image);
  validate(hydrate);
  let heads=g.heads,uploaded=false;
  if(!readOnly&&(!remote||heads.length!==1||!equal(remote,merged))){
   const images={};
   for(const h of needed){
    let fileId=imageIds.get(h);
    if(!fileId)fileId=await store.image(folder.id,h,loaded.get(h),hash);
    if(!fileCheck(fileId))throw Error('Drive did not verify the new report image.');
    images[h]=fileId;
   }
   const id=crypto.randomUUID().replace(/-/g,''),parents=[...heads],revision={schema:SCHEMA,version:1,id,parents,createdAt:new Date().toISOString(),workspace:merged,images};
   const sealed={...revision,checksum:await hash(canonical(revision))};
   const body=JSON.stringify(sealed);
   if(body.length>LIMIT)throw Error('The report workspace is too large to sync.');
   const file=await store.write(folder.id,'Progress-'+id+'.json',body,parents);
   await verify(await store.read(file.id),{revision:id,parents},hash);
   heads=[id];uploaded=true;
  }
  return {workspace:hydrate,meta:{folderId:folder.id,heads,base:merged,syncedAt:new Date().toISOString()},captured:packed.data,uploaded,hasData:Boolean(heads.length)};
 }
 root.RenoweetProgressDrive={sync,merge,pack,canonical,equal};
})(globalThis);
