'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['index.html','Renoweet-Bookkeeping-Drive-v2.2.html','Renoweet-OS-Drive-v2.2.html','Renoweet-BOD-Drive-v2.2.html','Renoweet-Legacy-XLSX-Import-v4.4.html'];
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
const osPage=fs.readFileSync(path.join(root,'Renoweet-OS-Drive-v2.2.html'),'utf8');
const osDrive=fs.readFileSync(path.join(root,'renoweet-os-drive-adapter-v3.6.js'),'utf8');
const bookkeepingDrive=fs.readFileSync(path.join(root,'renoweet-bookkeeping-drive-adapter-v3.7.js'),'utf8');
for(const required of ['normalizeRecoveredProject','restoreProjectRecoveryFile','Restore project file'])if(!(osPage+osDrive).includes(required))throw new Error(`OS project recovery is missing ${required}`);
for(const required of ['Import old quarterly XLSX','Open legacy importer','Renoweet-Legacy-XLSX-Import-v4.4.html'])if(!osDrive.includes(required))throw new Error(`OS legacy XLSX import is missing ${required}`);
const legacyImport=fs.readFileSync(path.join(root,'Renoweet-Legacy-XLSX-Import-v4.4.html'),'utf8');
for(const required of ['Choose the period before uploading','Download compatible JSON','Connect Drive and check duplicates','Import missing records','renoweet-legacy-xlsx-engine-v4.4.js'])if(!legacyImport.includes(required))throw new Error(`Legacy XLSX import workflow is missing ${required}`);
for(const required of ["if($('inv_number'))","p.invoice.date=$('inv_date').value","p.invoice.dueDays=+$('inv_due').value","if(!p.invoice.number)p.invoice.number=nextInvoice(p.invoice.date)"])if(!osPage.includes(required))throw new Error(`OS → Bookkeeping invoice handoff is missing ${required}`);
for(const obsolete of ["if($('i_number'))","p.invoice.date=$('i_date').value","p.invoice.dueDays=+$('i_due').value"])if(osPage.includes(obsolete))throw new Error(`OS invoice form still uses obsolete field mapping ${obsolete}`);
for(const required of ['bookkeepingQueuedAt','allOSQueueRows','osPendingRows','OS invoices waiting to import'])if(!bookkeepingDrive.includes(required))throw new Error(`Bookkeeping queue verification is missing ${required}`);
if(!bookkeepingDrive.includes('Connect Drive to check OS invoices'))throw new Error('Bookkeeping must not report zero OS invoices before Drive has been checked.');
if(bookkeepingDrive.includes("sy.textContent='0 OS invoices waiting to import'"))throw new Error('Bookkeeping still shows an unverified zero before Drive connection.');
console.log('Static asset checks passed.');
