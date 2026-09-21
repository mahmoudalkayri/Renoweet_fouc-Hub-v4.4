'use strict';
const assert=require('node:assert/strict');

global.window=global;
const memoryStore=()=>{const values=new Map();return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
global.localStorage=memoryStore();
global.sessionStorage=memoryStore();

require('../renoweet-drive-core-v3.0.js');
const Core=global.RenoweetDrive;

(async()=>{
  const year=2026;
  const legacy={
    schema:'renoweet.year',schemaVersion:3,
    meta:{year,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-09-20T00:00:00.000Z',revision:4,status:'active',appVersion:'focus-hub-v4.4.4',lastUpdatedBy:'legacy-device',sections:{osRevision:1,bookkeepingRevision:3}},
    periods:Object.fromEntries([1,2,3,4].map(q=>[`${year}-Q${q}`,{status:'open',closedAt:null,archiveFileId:null,archiveChecksum:null,closedRevision:null}])),
    integrity:{algorithm:'SHA-256',checksum:'',recordCount:1},
    os:{projects:[],bookkeeping:[],deleted:[]},
    bookkeeping:{invoices:[{'Record ID':'INV_LEGACY','Invoice #':'2026-001',Date:'2026-01-02',Customer:'Existing customer',Status:'Open','Gross incl. VAT':121,VAT:21,'Net revenue':100}],expenses:[],fuel:[],auto:[],payments:[],creditNotes:[],deleted:[],control:{}},
    audit:[]
  };
  legacy.integrity.checksum=await Core.computeChecksum(legacy);
  const verified=await Core.verifyCanonical(legacy);
  assert.equal(verified.integrity.checksum,legacy.integrity.checksum,'migration must preserve the checksum that authenticated the stored legacy bytes');
  for(const key of ['fixedAssets','financeLeases','leasePayments','ownerTransactions'])assert.deepEqual(verified.bookkeeping[key],[],`legacy databases must gain an empty ${key} collection only after verification`);
  const tampered=Core.clone(legacy);tampered.bookkeeping.invoices[0].Customer='Tampered customer';
  await assert.rejects(()=>Core.verifyCanonical(tampered),error=>error?.name==='RenoweetIntegrityError','real post-checksum changes must still be rejected');
  console.log('Checksum-first schema migration checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
