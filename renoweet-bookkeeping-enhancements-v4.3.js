/* Renoweet Bookkeeping enhancements v4.2
   - Compact Google Drive proof storage (images optimized before upload)
   - Quarter/year combined proof PDF export
   - Consume OS invoice-cancellation markers once
*/
(()=>{
'use strict';
const CLIENT_ID='819845217406-569349vod25m15sb2omm03do2h1ll976.apps.googleusercontent.com';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY='renoweetProofDriveTokenV1';
let proofDriveToken='';
let proofDriveExpires=0;
let proofTokenClient=null;
let proofFolders={};
window.__renoweetProofUploadMeta=null;

function qs(id){return document.getElementById(id)}
function tokenFromSession(){
  try{const x=JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null');if(x?.token&&Number(x.expiresAt)>Date.now()+60000){proofDriveToken=x.token;proofDriveExpires=x.expiresAt;return true}}catch(e){}
  return false;
}
function saveToken(token,expiresIn){proofDriveToken=token||'';proofDriveExpires=Date.now()+Math.max(300,Number(expiresIn)||3600)*1000;try{sessionStorage.setItem(TOKEN_KEY,JSON.stringify({token:proofDriveToken,expiresAt:proofDriveExpires}))}catch(e){}}
async function ensureProofDriveToken(interactive=true){
  if(proofDriveToken&&proofDriveExpires>Date.now()+60000)return proofDriveToken;
  if(tokenFromSession())return proofDriveToken;
  if(!window.google?.accounts?.oauth2)throw new Error('Google sign-in is still loading. Reload and try again.');
  if(!proofTokenClient)proofTokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:DRIVE_SCOPE,callback:()=>{}});
  return await new Promise((resolve,reject)=>{
    proofTokenClient.callback=(resp)=>{if(resp?.error)return reject(new Error(resp.error));saveToken(resp.access_token,resp.expires_in);resolve(proofDriveToken)};
    try{proofTokenClient.requestAccessToken({prompt:interactive?'consent':''})}catch(e){reject(e)}
  });
}
async function driveFetch(url,opts={}){
  const token=await ensureProofDriveToken(true);
  const headers=new Headers(opts.headers||{});headers.set('Authorization','Bearer '+token);
  let r=await fetch(url,{...opts,headers});
  if(r.status===401){proofDriveToken='';proofDriveExpires=0;sessionStorage.removeItem(TOKEN_KEY);const t=await ensureProofDriveToken(true);headers.set('Authorization','Bearer '+t);r=await fetch(url,{...opts,headers})}
  if(!r.ok){let msg='Google Drive error '+r.status;try{const j=await r.json();msg=j?.error?.message||msg}catch(e){}throw new Error(msg)}
  return r;
}
function escQ(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
async function findFolder(name,parent='root'){
  const q=`name='${escQ(name)}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
  const u='https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)&pageSize=20&q='+encodeURIComponent(q);
  const j=await (await driveFetch(u)).json();return j.files?.[0]||null;
}
async function createFolder(name,parent='root'){
  const body={name,mimeType:'application/vnd.google-apps.folder',parents:[parent]};
  return await (await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
}
async function ensureFolder(name,parent='root'){
  const key=parent+'|'+name;if(proofFolders[key])return proofFolders[key];
  let f=await findFolder(name,parent);if(!f)f=await createFolder(name,parent);proofFolders[key]=f.id;return f.id;
}
function quarterOfDate(ds){const d=new Date(String(ds||'').slice(0,10)+'T12:00:00');return isNaN(d)?1:Math.floor(d.getMonth()/3)+1}
function yearOfDate(ds){const d=new Date(String(ds||'').slice(0,10)+'T12:00:00');return isNaN(d)?new Date().getFullYear():d.getFullYear()}
async function ensureProofFolderForDate(ds){
  await ensureProofDriveToken(true);
  const root=await ensureFolder('Renoweet Data','root');
  const proofs=await ensureFolder('Proofs',root);
  const y=yearOfDate(ds),q=quarterOfDate(ds);
  const yf=await ensureFolder(String(y),proofs);
  return await ensureFolder('Q'+q,yf);
}
function safeBaseName(s){return String(s||'proof').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,90)}
async function optimizeImageProof(file){
  if(!/^image\//i.test(file.type||''))return file;
  const img=await createImageBitmap(file);
  let maxDim=1700,scale=Math.min(1,maxDim/Math.max(img.width,img.height));
  let w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);img.close?.();
  let blob=null;
  for(const q of [0.78,0.68,0.58]){blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',q));if(blob&&blob.size<=450000)break}
  if(blob&&blob.size>700000&&Math.max(w,h)>1300){
    const scale2=1300/Math.max(w,h),w2=Math.round(w*scale2),h2=Math.round(h*scale2);const c2=document.createElement('canvas');c2.width=w2;c2.height=h2;const x=c2.getContext('2d',{alpha:false});x.fillStyle='#fff';x.fillRect(0,0,w2,h2);x.drawImage(canvas,0,0,w2,h2);blob=await new Promise(r=>c2.toBlob(r,'image/jpeg',0.62));
  }
  if(!blob)return file;
  const base=safeBaseName(file.name.replace(/\.[^.]+$/,''));
  return new File([blob],base+'.jpg',{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
}
async function uploadProofToDrive(file,type,ds){
  const optimized=await optimizeImageProof(file);
  const parent=await ensureProofFolderForDate(ds);
  const ext=(optimized.name.match(/\.[^.]+$/)||[''])[0].toLowerCase();
  const name=`EXP-${String(ds||new Date().toISOString().slice(0,10)).replace(/-/g,'')}-${Date.now()}-${safeBaseName(type)}${ext||'.bin'}`;
  const meta={name,parents:[parent],appProperties:{renoweetType:'expense-proof',year:String(yearOfDate(ds)),quarter:'Q'+quarterOfDate(ds)}};
  const fd=new FormData();fd.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));fd.append('file',optimized,name);
  const r=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,webViewLink',{method:'POST',body:fd});
  const j=await r.json();
  return {id:j.id,name:j.name||name,size:Number(j.size)||optimized.size,mimeType:j.mimeType||optimized.type,originalSize:file.size,optimizedSize:optimized.size,webViewLink:j.webViewLink||''};
}

window.connectProofFolder=async function(){
  try{const ds=qs('expDate')?.value||new Date().toISOString().slice(0,10);await ensureProofFolderForDate(ds);const b=qs('connectProofFolderBtn');if(b)b.textContent='Proofs: Google Drive ✓';alert('Proof storage connected. New receipt photos are compressed before upload to Renoweet Data / Proofs / YEAR / Q#. PDFs stay as their original file.') ;return true}catch(e){alert('Could not connect proof storage: '+e.message);return null}
};
window.storeProofFile=async function(file,type){
  const ds=qs('expDate')?.value||new Date().toISOString().slice(0,10);
  const meta=await uploadProofToDrive(file,type,ds);window.__renoweetProofUploadMeta=meta;return meta.name;
};

async function getDriveFileBytes(id){return await (await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`)).arrayBuffer()}
async function getLocalProofBytes(name){
  try{if(typeof proofFolderHandle!=='undefined'&&proofFolderHandle){const fh=await proofFolderHandle.getFileHandle(name);return await (await fh.getFile()).arrayBuffer()}}catch(e){}
  return null;
}
function allExpenseRows(){
  const out=[];
  for(const r of (data.expenses||[]))out.push({type:'General',r});
  for(const r of (data.fuel||[]))out.push({type:'Fuel',r});
  for(const r of (data.auto||[]))out.push({type:'Automobile',r});
  return out;
}
function rowIso(r){try{return isoDate(r.Date)||''}catch(e){return ''}}
function currentQuarterInfo(){
  let q=null,y=null;
  for(const s of document.querySelectorAll('select')){const t=String(s.value||s.options?.[s.selectedIndex]?.text||'');const m=t.match(/Q([1-4])\s*(20\d{2})?/i);if(m){q=+m[1];y=+(m[2]||0)||new Date().getFullYear();break}}
  if(!q){const d=new Date();q=Math.floor(d.getMonth()/3)+1;y=d.getFullYear()}
  return {q,y};
}
function fmtEuro(v){try{return euro.format(Number(v)||0)}catch(e){return '€ '+(Number(v)||0).toFixed(2)}}
function parseMimeFromName(name){const n=String(name||'').toLowerCase();if(n.endsWith('.pdf'))return 'application/pdf';if(n.endsWith('.png'))return 'image/png';return 'image/jpeg'}
async function loadProofForRow(r){
  const id=String(r['Proof Drive ID']||'').trim(),name=String(r['Receipt/File']||'').trim();
  if(id)return {bytes:await getDriveFileBytes(id),mime:r['Proof MIME']||parseMimeFromName(name),name};
  if(!name)return null;
  const bytes=await getLocalProofBytes(name);return bytes?{bytes,mime:parseMimeFromName(name),name}:null;
}
async function exportProofsPdf(scope='quarter'){
  if(!window.PDFLib){alert('PDF merge library is still loading. Reload and try again.');return}
  const {PDFDocument,StandardFonts,rgb}=PDFLib;const {q,y}=currentQuarterInfo();
  const rows=allExpenseRows().filter(x=>{const ds=rowIso(x.r);if(!ds)return false;const d=new Date(ds+'T12:00:00');if(d.getFullYear()!==y)return false;return scope==='year'||Math.floor(d.getMonth()/3)+1===q}).sort((a,b)=>rowIso(a.r).localeCompare(rowIso(b.r)));
  if(!rows.length){alert('No expenses found for this period.');return}
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);const A4=[595.28,841.89];
  const available=rows.filter(x=>x.r['Receipt/File']),missing=rows.filter(x=>!x.r['Receipt/File']);
  let p=pdf.addPage(A4),{width,height}=p.getSize();p.drawText('Renoweet expense proofs',{x:42,y:height-55,size:24,font:bold});p.drawText(scope==='year'?`${y} full year`:`${y} Q${q}`,{x:42,y:height-85,size:15,font:bold});p.drawText(`${rows.length} expense records • ${available.length} proofs referenced • ${missing.length} missing proof`,{x:42,y:height-115,size:10,font});
  let yy=height-150;for(const x of rows){if(yy<55){p=pdf.addPage(A4);yy=height-45}const r=x.r,ds=rowIso(r);p.drawText(`${ds}  ${String(r.Supplier||'').slice(0,26)}  ${x.type}  ${fmtEuro(r.Gross)}  ${r['Receipt/File']?'proof':'MISSING'}`,{x:42,y:yy,size:8,font});yy-=13}
  let loaded=0,failed=0;
  for(let i=0;i<rows.length;i++){
    const x=rows[i],r=x.r;if(!r['Receipt/File'])continue;
    let proof;try{proof=await loadProofForRow(r)}catch(e){console.warn(e);failed++;continue}if(!proof){failed++;continue}
    const label=`${rowIso(r)} • ${r.Supplier||''} • ${x.type} • Gross ${fmtEuro(r.Gross)} • VAT ${fmtEuro(r.VAT)} • ${r['Record ID']||r['Expense ID']||''}`;
    try{
      if(String(proof.mime).includes('pdf')||String(proof.name).toLowerCase().endsWith('.pdf')){
        const src=await PDFDocument.load(proof.bytes,{ignoreEncryption:true});const pages=await pdf.copyPages(src,src.getPageIndices());pages.forEach((pg,idx)=>{pdf.addPage(pg);const hh=pg.getHeight();pg.drawRectangle({x:0,y:0,width:pg.getWidth(),height:18,color:rgb(1,1,1),opacity:.93});pg.drawText((idx===0?label:'continued • '+label).slice(0,110),{x:12,y:6,size:6,font,color:rgb(.1,.1,.1)})});
      }else{
        const u8=new Uint8Array(proof.bytes);let img;if(String(proof.mime).includes('png'))img=await pdf.embedPng(u8);else img=await pdf.embedJpg(u8);const pg=pdf.addPage(A4),s=pg.getSize();pg.drawText(label.slice(0,105),{x:36,y:s.height-38,size:8,font:bold});const maxW=s.width-72,maxH=s.height-90,scale=Math.min(maxW/img.width,maxH/img.height,1);pg.drawImage(img,{x:(s.width-img.width*scale)/2,y:32,width:img.width*scale,height:img.height*scale});
      }loaded++;
    }catch(e){console.warn('Could not merge proof',proof.name,e);failed++}
  }
  const bytes=await pdf.save({useObjectStreams:true});const blob=new Blob([bytes],{type:'application/pdf'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Renoweet-${y}-${scope==='year'?'Expense-Proofs':'Q'+q+'-Expense-Proofs'}.pdf`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200);
  alert(`Combined proof PDF created.\n\nExpense records: ${rows.length}\nProofs merged: ${loaded}\nMissing/unavailable: ${missing.length+failed}`);
}
window.exportQuarterProofsPdf=()=>exportProofsPdf('quarter');window.exportYearProofsPdf=()=>exportProofsPdf('year');
function injectProofActions(){
  const view=qs('expenses');if(!view)return;const actions=view.querySelector('.report-actions');if(!actions||qs('exportQuarterProofsBtn'))return;
  const {q,y}=currentQuarterInfo();
  const b1=document.createElement('button');b1.id='exportQuarterProofsBtn';b1.className='secondary';b1.textContent=`Export Q${q} proofs PDF`;b1.onclick=window.exportQuarterProofsPdf;
  const b2=document.createElement('button');b2.id='exportYearProofsBtn';b2.className='secondary';b2.textContent=`Export ${y} proofs PDF`;b2.onclick=window.exportYearProofsPdf;
  actions.prepend(b2);actions.prepend(b1);
  const c=[...actions.querySelectorAll('button')].find(b=>/connect proof folder/i.test(b.textContent));if(c){c.textContent='Proofs: Google Drive';c.onclick=window.connectProofFolder}
}

function processOsCancellationMarkers(){
  try{
    const c=window.__renoweetCanonical||{},rows=c.os?.bookkeeping||[];if(!Array.isArray(rows)||!rows.length)return false;
    data.control=data.control||{};const done=new Set(Array.isArray(data.control.processedOsCancellationTokens)?data.control.processedOsCancellationTokens:[]);let changed=false;
    for(const r of rows){if(String(r.Status||'').toLowerCase()!=='cancelled in os')continue;const token=String(r['Queue token']||r['Cancelled at']||r['Invoice number']||'').trim();if(!token||done.has(token))continue;const no=String(r['Invoice number']||'').trim();const idx=(data.invoices||[]).findIndex(x=>String(x['Invoice #']||'').trim()===no);
      if(idx>=0){const inv=data.invoices[idx];let closed=false;try{const d=excelDate(inv.Date);const key=d?`${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`:'';closed=!!key&&state?.periods?.[key]?.status==='closed'}catch(e){}
        if(!closed){const del=deletedRow('Invoice',inv);del.Notes=((del.Notes||'')+' • Cancelled because the related OS project was deleted.').trim();data.deleted.push(del);data.invoices.splice(idx,1);changed=true}
      }
      done.add(token);changed=true;
    }
    if(changed){data.control.processedOsCancellationTokens=[...done].slice(-500);setTimeout(()=>{try{persist()}catch(e){console.warn(e)}},0)}
    return changed;
  }catch(e){console.warn('OS cancellation reconciliation failed',e);return false}
}

const oldRender=window.render;if(typeof oldRender==='function')window.render=function(...args){processOsCancellationMarkers();const out=oldRender.apply(this,args);setTimeout(injectProofActions,0);return out};
setTimeout(()=>{injectProofActions();processOsCancellationMarkers();const b=qs('connectProofFolderBtn');if(b){b.textContent='Proofs: Google Drive';b.onclick=window.connectProofFolder}},600);
})();
