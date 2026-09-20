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
  taxableNet:1700,zeroRatedNet:531.57,reverseChargeNet:0,net:2231.57,vat:357,gross:2588.57
},'legacy parking must be visible as a separate 0%-VAT invoice cost without changing the invoice total');

const legacyPaidInvoice={...legacyParkingInvoice,'Paid date':'2026-01-04'};
const legacyPaidBook={invoices:[legacyPaidInvoice],expenses:[],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}};
assert.equal(A.paymentTotal(legacyPaidInvoice,legacyPaidBook.payments),0,'a Paid label alone must never invent a cash payment');
assert.equal(A.cashReport(legacyPaidBook,{start:'2026-01-01',end:'2026-03-31'}).cashIn,0,'cash must come only from dated payment ledger rows');
assert.equal(A.migrateLegacyPaidInvoices(legacyPaidBook).length,1,'a legacy Paid invoice with a paid date must receive one safe payment row');
assert.equal(A.migrateLegacyPaidInvoices(legacyPaidBook).length,0,'legacy payment migration must be idempotent');
assert.equal(A.paymentTotal(legacyPaidInvoice,legacyPaidBook.payments),2588.57);
assert.equal(A.invoiceState(legacyPaidInvoice,legacyPaidBook.payments,[]).status,'paid');
assert.equal(A.cashReport(legacyPaidBook,{start:'2026-01-01',end:'2026-03-31'}).cashIn,2588.57);
assert.equal(A.paymentReconciliation(legacyPaidBook)[0].status,'ok');

const wrongDatePaidBook={invoices:[legacyPaidInvoice],expenses:[],fuel:[],auto:[],payments:[{id:'PAY_WRONG_DATE',invoiceId:'INV_LEGACY_PARKING','Invoice #':'2026-0101001',date:'2026-04-01',amount:2588.57}],creditNotes:[],deleted:[],control:{}};
const wrongDateRec=A.paymentReconciliation(wrongDatePaidBook)[0];
assert.equal(wrongDateRec.status,'date_mismatch','a Paid invoice must be flagged when its Paid date and ledger settlement date disagree');
assert.equal(wrongDateRec.paidDate,'2026-01-04');
assert.equal(wrongDateRec.settlementDate,'2026-04-01');
assert.ok(A.controls(wrongDatePaidBook,new Date('2026-04-02'),{start:'2026-01-01',end:'2026-03-31'}).issues.some(x=>x.kind==='payments'&&x.message.includes('Paid date 2026-01-04')),'Control must expose payment-date mismatches');

const timingBook={invoices:[{...legacyPaidInvoice,'Record ID':'INV_TIMING','Invoice #':'2026-TIMING','Paid date':'2026-04-05'}],expenses:[],fuel:[],auto:[],payments:[{id:'PAY_TIMING_Q1',invoiceId:'INV_TIMING','Invoice #':'2026-TIMING',date:'2026-03-31',amount:100},{id:'PAY_TIMING_Q2',invoiceId:'INV_TIMING','Invoice #':'2026-TIMING',date:'2026-04-05',amount:2488.57}],creditNotes:[],deleted:[],control:{}};
const timing=A.paymentTimingReport(timingBook,{start:'2026-01-01',end:'2026-03-31'});
assert.equal(timing.appliedToPeriodInvoices,2588.57,'selected-quarter invoice settlement must include all linked payments regardless of payment quarter');
assert.equal(timing.appliedInPeriod,100,'payment timing must identify the portion actually received inside the selected quarter');
assert.equal(timing.appliedOutsidePeriod,2488.57,'payment timing must expose payments for selected-quarter invoices dated outside the quarter');
assert.equal(timing.cashInPeriod,100,'cash in period must remain grouped by payment date');
assert.equal(timing.outsidePeriodPayments.length,1,'outside-quarter payments must remain individually reviewable');

