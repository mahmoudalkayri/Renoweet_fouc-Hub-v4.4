/* Progress workspace controls for the precedence network and baseline comparison. */
(function(root){
 'use strict';
 const S=root.RenoweetProgressSchedule;
 function mount(host){
  const {e,today,weights,id,change,project,notify,modal,closeModal}=host;
  const opt=(v,label,current)=>`<option value="${e(v)}"${v===current?' selected':''}>${e(label)}</option>`;
  const field=(key,val,type,extra='')=>`<input data-schedule-key="${key}" type="${type}" value="${e(val??'')}" ${extra}>`;
  const dateText=value=>value?e(value):'—';
  function evaluate(p,s){return S.review(p,s,p.draft.date||today())}
  function pair(a,b){return `${dateText(a)}<br>${dateText(b)}`}
  const delta=(n,suffix)=>n===null||n===undefined?'—':`${n>0?'+':''}${Number(n).toFixed(suffix===' pp'?1:0)}${suffix}`;
  function forecastControls(s){
   const options=(s.milestones||[]).map(m=>opt(m.id,m.code+' · '+m.name,s.handoverId)).join('');
   return `<div class="form-grid schedule-settings"><label class="field">Work started out of sequence<select data-schedule-key="logic">${opt('retain','Retain dependencies',s.logic||'retain')}${opt('override','Progress override',s.logic||'retain')}</select></label><label class="field">Handover milestone<select data-schedule-key="handoverId">${opt('','Project finish (last activity)',s.handoverId||'')}${options}</select></label><label class="field">Agreed deadline (optional)${field('deadline',s.deadline,'date')}</label></div><p class="muted">Retain dependencies keeps applicable links on remaining work. Progress override lets activities already started continue without their incoming links. The deadline is for comparison and does not force the forecast.</p>`;
  }
  function exceptions(s){
   return `<details class="schedule-exceptions"${s.exceptions?.length?' open':''}><summary>Work calendar exceptions${s.exceptions?.length?' · '+s.exceptions.length:''}</summary><p class="muted">Add a holiday or site closure, or make one normally nonworking date available. A saved baseline keeps its own calendar.</p><div class="form-grid"><label class="field">Date<input type="date" id="scheduleExceptionDate"></label><label class="field">Date treatment<select id="scheduleExceptionType"><option value="off">Nonworking day</option><option value="work">Extra working day</option></select></label><label class="field">Reason<input id="scheduleExceptionLabel" maxlength="100" placeholder="e.g. Site closed"></label></div><div class="toolbar schedule-toolbar"><button data-action="add-schedule-exception">Save exception</button></div>
   ${(s.exceptions||[]).map(x=>`<div class="schedule-exception-row"><b>${e(x.date)}</b> · ${x.working?'Working':'Nonworking'}${x.label?' · '+e(x.label):''}<button class="small quiet" data-action="remove-schedule-exception" data-id="${e(x.id)}">Remove</button></div>`).join('')}</details>`;
  }
  function method(f){
   const m=f.method;if(!m)return '';
   const target=m.handover?m.handover.code+' · '+m.handover.name:'Project finish',end=m.handover?.finish||f.finish;
   const direct=m.drivers.slice(0,12).join(', ')+(m.drivers.length>12?' + '+(m.drivers.length-12)+' more':'');
   return `<section class="schedule-method" data-schedule-method><b>${e(target)}</b> · ${e(end)}<p>${m.deadline?'Deadline '+e(m.deadline)+' · '+delta(m.deadlineVariance,' calendar days')+'<br>':''}Driving activities: ${e(direct||'None remaining')}<br><span class="muted">${m.logic==='override'?'Progress override':'Retain dependencies'} · ${m.estimated} estimated remaining duration(s) · ${m.calendarExceptions} calendar exception(s)</span></p><p class="muted">Driving rows can move the selected finish. Float is the working-day allowance against overall project finish, even when a handover milestone is selected.</p></section>`;
  }
  function timeline(f){
   const G=root.RenoweetProgressGantt;
   if(!G||!f.rows.length)return '';
   return `<details class="schedule-timeline" open><summary>Schedule review · Gantt chart</summary><p class="muted">${f.reviewOnly?'Showing available reference dates and valid actuals. Forecast updates after the schedule issues are corrected.':f.baseline?'Against '+e(f.baseline.name)+'.':'No baseline selected. This chart shows actuals and the remaining forecast.'} Scroll sideways for later dates. Actual bars show recorded date spans; use the percentages for work completed.</p>${G.legend(f)}<label class="check gantt-links-control"><input type="checkbox" data-gantt-links checked>Show dependency arrows</label><div class="gantt-scroll" tabindex="0" role="region" aria-label="Scrollable project schedule chart">${G.svg(f)}</div></details>`;
  }
  function structure(p,s){
   const groups=S.wbsRows(s),items=S.nodes(s).filter(t=>t.kind==='milestone'||p.activities.some(a=>a.id===t.id&&!a.removedFromOs)),options=(current='',except='')=>opt('','Project root / unassigned',current)+groups.filter(w=>w.id!==except).map(w=>opt(w.id,'  '.repeat(w.depth)+w.number+' '+w.name,current)).join('');
   const ask=(name,text,date='')=>`<label class="field">${name}<input id="${text}" ${date?'type="date"':'maxlength="150"'}></label>`;
   return `<section class="card"><h2>Work breakdown structure (WBS)</h2><p class="muted">Organize activities and milestones into phases and subphases. WBS headings do not add duration or cost.</p><div class="form-grid">${ask('New phase name','scheduleWbsName')}<label class="field">Parent phase<select id="scheduleWbsParent">${options()}</select></label></div><div class="toolbar schedule-toolbar"><button data-action="add-schedule-wbs">Add WBS section</button></div>${groups.length?`<div class="schedule-wbs-list">${groups.map(w=>`<div><div style="padding-left:${w.depth*12}px"><b>${e(w.number)} · ${e(w.name)}</b><ul class="schedule-wbs-items">${items.filter(t=>t.wbsId===w.id).map(t=>`<li>${e(t.code)} · ${e(t.name||p.activities.find(a=>a.id===t.id)?.description||'')}${t.kind==='milestone'?' (milestone)':''}</li>`).join('')}</ul></div><div class="toolbar"><button class="small quiet" data-action="edit-schedule-wbs" data-id="${e(w.id)}">Edit</button><button class="small quiet" data-action="remove-schedule-wbs" data-id="${e(w.id)}">Remove</button></div></div>`).join('')}</div>`:''}</section>
   <section class="card"><h2>Milestones</h2><p class="muted">A milestone is a zero-duration event. Link it in Relationships and record the date it was achieved. Link it to an agreed payment in Payments.</p><div class="form-grid">${ask('Milestone name','scheduleMilestoneName')}<label class="field">WBS section<select id="scheduleMilestoneWbs">${options()}</select></label></div><div class="toolbar schedule-toolbar"><button data-action="add-schedule-milestone">Add milestone</button></div></section>`;
  }
  function view(p){
   if(!p.schedule||p.schedule.enabled===false)return `<section class="card"><div class="eyebrow">Planning &amp; forecast</div><h2>Project schedule</h2><p class="muted">Scheduling is optional. Activities, payments and progress reports work without dates or a baseline.</p><button class="primary" data-action="enable-schedule">${p.schedule?'Resume schedule':'Set up schedule'}</button></section>`;
   const s=S.prepare(p,today()),activities=p.activities.filter(a=>!a.removedFromOs),tasks=S.nodes(s).filter(t=>t.kind==='milestone'||activities.some(a=>a.id===t.id)),byId=new Map(tasks.map(t=>[t.id,t]));
   const {forecast:f,chart,error,issues=[]}=evaluate(p,s),frows=new Map(((f||chart)?.rows||[]).map(row=>[row.id,row])),invalid=new Set(issues.map(x=>x.id+'|'+x.field));
   const groups=S.wbsRows(s),phaseOptions=current=>opt('','Unassigned',current||'')+groups.map(w=>opt(w.id,w.number+' '+w.name,current)).join('');
   const options=tasks.map(t=>opt(t.id,t.code+' · '+(t.name||activities.find(a=>a.id===t.id)?.description||'').slice(0,100),'')).join('');
   const baselines=s.baselines.map(b=>opt(b.id,b.name+(b.id===s.baselines[0]?.id?' · original':''),s.baselineId)).join('');
   return `<div class="schedule-page"><section class="card"><div class="card-head"><div><div class="eyebrow">Planning &amp; forecast</div><h2>Project schedule</h2><p class="muted">The status date is the end of the day through which progress is recorded. Blank uses the report date. Enter your remaining workdays separately from physical progress. Blank remaining days are marked as estimates.</p></div></div><div class="form-grid"><label class="field">Project start${field('start',s.start,'date')}</label><label class="field">Status date${field('statusDate',s.statusDate,'date')}</label></div><fieldset class="schedule-week"><legend>Working days for this project</legend>${S.WEEK.map(d=>`<label class="check"><input type="checkbox" data-schedule-day="${d}" ${S.workdays(s.calendar,s.workdays).includes(d)?'checked':''}>${S.LABELS[d-1]}</label>`).join('')}</fieldset>${forecastControls(s)}${exceptions(s)}<div class="toolbar schedule-toolbar"><button class="quiet" data-action="pause-schedule">Pause schedule</button></div>
   ${error?`<section class="notice error schedule-issues" role="status"><b>Forecast unavailable</b>${issues.length?`<ul>${issues.slice(0,12).map(i=>`<li>${e(i.message)} <button class="small quiet" data-action="fix-schedule-actual" data-id="${e(i.id)}" data-field="${e(i.field)}">Edit ${e(i.code)}</button></li>`).join('')}</ul>${issues.length>12?`<p>Plus ${issues.length-12} more flagged date fields below.</p>`:''}<p>Use actual dates only for work that has happened by the status date. For planned work, keep the actual finish blank. Enter remaining days and an optional Expected finish instead.</p>`:`<p>${e(error)}</p>`}${chart?'':'<p>No dated plan, baseline, or actual work is available to draw yet.</p>'}</section>`:''}
   ${f?`<div class="grid four schedule-kpis"><div class="metric"><div class="label">Baseline planned</div><div class="value">${f.target===null?'—':f.target.toFixed(1)+'%'}</div></div><div class="metric"><div class="label">Actual on baseline scope</div><div class="value">${f.actual===null?'—':f.actual.toFixed(1)+'%'}</div></div><div class="metric"><div class="label">Progress variance</div><div class="value">${delta(f.variance,' pp')}</div></div><div class="metric"><div class="label">Forecast finish</div><div class="value">${e(f.finish)}</div><small>${f.baseline?e(f.baseline.name)+' · '+delta(f.slipDays,' calendar days'):'Working plan finishes '+e(f.plannedFinish)}</small></div></div><p class="muted" data-schedule-asof>As of ${e(f.statusDate)}. Planned progress is spread evenly across each activity’s baseline workdays. Baseline finish: ${dateText(f.baseline?.finish)}.</p>${method(f)}${f.warnings.map(w=>`<p class="notice">${e(w)}</p>`).join('')}${timeline(f)}`:chart?timeline(chart):''}
   </section><section class="card"><div class="card-head"><div><h2>Baselines</h2><p class="muted">A baseline is optional. Saving one freezes the current plan, workweek, calendar exceptions, links and report weights. Previous baselines stay available, and saved reports retain their own comparison.</p></div></div><div class="form-grid"><label class="field">Compare against<select aria-label="Compare against" data-schedule-key="baselineId">${opt('','No baseline selected',s.baselineId)}${baselines}</select></label><label class="field">New baseline name<input id="scheduleBaselineName" maxlength="80" placeholder="${s.baselines.length?'e.g. Revised plan':'Original baseline'}"></label></div><div class="toolbar schedule-toolbar"><button class="primary" data-action="save-schedule-baseline">${s.baselines.length?'Save new baseline':'Save original baseline'}</button>${s.baselineId?'<button data-action="view-schedule-baseline">View selected baseline</button>':''}</div></section>
   <section class="card"><div class="card-head"><div><h2>Activities &amp; milestone dates</h2><p class="muted">Enter planned duration in working days. Dates are recalculated from the network. Expected finish is a forecast input: it holds the finish no earlier than that date. It does not change physical progress, remaining days or the baseline. Dates include the last working day.</p></div></div><div class="table-scroll"><table class="schedule-table"><thead><tr><th>Activity</th><th>Days</th><th>Earliest start</th><th>Actual start</th><th>Actual finish</th><th>Remaining days</th><th>Expected finish</th><th>Plan<br>start / finish</th><th>Baseline<br>start / finish</th><th>Forecast<br>start / finish</th><th>Finish vs baseline</th><th>Float<br>(workdays)</th></tr></thead><tbody>${tasks.map(t=>{
    const a=activities.find(a=>a.id===t.id),r=frows.get(t.id),event=t.kind==='milestone';
    const val=(k,type,extra='')=>`<input data-schedule-task="${e(t.id)}" data-schedule-key="${k}" aria-label="${e(t.code)} ${e(k)}" type="${type}" value="${e(t[k]??'')}" ${invalid.has(t.id+'|'+k)?'aria-invalid="true"':''} ${extra}>`;
    return `<tr data-driving="${r?.driving?'true':'false'}"><td>${val('code','text','maxlength="30"')}<div class="schedule-description">${e(event?t.name:a.description)}</div><small>${event?(t.actualFinish?'Milestone · achieved':'Milestone · pending'):e(a.progress)+'% physical complete'}</small><span data-schedule-driver>${r?.driving?'Driving':''}</span><label class="field">WBS<select data-schedule-task="${e(t.id)}" data-schedule-key="wbsId">${phaseOptions(t.wbsId)}</select></label>${event?`<button class="small quiet" data-action="edit-schedule-milestone" data-id="${e(t.id)}">Edit name</button> <button class="small quiet" data-action="remove-schedule-milestone" data-id="${e(t.id)}">Remove</button>`:''}</td><td>${event?'0':val('days','number','min="1" max="3650" step="1"')}</td><td>${val('earliest','date')}</td><td>${event?'—':val('actualStart','date')}</td><td>${val('actualFinish','date',event?'title="Date achieved"':'')}</td><td>${event?'—':val('remaining','number','min="1" max="3650" step="1" placeholder="Estimate"')}${!event?`<small data-schedule-remaining>${r?.remainingSource==='estimated'?'Est. '+r.remaining+' d':r?.remainingSource==='entered'?'Entered':r?.remaining===0?'Complete':''}</small>`:''}</td><td>${val('expectedFinish','date')}</td><td>${pair(r?.plannedStart,r?.plannedFinish)}</td><td>${pair(r?.baselineStart,r?.baselineFinish)}</td><td>${pair(r?.forecastStart,r?.forecastFinish)}</td><td>${delta(r?.varianceDays,' days')}</td><td>${r?.floatDays==null?'—':e(r.floatDays)}</td></tr>`;
   }).join('')}</tbody></table></div>${!tasks.length?'<p class="notice">Add work in Activities first.</p>':''}</section>
   <section class="card"><div class="card-head"><div><h2>Relationships</h2><p class="muted">FS: finish → start; SS: start → start; FF: finish → finish; SF: start → finish. Lag is in working days; negative lag allows overlap. A relationship sets an earliest bound for the successor event.</p></div></div><div class="form-grid"><label class="field">Predecessor<select id="scheduleFrom"><option value="">Select activity</option>${options}</select></label><label class="field">Successor<select id="scheduleTo"><option value="">Select activity</option>${options}</select></label><label class="field">Relationship<select id="scheduleRelation">${S.TYPES.map(t=>opt(t,t,'FS')).join('')}</select></label><label class="field">Lag (workdays)<input id="scheduleLag" type="number" value="0" min="-3650" max="3650" step="1"></label></div><div class="toolbar schedule-toolbar"><button data-action="add-schedule-link">Add relationship</button></div>
   ${s.links.length?`<div class="table-scroll"><table><thead><tr><th>Predecessor</th><th>Successor</th><th>Type</th><th>Lag</th><th></th></tr></thead><tbody>${s.links.map(l=>`<tr><td>${e(byId.get(l.from)?.code||'Removed activity')}</td><td>${e(byId.get(l.to)?.code||'Removed activity')}</td><td>${e(l.type)}</td><td>${e(l.lag)}</td><td><button class="small" data-action="remove-schedule-link" data-id="${e(l.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No relationships yet. Unlinked activities may start together.</p>'}</section>${structure(p,s)}</div>`;
  }
  function current(){const p=project();if(!p)throw Error('Open a project first.');return [p,S.prepare(p,today())]}
  function save(p,s){S.validateSchedule(s);change(()=>{p.schedule=s},true)}
  function onField(node){
   if(node.dataset.ganttLinks!==undefined){node.closest('.schedule-timeline')?.classList.toggle('gantt-hide-links',!node.checked);return true}
   if(!node.dataset.scheduleKey&&!node.dataset.scheduleDay)return false;
   try{
    const [p,s]=current(),key=node.dataset.scheduleKey;let value=node.value;
    if(node.dataset.scheduleDay){
     const days=[...document.querySelectorAll('[data-schedule-day]:checked')].map(n=>Number(n.dataset.scheduleDay));
     S.workdays('custom',days);s.calendar='custom';s.workdays=days;
    }else if(node.dataset.scheduleTask){
     const event=s.milestones.find(t=>t.id===node.dataset.scheduleTask),t=event||s.tasks.find(t=>t.id===node.dataset.scheduleTask);
     if(!t||!(event?['code','earliest','expectedFinish','actualFinish','wbsId']:['code','days','earliest','expectedFinish','actualStart','actualFinish','remaining','wbsId']).includes(key))return true;
     value=key==='days'||key==='remaining'?(value===''?null:Number(value)):value.trim();
     if(key==='code'&&(!value||S.nodes(s).some(x=>x.id!==t.id&&x.code.toUpperCase()===value.toUpperCase())))throw Error('Use a unique, nonempty activity ID.');
     t[key]=value;
    }else if(['start','statusDate','calendar','baselineId','logic','handoverId','deadline'].includes(key))s[key]=value;
    else return true;
    S.validateSchedule(s);
    // Repaint after the button/change dispatch rather than losing the user's click target.
    change(()=>{p.schedule=s});refreshResults();
   }catch(error){notify(error.message,true);host.refresh()}
   return true;
  }
  function refreshResults(){
   const p=project(),old=document.querySelector('.schedule-page');if(!p||!old)return;
   const temp=document.createElement('div');temp.innerHTML=view(p);
   const next=temp.firstElementChild;
   if(!next)return;
   const a=old.querySelectorAll(':scope > section'),b=next.querySelectorAll(':scope > section');
   const oldChart=a[0]?.querySelector('.schedule-timeline'),wasOpen=oldChart?.open,priorScroll=oldChart?.querySelector('.gantt-scroll'),hideLinks=oldChart?.classList.contains('gantt-hide-links');
   // Keep inputs and pending relationship selections in place while replacing calculated cells.
   const status=a[0]?.querySelectorAll('.schedule-kpis,.notice,.schedule-timeline,[data-schedule-asof],[data-schedule-method]')||[];
   for(const n of status)n.remove();
   for(const n of b[0]?.querySelectorAll('.schedule-kpis,.notice,.schedule-timeline,[data-schedule-asof],[data-schedule-method]')||[])a[0].append(n.cloneNode(true));
   [...a[2]?.querySelectorAll('tbody tr')||[]].forEach((r,i)=>{
    const row=b[2]?.querySelectorAll('tbody tr')[i];
    if(row)for(const input of r.querySelectorAll('input[data-schedule-key]')){
     const other=[...row.querySelectorAll('input[data-schedule-key]')].find(n=>n.dataset.scheduleKey===input.dataset.scheduleKey);
     if(other?.hasAttribute('aria-invalid'))input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
    }
    if(row&&r.cells[0].querySelector('small'))r.cells[0].querySelector('small').textContent=row.cells[0].querySelector('small').textContent;if(row){
     r.dataset.driving=row.dataset.driving;
     for(const sel of ['[data-schedule-driver]','[data-schedule-remaining]']){const node=r.querySelector(sel);if(node)node.textContent=row.querySelector(sel)?.textContent||''}
     for(let j=7;j<12;j++)r.cells[j].innerHTML=row.cells[j].innerHTML;
    }
   });
   const chart=a[0].querySelector('.schedule-timeline'),scroller=chart?.querySelector('.gantt-scroll');
   if(chart&&oldChart){chart.open=wasOpen;chart.classList.toggle('gantt-hide-links',hideLinks);chart.querySelector('[data-gantt-links]').checked=!hideLinks}
   if(scroller&&priorScroll){scroller.scrollLeft=priorScroll.scrollLeft;scroller.scrollTop=priorScroll.scrollTop}
   const baselineActions=a[1]?.querySelector('.schedule-toolbar'),updatedActions=b[1]?.querySelector('.schedule-toolbar');
   if(baselineActions&&updatedActions){
    const selector='[data-action="view-schedule-baseline"]',old=baselineActions.querySelector(selector),next=updatedActions.querySelector(selector);
    if(!next)old?.remove();else if(!old)baselineActions.append(next.cloneNode(true));
   }
   const nodes=S.nodes(p.schedule),codes=new Map(nodes.map(t=>[t.id,t.code]));
   for(const select of ['scheduleFrom','scheduleTo'])for(const o of old.ownerDocument.getElementById(select)?.options||[]){
    const description=nodes.find(t=>t.id===o.value)?.name||p.activities.find(a=>a.id===o.value)?.description||'';
    if(codes.has(o.value))o.textContent=codes.get(o.value)+' · '+description.slice(0,100);
   }
   const nextWbs=b[4]?.querySelector('.schedule-wbs-list'),oldWbs=a[4]?.querySelector('.schedule-wbs-list');
   if(nextWbs&&oldWbs)oldWbs.replaceWith(nextWbs.cloneNode(true));
   const labels=a[3]?.querySelectorAll('tbody tr')||[];
   p.schedule.links.forEach((link,i)=>{if(labels[i]){labels[i].cells[0].textContent=codes.get(link.from)||'Removed activity';labels[i].cells[1].textContent=codes.get(link.to)||'Removed activity'}});
  }
  const actions={
   'add-schedule-exception':()=>{const [p,s]=current(),date=document.getElementById('scheduleExceptionDate').value,type=document.getElementById('scheduleExceptionType').value,label=document.getElementById('scheduleExceptionLabel').value.trim();
    if(!date)throw Error('Choose the exception date.');
    s.exceptions=[...(s.exceptions||[]).filter(x=>x.id!==date),{id:date,date,working:type==='work',label}].sort((a,b)=>a.date.localeCompare(b.date));save(p,s);
   },
   'remove-schedule-exception':node=>{const [p,s]=current();s.exceptions=(s.exceptions||[]).filter(x=>x.id!==node.dataset.id);save(p,s)},

   'fix-schedule-actual':node=>{
    const target=[...document.querySelectorAll('[data-schedule-task]')].find(el=>el.dataset.scheduleTask===node.dataset.id&&el.dataset.scheduleKey===node.dataset.field);
    target?.scrollIntoView?.({block:'center',inline:'nearest'});target?.focus();
   },
   'enable-schedule':()=>{const [p,s]=current();s.enabled=true;save(p,s)},
   'pause-schedule':()=>{const [p,s]=current();s.enabled=false;save(p,s);notify('Schedule paused. Plan and baselines were kept.')},
   'add-schedule-wbs':()=>{const [p,s]=current(),name=document.getElementById('scheduleWbsName').value.trim(),parentId=document.getElementById('scheduleWbsParent').value;
    if(!name)throw Error('Enter a WBS name.');
    s.wbs.push({id:id(),name:name.slice(0,100),parentId});save(p,s);
   },
   'edit-schedule-wbs':node=>{const [,s]=current(),w=s.wbs.find(x=>x.id===node.dataset.id);if(!w)return;
    const exclude=new Set([w.id]);for(const x of S.wbsRows(s))if(exclude.has(x.parentId))exclude.add(x.id);
    modal('Edit WBS section',`<div class="form-grid"><label class="field">Phase name<input id="scheduleEditWbsName" maxlength="100" value="${e(w.name)}"></label><label class="field">Parent phase<select id="scheduleEditWbsParent">${opt('','Project root',w.parentId)}${S.wbsRows(s).filter(x=>!exclude.has(x.id)).map(x=>opt(x.id,x.number+' '+x.name,w.parentId)).join('')}</select></label></div>`,`<button data-action="close-modal">Cancel</button><button class="primary" data-action="save-schedule-wbs" data-id="${e(w.id)}">Save</button>`);
   },
   'save-schedule-wbs':node=>{const [p,s]=current(),w=s.wbs.find(x=>x.id===node.dataset.id);if(!w)return;
    w.name=document.getElementById('scheduleEditWbsName').value.trim();w.parentId=document.getElementById('scheduleEditWbsParent').value;
    S.validateSchedule(s);closeModal();save(p,s);
   },
   'remove-schedule-wbs':node=>{const [p,s]=current(),key=node.dataset.id;
    if(s.wbs.some(w=>w.parentId===key)||S.nodes(s).some(t=>t.wbsId===key))throw Error('Move the children and schedule items out of this section first.');
    s.wbs=s.wbs.filter(w=>w.id!==key);save(p,s);
   },
   'add-schedule-milestone':()=>{const [p,s]=current(),name=document.getElementById('scheduleMilestoneName').value.trim();
    if(!name)throw Error('Enter a milestone name.');
    const used=new Set(S.nodes(s).map(t=>t.code.toUpperCase()));let n=10,code;do{code='M'+String(n).padStart(3,'0');n+=10}while(used.has(code));
    s.milestones.push({id:id(),code,name,wbsId:document.getElementById('scheduleMilestoneWbs').value,earliest:'',actualFinish:''});save(p,s);
   },
   'edit-schedule-milestone':node=>{const [,s]=current(),m=s.milestones.find(t=>t.id===node.dataset.id);if(!m)return;
    modal('Edit milestone',`<label class="field">Milestone name<input id="scheduleEditMilestone" value="${e(m.name)}" maxlength="150"></label>`,`<button data-action="close-modal">Cancel</button><button class="primary" data-action="save-schedule-milestone" data-id="${e(m.id)}">Save</button>`);
   },
   'save-schedule-milestone':node=>{const [p,s]=current(),m=s.milestones.find(t=>t.id===node.dataset.id);if(!m)return;
    m.name=document.getElementById('scheduleEditMilestone').value.trim();S.validateSchedule(s);closeModal();save(p,s);
   },
   'remove-schedule-milestone':node=>{const [p,s]=current(),key=node.dataset.id;
    if(p.terms.some(t=>t.scheduleMilestoneId===key))throw Error('Unlink this milestone from its payment terms before removing it.');
    if(s.links.some(l=>l.from===key||l.to===key))throw Error('Remove the milestone’s relationships first.');
    s.milestones=s.milestones.filter(m=>m.id!==key);if(s.handoverId===key)s.handoverId='';save(p,s);
   },
   'add-schedule-link':()=>{const [p,s]=current(),get=k=>document.getElementById(k)?.value;
    const from=get('scheduleFrom'),to=get('scheduleTo'),type=get('scheduleRelation'),lag=Number(get('scheduleLag')||0);
    if(!from||!to||from===to)throw Error('Choose two different activities.');
    if(s.links.some(l=>l.from===from&&l.to===to&&l.type===type))throw Error('That relationship is already in the schedule.');
    s.links.push({id:id(),from,to,type,lag});S.networkCheck(p,s);save(p,s);
   },
   'remove-schedule-link':node=>{const [p,s]=current();s.links=s.links.filter(l=>l.id!==node.dataset.id);save(p,s)},
   'save-schedule-baseline':()=>{const [p,s]=current();
    if(s.baselines.length>=30)throw Error('This schedule already has 30 baselines.');
    const name=document.getElementById('scheduleBaselineName')?.value.trim()||(!s.baselines.length?'Original baseline':'Baseline '+(s.baselines.length+1));
    const b=S.makeBaseline(p,s,{id:id(),name,now:new Date().toISOString(),weights:weights(p).values});
    s.baselines.push(b);s.baselineId=b.id;save(p,s);notify('Saved '+b.name+'. Earlier baselines are unchanged.');
   },
   'view-schedule-baseline':()=>{const [,s]=current(),b=s.baselines.find(b=>b.id===s.baselineId);if(!b)return;
    const code=new Map(b.rows.map(r=>[r.id,r.code]));
    modal(b.name,`<p class="muted">${e(b.start)} → ${e(b.finish)} · ${S.calendarLabel(b.calendar,b.workdays)}${b.exceptions?.length?' · '+b.exceptions.length+' frozen calendar exception(s)':''}</p><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Days</th><th>Weight</th></tr></thead><tbody>${b.rows.map(r=>`<tr><td><b>${e(r.code)}</b> ${e(r.description)}${r.wbs?`<br><small>${e(r.wbs)}</small>`:''}${r.kind==='milestone'?' · milestone':''}</td><td>${e(r.start)}</td><td>${e(r.finish)}</td><td>${r.days}</td><td>${r.weight.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div><h3>Frozen relationships</h3><p class="muted">${b.links.map(l=>e(code.get(l.from)+' → '+code.get(l.to)+' '+l.type+' '+l.lag+'d')).join('<br>')||'None'}</p>`, '<button data-action="close-modal">Close</button>');
   }
  };
  function snapshot(p,date){
   if(!p.schedule||p.schedule.enabled===false)return undefined;
   const result=S.review(p,S.prepare(p,today()),date||today());
   return result.forecast||result.chart||{version:1,error:result.error};
  }
  return {view,onField,actions,snapshot};
 }
 root.RenoweetProgressScheduleUI={mount};
})(globalThis);
