/* Shared display details for the Hub, OS, Bookkeeping, Notebook and BOD. */
(function(){
'use strict';
const defaults={companyName:'Renoweet',kvk:'97746312',btw:'NL005285311B07',bankAccount:'NL45INGB0111929547',accountName:'Mahmoud Idris',address:'Hiridostraat 2c65, 1101 CW Amsterdam',email:'renoweet@hotmail.com',phone:'06 43865003',website:'www.renoweet.nl'};
const details={...defaults};
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api={get:key=>details[key]||'',html:key=>html(details[key]||''),details,ready:null};
window.RenoweetCompany=api;
api.ready=fetch('./company-details.txt',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Company details unavailable');return r.text()}).then(text=>{
 for(const line of text.split(/\r?\n/)){const match=line.match(/^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$/);if(match&&Object.hasOwn(defaults,match[1]))details[match[1]]=match[2]}
 const apply=()=>{document.querySelectorAll('[data-company-name]').forEach(el=>{el.textContent=details.companyName});document.querySelectorAll('[data-company-field]').forEach(el=>{el.textContent=details[el.dataset.companyField]||''})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
 return details;
}).catch(error=>{console.warn(error);return details});
})();
