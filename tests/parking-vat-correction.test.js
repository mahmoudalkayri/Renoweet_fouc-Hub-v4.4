'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../renoweet-accounting-engine-v4.4.js'),P=require('../renoweet-parking-vat-engine.js');
const q1={year:2026,quarter:1,start:'2026-01-01',end:'2026-03-31'},q2={year:2026,quarter:2,start:'2026-04-01',end:'2026-06-30'},q3={year:2026,quarter:3,start:'2026-07-01',end:'2026-09-30'},q4={year:2026,quarter:4,start:'2026-10-01',end:'2026-12-31'};
const legacy=(id='one',date='2026-01-01',parking=30)=>({'Record ID':id,'Invoice #':id,Date:date,Status:'Open','VAT rate':21,'Gross incl. VAT':A.round2(121+parking),VAT:21,Parking:parking,Customer:'Customer',Address:'Address'});
const book=(invoices,extras={})=>({invoices,expenses:[],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],fixedAssets:[],financeLeases:[],leasePayments:[],ownerTransactions:[],control:{},...extras});
const line=(id,net,rate=0,description='Parkeerkosten',extra={})=>({id,description,quantity:1,unitNet:net,vatRate:rate,vatTreatment:rate===21?'NL_HIGH':rate===9?'NL_LOW':'NL_ZERO',...extra});
const invoice=(id,lines,date='2026-07-01',extra={})=>({'Record ID':id,'Invoice #':id,Date:date,Status:'Open','Line items JSON':JSON.stringify(lines),...extra});
const values=t=>[t.net,t.vat,t.gross];
const reconcile=v=>{assert.equal(A.round2(v.vatRates.reduce((s,r)=>s+r.net,0)),v.vatSalesNet);assert.equal(A.round2(v.vatRates.reduce((s,r)=>s+r.vat,0)),v.outputVat)};
const old=legacy(),original=JSON.stringify(old);
assert.deepEqual(values(A.invoiceTotals(old)),[124.79,26.21,151]);
assert.deepEqual(values(A.invoiceOriginalTotals(old)),[130,21,151]);
assert.deepEqual(values(A.invoiceTotals(legacy('large','2026-01-01',732))),[704.96,148.04,853]);
assert.deepEqual(A.parkingCorrection(legacy('large','2026-01-01',732)).changes.map(l=>[l.net,l.vat]),[[604.96,127.04]]);
assert.equal(JSON.stringify(old),original,'Invoice records must never be rewritten by the calculation');
const expense={Date:'2026-01-01',Supplier:'Parking',Category:'Parking',Gross:30,VAT:0,'Payment status':'Paid','Receipt/File':'receipt.pdf'};
const b=book([old],{expenses:[expense],payments:[{id:'pay',invoiceId:'one',date:'2026-01-02',amount:151}]});
const snapshot=JSON.stringify(b);
for(let i=0;i<5;i++){
 assert.equal(A.vatReport(b,q1).outputVat,26.21);assert.equal(A.vatReport(b,q1).inputVat,0);
 assert.equal(A.profitAndLoss(b,q1).revenue,124.79);assert.equal(A.profitAndLoss(b,q1).operatingProfit,94.79);
 assert.equal(A.annualProfitAndLoss(b,2026).revenue,124.79);
 assert.equal(A.annualIncomeTaxPack(b,2026).taxableBusinessProfit,94.79);
 assert.equal(A.cashReport(b,q1).movement,121);assert.equal(A.invoiceState(old,b.payments,[]).outstanding,0);
 reconcile(A.vatReport(b,q1));
}
assert.equal(JSON.stringify(b),snapshot,'Reporting must preserve invoice, expense, payment and control records');
const withInput=book([old],{expenses:[{...expense,VAT:5.21}]});
assert.equal(A.vatReport(withInput,q1).inputVat,5.21);assert.equal(A.profitAndLoss(withInput,q1).operatingProfit,100,'Recorded input VAT is separate from output VAT');
// Legacy XLSX work lines omit the scalar parking and other cost recharges.
const imported={...old,'Other costs':10,'Gross incl. VAT':161,'Line items JSON':JSON.stringify([line('work',100,21,'Work',{vatAmount:21})])};
assert.deepEqual(values(A.invoiceTotals(imported)),[134.79,26.21,161]);assert.equal(A.invoiceSalesBreakdown(imported).zeroRatedNet,10);
assert.equal(A.invoiceTotals({...old,'VAT rate':undefined}).vat,26.21,'Infer the work rate without parking when no rate was stored');
const mixed=invoice('mixed',[line('work9',100,9,'Work'),line('work21',100,21,'Work'),line('park',30),line('other',10,0,'Other costs')]);
const mv=A.vatReport(book([mixed]),q3);assert.equal(mv.outputVat,35.21);assert.equal(mv.vatRates.find(r=>r.key==='21').net,124.79);assert.equal(mv.vatRates.find(r=>r.key==='9').net,100);assert.equal(mv.vatRates.find(r=>r.key==='0').net,10);reconcile(mv);
// Recognise partial allocation source keys and negative final deductions.
const partial=invoice('term.01',[line('partial_0',15,0,'Deelfactuur / aanbetaling: Parkeerkosten',{sourceKey:'quote:parking',vatAmount:0})]);
const final=invoice('term',[line('full_parking',30),line('deduct_term.01_0',-15,0,'Reeds gefactureerd term.01',{sourceKey:'quote:parking',vatAmount:0})]);
assert.equal(A.invoiceTotals(partial).vat,2.6);assert.equal(A.invoiceTotals(final).vat,2.61);assert.equal(A.vatReport(book([partial,final]),q3).outputVat,5.21);
for(const qty of [1,2,3,7]){const r=invoice('quantity',[line('park',30/qty,0,'Parking',{quantity:qty})]);assert.deepEqual(values(A.invoiceTotals(r)),[24.79,5.21,30]);assert.deepEqual(values(A.invoiceTotals({Date:'2026-07-01',Status:'Open','Line items':A.invoiceTotals(r).lines})),[24.79,5.21,30],'Already corrected lines must not be retaxed')}
for(const r of [invoice('paidVat',[line('parking',24.79,21,'Parking',{vatAmount:5.21})]),invoice('other',[line('other',30,0,'Other costs')]),legacy('before','2025-12-31'),legacy('future','2026-10-07'),{...old,Status:'Draft'},{...old,Status:'Cancelled'}])assert.equal(A.parkingCorrection(r).changes.length,0);
const reverse=invoice('reverse',[line('work',100,0,'Work',{vatTreatment:'REVERSE_CHARGE_NL'}),line('park',30)]);
const exempt=invoice('exempt',[line('park',30,0,'Parking',{vatTreatment:'EXEMPT'})]);
const unknown={...old,Status:'Unknown'};assert(A.parkingCorrection(unknown).review[0].includes('Unknown'));
const noDate={...old,Date:''},alreadyScalar={...old,VAT:26.21},mismatch={...mixed,VAT:40},ambiguous=invoice('ambiguous',[line('park',30),line('deduct_old_0',-15,0,'Reeds gefactureerd old')]);
for(const r of [reverse,exempt,noDate,alreadyScalar,mismatch,ambiguous]){assert.equal(A.parkingCorrection(r).changes.length,0);assert(A.parkingCorrection(r).review.length,'Ambiguity must be visible rather than guessed')}
// Old proportional credits are recalculated once, preserving their gross value.
const originalCredit={invoiceId:'one',date:'2026-04-01',net:65,vat:10.5,gross:75.5,'Breakdown JSON':JSON.stringify({taxableNet:50,zeroRatedNet:15,reverseChargeNet:0,net:65,vat:10.5,gross:75.5})};
const after=A.creditBreakdown(originalCredit,old);assert.deepEqual([after.net,after.vat,after.gross],[62.4,13.1,75.5]);
assert.deepEqual(A.creditTotals(old,[originalCredit]),{net:62.4,vat:13.1,gross:75.5});
const credited=book([old],{creditNotes:[originalCredit]});assert.equal(A.vatReport(credited,q2).outputVat,-13.1);reconcile(A.vatReport(credited,q2));
const fullCredit={invoiceId:'one',date:'2026-01-10',net:130,vat:21,gross:151};assert.equal(A.vatReport(book([old],{creditNotes:[fullCredit]}),q1).outputVat,0);
const newCredit={invoiceId:'one',date:'2026-04-01',...A.allocateCredit(old,75.5)};assert.deepEqual(A.creditBreakdown(newCredit,old),A.allocateCredit(old,75.5));
const uncertainCredit={invoiceId:'one',date:'2026-04-01',net:10,vat:0,gross:10};assert.equal(A.creditBreakdown(uncertainCredit,old).vat,0);assert(A.parkingCorrectionReview(book([old],{creditNotes:[uncertainCredit]}),q1).review.length);
// Cash-basis VAT moves with payments; there is no extra prior-quarter posting.
const cash=book([old],{control:{VATAccountingBasis:'cash'},payments:[{invoiceId:'one',date:'2026-04-01',amount:75.5},{invoiceId:'one',date:'2026-07-01',amount:75.5}]});
assert.equal(A.vatReport(cash,q1).outputVat,0);assert.equal(A.vatReport(cash,q2).outputVat,13.11);assert.equal(A.vatReport(cash,q3).outputVat,13.1);for(const q of [q1,q2,q3,q4])reconcile(A.vatReport(cash,q));
const reviewBook=book([old,legacy('q2','2026-04-02',60),legacy('q3','2026-09-30'),legacy('today','2026-10-06'),legacy('future','2026-10-07')],{creditNotes:[originalCredit]});
const review=A.parkingCorrectionReview(reviewBook,q3);assert.equal(review.rows.length,4);assert.deepEqual(review.quarters.map(q=>q.vatAdjustment),[5.21,7.81,5.21,5.21]);assert.equal(review.vatAdjustment,23.44);assert.equal(review.netAdjustment,-23.44);
// Actual VAT renderer and original invoice preview, including repeated opening.
const source=fs.readFileSync(require.resolve('../renoweet-bookkeeping-v4.4.js'),'utf8'),host={innerHTML:''},ui={A,data:reviewBook,activePeriod:()=>({...q3,label:'Q3 2026'}),byId:()=>host,html:v=>String(v??''),money:v=>Number(v).toFixed(2),btwControlHtml:()=>'',accountingSettingsHtml:()=>'',kpi:(name,value)=>`<span>${name} ${value}</span>`};vm.createContext(ui);
vm.runInContext(source.slice(source.indexOf('function vatRateSummaryHtml('),source.indexOf('\nfunction renderReportsAccounting(){')),ui);ui.renderVatAccounting();assert(host.innerHTML.includes('Historical parking correction'));assert(host.innerHTML.includes('130.00 → 124.79'));assert(host.innerHTML.includes('21.00 → 26.21'));assert(host.innerHTML.includes('23.44'));assert(host.innerHTML.includes('Individual review')===false);
ui.data=book([noDate]);ui.renderVatAccounting();assert(host.innerHTML.includes('Individual review needed'));assert(host.innerHTML.includes('no reliable invoice date'));
ui.window={RenoweetCompany:{html:()=>''}};ui.invoiceLogoSrc=()=>'';ui.lineTreatment=l=>l.vatTreatment;ui.vatTreatmentLabel=v=>v;ui.openModal=()=>{};
vm.runInContext(source.slice(source.indexOf('function showInvoicePreviewV44('),source.indexOf('\nfunction injectExpenseFields(){')),ui);
for(let i=0;i<3;i++){ui.showInvoicePreviewV44(old);assert(host.innerHTML.includes('130.00'));assert(host.innerHTML.includes('21.00'));assert(host.innerHTML.includes('151.00'))}assert.equal(JSON.stringify(old),original);
// Browser entry point bundles the engine, so a missing separate asset cannot break opening.
const engineSource=fs.readFileSync(require.resolve('../renoweet-accounting-engine-v4.4.js'),'utf8'),browser={};browser.window=browser;vm.createContext(browser);vm.runInContext(engineSource,browser);assert.equal(browser.RenoweetAccounting.invoiceTotals(old).vat,26.21);assert(engineSource.includes(fs.readFileSync(require.resolve('../renoweet-parking-vat-engine.js'),'utf8')));
// Execute BOD's actual metrics to confirm that both modules use the same calculation.
const bod=fs.readFileSync(require.resolve('../Renoweet-BOD-Drive-v2.2.html'),'utf8'),start=bod.indexOf('function expenseNet'),middle=bod.indexOf('const BOD_PERIOD',start),end=bod.indexOf('function metrics(){',middle);
const D={sources:[],projects:[],invoices:[old],expenses:[expense],fuel:[],auto:[],payments:[],bookkeepingPayments:b.payments,creditNotes:[],orders:[],followups:[]},ctx={A,D,date:A.asDate,isoMonth:v=>A.iso(v).slice(0,7)};vm.createContext(ctx);vm.runInContext(bod.slice(start,middle)+bod.slice(middle,end)+';result=metricsFor({year:2026,mode:"Q1"});',ctx);assert.equal(ctx.result.rev,124.79);assert.equal(ctx.result.outVAT,26.21);assert.equal(ctx.result.result,94.79);assert.equal(ctx.result.cash,151);
assert.equal(P.policy.end,'2026-10-06');
console.log('Parking correction: fixed totals, original records, XLSX recharges, 21/9/0, partial/final deductions, credits, periods, expenses, cash basis, VAT UI, original preview and BOD passed.');
