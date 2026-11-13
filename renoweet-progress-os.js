/* Read-only OS project source for the separate progress-report workspace. */
(function(root){
 'use strict';
 const PIN='renoweet_os_pin_hash_v1',SALT='renoweet_os_pin_salt_v1',SESSION='renoweet_os_unlocked';
 const text=(value,max=300)=>String(value??'').trim().slice(0,max);
 const year=()=>root.RenoweetDrive?.currentYear()||new Date().getFullYear();
 const allowed=()=>!!localStorage.getItem(PIN)&&sessionStorage.getItem(SESSION)==='1';
 function requireUnlock(){if(!allowed())throw new Error('Unlock Progress Reports with your OS PIN first.')}
 function unlock(mount){
  if(allowed())return Promise.resolve();
  return new Promise(resolve=>{
   mount.innerHTML='<div class="app-boot progress-lock"><div class="boot-logo">Renoweet</div><h1>Progress Reports</h1><p id="progressLockInfo"></p><form id="progressUnlock"><label class="field">OS PIN<input type="password" name="pin" inputmode="numeric" maxlength="6" autocomplete="current-password" required></label><button class="primary" type="submit">Unlock</button><p id="progressPinError" role="alert"></p></form><p><a href="./Renoweet-OS-Drive-v2.2.html" target="_blank" rel="noopener">Open OS</a> · <a href="./index.html">Back to Hub</a></p></div>';
   const info=mount.querySelector('#progressLockInfo'),form=mount.querySelector('form'),error=mount.querySelector('#progressPinError');
   info.textContent=localStorage.getItem(PIN)?'Use the PIN you set in Renoweet OS on this browser.':'Set a PIN in Renoweet OS, then return here and unlock.';
   form.onsubmit=async event=>{
    event.preventDefault();const pin=form.elements.pin.value.trim(),expected=localStorage.getItem(PIN),salt=localStorage.getItem(SALT)||'';
    if(!expected){error.textContent='Open OS and set your PIN first.';return}
    if(!/^\d{4,6}$/.test(pin)){error.textContent='Enter your 4–6 digit OS PIN.';return}
    try{
     const bytes=new TextEncoder().encode(salt+'|'+pin),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
     if(hash!==expected){error.textContent='Incorrect PIN.';form.elements.pin.select();return}
     sessionStorage.setItem(SESSION,'1');resolve();
    }catch{error.textContent='PIN verification requires a secure browser connection.'}
   };
  });
 }
 const fromLocal=record=>record&&Array.isArray(record.db?.projects)&&!record.readOnly&&(!record.year||record.year===year())?{projects:record.db.projects,savedAt:record.savedAt,source:record.dirty?'OS browser copy · Drive pending':'OS browser copy',dirty:record.dirty}:null;
 function fromDrive(record){
  const value=record?.value;
  return value?.meta?.year===year()&&Array.isArray(value.os?.projects)?{projects:value.os.projects,savedAt:record.savedAt||value.meta.updatedAt,source:'Saved Drive copy',dirty:false}:null;
 }
 async function read({live=false}={}){
  requireUnlock();
  const core=root.RenoweetDrive,bridge=root.RenoweetOSProjectBridge;
  if(live){
   if(!core)throw new Error('Drive tools are unavailable. Reload the page and try again.');
   if(!core.hasAccessToken())await core.authorize(true);
   const remote=await core.loadExistingYear(year());
   if(!Array.isArray(remote?.data?.os?.projects))throw new Error('No current-year OS database was found. Open OS and connect to the correct Drive account.');
   const local=fromLocal(await bridge?.readLocalOsCache());
   if(local?.dirty)return {...local,source:'OS browser copy · local changes pending'};
   return {projects:remote.data.os.projects,savedAt:new Date().toISOString(),source:'Google Drive · verified',dirty:false};
  }
  const [l,d]=await Promise.all([bridge?.readLocalOsCache(),core?.getCachedYear(year())]);
  const local=fromLocal(l),drive=fromDrive(d);
  if(local?.dirty||!drive)return local;
  if(!local)return drive;
  return (Date.parse(local.savedAt)||0)>=(Date.parse(drive.savedAt)||0)?local:drive;
 }
 function isActive(project){return !!project?.id&&text(project.stage).toLowerCase()==='in progress'}
 function openUrl(projectId){return './Renoweet-OS-Drive-v2.2.html?project='+encodeURIComponent(projectId)+'&tab=invoice'}
 function seed(project,core){
  const outline=root.RenoweetEstimateOutline,vat=root.RenoweetOSVat;
  const q=vat.calculate(project,'quote'),facts=new Map(q.lines.map(item=>[item.line,item]));
  const activities=outline.sections(project.estimate||[]).flatMap(section=>section.items.map(({line,code})=>{
   const f=facts.get(line);
   if(!f||f.net<0)return null;
   const detail=outline.description(line.desc,section.name);
   return {id:core.id(),osLineId:text(line.id,100),code,description:text(section.name?section.name+' — '+detail:detail,2500)||'Work activity',net:f.net,vat:['NL_ZERO','REVERSE_CHARGE_NL'].includes(f.treatment)?0:f.rate,progress:0,status:'Not started',notes:'',weight:1};
  }).filter(Boolean));
  return {activities,meta:{name:text(project.title)||'OS project',client:text(project.customer?.name),address:text(project.customer?.address,500),clientPhone:text(project.customer?.phone,100),quoteNumber:text(project.quote?.number,100),quoteDate:text(project.quote?.date,30),projectId:text(root.RenoweetProjectReferences?.reference(project)||project.projectNumber||project.id,100)},
   osLink:{id:text(project.id,100),updated:text(project.updated,60),quoteTotal:q.total,excluded:q.lines.filter(f=>f.net<0).length,hasExtras:!!(q.travel||q.parking)}};
 }
 // Match by stable OS estimate-line ID. Revisions never touch issued snapshots,
 // payment milestones, or the locally recorded progress/notes/photos.
 function applySeed(workspace,source,{update=false}={}){
  if(source.activities.length>150)throw new Error('This estimate has more than 150 work lines. Split the reporting scope or use a manual report.');
  if(update){
   const existing=new Map(workspace.activities.filter(a=>a.osLineId).map(a=>[a.osLineId,a]));
   const incoming=new Map(source.activities.filter(a=>a.osLineId).map(a=>[a.osLineId,a]));
   const custom=workspace.activities.filter(a=>!a.osLineId);
   const archived=workspace.activities.filter(a=>a.osLineId&&!incoming.has(a.osLineId));
   const added=source.activities.filter(a=>!existing.has(a.osLineId));
   if(workspace.activities.length+added.length>150)throw new Error('This workspace already has 150 activities. Remove unneeded draft activities first.');
   workspace.activities=source.activities.map(a=>{const old=existing.get(a.osLineId);return old?{...old,code:a.code,description:a.description,net:a.net,vat:a.vat,removedFromOs:false}:a}).concat(archived.map(a=>({...a,removedFromOs:true})),custom);
  }else workspace.activities=source.activities;
  workspace.meta={...workspace.meta,...source.meta};workspace.osLink=source.osLink;
  return workspace;
 }
 root.RenoweetProgressOS={unlock,read,isActive,openUrl,seed,applySeed};
})(globalThis);
