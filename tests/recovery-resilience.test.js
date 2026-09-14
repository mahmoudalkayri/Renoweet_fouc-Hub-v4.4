'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const os=read('Renoweet-OS-Drive-v2.2.html');
const adapter=read('renoweet-os-drive-adapter-v3.6.js');
const core=read('renoweet-drive-core-v3.0.js');
const bookkeeping=read('Renoweet-Bookkeeping-Drive-v2.2.html');
const bookkeepingV44=read('renoweet-bookkeeping-v4.4.js');

for(const required of [
  "const PROJECT_DRAFT_KEY='renoweet-project-draft-v44'",
  "const body=$('projectTabContent')",
  'saveProjectDraftRecoveryNow',
  'restoreProjectDraftRecovery',
  'verifyProjectCached',
  "window.addEventListener('pagehide'",
  "document.addEventListener('visibilitychange'"
])assert.ok(os.includes(required),`OS refresh-safe project persistence is missing: ${required}`);

for(const required of [
  'expectedProjectId',
  'saved.data.os.projects.some',
  'scheduleRetry',
  "window.addEventListener('online'",
  'RenoweetDrive.hasAccessToken()',
  'Saved locally • Drive sync pending'
])assert.ok(adapter.includes(required),`OS Drive verification/retry is missing: ${required}`);

for(const required of [
  'manifestId',
  'authoritativeFileId',
  'RenoweetDuplicateDatabaseError',
  'RenoweetDuplicateManifestError',
  'RenoweetDuplicateFolderError',
  'inspectDatabaseFiles'
])assert.ok(core.includes(required),`Drive identity protection is missing: ${required}`);
assert.ok(!core.includes("for(const f of await listFiles(`name='${escQ(name)}' and trashed=false`))ids.push(f.id)"),'Drive core must not choose a global same-name file by revision.');

for(const [name,text] of [['OS invoice',os],['Bookkeeping invoice',bookkeeping],['v4.4 invoice',bookkeepingV44]]){
  assert.ok(text.includes('NL45INGB0111929547'),`${name} is missing the IBAN.`);
  assert.ok(text.includes('Rekeninghouder: Mahmoud Idris'),`${name} is missing the account-holder name.`);
}

function checkInlineScripts(name,text){
  for(const match of text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
    const code=match[1].trim();if(!code)continue;
    try{new Function(code)}catch(error){throw new Error(`${name} contains invalid inline JavaScript: ${error.message}`)}
  }
}
checkInlineScripts('Renoweet OS',os);
checkInlineScripts('Renoweet Bookkeeping',bookkeeping);
console.log('Recovery and persistence resilience checks passed.');
