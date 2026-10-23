/* Monthly schedules are planning data. Only explicitly confirmed rows enter the expense ledger. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./renoweet-accounting-engine-v4.4.js'):root.RenoweetAccounting);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.RenoweetMonthlyPayments=api;
})(typeof window!=='undefined'?window:globalThis,function(A){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),round=A.round2,ledgers={General:'expenses',Automobile:'auto',Fuel:'fuel'};
 const empty=()=>({version:1,subscriptions:[],months:{}});
 function state(book){return book.control?.MonthlyPayments||empty()}
 function ensure(book){book.control=book.control||{};return book.control.MonthlyPayments=book.control.MonthlyPayments||empty()}
 function month(value){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value)))throw Error('Choose a valid month.');return String(value)}
 function previousMonth(value){const [y,m]=month(value).split('-').map(Number);return `${m===1?y-1:y}-${String(m===1?12:m-1).padStart(2,'0')}`}
 function date(value){const s=String(value||''),d=new Date(s+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(d)||d.toISOString().slice(0,10)!==s)throw Error('Enter a valid date.');return s}
 function scheduledDate(value,day){const [y,m]=month(value).split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();return value+'-'+String(Math.min(day,last)).padStart(2,'0')}
 function number(value,label,min=0,max=Infinity){const s=String(value??'').trim().replace(/\s|€/g,'');let normalized=s;if(s.includes(',')&&s.includes('.'))normalized=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else normalized=s.replace(',','.');const n=Number(normalized);if(!s||!Number.isFinite(n)||n<min||n>max)throw Error('Enter a valid '+label+'.');return round(n)}
 function editable(context){if(context?.readOnly)throw Error('This historical year is read-only.');if(!Number.isInteger(context?.year))throw Error('Select a bookkeeping year first.')}
 function guardDates(context,values){editable(context);for(const v of values.filter(Boolean)){const iso=date(A.iso(v)||v),y=Number(iso.slice(0,4)),q=Math.ceil(Number(iso.slice(5,7))/3);if(y!==context.year)throw Error('The invoice and payment dates must be in the selected bookkeeping year.');if(context.periods?.[`${y}-Q${q}`]?.status==='closed'||context.closedQuarters?.includes(q))throw Error(`Q${q} ${y} is closed. Reopen that quarter before changing this monthly expense.`)}}
 function subscription(book,id){const found=state(book).subscriptions.filter(s=>s.id===id);if(found.length!==1)throw Error('The subscription changed or is duplicated. Refresh and try again.');return found[0]}
 function settings(input){
  const name=String(input.name||'').trim(),supplier=String(input.supplier||'').trim();if(!name||!supplier)throw Error('Enter the payment name and supplier.');
  const ledger=input.ledger||'General';if(!ledgers[ledger])throw Error('Choose General, Automobile or Fuel.');
  const gross=number(input.gross,'amount greater than zero',.01),vatRate=number(input.vatRate,'BTW rate');if(![0,9,21].includes(vatRate))throw Error('Choose 21%, 9% or 0% BTW.');
  const day=number(input.day,'payment day',1,31);if(!Number.isInteger(day))throw Error('Payment day must be a whole number.');
  return {name,supplier,ledger,category:String(input.category||'').trim()||(ledger==='Automobile'?'Vehicle':ledger==='Fuel'?'Fuel':'Subscriptions'),gross,vatRate,day,proof:String(input.proof||'').trim(),proofId:String(input.proofId||''),proofMime:String(input.proofMime||''),vatPct:number(input.vatPct??100,'VAT deductible percentage',0,100),incomePct:number(input.incomePct??100,'income-tax deductible percentage',0,100),method:input.method||'Bank',notes:String(input.notes||'').trim()};
 }
 function saveSubscription(book,input,context){
  editable(context);const from=month(input.from);if(Number(from.slice(0,4))!==context.year)throw Error('Choose an effective month in the selected year.');const value=settings(input),current=input.id?subscription(book,input.id):null;
  if(current&&from<current.startMonth)throw Error('Changes cannot start before the subscription start month.');
  const s=current?clone(current):{id:A.makeId('MON'),startMonth:from,endMonth:'',versions:[]};
  s.versions=s.versions.filter(v=>v.from!==from);s.versions.push({from,...value});s.versions.sort((a,b)=>a.from.localeCompare(b.from));
  const target=ensure(book);if(current)target.subscriptions[target.subscriptions.findIndex(v=>v.id===s.id)]=s;else target.subscriptions.push(s);return clone(s);
 }
 function stopSubscription(book,id,firstUnusedMonth,context){editable(context);const from=month(firstUnusedMonth);if(Number(from.slice(0,4))!==context.year)throw Error('Choose a stop month in the selected year.');const s=subscription(book,id);s.endMonth=previousMonth(from);return clone(s)}
 function resumeSubscription(book,id,context){editable(context);const s=subscription(book,id);s.endMonth='';return clone(s)}
 function records(book,id,value){return Object.entries(ledgers).flatMap(([ledger,key])=>(book[key]||[]).map((r,index)=>({ledger,key,index,r})).filter(x=>x.r['Monthly subscription ID']===id&&x.r['Monthly period']===value))}
 function key(id,value){return id+'@'+month(value)}
 function occurrence(book,id,value){
  month(value);const s=subscription(book,id),v=[...s.versions].reverse().find(v=>v.from<=value),found=records(book,id,value),draft=state(book).months[key(id,value)];
  const active=!!v&&value>=s.startMonth&&(!s.endMonth||value<=s.endMonth);if(!active&&!found.length)return null;
  if(!v)throw Error('The subscription has no settings for this month.');
  const base={id,month:value,...clone(v),date:scheduledDate(value,v.day),paid:false,paymentDate:scheduledDate(value,v.day),status:'planned'};
  if(found.length>1)return {...base,status:'conflict',conflict:true};
  if(found.length){const {r,ledger}=found[0],facts=A.expenseFacts(r);return {...base,name:r['Monthly payment name']||r.Description||v.name,supplier:r.Supplier||v.supplier,ledger,category:r.Category||v.category,date:A.iso(r['Document date']||r.Date),gross:facts.gross,vatRate:Number(r['VAT rate']),vatPct:facts.vatPct,incomePct:facts.incomePct,paid:String(r['Payment status']||'Paid')==='Paid',paymentDate:A.iso(r['Payment date'])||'',proof:r['Receipt/File']||'',proofId:r['Proof Drive ID']||'',proofMime:r['Proof MIME']||'',method:r['Payment method']||'Bank',notes:r.Notes||'',status:'recorded',requiresLedgerEdit:![0,9,21].includes(Number(r['VAT rate']))||facts.reversePurchase||facts.insuranceContribution>0||Math.abs(round(facts.gross-facts.gross/(1+Number(r['VAT rate'])/100))-facts.invoiceVat)>.011,recordId:r['Record ID']||r._rid,record:clone(r)}}
  return {...base,...clone(draft||{}),id,month:value,status:draft?.status==='skipped'?'skipped':draft?'draft':'planned'};
 }
 function rows(book,year,quarter){const months=quarter?[(quarter-1)*3+1,(quarter-1)*3+2,(quarter-1)*3+3]:Array.from({length:12},(_,i)=>i+1);return months.flatMap(m=>state(book).subscriptions.map(s=>occurrence(book,s.id,`${year}-${String(m).padStart(2,'0')}`)).filter(Boolean)).sort((a,b)=>a.month.localeCompare(b.month)||a.name.localeCompare(b.name))}
 function occurrenceInput(base,input){
  const value={...base,...input},gross=number(value.gross,'amount greater than zero',.01),vatRate=number(value.vatRate,'BTW rate');if(![0,9,21].includes(vatRate))throw Error('Choose 21%, 9% or 0% BTW.');
  const paid=value.paid===true,invoiceDate=date(value.date),paymentDate=paid?date(value.paymentDate||invoiceDate):'';
  return {date:invoiceDate,gross,vatRate,paid,paymentDate,proof:String(value.proof||'').trim(),proofId:String(value.proofId||''),proofMime:String(value.proofMime||''),vatPct:number(value.vatPct,'VAT deductible percentage',0,100),incomePct:number(value.incomePct,'income-tax deductible percentage',0,100),method:value.method||'Bank',notes:String(value.notes||'').trim()};
 }
 function saveMonth(book,id,value,input,context,{draftOnly=false,linkRecordId=''}={}){
  const base=occurrence(book,id,value);if(!base)throw Error('This subscription is not scheduled for that month.');if(base.conflict)throw Error('Duplicate monthly expenses found. Review the expense ledger first.');if(base.requiresLedgerEdit)throw Error('This expense has custom VAT or an insurance settlement. Edit it in the main expense ledger.');
  guardDates(context,[value+'-01']);
  let existing=records(book,id,value)[0];
  if(linkRecordId){if(existing)throw Error('This month already has a recorded expense.');const found=Object.entries(ledgers).flatMap(([ledger,key])=>(book[key]||[]).map((r,index)=>({ledger,key,index,r}))).filter(x=>(x.r['Record ID']||x.r._rid)===linkRecordId);if(found.length!==1||found[0].r['Monthly subscription ID'])throw Error('Choose one existing expense that is not already linked.');const x=found[0];guardDates(context,[x.r['Document date']||x.r.Date,x.r['Payment date']]);
   if(A.iso(x.r['Document date']||x.r.Date).slice(0,7)!==value)throw Error('The existing expense must have an invoice date in this scheduled month.');
   x.r['Monthly subscription ID']=id;x.r['Monthly period']=value;x.r['Monthly payment name']=base.name;delete ensure(book).months[key(id,value)];return occurrence(book,id,value);
  }
  const fields=occurrenceInput(base,input);guardDates(context,[base.record?.['Document date']||base.record?.Date,base.record?.['Payment date'],fields.date,fields.paymentDate]);
  if(draftOnly){if(base.record)throw Error('Use Save changes to edit an already recorded expense.');ensure(book).months[key(id,value)]={...fields,status:'draft'};return occurrence(book,id,value)}
  if(!fields.proof)throw Error('Add the supplier invoice, policy or contract proof before confirming this expense. You can save a draft first.');
  if(!existing){const similar=Object.values(ledgers).flatMap(k=>book[k]||[]).find(r=>A.iso(r['Document date']||r.Date)===fields.date&&String(r.Supplier||'').trim().toLowerCase()===base.supplier.toLowerCase()&&Math.abs(A.expenseFacts(r).gross-fields.gross)<.005);if(similar)throw Error('A matching expense already exists. Use Link existing expense to avoid recording it twice.')}
  const previous=existing?.r||{},vat=round(fields.gross-fields.gross/(1+fields.vatRate/100)),net=round(fields.gross-vat),dedVat=round(vat*fields.vatPct/100),cost=round((fields.gross-dedVat)*fields.incomePct/100),stamp=new Date().toISOString();
  const r={...previous,'Record ID':previous['Record ID']||previous._rid||A.makeId('EXP'),'Main category':base.ledger,'Document date':A.excelSerial(fields.date),Date:A.excelSerial(fields.date),Supplier:base.supplier,Category:base.category,Description:existing?(previous.Description||base.name):base.name,Gross:fields.gross,'Invoice VAT':vat,VAT:vat,'VAT rate':String(fields.vatRate),Net:net,'VAT treatment':fields.vatRate===21?'NL_HIGH':fields.vatRate===9?'NL_LOW':'NL_ZERO','VAT deductible %':fields.vatPct,'Deductible VAT':dedVat,'Income tax deductible %':fields.incomePct,'Food income-tax override':true,'Deductible cost':cost,'Deductible cost before insurance':cost,'Deductible cost after insurance':cost,'Reverse-charge reference rate':0,'Reverse-charge VAT':0,'Payment status':fields.paid?'Paid':'Unpaid','Payment date':fields.paid?A.excelSerial(fields.paymentDate):'','Payment method':fields.method,'Business amount paid':fields.paid?fields.gross:0,'Receipt/File':fields.proof,'Proof Drive ID':fields.proofId,'Proof MIME':fields.proofMime,'Proof Check':!existing||fields.proof!==previous['Receipt/File']?'Not checked':fields.gross!==A.expenseFacts(previous).gross||vat!==A.expenseFacts(previous).invoiceVat?'Review':previous['Proof Check']||'Not checked',Notes:fields.notes,'Monthly subscription ID':id,'Monthly period':value,'Monthly payment name':base.name,'Monthly confirmed at':previous['Monthly confirmed at']||stamp,'Monthly updated at':stamp};
  // This editor handles ordinary subscription invoices, not insurance claim settlements.
  if(existing&&(A.expenseFacts(previous).insuranceContribution>0||A.expenseFacts(previous).reversePurchase))throw Error('This expense has an insurance settlement or reverse-charge VAT. Edit it in the main expense ledger.');
  if(existing)book[existing.key][existing.index]=r;else{const ledger=ledgers[base.ledger];book[ledger]=book[ledger]||[];book[ledger].push(r)}
  delete ensure(book).months[key(id,value)];return occurrence(book,id,value);
 }
 function skipMonth(book,id,value,context,{undo=false}={}){
  const base=occurrence(book,id,value);if(!base||base.conflict)throw Error('Review the monthly row first.');guardDates(context,[value+'-01',base.record?.['Document date']||base.record?.Date,base.record?.['Payment date']]);
  if(base.record){if(!undo)throw Error('Use Undo recorded expense to remove a confirmed month.');const found=records(book,id,value)[0];book.deleted=book.deleted||[];book.deleted.push({'Deleted at':new Date().toISOString(),Type:'Monthly expense','Record ID':base.recordId,'Customer / Supplier':base.supplier,Description:base.name,Gross:base.gross,VAT:base.record.VAT,Net:base.record.Net,Status:'Removed','Original record':clone(found.r)});book[found.key].splice(found.index,1)}
  ensure(book).months[key(id,value)]={status:base.status==='skipped'?'draft':'skipped'};return occurrence(book,id,value);
 }
 function copySubscriptions(book,source,year,context){editable(context);if(year!==context.year)throw Error('The selected year changed. Try again.');let count=0;for(const old of state(source).subscriptions){const target=ensure(book);if(target.subscriptions.some(s=>s.id===old.id))continue;const start=`${year}-01`;if(old.endMonth&&old.endMonth<start)continue;const version=[...old.versions].reverse().find(v=>v.from<=start)||old.versions[0];if(!version)continue;const fields=settings(version);target.subscriptions.push({id:old.id,startMonth:start,endMonth:'',versions:[{from:start,...fields}]});count++}return count}
 return {state,rows,occurrence,saveSubscription,stopSubscription,resumeSubscription,saveMonth,skipMonth,copySubscriptions,month,previousMonth,scheduledDate,number};
});
