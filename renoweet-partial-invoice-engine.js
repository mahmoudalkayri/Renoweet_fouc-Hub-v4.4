/* Partial invoice documents; issued snapshots are independent of later scope changes. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./renoweet-os-vat-engine-v1.js'):root.RenoweetOSVat);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RenoweetPartialInvoices=api})(typeof window!=='undefined'?window:globalThis,function(V){
'use strict';
const round=V.round2,clone=x=>JSON.parse(JSON.stringify(x)),docs=p=>(p.invoiceDocuments||[]).filter(d=>d.kind==='partial'&&d.status!=='Cancelled');
const cents=x=>Math.round(round(x)*100),money=x=>x/100;
const groupKey=x=>`${x.treatment||x.vatTreatment}:${x.rate??x.vatReferenceRate??x.vatRate}`;
function number(base,index){return `${String(base).replace(/\.\d+$/,'')}.${String(index).padStart(2,'0')}`}
function nextNumber(p,base){const used=new Set((p.invoiceDocuments||[]).map(d=>d.number));let i=1;while(used.has(number(base,i)))i++;return number(base,i)}
// Largest-remainder allocation in whole cents, bounded by each line's balance.
function splitCents(amount,weights){
 const total=weights.reduce((s,n)=>s+n,0);if(amount<0||amount>total)throw new Error('The partial amount exceeds the remaining project total.');
 if(!amount)return weights.map(()=>0);
 const shares=weights.map((weight,i)=>{const exact=amount*weight/total;return {i,value:Math.floor(exact),fraction:exact-Math.floor(exact)}});
 const remaining=amount-shares.reduce((s,x)=>s+x.value,0),ranked=[...shares].sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(let i=0;i<remaining;i++)ranked[i%ranked.length].value++;
 return shares.map(x=>x.value);
}
function allocationRows(p){
 const total=V.calculate(p,'invoice'),rows=[];
 function add(x,key){if(x.net<=0)return;rows.push({key,description:x.description||'Werkzaamheden',treatment:x.treatment,rate:x.rate,chargedRate:['REVERSE_CHARGE_NL','NL_ZERO'].includes(x.treatment)?0:x.rate,net:round(x.net),vat:round(x.vat),gross:round(x.net+x.vat),billedNet:0,billedVat:0})}
 total.lines.forEach((x,i)=>add(x,`estimate:${x.line.id||'row-'+i}`));
 if(total.travelFact)add(total.travelFact,'quote:travel');
 if(total.parking>0)add({description:'Parkeerkosten',treatment:'NL_ZERO',rate:0,net:total.parking,vat:0},'quote:parking');
 const legacy=new Map();
 for(const d of docs(p))for(const l of d.document.lines){
  const net=round(l.quantity*l.unitNet),vat=round(l.vatAmount??net*l.vatRate/100),key=groupKey(l);
  const row=rows.find(r=>r.key===l.sourceKey&&groupKey(r)===key);
  if(row){row.billedNet=round(row.billedNet+net);row.billedVat=round(row.billedVat+vat)}
  else{const old=legacy.get(key)||{net:0,vat:0};old.net=round(old.net+net);old.vat=round(old.vat+vat);legacy.set(key,old)}
 }
 for(const row of rows){if(row.billedNet>row.net+.001||row.billedVat>row.vat+.001)throw new Error('Earlier partial invoices exceed a revised estimate line. Correct them before allocating another advance.')}
 // Older issued invoices were stored by VAT group. Preserve their exact net and
 // VAT amounts and distribute their consumption over matching estimate lines.
 for(const [key,used] of legacy){
  const matching=rows.filter(r=>groupKey(r)===key);
  for(const field of ['net','vat']){
   const billed=field==='net'?'billedNet':'billedVat',weights=matching.map(r=>cents(r[field]-r[billed]));
   if(cents(used[field])>weights.reduce((s,n)=>s+n,0))throw new Error('Earlier partial invoices exceed the remaining amount at this BTW rate. Correct them before allocating another advance.');
   const parts=splitCents(cents(used[field]),weights);matching.forEach((r,i)=>r[billed]=round(r[billed]+money(parts[i])));
  }
 }
 return rows.map(r=>({...r,billedGross:round(r.billedNet+r.billedVat),remainingNet:round(r.net-r.billedNet),remainingVat:round(r.vat-r.billedVat),remainingGross:round(r.net+r.vat-r.billedNet-r.billedVat)}));
}
function partialPlan(p){
 const rows=allocationRows(p),invoice=p.invoice||{},amount=round(invoice.partialAmount),basis=invoice.amountBasis==='net'?'net':'gross',mode=invoice.allocationMode||'low-first';
 if(!(amount>0))throw new Error('Enter a positive partial invoice amount.');
 const weights=rows.map(r=>cents(basis==='net'?r.remainingNet:r.remainingGross));
 if(cents(amount)>weights.reduce((s,n)=>s+n,0))throw new Error('The partial amount exceeds the remaining project total.');
 let values=rows.map(()=>0);
 if(mode==='custom'){
  const manual=invoice.lineAllocations||{};
  for(const [key,value] of Object.entries(manual))if(!rows.some(r=>r.key===key)&&Number(value))throw new Error('An allocated estimate line no longer exists. Review the line allocation.');
  values=rows.map((r,i)=>{const n=Number(manual[r.key]||0);if(!Number.isFinite(n)||n<0)throw new Error('Enter a valid non-negative amount for each estimate line.');const value=cents(n);if(value>weights[i])throw new Error(`The amount for “${r.description}” exceeds its remaining balance.`);return value});
  if(values.reduce((s,n)=>s+n,0)!==cents(amount))throw new Error('The line allocations must add up to the partial invoice amount.');
 }else if(mode==='proportional')values=splitCents(cents(amount),weights);
 else if(mode==='low-first'||mode==='high-first'){
  let remaining=cents(amount);const order=rows.map((r,i)=>({i,rate:r.chargedRate})).sort((a,b)=>(mode==='low-first'?a.rate-b.rate:b.rate-a.rate)||a.i-b.i);
  for(const {i} of order){values[i]=Math.min(remaining,weights[i]);remaining-=values[i]}
 }else throw new Error('Choose a valid BTW allocation method.');
 const allocated=rows.map((r,i)=>{
  const value=money(values[i]);let net=0,vat=0;
  if(values[i]){
   if(basis==='gross'){
    if(values[i]===cents(r.remainingGross)){net=r.remainingNet;vat=r.remainingVat}
    else{net=round(value/(1+r.chargedRate/100));net=Math.max(round(value-r.remainingVat),Math.min(net,r.remainingNet,value));vat=round(value-net)}
   }else{net=value;vat=values[i]===cents(r.remainingNet)?r.remainingVat:Math.min(round(net*r.chargedRate/100),r.remainingVat)}
  }
  return {...r,allocatedNet:net,allocatedVat:vat,allocatedGross:round(net+vat),allocatedAmount:value};
 });
 const gross=round(allocated.reduce((s,r)=>s+r.allocatedGross,0)),available=round(V.calculate(p,'invoice').total-docs(p).reduce((s,d)=>s+d.document.total,0));
 if(gross>available+.001)throw new Error('The partial amount exceeds the remaining project total.');
 return {mode,basis,rows:allocated};
}
function projectDocument(p){
 if(p.invoice?.documentSnapshot)return clone(p.invoice.documentSnapshot);
 const total=V.calculate(p,'invoice'),kind=p.invoice?.kind||'full';let lines=V.invoiceLines(p,()=>`line_${Math.random().toString(36).slice(2)}`),allocation=null;
 if(kind==='partial'){
  allocation=partialPlan(p);
  lines=allocation.rows.filter(r=>r.allocatedAmount>0).map((r,i)=>({id:`partial_${i}`,sourceKey:r.key,description:`Deelfactuur / aanbetaling: ${r.description}`,quantity:1,unitNet:r.allocatedNet,vatRate:r.chargedRate,vatTreatment:r.treatment,vatReferenceRate:r.treatment==='REVERSE_CHARGE_NL'?r.rate:null,vatAmount:r.allocatedVat}));
 }else if(docs(p).length){
  for(const d of docs(p))for(const [i,l] of d.document.lines.entries())lines.push({...l,id:`deduct_${d.number}_${i}`,description:`Reeds gefactureerd ${d.number}`,quantity:1,unitNet:-round(l.quantity*l.unitNet),vatAmount:-round(l.vatAmount??l.quantity*l.unitNet*l.vatRate/100)});
 }
 const result=fromLines(lines);if(result.total<-.009)throw new Error('Earlier partial invoices exceed the revised total. Correct them with a credit note before issuing the final invoice.');return {...result,kind,projectTotal:total.total,projectNet:round(total.subtotal+total.parking),projectVat:total.vat,previousGross:round(docs(p).reduce((s,d)=>s+d.document.total,0)),...(allocation?{allocation,invoiceNote:(p.invoice.partialDescription||'')===(p.estimate||[]).map(l=>l.desc).filter(Boolean).join(' | ')?'':p.invoice.partialDescription||''}: {})};
}
function fromLines(lines){const groups=new Map();let net=0,vat=0;for(const l of lines){const n=round(l.quantity*l.unitNet),v=round(l.vatAmount??n*l.vatRate/100),key=`${l.vatTreatment}:${l.vatReferenceRate??l.vatRate}`,g=groups.get(key)||{treatment:l.vatTreatment,rate:l.vatReferenceRate??l.vatRate,net:0,vat:0};net=round(net+n);vat=round(vat+v);g.net=round(g.net+n);g.vat=round(g.vat+v);groups.set(key,g)}const vatBreakdown=[...groups.values()],mixed=vatBreakdown.length>1;return {lines:clone(lines),subtotal:net,taxableSubtotal:net,workSubtotal:net,travel:0,parking:0,vat,total:round(net+vat),vatBreakdown,mixed,vatTreatment:mixed?'MIXED':vatBreakdown[0]?.treatment||'NL_HIGH',vatRate:mixed?0:vatBreakdown[0]?.rate??21,defaultTreatment:vatBreakdown[0]?.treatment||'NL_HIGH',defaultRate:vatBreakdown[0]?.rate??21}}
function previewProject(p){const d=projectDocument(p);return {...p,invoice:{...p.invoice},estimate:d.lines.map(l=>({id:l.id,desc:l.description,qty:l.quantity,unit:'',rate:l.unitNet,vatTreatment:l.vatTreatment,vatRate:l.vatRate,vatReferenceRate:l.vatReferenceRate,vatAmount:l.vatAmount})),quote:{...p.quote,travel:0,parking:0},__partialPreview:true}}
function issue(p){const d=projectDocument(p),i=p.invoice;if(!i.number)throw new Error('An invoice number is required.');if(i.paid&&(!/^\d{4}-\d{2}-\d{2}$/.test(i.paymentDate||'')))throw new Error('Enter the date the advance was received.');if(i.paid&&i.kind!=='partial')throw new Error('Record final invoice payments in Bookkeeping.');i.documentSnapshot=clone(d);p.invoiceDocuments=p.invoiceDocuments||[];if(!p.invoiceDocuments.some(x=>x.number===i.number))p.invoiceDocuments.push({number:i.number,kind:i.kind||'full',status:'Issued',invoice:clone(i),document:clone(d)});return d}
function draftReopenReason(p,bookkeepingRows=[]){
 const i=p.invoice||{},documents=p.invoiceDocuments||[],d=documents.find(x=>x.number===i.number);
 if(!i.documentSnapshot)return 'This invoice is already an editable draft.';
 if((i.status||'Draft')!=='Draft'||i.sharedAt||i.bookkeepingQueuedAt||i.bookkeepingStatus||d?.queueRow||d?.invoice?.sharedAt||d?.invoice?.bookkeepingQueuedAt||(d?.invoice?.status||'Draft')!=='Draft')return 'This invoice has been marked sent, shared or queued for Bookkeeping. Keep it and use an invoice correction.';
 if(bookkeepingRows.some(r=>String(r['Invoice number']||r['Invoice #']||'')===i.number&&String(r.Status||'').toLowerCase()!=='cancelled in os'))return 'This invoice already exists in Bookkeeping. Keep it and use an invoice correction.';
 const position=documents.findIndex(x=>x.number===i.number);
 if(position>=0&&documents.slice(position+1).some(x=>x.status!=='Cancelled'))return 'Later invoice documents depend on this draft. Review those documents before reopening it.';
 return '';
}
function reopenDraft(p,{confirmedUnsent=false,bookkeepingRows=[]}={}){
 const reason=draftReopenReason(p,bookkeepingRows);if(reason)throw new Error(reason);
 if(!confirmedUnsent)throw new Error('Confirm that this draft was never sent to the customer or booked.');
 const stamp=new Date().toISOString(),d=(p.invoiceDocuments||[]).find(x=>x.number===p.invoice.number);
 p.invoiceDraftRevisions=p.invoiceDraftRevisions||[];
 p.invoiceDraftRevisions.push({at:stamp,reason:'Reopened unissued draft',number:p.invoice.number,invoice:clone(p.invoice),document:clone(d?.document||p.invoice.documentSnapshot)});
 p.invoiceDocuments=(p.invoiceDocuments||[]).filter(x=>x.number!==p.invoice.number);
 delete p.invoice.documentSnapshot;p.invoice.status='Draft';p.invoice.draftReopenedAt=stamp;
 return p.invoice;
}
function bookkeepingCorrectionReason(p){
 const i=p.invoice||{},documents=p.invoiceDocuments||[],d=documents.find(x=>x.number===i.number),position=documents.indexOf(d);
 if(i.kind!=='partial'||!i.documentSnapshot||!d)return 'Open an existing partial invoice first.';
 if(d.status==='Cancelled'||/cancel|credit/.test(String(i.status||'').toLowerCase()))return 'A cancelled or credited invoice cannot be corrected as an active advance.';
 if(i.sharedAt||d.invoice?.sharedAt)return 'This invoice was marked sent or shared with the customer. Use a documented invoice correction.';
 if(!i.bookkeepingQueuedAt&&!d.queueRow&&!d.invoice?.bookkeepingQueuedAt)return 'This invoice has not been queued to Bookkeeping.';
 if(documents.slice(position+1).some(x=>x.status!=='Cancelled'))return 'Later invoices depend on this advance. Correct those documents before importing an earlier correction.';
 return '';
}
function bookkeepingCorrection(p,row){
 const reason=bookkeepingCorrectionReason(p);if(reason)throw new Error(reason);
 if(String(row?.['Invoice #']||row?.['Invoice number']||'')!==p.invoice.number)throw new Error('The Bookkeeping invoice number does not match.');
 if(row['Project ID']&&row['Project ID']!==p.id)throw new Error('This Bookkeeping invoice belongs to another project.');
 if(/cancel|credit/.test(String(row['Lifecycle status']||row.Status||'').toLowerCase()))throw new Error('A cancelled or credited invoice cannot replace an active advance.');
 let lines=row['Line items'];if(!Array.isArray(lines)){try{lines=JSON.parse(row['Line items JSON']||'[]')}catch(e){throw new Error('Bookkeeping line items are invalid.')}}
 if(!Array.isArray(lines)||!lines.length)throw new Error('Save the corrected line items in Bookkeeping first.');
 lines=clone(lines);for(const l of lines){
  const rates={NL_LOW:9,NL_HIGH:21,NL_ZERO:0,REVERSE_CHARGE_NL:0},rate=rates[l.vatTreatment];
  if(rate===undefined||Number(l.vatRate)!==rate||!Number.isFinite(Number(l.unitNet))||Number(l.unitNet)<0||!Number.isFinite(Number(l.quantity))||Number(l.quantity)<=0)throw new Error('Check the corrected Bookkeeping quantities, amounts and BTW treatments.');
  const expected=round(Number(l.quantity)*Number(l.unitNet)*rate/100);if(l.vatAmount!=null&&(!Number.isFinite(Number(l.vatAmount))||Math.abs(Number(l.vatAmount)-expected)>.011))throw new Error('Bookkeeping BTW does not match the corrected line rates.');
 }
 const corrected=fromLines(lines),old=p.invoice.documentSnapshot;
 if(cents(corrected.total)!==cents(old.total))throw new Error('Keep the advance total unchanged in Bookkeeping. Correct the net amounts as well as the BTW rate; changing only the rate changes the amount received.');
 for(const [field,expected] of [['Gross incl. VAT',corrected.total],['VAT',corrected.vat],['Invoice subtotal',corrected.subtotal]])if(row[field]!=null&&cents(row[field])!==cents(expected))throw new Error('Bookkeeping line items and invoice totals do not match. Save the corrected invoice again.');
 const candidate=clone(p);candidate.invoiceDocuments=candidate.invoiceDocuments.filter(d=>d.number!==p.invoice.number);delete candidate.invoice.documentSnapshot;
 const before=allocationRows(candidate);candidate.invoiceDocuments.push({number:p.invoice.number,kind:'partial',status:'Issued',document:corrected});
 let after;try{after=allocationRows(candidate)}catch(e){throw new Error('Correct the BTW rates per work line in Estimate first, then import the Bookkeeping correction. '+e.message)}
 const rows=before.map((r,index)=>({...r,allocatedNet:round(after[index].billedNet-r.billedNet),allocatedVat:round(after[index].billedVat-r.billedVat),allocatedGross:round(after[index].billedGross-r.billedGross)}));rows.forEach(r=>r.allocatedAmount=r.allocatedGross);
 const total=V.calculate(p,'invoice');return {...corrected,kind:'partial',projectTotal:total.total,projectNet:round(total.subtotal+total.parking),projectVat:total.vat,previousGross:round(before.reduce((s,r)=>s+r.billedGross,0)),allocation:{mode:'custom',basis:'gross',rows},invoiceNote:old.invoiceNote||''};
}
function importBookkeepingCorrection(p,row,{confirmedCustomerUnsent=false}={}){
 const document=bookkeepingCorrection(p,row);if(!confirmedCustomerUnsent)throw new Error('Confirm that this invoice was only sent to Bookkeeping, never to the customer.');
 const stamp=new Date().toISOString(),d=p.invoiceDocuments.find(x=>x.number===p.invoice.number);
 p.invoiceDraftRevisions=p.invoiceDraftRevisions||[];p.invoiceDraftRevisions.push({at:stamp,reason:'Imported Bookkeeping-only correction; customer invoice never sent',number:p.invoice.number,invoice:clone(p.invoice),document:clone(d.document),queueRow:clone(d.queueRow||{}),bookkeepingSource:clone(row)});
 p.invoice.documentSnapshot=clone(document);p.invoice.amountBasis='gross';p.invoice.partialAmount=document.total;p.invoice.allocationMode='custom';p.invoice.lineAllocations=Object.fromEntries(document.allocation.rows.map(r=>[r.key,r.allocatedGross]));p.invoice.bookkeepingCorrectionAt=stamp;
 d.document=clone(document);d.invoice=clone(p.invoice);
 d.queueRow={...(d.queueRow||{}),'Invoice number':p.invoice.number,'Subtotal ex VAT':document.subtotal,VAT:document.vat,'Total incl VAT':document.total,'VAT treatment':document.vatTreatment,'VAT rate':document.mixed?'':document.vatRate,'Line items JSON':JSON.stringify(document.lines),'Project total incl VAT':document.projectTotal};
 return document;
}
function bookkeepingDifferences(p,rows=[]){
 const signature=lines=>{const d=fromLines(lines);return JSON.stringify(d.vatBreakdown.map(g=>[g.treatment,g.rate,cents(g.net),cents(g.vat)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))};
 return docs(p).filter(d=>rows.some(r=>{
  if(String(r['Invoice #']||r['Invoice number']||'')!==d.number)return false;
  let lines=r['Line items'];if(!Array.isArray(lines)){try{lines=JSON.parse(r['Line items JSON']||'[]')}catch(e){return true}}
  return Array.isArray(lines)&&lines.length&&signature(lines)!==signature(d.document.lines);
 })).map(d=>d.number);
}
function queueMetadata(p){return {'Invoice kind':p.invoice.kind||'full','Parent invoice number':p.invoice.baseNumber||p.invoice.number,'Project total incl VAT':projectDocument(p).projectTotal,'Payment received':p.invoice.paid?'Yes':'No','Payment date':p.invoice.paid?p.invoice.paymentDate||'':'','Paid amount':p.invoice.paid?projectDocument(p).total:0,'Payment method':p.invoice.paymentMethod||'Bank'}}
return {number,nextNumber,allocationRows,partialPlan,projectDocument,previewProject,issue,draftReopenReason,reopenDraft,bookkeepingCorrectionReason,bookkeepingCorrection,importBookkeepingCorrection,bookkeepingDifferences,queueMetadata};
});
