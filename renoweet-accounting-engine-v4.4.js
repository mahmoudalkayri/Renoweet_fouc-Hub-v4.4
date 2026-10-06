/* Bundled parking engine: invoice reports also work when a separate asset is unavailable. */
/* Historical parking reimbursement calculation. Never writes invoice records. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RenoweetParkingVat=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const doorlopendePostInvoices=Object.freeze(['2026-0101001','2026-0402003']);
  const policy=Object.freeze({start:'2026-01-01',end:'2026-10-06',rate:21,doorlopendePostInvoices});
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const round=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
  function parkingLine(line){
    if(line.id==='legacy_parking'||line.sourceKey==='quote:parking')return true;
    const description=String(line.description||'').trim().replace(/^Deelfactuur\s*\/\s*aanbetaling:\s*/i,'');
    return /^(parking(?:\s+(?:recharge|costs?|fees?|reimbursement))?|parkeerkosten|parkeren)$/i.test(description);
  }
  function calculate(invoice,lines,date){
    const original=lines.map(l=>({...l})),candidates=original.filter(parkingLine);
    const result={lines:original,changes:[],excluded:[],review:[],parkingGross:0,vatAdjustment:0,netAdjustment:0};
    if(!candidates.length)return result;
    const status=String(invoice?.['Lifecycle status']||invoice?.Status||'').toLowerCase();
    if(['draft','cancelled'].includes(status))return result;
    if(!date){result.review.push('Parking invoice has no reliable invoice date.');return result}
    if(date<policy.start||date>policy.end)return result;
    const untaxed=candidates.filter(l=>num(l.vatRate)===0&&num(l.vatAmount)===0);
    const doorlopendePost=doorlopendePostInvoices.includes(String(invoice?.['Invoice #']||'').trim());
    if(doorlopendePost&&candidates.some(l=>num(l.vatRate)!==0||num(l.vatAmount)!==0))result.review.push('This invoice is a confirmed doorlopende-post exception, but recorded parking already has VAT. Review the issued record before changing it.');
    if(!untaxed.length)return result;
    if(status==='unknown'){result.review.push('Invoice status is Unknown; confirm that it was issued before including it in tax reports.');return result}
    const totals=original.reduce((a,l)=>{const net=round((num(l.quantity)||1)*num(l.unitNet)),vat=round(l.vatAmount==null?net*num(l.vatRate)/100:num(l.vatAmount));a.net=round(a.net+net);a.vat=round(a.vat+vat);return a},{net:0,vat:0});
    if((invoice?.VAT!=null&&Math.abs(num(invoice.VAT)-totals.vat)>.009)||(invoice?.['Gross incl. VAT']!=null&&Math.abs(num(invoice['Gross incl. VAT'])-round(totals.net+totals.vat))>.009)||original.some(l=>l.id==='legacy_work'&&Math.abs(round((num(l.quantity)||1)*num(l.unitNet)*num(l.vatRate)/100)-num(l.vatAmount))>.03&&l.vatAmount!=null)){
      result.review.push('Recorded VAT / invoice lines do not reconcile; parking may already have been corrected.');return result;
    }
    if(doorlopendePost){
      // The owner confirmed these two invoice-specific parking disbursements.
      // Keep original amounts, payments and work VAT; only classify the untaxed parking.
      for(const line of result.lines){
        if(!parkingLine(line)||num(line.vatRate)!==0||num(line.vatAmount)!==0)continue;
        if(!['NL_ZERO','DOORLOPENDE_POST'].includes(String(line.vatTreatment||'NL_ZERO').toUpperCase())){result.review.push('Parking on a doorlopende-post invoice has a conflicting special VAT treatment.');continue}
        const gross=round((num(line.quantity)||1)*num(line.unitNet));if(!gross)continue;
        result.excluded.push({id:line.id,description:line.description,gross,reason:'Owner-confirmed doorlopende post — Nextgenhome'});
        line.vatTreatment='DOORLOPENDE_POST';line.vatAmount=0;
      }
      return result;
    }
    if(original.some(l=>/REVERSE_CHARGE|EU_B2B/.test(String(l.vatTreatment||'').toUpperCase()))||/REVERSE_CHARGE|EU_B2B/.test(String(invoice?.['VAT treatment']||'').toUpperCase())){
      result.review.push('Parking on a reverse-charge / EU invoice needs individual review.');return result;
    }
    if(original.some(l=>String(l.id||'').startsWith('deduct_')&&num(l.vatRate)===0&&num(l.vatAmount)===0&&!l.sourceKey)){
      result.review.push('An older final-invoice deduction has no parking source reference.');return result;
    }
    for(const line of result.lines){
      if(!parkingLine(line)||num(line.vatRate)!==0||num(line.vatAmount)!==0)continue;
      const treatment=String(line.vatTreatment||'NL_ZERO').toUpperCase();
      if(!['NL_ZERO',''].includes(treatment)){result.review.push('Parking has an explicit special VAT treatment; verify it individually.');continue}
      const quantity=num(line.quantity)||1,gross=round(quantity*num(line.unitNet)),vat=round(gross*policy.rate/(100+policy.rate)),net=round(gross-vat);
      if(!gross)continue;
      result.changes.push({id:line.id,description:line.description,gross,originalNet:gross,originalVat:0,net,vat});
      line.unitNet=net/quantity;line.vatRate=policy.rate;line.vatTreatment='NL_HIGH';line.vatAmount=vat;line.vatReferenceRate=null;
      result.parkingGross=round(result.parkingGross+gross);result.vatAdjustment=round(result.vatAdjustment+vat);
    }
    result.netAdjustment=round(-result.vatAdjustment);return result;
  }
  return {policy,parkingLine,calculate};
});

