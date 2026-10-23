/* Remove inactive recovery copies only; live ledgers are never changed here. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./renoweet-accounting-engine-v4.4.js'):root.RenoweetAccounting);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RenoweetRecoveryRecords=api})(typeof window!=='undefined'?window:globalThis,function(A){
 'use strict';
 function original(row){const value=row['Original record']??row['Original JSON'];if(value&&typeof value==='object')return value;try{return JSON.parse(value||'{}')}catch{return {}}}
 function dates(row){const r=original(row);return [...new Set(['Date','date','Document date','Payment date','paymentDate','invoiceDate','Invoice date','creditDate'].flatMap(k=>[A.iso(r?.[k]),A.iso(row?.[k])]).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)))];}
 function blocked(row,context){
  if(context?.readOnly)return 'This historical year is read-only.';
  if(!Number.isInteger(context?.year))return 'Select a bookkeeping year first.';
  const ds=dates(row),closed=Object.entries(context.periods||{}).filter(([key,value])=>key.startsWith(context.year+'-Q')&&value.status==='closed');
  if(!ds.length&&(closed.length||context.closedQuarters?.length))return 'The original date is unavailable. Reopen the year’s closed quarters before deleting this recovery copy.';
  for(const dsValue of ds){const y=Number(dsValue.slice(0,4)),q=Math.ceil(Number(dsValue.slice(5,7))/3);if(y!==context.year)return 'The original record belongs to another bookkeeping year.';if(context.periods?.[`${y}-Q${q}`]?.status==='closed'||context.closedQuarters?.includes(q))return `Q${q} ${y} is closed. Reopen it before deleting this recovery copy.`;}
  return '';
 }
 function purge(book,targets,context,{confirmed=false}={}){
  if(!confirmed)throw Error('Confirm permanent deletion first.');if(!Array.isArray(targets)||!targets.length)throw Error('Select recovery copies to delete.');
  const seen=new Set();for(const target of targets){const {index,snapshot}=target;if(!Number.isInteger(index)||seen.has(index)||!book.deleted?.[index]||JSON.stringify(book.deleted[index])!==snapshot)throw Error('The recovery list changed. Refresh and select the records again.');seen.add(index);const reason=blocked(book.deleted[index],context);if(reason)throw Error(reason);}
  // Validate every selection before removing anything; do not re-create removed copies.
  book.deleted=book.deleted.filter((row,index)=>!seen.has(index));return seen.size;
 }
 return {original,dates,blocked,purge};
});
