'use strict';
const assert=require('node:assert/strict');
const A=require('../renoweet-accounting-engine-v4.4.js');

const invoice={
  'Record ID':'INV_1','Invoice #':'2026-1209001',Date:'2026-09-12',Customer:'Test','Due date':'2026-09-20',Status:'Open',
  'Line items JSON':JSON.stringify([
    {description:'Labour',quantity:2,unitNet:400,vatRate:21,vatTreatment:'NL_HIGH'},
    {description:'Materials',quantity:1,unitNet:100,vatRate:9,vatTreatment:'NL_LOW'}
  ])
};
const expense={'Record ID':'EXP_1',Date:'2026-09-12',Supplier:'Supplier',Category:'Materials',Gross:121,VAT:21,'VAT deductible %':50,'Income tax deductible %':80,'Receipt/File':'receipt.pdf'};
const book={invoices:[invoice],expenses:[expense],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}};
const period={start:'2026-07-01',end:'2026-09-30'};

assert.equal(A.excelSerial('2026-01-01'),46023,'calendar date must convert to a whole Excel day without timezone drift');
assert.equal(A.iso(A.excelSerial('2026-01-01')),'2026-01-01','Excel date must round-trip to the same calendar date');
assert.deepEqual(A.invoiceTotals(invoice),{net:900,vat:177,gross:1077,lines:A.parseLines(invoice)});
assert.equal(A.vatReport(book,period).outputVat,177,'issued invoices must enter VAT before payment');
assert.equal(A.vatReport(book,period).inputVat,10.5,'VAT return must use deductible VAT');
assert.equal(A.expenseFacts(expense).deductibleCost,88.4,'non-deductible VAT must remain in the cost base');
assert.equal(A.profitAndLoss(book,period).revenue,900,'P&L must recognise issued revenue');
assert.equal(A.cashReport(book,period).cashIn,0,'unpaid issued invoice must not count as cash');

const legacyParkingInvoice={
  'Record ID':'INV_LEGACY_PARKING','Invoice #':'2026-0101001',Date:'2026-01-01',Customer:'Nextgenhome',Status:'Paid',
  'Gross incl. VAT':2588.57,VAT:357,Parking:531.57,'Other costs':0,'VAT rate':21,'Work description':'Carpentry work'
};
assert.deepEqual(A.invoiceSalesBreakdown(legacyParkingInvoice),{
  taxableNet:1700,zeroRatedNet:531.57,net:2231.57,vat:357,gross:2588.57
},'legacy parking must be visible as a separate 0%-VAT invoice cost without changing the invoice total');

book.payments.push({id:'PAY_1',invoiceId:'INV_1',date:'2026-09-13',amount:500,method:'Bank'});
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).status,'partially_paid');
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).outstanding,577);
assert.equal(A.cashReport(book,period).cashIn,500);

book.creditNotes.push({id:'CRN_1',invoiceId:'INV_1',date:'2026-09-14',net:100,vat:21,gross:121});
assert.equal(A.vatReport(book,period).outputVat,156);
assert.equal(A.profitAndLoss(book,period).revenue,800);
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).outstanding,456);

const overpaidBook={invoices:[invoice],expenses:[],fuel:[],auto:[],payments:[{id:'PAY_TOO_MUCH',invoiceId:'INV_1',date:'2026-09-15',amount:5000}],creditNotes:[],deleted:[],control:{}};
assert.equal(A.invoiceState(invoice,overpaidBook.payments,[]).overpaid,3923,'invoice state must expose an overpayment');
assert.ok(A.controls(overpaidBook,new Date('2026-09-16'),period).issues.some(x=>x.kind==='payments'&&x.level==='error'&&x.message.includes('overpaid')),'control must flag existing overpayments');

const q4Invoice={...invoice,'Record ID':'INV_Q4','Invoice #':'2026-0110002',Date:'2026-10-01'};
book.invoices.push(q4Invoice);
const q4={start:'2026-10-01',end:'2026-12-31'};
assert.equal(A.receivables(book,period),456,'receivables must include only invoices issued in the selected period');
assert.equal(A.receivables(book,q4),1077,'changing quarter must change displayed receivables');
assert.equal(A.periodRows(book,q4).invoices.length,1,'invoice table period rows must exclude other quarters');
assert.ok(A.controls(book,new Date('2026-10-02'),q4).issues.every(x=>x.id!=='INV_1'),'quarter controls must exclude records from other quarters');

const insuredDirect={
  'Record ID':'EXP_INS_DIRECT',Date:'2026-09-15',Supplier:'Garage',Category:'Vehicle',Gross:6192.36,'Invoice VAT':1074.71,
  'VAT deductible %':100,'Income tax deductible %':100,'Insurance contribution':5117.65,'Insurance payment route':'Direct to supplier',
  'Business amount paid':1074.71,'Payment status':'Paid','Payment date':'2026-09-15','Receipt/File':'garage.pdf','Insurance company':'Insurer'
};
const directFacts=A.expenseFacts(insuredDirect);
assert.equal(directFacts.deductibleVat,1074.71,'insurance must not reduce invoice VAT');
assert.equal(directFacts.deductibleCost,0,'insurance contribution must reduce the net business cost');
assert.equal(directFacts.businessPaid,1074.71,'direct insurer payment must leave only the business-paid amount as cash out');
const directBook={invoices:[],expenses:[insuredDirect],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}};
assert.equal(A.cashReport(directBook,period).cashOut,1074.71);
assert.equal(A.cashReport(directBook,period).cashIn,0,'direct insurer-to-garage payment is not Renoweet cash received');
assert.equal(A.profitAndLoss(directBook,period).operatingExpenses,0);

const insuredReimbursed={...insuredDirect,'Record ID':'EXP_INS_REIMB','Insurance payment route':'Reimbursed Renoweet','Business amount paid':6192.36,'Insurance settlement date':'2026-09-16'};
const reimbursedBook={invoices:[],expenses:[insuredReimbursed],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}};
const reimbursedCash=A.cashReport(reimbursedBook,period);
assert.equal(reimbursedCash.cashOut,6192.36);
assert.equal(reimbursedCash.insuranceCashIn,5117.65);
assert.equal(reimbursedCash.movement,-1074.71,'reimbursement route must preserve the same net cash effect');

console.log('Accounting engine v4.4.1 tests passed.');