/* Renoweet Accounting Engine v4.4.4
   Pure calculation layer shared by Dashboard, VAT, reports and control. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RenoweetAccounting=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const P=globalThis.RenoweetParkingVat;
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
    if(Array.isArray(lines)&&lines.length){
      const parsed=lines.map((x,i)=>({id:text(x.id)||`line_${i+1}`,...(x.sourceKey?{sourceKey:text(x.sourceKey)}:{}),description:text(x.description)||'Work',quantity:num(x.quantity)||1,unitNet:num(x.unitNet),vatRate:num(x.vatRate),vatTreatment:normalizeTreatment(x.vatTreatment,num(x.vatRate)),vatReferenceRate:x.vatReferenceRate==null?null:num(x.vatReferenceRate),vatAmount:x.vatAmount==null?null:num(x.vatAmount)}));
      // Old XLSX imports kept recharges in scalar fields, outside their work lines.
      const parking=Math.max(0,num(invoice?.Parking)),other=Math.max(0,num(invoice?.['Other costs'])),lineGross=round2(parsed.reduce((s,l)=>s+lineTotals(l).gross,0)),missing=round2(num(invoice?.['Gross incl. VAT'])-lineGross);
      if((parking||other)&&missing===round2(parking+other)&&!parsed.some(l=>P.parkingLine(l))){
        if(parking)parsed.push({id:'legacy_parking',description:'Parking recharge',quantity:1,unitNet:parking,vatRate:0,vatTreatment:'NL_ZERO',vatAmount:0});
        if(other)parsed.push({id:'legacy_other',description:'Other costs',quantity:1,unitNet:other,vatRate:0,vatTreatment:'NL_ZERO',vatAmount:0});
      }
      return parsed;
    }
    const gross=num(invoice?.['Gross incl. VAT']??invoice?.totalInclVat),vat=num(invoice?.VAT??invoice?.vatTotal),net=round2(gross-vat),parking=Math.max(0,num(invoice?.Parking)),other=Math.max(0,num(invoice?.['Other costs'])),storedRate=text(invoice?.['VAT rate']??invoice?.vatRate),rate=storedRate&&[21,9,0].includes(num(storedRate))?num(storedRate):inferRate({...invoice,'Gross incl. VAT':round2(gross-parking-other)},'Gross incl. VAT');
    const main=Math.max(0,round2(net-parking-other)),out=[];
    if(main||(!parking&&!other))out.push({id:'legacy_work',description:text(invoice?.['Work description'])||'Work',quantity:1,unitNet:main,vatRate:rate??0,vatTreatment:normalizeTreatment(invoice?.['VAT treatment'],rate),vatAmount:null});
    if(parking)out.push({id:'legacy_parking',description:'Parking recharge',quantity:1,unitNet:parking,vatRate:0,vatTreatment:'NL_ZERO',vatAmount:0});
    if(other)out.push({id:'legacy_other',description:'Other costs',quantity:1,unitNet:other,vatRate:0,vatTreatment:'NL_ZERO',vatAmount:0});
    if(out.reduce((s,l)=>s+lineTotals(l).vat,0)!==round2(vat)&&out.length)out[0].vatAmount=round2(vat);
    return out;
  }
  function lineTotals(line){const net=round2((num(line.quantity)||1)*num(line.unitNet)),vat=round2(line.vatAmount==null?net*num(line.vatRate)/100:num(line.vatAmount));return {net,vat,gross:round2(net+vat)}}
  function invoiceOriginalTotals(invoice){
    const lines=parseLines(invoice);if(!lines.length){const gross=num(invoice?.['Gross incl. VAT']),vat=num(invoice?.VAT);return {net:round2(gross-vat),vat:round2(vat),gross:round2(gross),lines:[]}}
    const t=lines.reduce((a,l)=>{const x=lineTotals(l);a.net+=x.net;a.vat+=x.vat;return a},{net:0,vat:0});return {net:round2(t.net),vat:round2(t.vat),gross:round2(t.net+t.vat),lines};
  }
  function parkingCorrection(invoice){return P.calculate(invoice,parseLines(invoice),iso(invoice?.['Invoice date']||invoice?.Date))}
  function invoiceTotals(invoice){
    const original=invoiceOriginalTotals(invoice),correction=parkingCorrection(invoice);
    if(!correction.changes.length)return correction.excluded.length?{...original,lines:correction.lines}:original;
    return {net:round2(original.net+correction.netAdjustment),vat:round2(original.vat+correction.vatAdjustment),gross:original.gross,lines:correction.lines};
  }
  function invoiceOriginalSalesBreakdown(invoice){return salesFromTotals(invoiceOriginalTotals(invoice))}
  function invoiceSalesBreakdown(invoice){
    return salesFromTotals(invoiceTotals(invoice));
  }
  function salesFromTotals(totals){
    const parts=totals.lines.reduce((a,l)=>{
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
  function creditTotals(invoice,creditNotes=[]){return creditsFor(invoice,creditNotes).reduce((a,c)=>{const x=creditBreakdown(c,invoice);return {net:round2(a.net+x.net),vat:round2(a.vat+x.vat),gross:round2(a.gross+x.gross)}},{net:0,vat:0,gross:0})}
  function allocateCredit(invoice,grossAmount){
    const totals=invoiceTotals(invoice),sales=invoiceSalesBreakdown(invoice),gross=Math.max(0,Math.min(totals.gross,round2(grossAmount))),ratio=totals.gross?gross/totals.gross:0,net=round2(totals.net*ratio),vat=round2(gross-net);
    return {taxableNet:round2(sales.taxableNet*ratio),reverseChargeNet:round2(sales.reverseChargeNet*ratio),zeroRatedNet:round2(sales.zeroRatedNet*ratio),net,vat,gross};
  }
  function creditOriginalBreakdown(credit,invoice){
    let stored=null;try{stored=JSON.parse(credit?.['Breakdown JSON']||credit?.breakdownJson||'null')}catch(e){}
    if(stored&&typeof stored==='object')return {taxableNet:round2(stored.taxableNet),reverseChargeNet:round2(stored.reverseChargeNet),zeroRatedNet:round2(stored.zeroRatedNet),net:round2(credit?.net??credit?.Net??stored.net),vat:round2(credit?.vat??credit?.VAT??stored.vat),gross:round2(credit?.gross??credit?.Gross??stored.gross)};
    if(credit?.net!==undefined||credit?.Net!==undefined||credit?.vat!==undefined||credit?.VAT!==undefined){const net=round2(num(credit?.net??credit?.Net)),vat=round2(num(credit?.vat??credit?.VAT)),gross=round2(num(credit?.gross??credit?.Gross)||net+vat),sales=invoice?invoiceOriginalSalesBreakdown(invoice):null,ratio=sales?.net?net/sales.net:0;return {taxableNet:round2((sales?.taxableNet??net)*ratio||(sales?0:net)),reverseChargeNet:round2((sales?.reverseChargeNet||0)*ratio),zeroRatedNet:round2((sales?.zeroRatedNet||0)*ratio),net,vat,gross}}
    if(invoice)return allocateCredit(invoice,num(credit?.gross??credit?.Gross));
    const gross=round2(num(credit?.gross??credit?.Gross)),net=round2(num(credit?.net??credit?.Net)),vat=round2(num(credit?.vat??credit?.VAT));return {taxableNet:net,reverseChargeNet:0,zeroRatedNet:0,net,vat,gross:gross||round2(net+vat)};
  }
  function creditBreakdown(credit,invoice){
    const original=creditOriginalBreakdown(credit,invoice);
    if(!invoice||!parkingCorrection(invoice).changes.length)return original;
    const sales=invoiceOriginalSalesBreakdown(invoice),ratio=sales.gross?original.gross/sales.gross:0;
    // Only recover the old Hub's demonstrably proportional credit allocation.
    const net=round2(sales.net*ratio),vat=round2(original.gross-net);
    let stored=null;try{stored=JSON.parse(credit?.['Breakdown JSON']||credit?.breakdownJson||'null')}catch(e){}
    const calculated=allocateCredit(invoice,original.gross);
    if(!stored&&original.net===calculated.net&&original.vat===calculated.vat)return calculated;
    if(original.net===net&&original.vat===vat&&(!stored||['taxableNet','reverseChargeNet','zeroRatedNet'].every(k=>round2(stored[k])===round2(sales[k]*ratio))))return allocateCredit(invoice,original.gross);
    return original;
  }
  function parkingCorrectionReview(book,period){
    const year=periodIdentity(period).year,rows=[],excluded=[],review=[],quarters=[1,2,3,4].map(quarter=>({quarter,invoices:0,parkingGross:0,vatAdjustment:0,creditVatAdjustment:0,netAdjustment:0}));
    for(const invoice of book?.invoices||[]){
      const correction=parkingCorrection(invoice),date=iso(invoice?.['Invoice date']||invoice?.Date);
      if(!date||date.slice(0,4)===String(year))for(const reason of correction.review)review.push({invoiceNumber:text(invoice?.['Invoice #']),reason});
      if(correction.excluded.length&&date.slice(0,4)===String(year))excluded.push({invoiceNumber:text(invoice?.['Invoice #']),date,parkingGross:round2(correction.excluded.reduce((sum,l)=>sum+l.gross,0)),reason:correction.excluded[0].reason});
      if(!correction.changes.length||date.slice(0,4)!==String(year))continue;
      const original=invoiceOriginalTotals(invoice),corrected=invoiceTotals(invoice),vatDate=iso(invoice?.['VAT date']||invoice?.['Invoice date']||invoice?.Date),quarter=Math.floor((num(vatDate.slice(5,7))-1)/3)+1;
      const row={invoiceNumber:text(invoice?.['Invoice #']),invoiceId:invoiceId(invoice),date,vatDate,quarter,parkingGross:correction.parkingGross,vatAdjustment:correction.vatAdjustment,original,corrected};rows.push(row);
      if(vatDate.slice(0,4)===String(year)&&quarters[quarter-1]){const q=quarters[quarter-1];q.invoices++;q.parkingGross=round2(q.parkingGross+row.parkingGross);q.vatAdjustment=round2(q.vatAdjustment+row.vatAdjustment)}
      for(const credit of creditsFor(invoice,book?.creditNotes||[])){
        const before=creditOriginalBreakdown(credit,invoice),after=creditBreakdown(credit,invoice),creditDate=iso(credit.date||credit.Date),creditQuarter=Math.floor((num(creditDate.slice(5,7))-1)/3)+1;
        if(creditDate.slice(0,4)===String(year)&&quarters[creditQuarter-1])quarters[creditQuarter-1].creditVatAdjustment=round2(quarters[creditQuarter-1].creditVatAdjustment+after.vat-before.vat);
        const proportional=allocateCredit(invoice,before.gross);
        if(before.vat===after.vat&&after.vat!==proportional.vat)review.push({invoiceNumber:row.invoiceNumber,reason:'A credit note has no reliable parking allocation; its recorded net / VAT stays unchanged.'});
      }
    }
    for(const q of quarters){q.vatAdjustment=round2(q.vatAdjustment-q.creditVatAdjustment);q.netAdjustment=round2(-q.vatAdjustment)}
    return {year,policy:P.policy,excluded,rows:rows.sort((a,b)=>a.date.localeCompare(b.date)||a.invoiceNumber.localeCompare(b.invoiceNumber)),quarters,review,vatAdjustment:round2(quarters.reduce((s,q)=>s+q.vatAdjustment,0)),netAdjustment:round2(quarters.reduce((s,q)=>s+q.netAdjustment,0))};
  }
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
  function isFoodExpense(row){return /(^|[^a-z])(food|foods|meals?|lunch|dinner|breakfast|drinks?|horeca|eten|drinken|voedsel|maaltijden?|restaurants?|catering)([^a-z]|$)/i.test(text(row?.Category||row?._ledgerCategory||row?.['Legacy type']))}
  function historicalFoodDefault(row){const d=asDate(row?.['Document date']||row?.Date);return isFoodExpense(row)&&d?.getFullYear()===2026&&d.getMonth()<9&&row?.['Food income-tax override']!==true&&row?.['Food income-tax override']!=='Yes'}
  function defaultIncomePercent(row){return historicalFoodDefault(row)?80:Math.max(0,Math.min(100,num(row?.['Income tax deductible %']??row?.incomeTaxDeductiblePercent??row?.['Business use %']??(isFoodExpense(row)?80:100))))}
  function expenseFacts(row){
    const gross=round2(num(row?.Gross??row?.grossAmount)),vatTreatment=normalizeTreatment(row?.['VAT treatment'],inferRate(row)),reversePurchase=/^(REVERSE_CHARGE_NL|EU_B2B|REVERSE_CHARGE_EU)/.test(vatTreatment),storedInvoiceVat=round2(num(row?.['Invoice VAT']??row?.VAT??row?.invoiceVAT)),invoiceVat=reversePurchase?0:storedInvoiceVat,reverseChargeRate=reversePurchase?(num(row?.['Reverse-charge reference rate']??row?.reverseChargeRate??row?.['VAT reference rate'])||21):0,reverseChargeVat=reversePurchase?round2(row?.['Reverse-charge VAT']!==undefined?num(row['Reverse-charge VAT']):gross*reverseChargeRate/100):0,net=round2(gross-invoiceVat),vatPct=Math.max(0,Math.min(100,num(row?.['VAT deductible %']??row?.vatDeductiblePercent??100))),vatBase=reversePurchase?reverseChargeVat:invoiceVat,deductibleVat=round2(row?.['Deductible VAT']!==undefined?num(row['Deductible VAT']):vatBase*vatPct/100),incomePct=defaultIncomePercent(row),costBase=round2(net+(vatBase-deductibleVat)),insuranceContribution=Math.max(0,round2(num(row?.['Insurance contribution']??row?.insuranceContribution))),insuranceRoute=lower(row?.['Insurance payment route']??row?.insurancePaymentRoute)==='reimbursed renoweet'?'reimbursed':'direct',storedBefore=historicalFoodDefault(row)?undefined:row?.['Deductible cost before insurance'],deductibleCostBeforeInsurance=round2(storedBefore!==undefined?num(storedBefore):(insuranceContribution?costBase*incomePct/100:(!historicalFoodDefault(row)&&row?.['Deductible cost']!==undefined?num(row['Deductible cost']):costBase*incomePct/100))),storedAfter=historicalFoodDefault(row)?undefined:row?.['Deductible cost after insurance'],deductibleCost=round2(storedAfter!==undefined?num(storedAfter):insuranceContribution?Math.max(0,deductibleCostBeforeInsurance-insuranceContribution):deductibleCostBeforeInsurance),storedPaid=row?.['Business amount paid'],businessPaid=round2(storedPaid!==undefined?num(storedPaid):(insuranceRoute==='direct'?Math.max(0,gross-insuranceContribution):gross)),insuranceCashIn=insuranceRoute==='reimbursed'?insuranceContribution:0;
    return {gross,invoiceVat,net,vatPct,deductibleVat,incomePct,costBase,deductibleCostBeforeInsurance,insuranceContribution,insuranceRoute,businessPaid,insuranceCashIn,deductibleCost,vatTreatment,reversePurchase,reverseChargeRate,reverseChargeVat,reverseChargeSection:vatTreatment==='REVERSE_CHARGE_NL'?'2a':reversePurchase?'4b':''};
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
  function normalizeBookkeeping(book){book=book&&typeof book==='object'?book:{};for(const k of ['invoices','expenses','fuel','auto','payments','creditNotes','deleted','fixedAssets','financeLeases','leasePayments','ownerTransactions'])if(!Array.isArray(book[k]))book[k]=[];book.control=book.control&&typeof book.control==='object'?book.control:{};return book}
  function periodRows(book,period){book=normalizeBookkeeping(book);return {invoices:book.invoices.filter(r=>inRange(r['Invoice date']||r.Date,period)),expenses:allExpenses(book).filter(r=>inRange(r['Document date']||r.Date,period)),payments:book.payments.filter(r=>inRange(r.date||r.Date,period)),creditNotes:book.creditNotes.filter(r=>inRange(r.date||r.Date,period))}}
  function periodIdentity(period){const d=asDate(period?.start)||new Date(),year=num(period?.year)||d.getFullYear(),quarter=num(period?.quarter)||Math.floor(d.getMonth()/3)+1;return {year,quarter,key:`${year}-Q${quarter}`}}
  function emptySales(){return {taxableNet:0,reverseChargeNet:0,zeroRatedNet:0,net:0,vat:0,gross:0}}
  function addSales(target,source,multiplier=1){for(const key of ['taxableNet','reverseChargeNet','zeroRatedNet','net','vat','gross'])target[key]+=num(source?.[key])*multiplier;return target}
  function roundSales(source){const out={};for(const key of ['taxableNet','reverseChargeNet','zeroRatedNet','net','vat','gross'])out[key]=round2(source?.[key]);return out}
  function recognisedInvoiceAt(book,invoice,cutoff){
    const invoiceDate=asDate(invoice?.['VAT date']||invoice?.['Invoice date']||invoice?.Date);if(!invoiceDate||invoiceDate>cutoff||!isIssued(invoice))return emptySales();
    const adjusted=addSales(emptySales(),invoiceSalesBreakdown(invoice));
    for(const credit of creditsFor(invoice,book.creditNotes)){const d=asDate(credit?.date||credit?.Date);if(d&&d<=cutoff)addSales(adjusted,creditBreakdown(credit,invoice),-1)}
    const gross=Math.max(0,round2(adjusted.gross));if(gross<=.009)return emptySales();
    const paid=paymentsFor(invoice,book.payments).filter(p=>{const d=asDate(p?.date||p?.Date);return d&&d<=cutoff}).reduce((s,p)=>s+num(p?.amount??p?.Amount),0),ratio=Math.min(1,Math.max(0,paid/gross));
    return roundSales(Object.fromEntries(Object.entries(adjusted).map(([k,v])=>[k,v*ratio])));
  }
  function cashBasisSales(book,period){
    const end=asDate(period?.end)||new Date(),start=asDate(period?.start)||new Date(0),before=new Date(start);before.setDate(before.getDate()-1);const totals=emptySales();
    for(const invoice of book.invoices){addSales(totals,recognisedInvoiceAt(book,invoice,end));addSales(totals,recognisedInvoiceAt(book,invoice,before),-1)}
    return roundSales(totals);
  }
  // Rate-level report includes the explicit historical parking calculation overlay.
  function invoiceVatRates(invoice){
    const groups=new Map();
    for(const line of invoiceTotals(invoice).lines){
      const t=lineTotals(line),treatment=normalizeTreatment(line.vatTreatment,num(line.vatRate)),rate=num(line.vatRate);
      const key=treatment==='DOORLOPENDE_POST'?'passThrough':treatment==='EU_B2B'?'eu':/REVERSE_CHARGE/.test(treatment)?'reverse':treatment==='EXEMPT'?'exempt':treatment==='OUT_OF_SCOPE'?'outside':rate===0&&t.vat===0?'0':[9,21].includes(rate)?String(rate):'other';
      const row=groups.get(key)||{key,net:0,vat:0};row.net=round2(row.net+t.net);row.vat=round2(row.vat+t.vat);groups.set(key,row);
    }
    return [...groups.values()];
  }
  function sumVatRates(rows){return rows.reduce((a,r)=>({net:round2(a.net+r.net),vat:round2(a.vat+r.vat)}),{net:0,vat:0})}
  function scaleVatRates(rows,net,vat){
    if(!rows.length)return [{key:'unallocated',net:round2(net),vat:round2(vat)}];
    const split=(key,target)=>{
      const total=rows.reduce((s,r)=>s+num(r[key]),0);
      if(Math.abs(total)<.0001){const out=rows.map(()=>0);if(target)out[rows.findIndex(r=>r.key==='other')<0?0:rows.findIndex(r=>r.key==='other')]=round2(target);return out}
      const values=rows.map(r=>round2(r[key]*target/total));
      // Keep residual cents in an applicable group, not in a zero-tax row.
      const largest=rows.reduce((best,r,i)=>Math.abs(r[key])>Math.abs(rows[best][key])?i:best,0);
      values[largest]=round2(values[largest]+target-values.reduce((s,v)=>s+v,0));return values;
    };
    const nets=split('net',net),vats=split('vat',vat);return rows.map((r,i)=>({key:r.key,net:nets[i],vat:vats[i]}));
  }
  function allocateCreditVatRates(invoice,breakdown){return scaleVatRates(invoiceVatRates(invoice),breakdown.net,breakdown.vat)}
  function creditVatRates(credit,invoice){
    const amount=creditBreakdown(credit,invoice);let stored=null;try{stored=JSON.parse(credit?.['Breakdown JSON']||credit?.breakdownJson||'null')}catch(e){}
    if(invoice&&parkingCorrection(invoice).excluded.length&&!(Array.isArray(stored?.vatRates)&&stored.vatRates.some(r=>r.key==='passThrough'))){
      const proportional=allocateCredit(invoice,amount.gross),matches=['net','vat','taxableNet','reverseChargeNet','zeroRatedNet'].every(k=>round2(proportional[k])===round2(amount[k]));
      return matches?scaleVatRates(invoiceVatRates(invoice),amount.net,amount.vat):[{key:'unallocated',net:amount.net,vat:amount.vat}];
    }
    if(Array.isArray(stored?.vatRates)&&stored.vatRates.every(r=>['21','9','0','reverse','eu','exempt','outside','passThrough','other','unallocated'].includes(r.key)&&Number.isFinite(r.net)&&Number.isFinite(r.vat))){const sum=sumVatRates(stored.vatRates);if(sum.net===amount.net&&sum.vat===amount.vat)return stored.vatRates.map(r=>({...r}))}
    if(!invoice)return [{key:'unallocated',net:amount.net,vat:amount.vat}];
    const rows=invoiceVatRates(invoice);if(rows.length===1)return scaleVatRates(rows,amount.net,amount.vat);
    // Older Hub credits were proportional. Recover only a matching recorded allocation.
    const proportional=allocateCredit(invoice,amount.gross),matches=['net','vat','taxableNet','reverseChargeNet','zeroRatedNet'].every(k=>round2(proportional[k])===round2(amount[k]));
    if(matches)return scaleVatRates(rows,amount.net,amount.vat);
    return [{key:'unallocated',net:amount.net,vat:amount.vat}];
  }
  function vatRateBreakdown(book,period,basis,expectedNet,expectedVat){
    const groups=new Map(['21','9','0'].map(key=>[key,{key,net:0,vat:0}]));
    const add=(rows,factor=1)=>{for(const r of rows){const x=groups.get(r.key)||{key:r.key,net:0,vat:0};x.net=round2(x.net+r.net*factor);x.vat=round2(x.vat+r.vat*factor);groups.set(r.key,x)}};
    const linked=c=>book.invoices.find(r=>invoiceId(r)===paymentInvoiceId(c)||text(r?.['Invoice #'])===text(c?.['Invoice #']));
    if(basis==='cash'){
      const end=asDate(period?.end)||new Date(),before=new Date(asDate(period?.start)||new Date(0));before.setDate(before.getDate()-1);
      const recognised=(invoice,cutoff)=>{
        if(!isIssued(invoice)||!inRange(invoice['VAT date']||invoice['Invoice date']||invoice.Date,{end:cutoff}))return [];
        const map=new Map(invoiceVatRates(invoice).map(r=>[r.key,{...r}]));
        for(const c of creditsFor(invoice,book.creditNotes)){if(!inRange(c.date||c.Date,{end:cutoff}))continue;for(const r of creditVatRates(c,invoice)){const x=map.get(r.key)||{key:r.key,net:0,vat:0};x.net=round2(x.net-r.net);x.vat=round2(x.vat-r.vat);map.set(r.key,x)}}
        const target=recognisedInvoiceAt(book,invoice,cutoff);return scaleVatRates([...map.values()],target.net,target.vat);
      };
      for(const invoice of book.invoices){add(recognised(invoice,end));add(recognised(invoice,before),-1)}
    }else{
      for(const invoice of book.invoices)if(isIssued(invoice)&&inRange(invoice['VAT date']||invoice['Invoice date']||invoice.Date,period))add(invoiceVatRates(invoice));
      for(const credit of book.creditNotes)if(inRange(credit.date||credit.Date,period))add(creditVatRates(credit,linked(credit)),-1);
    }
    const totals=sumVatRates([...groups.values()]),netDifference=round2(expectedNet-totals.net),vatDifference=round2(expectedVat-totals.vat);
    if(netDifference||vatDifference)add([{key:'unallocated',net:netDifference,vat:vatDifference}]);
    return [...groups.values()];
  }

  function vatReport(book,period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issued=rows.invoices.filter(isIssued),sales=issued.reduce((a,r)=>addSales(a,invoiceSalesBreakdown(r)),emptySales()),credits=rows.creditNotes.reduce((a,c)=>{const linked=book.invoices.find(r=>invoiceId(r)===paymentInvoiceId(c)||text(r?.['Invoice #'])===text(c?.['Invoice #']));return addSales(a,creditBreakdown(c,linked))},emptySales()),invoiceBasis=roundSales(addSales(addSales(emptySales(),sales),credits,-1)),basis=lower(book.control?.VATAccountingBasis)==='cash'?'cash':'invoice',advanceBasis=roundSales(book.invoices.filter(r=>isIssued(r)&&inRange(r['VAT date']||r['Invoice date']||r.Date,period)).reduce((a,r)=>addSales(a,invoiceSalesBreakdown(r)),emptySales())),vatSales=basis==='cash'?cashBasisSales(book,period):roundSales(addSales(advanceBasis,credits,-1)),purchases=rows.expenses.reduce((a,r)=>{const x=expenseFacts(r);a.net+=x.net;a.inputVat+=x.deductibleVat;a.gross+=x.gross;if(x.reversePurchase){a.reverseChargeVat+=x.reverseChargeVat;if(x.reverseChargeSection==='2a'){a.reverseNlBase+=x.net;a.reverseNlVat+=x.reverseChargeVat}else{a.reverseEuBase+=x.net;a.reverseEuVat+=x.reverseChargeVat}}return a},{net:0,inputVat:0,gross:0,reverseChargeVat:0,reverseNlBase:0,reverseNlVat:0,reverseEuBase:0,reverseEuVat:0}),identity=periodIdentity(period),vehiclePrivateUseVat=identity.quarter===4?Math.max(0,round2(num(book.control?.VehiclePrivateUseVatByYear?.[identity.year]))):0;
    const issuedSalesNet=round2(sales.net),issuedOutputVat=round2(sales.vat),issuedSalesGross=round2(sales.gross),issuedReverseChargeNet=round2(sales.reverseChargeNet),issuedZeroRatedNet=round2(sales.zeroRatedNet),creditNet=round2(credits.net),creditVat=round2(credits.vat),creditGross=round2(credits.gross),reverseChargeCreditNet=round2(credits.reverseChargeNet),zeroRatedCreditNet=round2(credits.zeroRatedNet),salesNet=invoiceBasis.net,salesGross=invoiceBasis.gross,reverseChargeNet=invoiceBasis.reverseChargeNet,zeroRatedNet=invoiceBasis.zeroRatedNet,outputVat=vatSales.vat,inputVat=round2(purchases.inputVat),purchaseReverseChargeVat=round2(purchases.reverseChargeVat),totalVatDue=round2(outputVat+purchaseReverseChargeVat+vehiclePrivateUseVat),position=round2(totalVatDue-inputVat);
    const vatRates=vatRateBreakdown(book,period,basis,vatSales.net,outputVat);
    return {vatRates,basis,basisLabel:basis==='cash'?'Cash basis (kasstelsel)':'Invoice basis (factuurstelsel)',issuedSalesNet,issuedOutputVat,issuedSalesGross,issuedReverseChargeNet,issuedZeroRatedNet,creditNet,creditVat,creditGross,reverseChargeCreditNet,zeroRatedCreditNet,salesNet,salesGross,reverseChargeNet,zeroRatedNet,vatSalesNet:vatSales.net,vatSalesGross:vatSales.gross,vatReverseChargeNet:vatSales.reverseChargeNet,vatZeroRatedNet:vatSales.zeroRatedNet,outputVat,inputVat,purchaseReverseChargeVat,reverseNlBase:round2(purchases.reverseNlBase),reverseNlVat:round2(purchases.reverseNlVat),reverseEuBase:round2(purchases.reverseEuBase),reverseEuVat:round2(purchases.reverseEuVat),vehiclePrivateUseVat,totalVatDue,position,issued,expenses:rows.expenses,creditNotes:rows.creditNotes};
  }
  function profitAndLoss(book,period){
    book=normalizeBookkeeping(book);const rows=periodRows(book,period),issued=rows.invoices.filter(isIssued),revenue=issued.reduce((s,r)=>s+invoiceTotals(r).net,0)-rows.creditNotes.reduce((s,c)=>s+num(c.net??c.Net),0);let direct=0,operating=0,insuranceContributions=0;
    for(const r of rows.expenses){const x=expenseFacts(r),cat=lower(r.Category||r._ledgerCategory);insuranceContributions+=x.insuranceContribution;if(/material|subcontract|project|direct/.test(cat))direct+=x.deductibleCost;else operating+=x.deductibleCost}
    const grossProfit=round2(revenue-direct),result=round2(grossProfit-operating),adjustments=book.control?.PeriodAdjustments?.[periodIdentity(period).key]||{},depreciation=Math.max(0,round2(num(adjustments.depreciation))),otherProfitAdjustment=round2(num(adjustments.otherProfitAdjustment)),estimatedTaxableProfit=round2(result-depreciation+otherProfitAdjustment);return {revenue:round2(revenue),directCosts:round2(direct),grossProfit,operatingExpenses:round2(operating),insuranceContributions:round2(insuranceContributions),operatingProfit:result,depreciation,otherProfitAdjustment,estimatedTaxableProfit};
  }
  function annualProfitAndLoss(book,year){
    book=normalizeBookkeeping(book);year=num(year)||new Date().getFullYear();const period={year,quarter:1,start:new Date(year,0,1),end:new Date(year,11,31)},base=profitAndLoss(book,period),adjustments=book.control?.PeriodAdjustments||{};let depreciation=0,otherProfitAdjustment=0;
    for(let quarter=1;quarter<=4;quarter++){const row=adjustments[`${year}-Q${quarter}`]||{};depreciation+=Math.max(0,num(row.depreciation));otherProfitAdjustment+=num(row.otherProfitAdjustment)}
    depreciation=round2(depreciation);otherProfitAdjustment=round2(otherProfitAdjustment);return {...base,depreciation,otherProfitAdjustment,estimatedTaxableProfit:round2(base.operatingProfit-depreciation+otherProfitAdjustment),year};
  }
  function annualTaxPlanning(book,year){
    book=normalizeBookkeeping(book);const profit=annualProfitAndLoss(book,year),settings=book.control?.YearTaxSettings?.[profit.year]||{},reservePercent=Math.max(0,Math.min(100,num(settings.reservePercent??30))),otherBox1Income=round2(num(settings.otherBox1Income)),entrepreneurDeductions=Math.max(0,round2(num(settings.entrepreneurDeductions))),profitExemption=Math.max(0,round2(num(settings.profitExemption))),provisionalTaxPaid=Math.max(0,round2(num(settings.provisionalTaxPaid))),planningTaxableBase=Math.max(0,round2(profit.estimatedTaxableProfit+otherBox1Income-entrepreneurDeductions-profitExemption)),estimatedTaxReserve=round2(planningTaxableBase*reservePercent/100),remainingReserve=Math.max(0,round2(estimatedTaxReserve-provisionalTaxPaid));
    return {year:profit.year,profit,reservePercent,otherBox1Income,entrepreneurDeductions,profitExemption,provisionalTaxPaid,planningTaxableBase,estimatedTaxReserve,remainingReserve};
  }
  function yearOf(v){const d=asDate(v);return d?d.getFullYear():0}
  function fixedAssetReport(book,year){
    book=normalizeBookkeeping(book);year=num(year)||new Date().getFullYear();const rows=[];
    for(const asset of book.fixedAssets){const acquired=yearOf(asset.acquisitionDate||asset.Date),disposed=yearOf(asset.disposalDate),cost=Math.max(0,round2(num(asset.cost||asset.Cost))),residual=Math.max(0,round2(num(asset.residualValue))),annual=asset.annualDepreciation&&typeof asset.annualDepreciation==='object'?asset.annualDepreciation:{};if(!acquired||acquired>year||(disposed&&disposed<year))continue;let prior=0;for(const [y,v] of Object.entries(annual))if(num(y)<year)prior+=Math.max(0,num(v));const opening=acquired===year?0:Math.max(residual,round2(cost-prior)),additions=acquired===year?cost:0,depreciation=Math.min(Math.max(0,round2(num(annual[year]))),Math.max(0,round2(opening+additions-residual))),closing=disposed===year?0:Math.max(residual,round2(opening+additions-depreciation));rows.push({asset,opening,additions,depreciation,closing,disposed:disposed===year})}
    const total=k=>round2(rows.reduce((s,r)=>s+num(r[k]),0));return {year,rows,opening:total('opening'),additions:total('additions'),depreciation:total('depreciation'),closing:total('closing')};
  }
  function financeLeaseReport(book,year){
    book=normalizeBookkeeping(book);year=num(year)||new Date().getFullYear();const rows=[];
    for(const lease of book.financeLeases){const started=yearOf(lease.startDate||lease.Date),original=Math.max(0,round2(num(lease.originalPrincipal))),payments=book.leasePayments.filter(p=>text(p.leaseId)===text(lease.id)),before=payments.filter(p=>yearOf(p.date||p.Date)<year),during=payments.filter(p=>yearOf(p.date||p.Date)===year),principalOf=p=>Math.max(0,round2(num(p.principal)||Math.max(0,num(p.total)-num(p.interest)))),paidPrincipalBefore=before.reduce((s,p)=>s+principalOf(p),0),opening=started===year?original:Math.max(0,round2(original-paidPrincipalBefore)),cashPaid=round2(during.reduce((s,p)=>s+num(p.total),0)),interest=round2(during.reduce((s,p)=>s+num(p.interest),0)),principal=round2(during.reduce((s,p)=>s+principalOf(p),0)),closing=Math.max(0,round2(opening-principal));if(started&&started<=year)rows.push({lease,opening,cashPaid,interest,principal,closing,payments:during})}
    const total=k=>round2(rows.reduce((s,r)=>s+num(r[k]),0));return {year,rows,opening:total('opening'),cashPaid:total('cashPaid'),interest:total('interest'),principal:total('principal'),closing:total('closing')};
  }
  function ownerTransactionReport(book,year){book=normalizeBookkeeping(book);year=num(year)||new Date().getFullYear();const rows=book.ownerTransactions.filter(r=>yearOf(r.date||r.Date)===year),deposits=round2(rows.filter(r=>lower(r.type)==='deposit').reduce((s,r)=>s+num(r.amount),0)),withdrawals=round2(rows.filter(r=>lower(r.type)==='withdrawal').reduce((s,r)=>s+num(r.amount),0));return {year,rows,deposits,withdrawals,net:round2(deposits-withdrawals)}}
  function receivablesAt(book,cutoff){book=normalizeBookkeeping(book);cutoff=asDate(cutoff)||new Date();let total=0;for(const invoice of book.invoices){const d=asDate(invoice['Invoice date']||invoice.Date);if(!d||d>cutoff||!isIssued(invoice))continue;const gross=invoiceTotals(invoice).gross,paid=paymentsFor(invoice,book.payments).filter(p=>{const x=asDate(p.date||p.Date);return x&&x<=cutoff}).reduce((s,p)=>s+num(p.amount??p.Amount),0),credited=creditsFor(invoice,book.creditNotes).filter(c=>{const x=asDate(c.date||c.Date);return x&&x<=cutoff}).reduce((s,c)=>s+creditTotals(c,invoice).gross,0);total+=Math.max(0,gross-paid-credited)}return round2(total)}
  function annualIncomeTaxPack(book,year){
    book=normalizeBookkeeping(book);year=num(year)||new Date().getFullYear();const profit=annualProfitAndLoss(book,year),assets=fixedAssetReport(book,year),leases=financeLeaseReport(book,year),owner=ownerTransactionReport(book,year),closing=book.control?.AnnualClosing?.[year]||{},settings=book.control?.YearTaxSettings?.[year]||{},vehicle=book.control?.VehicleUseByYear?.[year]||{},period={year,start:new Date(year,0,1),end:new Date(year,11,31)},cash=cashReport(book,period),receivables=receivablesAt(book,period.end),all=allExpenses(book).filter(r=>inRange(r['Document date']||r.Date,period));let materials=0,outsourced=0,vehicleRunning=0,otherCosts=0;
    for(const r of all){const x=expenseFacts(r),cat=lower(r.Category||r._ledgerCategory||r['Legacy type']);if(/subcontract|outsourc/.test(cat))outsourced+=x.deductibleCost;else if(/material|project|direct/.test(cat))materials+=x.deductibleCost;else if(/fuel|vehicle|automobile|auto|parking|insurance|road tax|wegbelasting/.test(cat))vehicleRunning+=x.deductibleCost;else otherCosts+=x.deductibleCost}
    materials=round2(materials);outsourced=round2(outsourced);vehicleRunning=round2(vehicleRunning);otherCosts=round2(otherCosts);const registeredDepreciation=assets.depreciation,manualDepreciation=profit.depreciation,vehicleAssetIds=new Set(assets.rows.filter(x=>/vehicle|car|auto|van/.test(lower(x.asset.category))).map(x=>text(x.asset.id))),vehicleDepreciation=round2(assets.rows.filter(x=>vehicleAssetIds.has(text(x.asset.id))).reduce((s,x)=>s+x.depreciation,0)),vehicleLeaseInterest=round2(leases.rows.filter(x=>vehicleAssetIds.has(text(x.lease.assetId))).reduce((s,x)=>s+x.interest,0)),taxableBusinessProfit=round2(profit.estimatedTaxableProfit-registeredDepreciation-leases.interest),profitExemption=Math.max(0,round2(num(settings.profitExemption))),entrepreneurDeductions=Math.max(0,round2(num(settings.entrepreneurDeductions))),otherBox1Income=round2(num(settings.otherBox1Income)),box1Base=Math.max(0,round2(taxableBusinessProfit-entrepreneurDeductions-profitExemption+otherBox1Income)),bank=Math.max(0,round2(num(closing.closingBank))),cashOnHand=Math.max(0,round2(num(closing.cashOnHand))),otherAssets=Math.max(0,round2(num(closing.otherAssets))),vatPayable=Math.max(0,round2(num(closing.vatPayable))),otherLiabilities=Math.max(0,round2(num(closing.otherLiabilities))),totalAssets=round2(bank+cashOnHand+receivables+assets.closing+otherAssets),totalLiabilities=round2(leases.closing+vatPayable+otherLiabilities),derivedEquity=round2(totalAssets-totalLiabilities),openingEquity=round2(num(closing.openingEquity)),expectedEquity=round2(openingEquity+taxableBusinessProfit+owner.net),equityDifference=round2(derivedEquity-expectedEquity),openingBank=round2(num(closing.openingBank)),otherCashAdjustments=round2(num(closing.otherCashAdjustments)),expectedClosingBank=round2(openingBank+cash.movement+owner.net-leases.cashPaid-num(closing.assetCashPaid)-num(closing.taxPaid)+otherCashAdjustments),bankDifference=round2(bank-expectedClosingBank);
    return {year,profit,assets,leases,owner,cash,receivables,materials,outsourced,vehicleRunning,otherCosts,registeredDepreciation,manualDepreciation,vehicleDepreciation,vehicleLeaseInterest,taxableBusinessProfit,profitExemption,entrepreneurDeductions,otherBox1Income,box1Base,vehicle,balance:{bank,cashOnHand,receivables,fixedAssets:assets.closing,otherAssets,totalAssets,financeLeaseDebt:leases.closing,vatPayable,otherLiabilities,totalLiabilities,derivedEquity,openingEquity,expectedEquity,equityDifference},bankReconciliation:{openingBank,recordedBusinessMovement:cash.movement,ownerNet:owner.net,leaseCashPaid:leases.cashPaid,assetCashPaid:round2(num(closing.assetCashPaid)),taxPaid:round2(num(closing.taxPaid)),otherCashAdjustments,expectedClosingBank,closingBank:bank,difference:bankDifference},mapping:{revenue:profit.revenue,materials,outsourced,vehicleCosts:round2(vehicleRunning+vehicleDepreciation+vehicleLeaseInterest),otherCosts:round2(otherCosts+(registeredDepreciation-vehicleDepreciation)+(leases.interest-vehicleLeaseInterest)),profitBeforeRegisteredItems:profit.estimatedTaxableProfit,registeredDepreciation,leaseInterest:leases.interest,taxableBusinessProfit,fixedAssets:assets.closing,liquidFunds:round2(bank+cashOnHand),receivables,longTermDebt:leases.closing,privateDeposits:owner.deposits,privateWithdrawals:owner.withdrawals,box1Base}};
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
    for(const r of rows.expenses){const x=expenseFacts(r),label=text(r.Supplier)||'Expense';if(!text(r['Receipt/File']))issues.push({kind:'expenses',level:'error',message:`${label}: missing proof`,id:expenseId(r)});if(x.reversePurchase){if(x.reverseChargeVat<=.009)issues.push({kind:'vat',level:'error',message:`${label}: received reverse-charge invoice needs a reference VAT rate`,id:expenseId(r)});if(num(r?.['Invoice VAT']??r?.VAT)>.009)issues.push({kind:'vat',level:'error',message:`${label}: supplier VAT must be €0 on a received reverse-charge invoice`,id:expenseId(r)})}else if(x.deductibleVat>x.invoiceVat+.009)issues.push({kind:'vat',level:'error',message:`${label}: deductible VAT exceeds invoice VAT`,id:expenseId(r)});if((x.vatPct<100||x.incomePct<100)&&!text(r.Review))issues.push({kind:'expenses',level:'warning',message:`${label}: mixed-use deduction needs review`,id:expenseId(r)});if(x.insuranceContribution>x.gross+.009)issues.push({kind:'insurance',level:'error',message:`${label}: insurance contribution exceeds the supplier invoice`,id:expenseId(r)});if(x.insuranceContribution&&x.insuranceRoute==='direct'&&Math.abs(x.businessPaid+x.insuranceContribution-x.gross)>.03)issues.push({kind:'insurance',level:'warning',message:`${label}: business payment plus direct insurance payment does not equal the supplier invoice`,id:expenseId(r)});if(x.insuranceContribution&&!text(r['Insurance company']))issues.push({kind:'insurance',level:'warning',message:`${label}: insurance company is missing`,id:expenseId(r)});if(!x.reversePurchase){const rate=inferRate(r),expected=rate==null?x.invoiceVat:round2(x.gross*rate/(100+rate));if(rate!=null&&Math.abs(expected-x.invoiceVat)>.03)issues.push({kind:'vat',level:'warning',message:`${label}: VAT differs from the selected rate`,id:expenseId(r)})}}
    const identity=periodIdentity(period);if(identity.quarter===4&&rows.expenses.some(r=>['Fuel','Automobile'].includes(expenseMainCategory(r,r['Legacy type'])))&&!book.control?.VehiclePrivateUseConfirmedByYear?.[identity.year])issues.push({kind:'vat',level:'warning',message:`Confirm the ${identity.year} private-use vehicle VAT correction (enter €0 if not applicable).`,id:`vehicle-${identity.year}`});
    const validIds=new Set(book.invoices.map(invoiceId));for(const p of rows.payments)if(!validIds.has(paymentInvoiceId(p)))issues.push({kind:'payments',level:'error',message:'Payment is not allocated to an invoice',id:text(p.id||p['Payment ID'])});
    const penalty=issues.reduce((s,x)=>s+(x.level==='error'?10:x.level==='warning'?5:2),0);return {score:Math.max(0,100-penalty),issues};
  }
  return {round2,num,text,makeId,asDate,iso,excelSerial,inRange,inferRate,parseLines,lineTotals,invoiceOriginalTotals,invoiceOriginalSalesBreakdown,parkingCorrection,parkingCorrectionReview,invoiceTotals,invoiceSalesBreakdown,invoiceId,expenseId,paymentsFor,creditsFor,creditTotals,allocateCredit,creditBreakdown,paymentTotal,markedPaid,paymentReconciliation,migrateLegacyPaidInvoices,invoiceState,isIssued,isFoodExpense,historicalFoodDefault,defaultIncomePercent,expenseFacts,expenseMainCategory,categorizedExpenses,allExpenses,normalizeBookkeeping,periodRows,periodIdentity,cashBasisSales,invoiceVatRates,allocateCreditVatRates,creditVatRates,vatReport,profitAndLoss,annualProfitAndLoss,annualTaxPlanning,fixedAssetReport,financeLeaseReport,ownerTransactionReport,annualIncomeTaxPack,cashReport,paymentTimingReport,receivables,receivablesAt,controls};
});
