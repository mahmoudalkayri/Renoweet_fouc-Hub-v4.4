'use strict';
const assert=require('node:assert/strict');
require('../renoweet-legacy-xlsx-engine-v4.4.js');
const Engine=globalThis.RenoweetLegacyXlsxEngine;

const sheets=[
 {name:'Cashflow',rows:[
  ['Factuur #','IN  Brutu','In - BTW','Out Brutu','Parking','Other Costs','BTW','Month','Issued to','Adres','work description','Contacts'],
  ['2026-1501001',1210,null,null,0,0,210,'01','Client A','Amsterdam','Carpentry','client@example.com'],
  ['2026-1504002',605,null,null,0,0,105,'04','Client B','Utrecht','Repairs','0612345678']
 ]},
 {name:'Expenses',rows:[
  [],
  [null,'Total',null,null,null,null,null,null,null,null,null,null,'Fuel'],
  [null,'ID (date)','Amount','BTW','CustumVAT','Purchace from ','Month','Description','File',null,null,null,'Bill','Date','Amount','BTW','Note'],
  [null,'10/1',121,21,null,'Hornbach','01','Timber',null,null,null,null,null,'2026-01-20',60.5,10.5,'Shell'],
  [null,'10/1',121,21,null,'Hornbach','01','Timber',null,null,null,null,null,'2026-01-20',60.5,10.5,'Shell']
 ]}
];
const prepared=Engine.parseSheets(sheets,{year:2026,quarter:1},{name:'Q1.xlsx',sha256:'abc'});
assert.deepEqual(Engine.totals(prepared),{projects:1,invoices:1,expenses:2,fuel:2,auto:0});
assert.equal(prepared.outside.length,1);
assert.match(prepared.records.projects[0].id,/^PLEGACY-2026Q1-[A-F0-9]{12}$/);
assert.equal(prepared.records.invoices[0]['Invoice #'],'2026-1501001');
assert.equal(prepared.records.invoices[0]['Gross incl. VAT'],1210);
assert.equal(prepared.records.invoices[0]['Net revenue']+prepared.records.invoices[0].VAT,1210);
assert.notEqual(prepared.records.fuel[0]._migrationKey,prepared.records.fuel[1]._migrationKey);

const blank={os:{projects:[]},bookkeeping:{invoices:[],expenses:[],fuel:[],auto:[]}};
const first=Engine.compare(prepared,blank);
assert.equal(first.projects.length,1);assert.equal(first.invoices.length,1);assert.equal(first.expenses.length,2);assert.equal(first.fuel.length,2);
const oneFuel={os:{projects:[...first.projects]},bookkeeping:{invoices:[...first.invoices],expenses:[...first.expenses],fuel:[first.fuel[0]],auto:[]}};
const second=Engine.compare(prepared,oneFuel);
assert.equal(second.projects.length,0);assert.equal(second.invoices.length,0);assert.equal(second.expenses.length,0);assert.equal(second.fuel.length,1);
const all={os:{projects:[...first.projects]},bookkeeping:{invoices:[...first.invoices],expenses:[...first.expenses],fuel:[...first.fuel],auto:[]}};
const rerun=Engine.compare(prepared,all);
assert.equal(rerun.projects.length+rerun.invoices.length+rerun.expenses.length+rerun.fuel.length+rerun.auto.length,0);
console.log('Legacy XLSX import checks passed.');
