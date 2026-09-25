'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const V=require(path.resolve(__dirname,'..','renoweet-os-vat-engine-v1.js'));
const A=require(path.resolve(__dirname,'..','renoweet-accounting-engine-v4.4.js'));

const project={
  quote:{vatTreatment:'NL_HIGH',vat:21,travel:50,parking:20},
  invoice:{vatTreatment:'NL_HIGH',vatRate:21},
  estimate:[
    {id:'high',desc:'Timber work',qty:1,rate:1000,vatTreatment:'NL_HIGH',vatRate:21},
    {id:'low',desc:'Low-rate work',qty:1,rate:500,vatTreatment:'NL_LOW',vatRate:9},
    {id:'reverse',desc:'Reverse-charge work',qty:1,rate:200,vatTreatment:'REVERSE_CHARGE_NL',vatRate:0,vatReferenceRate:21},
    {id:'zero',desc:'Zero-rated item',qty:1,rate:100,vatTreatment:'NL_ZERO',vatRate:0}
  ]
};

const quote=V.calculate(project,'quote');
assert.equal(quote.mixed,true);
assert.equal(quote.vatTreatment,'MIXED');
assert.equal(quote.workSubtotal,1800);
assert.equal(quote.taxableSubtotal,1850);
assert.equal(quote.vat,265.5);
assert.equal(quote.total,2135.5);
assert.equal(quote.vatBreakdown.length,4);
assert.deepEqual(quote.vatBreakdown.map(x=>[x.treatment,x.rate,x.net,x.vat]),[
  ['NL_HIGH',21,1050,220.5],
  ['NL_LOW',9,500,45],
  ['REVERSE_CHARGE_NL',21,200,0],
  ['NL_ZERO',0,100,0]
]);

const lines=V.invoiceLines(project,()=>`new_${Math.random()}`);
assert.equal(lines.length,6);
assert.deepEqual(lines.slice(0,4).map(x=>[x.id,x.vatTreatment,x.vatRate,x.vatReferenceRate]),[
  ['high','NL_HIGH',21,null],
  ['low','NL_LOW',9,null],
  ['reverse','REVERSE_CHARGE_NL',0,21],
  ['zero','NL_ZERO',0,null]
]);
assert.equal(lines.at(-2).description,'Reiskosten');
assert.equal(lines.at(-2).vatRate,21);
assert.equal(lines.at(-1).description,'Parkeerkosten');
assert.equal(lines.at(-1).vatTreatment,'NL_ZERO');

const accounting=A.invoiceTotals({'Line items JSON':JSON.stringify(lines)});
assert.deepEqual(accounting,{net:1870,vat:265.5,gross:2135.5,lines:accounting.lines});
const sales=A.invoiceSalesBreakdown({'Line items JSON':JSON.stringify(lines)});
assert.deepEqual({taxableNet:sales.taxableNet,reverseChargeNet:sales.reverseChargeNet,zeroRatedNet:sales.zeroRatedNet},
  {taxableNet:1550,reverseChargeNet:200,zeroRatedNet:120});

const legacy={quote:{vatTreatment:'NL_LOW',vat:9,travel:0,parking:0},invoice:{},estimate:[{id:'legacy',desc:'Old line',qty:2,rate:100}]};
assert.equal(V.calculate(legacy,'quote').vat,18);
assert.equal(V.invoiceLines(legacy)[0].vatTreatment,'NL_LOW');

assert.equal(V.selection('NL_HIGH','NL_LOW',9).treatment,'NL_HIGH');
assert.equal(V.selection('NL_HIGH','NL_LOW',9).rate,21);
assert.equal(V.selection('NL_ZERO','NL_LOW',9).treatment,'NL_ZERO');
console.log('OS mixed VAT tests passed.');
