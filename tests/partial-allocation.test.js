'use strict';
const assert=require('node:assert/strict');
const P=require('../renoweet-partial-invoice-engine.js'),V=require('../renoweet-os-vat-engine-v1.js'),A=require('../renoweet-accounting-engine-v4.4.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=()=>({id:'split-job',customer:{name:'Customer'},quote:{vat:21},estimate:[{id:'low',desc:'9% work',qty:1,rate:1120,vatTreatment:'NL_LOW'},{id:'high',desc:'21% work',qty:1,rate:2430,vatTreatment:'NL_HIGH'}],invoice:{kind:'partial',number:'2026-test.01',partialAmount:2080.55,amountBasis:'gross',paid:true,paymentDate:'2026-09-25'}});
const p=sample(),first=P.issue(p);
assert.equal(first.projectTotal,4161.10);assert.equal(first.total,2080.55);assert.equal(first.vat,250.01);
assert.equal(first.allocation.mode,'low-first');assert.equal(first.lines[0].sourceKey,'estimate:low');
assert.equal(first.lines[0].unitNet,1120);assert.equal(first.lines[0].vatAmount,100.80);
assert.equal(first.lines[1].unitNet,710.54);assert.equal(first.lines[1].vatAmount,149.21);
assert.equal(P.queueMetadata(p)['Paid amount'],2080.55);
const imported=A.invoiceTotals({'Line items JSON':JSON.stringify(first.lines)});assert.equal(imported.gross,2080.55);assert.equal(imported.vat,250.01);
assert.equal(V.calculate(P.previewProject(p),'invoice').total,2080.55);
// Issued documents and JSON reloads retain the allocation even after estimate edits.
const reload=clone(p);reload.estimate[0].rate=1200;assert.deepEqual(P.projectDocument(reload),first);
p.invoice={kind:'partial',number:'2026-test.02',partialAmount:2000,amountBasis:'gross'};
const second=P.issue(p);assert.equal(second.total,2000);assert.equal(second.lines.length,1);assert.equal(second.lines[0].sourceKey,'estimate:high');assert.equal(second.vat,347.11);
p.invoice={kind:'final',number:'2026-test'};const final=P.issue(p);
assert.equal(final.total,80.55);assert.equal(final.vat,13.98);
assert.equal(V.round2(first.total+second.total+final.total),4161.10);assert.equal(V.round2(first.vat+second.vat+final.vat),611.10);
assert.equal(final.vatBreakdown.find(g=>g.treatment==='NL_LOW').vat,0);
// Clearing a line after earlier small payments consumes its exact remaining VAT.
const small=sample();small.invoice.partialAmount=100;const small1=P.issue(small);
small.invoice={kind:'partial',number:'small.02',partialAmount:1120.80};const small2=P.issue(small);
assert.equal(small2.lines.length,1);assert.equal(V.round2(small1.vat+small2.vat),100.80);
small.invoice={kind:'partial',number:'small.03',partialAmount:50};assert.equal(P.projectDocument(small).lines[0].vatRate,21);
// Alternate methods preserve the chosen total and genuine source rates.
const high=sample();high.invoice.allocationMode='high-first';const hd=P.projectDocument(high);assert.equal(hd.lines.length,1);assert.equal(hd.lines[0].vatRate,21);assert.equal(hd.total,2080.55);
const proportional=sample();proportional.invoice.allocationMode='proportional';const prop=P.projectDocument(proportional);assert.equal(prop.total,2080.55);assert.ok(prop.lines[0].unitNet<1120);
const custom=sample();custom.invoice.allocationMode='custom';custom.invoice.lineAllocations={'estimate:low':500,'estimate:high':1580.55};const cd=P.issue(custom);assert.equal(cd.total,2080.55);assert.equal(cd.allocation.rows[0].allocatedGross,500);
const invalid=sample();invalid.invoice.allocationMode='custom';invalid.invoice.lineAllocations={'estimate:low':2080.55};assert.throws(()=>P.issue(invalid),/exceeds/);assert.equal(invalid.invoice.documentSnapshot,undefined);
invalid.invoice.lineAllocations={'estimate:low':500};assert.throws(()=>P.issue(invalid),/add up/);
invalid.invoice.lineAllocations={'estimate:low':-1,'estimate:high':2081.55};assert.throws(()=>P.issue(invalid),/non-negative/);
invalid.invoice.lineAllocations={'estimate:low':'bad','estimate:high':2080.55};assert.throws(()=>P.issue(invalid),/non-negative/);
invalid.invoice.lineAllocations={'estimate:removed':2080.55};assert.throws(()=>P.issue(invalid),/no longer exists/);
const net=sample();net.invoice.paid=false;net.invoice.amountBasis='net';net.invoice.partialAmount=1800;const nd=P.projectDocument(net);assert.equal(nd.total,2043.60);assert.equal(nd.vat,243.60);assert.equal(nd.lines[0].unitNet,1120);assert.equal(nd.lines[1].unitNet,680);
// Original snapshots without source-line IDs are consumed by their actual VAT group.
const old=sample();old.invoiceDocuments=[{kind:'partial',status:'Issued',number:'legacy.01',document:{total:200,lines:[{quantity:1,unitNet:91.74,vatAmount:8.26,vatRate:9,vatTreatment:'NL_LOW'},{quantity:1,unitNet:82.64,vatAmount:17.36,vatRate:21,vatTreatment:'NL_HIGH'}]}}];
const rows=P.allocationRows(old);assert.equal(rows[0].remainingGross,1120.80);assert.equal(rows[1].remainingGross,2840.30);
old.invoice.partialAmount=1120.80;const afterOld=P.issue(old);assert.equal(afterOld.lines.length,1);assert.equal(afterOld.vat,92.54);
// Cancelled instalments free their consumed lines; reordered IDs still match.
const cancelled=clone(sample());P.issue(cancelled);cancelled.invoiceDocuments[0].status='Cancelled';cancelled.invoice={kind:'partial',partialAmount:2080.55};assert.equal(P.projectDocument(cancelled).vat,250.01);
const reordered=sample();P.issue(reordered);reordered.estimate.reverse();reordered.invoice={kind:'partial',partialAmount:100};assert.equal(P.projectDocument(reordered).lines[0].sourceKey,'estimate:high');
// Travel, parking, reverse-charge and zero-rated lines carry their own treatment.
const other=sample();other.estimate=[{id:'reverse',desc:'Reverse',qty:1,rate:50,vatTreatment:'REVERSE_CHARGE_NL',vatReferenceRate:9},{id:'zero',desc:'Zero',qty:1,rate:20,vatTreatment:'NL_ZERO'},{id:'low',desc:'Low',qty:1,rate:100,vatTreatment:'NL_LOW'}];other.quote.parking=10;other.quote.travel=10;other.invoice.partialAmount=150;
const od=P.issue(other);assert.equal(od.total,150);assert.equal(od.lines.find(l=>l.sourceKey==='estimate:reverse').vatAmount,0);assert.ok(od.lines.some(l=>l.sourceKey==='quote:parking'));
// Reconcile 1,000 varied projects with sequential advances and a final invoice.
let seed=432;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let n=0;n<1000;n++){
 const modes=['low-first','high-first','proportional'],treatments=['NL_HIGH','NL_LOW','NL_ZERO','REVERSE_CHARGE_NL'];
 const x={title:'Test',quote:{vat:21,travel:5,parking:2},estimate:Array.from({length:1+Math.floor(random()*8)},(_,i)=>({id:String(i),desc:'Work',qty:1+Math.floor(random()*3),rate:1+Math.round(random()*10000)/100,vatTreatment:treatments[Math.floor(random()*4)],vatReferenceRate:random()<.5?9:21})),invoice:{}};
 const total=V.calculate(x,'invoice');let gross=0,vat=0;
 for(let i=0;i<3;i++){
  x.invoice={kind:'partial',number:`random-${n}.${i}`,allocationMode:modes[i],partialAmount:Math.max(.01,V.round2((total.total-gross)*random()*.65))};const d=P.issue(x);
  assert.ok(d.lines.every(l=>l.unitNet>=0&&l.vatAmount>=0));gross=V.round2(gross+d.total);vat=V.round2(vat+d.vat);
 }
 x.invoice={kind:'final',number:`random-${n}`};const f=P.projectDocument(x);assert.equal(V.round2(gross+f.total),total.total);assert.equal(V.round2(vat+f.vat),total.vat);
}
// A previously printed but unissued snapshot can be reopened without losing payment data.
const locked=sample();locked.invoice.status='Draft';locked.estimate[0].vatTreatment='NL_HIGH';locked.estimate[0].vatRate=21;locked.payments=[{id:'bank',amount:2080.55,date:'2026-09-25',status:'Received'}];
const wrong=P.issue(locked),oldPayment=JSON.stringify(locked.payments),oldNumber=locked.invoice.number;assert.equal(wrong.vat,361.09);
assert.throws(()=>P.reopenDraft(locked),/Confirm/);assert.equal(P.draftReopenReason(locked),'');
P.reopenDraft(locked,{confirmedUnsent:true});assert.equal(locked.invoice.number,oldNumber);assert.equal(locked.invoice.partialAmount,2080.55);assert.equal(locked.invoice.paymentDate,'2026-09-25');assert.equal(JSON.stringify(locked.payments),oldPayment);assert.equal(locked.invoiceDocuments.length,0);assert.equal(locked.invoiceDraftRevisions[0].document.vat,361.09);
locked.estimate[0].vatTreatment='NL_LOW';locked.estimate[0].vatRate=9;const corrected=P.issue(locked);assert.equal(corrected.vat,250.01);assert.equal(corrected.projectTotal,4161.10);assert.equal(locked.invoiceDocuments.length,1);assert.equal(JSON.stringify(locked.payments),oldPayment);
for(const field of ['sharedAt','bookkeepingQueuedAt']){const sent=sample();sent.invoice.status='Draft';P.issue(sent);sent.invoice[field]='2026-10-01';const before=JSON.stringify(sent);assert.throws(()=>P.reopenDraft(sent,{confirmedUnsent:true}),/sent|shared|queued/);assert.equal(JSON.stringify(sent),before)}
const queued=sample();queued.invoice.status='Draft';P.issue(queued);assert.throws(()=>P.reopenDraft(queued,{confirmedUnsent:true,bookkeepingRows:[{'Invoice #':queued.invoice.number}]}),/Bookkeeping/);
const later=sample();later.invoice.status='Draft';P.issue(later);later.invoiceDocuments.push({number:'later.02',status:'Issued'});assert.throws(()=>P.reopenDraft(later,{confirmedUnsent:true}),/Later/);
console.log('Line allocation, legacy advances, exact BTW clearing and 1,000 final reconciliations passed.');
// Import a Bookkeeping-only correction without rewriting cash or the invoice number.
const correction=sample();correction.id='job';correction.estimate[0].vatTreatment='NL_HIGH';correction.estimate[0].vatRate=21;correction.invoice.status='Draft';correction.invoice.bookkeepingQueuedAt='2026-10-01';correction.payments=[{id:'existing',amount:2080.55}];P.issue(correction);correction.invoice.status='Sent';correction.invoiceDocuments[0].queueRow={'Invoice number':correction.invoice.number,'Sent at':'original-token'};
const good=sample(),goodDoc=P.projectDocument(good),row={'Invoice #':correction.invoice.number,'Project ID':'job','Line items JSON':JSON.stringify(A.parseLines({'Line items JSON':JSON.stringify(goodDoc.lines)})),'Gross incl. VAT':2080.55,VAT:250.01,'Invoice subtotal':1830.54,Status:'Paid'};
const unchanged=JSON.stringify(correction);assert.throws(()=>P.importBookkeepingCorrection(correction,row,{confirmedCustomerUnsent:true}),/Estimate/);assert.equal(JSON.stringify(correction),unchanged);
correction.estimate[0].vatTreatment='NL_LOW';correction.estimate[0].vatRate=9;
assert.deepEqual(P.bookkeepingDifferences(correction,[row]),[correction.invoice.number]);assert.throws(()=>P.importBookkeepingCorrection(correction,row),/Confirm/);
const cash=JSON.stringify(correction.payments),invoiceNo=correction.invoice.number;
P.importBookkeepingCorrection(correction,row,{confirmedCustomerUnsent:true});assert.equal(correction.invoice.number,invoiceNo);assert.equal(JSON.stringify(correction.payments),cash);assert.equal(correction.invoice.documentSnapshot.vat,250.01);assert.equal(correction.invoiceDraftRevisions[0].document.vat,361.09);assert.equal(correction.invoiceDocuments[0].queueRow['Sent at'],'original-token');assert.deepEqual(P.bookkeepingDifferences(correction,[row]),[]);
const full=JSON.stringify(correction);for(const bad of [{...row,'Invoice #':'wrong'},{...row,'Project ID':'another'},{...row,Status:'Credited'},{...row,VAT:999},{...row,'Line items JSON':'bad'}]){assert.throws(()=>P.importBookkeepingCorrection(correction,bad,{confirmedCustomerUnsent:true}));assert.equal(JSON.stringify(correction),full)}
const rateOnly=JSON.parse(row['Line items JSON']);rateOnly[1].unitNet=599.46;rateOnly[1].vatAmount=null;assert.throws(()=>P.bookkeepingCorrection(correction,{...row,'Line items JSON':JSON.stringify(rateOnly)}),/advance total unchanged/);
const shared=clone(correction);shared.invoice.sharedAt='today';assert.throws(()=>P.bookkeepingCorrection(shared,row),/customer/);const dependent=clone(correction);dependent.invoiceDocuments.push({number:'later',status:'Issued'});assert.throws(()=>P.bookkeepingCorrection(dependent,row),/Later/);
correction.invoice={kind:'partial',number:'corrected.02',partialAmount:2000,amountBasis:'gross'};const correctedNext=P.issue(correction);assert.equal(correctedNext.vat,347.11);assert.equal(correctedNext.lines.length,1);assert.equal(correctedNext.lines[0].vatRate,21);
correction.invoice={kind:'final',number:'corrected'};const correctedFinal=P.projectDocument(correction);assert.equal(correctedFinal.total,80.55);assert.equal(correctedFinal.vat,13.98);assert.equal(V.round2(goodDoc.vat+correctedNext.vat+correctedFinal.vat),611.10);assert.equal(JSON.stringify(correction.payments),cash);
console.log('Bookkeeping-only corrections, preserved payments, mismatch guards and subsequent instalments passed.');
// Closing statements distinguish the first estimate, actual work and invoiced advances.
const closingJob={id:'closing',quote:{vat:21},estimate:[{id:'labour',desc:'Estimated duration 6–7 days',qty:1,rate:3485.09,vatTreatment:'NL_HIGH'}],invoice:{kind:'partial',number:'close.01',partialAmount:1985.09,amountBasis:'gross',paid:false}};
const advance=P.issue(closingJob),advanceCopy=JSON.stringify(advance);assert.equal(advance.projectTotal,4216.96);
closingJob.estimate=[{id:'labour',desc:'Estimated duration 6–7 days',qty:1,rate:2000,vatTreatment:'NL_HIGH'},{id:'materials',desc:'Materials',qty:1,rate:896.77,vatTreatment:'NL_HIGH'}];
closingJob.invoice={kind:'final',number:'close',finalDescriptions:{'estimate:labour':'Labour — 5 completed working days'}};
const closingDoc=P.issue(closingJob),statement=P.closingStatement(closingJob,closingDoc);
assert.equal(statement.estimatedTotal,4216.96);assert.equal(statement.finalTotal,3505.09);assert.equal(statement.previouslyInvoiced,1985.09);assert.equal(statement.finalInvoiceTotal,1520);assert.equal(statement.instalments[0].number,'close.01');assert.equal(closingDoc.vat,263.80);
assert.equal(closingDoc.lines[0].description,'Labour — 5 completed working days');assert.equal(closingJob.estimate[0].desc,'Estimated duration 6–7 days');assert.equal(JSON.stringify(closingJob.invoiceDocuments[0].document),advanceCopy);
assert.equal(JSON.parse(P.queueMetadata(closingJob)['Closing statement JSON']).finalTotal,3505.09);
closingJob.estimate[0].rate=9999;closingJob.invoiceDocuments[0].status='Cancelled';assert.deepEqual(P.closingStatement(closingJob,P.projectDocument(closingJob)),statement);
const legacy=clone(closingDoc);delete legacy.closingStatement;assert.equal(P.closingStatement(closingJob,legacy).finalTotal,3505.09);assert.equal(P.closingStatement(closingJob,legacy).instalments[0].gross,1985.09);
const C=require('../renoweet-invoice-closing.js');assert(C.valid(statement,1520));assert(!C.valid({...statement,finalTotal:3506},1520));assert(!C.valid({...statement,instalments:[{number:'bad',gross:1}]},1520));
const escaped=C.render({...statement,instalments:[{number:'<script>',gross:1985.09}]},1520);assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));assert(escaped.includes('Eventuele onbetaalde termijnen'));assert(!escaped.includes('Reeds betaald'));
const settled=sample();P.issue(settled);settled.invoice={kind:'partial',number:'second',partialAmount:2000};P.issue(settled);settled.invoice={kind:'final',number:'final'};const mixedClosing=P.projectDocument(settled);assert(C.valid(mixedClosing.closingStatement,80.55));assert.equal(mixedClosing.closingStatement.instalments.length,2);
const zero=sample();zero.invoice.partialAmount=4161.10;P.issue(zero);zero.invoice={kind:'final'};const zeroDoc=P.projectDocument(zero);assert(C.valid(zeroDoc.closingStatement,0));assert(C.render(zeroDoc.closingStatement,0).includes('Bedrag deze eindfactuur'));
console.log('Actual final totals, description overrides, frozen closing statements, legacy documents and zero balances passed.');
