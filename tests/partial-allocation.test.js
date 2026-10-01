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
console.log('Line allocation, legacy advances, exact BTW clearing and 1,000 final reconciliations passed.');
