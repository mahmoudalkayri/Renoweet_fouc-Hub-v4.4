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

console.log('Project Notebook → OS mapping checks passed.');
