/* Renoweet OS mixed-rate quotation VAT engine. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RenoweetOSVat=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const num=v=>Number(v)||0;
  const round2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
  function normalizeTreatment(value,rate=21){const s=String(value||'').trim().toUpperCase();if(s.startsWith('REVERSE_CHARGE_NL'))return 'REVERSE_CHARGE_NL';if(s==='NL_HIGH')return 'NL_HIGH';if(s==='NL_LOW')return 'NL_LOW';if(s==='NL_ZERO')return 'NL_ZERO';if(num(rate)===9)return 'NL_LOW';if(num(rate)===0)return 'NL_ZERO';return 'NL_HIGH'}
  function referenceRate(treatment,fallback=21){treatment=normalizeTreatment(treatment,fallback);if(treatment==='NL_HIGH')return 21;if(treatment==='NL_LOW')return 9;if(treatment==='NL_ZERO')return 0;return num(fallback)===9?9:21}
  function selection(raw,fallbackTreatment='NL_HIGH',fallbackRate=21){const value=String(raw||'').trim().toUpperCase(),treatment=normalizeTreatment(value||fallbackTreatment,fallbackRate),rate=value==='REVERSE_CHARGE_NL_9'?9:value==='REVERSE_CHARGE_NL_21'?21:referenceRate(treatment,fallbackRate);return {treatment,rate}}
  function defaultConfig(project,source='quote'){const quote=selection(project?.quote?.vatTreatment||'',project?.quote?.vatTreatment||'NL_HIGH',project?.quote?.vat??21);if(source==='invoice'&&project?.invoice?.vatTreatment)return selection(project.invoice.vatTreatment,quote.treatment,project.invoice.vatRate??quote.rate);return quote}
  function lineConfig(line,project,source='quote'){const fallback=defaultConfig(project,source);if(!line?.vatTreatment)return fallback;return selection(line.vatTreatment,fallback.treatment,line.vatReferenceRate??line.vatRate??fallback.rate)}
  function facts(description,quantity,unitNet,config){const net=round2(num(quantity)*num(unitNet)),charge=!['REVERSE_CHARGE_NL','NL_ZERO'].includes(config.treatment),vat=charge?round2(net*config.rate/100):0;return {description:String(description||''),quantity:num(quantity),unitNet:num(unitNet),net,vat,gross:round2(net+vat),treatment:config.treatment,rate:config.rate}}
  function calculate(project,source='quote'){
    const defaultVat=defaultConfig(project,source),lines=(project?.estimate||[]).map(line=>({...facts(line.desc,line.qty,line.rate,lineConfig(line,project,source)),line})),workSubtotal=round2(lines.reduce((s,x)=>s+x.net,0)),travel=round2(project?.quote?.travel),parking=round2(project?.quote?.parking),travelFact=travel?facts('Reiskosten',1,travel,defaultVat):null,groups=new Map();
    for(const item of [...lines,...(travelFact?[travelFact]:[])]){if(!item.net)continue;const key=`${item.treatment}:${item.rate}`,current=groups.get(key)||{treatment:item.treatment,rate:item.rate,net:0,vat:0};current.net=round2(current.net+item.net);current.vat=round2(current.vat+item.vat);groups.set(key,current)}
    const vatBreakdown=[...groups.values()],taxableSubtotal=round2(workSubtotal+travel),vat=round2(vatBreakdown.reduce((s,x)=>s+x.vat,0)),total=round2(taxableSubtotal+vat+parking),mixed=vatBreakdown.length>1,only=vatBreakdown[0]||{treatment:defaultVat.treatment,rate:defaultVat.rate};
    return {lines,workSubtotal,travel,parking,travelFact,taxableSubtotal,subtotal:taxableSubtotal,vat,total,vatBreakdown,mixed,vatTreatment:mixed?'MIXED':only.treatment,vatRate:mixed?0:only.rate,defaultTreatment:defaultVat.treatment,defaultRate:defaultVat.rate};
  }
  function invoiceLines(project,idFactory=()=>Math.random().toString(36).slice(2,10).toUpperCase()){
    const total=calculate(project,'invoice'),out=total.lines.filter(x=>x.net!==0).map(x=>({id:x.line.id||idFactory(),description:x.description||'Werkzaamheden',quantity:x.quantity,unitNet:x.unitNet,vatRate:['REVERSE_CHARGE_NL','NL_ZERO'].includes(x.treatment)?0:x.rate,vatTreatment:x.treatment,vatReferenceRate:x.treatment==='REVERSE_CHARGE_NL'?x.rate:null,vatAmount:['REVERSE_CHARGE_NL','NL_ZERO'].includes(x.treatment)?0:null}));
    if(total.travelFact){const x=total.travelFact;out.push({id:idFactory(),description:'Reiskosten',quantity:1,unitNet:x.unitNet,vatRate:['REVERSE_CHARGE_NL','NL_ZERO'].includes(x.treatment)?0:x.rate,vatTreatment:x.treatment,vatReferenceRate:x.treatment==='REVERSE_CHARGE_NL'?x.rate:null,vatAmount:['REVERSE_CHARGE_NL','NL_ZERO'].includes(x.treatment)?0:null})}
    if(total.parking)out.push({id:idFactory(),description:'Parkeerkosten',quantity:1,unitNet:total.parking,vatRate:0,vatTreatment:'NL_ZERO',vatReferenceRate:null,vatAmount:0});
    return out;
  }
  return {num,round2,normalizeTreatment,referenceRate,selection,defaultConfig,lineConfig,facts,calculate,invoiceLines};
});
