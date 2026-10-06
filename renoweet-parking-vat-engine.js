/* Historical parking reimbursement calculation. Never writes invoice records. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RenoweetParkingVat=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const policy=Object.freeze({start:'2026-01-01',end:'2026-10-06',rate:21});
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const round=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
  function parkingLine(line){
    if(line.id==='legacy_parking'||line.sourceKey==='quote:parking')return true;
    const description=String(line.description||'').trim().replace(/^Deelfactuur\s*\/\s*aanbetaling:\s*/i,'');
    return /^(parking(?:\s+(?:recharge|costs?|fees?|reimbursement))?|parkeerkosten|parkeren)$/i.test(description);
  }
  function calculate(invoice,lines,date){
    const original=lines.map(l=>({...l})),candidates=original.filter(parkingLine);
    const result={lines:original,changes:[],review:[],parkingGross:0,vatAdjustment:0,netAdjustment:0};
    if(!candidates.length)return result;
    const status=String(invoice?.['Lifecycle status']||invoice?.Status||'').toLowerCase();
    if(['draft','cancelled'].includes(status))return result;
    if(!date){result.review.push('Parking invoice has no reliable invoice date.');return result}
    if(date<policy.start||date>policy.end)return result;
    const untaxed=candidates.filter(l=>num(l.vatRate)===0&&num(l.vatAmount)===0);
    if(!untaxed.length)return result;
    if(status==='unknown'){result.review.push('Invoice status is Unknown; confirm that it was issued before including it in tax reports.');return result}
    const totals=original.reduce((a,l)=>{const net=round((num(l.quantity)||1)*num(l.unitNet)),vat=round(l.vatAmount==null?net*num(l.vatRate)/100:num(l.vatAmount));a.net=round(a.net+net);a.vat=round(a.vat+vat);return a},{net:0,vat:0});
    if((invoice?.VAT!=null&&Math.abs(num(invoice.VAT)-totals.vat)>.009)||(invoice?.['Gross incl. VAT']!=null&&Math.abs(num(invoice['Gross incl. VAT'])-round(totals.net+totals.vat))>.009)||original.some(l=>l.id==='legacy_work'&&Math.abs(round((num(l.quantity)||1)*num(l.unitNet)*num(l.vatRate)/100)-num(l.vatAmount))>.03&&l.vatAmount!=null)){
      result.review.push('Recorded VAT / invoice lines do not reconcile; parking may already have been corrected.');return result;
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
