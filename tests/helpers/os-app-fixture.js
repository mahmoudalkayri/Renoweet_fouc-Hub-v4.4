'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const V=require('../../renoweet-os-vat-engine-v1.js'),P=require('../../renoweet-partial-invoice-engine.js'),C=require('../../renoweet-invoice-closing.js');
const decode=s=>String(s||'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function surface(){
 const nodes=new Map(),fixed=['projectModal','modalTitle','modalMeta','projectTabs','projectTabContent','viewRoot','toast'];let controls=[];
 const create=id=>({id,value:'',checked:false,disabled:false,dataset:{},style:{},classList:{add(){},remove(){}},addEventListener(){},querySelectorAll(){return id==='projectTabContent'?controls:[]},querySelector(){return null},_html:'',get innerHTML(){return this._html},set innerHTML(html){this._html=html;if(id!=='projectTabContent')return;for(const n of controls)nodes.delete(n.id);controls=[];for(const m of html.matchAll(/<(input|select|textarea)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const n=create(m[3]),attrs=m[2];m[4]=m[1]==='input'?'':html.slice(m.index+m[0].length).split('</'+m[1]+'>')[0];n.disabled=/\bdisabled\b/.test(attrs);n.checked=/\bchecked\b/.test(attrs);n.value=decode(attrs.match(/\bvalue="([^"]*)"/)?.[1]||'');if(m[1]==='textarea')n.value=decode(m[4]);if(m[1]==='select'){const opts=[...(m[4]||'').matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)],selected=opts.find(o=>/selected/.test(o[1]))||opts[0];n.value=decode(selected?.[1].match(/value="([^"]*)"/)?.[1]||selected?.[2]||'')}nodes.set(n.id,n);controls.push(n)}}});
 fixed.forEach(id=>nodes.set(id,create(id)));
 return {document:{getElementById:id=>nodes.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},nodes};
}
function app({closing=true,mixed=false}={}){
 const dom=surface(),storage={getItem:()=>null,setItem(){},removeItem(){}},ctx={console,Intl,Date,Map,Set,Uint8Array,URL,Blob,crypto:crypto.webcrypto,navigator:{userAgent:'test'},location:{origin:'https://example.test',protocol:'https:',hostname:'example.test'},localStorage:storage,sessionStorage:storage,document:dom.document,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,alert:message=>{throw new Error(message)},RenoweetOSVat:V,RenoweetPartialInvoices:P,RenoweetCompany:{html:()=>''}};
 if(mixed){ctx.RenoweetPartialInvoices={...P};delete ctx.RenoweetPartialInvoices.finalWorkRows;delete ctx.RenoweetPartialInvoices.closingStatement}
 if(closing)ctx.RenoweetInvoiceClosing=C;ctx.window=ctx;vm.createContext(ctx);
 const html=fs.readFileSync(require.resolve('../../Renoweet-OS-Drive-v2.2.html'),'utf8');const main=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function blankProject()'));
 vm.runInContext(main.slice(main.indexOf('const HANDLE_DB='),main.indexOf('const pinActionBtn=')),ctx);
 vm.runInContext('scheduleSave=()=>{};render=()=>{};clearProjectDraftRecovery=()=>{};queueProjectDraftRecovery=()=>{};const fixture=blankProject();fixture.id="reopen";fixture.title="Test";fixture.customer.name="Customer";fixture.customer.address="Address";fixture.estimate=[{id:"low",desc:"Painting",qty:1,rate:1120,vatTreatment:"NL_LOW"},{id:"high",desc:"Floor",qty:1,rate:2430,vatTreatment:"NL_HIGH"}];db.projects=[fixture];',ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../../renoweet-partial-invoices-ui.js'),'utf8'),ctx);return {ctx,dom,project:vm.runInContext('fixture',ctx)};
}
module.exports={app};
