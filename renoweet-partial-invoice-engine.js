/* Partial invoice documents; issued snapshots are independent of later scope changes. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./renoweet-os-vat-engine-v1.js'):root.RenoweetOSVat);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RenoweetPartialInvoices=api})(typeof window!=='undefined'?window:globalThis,function(V){
'use strict';
const round=V.round2,clone=x=>JSON.parse(JSON.stringify(x)),docs=p=>(p.invoiceDocuments||[]).filter(d=>d.kind==='partial'&&d.status!=='Cancelled');
function number(base,index){return `${String(base).replace(/\.\d+$/,'')}.${String(index).padStart(2,'0')}`}
function nextNumber(p,base){const used=new Set((p.invoiceDocuments||[]).map(d=>d.number));let i=1;while(used.has(number(base,i)))i++;return number(base,i)}
function projectDocument(p){
 if(p.invoice?.documentSnapshot)return clone(p.invoice.documentSnapshot);
 const total=V.calculate(p,'invoice'),kind=p.invoice?.kind||'full',description=p.invoice?.partialDescription||(p.estimate||[]).map(l=>l.desc).filter(Boolean).join(' | ')||p.description||p.title||'Werkzaamheden';
 let lines=V.invoiceLines(p,()=>`line_${Math.random().toString(36).slice(2)}`);
 if(kind==='partial'){
  const amount=round(p.invoice.partialAmount),basis=p.invoice.amountBasis==='net'?'net':'gross';
  const groups=[...total.vatBreakdown.map(g=>({...g,gross:round(g.net+g.vat)})),...(total.parking?[{treatment:'NL_ZERO',rate:0,net:total.parking,vat:0,gross:total.parking}]:[])].filter(g=>g.net>0);
  const available=round(total.total-docs(p).reduce((s,d)=>s+d.document.total,0));
  const denominator=groups.reduce((s,g)=>s+g[basis],0);if(!(amount>0)||!denominator)throw new Error('Enter a positive partial invoice amount.');
  // Allocate whole cents by largest remainder so rounding never creates a
  // negative last line, even for very small amounts across many VAT groups.
  const cents=Math.round(amount*100),shares=groups.map((g,i)=>{const exact=cents*g[basis]/denominator;return {i,cents:Math.floor(exact),fraction:exact-Math.floor(exact)}});
  const remainder=cents-shares.reduce((s,x)=>s+x.cents,0),ranked=[...shares].sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
  for(let i=0;i<remainder;i++)ranked[i%ranked.length].cents++;
  lines=groups.map((g,i)=>{const allocation=shares[i].cents/100;const charge=!['REVERSE_CHARGE_NL','NL_ZERO'].includes(g.treatment),net=basis==='gross'?round(allocation/(charge?1+g.rate/100:1)):allocation,vat=basis==='gross'?round(allocation-net):(charge?round(net*g.rate/100):0);return {id:`partial_${i}`,description:`Deelfactuur / aanbetaling: ${description}`,quantity:1,unitNet:net,vatRate:charge?g.rate:0,vatTreatment:g.treatment,vatReferenceRate:g.treatment==='REVERSE_CHARGE_NL'?g.rate:null,vatAmount:vat}});
  if(round(lines.reduce((s,l)=>s+l.unitNet+l.vatAmount,0))>available+.01)throw new Error('The partial amount exceeds the remaining project total.');
 }else if(docs(p).length){
  for(const d of docs(p))for(const [i,l] of d.document.lines.entries())lines.push({...l,id:`deduct_${d.number}_${i}`,description:`Reeds gefactureerd ${d.number}`,quantity:1,unitNet:-round(l.quantity*l.unitNet),vatAmount:-round(l.vatAmount??l.quantity*l.unitNet*l.vatRate/100)});
 }
 const result=fromLines(lines);if(result.total<-.009)throw new Error('Earlier partial invoices exceed the revised total. Correct them with a credit note before issuing the final invoice.');return {...result,kind,projectTotal:total.total,projectNet:round(total.subtotal+total.parking),projectVat:total.vat,previousGross:round(docs(p).reduce((s,d)=>s+d.document.total,0))};
}
function fromLines(lines){const groups=new Map();let net=0,vat=0;for(const l of lines){const n=round(l.quantity*l.unitNet),v=round(l.vatAmount??n*l.vatRate/100),key=`${l.vatTreatment}:${l.vatReferenceRate??l.vatRate}`,g=groups.get(key)||{treatment:l.vatTreatment,rate:l.vatReferenceRate??l.vatRate,net:0,vat:0};net=round(net+n);vat=round(vat+v);g.net=round(g.net+n);g.vat=round(g.vat+v);groups.set(key,g)}const vatBreakdown=[...groups.values()],mixed=vatBreakdown.length>1;return {lines:clone(lines),subtotal:net,taxableSubtotal:net,workSubtotal:net,travel:0,parking:0,vat,total:round(net+vat),vatBreakdown,mixed,vatTreatment:mixed?'MIXED':vatBreakdown[0]?.treatment||'NL_HIGH',vatRate:mixed?0:vatBreakdown[0]?.rate??21,defaultTreatment:vatBreakdown[0]?.treatment||'NL_HIGH',defaultRate:vatBreakdown[0]?.rate??21}}
function previewProject(p){const d=projectDocument(p);return {...p,invoice:{...p.invoice},estimate:d.lines.map(l=>({id:l.id,desc:l.description,qty:l.quantity,unit:'',rate:l.unitNet,vatTreatment:l.vatTreatment,vatRate:l.vatRate,vatReferenceRate:l.vatReferenceRate,vatAmount:l.vatAmount})),quote:{...p.quote,travel:0,parking:0},__partialPreview:true}}
function issue(p){const d=projectDocument(p),i=p.invoice;if(!i.number)throw new Error('An invoice number is required.');if(i.paid&&(!/^\d{4}-\d{2}-\d{2}$/.test(i.paymentDate||'')))throw new Error('Enter the date the advance was received.');if(i.paid&&i.kind!=='partial')throw new Error('Record final invoice payments in Bookkeeping.');i.documentSnapshot=clone(d);p.invoiceDocuments=p.invoiceDocuments||[];if(!p.invoiceDocuments.some(x=>x.number===i.number))p.invoiceDocuments.push({number:i.number,kind:i.kind||'full',status:'Issued',invoice:clone(i),document:clone(d)});return d}
function queueMetadata(p){return {'Invoice kind':p.invoice.kind||'full','Parent invoice number':p.invoice.baseNumber||p.invoice.number,'Project total incl VAT':projectDocument(p).projectTotal,'Payment received':p.invoice.paid?'Yes':'No','Payment date':p.invoice.paid?p.invoice.paymentDate||'':'','Paid amount':p.invoice.paid?projectDocument(p).total:0,'Payment method':p.invoice.paymentMethod||'Bank'}}
return {number,nextNumber,projectDocument,previewProject,issue,queueMetadata};
});
