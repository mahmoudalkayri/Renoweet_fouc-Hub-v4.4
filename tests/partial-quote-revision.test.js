'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {app}=require('./helpers/os-app-fixture.js');
const P=require('../renoweet-partial-invoice-engine.js'),V=require('../renoweet-os-vat-engine-v1.js'),A=require('../renoweet-accounting-engine-v4.4.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const q3={year:2026,quarter:3,start:'2026-07-01',end:'2026-09-30'},q4={year:2026,quarter:4,start:'2026-10-01',end:'2026-12-31'};
const project=()=>({id:'revision',quote:{vat:21},estimate:[{id:'old',desc:'Original work',qty:1,rate:1000,vatTreatment:'NL_HIGH'}],invoice:{kind:'partial',number:'2026-001.01',date:'2026-09-26',partialAmount:500,paid:true,paymentDate:'2026-09-25'},payments:[{id:'received',amount:500,date:'2026-09-25'}]});
const bookRow=(document,no='2026-001.01')=>({'Record ID':'book-'+no,'Invoice #':no,'Project ID':'revision','Invoice date':'2026-09-26','VAT date':'2026-09-25','Paid date':'2026-09-25','Gross incl. VAT':document.total,VAT:document.vat,'Invoice subtotal':document.subtotal,'Line items JSON':JSON.stringify(document.lines),Status:'Paid'});
// Source lines can shrink, disappear, move, or change VAT without rewriting earlier invoices.
for(const mode of ['shrink','replace','vat-change']){
 const p=project(),first=P.issue(p),frozen=copy(p.invoiceDocuments[0]),row=bookRow(first),rowBefore=JSON.stringify(row),cash=JSON.stringify(p.payments);
 p.estimate=mode==='shrink'?[{id:'old',desc:'Smaller first line',qty:1,rate:100,vatTreatment:'NL_HIGH'},{id:'new',desc:'New work',qty:1,rate:1900,vatTreatment:'NL_HIGH'}]:[{id:'replacement',desc:'Agreed revised work',qty:1,rate:2000,vatTreatment:mode==='vat-change'?'NL_LOW':'NL_HIGH'}];
 const revised=V.calculate(p,'invoice'),quoteBefore=JSON.stringify(p.estimate);
 assert.deepEqual(P.reconcilePostedPartials(p,[row]).issues,[]);assert.equal(P.reconcilePostedPartials(p,[row]).updated.length,0,'Re-reading unchanged posted history must be idempotent.');
 p.invoice={kind:'partial',number:'2026-001.02',date:'2026-10-22',partialAmount:600,amountBasis:'gross'};const next=P.issue(p);
 assert.equal(next.total,600);assert(next.lines.every(line=>line.unitNet>=0&&line.vatAmount>=0));
 p.invoice={kind:'final',number:'2026-001',date:'2026-10-22'};const final=P.issue(p);
 assert.equal(V.round2(first.total+next.total+final.total),revised.total);assert.equal(V.round2(first.vat+next.vat+final.vat),revised.vat);
 assert.equal(final.closingStatement.finalTotal,revised.total);assert.equal(final.closingStatement.previouslyInvoiced,1100);assert.equal(final.closingStatement.estimatedTotal,1210);
 assert.deepEqual(p.invoiceDocuments[0].document,frozen.document);assert.deepEqual(p.invoiceDocuments[0].invoice,frozen.invoice);assert.equal(JSON.stringify(row),rowBefore);assert.equal(JSON.stringify(p.payments),cash);assert.equal(JSON.stringify(p.estimate),quoteBefore);
 if(mode==='vat-change')assert(final.vatBreakdown.some(group=>group.rate===21&&group.vat<0),'The final invoice must offset the exact old VAT, even when the new work has a different rate.');
}
// Posted Bookkeeping figures are historical deductions; they never replace the new quotation.
const p=project(),original=P.issue(p),originalCopy=copy(p.invoiceDocuments[0]),posted=copy(original);posted.lines=[{id:'booked',quantity:1,unitNet:458.72,vatRate:9,vatTreatment:'NL_LOW',vatAmount:41.28}];posted.subtotal=458.72;posted.vat=41.28;posted.total=500;
const row=bookRow(posted),postedBefore=JSON.stringify(row);p.estimate=[{id:'replacement',desc:'Revised scope at the current agreed price',qty:1,rate:2000,vatTreatment:'NL_HIGH'}];const estimateBefore=JSON.stringify(p.estimate);
assert.deepEqual(P.bookkeepingDifferences(p,[row]),['2026-001.01']);assert.deepEqual(P.reconcilePostedPartials(p,[row]).issues,[]);assert.deepEqual(P.bookkeepingDifferences(p,[row]),[]);
p.invoice={kind:'final',number:'2026-001',date:'2026-10-22'};const final=P.projectDocument(p);assert.equal(final.total,1920);assert.equal(final.vat,378.72);assert.equal(final.projectTotal,2420);assert.equal(final.lines.find(line=>line.id.startsWith('deduct_')).vatAmount,-41.28);
assert.deepEqual(p.invoiceDocuments[0].document,originalCopy.document);assert.equal(p.invoiceDocuments[0].bookkeepingSnapshot.document.vat,41.28);assert.equal(JSON.stringify(row),postedBefore);assert.equal(JSON.stringify(p.estimate),estimateBefore);
const beforeBad=JSON.stringify(p);assert(P.reconcilePostedPartials(p,[{...row,VAT:999}]).issues.length);assert.equal(JSON.stringify(p),beforeBad);assert(P.reconcilePostedPartials(p,[row,row]).issues.length);assert.equal(JSON.stringify(p),beforeBad);
assert(P.reconcilePostedPartials(p,[{...row,'Project ID':'another-project'}]).issues.length);assert.equal(JSON.stringify(p),beforeBad);
assert(P.reconcilePostedPartials(p,[{...row,Status:'Cancelled'}]).issues.length);assert.equal(JSON.stringify(p),beforeBad);
const legacy=project(),legacyDoc=P.issue(legacy),scalar={'Invoice #':legacy.invoice.number,'Gross incl. VAT':legacyDoc.total,VAT:legacyDoc.vat};
assert.deepEqual(P.reconcilePostedPartials(legacy,[scalar]).issues,[],'Legacy totals matching a frozen invoice use its original VAT lines.');
assert.deepEqual(P.reconcilePostedPartials(legacy,[]).issues,[],'Unimported advances retain their original issued snapshot.');
// The global remaining project balance still limits advances, even with historical excess at one VAT rate.
p.invoice={kind:'partial',number:'too-large',partialAmount:1920.01};assert.throws(()=>P.issue(p),/exceeds/);
p.estimate=[{id:'small',qty:1,rate:100,vatTreatment:'NL_HIGH'}];p.invoice={kind:'final'};assert.throws(()=>P.projectDocument(p),/credit note/);

// Vary source IDs, amounts, VAT mixes and allocation methods after an advance.
let seed=20261022;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let sample=0;sample<400;sample++){
 const job=project();job.estimate=[0,9,21].map((rate,index)=>({id:'source-'+index,qty:1,rate:V.round2(300+random()*1500),vatRate:rate,vatTreatment:rate===9?'NL_LOW':rate===21?'NL_HIGH':'NL_ZERO'}));
 job.invoice.partialAmount=V.round2(V.calculate(job,'invoice').total*(.1+random()*.25));const original=P.issue(job),frozen=copy(job.invoiceDocuments[0]);
 job.estimate=Array.from({length:1+Math.floor(random()*5)},(_,index)=>{const rate=[0,9,21][Math.floor(random()*3)];return {id:sample%2?'replacement-'+index:'source-'+index,qty:1,rate:V.round2(500+random()*2000),vatRate:rate,vatTreatment:rate===9?'NL_LOW':rate===21?'NL_HIGH':'NL_ZERO'}});
 if(V.calculate(job,'invoice').total<original.total+50)job.estimate[0].rate=V.round2(job.estimate[0].rate+original.total+50);
 const actual=V.calculate(job,'invoice'),remaining=V.round2(actual.total-original.total),basis=sample%2?'net':'gross';
 job.invoice={kind:'partial',number:'next',partialAmount:V.round2(remaining*.3/1.21),amountBasis:basis,allocationMode:['low-first','high-first','proportional'][sample%3]};const next=P.issue(job);
 assert(next.lines.every(line=>line.unitNet>=0&&line.vatAmount>=0));
 job.invoice={kind:'final',number:'final'};const last=P.issue(job),totals=A.invoiceTotals({'Line items JSON':JSON.stringify(last.lines)});
 assert.equal(V.round2(original.total+next.total+last.total),actual.total);assert.equal(V.round2(original.vat+next.vat+last.vat),actual.vat);assert.equal(V.round2(original.subtotal+next.subtotal+last.subtotal),V.round2(actual.total-actual.vat));
 assert.equal(totals.gross,last.total);assert.equal(totals.vat,last.vat);assert.deepEqual(job.invoiceDocuments[0],frozen);
 const reloaded=copy(job);reloaded.estimate=[];assert.deepEqual(P.projectDocument(reloaded),last);
}

