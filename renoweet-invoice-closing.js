/* Shared closing statement for OS and Bookkeeping invoice previews and PDFs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RenoweetInvoiceClosing=api})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const cents=n=>Math.round(Number(n)*100),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n);
 function valid(s,total){return !!s&&[s.finalTotal,s.previouslyInvoiced,s.finalInvoiceTotal,total].every(n=>n!=null&&Number.isFinite(Number(n))&&Number(n)>=0)&&cents(s.finalInvoiceTotal)===cents(total)&&cents(s.finalTotal)-cents(s.previouslyInvoiced)===cents(total)&&Array.isArray(s.instalments)&&s.instalments.every(i=>i.number&&Number.isFinite(Number(i.gross))&&Number(i.gross)>=0)&&(!s.instalments.length||s.instalments.reduce((sum,i)=>sum+cents(i.gross),0)===cents(s.previouslyInvoiced))}
 function render(s,total){
  if(!valid(s,total))return '';
  return `<div class="ros-invoice-terms"><p><b>Definitieve eindafrekening</b></p><p>Dit is de definitieve eindafrekening voor deze opdracht. Eerder gefactureerde termijnen zijn hieronder verrekend.</p></div><p class="ros-final-payment-note" style="font-size:9pt;color:#334b52;margin:2mm 0 4mm">Verrekend betekent eerder gefactureerd. Eventuele onbetaalde termijnen blijven apart verschuldigd. Betalingen worden afzonderlijk geregistreerd.</p>`;
 }
 function totalRow(s,total,lines,columns,format=money){
  if(!valid(s,total)||!Array.isArray(lines)||![4,5].includes(columns))return '';
  // Use the invoice's own (possibly frozen) work lines, before exact advance deductions.
  const groups=new Map();let gross=0;
  for(const l of lines){
   if(String(l.id||'').startsWith('deduct_'))continue;
   const net=cents(Number(l.quantity)*Number(l.unitNet)),vat=cents(l.vatAmount??net/100*Number(l.vatRate)/100);
   if(!Number.isFinite(net)||!Number.isFinite(vat))return '';
   gross+=net+vat;
   const treatment=String(l.vatTreatment||''),rate=Number(l.vatRate),label=treatment==='REVERSE_CHARGE_NL'?'verlegd':treatment==='EXEMPT'?'vrijgesteld':treatment==='EU_B2B'?'EU B2B':treatment==='OUT_OF_SCOPE'?'buiten heffing':`${rate}%`;
   const group=groups.get(label)||{label,rate,vat:0};group.vat+=vat;groups.set(label,group);
  }
  if(gross!==cents(s.finalTotal))return '';
  const breakdown=[...groups.values()].sort((a,b)=>a.rate-b.rate||a.label.localeCompare(b.label)).map(g=>`${g.label} ${format(g.vat/100)}`).join(', ');
  return `<tr class="ros-final-project-total"><td class="d" colspan="${columns-1}" style="width:auto!important"><strong>Definitief opdrachttotaal incl. BTW</strong> <small class="ros-final-vat-breakdown">(BTW: ${esc(breakdown)})</small></td><td class="a"><strong>${esc(format(s.finalTotal))}</strong></td></tr>`;
 }
 function insertTotalRow(rows,s,total,lines,columns,format=money){
  const summary=totalRow(s,total,lines,columns,format);if(!summary)return rows;
  const rendered=rows.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)||[];if(rendered.length!==lines.length)return rows;
  const deduction=lines.findIndex(l=>String(l.id||'').startsWith('deduct_'));rendered.splice(deduction<0?rendered.length:deduction,0,summary);return rendered.join('');
 }
 return {valid,render,totalRow,insertTotalRow};
});
