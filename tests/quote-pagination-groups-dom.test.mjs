// DOM_TEST_MODULE=/absolute/happy-dom/lib/index.js node tests/quote-pagination-groups-dom.test.mjs
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{Window}=await import(process.env.DOM_TEST_MODULE||'happy-dom'),copy=x=>JSON.parse(JSON.stringify(x));
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),html=read('Renoweet-OS-Drive-v2.2.html');
const w=new Window({url:'https://renoweet.test',width:1240,height:860,settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true,disableCSSFileLoading:true,disableJavaScriptFileLoading:true}}),d=w.document;
d.write(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));w.structuredClone=copy;w.RenoweetOSVat=require('../renoweet-os-vat-engine-v1.js');w.RenoweetPartialInvoices=require('../renoweet-partial-invoice-engine.js');w.RenoweetInvoiceClosing=require('../renoweet-invoice-closing.js');w.RenoweetCompany={html:key=>key==='companyName'?'Renoweet':'Company detail',get:()=>'',ready:Promise.resolve()};
const run=code=>vm.runInContext(code,w),main=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function blankProject()'));
for(const script of ['renoweet-project-references.js','renoweet-rich-text.js','renoweet-estimate-outline.js','renoweet-scope-photos.js','renoweet-print-layout.js'])run(read(script));
run(main.slice(main.indexOf('const HANDLE_DB='),main.indexOf('const pinActionBtn=')));
let cacheWrites=0,saves=0,cached;w.testCache=async()=>{cacheWrites++;cached=copy(run('getP()'));return true};w.testSave=()=>saves++;w.alert=m=>{throw Error(m)};
run(`cacheBrowserState=testCache;scheduleSave=testSave;toast=()=>{};const sample=blankProject();
sample.id='long-quote';sample.title='Long quotation';sample.quote.number='OFF-LONG';sample.customer.name='Test customer';
sample.estimate=Array.from({length:27},(_,i)=>({id:'line-'+i,_rid:'original-'+i,desc:(i===1?'':'Begane grond: ')+'Work item '+i,qty:i%3+1,unit:'post',rate:31.25+i,vatTreatment:i%2?'NL_HIGH':'NL_LOW',vatRate:i%2?21:9,...(i===2?{vatAmount:7.13}:{})}));
sample.scope=Array.from({length:42},(_,i)=>'### Section '+i+'\\n\\n**Keep this bold.** Scope paragraph '+i+' describes preparation, measurements, carpentry and finishing work.').join('\\n\\n');
db.projects=[sample];openProject(sample.id,'estimate');`);
const node=sel=>{const el=d.querySelector(sel);assert(el,'Missing '+sel);return el},select=(indices)=>{for(const i of indices)node('.e_group_select[data-line-index="'+i+'"]').checked=true},group=name=>{node('#estimateGroupName').value=name;w.applyEstimateGroup()};
const initial=copy(run('sample.estimate')),financial=()=>run('({quote:projectTotals(sample).total, invoice:projectTotals(sample,"invoice").total})'),before=copy(financial());
select(Array.from({length:22},(_,i)=>i===0?0:i+1));group('  Begane   grond  ');
assert.equal(run('sample.estimate[0].group'),'Begane grond');assert.equal(run('sample.estimate[1].group'),undefined);assert.equal(run('sample.estimate[2].vatAmount'),7.13);
select([23,24,25,26]);group('Eerste verdieping');assert.equal(run('sample.estimate[24].group'),'Eerste verdieping');assert.equal(saves,2);assert(cacheWrites>=2);assert.equal(cached.estimate[23].group,'Eerste verdieping');
const stored=copy(run('sample.estimate'));assert.deepEqual(stored.map(({group,...row})=>row),initial,'Grouping must not change line IDs, order, original descriptions, prices, tax or stored VAT overrides.');assert.deepEqual(copy(financial()),before);
const s0=run('documentShareSignature(sample,"quote")'),i0=run('documentShareSignature(sample,"invoice")');select([23]);w.applyEstimateGroup(true);assert.equal(run('sample.estimate[23].group'),undefined);assert.notEqual(run('documentShareSignature(sample,"quote")'),s0);assert.equal(run('documentShareSignature(sample,"invoice")'),i0);
select([23]);group('eerste VERDIEPING');assert.equal(run('sample.estimate[23].group'),'Eerste verdieping','Existing names are reused case-insensitively.');
w.mergeBase={...copy(run('sample')),estimate:initial};w.mergeLocal=copy(run('sample'));w.mergeRemote=copy(w.mergeBase);w.mergeRemote.estimate[0].rate=125;w.mergeStats={added:0,deleted:0,conflicts:0,conflictPaths:[]};
const merged=run('mergeProject3(mergeBase,mergeLocal,mergeRemote,mergeStats)');assert.equal(merged.estimate[0].group,'Begane grond');assert.equal(merged.estimate[0].rate,125);
if(process.env.XLSX_TEST_MODULE){
 w.XLSX=require(process.env.XLSX_TEST_MODULE);run(read('renoweet-drive-core-v3.0.js'));
 const wb=await run('(async()=>{const c=RenoweetDrive.blankCanonical(2026);c.os=db;return RenoweetDrive.canonicalToWorkbook(c)})()');
 const estimateSheet=wb.SheetNames.find(name=>/^Estimate ?Items$/i.test(name));assert(estimateSheet,wb.SheetNames.join(', '));
 const x=w.XLSX.read(w.XLSX.write(wb,{type:'array',bookType:'xlsx'}),{type:'array'}),lines=w.XLSX.utils.sheet_to_json(x.Sheets[estimateSheet],{defval:''});assert.equal(lines[0].Group,'Begane grond');assert.equal(lines[1].Group,'');assert.equal(lines[24].Group,'Eerste verdieping');assert.equal(lines[0]['Line ID'],'line-0');
 const legacy=run('workbook=XLSX.utils.book_new();replaceDatabaseSheets();XLSX.write(workbook,{type:"array",bookType:"xlsx"})');
 w.legacyBook=w.XLSX.read(legacy,{type:'array'});const parsed=run('(()=>{const saved=db;try{db={projects:[],bookkeeping:[],deleted:[]};workbook=legacyBook;parseWorkbook();return db.projects[0]}finally{db=saved}})()');
 assert.equal(parsed.estimate[0].group,'Begane grond');assert.equal(parsed.estimate[24].group,'Eerste verdieping');assert.equal(parsed.estimate[1].group,undefined);
}
run('switchTab("quote")');
const preview=node('.ros-quote-preview'),price=node('.ros-quote-table');
assert.deepEqual([...price.querySelectorAll('.ros-quote-group')].map(x=>x.textContent),['1. Begane grond','3. Eerste verdieping']);assert.equal(price.querySelectorAll('tbody td.qd').length,27);
assert.equal(price.querySelector('tbody td.qd').textContent,'1.1 Work item 0','A matching prefix should be omitted on the quotation.');assert.equal(run('sample.estimate[0].desc'),'Begane grond: Work item 0');
assert.equal(price.querySelector('[data-print-ungrouped] .qd').textContent,'2 Work item 1');assert(price.textContent.includes('Begane grond: Work item 23'),'A different prefix must remain visible.');
// Test the production paginator with deterministic geometry, including a logo that
// loads after Send starts and a text metric shift after the first layout pass.
const H=320,W=673,captures=[];let assetReady=false,lateFont=0,frames=0,decoded=0;
Object.defineProperties(w.HTMLImageElement.prototype,{
 complete:{configurable:true,get:()=>assetReady},naturalWidth:{configurable:true,get:()=>assetReady?100:0},
 decode:{configurable:true,value:async()=>{assert(assetReady);decoded++}}
});
w.requestAnimationFrame=fn=>{queueMicrotask(()=>{if(++frames===4)lateFont=17;fn()});return frames};
Object.defineProperty(d,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
const isPage=el=>el.classList?.contains('ros-pdf-page');
const height=el=>{
 if(isPage(el))return H;
 if(el.tagName==='TABLE')return [...el.querySelectorAll('tr')].reduce((sum,row)=>sum+height(row),0);
 if(el.tagName==='TR')return el.classList.contains('ros-quote-group')?20:24+lateFont+Math.floor((el.cells[0]?.textContent.length||0)/48)*10;
 if(el.querySelector('img'))return assetReady?78:24;
 if(/^H[1-6]$/.test(el.tagName))return 26;
 if(el.tagName==='HR')return 10;
 if(el.tagName==='P'||!el.children.length)return 8+Math.ceil((el.textContent||'').length/88)*12;
 return 4+[...el.children].reduce((sum,child)=>sum+height(child),0);
};
Object.defineProperties(w.HTMLElement.prototype,{
 clientWidth:{configurable:true,get(){return W}},clientHeight:{configurable:true,get(){return H}},
 scrollWidth:{configurable:true,get(){return W}},scrollHeight:{configurable:true,get(){return isPage(this)?Math.max(H,[...this.children].reduce((sum,child)=>sum+height(child),0)):height(this)}}
});
w.Element.prototype.getBoundingClientRect=function(){
 let top=0;for(let prev=this.previousElementSibling;prev;prev=prev.previousElementSibling)top+=height(prev);
 if(isPage(this))top=0;
 return {top,bottom:top+height(this),left:0,right:W,width:W,height:height(this)};
};
w.html2canvas=async(page,opts)=>{
 assert(assetReady);assert(decoded>0);assert.equal(opts.windowWidth,1240);assert.equal(opts.width,W);assert(page.scrollHeight<=H,'No captured page may clip.');
 for(const head of page.querySelectorAll('.ros-quote-group'))assert(head.nextElementSibling?.querySelector('td.qd'),'Group heading cannot be stranded.');
 captures.push({html:page.innerHTML,prices:[...page.querySelectorAll('td.qa')].map(td=>td.textContent),headings:[...page.querySelectorAll('.ros-quote-group')].map(td=>td.textContent)});
 return {toDataURL:()=> 'data:image/png;base64,AAAA'};
};
w.jspdf={jsPDF:class{addImage(){}addPage(){}setFont(){}setFontSize(){}setTextColor(){}text(){}output(){return new w.Blob(['mock PDF'])}}};
const downloads=[],popup={closed:false,document:{body:{}},location:{replace(url){popup.url=url}},close(){popup.closed=true}};
w.open=()=>popup;w.recordDownload=file=>downloads.push(file);
run('downloadInvoiceFile=recordDownload;sample.customer.phone="0612345678"');
const making=w.sendQuoteByWhatsApp();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(captures.length,0,'The renderer must wait for images before capture.');
const staged=d.querySelector('.ros-pdf-stage img');assert(staged,'The image must be connected in the measurement stage.');assert.equal(staged.loading,'eager');assetReady=true;staged.dispatchEvent(new w.Event('load'));
assert.equal(await making,true,'The actual Send quotation path must complete.');
const file=downloads[0];assert(file);assert.match(popup.url,/whatsapp\.com/);assert.equal(run('sample.quote.status'),'Sent');
assert.equal(file.name,'Offerte-OFF-LONG.pdf');assert.equal(file.type,'application/pdf');
assert(captures.length>8);assert(frames>=6,'A late metric shift must cause a second pagination pass.');
assert.equal(captures.flatMap(x=>x.prices).length,27);assert(captures.flatMap(x=>x.headings).includes('1. Begane grond (vervolg)'));assert(captures.some(x=>x.html.includes('Scope paragraph 41')));assert(captures.some(x=>x.html.includes('<strong>Keep this bold.</strong>')));assert(!d.querySelector('.ros-pdf-stage'),'Temporary layout is cleaned up.');
const sendPages=captures.length;await w.printQuotationClean();assert.equal(downloads[1].name,downloads[0].name);assert.equal(captures.length,sendPages*2,'Print and Send use identical pagination after assets settle.');
// Both Save as PDF and Send share the same builder. Unsupported truly wide content
// must fail cleanly rather than silently returning a cropped or partial file.
const bad=d.createElement('div');bad.innerHTML='<div class="content"><div>Unprintable</div></div>';
Object.defineProperty(w.HTMLElement.prototype,'scrollWidth',{configurable:true,get(){return isPage(this)?W+100:W}});
await assert.rejects(w.RenoweetPrintLayout.createPdf({source:bad,contentSelector:'.content',label:'Bad',fileName:'bad.pdf'}),/taller than one A4 page/);
assert(!d.querySelector('.ros-pdf-stage'));
console.log('Quotation DOM checks passed: optional groups, matching-prefix display, unchanged pricing/VAT/order, grouping merge and XLSX, quote-send signature, deferred assets and late reflow, repeated group/table headings, complete long scope and unclipped capture geometry.');
await w.happyDOM.close();
