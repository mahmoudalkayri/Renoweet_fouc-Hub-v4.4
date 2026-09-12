(function(){
'use strict';
let state={year:RenoweetDrive.currentYear(),activeYear:RenoweetDrive.currentYear(),readOnly:false,sectionRevision:0,baseline:null,connected:false,saving:false,timer:null};
const status=(title,detail='')=>{try{dbState(!!state.connected,title,detail)}catch(e){const el=document.getElementById('dbStatus');if(el)el.textContent=title+(detail?' • '+detail:'')}};
const localSnapshot=()=>({projects:RenoweetDrive.clone(db.projects||[]),bookkeeping:RenoweetDrive.clone(db.bookkeeping||[]),deleted:RenoweetDrive.clone(db.deleted||[])});
function applyRemote(x,rerender=true){db={projects:RenoweetDrive.clone(x.projects||[]),bookkeeping:RenoweetDrive.clone(x.bookkeeping||[]),deleted:RenoweetDrive.clone(x.deleted||[])};try{resetProjectShadows()}catch(e){};if(rerender)try{render()}catch(e){};try{cacheBrowserState(false)}catch(e){}}
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

async function connectDrive(){try{if(!RenoweetDrive.clientId())RenoweetDrive.configure();if(!RenoweetDrive.clientId())return;status('Connecting Google Drive…','Validating the yearly database');await RenoweetDrive.authorize(true);const info=await RenoweetDrive.listAvailableYears();state.activeYear=Number(info.activeYear||RenoweetDrive.currentYear());if(!info.years.includes(state.year))state.year=state.activeYear;state.readOnly=state.year!==state.activeYear;const remote=state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true);if(!remote)throw new Error(`Renoweet-${state.year}.json was not found.`);const r=remote.data.os,hasRemote=(r.projects?.length||r.bookkeeping?.length||r.deleted?.length),remoteRevision=Number(remote.data?.meta?.revision||0),remoteOsRevision=Number(remote.data?.meta?.sections?.osRevision||0),isTrulyNew=(remoteRevision===0&&remoteOsRevision===0&&!hasRemote),local=localSnapshot(),hasLocal=(local.projects.length||local.bookkeeping.length||local.deleted.length);if(!state.readOnly&&isTrulyNew&&hasLocal){if(confirm(`Renoweet-${state.year}.json is new. Upload the OS data currently shown on this device as the starting OS data?`)){const saved=await RenoweetDrive.saveSection('os',local,{year:state.year,sectionRevision:0,forceRecovery:true,recoveryReason:'initial-os-import'});applyRemote(saved.data.os,false);state.sectionRevision=saved.sectionRevision;state.baseline=RenoweetDrive.clone(saved.data.os)}else{applyRemote(r);state.sectionRevision=remote.data.meta.sections.osRevision;state.baseline=RenoweetDrive.clone(r)}}else{applyRemote(r);state.sectionRevision=remote.data.meta.sections.osRevision;state.baseline=RenoweetDrive.clone(r)}state.connected=true;status(state.readOnly?`Historical ${state.year} • READ ONLY`:'Google Drive connected ✓',`Renoweet-${state.year}.json • OS revision ${state.sectionRevision} • checksum verified`);await refreshYearSelector();historicalBanner();const b=document.getElementById('saveNowBtn');if(b)b.disabled=state.readOnly}catch(e){console.error(e);status('Drive not connected',e.message);alert(e.message)}}
async function saveDrive(manual=false){if(state.readOnly){if(manual)alert(`Renoweet ${state.year} is a historical read-only year. Switch back to ${state.activeYear} to save changes.`);return false}if(state.saving)return false;if(!state.connected){if(manual)await connectDrive();else return false;if(!state.connected)return false}state.saving=true;clearTimeout(state.timer);try{try{await cacheBrowserState(true)}catch(e){};status('Saving…','Local safety copy kept until Drive verification completes');const payload=localSnapshot();let saved;try{saved=await RenoweetDrive.saveSection('os',payload,{...state,forceRecovery:manual,recoveryReason:manual?'manual-os-save':'os-autosave'})}catch(e){if(e.name!=='RenoweetConflictError')throw e;const remote=e.remote.data.os;if(typeof mergeDatabases!=='function')throw e;const merged=mergeDatabases(state.baseline||{projects:[],bookkeeping:[],deleted:[]},payload,remote);applyRemote(merged.merged);saved=await RenoweetDrive.saveSection('os',localSnapshot(),{year:state.year,sectionRevision:e.remoteSectionRevision,forceRecovery:true,recoveryReason:'os-conflict-merge'});if(merged.stats.conflicts&&manual)alert(`Renoweet merged ${merged.stats.conflicts} overlapping OS change(s) from another device. Review the affected project before continuing.`)}applyRemote(saved.data.os,false);state.sectionRevision=saved.sectionRevision;state.baseline=RenoweetDrive.clone(saved.data.os);try{lastSyncedDb=RenoweetDrive.clone(state.baseline)}catch(e){};try{await cacheBrowserState(false)}catch(e){};status('Saved to Google Drive ✓',`OS revision ${state.sectionRevision} • checksum verified • ${new Date().toLocaleTimeString()}`);if(manual)try{toast('Saved & verified')}catch(e){};return true}catch(e){console.error(e);status('Save stopped',e.message);if(manual)alert('Renoweet did not overwrite anything.\n\n'+e.message);return false}finally{state.saving=false}}
function scheduleDriveSave(){if(state.readOnly){historicalBanner();return}try{cacheBrowserState(true)}catch(e){};clearTimeout(state.timer);state.timer=setTimeout(()=>saveDrive(false),900)}
async function refreshDrive(){if(!state.connected)return connectDrive();try{const remote=state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true);if(!remote)throw new Error(`Renoweet-${state.year}.json was not found.`);if(state.readOnly||remote.data.meta.sections.osRevision!==state.sectionRevision){if(state.readOnly||confirm('A newer OS revision exists on Google Drive. Load it now?')){applyRemote(remote.data.os);state.sectionRevision=remote.data.meta.sections.osRevision;state.baseline=RenoweetDrive.clone(remote.data.os);status(state.readOnly?`Historical ${state.year} • READ ONLY`:'Refreshed from Drive ✓',`OS revision ${state.sectionRevision} • checksum verified`)}}else status('Already current ✓',`OS revision ${state.sectionRevision}`);historicalBanner()}catch(e){alert(e.message)}}
async function exportJson(){const remote=state.connected?(state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true)):null,c=remote?.data||RenoweetDrive.blankCanonical(state.year);c.os=localSnapshot();await RenoweetDrive.downloadJSON(c,`Renoweet-${state.year}-CURRENT.json`)}
async function exportXlsx(){const remote=state.connected?(state.readOnly?await RenoweetDrive.loadExistingYear(state.year):await RenoweetDrive.loadYear(state.year,true)):null,c=remote?.data||RenoweetDrive.blankCanonical(state.year);c.os=localSnapshot();await RenoweetDrive.downloadXLSX(c,`Renoweet-${state.year}-CURRENT.xlsx`)}
async function completeBackup(){try{if(state.connected&&!state.readOnly&&!(await saveDrive(true)))return;await RenoweetDrive.downloadCompleteBackup(state.year);try{toast('Complete ZIP backup created')}catch(e){}}catch(e){alert(e.message)}}
function driveSettings(){const id=RenoweetDrive.configure();if(id)alert('Google Client ID saved on this device. Click Connect Google Drive to authorize.')}
function newBackupHTML(){return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))"><div class="card"><h3>Live yearly database</h3><p class="small">One validated JSON database per year in your own Google Drive. Every load checks its integrity checksum before Renoweet accepts it.</p><div class="actions"><button class="btn primary" onclick="renoweetDriveOS.connect()">Connect Google Drive</button><button class="btn" onclick="renoweetDriveOS.refresh()">Refresh</button></div></div><div class="card"><h3>Complete offline backup</h3><p class="small">One ZIP contains the exact JSON database, reconstructable XLSX and manifest. Store it anywhere you control.</p><div class="actions"><button class="btn primary" onclick="renoweetDriveOS.completeBackup()">Download complete ZIP</button><button class="btn" onclick="renoweetDriveOS.exportJSON()">JSON only</button><button class="btn" onclick="renoweetDriveOS.exportXLSX()">XLSX only</button></div></div><div class="card"><h3>Recovery & multi-device safety</h3><p class="small">Renoweet keeps local IndexedDB protection plus rotating Drive recovery snapshots. Saves check section revisions and verify the uploaded checksum before success.</p><button class="btn" onclick="renoweetDriveOS.save(true)">Save now</button></div><div class="card"><h3>Year navigation</h3><p class="small">The current year is editable. Earlier yearly JSON databases open read-only so you can safely browse old projects and customers.</p><div class="actions"><select id="driveYearSelectDatabase" class="btn" onchange="renoweetDriveOS.selectYear(this.value)"><option>${state.year}</option></select></div></div><div class="card"><h3>Data ownership</h3><p class="small">Stable internal IDs are preserved for projects, customers and financial records. The manifest points all Renoweet apps to the current year and archives.</p><button class="btn" onclick="renoweetDriveOS.settings()">Drive settings</button></div></div>`}
connectWorkbook=connectDrive;saveWorkbook=saveDrive;scheduleSave=scheduleDriveSave;persist=function(){if(state.readOnly){if(state.baseline)applyRemote(state.baseline);status(`Historical ${state.year} • READ ONLY`,`Changes are not permitted in archived years`);historicalBanner();return}scheduleDriveSave();render()};backupHTML=newBackupHTML;
window.renoweetDriveOS={connect:connectDrive,save:saveDrive,refresh:refreshDrive,exportJSON:exportJson,exportXLSX:exportXlsx,completeBackup,settings:driveSettings,selectYear,state};
setTimeout(async()=>{await restoreVerifiedDriveCacheOnStartup();const c=document.getElementById('connectBtn'),r=document.getElementById('resetXlsxBtn'),e=document.getElementById('eraseLocalCacheBtn'),s=document.getElementById('saveNowBtn');if(c){c.textContent='Connect Google Drive';c.onclick=connectDrive}if(r){r.textContent='Drive settings';r.onclick=driveSettings}if(e){e.textContent='Complete ZIP backup';e.classList.remove('danger');e.onclick=completeBackup}if(s){s.textContent='Save now';s.onclick=()=>saveDrive(true);s.disabled=false}if(c?.parentElement&&!document.getElementById('driveYearSelect')){const sel=document.createElement('select');sel.id='driveYearSelect';sel.className=c.className||'btn';sel.style.minWidth='155px';sel.innerHTML=`<option value="${state.year}">${state.year} — Current</option>`;sel.onchange=()=>selectYear(sel.value);c.parentElement.insertBefore(sel,c)}try{const ds=document.getElementById('driveYearSelectDatabase');if(ds){ds.innerHTML=document.getElementById('driveYearSelect')?.innerHTML||`<option>${state.year}</option>`}}catch(e){}if(state.connected)await refreshYearSelector();if(!state.baseline)status('Drive v3 ready',`Year ${state.year} • yearly navigation, validation, recovery snapshots, manifest and stable IDs enabled`);historicalBanner()},900);
})();

// v3.2: make “Send to bookkeeping” a verified queue action in the shared yearly JSON.
setTimeout(()=>{
  if(typeof window.sendToBookkeeping==='function' && !window.__renoweetSendToBkWrapped){
    const original=window.sendToBookkeeping;
    window.sendToBookkeeping=function(){
      if(state.readOnly){alert(`Historical year ${state.year} is read-only.`);return}
      original.apply(this,arguments);
      if(state.connected){
        clearTimeout(state.timer);
        saveDrive(true).then(ok=>{if(ok)try{toast('Invoice queued for Bookkeeping ✓')}catch(e){}});
      }else{
        try{toast('Invoice queued locally • connect Drive to sync')}catch(e){}
      }
    };
    window.__renoweetSendToBkWrapped=true;
  }
},1200);
