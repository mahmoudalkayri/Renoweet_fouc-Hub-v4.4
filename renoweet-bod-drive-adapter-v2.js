(function(){
'use strict';
let state={year:RenoweetDrive.currentYear(),connected:false};
const DATA_KEYS=['projects','invoices','expenses','fuel','auto','payments','bookkeepingPayments','creditNotes','orders','followups'];
function emptyD(){return {sources:[],projects:[],invoices:[],expenses:[],fuel:[],auto:[],payments:[],bookkeepingPayments:[],creditNotes:[],orders:[],followups:[]}}
function ledgerKey(r,i,prefix){return String(r?.id||r?.['Payment ID']||r?.['Credit Note ID']||r?.['Record ID']||`${prefix}:${r?.invoiceId||r?.['Invoice ID']||''}:${r?.['Invoice #']||''}:${r?.date||r?.Date||''}:${r?.amount??r?.Amount??r?.gross??r?.Gross??''}:${i}`)}
function dedupeLedger(rows,prefix){let m=new Map();rows.forEach((r,i)=>m.set(ledgerKey(r,i,prefix),r));return [...m.values()]}
function dedupe(N){
  let im=new Map();
  N.invoices.sort((a,b)=>(a._priority||0)-(b._priority||0)).forEach((r,i)=>{let k=r._rid||invNo(r)||`row:${i}`;im.set(k,r)});
  N.invoices=[...im.values()];
  let pm=new Map();N.projects.forEach((r,i)=>{let k=r['Project ID']||`row:${i}`;pm.set(k,r)});N.projects=[...pm.values()];
  N.bookkeepingPayments=dedupeLedger(N.bookkeepingPayments||[],'payment');
  N.creditNotes=dedupeLedger(N.creditNotes||[],'credit');
  return N
}
function clearSource(N,name){N.sources=N.sources.filter(r=>r.name!==name);for(const k of DATA_KEYS)N[k]=N[k].filter(r=>r['Source File']!==name)}
function appendWorkbook(N,name,wb,size=0){
  const names=wb.SheetNames||[],isOS=names.includes('Projects'),isBK=names.includes('Invoices')||names.includes('Expenses');
  clearSource(N,name);
  N.sources.push({name,type:isOS&&isBK?'Renoweet archive':isOS?'Renoweet OS':isBK?'Bookkeeping':'Other Renoweet',sheets:names.length,size});
  if(isOS){
    rows(wb,'Projects').forEach(r=>N.projects.push({...r,'Source File':name}));
    rows(wb,'Payments').forEach(r=>N.payments.push({...r,'Source File':name}));
    rows(wb,'Purchase Orders').forEach(r=>N.orders.push({...r,'Source File':name}));
    rows(wb,'FollowUps').forEach(r=>N.followups.push({...r,'Source File':name}));
    rows(wb,'Bookkeeping').forEach(r=>N.invoices.push({...r,'Source File':name,_priority:1}));
  }
  if(isBK){
    rows(wb,'Invoices').forEach(r=>N.invoices.push({...r,'Source File':name,_priority:2}));
    rows(wb,'Expenses').forEach(r=>N.expenses.push({...r,'Source File':name}));
    rows(wb,'Customer Payments').forEach(r=>N.bookkeepingPayments.push({...r,'Source File':name}));
    rows(wb,'Credit Notes').forEach(r=>N.creditNotes.push({...r,'Source File':name}));
    if(wb.Sheets['Fuel'])rows(wb,'Fuel').forEach(r=>N.fuel.push({...r,'Source File':name}));
    if(wb.Sheets['Auto'])rows(wb,'Auto').forEach(r=>N.auto.push({...r,'Source File':name}));
    if(wb.Sheets['Auto & Fuel']){let af=readAF(wb.Sheets['Auto & Fuel']);af.fuel.forEach(r=>N.fuel.push({...r,'Source File':name}));af.auto.forEach(r=>N.auto.push({...r,'Source File':name}))}
  }
  return N
}
function canonicalCurrentRows(c){
  const N=emptyD(),name=`Renoweet-${c.meta.year}.json`,os=c.os||{},bk=c.bookkeeping||{};
  N.sources.push({name,type:'Live Renoweet JSON • checksum verified',sheets:0,size:0});
  (os.projects||[]).forEach(p=>{
    N.projects.push({'Project ID':p.id||'',Created:p.created||'',Updated:p.updated||'',Stage:p.stage||'',Title:p.title||'','Customer Name':p.customer?.name||'',Phone:p.customer?.phone||'',Email:p.customer?.email||'',Address:p.customer?.address||'',Description:p.description||'',Scope:p.scope||'',Notes:p.notes||'','Schedule Start':p.schedule?.start||'','Schedule End':p.schedule?.end||'','Invoice Number':p.invoice?.number||'','Invoice Date':p.invoice?.date||'','Invoice Status':p.invoice?.status||'','Quote Number':p.quote?.number||'','Quote Date':p.quote?.date||'','Quote Status':p.quote?.status||'','Source File':name});
    (p.payments||[]).forEach(x=>N.payments.push({...x,'Project ID':p.id,'Source File':name}));
    (p.purchaseOrders||[]).forEach(x=>N.orders.push({...x,'Project ID':p.id,'Source File':name}));
    (p.followUps||[]).forEach(x=>N.followups.push({...x,'Project ID':p.id,'Source File':name}));
  });
  (bk.invoices||[]).forEach(r=>N.invoices.push({...RenoweetDrive.clone(r),'Source File':name,_priority:3}));
  if(!N.invoices.length)(os.bookkeeping||[]).forEach(r=>N.invoices.push({...RenoweetDrive.clone(r),'Source File':name,_priority:2}));
  (bk.expenses||[]).forEach(r=>N.expenses.push({...RenoweetDrive.clone(r),'Source File':name}));
  (bk.fuel||[]).forEach(r=>N.fuel.push({...RenoweetDrive.clone(r),'Source File':name}));
  (bk.auto||[]).forEach(r=>N.auto.push({...RenoweetDrive.clone(r),'Source File':name}));
  (bk.payments||[]).forEach(r=>N.bookkeepingPayments.push({...RenoweetDrive.clone(r),'Source File':name}));
  (bk.creditNotes||[]).forEach(r=>N.creditNotes.push({...RenoweetDrive.clone(r),'Source File':name}));
  return dedupe(N)
}
async function connectDrive(){try{if(!RenoweetDrive.clientId())RenoweetDrive.configure();if(!RenoweetDrive.clientId())return;$('status').textContent='Connecting Google Drive • validating current database…';await RenoweetDrive.authorize(true);await refreshAll();state.connected=true}catch(e){console.error(e);$('status').textContent='Drive not connected';alert(e.message)}}
async function refreshAll(){try{
  const info=await RenoweetDrive.listAvailableYears(),years=info.years.filter(y=>y<=info.activeYear).sort((a,b)=>a-b);
  state.year=info.activeYear;
  const manifest=(await RenoweetDrive.loadManifest(false))?.data;
  let N=emptyD(),skipped=[];
  for(const y of years){
    try{
      const live=await RenoweetDrive.loadExistingYear(y);
      if(live){const source=canonicalCurrentRows(live.data);N.sources.push(...source.sources);for(const k of DATA_KEYS)N[k].push(...source[k]);continue}
      const final=manifest?.years?.[String(y)]?.final;
      if(final?.xlsxId){const bytes=await RenoweetDrive.getBytes(final.xlsxId);appendWorkbook(N,final.xlsxName||`Renoweet-${y}-FINAL.xlsx`,XLSX.read(bytes,{type:'array'}),bytes.byteLength)}
      else skipped.push(y);
    }catch(e){console.warn('Year skipped',y,e);skipped.push(y)}
  }
  if(skipped.includes(state.year)||!N.sources.some(x=>x.name===`Renoweet-${state.year}.json`))throw new Error(`The ${state.year} live database could not be verified. No new live database was created. Check the year folder and manifest.`);
  D=dedupe(N);
  $('status').textContent=`${D.sources.length} verified year source(s) • ${D.projects.length} projects • ${D.invoices.length} invoices${skipped.length?' • Missing years: '+skipped.join(', '):''}`;
  renderAll();state.connected=true;
}catch(e){console.error(e);$('status').textContent='Year data unavailable';alert(e.message)}}
async function loadLocalArchives(){return loadFiles(true)}
function settings(){const id=RenoweetDrive.configure();if(id)alert('Google Client ID saved on this device. Click Connect Google Drive to authorize.')}
window.renoweetDriveBOD={connect:connectDrive,refresh:refreshAll,localArchives:loadLocalArchives,settings,state};
setTimeout(()=>{const l=document.getElementById('loadBtn'),c=document.getElementById('clearBtn');if(l){l.textContent='Connect Google Drive';l.onclick=connectDrive}if(c){c.textContent='Clear report';c.onclick=()=>{D=emptyD();renderAll();$('status').textContent='No data loaded'}}const top=document.querySelector('header .top');if(top&&!document.getElementById('driveArchiveBtn')){const a=document.createElement('button');a.id='driveArchiveBtn';a.textContent='Add local XLSX';a.onclick=loadLocalArchives;top.appendChild(a);const s=document.createElement('button');s.textContent='Drive settings';s.onclick=settings;top.appendChild(s)}$('status').textContent=`Drive ready • verified yearly JSON and historical archives`},350);
})();
