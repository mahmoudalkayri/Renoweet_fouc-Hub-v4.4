/* Saves the browser copy first; sync is a separate, retryable operation. */
(function(root){
 'use strict';
 const STORAGE='renoweet-progress-drive-enabled-v1';
 function mount(host){
  const enabled=()=>localStorage.getItem(STORAGE)==='1';
  let running=null,timer,status='',problem='',resolution=null;
  const engine=root.RenoweetProgressDrive;
  function show(text,detail=''){
   status=text;problem=detail;
   for(const node of document.querySelectorAll('[data-progress-drive-status]')){node.textContent=text;node.title=detail;}
  }
  function stateLabel(){
   if(status)return status;
   if(running)return 'Syncing reports…';
   const sync=host.state()?.driveSync;
   if(sync?.syncedAt)return 'Drive copy · reconnect to sync';
   return 'Reports on this device';
  }
  function panel(){
   const sync=host.state()?.driveSync,stamp=sync?.syncedAt&&new Date(sync.syncedAt).toLocaleString(),e=host.escape;
   return `<section class="card progress-drive-card"><div class="card-head"><div><div class="eyebrow">Report storage</div><h2>Google Drive</h2><p class="muted">Sync reports, drafts, and photos in a separate Progress Reports folder in your Renoweet Drive. The browser copy works offline.</p></div></div><p class="notice" data-progress-drive-status>${e(stateLabel())}</p>${stamp?`<p class="muted">Last verified sync: ${e(stamp)}</p>`:''}${problem?`<p class="notice error">${e(problem)}</p>`:''}<p class="muted">Use the same Google account on each device. Deleting a workspace here does not erase its Drive backup.</p>${resolution?`<p class="notice">Both copies changed the same draft or setting. Saved reports are kept from both. Download your browser backup first if you want both draft versions.</p><ul>${resolution.slice(0,8).map(path=>`<li>${e(path)}</li>`).join('')}</ul>`:''}</section>`;
  }
  function settings(){
   host.modal('Progress Reports storage',panel(),
    `<button data-action="backup">Export JSON</button>${resolution?`<button data-action="prefer-progress-device">Keep this device’s draft</button><button data-action="prefer-progress-drive">Keep Drive’s draft</button>`:''}<button class="primary" data-action="sync-progress-drive">Connect / Sync now</button>`);
  }
  async function sync({interactive=false,prefer,readOnly=false}={}){
   if(running)return running;
   clearTimeout(timer);timer=null;
   if(!interactive&&!enabled())return false;
   const core=root.RenoweetDrive;
   if(!core?.progressStore||!engine){show('Drive unavailable','Reload this page before attempting to connect.');return false}
   if(root.navigator?.onLine===false){show('Saved locally · offline');return false}
   if(!interactive&&!core.hasAccessToken()){show('Drive needs reconnecting');return false}
   running=(async()=>{
    try{
     show('Syncing reports…');await host.flush();
     if(!core.hasAccessToken())await (core.authorizeProgress?core.authorizeProgress():core.authorize(true));
     // Never apply an older snapshot over input entered during the upload.
     const start=host.capture();
     if(!start)return false;
     const result=await engine.sync({store:core.progressStore(),workspace:start.workspace,known:start.workspace.driveSync||{},hash:core.sha256Text,validate:host.validate,prefer,readOnly});
     const applied=await host.apply(result,start);
     if(!applied){show('Browser edits · sync pending','Finish editing, then use Connect / Sync now.');return false}
     localStorage.setItem(STORAGE,'1');resolution=null;
     show('Saved to Google Drive ✓');
     if(interactive)host.closeModal?.();
     if(interactive)host.notify('Reports and photos verified on Google Drive.');
     return true;
    }catch(error){
     const message=String(error?.message||error);
     resolution=error?.name==='ProgressDriveConflict'?error.paths||[]:null;
     show(resolution?'Review draft changes':'Drive sync pending',message);
     if(interactive){if(!readOnly)settings();else host.notify(message,true)}
     return false;
    }finally{running=null}
   })();
   return running;
  }
  function schedule(){
   clearTimeout(timer);
   if(!enabled())return;
   if(resolution)return;
   show(root.navigator?.onLine===false?'Saved locally · offline':'Saved locally · Drive pending');
   timer=setTimeout(()=>sync(),3500);
  }
  function start(){
   if(enabled()&&root.RenoweetDrive?.hasAccessToken())sync();
   root.addEventListener('online',()=>{if(!resolution)sync()});
   document.addEventListener('focusout',event=>{if(!resolution&&enabled()&&event.target.matches?.('input,textarea,select'))schedule()});
   root.addEventListener('focus',()=>{if(!resolution&&enabled()&&root.RenoweetDrive?.hasAccessToken()){clearTimeout(timer);timer=setTimeout(()=>sync(),1200)}});
  }
  return {sync,settings,schedule,stateLabel,start};
 }
 root.RenoweetProgressDriveUI={mount};
})(globalThis);
