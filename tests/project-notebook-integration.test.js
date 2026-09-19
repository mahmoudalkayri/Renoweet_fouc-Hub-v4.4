'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'renoweet-os-project-bridge-v1.js'),'utf8');
const sandbox={
  window:{},
  localStorage:{getItem:()=>''},
  structuredClone:value=>JSON.parse(JSON.stringify(value)),
  setTimeout:()=>0,
  clearTimeout:()=>{},
  console
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'renoweet-os-project-bridge-v1.js'});

const bridge=sandbox.window.RenoweetOSProjectBridge;
assert.ok(bridge,'Bridge API was not exposed.');
const notebook={
  id:'NOTE-1',osProjectId:'P20260918090000000-TEST0001',title:'Apartment renovation',status:'inspection',
  clientName:'Melvin van der Woude',clientPhone:'0612345678',clientEmail:'melvin@example.nl',address:'Oosterengweg 118, Hilversum',
  customerComments:'Move walls and prepare the kitchen.',intakeSummary:'Confirm service routes.',desiredStart:'2026-10-16',visitDate:'2026-09-22',
  scopes:[{title:'Electrical',description:'Add and move sockets.',status:'confirm',note:''}],
  notes:{electrical:'Inspect the consumer unit.'},checks:{},createdAt:'2026-09-18T09:00:00.000Z'
};
const project=bridge.makeOsProject(notebook);
assert.equal(project.id,notebook.osProjectId);
assert.equal(project.customer.name,notebook.clientName);
assert.equal(project.customer.address,notebook.address);
assert.equal(project.schedule.start,'2026-10-16');
assert.equal(project.stage,'Lead');
assert.match(project.scope,/Electrical/);
assert.match(project.notes,/Inspect the consumer unit/);
assert.equal(project.siteSurvey.notebookProjectId,notebook.id);
assert.ok(Array.isArray(project.estimate)&&project.estimate.length===1);
assert.ok(Array.isArray(project.checklist)&&project.checklist.length>=10);

const existingOs={
  id:notebook.osProjectId,created:'2026-09-18',updated:'2026-09-18T10:00:00.000Z',stage:'Lead',
  customer:{name:'Old name',phone:'',email:'',address:'Old address'},title:'Old title',description:'Old description',scope:'Old scope',notes:'Old notes',
  estimate:[{id:'E1',desc:'Custom estimate',qty:2,unit:'hour',rate:75}],materials:[{id:'M1',desc:'Keep me'}],payments:[{id:'PAY1',amount:100}],purchaseOrders:[],followUps:[],activity:[],
  schedule:{start:'2026-10-01',end:'2026-10-02',notes:'Existing schedule detail'},quote:{assumptions:'Existing quote assumption'},invoice:{number:'',status:'Draft'},checklist:[{order:1,text:'Keep OS checklist',done:true}]
};
const merged=bridge.applyNotebookToOsProject(existingOs,notebook);
assert.equal(merged.id,existingOs.id);
assert.equal(merged.title,notebook.title);
assert.equal(merged.customer.name,notebook.clientName);
assert.equal(merged.estimate[0].desc,'Custom estimate','Notebook sync must preserve OS commercial estimate data.');
assert.equal(merged.materials[0].desc,'Keep me','Notebook sync must preserve OS materials.');
assert.equal(merged.payments[0].id,'PAY1','Notebook sync must preserve OS payments.');
assert.equal(merged.checklist[0].text,'Keep OS checklist','Notebook sync must preserve OS execution checklist.');
assert.equal(merged.siteSurvey.notebookProjectId,notebook.id);
assert.equal(merged.siteSurvey.contractBasisVersion,1);
assert.ok(Array.isArray(merged.siteSurvey.snapshot.scopes));
assert.match(merged.scope,/Electrical/);

assert.equal(bridge.isEligibleOpenProject({...existingOs,stage:'Lead'},{bookkeeping:[]}),true);
assert.equal(bridge.isEligibleOpenProject({...existingOs,stage:'Quoted'},{bookkeeping:[]}),false);
assert.equal(bridge.isEligibleOpenProject({...existingOs,invoice:{bookkeepingQueuedAt:'2026-09-18T12:00:00Z'}},{bookkeeping:[]}),false);
assert.equal(bridge.isEligibleOpenProject(existingOs,{bookkeeping:[{'Project ID':existingOs.id,'Status':'Ready for bookkeeping'}]}),false);
assert.equal(bridge.isEligibleOpenProject(existingOs,{bookkeeping:[{'Project ID':existingOs.id,'Status':'Cancelled in OS'}]}),true);

const osWithSurvey=JSON.parse(JSON.stringify(merged));
osWithSurvey.siteSurvey.snapshot.customerComments='Restored customer request';
const seed=bridge.notebookSeedFromOs(osWithSurvey);
assert.equal(seed.osProjectId,existingOs.id);
assert.equal(seed.id,notebook.id);
assert.equal(seed.clientName,notebook.clientName);
assert.equal(seed.customerComments,'Restored customer request');
assert.equal(seed.scopes[0].title,'Electrical');

console.log('Project Notebook ↔ OS selection, merge and duplicate-safety checks passed.');
