/* Shared closing statement for OS and Bookkeeping invoice previews and PDFs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RenoweetInvoiceClosing=api})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const cents=n=>Math.round(Number(n)*100),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function valid(s,total){return !!s&&[s.finalTotal,s.previouslyInvoiced,s.finalInvoiceTotal,total].every(n=>n!=null&&Number.isFinite(Number(n))&&Number(n)>=0)&&cents(s.finalInvoiceTotal)===cents(total)&&cents(s.finalTotal)-cents(s.previouslyInvoiced)===cents(total)&&Array.isArray(s.instalments)&&s.instalments.every(i=>i.number&&Number.isFinite(Number(i.gross))&&Number(i.gross)>=0)&&(!s.instalments.length||s.instalments.reduce((sum,i)=>sum+cents(i.gross),0)===cents(s.previouslyInvoiced))}
 function render(s,total,format=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n)){
  if(!valid(s,total))return '';
  const row=(label,value,strong=false)=>`<tr><td class="d">${strong?'<strong>':''}${esc(label)}${strong?'</strong>':''}</td><td class="a">${strong?'<strong>':''}${esc(value)}${strong?'</strong>':''}</td></tr>`;
  const estimate=s.estimatedTotal!=null&&Number.isFinite(Number(s.estimatedTotal))?row('Raming bij eerste termijn (indicatief)',format(s.estimatedTotal)):'';
  const instalments=s.instalments.map(i=>row(`Verrekende deelfactuur ${i.number}`,'− '+format(i.gross))).join('');
  const previous=s.instalments.length!==1&&s.previouslyInvoiced>0?row('Totaal eerder gefactureerde termijnen','− '+format(s.previouslyInvoiced)):'';
  return `<div class="ros-invoice-terms"><p><b>Definitieve eindafrekening</b></p><p>Dit is de definitieve eindafrekening voor deze opdracht. Het definitieve opdrachttotaal bedraagt <b>${esc(format(s.finalTotal))} inclusief BTW</b>. Eerder gefactureerde termijnen zijn verrekend.</p></div><table class="ros-doc-table ros-final-settlement" style="margin-top:3mm!important"><colgroup><col style="width:70%!important"><col style="width:30%!important"></colgroup><thead><tr><th class="d">Eindafrekening (incl. BTW)</th><th class="a">Bedrag</th></tr></thead><tbody>${estimate}${row('Definitief opdrachttotaal',format(s.finalTotal),true)}${instalments}${previous}${row('Bedrag deze eindfactuur',format(s.finalInvoiceTotal),true)}</tbody></table><p class="ros-final-payment-note" style="font-size:9pt;color:#334b52;margin:2mm 0 4mm">Verrekend betekent eerder gefactureerd. Eventuele onbetaalde termijnen blijven apart verschuldigd. Betalingen worden afzonderlijk geregistreerd.</p>`;
 }
 return {valid,render};
});
