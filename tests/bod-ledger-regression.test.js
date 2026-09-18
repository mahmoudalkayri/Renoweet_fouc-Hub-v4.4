'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const A=require('../renoweet-accounting-engine-v4.4.js');

const root=path.resolve(__dirname,'..');
const bod=fs.readFileSync(path.join(root,'Renoweet-BOD-Drive-v2.2.html'),'utf8');
const adapter=fs.readFileSync(path.join(root,'renoweet-bod-drive-adapter-v2.js'),'utf8');

for(const required of [
  'payments:D.bookkeepingPayments||[]',
  'creditNotes:D.creditNotes||[]',
  'A.invoiceState(r,book.payments,book.creditNotes)',
  "states.filter(x=>x.state.status==='paid')",
  'states.filter(x=>x.state.outstanding>.009)',
  'A.vatReport(book,period)',
  'A.profitAndLoss(book,period)'
])assert.ok(bod.includes(required),`BOD must derive financial state from the accounting ledger: ${required}`);
for(const required of ['(bk.payments||[])','(bk.creditNotes||[])',"rows(wb,'Customer Payments')", "rows(wb,'Credit Notes')"])
  assert.ok(adapter.includes(required),`Drive adapter must import Bookkeeping ledger data: ${required}`);

function invoice(id,no,net,vat,status){
  return {
    'Record ID':id,'Invoice #':no,Date:'2026-08-15','Invoice date':'2026-08-15',Customer:'Q3 customer',Status:status,'Lifecycle status':'issued','Due date':'2026-08-30',
    'Line items JSON':JSON.stringify([{description:'Q3 work',quantity:1,unitNet:net,vatRate:21,vatTreatment:'CUSTOM',vatAmount:vat}])
  };
}
const invoices=[invoice('INV_1','2026-1407001',661.16,138.84,'Paid')];
for(let i=0;i<10;i++)invoices.push(invoice(`INV_${i+2}`,`2026-${String(i+2).padStart(7,'0')}`,800,168,'Open'));
invoices.push(invoice('INV_12','2026-1609012',987.62,128.81,'Open'));
const payments=invoices.map((r,i)=>({id:`PAY_${i+1}`,invoiceId:r['Record ID'],'Invoice #':r['Invoice #'],date:'2026-09-15',amount:A.invoiceTotals(r).gross,method:'Bank'}));
const expense={'Record ID':'EXP_Q3',Date:'2026-09-01','Document date':'2026-09-01',Supplier:'Q3 costs',Category:'Operating',Gross:5639.72,'Invoice VAT':951.78,VAT:951.78,'VAT deductible %':100,'Income tax deductible %':100,'Payment status':'Paid','Payment date':'2026-09-01','Receipt/File':'q3.pdf'};
const book={invoices,expenses:[expense],fuel:[],auto:[],payments,creditNotes:[],deleted:[],control:{}};
const q3={start:'2026-07-01',end:'2026-09-30'};

const storedPaid=invoices.filter(r=>String(r.Status).toLowerCase()==='paid');
const storedOpen=invoices.filter(r=>String(r.Status).toLowerCase()==='open');
assert.equal(storedPaid.reduce((s,r)=>s+A.invoiceTotals(r).net,0),661.16,'fixture must reproduce the incorrect BOD paid-revenue figure');
assert.equal(A.round2(storedOpen.reduce((s,r)=>s+A.invoiceTotals(r).gross,0)),10796.43,'fixture must reproduce the incorrect BOD open-invoice figure');

// Execute the actual BOD metricsFor() implementation against the regression fixture.
const helperStart=bod.indexOf('function expenseNet');
const periodStart=bod.indexOf('const BOD_PERIOD',helperStart);
const metricsEnd=bod.indexOf('function metrics(){',periodStart);
assert.ok(helperStart>=0&&periodStart>helperStart&&metricsEnd>periodStart,'BOD calculation functions must remain extractable for regression testing');
const bodCalcSource=bod.slice(helperStart,periodStart)+bod.slice(periodStart,metricsEnd);
const D={sources:[],projects:[],invoices,expenses:[expense],fuel:[],auto:[],payments:[],bookkeepingPayments:payments,creditNotes:[],orders:[],followups:[]};
const date=v=>{if(v instanceof Date)return v;const d=new Date(v);return isNaN(d)?null:d};
const isoMonth=v=>{const d=date(v);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:''};
const context={A,D,date,isoMonth,console,result:null};
vm.createContext(context);
vm.runInContext(`${bodCalcSource};result=metricsFor({year:2026,mode:'Q3'});`,context);
const m=context.result;

assert.equal(m.issued.length,12);
assert.equal(m.paid.length,12,'all twelve Q3 invoices must be Paid from linked Bookkeeping payments, regardless of stale stored Status');
assert.equal(m.open.length,0,'no Q3 invoice may remain open once the payment ledger settles it');
assert.equal(m.rev,9648.78,'paid revenue must equal Q3 net sales ex VAT');
assert.equal(m.openGross,0,'open invoices must be zero');
assert.equal(m.exp,4687.94,'BOD expenses must use the same accounting-core calculation as Bookkeeping');
assert.equal(m.result,4960.84,'operating result must match the Bookkeeping Q3 calculation');
assert.equal(m.outVAT,1947.65);
assert.equal(m.inVAT,951.78);
assert.equal(m.btw,995.87,'BTW position must match Bookkeeping accounting-core rounding');

console.log('BOD payment-ledger regression test passed.');
