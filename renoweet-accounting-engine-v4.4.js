/* Renoweet Accounting Engine v4.4.1
   Pure calculation layer shared by Dashboard, VAT, reports and control. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RenoweetAccounting=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const round2=v=>Math.round((Number(v)||0)*100)/100;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const text=v=>String(v??'').trim();
  const lower=v=>text(v).toLowerCase();
  const makeId=prefix=>`${prefix}_${(globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g,'')}`;

  function asDate(v){
    if(v instanceof Date&&!isNaN(v))return v;
    if(typeof v==='number'&&v>20000&&v<100000){const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())}
    const s=text(v);if(!s)return null;
    const iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3]);
    const nl=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);if(nl)return new Date(+nl[3],+nl[2]-1,+nl[1]);
    const d=new Date(s);return isNaN(d)?null:d;
  }
  function excelSerial(v){
    if(v===null||v===undefined||v==='')return '';if(typeof v==='number')return Math.floor(v);const s=text(v).slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';return (Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))-Date.UTC(1899,11,30))/86400000;
  }
  function iso(v){const d=asDate(v);if(!d)return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function inRange(v,period){const d=asDate(v);if(!d)return false;if(!period)return true;const a=period.start?asDate(period.start):null,b=period.end?asDate(period.end):null;return (!a||d>=a)&&(!b||d<=b)}
  function inferRate(row,grossKey='Gross'){
    const stored=text(row?.['VAT rate']??row?.vatRate);if(stored&&stored!=='Other')return num(stored);
    const gross=num(row?.[grossKey]),vat=num(row?.['Invoice VAT']??row?.VAT);
    if(Math.abs(vat-gross*21/121)<.03)return 21;if(Math.abs(vat-gross*9/109)<.03)return 9;if(Math.abs(vat)<.03)return 0;return null;
  }
  function normalizeTreatment(v,rate){const s=text(v).toUpperCase();if(s)return s;if(rate===21)return 'NL_HIGH';if(rate===9)return 'NL_LOW';if(rate===0)return 'NL_ZERO';return 'CUSTOM'}
  function parseLines(invoice){
    let lines=invoice?.['Line items'];
    if(!Array.isArray(lines)){try{lines=JSON.parse(invoice?.['Line items JSON']||'[]')}catch(e){lines=[]}}
    if(Array.isArray(lines)&&lines.length)return lines.map((x,i)=>({
      id:text(x.id)||`line_${i+1}`,description:text(x.description)||'Work',quantity:num(x.quantity)||1,unitNet:num(x.unitNet),vatRate:num(x.vatRate),vatTreatment:normalizeTreatment(x.vatTreatment,num(x.vatRate)),vatAmount:x.vatAmount==null?null:num(x.vatAmount)
    }));
    const gross=num(invoice?.['Gross incl. VAT']??invoice?.totalInclVat),vat=num(invoice?.VAT??invoice?.vatTotal),net=round2(gross-vat),parking=Math.max(0,num(invoice?.Parking)),other=Math.max(0,num(invoice?.['Other costs'])),rate=inferRate(invoice,'Gross incl. VAT');
    const main=Math.max(0,round2(net-parking-other)),out=[];
    if(main||(!parking&&!other))out.push({id:'legacy_work',description:text(invoice?.['Work description'])||'Work',quantity:1,unitNet:main,vatRate:rate??0,vatTreatment:normalizeTreatment(invoice?.['VAT treatment'],rate),vatAmount:null});
    if(parking)out.push({id:'legacy_parking',description:'Parking recharge',quantity:1,unitNet:parking,vatRate:rate??0,vatTreatment:normalizeTreatment(invoice?.['VAT treatment'],rate),vatAmount:null});
    if(other)out.push({id:'legacy_other',description:'Other costs',quantity:1,unitNet:other,vatRate:rate??0,vatTreatment:normalizeTreatment(invoice?.['VAT treatment'],rate),vatAmount:null});
    if((rate==null||out.reduce((s,l)=>s+round2(l.unitNet*l.vatRate/100),0)!==round2(vat))&&out.length)out[0].vatAmount=round2(vat-out.slice(1).reduce((s,l)=>s+round2(l.unitNet*l.vatRate/100),0));
    return out;
  }
  function lineTotals(line){const net=round2((num(line.quantity)||1)*num(line.unitNet)),vat=round2(line.vatAmount==null?net*num(line.vatRate)/100:num(line.vatAmount));return {net,vat,gross:round2(net+vat)}}
  function invoiceTotals(invoice){
    const lines=parseLines(invoice);if(!lines.length){const gross=num(invoice?.['Gross incl. VAT']),vat=num(invoice?.VAT);return {net:round2(gross-vat),vat:round2(vat),gross:round2(gross),lines:[]}}
    const t=lines.reduce((a,l)=>{const x=lineTotals(l);a.net+=x.net;a.vat+=x.vat;return a},{net:0,vat:0});return {net:round2(t.net),vat:round2(t.vat),gross:round2(t.net+t.vat),lines};
  }
  const invoiceId=r=>text(r?.['Record ID']||r?._rid||r?.id||r?.['Invoice #']);
  const expenseId=r=>text(r?.['Record ID']||r?._rid||r?.id||r?.['Receipt/File']);
  const paymentInvoiceId=p=>text(p?.invoiceId||p?.['Invoice ID']);
  function creditsFor(invoice,creditNotes=[]){const id=invoiceId(invoice);return creditNotes.filter(c=>paymentInvoiceId(c)===id||text(c?.['Invoice #'])===text(invoice?.['Invoice #']))}
  function paymentsFor(invoice,payments=[]){const id=invoiceId(invoice);return payments.filter(p=>paymentInvoiceId(p)===id||text(p?.['Invoice #'])===text(invoice?.['Invoice #']))}
  function creditTotals(invoice,creditNotes=[]){return creditsFor(invoice,creditNotes).reduce((a,c)=>({net:round2(a.net+num(c.net??c.Net)),vat:round2(a.vat+num(c.vat??c.VAT)),gross:round2(a.gross+num(c.gross??c.Gross))}),{net:0,vat:0,gross:0})}
  function paymentTotal(invoice,payments=[]){const own=paymentsFor(invoice,payments);if(own.length)return round2(own.reduce((s,p)=>s+num(p.amount??p.Amount),0));return lower(invoice?.Status)==='paid'?invoiceTotals(invoice).gross:0}
  function invoiceState(invoice,payments=[],creditNotes=[],today=new Date()){
    const stated=lower(invoice?.['Lifecycle status']||invoice?.Status),tot=invoiceTotals(invoice),credits=creditTotals(invoice,creditNotes),due=Math.max(0,round2(tot.gross-credits.gross)),paid=paymentTotal(invoice,payments),outstanding=Math.max(0,round2(due-paid)),overpaid=Math.max(0,round2(paid-due));
    if(['draft','unknown'].includes(stated)||(!text(invoice?.['Invoice #'])&&!text(invoice?.['Issued at'])))return {status:'draft',due,paid,outstanding:due,overpaid};
    if(['cancelled','credited'].includes(stated))return {status:stated,due,paid,outstanding:0,overpaid};
    if(outstanding<=.009)return {status:'paid',due,paid,outstanding:0,overpaid};
    const dueDate=asDate(invoice?.['Due date']||invoice?.dueDate);if(dueDate&&dueDate<today)return {status:'overdue',due,paid,outstanding,overpaid};
    if(paid>0)return {status:'partially_paid',due,paid,outstanding,overpaid};
    return {status:'issued',due,paid,outstanding,overpaid};
  }
  function isIssued(invoice){return !['draft','unknown','cancelled'].includes(lower(invoiceState(invoice,[],[]).status))}
  function expenseFacts(row){
    const gross=round2(num(row?.Gross??row?.grossAmount)),invoiceVat=round2(num(row?.['Invoice VAT']??row?.VAT??row?.invoiceVAT)),net=round2(gross-invoiceVat),vatPct=Math.max(0,Math.min(100,num(row?.['VAT deductible %']??row?.vatDeductiblePercent??100))),deductibleVat=round2(row?.['Deductible VAT']!==undefined?num(row['Deductible VAT']):invoiceVat*vatPct/100),incomePct=Math.max(0,Math.min(100,num(row?.['Income tax deductible %']??row?.incomeTaxDeductiblePercent??row?.['Business use %']??100))),costBase=round2(net+(invoiceVat-deductibleVat)),insuranceContribution=Math.max(0,round2(num(row?.['Insurance contribution']??row?.insuranceContribution))),insuranceRoute=lower(row?.['Insurance payment route']??row?.insurancePaymentRoute)==='reimbursed renoweet'?'reimbursed':'direct',storedBefore=row?.['Deductible cost before insurance'],deductibleCostBeforeInsurance=round2(storedBefore!==undefined?num(storedBefore):(insuranceContribution?costBase*incomePct/100:(row?.['Deductible cost']!==undefined?num(row['Deductible cost']):costBase*incomePct/100))),storedAfter=row?.['Deductible cost after insurance'],deductibleCost=round2(storedAfter!==undefined?num(storedAfter):insuranceContribution?Math.max(0,deductibleCostBeforeInsurance-insuranceContribution):deductibleCostBeforeInsurance),storedPaid=row?.['Business amount paid'],businessPaid=round2(storedPaid!==undefined?num(storedPaid):(insuranceRoute==='direct'?Math.max(0,gross-insuranceContribution):gross)),insuranceCashIn=insuranceRoute==='reimbursed'?insuranceContribution:0;
    return {gross,invoiceVat,net,vatPct,deductibleVat,incomePct,costBase,deductibleCostBeforeInsurance,insuranceContribution,insuranceRoute,businessPaid,insuranceCashIn,deductibleCost,vatTreatment:normalizeTreatment(row?.['VAT treatment'],inferRate(row))};
  }
  function allExpenses(book){return [...(book?.expenses||[]).map(r=>({...r,_ledgerCategory:text(r.Category)||'Other'})),...(book?.fuel||[]).map(r=>({...r,_ledgerCategory:'Fuel','Legacy type':'Fuel'})),...(book?.auto||[]).map(r=>({...r,_ledgerCategory:text(r.Category)||'Vehicle','Legacy type':'Automobile'}))]}
  function normalizeBookkeeping(book){book=book&&typeof book==='object'?book:{};for(const k of ['invoices','expenses','fuel','auto','payments','creditNotes','deleted'])if(!Array.isArray(book[k]))book[k]=[];book.control=book.control&&typeof book.control==='object'?book.control:{};return book}
  function periodRows(book,period){book=normalizeBookkeeping(book);return {invoices:book.invoices.filter(r=>inRange(r['Invoice date']||r.Date,period)),expenses:allExpenses(book).filter(r=>inRange(r['Document date']||r.Date,period)),payments:book.payments.filter(r=>inRange(r.date||r.Date,period)),creditNotes:book.creditNotes.filter(r=>inRange(r.date||r.Date,period))}}
  function vatReport(book,period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issued=rows.invoices.filter(isIssued),sales=issued.reduce((a,r)=>{const t=invoiceTotals(r);a.net+=t.net;a.vat+=t.vat;a.gross+=t.gross;return a},{net:0,vat:0,gross:0}),credits=rows.creditNotes.reduce((a,c)=>{a.net+=num(c.net??c.Net);a.vat+=num(c.vat??c.VAT);a.gross+=num(c.gross??c.Gross);return a},{net:0,vat:0,gross:0}),purchases=rows.expenses.reduce((a,r)=>{const x=expenseFacts(r);a.net+=x.net;a.inputVat+=x.deductibleVat;a.gross+=x.gross;return a},{net:0,inputVat:0,gross:0});
    const outputVat=round2(sales.vat-credits.vat),inputVat=round2(purchases.inputVat),position=round2(outputVat-inputVat);return {salesNet:round2(sales.net-credits.net),salesGross:round2(sales.gross-credits.gross),outputVat,inputVat,position,issued,expenses:rows.expenses,creditNotes:rows.creditNotes};
  }
  function profitAndLoss(book,period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issued=rows.invoices.filter(isIssued),revenue=issued.reduce((s,r)=>s+invoiceTotals(r).net,0)-rows.creditNotes.reduce((s,c)=>s+num(c.net??c.Net),0);let direct=0,operating=0,insuranceContributions=0;
    for(const r of rows.expenses){const x=expenseFacts(r),cat=lower(r.Category||r._ledgerCategory);insuranceContributions+=x.insuranceContribution;if(/material|subcontract|project|direct/.test(cat))direct+=x.deductibleCost;else operating+=x.deductibleCost}
    const grossProfit=round2(revenue-direct),result=round2(grossProfit-operating);return {revenue:round2(revenue),directCosts:round2(direct),grossProfit,operatingExpenses:round2(operating),insuranceContributions:round2(insuranceContributions),operatingProfit:result,estimatedTaxableProfit:result};
  }
  function cashReport(book,period){
    book=normalizeBookkeeping(book);const customerPayments=book.payments.filter(p=>inRange(p.date||p.Date,period)).reduce((s,p)=>s+num(p.amount??p.Amount),0),legacy=book.invoices.filter(r=>lower(r.Status)==='paid'&&!paymentsFor(r,book.payments).length&&inRange(r['Paid date']||r['Invoice date']||r.Date,period)).reduce((s,r)=>s+invoiceTotals(r).gross,0),expenses=allExpenses(book),outgoing=expenses.filter(r=>lower(r['Payment status'])!=='unpaid'&&inRange(r['Payment date']||r['Document date']||r.Date,period)).reduce((s,r)=>s+expenseFacts(r).businessPaid,0),insuranceIncoming=expenses.filter(r=>expenseFacts(r).insuranceRoute==='reimbursed'&&inRange(r['Insurance settlement date']||r['Payment date']||r['Document date']||r.Date,period)).reduce((s,r)=>s+expenseFacts(r).insuranceCashIn,0),customerCashIn=round2(customerPayments+legacy),insuranceCashIn=round2(insuranceIncoming),cashIn=round2(customerCashIn+insuranceCashIn),cashOut=round2(outgoing);return {customerCashIn,insuranceCashIn,cashIn,cashOut,movement:round2(cashIn-cashOut)}
  }
  function receivables(book,period){book=normalizeBookkeeping(book);return round2(book.invoices.filter(r=>inRange(r['Invoice date']||r.Date,period)).reduce((s,r)=>s+invoiceState(r,book.payments,book.creditNotes).outstanding,0))}
  function controls(book,today=new Date(),period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issues=[];const seen=new Map();
    for(const r of rows.invoices){const no=text(r['Invoice #']),st=invoiceState(r,book.payments,book.creditNotes,today),t=invoiceTotals(r);if(no){seen.set(no,(seen.get(no)||0)+1)}if(isIssued(r)&&!no)issues.push({kind:'sales',level:'error',message:'Issued invoice without a number',id:invoiceId(r)});if(isIssued(r)&&!text(r.Customer))issues.push({kind:'sales',level:'error',message:`${no||'Invoice'} is missing a customer`,id:invoiceId(r)});if(isIssued(r)&&!text(r.Address))issues.push({kind:'sales',level:'warning',message:`${no||'Invoice'} is missing a customer address`,id:invoiceId(r)});if(st.status==='overdue')issues.push({kind:'sales',level:'warning',message:`${no||'Invoice'} is overdue (${round2(st.outstanding).toFixed(2)} outstanding)`,id:invoiceId(r)});if(st.status==='partially_paid')issues.push({kind:'payments',level:'info',message:`${no||'Invoice'} is partially paid`,id:invoiceId(r)});if(st.overpaid>.009)issues.push({kind:'payments',level:'error',message:`${no||'Invoice'} is overpaid by ${round2(st.overpaid).toFixed(2)}`,id:invoiceId(r)});if(Math.abs(t.net+t.vat-t.gross)>.009)issues.push({kind:'vat',level:'error',message:`${no||'Invoice'} totals do not balance`,id:invoiceId(r)})}
    for(const [no,count] of seen)if(count>1)issues.push({kind:'sales',level:'error',message:`Duplicate invoice number ${no}`});
    for(const r of rows.expenses){const x=expenseFacts(r),label=text(r.Supplier)||'Expense';if(!text(r['Receipt/File']))issues.push({kind:'expenses',level:'error',message:`${label}: missing proof`,id:expenseId(r)});if(x.deductibleVat>x.invoiceVat+.009)issues.push({kind:'vat',level:'error',message:`${label}: deductible VAT exceeds invoice VAT`,id:expenseId(r)});if((x.vatPct<100||x.incomePct<100)&&!text(r.Review))issues.push({kind:'expenses',level:'warning',message:`${label}: mixed-use deduction needs review`,id:expenseId(r)});if(x.insuranceContribution>x.gross+.009)issues.push({kind:'insurance',level:'error',message:`${label}: insurance contribution exceeds the supplier invoice`,id:expenseId(r)});if(x.insuranceContribution&&x.insuranceRoute==='direct'&&Math.abs(x.businessPaid+x.insuranceContribution-x.gross)>.03)issues.push({kind:'insurance',level:'warning',message:`${label}: business payment plus direct insurance payment does not equal the supplier invoice`,id:expenseId(r)});if(x.insuranceContribution&&!text(r['Insurance company']))issues.push({kind:'insurance',level:'warning',message:`${label}: insurance company is missing`,id:expenseId(r)});const rate=inferRate(r),expected=rate==null?x.invoiceVat:round2(x.gross*rate/(100+rate));if(rate!=null&&Math.abs(expected-x.invoiceVat)>.03)issues.push({kind:'vat',level:'warning',message:`${label}: VAT differs from the selected rate`,id:expenseId(r)})}
    const validIds=new Set(book.invoices.map(invoiceId));for(const p of rows.payments)if(!validIds.has(paymentInvoiceId(p)))issues.push({kind:'payments',level:'error',message:'Payment is not allocated to an invoice',id:text(p.id||p['Payment ID'])});
    const penalty=issues.reduce((s,x)=>s+(x.level==='error'?10:x.level==='warning'?5:2),0);return {score:Math.max(0,100-penalty),issues};
  }
  return {round2,num,text,makeId,asDate,iso,excelSerial,inRange,inferRate,parseLines,lineTotals,invoiceTotals,invoiceId,expenseId,paymentsFor,creditsFor,creditTotals,paymentTotal,invoiceState,isIssued,expenseFacts,allExpenses,normalizeBookkeeping,periodRows,vatReport,profitAndLoss,cashReport,receivables,controls};
});
