'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../renoweet-partial-invoice-engine.js'),V=require('../renoweet-os-vat-engine-v1.js'),A=require('../renoweet-accounting-engine-v4.4.js');
const project=()=>({id:'job1',title:'Office',customer:{name:'Tim'},quote:{vat:21,travel:0,parking:0},estimate:[{id:'work',desc:'Build office',qty:1,rate:2400,vatTreatment:'NL_HIGH'}],invoice:{kind:'partial',baseNumber:'2026-0110001',number:'2026-0110001.01',date:'2026-10-01',partialAmount:500,amountBasis:'gross',paid:true,paymentDate:'2026-09-30'}});
const p=project(),d=P.issue(p);
assert.equal(d.total,500);assert.equal(d.subtotal,413.22);assert.equal(d.vat,86.78);
assert.equal(P.nextNumber(p,p.invoice.baseNumber),'2026-0110001.02');
assert.equal(V.calculate(P.previewProject(p),'invoice').total,500);
const meta=P.queueMetadata(p);assert.equal(meta['Paid amount'],500);
p.estimate[0].rate=2500;assert.equal(P.projectDocument(p).total,500);p.estimate[0].rate=2400;
p.invoice={kind:'final',number:'2026-0110001',baseNumber:'2026-0110001',date:'2026-10-20'};
const final=P.issue(p);assert.equal(final.total,2404);assert.equal(final.vat,417.22);assert.equal(final.subtotal,1986.78);
const bkDoc=(no,document,date,vatDate)=>({'Invoice #':no,'Invoice date':date,'VAT date':vatDate||date,'Lifecycle status':'issued','Line items JSON':JSON.stringify(document.lines)});
const partial=bkDoc('2026-0110001.01',d,'2026-10-01','2026-09-30'),balance=bkDoc('2026-0110001',final,'2026-10-20'),book={invoices:[partial,balance],payments:[{id:'advance',invoiceId:A.invoiceId(partial),date:'2026-09-30',amount:500}],control:{VATAccountingBasis:'invoice'}};
const q3={start:'2026-07-01',end:'2026-09-30',year:2026,quarter:3},q4={start:'2026-10-01',end:'2026-12-31',year:2026,quarter:4};
assert.equal(A.vatReport(book,q3).outputVat,86.78);assert.equal(A.vatReport(book,q4).outputVat,417.22);
assert.equal(A.cashReport(book,q3).customerCashIn,500);assert.equal(A.receivables(book,q4),2404);
assert.equal(A.annualProfitAndLoss(book,2026).revenue,2400);
book.control.VATAccountingBasis='cash';assert.equal(A.vatReport(book,q3).outputVat,86.78);assert.equal(A.vatReport(book,q4).outputVat,0);
const net=project();net.invoice.paid=false;net.invoice.amountBasis='net';assert.equal(P.projectDocument(net).total,605);assert.equal(P.projectDocument(net).vat,105);
const missing=project();missing.invoice.paymentDate='';assert.throws(()=>P.issue(missing),/date/);
const tooLarge=project();tooLarge.invoice.partialAmount=3000;assert.throws(()=>P.issue(tooLarge),/exceeds/);
const mixed=project();mixed.estimate=[{desc:'21% work',qty:1,rate:1000,vatTreatment:'NL_HIGH'},{desc:'9% work',qty:1,rate:500,vatTreatment:'NL_LOW'},{desc:'Reverse',qty:1,rate:200,vatTreatment:'REVERSE_CHARGE_NL',vatReferenceRate:21}];mixed.quote.parking=20;const md=P.issue(mixed);assert.equal(md.total,500);assert.equal(V.calculate(P.previewProject(mixed),'invoice').total,500);mixed.invoice={kind:'final'};const mf=P.projectDocument(mixed);assert.equal(A.invoiceTotals({'Line items JSON':JSON.stringify(md.lines)}).gross+A.invoiceTotals({'Line items JSON':JSON.stringify(mf.lines)}).gross,V.calculate(mixed,'invoice').total);
// Tiny advances across every VAT group must preserve the amount without negative lines.
for(const amount of [.01,.02,.03,.04,.05,.99,500]){
 const tiny=project();tiny.invoice.partialAmount=amount;tiny.estimate=[{rate:1000/1.21,vatTreatment:'NL_HIGH'},{rate:1000/1.09,vatTreatment:'NL_LOW'},{rate:1000,vatTreatment:'REVERSE_CHARGE_NL',vatReferenceRate:21},{rate:1000,vatTreatment:'REVERSE_CHARGE_NL',vatReferenceRate:9},{rate:1000,vatTreatment:'NL_ZERO'}].map((x,i)=>({...x,id:String(i),qty:1,desc:'work'}));
 const doc=P.projectDocument(tiny);assert.equal(doc.total,amount);assert.ok(doc.lines.every(l=>l.unitNet>=0&&l.vatAmount>=0));
}
for(const date of ['2026-02-01','2026-05-01','2026-09-30']){
 const food={Date:date,Category:'Food & drinks',Gross:109,VAT:9,'Income tax deductible %':100,'VAT deductible %':0,'Deductible VAT':0,'Deductible cost':109,'Deductible cost before insurance':109,'Deductible cost after insurance':109},before=JSON.stringify(food),f=A.expenseFacts(food);
 assert.equal(f.incomePct,80);assert.equal(f.deductibleCost,87.2);assert.equal(f.invoiceVat,9);assert.equal(f.deductibleVat,0);assert.equal(f.businessPaid,109);assert.equal(JSON.stringify(food),before);
 food['Food income-tax override']=true;food['Income tax deductible %']=50;food['Deductible cost before insurance']=54.5;food['Deductible cost after insurance']=54.5;assert.equal(A.expenseFacts(food).deductibleCost,54.5);
}
assert.equal(A.expenseFacts({Date:'2026-10-01',Category:'Food',Gross:100,VAT:0}).incomePct,80);
assert.equal(A.expenseFacts({Date:'2026-05-01',Category:'Materials',Gross:100,VAT:0}).deductibleCost,100);
assert.equal(A.expenseFacts({Date:'2026-03-01',Category:'Food',Gross:100,VAT:0,'Income tax deductible %':0,'Food income-tax override':true}).deductibleCost,0);
const page=fs.readFileSync(require.resolve('../Renoweet-Bookkeeping-Drive-v2.2.html'),'utf8'),adapter=fs.readFileSync(require.resolve('../renoweet-bookkeeping-drive-adapter-v3.7.js'),'utf8');
const conversion=page.slice(page.indexOf('function osInvoiceToBookkeeping('),page.indexOf('\nasync function chooseOSWorkbook'));
const payment=adapter.slice(adapter.indexOf('function recordOSAdvancePayment('),adapter.indexOf('async function syncOSFromSameDatabase'));
const context={window:{RenoweetAccounting:A},data:{payments:[]},n:Number,osDateToSerial:A.excelSerial,inferVatRate:()=>21,osInvoiceNo:r=>r['Invoice number']};vm.createContext(context);vm.runInContext(conversion+'\n'+payment,context);
const osRow={'Invoice number':'2026-0110001.01','Invoice date':'2026-10-01','Total incl VAT':500,VAT:86.78,'VAT rate':21,'Line items JSON':JSON.stringify(d.lines),...meta};const imported=context.osInvoiceToBookkeeping(osRow);
assert.equal(A.iso(imported['VAT date']),'2026-09-30');context.recordOSAdvancePayment(osRow,imported);context.recordOSAdvancePayment(osRow,imported);assert.equal(context.data.payments.length,1);assert.equal(context.data.payments[0].amount,500);assert.equal(A.invoiceState(imported,context.data.payments).status,'paid');
console.log('Partial invoices, quarter split, repeat imports and food deductions passed.');
// Render the actual OS invoice function with the extension and exercise its queue action.
const osPage=fs.readFileSync(require.resolve('../Renoweet-OS-Drive-v2.2.html'),'utf8');
for(const match of osPage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
for(const match of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
const uiProject=project();uiProject.invoice={number:'',date:'2026-10-01',dueDays:3,status:'Draft'};
const fields={},ui={RenoweetPartialInvoices:P,OSVAT:V,document:{querySelector:()=>null,querySelectorAll:()=>[]},RenoweetCompany:{html:()=>''},db:{projects:[uiProject],bookkeeping:[]},formDirty:false,$:id=>fields[id]||null,getP:()=>uiProject,today:()=> '2026-10-01',money:v=>v.toFixed(2),esc:v=>String(v??''),fmtDate:v=>v,vatTreatmentOptions:()=>'',vatTreatmentLabel:()=> 'BTW',vatBreakdownRows:t=>String(t.vat),reverseChargeNote:()=>'',scheduleSave:()=>{},renderTabs:()=>{},renoweetAllKnownInvoices:()=>[],renoweetInvoiceSeqFromNo:()=>null,nextInvoice:()=> '2026-0110001',lineid:()=> 'test',alert:message=>{throw new Error(message)},updateProjectFromVisibleForm:()=>{}};
ui.validateReverseChargeInvoice=()=>true;ui.window=ui;ui.saveProjectFromForm=()=>ui.updateProjectFromVisibleForm(uiProject);ui.projectTotals=(p,s)=>V.calculate(p,s);ui.invoiceLineItemsForBookkeeping=p=>V.invoiceLines(p);ui.sendToBookkeeping=()=>{const d=ui.projectTotals(uiProject,'invoice');ui.db.bookkeeping.push({'Invoice number':uiProject.invoice.number,'Total incl VAT':d.total,VAT:d.vat,'Line items JSON':JSON.stringify(ui.invoiceLineItemsForBookkeeping(uiProject))});return true};
vm.createContext(ui);vm.runInContext(osPage.slice(osPage.indexOf('function invoiceHTML('),osPage.indexOf('\nasync function printInvoiceClean')),ui);
ui.readEstimate=()=>{};ui.readMaterials=()=>{};ui.normalizeSalesVatTreatment=raw=>raw||'NL_HIGH';ui.vatReferenceRate=()=>21;
vm.runInContext(osPage.slice(osPage.indexOf('function updateProjectFromVisibleForm('),osPage.indexOf('function saveProjectFromForm(')),ui);
function renderFields(){
 for(const k of Object.keys(fields))delete fields[k];
 const i=uiProject.invoice;
 Object.assign(fields,{inv_number:{value:i.number||''},inv_date:{value:i.date||''},inv_due:{value:i.dueDays||3},inv_customer_vat:{value:''},inv_vat_treatment:{value:'NL_HIGH'}});
 if(i.kind==='partial')Object.assign(fields,{partial_amount:{value:String(i.partialAmount||'')},partial_basis:{value:i.amountBasis||'gross'},partial_description:{value:i.partialDescription||''},partial_paid:{checked:!!i.paid},partial_paid_date:{value:i.paymentDate||''},partial_method:{value:i.paymentMethod||'Bank'}});
 if(i.kind==='partial'){
  fields.partial_allocation_mode={value:i.allocationMode||'low-first'};
  let rows=[];try{rows=P.partialPlan(uiProject).rows}catch(e){rows=P.allocationRows(uiProject)}
  rows.forEach((r,index)=>fields['partial_line_'+index]={value:String(i.allocationMode==='custom'?(i.lineAllocations?.[r.key]||0):(r.allocatedAmount||0))});
 }
}
ui.renderTabs=renderFields;renderFields();
vm.runInContext(fs.readFileSync(require.resolve('../renoweet-partial-invoices-ui.js'),'utf8'),ui);
ui.newPartialInvoice();assert.equal(uiProject.invoice.number,'2026-0110001.01');assert(ui.invoiceHTML(uiProject).includes('partial_amount'),'A blank partial draft must open with editable fields');
uiProject.payments=[{id:'received',status:'Received',amount:500,date:'2026-09-30'}];assert(ui.invoiceHTML(uiProject).includes('partial_amount'),'Invoice must reopen after a project payment');
uiProject.invoice.partialAmount=9999;assert(ui.invoiceHTML(uiProject).includes('exceeds'),'An invalid draft stays editable');uiProject.invoice.partialAmount=0;
fields.partial_amount={value:'500'};fields.partial_basis={value:'gross'};fields.partial_description={value:'Office construction'};fields.partial_paid={checked:true};fields.partial_paid_date={value:'2026-09-30'};fields.partial_method={value:'Bank'};
ui.refreshPartialInvoice();assert(ui.invoiceHTML(uiProject).includes('DEELFACTUUR'));assert(ui.invoiceHTML(uiProject).includes('500.00'));assert(ui.invoiceHTML(uiProject).includes('2904.00'));
ui.validateReverseChargeInvoice=()=>false;assert.equal(ui.sendToBookkeeping(),false);assert.equal(uiProject.invoice.documentSnapshot,undefined,'A failed validation must leave the draft editable');assert.equal(ui.db.bookkeeping.length,0);ui.validateReverseChargeInvoice=()=>true;
ui.sendToBookkeeping();assert.equal(ui.db.bookkeeping[0]['Total incl VAT'],500);assert.equal(ui.db.bookkeeping[0]['Payment date'],'2026-09-30');
ui.newPartialInvoice();assert.equal(uiProject.invoice.number,'2026-0110001.02');assert.equal(uiProject.invoice.partialAmount,0);assert.equal(uiProject.invoice.paid,false);
ui.db.bookkeeping.push({'Invoice number':'2026-0110001.02','Project ID':'other'});fields.partial_amount.value='100';assert.throws(()=>ui.sendToBookkeeping(),/already used/);assert.equal(uiProject.invoice.documentSnapshot,undefined);ui.db.bookkeeping.pop();
ui.prepareFinalInvoice();assert.equal(uiProject.invoice.number,'2026-0110001');assert(ui.invoiceHTML(uiProject).includes('2404.00'));ui.sendToBookkeeping();assert.equal(ui.db.bookkeeping[1]['Total incl VAT'],2404);
console.log('Actual invoice screen, partial queue and final invoice flow passed.');

// Exercise the actual UI with mixed rates, mode switching, custom fields and queueing.
Object.assign(uiProject,{estimate:[{id:'low',desc:'Low-rate work',qty:1,rate:1120,vatTreatment:'NL_LOW'},{id:'high',desc:'High-rate work',qty:1,rate:2430,vatTreatment:'NL_HIGH'}],invoice:{number:'',date:'2026-10-01',status:'Draft'},invoiceDocuments:[]});ui.db.bookkeeping=[];renderFields();
ui.newPartialInvoice();assert.equal(uiProject.invoice.allocationMode,'low-first');fields.partial_amount.value='2080.55';ui.refreshPartialInvoice();
let view=ui.invoiceHTML(uiProject);assert(view.includes('BTW-verdeling van deze termijn'));assert(view.includes('Low-rate work'));assert(view.includes('High-rate work'));assert(view.includes('250.01'));assert(!view.includes('id="inv_vat_treatment"'),'The partial invoice must use its source-line rates instead of a misleading default selector');
assert.equal(fields.partial_line_0.value,'1220.8');assert.equal(fields.partial_line_1.value,'859.75');
fields.partial_allocation_mode.value='high-first';ui.refreshPartialInvoice();assert.equal(uiProject.invoice.allocationMode,'high-first');assert.equal(fields.partial_line_0.value,'0');assert.equal(fields.partial_line_1.value,'2080.55');
fields.partial_allocation_mode.value='low-first';ui.refreshPartialInvoice();fields.partial_allocation_mode.value='custom';ui.refreshPartialInvoice();assert.equal(uiProject.invoice.lineAllocations['estimate:low'],1220.8);
fields.partial_line_0.value='500';fields.partial_line_1.value='1580.55';ui.refreshPartialInvoice();assert.equal(uiProject.invoice.lineAllocations['estimate:low'],500);assert.equal(P.projectDocument(uiProject).total,2080.55);
fields.partial_line_0.value='bad';ui.refreshPartialInvoice();assert(ui.invoiceHTML(uiProject).includes('non-negative'));assert.equal(uiProject.invoice.documentSnapshot,undefined);
fields.partial_line_0.value='500';ui.refreshPartialInvoice();fields.partial_allocation_mode.value='low-first';ui.refreshPartialInvoice();ui.sendToBookkeeping();assert.equal(ui.db.bookkeeping[0].VAT,250.01);
const frozen=JSON.stringify(uiProject.invoice.documentSnapshot);fields.partial_allocation_mode.value='high-first';ui.refreshPartialInvoice();assert.equal(JSON.stringify(uiProject.invoice.documentSnapshot),frozen);
ui.newPartialInvoice();fields.partial_amount.value='2000';ui.refreshPartialInvoice();assert.equal(fields.partial_line_0.value,'0');assert.equal(fields.partial_line_1.value,'2000');ui.sendToBookkeeping();assert.equal(ui.db.bookkeeping[1].VAT,347.11);
ui.prepareFinalInvoice();ui.sendToBookkeeping();assert.equal(ui.db.bookkeeping[2]['Total incl VAT'],80.55);assert.equal(ui.db.bookkeeping[2].VAT,13.98);
console.log('Mixed-BTW allocation controls, custom editing, locked snapshots and Bookkeeping queue passed.');