// Full UI + actual OS->Bookkeeping converter + actual received-payment handoff across two VAT quarters.
const ui=app(),ctx=ui.ctx,job=ui.project,fields=ui.dom.nodes;
ctx.openProject(job.id,'invoice');ctx.newPartialInvoice();fields.get('partial_amount').value='500';fields.get('partial_paid').checked=true;fields.get('partial_paid_date').value='2026-09-25';fields.get('inv_date').value='2026-09-26';ctx.refreshPartialInvoice();ctx.sendToBookkeeping();
const issued=copy(job.invoiceDocuments[0]),firstNo=job.invoice.number,firstQueue=copy(vm.runInContext('db.bookkeeping[0]',ctx));
const book={invoices:[],payments:[],creditNotes:[],expenses:[],fuel:[],auto:[],control:{VATAccountingBasis:'cash'}},bkHtml=fs.readFileSync(require.resolve('../Renoweet-Bookkeeping-Drive-v2.2.html'),'utf8'),adapter=fs.readFileSync(require.resolve('../renoweet-bookkeeping-drive-adapter-v3.7.js'),'utf8');
const converter={n:Number,osDateToSerial:A.excelSerial,inferVatRate:()=>21,osInvoiceNo:r=>r['Invoice number'],window:{RenoweetAccounting:A},data:book};vm.createContext(converter);
vm.runInContext(bkHtml.slice(bkHtml.indexOf('function osInvoiceToBookkeeping('),bkHtml.indexOf('\nasync function chooseOSWorkbook'))+'\n'+adapter.slice(adapter.indexOf('function recordOSAdvancePayment('),adapter.indexOf('async function syncOSFromSameDatabase')),converter);
function importQueue(queue){const invoice=converter.osInvoiceToBookkeeping(queue);book.invoices.push(invoice);converter.recordOSAdvancePayment(queue,invoice);return invoice}
const firstInvoice=importQueue(firstQueue),originalBook=JSON.stringify(firstInvoice),originalPayment=JSON.stringify(book.payments[0]),q3Before=A.vatReport(book,q3).outputVat;
assert.equal(q3Before,41.28);ctx.__renoweetCanonical={bookkeeping:book};
job.estimate=[{id:'new-work',desc:'Revised scope agreed after the first instalment',qty:1,rate:2000,vatTreatment:'NL_HIGH'}];
ctx.newPartialInvoice();fields.get('partial_amount').value='600';fields.get('partial_paid').checked=true;fields.get('partial_paid_date').value='2026-10-22';fields.get('inv_date').value='2026-10-22';ctx.refreshPartialInvoice();
assert(fields.get('projectTabContent').innerHTML.includes('Eerdere deelfacturen blijven ongewijzigd'));ctx.sendToBookkeeping();
const secondQueue=copy(vm.runInContext('db.bookkeeping[1]',ctx));assert.equal(secondQueue.VAT,104.13);importQueue(secondQueue);
ctx.prepareFinalInvoice();assert(fields.get('projectTabContent').innerHTML.includes('EINDFACTUUR'));assert(fields.get('projectTabContent').innerHTML.includes(firstNo));assert(fields.get('projectTabContent').innerHTML.includes(vm.runInContext('money(500)',ctx)));ctx.sendToBookkeeping();
const finalQueue=copy(vm.runInContext('db.bookkeeping[2]',ctx));assert.equal(finalQueue['Total incl VAT'],1320);assert.equal(finalQueue.VAT,274.59);const finalInvoice=importQueue(finalQueue);
book.payments.push({id:'final-payment','Invoice #':finalInvoice['Invoice #'],date:'2026-10-30',amount:1320});
assert.equal(A.vatReport(book,q3).outputVat,q3Before,'Issuing later documents must leave the earlier VAT quarter unchanged.');assert.equal(V.round2(A.vatReport(book,q3).outputVat+A.vatReport(book,q4).outputVat),420);
assert.equal(JSON.stringify(firstInvoice),originalBook);assert.equal(JSON.stringify(book.payments[0]),originalPayment);assert.deepEqual(copy(job.invoiceDocuments[0].document),issued.document);assert.deepEqual(copy(job.invoiceDocuments[0].invoice),issued.invoice);assert.deepEqual(copy(vm.runInContext('db.bookkeeping[0]',ctx)),firstQueue);
const statement=JSON.parse(finalQueue['Closing statement JSON']);assert.equal(statement.estimatedTotal,4161.10);assert.equal(statement.finalTotal,2420);assert.equal(statement.previouslyInvoiced,1100);assert.equal(statement.finalInvoiceTotal,1320);assert.equal(statement.instalments.length,2);
console.log('Quote revisions passed: frozen posted advances/VAT/payments, smaller/replaced/rerated work, exact final history, posted-bookkeeping reconciliation, overbilling guards and actual UI/import/payment/VAT-quarter integration.');
