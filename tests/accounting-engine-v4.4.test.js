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

assert.deepEqual(A.invoiceTotals(invoice),{net:900,vat:177,gross:1077,lines:A.parseLines(invoice)});
assert.equal(A.vatReport(book,period).outputVat,177,'issued invoices must enter VAT before payment');
assert.equal(A.vatReport(book,period).inputVat,10.5,'VAT return must use deductible VAT');
assert.equal(A.expenseFacts(expense).deductibleCost,88.4,'non-deductible VAT must remain in the cost base');
assert.equal(A.profitAndLoss(book,period).revenue,900,'P&L must recognise issued revenue');
assert.equal(A.cashReport(book,period).cashIn,0,'unpaid issued invoice must not count as cash');

book.payments.push({id:'PAY_1',invoiceId:'INV_1',date:'2026-09-13',amount:500,method:'Bank'});
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).status,'partially_paid');
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).outstanding,577);
assert.equal(A.cashReport(book,period).cashIn,500);

book.creditNotes.push({id:'CRN_1',invoiceId:'INV_1',date:'2026-09-14',net:100,vat:21,gross:121});
assert.equal(A.vatReport(book,period).outputVat,156);
assert.equal(A.profitAndLoss(book,period).revenue,800);
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).outstanding,456);

console.log('Accounting engine v4.4 tests passed.');
