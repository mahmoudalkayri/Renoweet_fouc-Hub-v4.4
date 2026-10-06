(function(){
  'use strict';
  const safeImage=value=>/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(String(value||''))?value:'';
  const esc=value=>window.RenoweetText.escape(value);
  function editor(project){
    const photos=project.scopePhotos||[];
    return `<div class="field"><label>Scope photos and descriptions</label><input type="file" id="rwScopePhotoUpload" accept="image/*" multiple><p class="small">Photos are saved with this project and included in the quotation. Four photos with ordinary captions fit on each A4 page; longer descriptions continue without clipping.</p><div class="rw-scope-photo-editor">${photos.map(photo=>`<figure data-scope-photo="${esc(photo.id)}"><img src="${safeImage(photo.dataUrl)}" alt="${esc(photo.name||'Scope photo')}"><label>Description<textarea data-scope-photo-caption>${esc(photo.caption||'')}</textarea></label><button type="button" class="btn danger" data-scope-photo-remove>Remove photo</button></figure>`).join('')}</div></div>`;
  }
  function pages(project){
    const photos=(project.scopePhotos||[]).filter(photo=>safeImage(photo.dataUrl));let out='';
    for(let at=0;at<photos.length;at+=4){out+=`<section class="ros-quote-page"><div class="ros-quote-content"><h2>Scope — foto's ${at+1}–${Math.min(at+4,photos.length)}</h2><div class="ros-scope-photos">${photos.slice(at,at+4).map((photo,i)=>`<figure><img src="${safeImage(photo.dataUrl)}" alt="${esc(photo.name||'Scope photo')}"><figcaption><strong>Foto ${at+i+1}</strong>${photo.caption?'\n'+esc(photo.caption):''}</figcaption></figure>`).join('')}</div></div></section>`;}
    return out;
  }
  async function compress(file){
    const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Photo could not be read.'));reader.readAsDataURL(file);});
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This image format is not supported.'));img.src=url;});
    const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);
  }
  function protect(project=getP()){
    if(!project)return;
    project.updated=nowStamp();
    if(getP()?.id===project.id){formDirty=true;saveProjectDraftRecoveryNow();}
    else {localCacheDirty=true;cacheBrowserState(true);}
    scheduleSave();
  }
  document.addEventListener('change',async event=>{
    if(event.target.id!=='rwScopePhotoUpload')return;
    const p=getP(),files=[...event.target.files];event.target.value='';if(!p)return;
    updateProjectFromVisibleForm(p);event.target.disabled=true;
    try{for(const file of files){if(!file.type.startsWith('image/'))continue;const dataUrl=await compress(file);p.scopePhotos=p.scopePhotos||[];p.scopePhotos.push({id:lineid(),name:file.name,caption:'',dataUrl});protect(p);}if(getP()?.id===p.id)renderTabs();toast('Scope photos saved locally; connect Drive to sync.');}
    catch(error){toast(error.message);}finally{event.target.disabled=false;}
  });
  document.addEventListener('input',event=>{if(!event.target.matches('[data-scope-photo-caption]'))return;const p=getP(),photo=p?.scopePhotos?.find(item=>item.id===event.target.closest('[data-scope-photo]').dataset.scopePhoto);if(photo){photo.caption=event.target.value;formDirty=true;scheduleSave();}});
  document.addEventListener('click',event=>{if(!event.target.closest('[data-scope-photo-remove]'))return;const p=getP();if(!p)return;updateProjectFromVisibleForm(p);const id=event.target.closest('[data-scope-photo]').dataset.scopePhoto;p.scopePhotos=(p.scopePhotos||[]).filter(photo=>photo.id!==id);protect();renderTabs();});
  window.RenoweetScopePhotos={editor,pages,safeImage,compress};
})();
