'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['index.html','Renoweet-Bookkeeping-Drive-v2.2.html','Renoweet-OS-Drive-v2.2.html','Renoweet-BOD-Drive-v2.2.html'];
const missing=[];
for(const page of pages){
  const text=fs.readFileSync(path.join(root,page),'utf8');
  for(const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
    const ref=match[1];
    if(/^(?:https?:|data:|#|mailto:|tel:)/.test(ref)||ref.includes('${'))continue;
    const clean=ref.replace(/[?#].*$/,'').replace(/^\.\//,'');
    if(clean&&!fs.existsSync(path.join(root,clean)))missing.push(`${page}: ${ref}`);
  }
}
if(missing.length)throw new Error(`Missing local assets:\n${missing.join('\n')}`);
const bookkeeping=fs.readFileSync(path.join(root,'Renoweet-Bookkeeping-Drive-v2.2.html'),'utf8');
for(const required of ['renoweet-accounting-engine-v4.4.js','renoweet-bookkeeping-v4.4.js','styles-accounting-v4.4.css'])if(!bookkeeping.includes(required))throw new Error(`Bookkeeping is missing ${required}`);
const bookkeepingUi=fs.readFileSync(path.join(root,'renoweet-bookkeeping-v4.4.js'),'utf8');
if(bookkeepingUi.includes('<img src="icons/icon.svg" alt="Renoweet">'))throw new Error('Invoice preview must not use the Hub app icon.');
if(!bookkeepingUi.includes("document.querySelector('header .brand img')"))throw new Error('Invoice preview is not connected to the established Renoweet invoice logo.');
for(const required of ['onclick="printInvoices()"','onclick="printExpenses()"','window.printInvoices=invoicePrintReport','window.printExpenses=expensePrintReport'])if(!bookkeepingUi.includes(required))throw new Error(`Bookkeeping print workflow is missing ${required}`);
for(const required of ['thead{display:table-header-group}','counter(page)','Complete invoice register','Complete expense register'])if(!(bookkeeping+bookkeepingUi).includes(required))throw new Error(`Print report layout is missing ${required}`);
console.log('Static asset checks passed.');
