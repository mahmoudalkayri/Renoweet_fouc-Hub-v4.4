(function(){
'use strict';
let state={year:RenoweetDrive.currentYear(),activeYear:RenoweetDrive.currentYear(),readOnly:false,sectionRevision:0,baseline:null,connected:false,saving:false,timer:null,retryTimer:null,retryAttempts:0,syncPending:false};
const status=(title,detail='')=>{try{dbState(!!state.connected,title,detail)}catch(e){const el=document.getElementById('dbStatus');if(el)el.textContent=title+(detail?' • '+detail:'')}};
const localSnapshot=()=>({projects:RenoweetDrive.clone(db.projects||[]),bookkeeping:RenoweetDrive.clone(db.bookkeeping||[]),deleted:RenoweetDrive.clone(db.deleted||[])});
function applyRemote(x,rerender=true,dirty=false){db={projects:RenoweetDrive.clone(x.projects||[]),bookkeeping:RenoweetDrive.clone(x.bookkeeping||[]),deleted:RenoweetDrive.clone(x.deleted||[])};try{resetProjectShadows()}catch(e){};if(rerender)try{render()}catch(e){};try{cacheBrowserState(!!dirty)}catch(e){}}
function clearRetry(){clearTimeout(state.retryTimer);state.retryTimer=null;state.retryAttempts=0;state.syncPending=false}
function scheduleRetry(reason='Drive verification was interrupted'){
 state.syncPending=true;clearTimeout(state.retryTimer);
 if(!state.connected||state.readOnly||navigator.onLine===false)return;
 const delays=[2000,5000,12000,30000,60000],delay=delays[Math.min(state.retryAttempts,delays.length-1)];state.retryAttempts++;
 status('Saved locally • Drive retry pending',`${reason} • retry ${state.retryAttempts} in ${Math.round(delay/1000)}s`);
 state.retryTimer=setTimeout(()=>saveDrive(false),delay)
}
function historicalBanner(){
 let el=document.getElementById('driveHistoricalBanner');
 if(state.readOnly){
  if(!el){el=document.createElement('div');el.id='driveHistoricalBanner';el.style.cssText='margin:10px 0;padding:10px 14px;border:1px solid #d6a23d;border-radius:10px;background:rgba(214,162,61,.12);font-weight:700';const host=document.getElementById('dbStatus')?.parentElement||document.querySelector('main');host?.prepend(el)}
  el.textContent=`Historical year ${state.year} — READ ONLY. Browse freely; changes cannot be saved.`;
 }else if(el)el.remove();
 const save=document.getElementById('saveNowBtn');if(save)save.disabled=!!state.readOnly;
}
async function refreshYearSelector(){
 const info=await RenoweetDrive.listAvailableYears();state.activeYear=Number(info.activeYear||RenoweetDrive.currentYear());
 const sel=document.getElementById('driveYearSelect');
 const years=[...new Set([state.year,...info.years])].sort((a,b)=>b-a);
 const html=years.map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${y}${y===state.activeYear?' — Current':' — Archive'}</option>`).join('');
 if(sel)sel.innerHTML=html;const dbsel=document.getElementById('driveYearSelectDatabase');if(dbsel)dbsel.innerHTML=html;
 historicalBanner();return info;
}
async function selectYear(year){
 year=Number(year);if(!Number.isInteger(year)||year<2000||year>2100||year===state.year)return;
 if(!RenoweetDrive.clientId())RenoweetDrive.configure();if(!RenoweetDrive.clientId())return;
 try{
  status('Loading year…',String(year));await RenoweetDrive.authorize(true);const info=await RenoweetDrive.listAvailableYears();const active=Number(info.activeYear||RenoweetDrive.currentYear());
  const remote=await RenoweetDrive.loadExistingYear(year);if(!remote){alert(`No Renoweet-${year}.json database exists in Google Drive.`);await refreshYearSelector();return}
  state.year=year;state.activeYear=active;state.readOnly=year!==active;state.connected=true;applyRemote(remote.data.os);state.sectionRevision=Number(remote.data.meta.sections.osRevision||0);state.baseline=RenoweetDrive.clone(remote.data.os);
  status(state.readOnly?`Historical ${year} • READ ONLY`:'Google Drive connected ✓',`Renoweet-${year}.json • OS revision ${state.sectionRevision} • checksum verified`);await refreshYearSelector();historicalBanner();
 }catch(e){console.error(e);alert(e.message);await refreshYearSelector()}
}

async function restoreVerifiedDriveCacheOnStartup(){
 try{
  // The legacy OS page may restore an old XLSX/local cache before this Drive adapter starts.
  // If there are genuine unsynced local edits, preserve them. Otherwise prefer the last
  // checksum-verified yearly Drive cache so a refresh shows the same data the user last
  // loaded/saved from Google Drive, even before OAuth is reconnected.
  if(typeof localCacheDirty!=='undefined' && localCacheDirty) return false;
  const cached=await RenoweetDrive.getCachedYear(state.year);
  const c=cached?.value;
  if(!c?.os || !Array.isArray(c.os.projects)) return false;
  applyRemote(c.os,false);
  state.sectionRevision=Number(c.meta?.sections?.osRevision||0);
  state.baseline=RenoweetDrive.clone(c.os);
  try{lastSyncedDb=RenoweetDrive.clone(c.os)}catch(e){}
  try{localCacheDirty=false;restoredLocalCache=false}catch(e){}
  try{render()}catch(e){}
  status('Offline Drive cache',`Renoweet-${state.year}.json • OS revision ${state.sectionRevision} • reconnect to verify latest`);
  return true;
 }catch(e){console.warn('Could not restore verified Drive cache on startup',e);return false}
}

async function connectDrive(interactive=true){
 try{
  if(!RenoweetDrive.clientId()){if(!interactive)return false;RenoweetDrive.configure()}if(!RenoweetDrive.clientId())return false;
  status('Connecting Google Drive…','Validating the manifest and authoritative file ID');
  if(!RenoweetDrive.hasAccessToken())await RenoweetDrive.authorize(interactive);
  const info=await RenoweetDrive.listAvailableYears();state.activeYear=Number(info.activeYear||RenoweetDrive.currentYear());if(!info.years.includes(state.year))state.year=state.activeYear;state.readOnly=state.year!==state.activeYear;
  const local=localSnapshot(),hasLocal=!!(local.projects.length||local.bookkeeping.length||local.deleted.length),hadDirty=typeof localCacheDirty!=='undefined'&&!!localCacheDirty;
  const remote=state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true);window.__renoweetCanonical=RenoweetDrive.clone(remote?.data||{});if(!remote)throw new Error(`Renoweet-${state.year}.json was not found.`);
  const r=remote.data.os,hasRemote=!!(r.projects?.length||r.bookkeeping?.length||r.deleted?.length),remoteRevision=Number(remote.data?.meta?.revision||0),remoteOsRevision=Number(remote.data?.meta?.sections?.osRevision||0),isTrulyNew=(remoteRevision===0&&remoteOsRevision===0&&!hasRemote);
  state.sectionRevision=remoteOsRevision;state.baseline=RenoweetDrive.clone(r);state.connected=true;
  if(!state.readOnly&&hadDirty&&hasLocal){
   const base=(typeof lastSyncedDb!=='undefined'&&lastSyncedDb)||{projects:[],bookkeeping:[],deleted:[]};
   const merged=typeof mergeDatabases==='function'?mergeDatabases(base,local,r):{merged:local,stats:{conflicts:0}};
   db=RenoweetDrive.clone(merged.merged);try{resetProjectShadows();render();await cacheBrowserState(true)}catch(e){}
   state.syncPending=true;
  }else if(!state.readOnly&&isTrulyNew&&hasLocal){
   if(interactive&&confirm(`Renoweet-${state.year}.json is new. Upload the OS data currently shown on this device as the starting OS data?`)){
    const saved=await RenoweetDrive.saveSection('os',local,{year:state.year,sectionRevision:0,forceRecovery:true,recoveryReason:'initial-os-import'});applyRemote(saved.data.os,false);state.sectionRevision=saved.sectionRevision;window.__renoweetCanonical=RenoweetDrive.clone(saved.data||window.__renoweetCanonical||{});state.baseline=RenoweetDrive.clone(saved.data.os)
   }else applyRemote(r)
  }else applyRemote(r);
  const identity=await RenoweetDrive.inspectDatabaseFiles(state.year),ignored=identity.outside.length?` • ${identity.outside.length} same-name file(s) outside Active ignored`:'';
  status(state.readOnly?`Historical ${state.year} • READ ONLY`:(hadDirty?'Local changes restored • syncing':'Google Drive connected ✓'),`Renoweet-${state.year}.json • file ${remote.file.id} • OS revision ${state.sectionRevision} • checksum verified${ignored}`);
  await refreshYearSelector();historicalBanner();const b=document.getElementById('saveNowBtn');if(b)b.disabled=state.readOnly;
  if(!state.readOnly&&hadDirty&&hasLocal)await saveDrive(false);
  return true
 }catch(e){console.error(e);state.connected=false;status(e.name==='RenoweetDuplicateDatabaseError'?'Duplicate live databases detected':'Drive not connected',e.message);if(interactive)alert(e.message);return false}
}
async function saveDrive(manual=false,expectedProjectId=''){
 if(state.readOnly){if(manual)alert(`Renoweet ${state.year} is a historical read-only year. Switch back to ${state.activeYear} to save changes.`);return false}
 // v3.6: never report a false failure merely because an autosave is already running.
 // Wait for the in-flight save, then continue with a fresh manual save so the newest UI state
 // (including a just-queued bookkeeping invoice) is definitely included and verified.
 if(state.saving){
   try{if(state.savePromise)await state.savePromise}catch(e){}
   if(!manual)return true
 }
 if(!state.connected){if(manual)await connectDrive();else return false;if(!state.connected)return false}
 clearTimeout(state.timer);
 const run=(async()=>{
  state.saving=true;
  try{
   const localOk=await cacheBrowserState(true);if(localOk===false)throw new Error('The local safety copy could not be written, so Drive sync was not started.');
   status('Saving to Drive…','Local safety copy verified first; Drive checksum verification is in progress');
   const payload=localSnapshot();if(expectedProjectId&&!payload.projects.some(p=>p.id===expectedProjectId))throw new Error(`Project ${expectedProjectId} is missing from the local save payload.`);let saved;
   try{saved=await RenoweetDrive.saveSection('os',payload,{...state,forceRecovery:manual,recoveryReason:manual?'manual-os-save':'os-autosave'})}
   catch(e){
    if(e.name!=='RenoweetConflictError')throw e;
    const remote=e.remote.data.os;if(typeof mergeDatabases!=='function')throw e;
    const merged=mergeDatabases(state.baseline||{projects:[],bookkeeping:[],deleted:[]},payload,remote);
    applyRemote(merged.merged);
    saved=await RenoweetDrive.saveSection('os',localSnapshot(),{year:state.year,sectionRevision:e.remoteSectionRevision,forceRecovery:true,recoveryReason:'os-conflict-merge'});
    if(merged.stats.conflicts&&manual)alert(`Renoweet merged ${merged.stats.conflicts} overlapping OS change(s) from another device. Review the affected project before continuing.`)
   }
   if(expectedProjectId&&!saved.data.os.projects.some(p=>p.id===expectedProjectId))throw new Error(`Drive verification completed, but project ${expectedProjectId} was not present in the saved database.`);
   applyRemote(saved.data.os,false);state.sectionRevision=saved.sectionRevision;window.__renoweetCanonical=RenoweetDrive.clone(saved.data||window.__renoweetCanonical||{});state.baseline=RenoweetDrive.clone(saved.data.os);
   try{lastSyncedDb=RenoweetDrive.clone(state.baseline)}catch(e){};try{await cacheBrowserState(false)}catch(e){}
   clearRetry();
   status('Saved to Google Drive ✓',`OS revision ${state.sectionRevision} • checksum verified • ${new Date().toLocaleTimeString()}`);
   if(manual)try{toast('Saved & verified')}catch(e){};return true
  }catch(e){console.error(e);status('Saved locally • Drive sync pending',e.message);if(!['RenoweetDuplicateDatabaseError','RenoweetDuplicateManifestError','RenoweetIntegrityError','RenoweetClosedPeriodError'].includes(e.name))scheduleRetry(e.message);if(manual)alert('The project remains saved on this device, but Drive did not confirm the sync.\n\n'+e.message);return false}
  finally{state.saving=false;state.savePromise=null}
 })();
 state.savePromise=run;return await run
}
function scheduleDriveSave(){if(state.readOnly){historicalBanner();return}try{cacheBrowserState(true)}catch(e){};state.syncPending=true;status(state.connected?'Saved locally • syncing':'Saved locally • Drive pending',state.connected?'Local copy is safe; Drive verification will start shortly.':'Local copy is safe; reconnect Drive to sync.');clearTimeout(state.timer);state.timer=setTimeout(()=>saveDrive(false),900)}
async function refreshDrive(){if(!state.connected)return connectDrive();try{const remote=state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true);window.__renoweetCanonical=RenoweetDrive.clone(remote?.data||{});if(!remote)throw new Error(`Renoweet-${state.year}.json was not found.`);if(state.readOnly||remote.data.meta.sections.osRevision!==state.sectionRevision){if(state.readOnly||confirm('A newer OS revision exists on Google Drive. Load it now?')){applyRemote(remote.data.os);state.sectionRevision=remote.data.meta.sections.osRevision;state.baseline=RenoweetDrive.clone(remote.data.os);status(state.readOnly?`Historical ${state.year} • READ ONLY`:'Refreshed from Drive ✓',`OS revision ${state.sectionRevision} • checksum verified`)}}else status('Already current ✓',`OS revision ${state.sectionRevision}`);historicalBanner()}catch(e){alert(e.message)}}
async function exportJson(){const remote=state.connected?(state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true)):null,c=remote?.data||RenoweetDrive.blankCanonical(state.year);c.os=localSnapshot();await RenoweetDrive.downloadJSON(c,`Renoweet-${state.year}-CURRENT.json`)}
async function exportXlsx(){const remote=state.connected?(state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true)):null,c=remote?.data||RenoweetDrive.blankCanonical(state.year);c.os=localSnapshot();await RenoweetDrive.downloadXLSX(c,`Renoweet-${state.year}-CURRENT.xlsx`)}
async function completeBackup(){try{if(state.connected&&!state.readOnly&&!(await saveDrive(true)))return;await RenoweetDrive.downloadCompleteBackup(state.year);try{toast('Complete ZIP backup created')}catch(e){}}catch(e){alert(e.message)}}
function driveSettings(){const id=RenoweetDrive.configure();if(id)alert('Google Client ID saved on this device. Click Connect Google Drive to authorize.')}
function newBackupHTML(){return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))"><div class="card"><h3>Live yearly database</h3><p class="small">One validated JSON database per year in your own Google Drive. Every load checks its integrity checksum before Renoweet accepts it.</p><div class="actions"><button class="btn primary" onclick="renoweetDriveOS.connect()">Connect Google Drive</button><button class="btn" onclick="renoweetDriveOS.refresh()">Refresh</button></div></div><div class="card"><h3>Restore one project</h3><p class="small">Import a Renoweet project recovery JSON. The original Project ID is preserved and duplicates are blocked.</p><input id="projectRecoveryInput" type="file" accept=".json,application/json" hidden onchange="restoreProjectRecoveryFile(this.files?.[0]);this.value=''"><button class="btn primary" onclick="document.getElementById('projectRecoveryInput').click()">Restore project file</button></div><div class="card"><h3>Complete offline backup</h3><p class="small">One ZIP contains the exact JSON database, reconstructable XLSX and manifest. Store it anywhere you control.</p><div class="actions"><button class="btn primary" onclick="renoweetDriveOS.completeBackup()">Download complete ZIP</button><button class="btn" onclick="renoweetDriveOS.exportJSON()">JSON only</button><button class="btn" onclick="renoweetDriveOS.exportXLSX()">XLSX only</button></div></div><div class="card"><h3>Recovery & multi-device safety</h3><p class="small">Renoweet keeps local IndexedDB protection plus rotating Drive recovery snapshots. Saves check section revisions and verify the uploaded checksum before success.</p><button class="btn" onclick="renoweetDriveOS.save(true)">Save now</button></div><div class="card"><h3>Year navigation</h3><p class="small">The current year is editable. Earlier yearly JSON databases open read-only so you can safely browse old projects and customers.</p><div class="actions"><select id="driveYearSelectDatabase" class="btn" onchange="renoweetDriveOS.selectYear(this.value)"><option>${state.year}</option></select></div></div><div class="card"><h3>Data ownership</h3><p class="small">Stable internal IDs are preserved for projects, customers and financial records. The manifest points all Renoweet apps to the current year and archives.</p><button class="btn" onclick="renoweetDriveOS.settings()">Drive settings</button></div></div>`}
connectWorkbook=connectDrive;saveWorkbook=saveDrive;scheduleSave=scheduleDriveSave;persist=function(){if(state.readOnly){if(state.baseline)applyRemote(state.baseline);status(`Historical ${state.year} • READ ONLY`,`Changes are not permitted in archived years`);historicalBanner();return}scheduleDriveSave();render()};backupHTML=newBackupHTML;
window.renoweetDriveOS={connect:connectDrive,save:saveDrive,refresh:refreshDrive,exportJSON:exportJson,exportXLSX:exportXlsx,completeBackup,settings:driveSettings,selectYear,state};
window.addEventListener('online',()=>{if(state.syncPending&&state.connected)saveDrive(false);else if(RenoweetDrive.hasAccessToken())connectDrive(false)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.syncPending&&state.connected)saveDrive(false)});
setTimeout(async()=>{await restoreVerifiedDriveCacheOnStartup();const c=document.getElementById('connectBtn'),r=document.getElementById('resetXlsxBtn'),e=document.getElementById('eraseLocalCacheBtn'),s=document.getElementById('saveNowBtn');if(c){c.textContent='Connect Google Drive';c.onclick=()=>connectDrive(true)}if(r){r.textContent='Drive settings';r.onclick=driveSettings}if(e){e.textContent='Complete ZIP backup';e.classList.remove('danger');e.onclick=completeBackup}if(s){s.textContent='Save now';s.onclick=()=>saveDrive(true);s.disabled=false}if(c?.parentElement&&!document.getElementById('driveYearSelect')){const sel=document.createElement('select');sel.id='driveYearSelect';sel.className=c.className||'btn';sel.style.minWidth='155px';sel.innerHTML=`<option value="${state.year}">${state.year} — Current</option>`;sel.onchange=()=>selectYear(sel.value);c.parentElement.insertBefore(sel,c)}try{const ds=document.getElementById('driveYearSelectDatabase');if(ds){ds.innerHTML=document.getElementById('driveYearSelect')?.innerHTML||`<option>${state.year}</option>`}}catch(e){}if(RenoweetDrive.hasAccessToken())await connectDrive(false);else if(state.connected)await refreshYearSelector();if(!state.baseline)status('Drive v3 ready',`Year ${state.year} • authoritative Drive file ID, local-first saves, recovery snapshots and retry protection enabled`);historicalBanner()},900);
})();

// v3.6: make “Send to bookkeeping” a verified queue action in the shared yearly JSON.
// This wrapper deliberately uses the public adapter API because the private adapter state
// lives inside the IIFE above and is not visible here.
setTimeout(()=>{
  if(typeof window.sendToBookkeeping==='function' && !window.__renoweetSendToBkWrapped){
    const original=window.sendToBookkeeping;
    window.sendToBookkeeping=async function(){
      const api=window.renoweetDriveOS;
      if(api?.state?.readOnly){alert(`Historical year ${api.state.year} is read-only.`);return}
      original.apply(this,arguments);
      if(api?.state?.connected){
        const ok=await api.save(true);
        if(ok){
          try{toast('Invoice queued for Bookkeeping ✓')}catch(e){}
        }else{
          alert('The invoice was queued locally, but Google Drive verification did not complete. Please press Save now and try again.');
        }
      }else{
        try{toast('Invoice queued locally • connect Drive to sync')}catch(e){}
      }
    };
    window.__renoweetSendToBkWrapped=true;
  }
},1200);