const blockedLegacyPaidBook={invoices:[{...legacyPaidInvoice,'Record ID':'INV_BLOCKED'}],expenses:[],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}};
assert.equal(A.migrateLegacyPaidInvoices(blockedLegacyPaidBook,null,()=>false).length,0,'closed-period UI must be able to suppress automatic legacy payment migration');
assert.equal(blockedLegacyPaidBook.payments.length,0,'suppressed migration must not change the payment ledger');

const mismatchedPaidBook={invoices:[legacyPaidInvoice],expenses:[],fuel:[],auto:[],payments:[{id:'PAY_WRONG',invoiceId:'INV_LEGACY_PARKING',date:'2026-01-04',amount:256.06}],creditNotes:[],deleted:[],control:{}};
assert.equal(A.migrateLegacyPaidInvoices(mismatchedPaidBook).length,0,'an existing mismatched payment must not be silently overwritten');
assert.equal(A.paymentReconciliation(mismatchedPaidBook)[0].status,'mismatch');
assert.equal(A.paymentReconciliation(mismatchedPaidBook)[0].difference,2332.51);
assert.ok(A.controls(mismatchedPaidBook,new Date('2026-01-10'),{start:'2026-01-01',end:'2026-03-31'}).issues.some(x=>x.kind==='payments'&&x.message.includes('ledger payments are 256.06')),'payment mismatch must be explicit in Control');

book.payments.push({id:'PAY_1',invoiceId:'INV_1',date:'2026-09-13',amount:500,method:'Bank'});
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).status,'partially_paid');
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).outstanding,577);
assert.equal(A.cashReport(book,period).cashIn,500);

book.creditNotes.push({id:'CRN_1',invoiceId:'INV_1',date:'2026-09-14',net:100,vat:21,gross:121});
assert.equal(A.vatReport(book,period).issuedSalesGross,1077,'original issued invoice total must remain visible before credit notes');
assert.equal(A.vatReport(book,period).creditGross,121,'credit notes must be reported separately from issued invoices');
assert.equal(A.vatReport(book,period).salesGross,956,'net invoiced value must deduct credit notes');
assert.equal(A.vatReport(book,period).issuedOutputVat,177,'original sales VAT must remain visible before credit notes');
assert.equal(A.vatReport(book,period).creditVat,21,'credit VAT must be explicit');
assert.equal(A.vatReport(book,period).outputVat,156);
assert.equal(A.profitAndLoss(book,period).revenue,800);
assert.equal(A.invoiceState(invoice,book.payments,book.creditNotes,new Date('2026-09-14')).outstanding,456);

const screenshotTotalsBook={
  invoices:[{'Record ID':'INV_SCREEN','Invoice #':'2026-SCREEN',Date:'2026-09-01',Status:'Open','Line items JSON':JSON.stringify([{description:'Quarter invoices',quantity:1,unitNet:8378.81,vatRate:0,vatTreatment:'CUSTOM',vatAmount:1501.37}])}],
  expenses:[],fuel:[],auto:[],payments:[],creditNotes:[{id:'CRN_SCREEN',invoiceId:'INV_SCREEN',date:'2026-09-15',net:255.63,vat:0,gross:255.63}],deleted:[],control:{}
};
const screenshotReport=A.vatReport(screenshotTotalsBook,period);
assert.equal(screenshotReport.issuedSalesGross,9880.18,'issued-invoice card must show the original invoice total before credits');
assert.equal(screenshotReport.creditGross,255.63,'the hidden deduction must be shown as a separate credit-note total');
assert.equal(screenshotReport.salesGross,9624.55,'net invoiced value after credits must remain separately available');

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

