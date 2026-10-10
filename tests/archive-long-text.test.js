'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}};
global.window=global;global.localStorage=storage();global.sessionStorage=storage();
// The regular suite checks Excel's documented cell limit without network access.
// Set XLSX_TEST_MODULE to run the same checks through the actual XLSX writer/reader.
global.XLSX=process.env.XLSX_TEST_MODULE?require(process.env.XLSX_TEST_MODULE):{
 utils:{book_new:()=>({SheetNames:[],Sheets:{}}),json_to_sheet:rows=>({rows}),sheet_to_json:sheet=>sheet.rows,
  book_append_sheet:(wb,sheet,name)=>{wb.SheetNames.push(name);wb.Sheets[name]=sheet}},
 write:wb=>{for(const sheet of Object.values(wb.Sheets))for(const row of sheet.rows)for(const value of Object.values(row))if(typeof value==='string'&&value.length>32767)throw new Error('Text length must not exceed 32767 characters');return new Uint8Array([1])}
};
require('../renoweet-drive-core-v3.0.js');
const Core=global.RenoweetDrive;
const rows=(wb,name)=>XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:''});
(async()=>{
 const data=Core.blankCanonical(2026),photo='data:image/jpeg;base64,'+'A'.repeat(120000);
 const unicode='x'.repeat(29999)+'\u{1F4F7}'+' details\n'.repeat(6000),longScope='Scope\n'+'**Keep the complete description**\n'.repeat(2000);
 data.os.projects.push({id:'long-project',customer:{id:'customer',name:'Archive customer'},scope:longScope,scopePhotos:[{id:'photo',dataUrl:photo,caption:unicode}],invoiceDocuments:[{number:'2026-001',description:longScope}],estimate:[],materials:[],documents:[],payments:[],purchaseOrders:[],activity:[],followUps:[],checklist:[]});
 data.bookkeeping.invoices.push({'Record ID':'invoice','Invoice #':'2026-001',Date:'2026-07-01','Gross incl. VAT':121,VAT:21,'Net revenue':100,'Line items JSON':JSON.stringify([{description:longScope,quantity:1,unitNet:100,vatRate:21}])});
 data.bookkeeping.control.ArchiveNote=unicode;
 data.periods['2026-Q3']={...data.periods['2026-Q3'],btwStatus:'Filed',actualAmount:'2184',note:'B'.repeat(32767)};
 data.audit.push({eventId:'test-event',type:'test',note:unicode});
 const before=JSON.stringify(data),wb=await Core.canonicalToWorkbook(data);
 assert.equal(JSON.stringify(data),before,'Creating an archive must never rewrite live records or filing status.');
 for(const name of wb.SheetNames)for(const row of rows(wb,name))for(const value of Object.values(row))if(typeof value==='string')assert(value.length<=32767,`${name} contains a value above the Excel cell limit`);
 const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array'});
 const restoredWorkbook=process.env.XLSX_TEST_MODULE?XLSX.read(bytes,{type:'array'}):wb;
 const canonical=JSON.parse(rows(restoredWorkbook,'Canonical JSON').sort((a,b)=>a.Part-b.Part).map(r=>r.JSON).join(''));
 const restored=await Core.verifyCanonical(canonical);
 assert.equal(restored.os.projects[0].scopePhotos[0].dataUrl,photo,'The complete photo must survive archive creation and restoration.');
 assert.equal(restored.os.projects[0].scopePhotos[0].caption,unicode,'Unicode captions must survive XLSX serialization.');
 assert.equal(restored.os.projects[0].scope,longScope);
 assert.equal(restored.bookkeeping.invoices[0]['Gross incl. VAT'],121);
 assert.equal(restored.periods['2026-Q3'].btwStatus,'Filed');
 assert.equal(restored.periods['2026-Q3'].status,'open','Creating an archive must not close a quarter before its upload succeeds.');
 assert.equal(rows(restoredWorkbook,'Periods').find(r=>r.Period==='2026-Q3').note,data.periods['2026-Q3'].note,'A cell exactly at the Excel limit should stay unchanged.');
 const fullText=rows(restoredWorkbook,'Long Text');
 const projectText=column=>fullText.filter(r=>r.Sheet==='Projects'&&r.Row===2&&r.Column===column).sort((a,b)=>a.Part-b.Part).map(r=>r.Text).join('');
 assert.equal(projectText('Scope'),longScope,'Readable archive overflow must retain the exact full text, not silently truncate it.');
 assert.equal(projectText('Scope Photos JSON'),JSON.stringify(data.os.projects[0].scopePhotos));
 assert.equal(projectText('Invoice Documents JSON'),JSON.stringify(data.os.projects[0].invoiceDocuments));
 assert.match(rows(restoredWorkbook,'Projects')[0]['Scope Photos JSON'],/Long Text/,'Overflow cells must tell the reader where their full contents are stored.');
 assert.equal(fullText.filter(r=>r.Sheet==='Bookkeeping Control'&&r.Column==='Value').sort((a,b)=>a.Part-b.Part).map(r=>r.Text).join(''),unicode);
 const small=Core.blankCanonical(2027),smallWorkbook=await Core.canonicalToWorkbook(small);
 assert(!smallWorkbook.SheetNames.includes('Long Text'),'Small existing archives should retain their established sheet layout.');
 // Exercise the actual Close Quarter button handler without writing to a real Drive.
 const adapter=fs.readFileSync(require.resolve('../renoweet-bookkeeping-drive-adapter-v3.7.js'),'utf8');
 const closeSource=adapter.slice(adapter.indexOf('async function closeQuarter('),adapter.indexOf('\nasync function reopenQuarter('));
 const events=[],alerts=[],closedData=Core.clone(data),state={year:2026,selectedQuarter:3,connected:true,readOnly:false};
 const context={state,window:{},console:{error:()=>{}},confirm:()=>true,alert:message=>alerts.push(message),status:()=>{},syncPeriodState:()=>{},render:()=>{},updateQuarterControls:()=>{},saveDrive:async()=>{events.push('save');return true},RenoweetDrive:{
  clone:Core.clone,loadYear:async()=>({data:closedData}),
  createArchiveOnDrive:async canonical=>{events.push('archive');XLSX.write(await Core.canonicalToWorkbook(canonical),{bookType:'xlsx',type:'array'});return {id:'archive',name:'Renoweet-2026-Q3.xlsx'}},
  markQuarterClosed:async(year,quarter,archive)=>{assert.equal(archive.id,'archive');events.push('close');closedData.periods[`${year}-Q${quarter}`].status='closed';return closedData}
 }};
 vm.createContext(context);vm.runInContext(closeSource,context);
 assert.equal(await context.closeQuarter(3),true);
 assert.deepEqual(events,['save','archive','close'],'The financial lock must happen only after the archive succeeds.');
 assert.equal(closedData.periods['2026-Q3'].btwStatus,'Filed');
 assert.equal(closedData.periods['2026-Q3'].actualAmount,'2184');
 closedData.periods['2026-Q3'].status='open';events.length=0;
 context.RenoweetDrive.createArchiveOnDrive=async()=>{events.push('archive-failed');throw new Error('Archive upload failed')};
 assert.equal(await context.closeQuarter(3),false);
 assert.deepEqual(events,['save','archive-failed']);assert.equal(closedData.periods['2026-Q3'].status,'open');
 assert.equal(closedData.periods['2026-Q3'].btwStatus,'Filed','A failed archive must leave the saved filing status intact.');
 console.log('Archive overflow checks passed: exact photos/text/Unicode restoration, unchanged live amounts and filing status, Excel boundary, readable overflow and small-archive compatibility.');
})().catch(error=>{console.error(error);process.exitCode=1});
