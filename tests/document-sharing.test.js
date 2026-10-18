'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const V=require('../renoweet-os-vat-engine-v1.js'),P=require('../renoweet-partial-invoice-engine.js'),A=require('../renoweet-accounting-engine-v4.4.js');
const source=fs.readFileSync(require.resolve('../Renoweet-OS-Drive-v2.2.html'),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fixture=()=>({id:'job',title:'Kitchen & painting',stage:'Lead',customer:{name:'Client & family',phone:'06 1234 5678',email:'client@example.test'},quote:{number:'OFF-2026-001',date:'2026-10-18',vat:21,parking:0,travel:0,status:'Draft'},estimate:[{id:'low',desc:'Painting',qty:1,rate:1120,vatTreatment:'NL_LOW'},{id:'high',desc:'Floor',qty:1,rate:2430,vatTreatment:'NL_HIGH'}],invoice:{kind:'partial',number:'2026-001.01',date:'2026-10-18',partialAmount:500,amountBasis:'gross',status:'Draft',paid:false}});
function app({mobile=false,blocked=false}={}){
 const p=fixture(),events=[],alerts=[],activity=[],downloads=[],anchor={},nodes=new Map();
 for(const id of ['sendChoiceModal','sendChoiceInfo','sendChoiceActions'])nodes.set(id,{classList:{add:()=>events.push('fallback-open'),remove:()=>{}},innerHTML:'',textContent:'',querySelector:()=>anchor});
 const popup={closed:false,opener:{},document:{title:'',body:{textContent:''}},location:{replace:url=>{events.push('navigate');popup.url=url}},close:()=>{popup.closed=true}};
 const company={bankAccount:'NL45INGB0111929547',accountName:'Owner & Name',phone:'06 43865003',website:'www.renoweet.nl'};
 let resolvePdf,rejectPdf;const pdf=()=>{events.push('pdf');return new Promise((resolve,reject)=>{resolvePdf=resolve;rejectPdf=reject})};
 const ctx={console:{error:()=>{}},Intl,URL,Date,navigator:{userAgent:mobile?'iPhone':'Desktop',maxTouchPoints:mobile?1:0},innerWidth:mobile?390:1200,document:{getElementById:id=>nodes.get(id)||null,querySelector:()=>null},getP:()=>p,saveProjectFromForm:()=>{},validateReverseChargeDocument:()=>true,validateReverseChargeInvoice:()=>true,renderTabs:()=>events.push('render'),requestAnimationFrame:fn=>fn(),nextQuote:()=> 'OFF-NEW',nextInvoice:()=> '2026-NEW',today:()=> '2026-10-18',money:v=>Number(v).toFixed(2),esc:escape,toast:()=>{},alert:m=>alerts.push(m),scheduleSave:()=>{},addActivity:(...args)=>activity.push(args),RenoweetCompany:{get:k=>company[k]||'',html:k=>escape(company[k]||''),ready:Promise.resolve()},projectTotals:(project,kind='quote')=>kind==='invoice'?P.projectDocument(project):V.calculate(project,'quote'),downloadInvoiceFile:file=>downloads.push(file),makeRenoweetQuotePdfFile:pdf,makeRenoweetInvoicePdfFile:pdf};
 ctx.open=(url,target)=>{events.push('open');assert.equal(url,'about:blank');assert.equal(target,'_blank');assert(!events.includes('pdf'),'Popup must open during the click, before waiting for PDF generation.');return blocked?null:popup};ctx.window=ctx;
 vm.createContext(ctx);
 for(const [start,end] of [['function quoteShareMessage(','function invoiceHTML('],['function invoiceIsPaid(','function normalizeWhatsAppNumber('],['function normalizeWhatsAppNumber(','function smartSendInvoice('],['async function nativeShareInvoice(','async function sendInvoiceByEmail('],['async function sendInvoiceByEmail(','function documentsHTML(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),ctx);
 return {ctx,p,events,alerts,activity,downloads,popup,anchor,nodes,finish:()=>resolvePdf({name:'document.pdf'}),fail:()=>rejectPdf(new Error('PDF failed'))};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function connectAutosave(test){
 const ctx=test.ctx,clone=value=>value==null?value:JSON.parse(JSON.stringify(value));let revision=0;
 Object.assign(ctx,{db:{projects:[test.p],bookkeeping:[],deleted:[]},currentProjectId:test.p.id,formDirty:false,
  RenoweetDrive:{currentYear:()=>2026,clone,hasAccessToken:()=>false,saveSection:async(_section,payload)=>{
   const os=clone(payload),project=os.projects[0];project.customer={id:'verified-customer',...Object.fromEntries(Object.entries(project.customer).reverse())};project.estimate.forEach(line=>{line._rid='verified-'+line.id});project.updated='2026-10-18T19:40:00Z';
   return {data:{os,meta:{sections:{osRevision:++revision}}},sectionRevision:revision};}},
  setTimeout:()=>0,clearTimeout:()=>{},addEventListener:()=>{},cacheBrowserState:async()=>true,resetProjectShadows:()=>{},render:()=>{},dbState:()=>{},
  connectWorkbook:()=>{},saveWorkbook:()=>{},persist:()=>{},backupHTML:()=>{},lastSyncedDb:null});
 ctx.document.addEventListener=()=>{};ctx.getP=()=>ctx.db.projects.find(project=>project.id===ctx.currentProjectId);
 vm.runInContext(fs.readFileSync(require.resolve('../renoweet-os-drive-adapter-v3.6.js'),'utf8'),ctx);
 const api=ctx.renoweetDriveOS;api.state.connected=true;api.state.baseline=clone(ctx.db);return api;
}
(async()=>{
 // A normal Drive save clones the same project and adds IDs; this is not a quote edit.
 const refreshing=app();let ready;refreshing.ctx.RenoweetCompany.ready=new Promise(resolve=>{ready=resolve});
 const refreshingSend=refreshing.ctx.sendQuoteByWhatsApp(),fresh=JSON.parse(JSON.stringify(refreshing.p));
 fresh.customer={id:'drive-customer',...fresh.customer};fresh._rid='drive-record';fresh.estimate[0]._rid='drive-line';fresh.updated='2026-10-18T19:35:00Z';
 refreshing.ctx.getP=()=>fresh;ready();await tick();assert(refreshing.events.includes('pdf'),'A checksum-verified Drive refresh must not be mistaken for an edited quotation.');
 refreshing.finish();assert.equal(await refreshingSend,true);assert.equal(fresh.quote.status,'Sent');assert.equal(refreshing.p.quote.status,'Draft','Sharing must update the current project, not a detached pre-save copy.');
 // Use the actual Drive adapter to complete a background save while each PDF is being made.
 for(const kind of ['quote','invoice']){
  const concurrent=app(),drive=connectAutosave(concurrent),send=kind==='quote'?concurrent.ctx.sendQuoteByWhatsApp():concurrent.ctx.sendInvoiceByWhatsApp();
  await tick();assert(concurrent.events.includes('pdf'));assert.equal(await drive.save(false),true);
  const current=concurrent.ctx.getP();assert.notEqual(current,concurrent.p,'The integration must exercise the real adapter replacing the project object.');
  concurrent.finish();assert.equal(await send,true,`${kind} sharing must survive a verified background Drive save.`);
  assert.equal((kind==='quote'?current.quote:current.invoice).status,'Sent');assert.equal((kind==='quote'?concurrent.p.quote:concurrent.p.invoice).status,'Draft');
  assert.equal(concurrent.alerts.length,0);assert.equal(concurrent.downloads.length,1);assert(new URL(concurrent.popup.url).searchParams.get('text').includes(kind==='quote'?'4161.10':'500.00'));
 }
 const desktop=app(),originalMoney=JSON.stringify(desktop.p.estimate),sent=desktop.ctx.sendQuoteByWhatsApp();await tick();
 assert(desktop.events.indexOf('open')<desktop.events.indexOf('pdf'));assert.equal(await desktop.ctx.sendQuoteByWhatsApp(),false); // rapid second click is ignored
 desktop.finish();assert.equal(await sent,true);assert.equal(desktop.events.filter(e=>e==='open').length,1);
 const url=new URL(desktop.popup.url),message=url.searchParams.get('text');
 assert.equal(url.hostname,'web.whatsapp.com');assert.equal(url.searchParams.get('phone'),'31612345678');
 for(const text of ['OFF-2026-001','4161.10','IBAN: NL45INGB0111929547','Rekeninghouder: Owner & Name','Client & family'])assert(message.includes(text),text);
 assert(!message.includes('&amp;'),'Messages must use copyable plain company details.');assert.equal(desktop.downloads.length,1);assert.equal(desktop.p.quote.status,'Sent');assert.equal(JSON.stringify(desktop.p.estimate),originalMoney);
 const mobile=app({mobile:true});mobile.ctx.navigator.share=()=>{throw new Error('WhatsApp must open its own chat rather than a generic share sheet')};const phoneSend=mobile.ctx.sendQuoteByWhatsApp();await tick();mobile.finish();assert.equal(await phoneSend,true);const mobileUrl=new URL(mobile.popup.url);assert.equal(mobileUrl.hostname,'wa.me');assert.equal(mobileUrl.pathname,'/31612345678');assert(mobileUrl.searchParams.get('text').includes('4161.10'));
 const blocked=app({blocked:true}),blockedSend=blocked.ctx.sendQuoteByWhatsApp();await tick();blocked.finish();assert.equal(await blockedSend,false);assert.equal(blocked.p.quote.status,'Draft','A blocked popup must not mark the quotation sent before the user opens its fallback link.');assert(blocked.nodes.get('sendChoiceActions').innerHTML.includes('https://web.whatsapp.com/send?'));blocked.anchor.onclick();assert.equal(blocked.p.quote.status,'Sent');blocked.anchor.onclick();assert.equal(blocked.activity.length,1);
 const failed=app(),failedSend=failed.ctx.sendQuoteByWhatsApp();await tick();failed.fail();assert.equal(await failedSend,false);assert.equal(failed.popup.closed,true);assert.equal(failed.p.quote.status,'Draft');assert.equal(failed.downloads.length,0);
 const edited=app(),editedSend=edited.ctx.sendQuoteByWhatsApp();await tick();edited.p.estimate[0].rate=900;edited.finish();assert.equal(await editedSend,false);assert.equal(edited.p.quote.status,'Draft');assert.equal(edited.downloads.length,0,'Do not share a PDF that no longer matches the current quote.');
 const remoteEdit=app(),remoteSend=remoteEdit.ctx.sendQuoteByWhatsApp();await tick();const changed=JSON.parse(JSON.stringify(remoteEdit.p));changed.estimate[0].rate=900;remoteEdit.ctx.getP=()=>changed;remoteEdit.finish();assert.equal(await remoteSend,false);assert.equal(remoteEdit.downloads.length,0,'A real price change in a replacement project must still stop sharing.');assert.equal(changed.quote.status,'Draft');
 const background=app();background.ctx.requestAnimationFrame=()=>{};const backgroundSend=background.ctx.sendQuoteByWhatsApp();await tick();assert(background.events.includes('pdf'),'A background tab must not wait indefinitely for animation frames before creating its PDF.');background.finish();assert.equal(await backgroundSend,true);
 const missing=app();missing.p.customer.phone='---';assert.equal(await missing.ctx.sendQuoteByWhatsApp(),false);assert(!missing.events.includes('open'));assert(!missing.events.includes('pdf'));
 const cancelled=app({mobile:true});cancelled.ctx.navigator.canShare=()=>true;cancelled.ctx.navigator.share=async()=>{const e=new Error('Cancelled');e.name='AbortError';throw e};const emailSend=cancelled.ctx.sendQuoteByEmail();await tick();cancelled.finish();assert.equal(await emailSend,false);assert.equal(cancelled.p.quote.status,'Draft');assert.equal(cancelled.activity.length,0);
 const email=app(),mailSend=email.ctx.sendQuoteByEmail();await tick();email.finish();assert.equal(await mailSend,true);const mail=new URL(email.popup.url);assert.equal(mail.searchParams.get('to'),'client@example.test');assert(mail.searchParams.get('body').includes('4161.10'));
 const cancelledInvoice=app({mobile:true});Object.assign(cancelledInvoice.ctx,{RenoweetPartialInvoices:P,RenoweetOSVat:V,OSVAT:V,db:{projects:[cancelledInvoice.p],bookkeeping:[]},updateProjectFromVisibleForm:()=>{},renoweetAllKnownInvoices:()=>[],renoweetInvoiceSeqFromNo:()=>null});
 vm.runInContext(fs.readFileSync(require.resolve('../renoweet-partial-invoices-ui.js'),'utf8'),cancelledInvoice.ctx);
 cancelledInvoice.ctx.navigator.canShare=()=>true;cancelledInvoice.ctx.navigator.share=async()=>{const e=new Error('Cancelled');e.name='AbortError';throw e};
 const cancelledInvoiceSend=cancelledInvoice.ctx.sendInvoiceByEmail();await tick();cancelledInvoice.finish();assert.equal(await cancelledInvoiceSend,false);assert.equal(cancelledInvoice.p.invoice.sharedAt,undefined,'Cancelling a share must not mark an unissued invoice as shared.');assert.equal(P.draftReopenReason(cancelledInvoice.p,[]),'','An unsent invoice must remain reopenable after a cancelled share.');
 // Actual OS invoice renderer: paid flags, matching bookkeeping payments, partial balances and separate invoice numbers.
 const os=app();os.ctx.OSVAT=V;os.ctx.fmtDate=v=>v;os.ctx.vatTreatmentOptions=()=>'';os.ctx.vatTreatmentLabel=()=>'';os.ctx.vatBreakdownRows=()=>'';os.ctx.reverseChargeNote=()=>'';
 vm.runInContext(source.slice(source.indexOf('function invoiceHTML('),source.indexOf('\nasync function printInvoiceClean')),os.ctx);
 os.p.invoice.paid=true;let preview=os.ctx.invoiceHTML(os.p);assert(preview.includes('<strong>Deze factuur is volledig betaald.</strong>'));assert(!preview.includes('NL45INGB0111929547'));assert(!preview.includes('incassokosten'));
 const paidMessage=os.ctx.invoiceShareMessage(os.p,true);assert(paidMessage.includes('*Deze factuur is volledig betaald. U hoeft niets meer te betalen.*'));assert(!paidMessage.includes('IBAN:'));
 os.p.invoice.paid=false;assert(os.ctx.invoiceHTML(os.p).includes('NL45INGB0111929547'));
 os.ctx.__renoweetCanonical={bookkeeping:{invoices:[{'Record ID':'invoice','Invoice #':'2026-001.01','Gross incl. VAT':500,Status:'Paid'}],payments:[{invoiceId:'invoice',amount:250}],creditNotes:[]}};
 assert.equal(os.ctx.invoiceIsPaid(os.p),false,'A stale Paid label cannot hide a remaining balance.');os.ctx.__renoweetCanonical.bookkeeping.payments[0].amount=500;assert.equal(os.ctx.invoiceIsPaid(os.p),true);
 os.p.invoice.number='2026-001';assert.equal(os.ctx.invoiceIsPaid(os.p),false,'A paid instalment must not mark the final invoice paid.');
 // Actual Bookkeeping preview uses payment records without rewriting invoice totals.
 const bkSource=fs.readFileSync(require.resolve('../renoweet-bookkeeping-v4.4.js'),'utf8'),host={innerHTML:''},bk={A,data:{payments:[],creditNotes:[]},html:escape,money:v=>v.toFixed(2),byId:()=>host,invoiceLogoSrc:()=>'',lineTreatment:l=>l.vatTreatment,vatTreatmentLabel:()=>'',openModal:()=>{},window:{RenoweetCompany:os.ctx.RenoweetCompany}};vm.createContext(bk);vm.runInContext(bkSource.slice(bkSource.indexOf('function showInvoicePreviewV44('),bkSource.indexOf('\nfunction injectExpenseFields(')),bk);
 const row={'Record ID':'invoice','Invoice #':'2026-001',Date:'2026-10-18','Gross incl. VAT':121,VAT:21,Status:'Open'},unchanged=JSON.stringify(row);bk.data.payments=[{invoiceId:'invoice',amount:121}];bk.showInvoicePreviewV44(row);assert(host.innerHTML.includes('<strong>Deze factuur is volledig betaald.</strong>'));assert(!host.innerHTML.includes('NL45INGB0111929547'));assert.equal(JSON.stringify(row),unchanged);
 bk.data.payments[0].amount=50;bk.showInvoicePreviewV44(row);assert(host.innerHTML.includes('NL45INGB0111929547'));assert(!host.innerHTML.includes('Deze factuur is volledig betaald.'));
 console.log('Document sharing passed: actual Drive autosave during quote/invoice sharing, stable project identity, background tabs, click-time popup, desktop/mobile prefilled chat, exact quote total and plain bank details, PDF failures/edits, blocked-popup fallback, duplicate clicks, email cancellation, paid previews and separate instalment balances.');
})().catch(error=>{console.error(error);process.exitCode=1});