const categorizedExpenseBook={
  invoices:[],payments:[],creditNotes:[],deleted:[],control:{},
  expenses:[
    {'Record ID':'EXP_GENERAL_Q3',Date:'2026-08-01',Category:'General',Gross:121,VAT:21},
    {'Record ID':'EXP_MISFILED_FUEL_Q3',Date:'2026-08-02',Category:'Fuel',Gross:60.5,VAT:10.5},
    {'Record ID':'EXP_MISFILED_AUTO_Q2',Date:'2026-05-02',Category:'Vehicle',Gross:242,VAT:42}
  ],
  fuel:[{'Record ID':'EXP_FUEL_Q3',Date:'2026-09-02',Category:'Fuel',Gross:100,VAT:17.36}],
  auto:[{'Record ID':'EXP_AUTO_Q3',Date:'2026-07-02',Category:'Vehicle',Gross:300,VAT:52.07}]
};
assert.equal(A.expenseMainCategory(categorizedExpenseBook.expenses[1],'General'),'Fuel','legacy fuel saved in the general ledger must still classify as Fuel');
assert.equal(A.expenseMainCategory(categorizedExpenseBook.expenses[2],'General'),'Automobile','legacy vehicle saved in the general ledger must still classify as Automobile');
const categorizedQ3=A.categorizedExpenses(categorizedExpenseBook,period);
assert.deepEqual(categorizedQ3.map(x=>x.r['Record ID']).sort(),['EXP_AUTO_Q3','EXP_FUEL_Q3','EXP_GENERAL_Q3','EXP_MISFILED_FUEL_Q3'],'Auto & Fuel classification must first filter every source ledger to the selected quarter');
assert.equal(categorizedQ3.filter(x=>x.mainCategory==='Fuel').length,2,'Fuel view must include both the fuel ledger and misfiled general-expense fuel');
assert.equal(categorizedQ3.filter(x=>x.mainCategory==='Automobile').length,1,'Automobile view must exclude the Q2 vehicle while Q3 is selected');

const reverseChargeInvoice={
  'Record ID':'INV_REVERSE','Invoice #':'2026-REVERSE',Date:'2026-09-18',Customer:'Main contractor','Customer VAT ID':'NL123456789B01',Address:'Amsterdam',Status:'Open',
  'VAT treatment':'REVERSE_CHARGE_NL','VAT rate':21,
  'Line items JSON':JSON.stringify([{description:'Subcontract construction work',quantity:1,unitNet:1000,vatRate:0,vatTreatment:'REVERSE_CHARGE_NL',vatReferenceRate:21,vatAmount:0}])
};
assert.deepEqual(A.invoiceTotals(reverseChargeInvoice),{net:1000,vat:0,gross:1000,lines:A.parseLines(reverseChargeInvoice)},'BTW verlegd must not add output VAT to the invoice');
assert.deepEqual(A.invoiceSalesBreakdown(reverseChargeInvoice),{taxableNet:0,zeroRatedNet:0,reverseChargeNet:1000,net:1000,vat:0,gross:1000},'reverse-charge turnover must stay separate from ordinary 0% turnover');
const reverseBook={invoices:[reverseChargeInvoice],expenses:[],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}};
assert.equal(A.vatReport(reverseBook,period).reverseChargeNet,1000,'VAT report must expose domestic reverse-charge turnover separately');
assert.equal(A.vatReport(reverseBook,period).outputVat,0,'reverse-charge sale must add no output VAT');
assert.ok(!A.controls(reverseBook,new Date('2026-09-19'),period).issues.some(x=>x.message.includes('missing the customer')), 'reverse-charge invoice with a customer VAT ID must pass the VAT-ID control');
const reverseMissingVat={...reverseChargeInvoice,'Record ID':'INV_REVERSE_MISSING','Invoice #':'2026-REVERSE-MISSING','Customer VAT ID':''};
assert.ok(A.controls({...reverseBook,invoices:[reverseMissingVat]},new Date('2026-09-19'),period).issues.some(x=>x.kind==='vat'&&x.message.includes("missing the customer's VAT ID")),'reverse-charge invoice without customer VAT ID must be blocked by control');

console.log('Accounting engine v4.4.4 tests passed.');
