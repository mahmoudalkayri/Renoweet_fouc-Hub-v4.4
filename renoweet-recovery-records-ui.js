/* Year-wide, collapsible recovery history with explicit permanent-delete controls. */
(()=>{
 'use strict';const R=window.RenoweetRecoveryRecords,H=()=>window.RenoweetMonthlyHost;let opened=false,query='',selected=new Set(),shown=[],year=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(host){
  if(!host||!H())return;const book=H().book(),c=H().context();if(year!==c.year){year=c.year;opened=false;query=''}selected.clear();
  host.innerHTML=`<details data-recovery-details ${opened?'open':''}><summary>Cancelled and deleted records (${(book.deleted||[]).length})</summary><p class="v44-note">Recovery copies for ${c.year}, across all quarters. Removing a copy does not change live invoices, payments, expenses or totals. This cannot be undone from this list. Existing Drive history is retained.</p><label>Search recovery history<input type="search" data-recovery-search value="${esc(query)}" placeholder="Supplier, description, record ID or status"></label><div data-recovery-list></div><button type="button" class="danger" data-recovery-delete-selected disabled>Delete selected permanently</button><p data-recovery-message role="status"></p></details>`;
  const details=host.querySelector('details');details.ontoggle=()=>{opened=details.open};
  function draw(){
   selected.clear();const text=query.toLowerCase().trim();shown=(H().book().deleted||[]).map((row,index)=>({row,index,snapshot:JSON.stringify(row)})).filter(({row})=>!text||['Deleted at','Type','Record ID','Customer / Supplier','Description','Status'].map(k=>row[k]||'').join(' ').toLowerCase().includes(text));
   host.querySelector('[data-recovery-list]').innerHTML=shown.length?`<div class="table-wrap"><table class="recovery-table"><thead><tr><th>Select</th><th>Deleted at</th><th>Type / status</th><th>Record ID</th><th>Customer / Supplier</th><th>Description</th><th>Gross</th><th></th></tr></thead><tbody>${shown.map((x,i)=>{const reason=R.blocked(x.row,H().context());return `<tr><td><input type="checkbox" data-recovery-select="${i}" aria-label="Select recovery copy ${esc(x.row['Record ID']||i+1)}" ${reason?'disabled':''}></td><td>${esc(x.row['Deleted at'])}</td><td>${esc(x.row.Type)}<br>${esc(x.row.Status)}</td><td>${esc(x.row['Record ID'])}</td><td>${esc(x.row['Customer / Supplier'])}</td><td>${esc(x.row.Description)}</td><td>${esc(x.row.Gross)}</td><td><button type="button" class="danger" data-recovery-delete="${i}" ${reason?'disabled':''}>Delete permanently</button>${reason?`<small>${esc(reason)}</small>`:''}</td></tr>`}).join('')}</tbody></table></div>`:'<p>No matching recovery copies.</p>';
   host.querySelector('[data-recovery-delete-selected]').disabled=true;
  }
  function remove(targets){try{if(!targets.length)return;const count=targets.length;if(!window.confirm(`Permanently delete ${count} inactive recovery ${count===1?'copy':'copies'}? Live bookkeeping amounts will stay unchanged. This cannot be undone from this list.`))return;if(window.prompt('Type DELETE to remove the selected recovery copies permanently.','')!=='DELETE')return;R.purge(H().book(),targets,H().context(),{confirmed:true});H().persist()}catch(error){host.querySelector('[data-recovery-message]').textContent=error.message;draw()}}
  host.querySelector('[data-recovery-search]').oninput=event=>{query=event.target.value;draw()};
  host.onclick=event=>{const one=event.target.closest('[data-recovery-delete]'),many=event.target.closest('[data-recovery-delete-selected]');if(one&&!one.disabled)remove([shown[Number(one.dataset.recoveryDelete)]]);else if(many&&!many.disabled)remove([...selected].map(i=>shown[i]));};
  host.onchange=event=>{if(!event.target.matches('[data-recovery-select]'))return;const index=Number(event.target.dataset.recoverySelect);if(event.target.checked)selected.add(index);else selected.delete(index);host.querySelector('[data-recovery-delete-selected]').disabled=!selected.size;};draw();
 }
 window.RenoweetRecoveryUI={mount};
 const boot=()=>mount(document.querySelector('[data-recovery-host]'));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
