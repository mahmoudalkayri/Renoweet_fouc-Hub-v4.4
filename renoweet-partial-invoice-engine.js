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
  lines=allocation.rows.filter(r=>r.allocatedAmount>0).map((r,i)=>({id:`partial_${i}`,sourceKey:r.key,description:`Deelfactuur / aanbetaling: ${p.invoice.partialDescription?p.invoice.partialDescription+' — ':''}${r.description}`,quantity:1,unitNet:r.allocatedNet,vatRate:r.chargedRate,vatTreatment:r.treatment,vatReferenceRate:r.treatment==='REVERSE_CHARGE_NL'?r.rate:null,vatAmount:r.allocatedVat}));
 }else if(docs(p).length){
  for(const d of docs(p))for(const [i,l] of d.document.lines.entries())lines.push({...l,id:`deduct_${d.number}_${i}`,description:`Reeds gefactureerd ${d.number}`,quantity:1,unitNet:-round(l.quantity*l.unitNet),vatAmount:-round(l.vatAmount??l.quantity*l.unitNet*l.vatRate/100)});
 }
 const result=fromLines(lines);if(result.total<-.009)throw new Error('Earlier partial invoices exceed the revised total. Correct them with a credit note before issuing the final invoice.');return {...result,kind,projectTotal:total.total,projectNet:round(total.subtotal+total.parking),projectVat:total.vat,previousGross:round(docs(p).reduce((s,d)=>s+d.document.total,0)),...(allocation?{allocation}: {})};
}
function fromLines(lines){const groups=new Map();let net=0,vat=0;for(const l of lines){const n=round(l.quantity*l.unitNet),v=round(l.vatAmount??n*l.vatRate/100),key=`${l.vatTreatment}:${l.vatReferenceRate??l.vatRate}`,g=groups.get(key)||{treatment:l.vatTreatment,rate:l.vatReferenceRate??l.vatRate,net:0,vat:0};net=round(net+n);vat=round(vat+v);g.net=round(g.net+n);g.vat=round(g.vat+v);groups.set(key,g)}const vatBreakdown=[...groups.values()],mixed=vatBreakdown.length>1;return {lines:clone(lines),subtotal:net,taxableSubtotal:net,workSubtotal:net,travel:0,parking:0,vat,total:round(net+vat),vatBreakdown,mixed,vatTreatment:mixed?'MIXED':vatBreakdown[0]?.treatment||'NL_HIGH',vatRate:mixed?0:vatBreakdown[0]?.rate??21,defaultTreatment:vatBreakdown[0]?.treatment||'NL_HIGH',defaultRate:vatBreakdown[0]?.rate??21}}
function previewProject(p){const d=projectDocument(p);return {...p,invoice:{...p.invoice},estimate:d.lines.map(l=>({id:l.id,desc:l.description,qty:l.quantity,unit:'',rate:l.unitNet,vatTreatment:l.vatTreatment,vatRate:l.vatRate,vatReferenceRate:l.vatReferenceRate,vatAmount:l.vatAmount})),quote:{...p.quote,travel:0,parking:0},__partialPreview:true}}
function issue(p){const d=projectDocument(p),i=p.invoice;if(!i.number)throw new Error('An invoice number is required.');if(i.paid&&(!/^\d{4}-\d{2}-\d{2}$/.test(i.paymentDate||'')))throw new Error('Enter the date the advance was received.');if(i.paid&&i.kind!=='partial')throw new Error('Record final invoice payments in Bookkeeping.');i.documentSnapshot=clone(d);p.invoiceDocuments=p.invoiceDocuments||[];if(!p.invoiceDocuments.some(x=>x.number===i.number))p.invoiceDocuments.push({number:i.number,kind:i.kind||'full',status:'Issued',invoice:clone(i),document:clone(d)});return d}
function queueMetadata(p){return {'Invoice kind':p.invoice.kind||'full','Parent invoice number':p.invoice.baseNumber||p.invoice.number,'Project total incl VAT':projectDocument(p).projectTotal,'Payment received':p.invoice.paid?'Yes':'No','Payment date':p.invoice.paid?p.invoice.paymentDate||'':'','Paid amount':p.invoice.paid?projectDocument(p).total:0,'Payment method':p.invoice.paymentMethod||'Bank'}}
return {number,nextNumber,allocationRows,partialPlan,projectDocument,previewProject,issue,queueMetadata};
});
