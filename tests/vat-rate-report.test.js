'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../renoweet-accounting-engine-v4.4.js'),P=require('../renoweet-partial-invoice-engine.js');
const q3={start:'2026-07-01',end:'2026-09-30'},q4={start:'2026-10-01',end:'2026-12-31'},q2={start:'2026-04-01',end:'2026-06-30'};
const line=(net,rate,id=String(rate),treatment)=>({id,description:`Work ${id}`,quantity:1,unitNet:net,vatRate:rate,vatTreatment:treatment||({21:'NL_HIGH',9:'NL_LOW',0:'NL_ZERO'}[rate]||'CUSTOM')});
const invoice=(id,lines,date='2026-09-01')=>({'Record ID':id,'Invoice #':id,Date:date,Status:'Open','Line items JSON':JSON.stringify(lines)});
const book=(invoices,extra={})=>({invoices,expenses:[],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],fixedAssets:[],financeLeases:[],leasePayments:[],ownerTransactions:[],control:{},...extra});
const rate=(v,key)=>v.vatRates.find(r=>r.key===key)||{key,net:0,vat:0};
function reconciles(v){assert.equal(A.round2(v.vatRates.reduce((s,r)=>s+r.net,0)),v.vatSalesNet);assert.equal(A.round2(v.vatRates.reduce((s,r)=>s+r.vat,0)),v.outputVat)}
const example=invoice('three',[line(100,21),line(100,9),line(100,0)]),simple=book([example]),before=JSON.stringify(simple),v=A.vatReport(simple,q3);
assert.equal(v.vatSalesNet,300);assert.equal(v.outputVat,30);assert.deepEqual(v.vatRates,[{key:'21',net:100,vat:21},{key:'9',net:100,vat:9},{key:'0',net:100,vat:0}]);reconciles(v);assert.equal(JSON.stringify(simple),before);
const extended=book([invoice('extended',[line(100,21),line(100,9),line(100,0),line(500,0,'reverse','REVERSE_CHARGE_NL'),line(50,0,'eu','EU_B2B'),line(10,0,'exempt','EXEMPT'),line(5,0,'outside','OUT_OF_SCOPE')])],{expenses:[{Date:'2026-09-01',Gross:100,VAT:0,'VAT treatment':'REVERSE_CHARGE_NL','Reverse-charge reference rate':21}]});
const ev=A.vatReport(extended,q3);assert.equal(rate(ev,'0').net,100);assert.equal(rate(ev,'reverse').net,500);assert.equal(rate(ev,'reverse').vat,0);assert.equal(rate(ev,'eu').net,50);assert.equal(rate(ev,'exempt').net,10);assert.equal(rate(ev,'outside').net,5);assert.equal(ev.outputVat,30);reconciles(ev);
const single=invoice('single',[line(100,21)]),singleCredit={invoiceId:'single',date:'2026-09-10',net:20,vat:4.2,gross:24.2};
const sv=A.vatReport(book([single],{creditNotes:[singleCredit]}),q3);assert.deepEqual(rate(sv,'21'),{key:'21',net:80,vat:16.8});reconciles(sv);
const allocated=A.allocateCredit(example,165),stored={...allocated,vatRates:A.allocateCreditVatRates(example,allocated)},credit={invoiceId:'three',date:'2026-09-10',net:allocated.net,vat:allocated.vat,gross:allocated.gross,'Breakdown JSON':JSON.stringify(stored)};
for(const c of [credit,{...credit,'Breakdown JSON':JSON.stringify(allocated)}]){const cv=A.vatReport(book([example],{creditNotes:[c]}),q3);assert.deepEqual(rate(cv,'21'),{key:'21',net:50,vat:10.5});assert.deepEqual(rate(cv,'9'),{key:'9',net:50,vat:4.5});assert.deepEqual(rate(cv,'0'),{key:'0',net:50,vat:0});reconciles(cv)}
const uncertain={invoiceId:'three',date:'2026-09-10',net:20,vat:4.2,gross:24.2};
const uv=A.vatReport(book([example],{creditNotes:[uncertain]}),q3);assert.deepEqual(rate(uv,'unallocated'),{key:'unallocated',net:-20,vat:-4.2});reconciles(uv);
const drafts=invoice('draft',[line(100,21)]);drafts.Status='Draft';const cancelled=invoice('cancelled',[line(100,21)]);cancelled.Status='Cancelled';
const advance=invoice('advance',[line(100,9)],'2026-10-01');advance['VAT date']='2026-09-30';const dated=book([drafts,cancelled,advance]);assert.equal(rate(A.vatReport(dated,q3),'9').net,100);assert.equal(A.vatReport(dated,q4).vatSalesNet,0);
const project={id:'terms',quote:{vat:21},estimate:[{id:'low',desc:'Low',qty:1,rate:1120,vatTreatment:'NL_LOW'},{id:'high',desc:'High',qty:1,rate:2430,vatTreatment:'NL_HIGH'}],invoice:{kind:'partial',number:'terms.01',partialAmount:2080.55}};
const d1=P.issue(project);project.invoice={kind:'partial',number:'terms.02',partialAmount:2000};const d2=P.issue(project);project.invoice={kind:'final',number:'terms'};const d3=P.issue(project);
const tv=A.vatReport(book([d1,d2,d3].map((d,i)=>invoice('term'+i,d.lines))),q3);assert.deepEqual(rate(tv,'9'),{key:'9',net:1120,vat:100.8});assert.deepEqual(rate(tv,'21'),{key:'21',net:2430,vat:510.3});assert.equal(tv.outputVat,611.1);reconciles(tv);
const cash=book([invoice('cash',JSON.parse(example['Line items JSON']),'2026-06-01')],{control:{VATAccountingBasis:'cash'},payments:[{invoiceId:'cash',date:'2026-07-01',amount:165},{invoiceId:'cash',date:'2026-10-01',amount:165}]});
const cashPeriod={...q3,start:new Date(2026,6,1),end:new Date(2026,8,30)},dateBefore=cashPeriod.start.getTime();
const cv=A.vatReport(cash,cashPeriod);assert.equal(cashPeriod.start.getTime(),dateBefore,'The report must not mutate the selected quarter');assert.deepEqual(rate(cv,'21'),{key:'21',net:50,vat:10.5});assert.deepEqual(rate(cv,'9'),{key:'9',net:50,vat:4.5});assert.deepEqual(rate(cv,'0'),{key:'0',net:50,vat:0});reconciles(cv);reconciles(A.vatReport(cash,q2));reconciles(A.vatReport(cash,q4));
cash.creditNotes=[{...credit,invoiceId:'cash',date:'2026-10-15'}];for(const period of [q2,q3,q4])reconciles(A.vatReport(cash,period));
const parking=book([{'Invoice #':'parking',Date:'2026-09-01',Status:'Paid','Gross incl. VAT':2588.57,VAT:357,Parking:531.57,'VAT rate':21}]);const pv=A.vatReport(parking,q3);assert.deepEqual(rate(pv,'21'),{key:'21',net:2139.31,vat:449.26});assert.deepEqual(rate(pv,'0'),{key:'0',net:0,vat:0});assert.equal(pv.vatSalesGross,2588.57);reconciles(pv);
const unusual=A.vatReport(book([invoice('unusual',[{...line(100,0,'custom','CUSTOM'),vatAmount:11.11}])]),q3);assert.equal(rate(unusual,'0').net,0);assert.deepEqual(rate(unusual,'other'),{key:'other',net:100,vat:11.11});reconciles(unusual);
for(let i=1;i<=150;i++){
 const rows=[line(i/7,21),line(i/13,9),line(i/19,0)],inv=invoice('round',rows),allocation=A.allocateCredit(inv,A.invoiceTotals(inv).gross/3),b=book([inv],{creditNotes:[{invoiceId:'round',date:'2026-09-12',...allocation,'Breakdown JSON':JSON.stringify({...allocation,vatRates:A.allocateCreditVatRates(inv,allocation)})}]});
 reconciles(A.vatReport(b,q3));b.control.VATAccountingBasis='cash';b.payments=[{invoiceId:'round',date:'2026-09-15',amount:A.invoiceTotals(inv).gross/4}];reconciles(A.vatReport(b,q3));
}
// Execute the actual report renderer and existing print path against a DOM fixture.
const uiSource=fs.readFileSync(require.resolve('../renoweet-bookkeeping-v4.4.js'),'utf8'),page=fs.readFileSync(require.resolve('../Renoweet-Bookkeeping-Drive-v2.2.html'),'utf8'),host={innerHTML:'',cloneNode(){return {innerHTML:this.innerHTML,querySelectorAll:()=>[]}}};
const ui={A,data:simple,activePeriod:()=>({...q3,label:'Q3 2026',quarter:3}),byId:()=>host,$:()=>host,html:v=>String(v??''),money:v=>v.toFixed(2),btwControlHtml:()=>'',accountingSettingsHtml:()=>'',kpi:()=>'',quarterLabelFromName:()=> 'Q3 2026',currentBookkeepingFileName:'2026-Q3',printHtmlReport:(title,subtitle,markup)=>{ui.printed=markup}};vm.createContext(ui);
vm.runInContext(uiSource.slice(uiSource.indexOf('function vatRateSummaryHtml('),uiSource.indexOf('\nfunction renderReportsAccounting(){')),ui);
ui.renderVatAccounting();assert(host.innerHTML.includes('Totaal alle omzet'));assert(host.innerHTML.indexOf('Totaal alle omzet')<host.innerHTML.indexOf('21% BTW'));assert(host.innerHTML.includes('<b>300.00</b>'));assert(host.innerHTML.includes('<b>30.00</b>'));for(const rate of ['21%','9%','0%'])assert(host.innerHTML.includes(rate+' BTW'));
const printStart=page.indexOf('function printBTWReport(){'),printEnd=page.indexOf('\nfunction render(){',printStart);vm.runInContext(page.slice(printStart,printEnd),ui);ui.printBTWReport();assert.equal(ui.printed,host.innerHTML,'Print must contain the same rate table and totals as the screen');
assert(ui.vatRateSummaryHtml(ev).includes('BTW verlegd aan Nederlandse klanten'));assert(ui.vatRateSummaryHtml(uv).includes('Niet aan een tarief toegewezen'));assert(ui.vatRateSummaryHtml(pv).includes('historische parkeerberekening'));
console.log('VAT rate report: 21/9/0 totals, reverse charge, credits, cash basis, advances, historical parking, rounding and actual screen/print passed.');
