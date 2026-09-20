/* Renoweet Accounting Engine v4.4.4
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
      id:text(x.id)||`line_${i+1}`,description:text(x.description)||'Work',quantity:num(x.quantity)||1,unitNet:num(x.unitNet),vatRate:num(x.vatRate),vatTreatment:normalizeTreatment(x.vatTreatment,num(x.vatRate)),vatReferenceRate:x.vatReferenceRate==null?null:num(x.vatReferenceRate),vatAmount:x.vatAmount==null?null:num(x.vatAmount)
    }));
    const gross=num(invoice?.['Gross incl. VAT']??invoice?.totalInclVat),vat=num(invoice?.VAT??invoice?.vatTotal),net=round2(gross-vat),parking=Math.max(0,num(invoice?.Parking)),other=Math.max(0,num(invoice?.['Other costs'])),storedRate=num(invoice?.['VAT rate']??invoice?.vatRate),rate=[21,9,0].includes(storedRate)?storedRate:inferRate(invoice,'Gross incl. VAT');
    const main=Math.max(0,round2(net-parking-other)),out=[];
    if(main||(!parking&&!other))out.push({id:'legacy_work',description:text(invoice?.['Work description'])||'Work',quantity:1,unitNet:main,vatRate:rate??0,vatTreatment:normalizeTreatment(invoice?.['VAT treatment'],rate),vatAmount:null});
    if(parking)out.push({id:'legacy_parking',description:'Parking recharge',quantity:1,unitNet:parking,vatRate:0,vatTreatment:'NL_ZERO',vatAmount:0});
    if(other)out.push({id:'legacy_other',description:'Other costs',quantity:1,unitNet:other,vatRate:0,vatTreatment:'NL_ZERO',vatAmount:0});
    if(out.reduce((s,l)=>s+lineTotals(l).vat,0)!==round2(vat)&&out.length)out[0].vatAmount=round2(vat);
    return out;
  }
  function lineTotals(line){const net=round2((num(line.quantity)||1)*num(line.unitNet)),vat=round2(line.vatAmount==null?net*num(line.vatRate)/100:num(line.vatAmount));return {net,vat,gross:round2(net+vat)}}
  function invoiceTotals(invoice){
    const lines=parseLines(invoice);if(!lines.length){const gross=num(invoice?.['Gross incl. VAT']),vat=num(invoice?.VAT);return {net:round2(gross-vat),vat:round2(vat),gross:round2(gross),lines:[]}}
    const t=lines.reduce((a,l)=>{const x=lineTotals(l);a.net+=x.net;a.vat+=x.vat;return a},{net:0,vat:0});return {net:round2(t.net),vat:round2(t.vat),gross:round2(t.net+t.vat),lines};
  }
  function invoiceSalesBreakdown(invoice){
    const totals=invoiceTotals(invoice),parts=totals.lines.reduce((a,l)=>{
      const t=lineTotals(l),treatment=normalizeTreatment(l.vatTreatment,num(l.vatRate));
      if(/REVERSE_CHARGE/.test(treatment))a.reverseChargeNet+=t.net;
      else if(num(l.vatRate)===0||/(ZERO|EXEMPT|OUT_OF_SCOPE)/.test(treatment))a.zeroRatedNet+=t.net;
      else a.taxableNet+=t.net;
      return a;
    },{taxableNet:0,zeroRatedNet:0,reverseChargeNet:0});
    return {taxableNet:round2(parts.taxableNet),zeroRatedNet:round2(parts.zeroRatedNet),reverseChargeNet:round2(parts.reverseChargeNet),net:totals.net,vat:totals.vat,gross:totals.gross};
  }
  const invoiceId=r=>text(r?.['Record ID']||r?._rid||r?.id||r?.['Invoice #']);
  const expenseId=r=>text(r?.['Record ID']||r?._rid||r?.id||r?.['Receipt/File']);
  const paymentInvoiceId=p=>text(p?.invoiceId||p?.['Invoice ID']);
  function creditsFor(invoice,creditNotes=[]){const id=invoiceId(invoice);return creditNotes.filter(c=>paymentInvoiceId(c)===id||text(c?.['Invoice #'])===text(invoice?.['Invoice #']))}
  function paymentsFor(invoice,payments=[]){const id=invoiceId(invoice);return payments.filter(p=>paymentInvoiceId(p)===id||text(p?.['Invoice #'])===text(invoice?.['Invoice #']))}
  function creditTotals(invoice,creditNotes=[]){return creditsFor(invoice,creditNotes).reduce((a,c)=>({net:round2(a.net+num(c.net??c.Net)),vat:round2(a.vat+num(c.vat??c.VAT)),gross:round2(a.gross+num(c.gross??c.Gross))}),{net:0,vat:0,gross:0})}
  function paymentTotal(invoice,payments=[]){return round2(paymentsFor(invoice,payments).reduce((s,p)=>s+num(p.amount??p.Amount),0))}
  function markedPaid(invoice){return lower(invoice?.['Lifecycle status'])==='paid'||lower(invoice?.Status)==='paid'}
  function paymentReconciliation(book,period){
    book=normalizeBookkeeping(book);const rows=book.invoices.filter(r=>!period||inRange(r['Invoice date']||r.Date,period));
    return rows.map(invoice=>{const totals=invoiceTotals(invoice),credits=creditTotals(invoice,book.creditNotes),due=Math.max(0,round2(totals.gross-credits.gross)),payments=paymentsFor(invoice,book.payments),paid=round2(payments.reduce((s,p)=>s+num(p.amount??p.Amount),0)),paidDate=iso(invoice?.['Paid date']||invoice?.paidDate),paymentDates=payments.map(p=>iso(p.date||p.Date)).filter(Boolean).sort(),settlementDate=paymentDates[ paymentDates.length-1 ]||'',difference=round2(due-paid),isMarkedPaid=markedPaid(invoice);let status='ok';
      if(isMarkedPaid&&!paidDate)status='missing_paid_date';
      else if(isMarkedPaid&&!payments.length)status='missing_payment';
      else if(isMarkedPaid&&Math.abs(difference)>.009)status='mismatch';
      else if(isMarkedPaid&&paidDate&&settlementDate&&settlementDate!==paidDate)status='date_mismatch';
      return {invoice,invoiceId:invoiceId(invoice),invoiceNumber:text(invoice?.['Invoice #']),isMarkedPaid,paidDate,settlementDate,due,paid,difference,payments,status};
    });
  }
  function migrateLegacyPaidInvoices(book,period,allowItem=null){
    book=normalizeBookkeeping(book);const added=[];
    for(const item of paymentReconciliation(book,period)){
      if(item.status!=='missing_payment'||!item.paidDate||item.due<=.009)continue;
      if(typeof allowItem==='function'&&!allowItem(item))continue;
      const id=`PAY_MIG_${item.invoiceId.replace(/[^a-z0-9_-]/gi,'_')}`;
      if(book.payments.some(p=>text(p.id||p['Payment ID'])===id))continue;
      const payment={id,invoiceId:item.invoiceId,'Invoice #':item.invoiceNumber,date:item.paidDate,amount:item.due,method:'Bank',reference:'Recovered from legacy Paid status',source:'legacy-paid-status-migration','Migration version':'4.4.1-payment-ledger-v1'};
      book.payments.push(payment);added.push(payment);
    }
    if(added.length){book.control=book.control&&typeof book.control==='object'?book.control:{};book.control.PaymentLedgerMigration='4.4.1-payment-ledger-v1';book.control.PaymentLedgerMigratedAt=new Date().toISOString();book.control.PaymentLedgerMigratedCount=num(book.control.PaymentLedgerMigratedCount)+added.length}
    return added;
  }
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
  function expenseMainCategory(row,sourceType='General'){
    const explicit=lower(row?.['Main category']||row?.mainCategory||row?.['Expense type']);
    if(/^(fuel|brandstof)$/.test(explicit))return 'Fuel';
    if(/^(automobile|auto|vehicle|car)$/.test(explicit))return 'Automobile';
    if(explicit==='general')return 'General';
    const source=lower(sourceType);
    if(source==='fuel')return 'Fuel';
    if(/^(automobile|auto)$/.test(source))return 'Automobile';
    const category=lower(row?.Category);
    if(/^(fuel|brandstof|petrol|gasoline|diesel|benzine|charging|laadkosten)$/.test(category))return 'Fuel';
    if(/^(automobile|auto|vehicle|car|garage|parking|oil|filter|onderhoud|reparatie)$/.test(category))return 'Automobile';
    return 'General';
  }
  function categorizedExpenses(book,period){
    book=normalizeBookkeeping(book);
    const rows=[
      ...book.expenses.map((r,index)=>({r,type:'General',index})),
      ...book.fuel.map((r,index)=>({r,type:'Fuel',index})),
      ...book.auto.map((r,index)=>({r,type:'Automobile',index}))
    ].map(x=>({...x,mainCategory:expenseMainCategory(x.r,x.type)}));
    return period?rows.filter(x=>inRange(x.r?.['Document date']||x.r?.Date,period)):rows;
  }
  function allExpenses(book){return [...(book?.expenses||[]).map(r=>({...r,_ledgerCategory:text(r.Category)||'Other'})),...(book?.fuel||[]).map(r=>({...r,_ledgerCategory:'Fuel','Legacy type':'Fuel'})),...(book?.auto||[]).map(r=>({...r,_ledgerCategory:text(r.Category)||'Vehicle','Legacy type':'Automobile'}))]}
  function normalizeBookkeeping(book){book=book&&typeof book==='object'?book:{};for(const k of ['invoices','expenses','fuel','auto','payments','creditNotes','deleted'])if(!Array.isArray(book[k]))book[k]=[];book.control=book.control&&typeof book.control==='object'?book.control:{};return book}
  function periodRows(book,period){book=normalizeBookkeeping(book);return {invoices:book.invoices.filter(r=>inRange(r['Invoice date']||r.Date,period)),expenses:allExpenses(book).filter(r=>inRange(r['Document date']||r.Date,period)),payments:book.payments.filter(r=>inRange(r.date||r.Date,period)),creditNotes:book.creditNotes.filter(r=>inRange(r.date||r.Date,period))}}
  function vatReport(book,period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issued=rows.invoices.filter(isIssued),sales=issued.reduce((a,r)=>{const t=invoiceSalesBreakdown(r);a.net+=t.net;a.vat+=t.vat;a.gross+=t.gross;a.reverseChargeNet+=t.reverseChargeNet;a.zeroRatedNet+=t.zeroRatedNet;return a},{net:0,vat:0,gross:0,reverseChargeNet:0,zeroRatedNet:0}),credits=rows.creditNotes.reduce((a,c)=>{a.net+=num(c.net??c.Net);a.vat+=num(c.vat??c.VAT);a.gross+=num(c.gross??c.Gross);const linked=book.invoices.find(r=>invoiceId(r)===paymentInvoiceId(c)||text(r?.['Invoice #'])===text(c?.['Invoice #']));if(linked){const b=invoiceSalesBreakdown(linked),cn=num(c.net??c.Net);if(b.reverseChargeNet>.009&&b.taxableNet<=.009&&b.zeroRatedNet<=.009)a.reverseChargeNet+=cn;else if(b.zeroRatedNet>.009&&b.taxableNet<=.009&&b.reverseChargeNet<=.009)a.zeroRatedNet+=cn}return a},{net:0,vat:0,gross:0,reverseChargeNet:0,zeroRatedNet:0}),purchases=rows.expenses.reduce((a,r)=>{const x=expenseFacts(r);a.net+=x.net;a.inputVat+=x.deductibleVat;a.gross+=x.gross;return a},{net:0,inputVat:0,gross:0});
    const issuedSalesNet=round2(sales.net),issuedOutputVat=round2(sales.vat),issuedSalesGross=round2(sales.gross),issuedReverseChargeNet=round2(sales.reverseChargeNet),issuedZeroRatedNet=round2(sales.zeroRatedNet),creditNet=round2(credits.net),creditVat=round2(credits.vat),creditGross=round2(credits.gross),reverseChargeCreditNet=round2(credits.reverseChargeNet),zeroRatedCreditNet=round2(credits.zeroRatedNet),salesNet=round2(issuedSalesNet-creditNet),salesGross=round2(issuedSalesGross-creditGross),reverseChargeNet=round2(issuedReverseChargeNet-reverseChargeCreditNet),zeroRatedNet=round2(issuedZeroRatedNet-zeroRatedCreditNet),outputVat=round2(issuedOutputVat-creditVat),inputVat=round2(purchases.inputVat),position=round2(outputVat-inputVat);
    return {issuedSalesNet,issuedOutputVat,issuedSalesGross,issuedReverseChargeNet,issuedZeroRatedNet,creditNet,creditVat,creditGross,reverseChargeCreditNet,zeroRatedCreditNet,salesNet,salesGross,reverseChargeNet,zeroRatedNet,outputVat,inputVat,position,issued,expenses:rows.expenses,creditNotes:rows.creditNotes};
  }
  function profitAndLoss(book,period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issued=rows.invoices.filter(isIssued),revenue=issued.reduce((s,r)=>s+invoiceTotals(r).net,0)-rows.creditNotes.reduce((s,c)=>s+num(c.net??c.Net),0);let direct=0,operating=0,insuranceContributions=0;
    for(const r of rows.expenses){const x=expenseFacts(r),cat=lower(r.Category||r._ledgerCategory);insuranceContributions+=x.insuranceContribution;if(/material|subcontract|project|direct/.test(cat))direct+=x.deductibleCost;else operating+=x.deductibleCost}
    const grossProfit=round2(revenue-direct),result=round2(grossProfit-operating);return {revenue:round2(revenue),directCosts:round2(direct),grossProfit,operatingExpenses:round2(operating),insuranceContributions:round2(insuranceContributions),operatingProfit:result,estimatedTaxableProfit:result};
  }
  function cashReport(book,period){
    book=normalizeBookkeeping(book);const customerPayments=book.payments.filter(p=>inRange(p.date||p.Date,period)).reduce((s,p)=>s+num(p.amount??p.Amount),0),expenses=allExpenses(book),outgoing=expenses.filter(r=>lower(r['Payment status'])!=='unpaid'&&inRange(r['Payment date']||r['Document date']||r.Date,period)).reduce((s,r)=>s+expenseFacts(r).businessPaid,0),insuranceIncoming=expenses.filter(r=>expenseFacts(r).insuranceRoute==='reimbursed'&&inRange(r['Insurance settlement date']||r['Payment date']||r['Document date']||r.Date,period)).reduce((s,r)=>s+expenseFacts(r).insuranceCashIn,0),recordedCustomerCashIn=round2(customerPayments),legacyPaidCashIn=0,customerCashIn=recordedCustomerCashIn,insuranceCashIn=round2(insuranceIncoming),cashIn=round2(customerCashIn+insuranceCashIn),cashOut=round2(outgoing);return {recordedCustomerCashIn,legacyPaidCashIn,customerCashIn,insuranceCashIn,cashIn,cashOut,movement:round2(cashIn-cashOut)}
  }
  function paymentTimingReport(book,period){
    book=normalizeBookkeeping(book);
    const invoices=book.invoices.filter(r=>inRange(r['Invoice date']||r.Date,period)),ids=new Set(invoices.map(invoiceId)),numbers=new Set(invoices.map(r=>text(r?.['Invoice #'])).filter(Boolean));
    const linked=book.payments.filter(p=>ids.has(paymentInvoiceId(p))||numbers.has(text(p?.['Invoice #']))),inPeriodPayments=[],outsidePeriodPayments=[],undatedPayments=[];
    for(const p of linked){const d=p.date||p.Date;if(!asDate(d))undatedPayments.push(p);else if(inRange(d,period))inPeriodPayments.push(p);else outsidePeriodPayments.push(p)}
    const total=rows=>round2(rows.reduce((s,p)=>s+num(p.amount??p.Amount),0)),appliedToPeriodInvoices=total(linked),appliedInPeriod=total(inPeriodPayments),appliedOutsidePeriod=total(outsidePeriodPayments),appliedUndated=total(undatedPayments),cashInPeriod=round2(book.payments.filter(p=>inRange(p.date||p.Date,period)).reduce((s,p)=>s+num(p.amount??p.Amount),0)),cashFromOtherInvoicePeriods=round2(cashInPeriod-appliedInPeriod);
    return {invoices,linkedPayments:linked,inPeriodPayments,outsidePeriodPayments,undatedPayments,appliedToPeriodInvoices,appliedInPeriod,appliedOutsidePeriod,appliedUndated,cashInPeriod,cashFromOtherInvoicePeriods};
  }
  function receivables(book,period){book=normalizeBookkeeping(book);return round2(book.invoices.filter(r=>inRange(r['Invoice date']||r.Date,period)).reduce((s,r)=>s+invoiceState(r,book.payments,book.creditNotes).outstanding,0))}
  function controls(book,today=new Date(),period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issues=[];const seen=new Map();
    const reconciliation=new Map(paymentReconciliation(book,period).map(x=>[x.invoiceId,x]));
    for(const r of rows.invoices){const no=text(r['Invoice #']),st=invoiceState(r,book.payments,book.creditNotes,today),t=invoiceTotals(r),sales=invoiceSalesBreakdown(r),rec=reconciliation.get(invoiceId(r));if(no){seen.set(no,(seen.get(no)||0)+1)}if(isIssued(r)&&!no)issues.push({kind:'sales',level:'error',message:'Issued invoice without a number',id:invoiceId(r)});if(isIssued(r)&&!text(r.Customer))issues.push({kind:'sales',level:'error',message:`${no||'Invoice'} is missing a customer`,id:invoiceId(r)});if(isIssued(r)&&!text(r.Address))issues.push({kind:'sales',level:'warning',message:`${no||'Invoice'} is missing a customer address`,id:invoiceId(r)});if(isIssued(r)&&sales.reverseChargeNet>.009&&!text(r['Customer VAT ID']||r['Customer VAT number']||r.customerVatId))issues.push({kind:'vat',level:'error',message:`${no||'Invoice'} uses BTW verlegd but is missing the customer's VAT ID`,id:invoiceId(r)});if(rec?.status==='missing_paid_date')issues.push({kind:'payments',level:'error',message:`${no||'Invoice'} is marked Paid but has no paid date`,id:invoiceId(r)});else if(rec?.status==='missing_payment')issues.push({kind:'payments',level:'error',message:`${no||'Invoice'} is marked Paid but has no payment ledger entry`,id:invoiceId(r)});else if(rec?.status==='mismatch')issues.push({kind:'payments',level:'error',message:`${no||'Invoice'} is marked Paid, but ledger payments are ${round2(rec.paid).toFixed(2)} and the balance due is ${round2(rec.due).toFixed(2)}`,id:invoiceId(r)});else if(rec?.status==='date_mismatch')issues.push({kind:'payments',level:'error',message:`${no||'Invoice'} has Paid date ${rec.paidDate}, but the payment ledger settles on ${rec.settlementDate}`,id:invoiceId(r)});if(st.status==='overdue'&&!rec?.isMarkedPaid)issues.push({kind:'sales',level:'warning',message:`${no||'Invoice'} is overdue (${round2(st.outstanding).toFixed(2)} outstanding)`,id:invoiceId(r)});if(st.status==='partially_paid'&&!rec?.isMarkedPaid)issues.push({kind:'payments',level:'info',message:`${no||'Invoice'} is partially paid`,id:invoiceId(r)});if(st.overpaid>.009)issues.push({kind:'payments',level:'error',message:`${no||'Invoice'} is overpaid by ${round2(st.overpaid).toFixed(2)}`,id:invoiceId(r)});if(Math.abs(t.net+t.vat-t.gross)>.009)issues.push({kind:'vat',level:'error',message:`${no||'Invoice'} totals do not balance`,id:invoiceId(r)})}
    for(const [no,count] of seen)if(count>1)issues.push({kind:'sales',level:'error',message:`Duplicate invoice number ${no}`});
    for(const r of rows.expenses){const x=expenseFacts(r),label=text(r.Supplier)||'Expense';if(!text(r['Receipt/File']))issues.push({kind:'expenses',level:'error',message:`${label}: missing proof`,id:expenseId(r)});if(x.deductibleVat>x.invoiceVat+.009)issues.push({kind:'vat',level:'error',message:`${label}: deductible VAT exceeds invoice VAT`,id:expenseId(r)});if((x.vatPct<100||x.incomePct<100)&&!text(r.Review))issues.push({kind:'expenses',level:'warning',message:`${label}: mixed-use deduction needs review`,id:expenseId(r)});if(x.insuranceContribution>x.gross+.009)issues.push({kind:'insurance',level:'error',message:`${label}: insurance contribution exceeds the supplier invoice`,id:expenseId(r)});if(x.insuranceContribution&&x.insuranceRoute==='direct'&&Math.abs(x.businessPaid+x.insuranceContribution-x.gross)>.03)issues.push({kind:'insurance',level:'warning',message:`${label}: business payment plus direct insurance payment does not equal the supplier invoice`,id:expenseId(r)});if(x.insuranceContribution&&!text(r['Insurance company']))issues.push({kind:'insurance',level:'warning',message:`${label}: insurance company is missing`,id:expenseId(r)});const rate=inferRate(r),expected=rate==null?x.invoiceVat:round2(x.gross*rate/(100+rate));if(rate!=null&&Math.abs(expected-x.invoiceVat)>.03)issues.push({kind:'vat',level:'warning',message:`${label}: VAT differs from the selected rate`,id:expenseId(r)})}
    const validIds=new Set(book.invoices.map(invoiceId));for(const p of rows.payments)if(!validIds.has(paymentInvoiceId(p)))issues.push({kind:'payments',level:'error',message:'Payment is not allocated to an invoice',id:text(p.id||p['Payment ID'])});
    const penalty=issues.reduce((s,x)=>s+(x.level==='error'?10:x.level==='warning'?5:2),0);return {score:Math.max(0,100-penalty),issues};
  }
  return {round2,num,text,makeId,asDate,iso,excelSerial,inRange,inferRate,parseLines,lineTotals,invoiceTotals,invoiceSalesBreakdown,invoiceId,expenseId,paymentsFor,creditsFor,creditTotals,paymentTotal,markedPaid,paymentReconciliation,migrateLegacyPaidInvoices,invoiceState,isIssued,expenseFacts,expenseMainCategory,categorizedExpenses,allExpenses,normalizeBookkeeping,periodRows,vatReport,profitAndLoss,cashReport,paymentTimingReport,receivables,controls};
});
