/* Day-granularity precedence scheduling, independent of OS and billing. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RenoweetProgressSchedule=api;
})(globalThis,function(){
 'use strict';
 const DAY=86400000,MONDAY=4,TYPES=['FS','SS','FF','SF'],CAL=['weekdays','all','custom'],WEEK=[1,2,3,4,5,6,7],LABELS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const fill=(n,min,max)=>Math.min(max,Math.max(min,n));
 const round=n=>Math.round((n+Number.EPSILON)*10)/10;
 const clone=x=>structuredClone(x);
 const str=(s,n)=>typeof s==='string'&&s.length<=n;
 const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 const date=(x)=>{
  if(!/^\d{4}-\d\d-\d\d$/.test(x||'')||x<'1900-01-01'||x>'2200-12-31')throw Error('Enter a valid date between 1900 and 2200.');
  const n=Date.parse(x+'T00:00:00Z');
  if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==x)throw Error('Enter a valid calendar date.');
  return n/DAY;
 };
 const iso=n=>{const s=new Date(n*DAY).toISOString().slice(0,10);date(s);return s};
 function workdays(kind,days){
  if(kind==='weekdays')return WEEK.slice(0,5);
  if(kind==='all')return [...WEEK];
  if(kind!=='custom'||!Array.isArray(days)||!days.length||days.length>7||days.some(d=>!int(d,1,7))||new Set(days).size!==days.length)throw Error('Choose at least one working day.');
  return [...days].sort((a,b)=>a-b);
 }
 function calendarLabel(kind,days){return workdays(kind,days).map(d=>LABELS[d-1]).join(', ')}
 function calendar(kind,days){
  const w=workdays(kind,days),per=w.length;
  const work=n=>w.includes(((n-MONDAY)%7+7)%7+1);
  const toIndex=n=>{const offset=n-MONDAY,week=Math.floor(offset/7),d=offset-week*7+1;return week*per+w.filter(x=>x<d).length};
  const fromIndex=n=>{const week=Math.floor(n/per);return MONDAY+7*week+w[n-week*per]-1};
  return {work,toIndex,fromIndex,start:n=>iso(fromIndex(n)),end:n=>iso(fromIndex(n-1)),checked:(s,label)=>{const n=date(s);if(!work(n))throw Error(label+' falls on a nonworking day.');return toIndex(n)}};
 }
 const isMilestone=t=>t.kind==='milestone';
 const nodes=s=>s.tasks.concat((s.milestones||[]).map(m=>({...m,kind:'milestone',days:0,remaining:null,actualStart:''})));
 const finishDate=(c,t,slot)=>isMilestone(t)?c.start(slot.f):c.end(slot.f);
 function wbsRows(s){
  const sections=s.wbs||[],out=[];
  const walk=(parent,path,depth)=>sections.filter(w=>w.parentId===parent).forEach((w,i)=>{
   const number=path?path+'.'+(i+1):String(i+1);
   out.push({...w,number,depth});walk(w.id,number,depth+1);
  });
  walk('','',0);return out;
 }
 function validateSchedule(s){
  if(!s||s.version!==1||!CAL.includes(s.calendar)||!str(s.start,10)||!str(s.statusDate,10)||!Array.isArray(s.tasks)||s.tasks.length>300||!Array.isArray(s.links)||s.links.length>1200||!Array.isArray(s.baselines)||s.baselines.length>30||!str(s.baselineId,100))throw Error('Invalid project schedule in backup.');
  if(s.start)date(s.start);if(s.statusDate)date(s.statusDate);
  workdays(s.calendar,s.workdays);
  if(s.enabled!==undefined&&typeof s.enabled!=='boolean')throw Error('Invalid schedule status.');
  const wbs=s.wbs===undefined?[]:s.wbs,milestones=s.milestones===undefined?[]:s.milestones;
  if(!Array.isArray(wbs)||wbs.length>60||!Array.isArray(milestones)||milestones.length>100)throw Error('Invalid WBS or milestone list.');
  const groups=new Map();
  for(const w of wbs){
   if(!w||!str(w.id,100)||!w.id||groups.has(w.id)||!str(w.name,100)||!w.name.trim()||!str(w.parentId,100))throw Error('Invalid WBS section.');
   groups.set(w.id,w);
  }
  for(const w of wbs){
   const seen=new Set([w.id]);let parent=w.parentId;
   while(parent){
    if(seen.has(parent)||!groups.has(parent)||seen.size>=8)throw Error('Invalid WBS parent or nesting (maximum eight levels).');
    seen.add(parent);parent=groups.get(parent).parentId;
   }
  }
  const taskIds=new Set(),codes=new Set();
  for(const t of s.tasks){
   if(!t||!str(t.id,100)||!t.id||taskIds.has(t.id)||!str(t.code,30)||!t.code.trim()||codes.has(t.code.toUpperCase())||!(t.days===null||int(t.days,1,3650))||!(t.remaining===null||int(t.remaining,1,3650))||!['earliest','actualStart','actualFinish'].every(k=>str(t[k],10)))throw Error('Invalid or duplicate schedule activity in backup.');
   taskIds.add(t.id);codes.add(t.code.toUpperCase());for(const k of ['earliest','actualStart','actualFinish'])if(t[k])date(t[k]);
  }
  for(const m of milestones){
   if(!m||!str(m.id,100)||!m.id||taskIds.has(m.id)||!str(m.code,30)||!m.code.trim()||codes.has(m.code.toUpperCase())||!str(m.name,150)||!m.name.trim()||!str(m.earliest,10)||!str(m.actualFinish,10))throw Error('Use a unique milestone ID and a name.');
   taskIds.add(m.id);codes.add(m.code.toUpperCase());if(m.earliest)date(m.earliest);if(m.actualFinish)date(m.actualFinish);
  }
  for(const t of [...s.tasks,...milestones])if(t.wbsId!==undefined&&(!str(t.wbsId,100)||(t.wbsId&&!groups.has(t.wbsId))))throw Error('A schedule item refers to a missing WBS section.');
  const linkIds=new Set(),linkKeys=new Set();
  for(const l of s.links){
   const key=l&&JSON.stringify([l.from,l.to,l.type]);
   if(!l||!str(l.id,100)||!l.id||linkIds.has(l.id)||!str(l.from,100)||!str(l.to,100)||l.from===l.to||!TYPES.includes(l.type)||!int(l.lag,-3650,3650)||linkKeys.has(key))throw Error('Invalid or duplicate schedule relationship in backup.');
   linkIds.add(l.id);linkKeys.add(key);
  }
  const bases=new Set();
  for(const b of s.baselines){
   if(!b||!str(b.id,100)||!b.id||bases.has(b.id)||!str(b.name,80)||!b.name.trim()||!str(b.createdAt,40)||!CAL.includes(b.calendar)||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>250||!Array.isArray(b.links)||b.links.length>1200)throw Error('Invalid schedule baseline in backup.');
   bases.add(b.id);date(b.start);date(b.finish);
   const ids=new Set();
   for(const r of b.rows){
    if(!r||!str(r.id,100)||ids.has(r.id)||!str(r.code,30)||!str(r.description,2500)||!(r.kind==='milestone'?r.days===0&&r.start===r.finish&&r.weight===0:int(r.days,1,3650))||!Number.isFinite(r.weight)||r.weight<0||r.weight>100||date(r.finish)<date(r.start))throw Error('Invalid baseline activity in backup.');
    ids.add(r.id);
   }
   const bc=calendar(b.calendar,b.workdays);
   for(const r of b.rows)if(r.kind==='milestone'?!bc.work(date(r.start)):bc.checked(r.finish,r.code)+1-bc.checked(r.start,r.code)!==r.days)throw Error('Baseline duration does not match its calendar.');
   if(Math.abs(b.rows.reduce((sum,r)=>sum+r.weight,0)-(b.rows.some(r=>r.kind!=='milestone')?100:0))>.02)throw Error('Baseline weights must total 100%.');
   for(const l of b.links)if(!l||!ids.has(l.from)||!ids.has(l.to)||l.from===l.to||!TYPES.includes(l.type)||!int(l.lag,-3650,3650))throw Error('Invalid baseline relationship.');
  }
  if(s.baselineId&&!bases.has(s.baselineId))throw Error('Selected schedule baseline is missing.');
  return s;
 }
 function blank(today){
  date(today);return {version:1,calendar:'weekdays',start:today,statusDate:'',tasks:[],links:[],baselines:[],baselineId:'',wbs:[],milestones:[]};
 }
 const active=p=>(p.activities||[]).filter(a=>!a.removedFromOs);
 function prepare(p,today){
  const s=p.schedule?clone(p.schedule):blank(today);
  s.wbs=s.wbs||[];s.milestones=s.milestones||[];
  const ids=new Set((p.activities||[]).map(a=>a.id)),eventIds=new Set(s.milestones.map(m=>m.id));
  s.tasks=s.tasks.filter(t=>ids.has(t.id));
  const exists=id=>ids.has(id)||eventIds.has(id);
  s.links=s.links.filter(l=>exists(l.from)&&exists(l.to));
  const byId=new Map(s.tasks.map(t=>[t.id,t])),codes=new Set(nodes(s).map(t=>t.code.toUpperCase()));let next=10;
  for(const a of active(p))if(!byId.has(a.id)){
   let code;do{code='A'+String(next).padStart(3,'0');next+=10}while(codes.has(code));codes.add(code);
   s.tasks.push({id:a.id,code,days:null,earliest:'',actualStart:'',actualFinish:'',remaining:null,wbsId:''});
  }
  return s;
 }
 function network(tasks,links){
  const byId=new Map(tasks.map(t=>[t.id,t])),incoming=new Map(tasks.map(t=>[t.id,[]])),outgoing=new Map(tasks.map(t=>[t.id,[]])),counts=new Map(tasks.map(t=>[t.id,0]));
  const used=links.filter(l=>byId.has(l.from)&&byId.has(l.to));
  for(const l of used){incoming.get(l.to).push(l);outgoing.get(l.from).push(l);counts.set(l.to,counts.get(l.to)+1)}
  const sorted=tasks.filter(t=>counts.get(t.id)===0);
  for(let i=0;i<sorted.length;i++)for(const l of outgoing.get(sorted[i].id)){counts.set(l.to,counts.get(l.to)-1);if(!counts.get(l.to))sorted.push(byId.get(l.to))}
  if(sorted.length!==tasks.length)throw Error('These relationships create a loop. Remove or change a link before scheduling.');
  return {sorted,incoming,used};
 }
 function networkCheck(p,s){validateSchedule(s);return network(nodes(s).filter(t=>isMilestone(t)||active(p).some(a=>a.id===t.id)),s.links)}
 const bound=(link,from)=> (link.type[0]==='F'?from.f:from.s)+link.lag;
 function planned(p,s){
  const activities=active(p),map=new Map(activities.map(a=>[a.id,a]));
  const tasks=nodes(s).filter(t=>isMilestone(t)||map.has(t.id));if(!tasks.length)throw Error('Add at least one work activity or milestone.');
  if(tasks.filter(t=>!isMilestone(t)).length!==activities.length)throw Error('Add the new activities to the schedule.');
  const {sorted,incoming,used}=network(tasks,s.links);
  const missing=tasks.filter(t=>!isMilestone(t)&&!t.days);
  if(missing.length)throw Error('Enter a duration for '+missing.map(t=>t.code).slice(0,6).join(', ')+(missing.length>6?' and '+(missing.length-6)+' more':'')+'.');
  const c=calendar(s.calendar,s.workdays),anchor=c.toIndex(date(s.start)),slots=new Map();
  for(const t of sorted){
   let start=Math.max(anchor,t.earliest?c.toIndex(date(t.earliest)):anchor);
   for(const l of incoming.get(t.id))start=Math.max(start,bound(l,slots.get(l.from))-(l.type[1]==='F'?t.days:0));
   slots.set(t.id,{s:start,f:start+t.days});
  }
  return {c,tasks,map,sorted,incoming,used,slots,anchor,finish:tasks.map(t=>finishDate(c,t,slots.get(t.id))).sort().at(-1)};
 }
 function makeBaseline(p,s,{id,name,now,weights}){
  validateSchedule(s);
  const plan=planned(p,s),byId=new Map((p.activities||[]).map((a,i)=>[a.id,Number(weights[i])||0])),work=plan.tasks.filter(t=>!isMilestone(t));
  let sum=work.reduce((n,t)=>n+Math.max(0,byId.get(t.id)||0),0);
  const equal=!sum;if(equal)sum=work.length||1;
  const phases=new Map(wbsRows(s).map(w=>[w.id,w.number+' '+w.name]));
  return {id,name:String(name||'').trim().slice(0,80),createdAt:now,calendar:s.calendar,...(s.calendar==='custom'?{workdays:workdays(s.calendar,s.workdays)}:{}),start:plan.c.start(plan.anchor),finish:plan.finish,links:clone(plan.used),rows:plan.tasks.map(t=>{
   const slot=plan.slots.get(t.id),event=isMilestone(t);return {id:t.id,code:t.code,description:String(event?t.name:plan.map.get(t.id).description||'').slice(0,2500),days:t.days,start:plan.c.start(slot.s),finish:finishDate(plan.c,t,slot),weight:event?0:(equal?1:Math.max(0,byId.get(t.id)||0))*100/sum,kind:event?'milestone':'activity',wbs:phases.get(t.wbsId)||''};
  })};
 }
 function calculate(p,s,fallbackDate){
  validateSchedule(s);
  const plan=planned(p,s),{c,map,sorted,incoming,slots}=plan;
  const statusDate=s.statusDate||fallbackDate,day=date(statusDate),cut=c.toIndex(day+1),forecast=new Map(),warnings=[];
  if(day<date(plan.c.start(plan.anchor)))warnings.push('The status date is before the first planned working day.');
  const ignored=s.links.length-plan.used.length;
  if(ignored)warnings.push(ignored+' relationship(s) ignored because a linked activity is no longer on the active estimate.');
  let assumedFinish=0,assumedStart=0,logicWarnings=0,onHold=0,nonWorkingActuals=0;
  for(const t of sorted){
   const event=isMilestone(t),a=map.get(t.id),pct=event?(t.actualFinish?100:0):fill(Number(a.progress)||0,0,100);
   const first=t.actualStart?date(t.actualStart):null,last=t.actualFinish?date(t.actualFinish):null;
   const actualStart=first===null?null:c.toIndex(first),actualFinish=last===null?null:c.toIndex(last+(event?0:1));
   if(first!==null&&first>day||last!==null&&last>day)throw Error(t.code+' has an actual date after the status date.');
   if(!event&&last!==null&&(first===null||last<first))throw Error(t.code+' needs an actual start on or before its actual finish.');
   if(last!==null&&pct<100)throw Error(t.code+' has an actual finish but progress is below 100%.');
   if(first!==null&&!c.work(first)||last!==null&&!c.work(last))nonWorkingActuals++;
   const complete=pct===100,started=actualStart!==null||pct>0,slot=slots.get(t.id);
   if(started&&actualStart===null&&!event)assumedStart++;
   const assumed=event&&complete?actualFinish:actualStart??Math.min(slot.s,(actualFinish??cut)-1);
   const remaining=complete||event?0:(t.remaining??Math.max(1,Math.ceil(t.days*(100-pct)/100)));
   if(!complete&&!event&&a.status==='On hold')onHold++;
   let res;
   if(complete){
    if(actualFinish===null)assumedFinish++;
    res={s:assumed,f:actualFinish??cut,remaining:0};
    if(incoming.get(t.id).some(l=>bound(l,forecast.get(l.from))>(l.type[1]==='F'?res.f:res.s)))logicWarnings++;
   }else{
    const earliest=t.earliest?c.toIndex(date(t.earliest)):plan.anchor;
    let start=Math.max(cut,plan.anchor,earliest),outOfSequence=false;
    for(const l of incoming.get(t.id)){
     const limit=bound(l,forecast.get(l.from));
     if(l.type[1]==='F')start=Math.max(start,limit-remaining);
     else if(!started||limit>assumed){if(started)outOfSequence=true;start=Math.max(start,limit)}
    }
    if(outOfSequence)logicWarnings++;
    res={s:started?assumed:start,f:start+remaining,remaining,resume:start};
   }
   forecast.set(t.id,res);
  }
  if(nonWorkingActuals)warnings.push(nonWorkingActuals+' actual date(s) fall outside the current working week. Their recorded dates were kept.');
  if(assumedStart||assumedFinish)warnings.push('Missing actual dates: '+assumedStart+' start(s), '+assumedFinish+' finish(es). The forecast uses estimated dates for these; enter actuals to confirm them.');
  if(logicWarnings)warnings.push(logicWarnings+' activity/activities started or finished out of logical sequence. Actual dates were kept; unmet links affect remaining work.');
  if(onHold)warnings.push(onHold+' on-hold activity/activities are forecast using their current remaining days; set a later earliest start if needed.');
  const baseline=s.baselines.find(b=>b.id===s.baselineId)||null,scope=new Map((baseline?.rows||[]).map(r=>[r.id,r]));
  let target=null,actual=null,variance=null,coverage=null;
  if(baseline&&baseline.rows.some(r=>r.kind!=='milestone')){
   const bc=calendar(baseline.calendar,baseline.workdays),elapsed=bc.toIndex(day+1);let planPct=0,actualPct=0,matched=0;
   for(const t of baseline.rows.filter(r=>r.kind!=='milestone')){
    const start=bc.checked(t.start,t.code+' baseline start');
    planPct+=fill((elapsed-start)/t.days,0,1)*t.weight;
    if(map.has(t.id)){matched+=t.weight;actualPct+=fill(Number(map.get(t.id).progress)||0,0,100)/100*t.weight}
   }
   target=round(planPct);actual=round(actualPct);variance=round(actualPct-planPct);coverage=round(matched);
   const newRows=plan.tasks.filter(t=>!isMilestone(t)&&!scope.has(t.id)).length;
   if(coverage<100||newRows)warnings.push('Scope differs from the baseline. '+coverage.toFixed(1)+'% of baseline weight is still matched; '+newRows+' new activity/activities are excluded from the comparison. Missing baseline work is counted as 0% actual.');
  }
  const phases=new Map(wbsRows(s).map(w=>[w.id,w.number+' '+w.name]));
  const rows=plan.tasks.map(t=>{
   const event=isMilestone(t),a=map.get(t.id),base=scope.get(t.id),aPlan=slots.get(t.id),f=forecast.get(t.id),end=t.actualFinish||finishDate(c,t,f);
   return {id:t.id,code:t.code,kind:event?'milestone':'activity',wbs:phases.get(t.wbsId)||'',description:String(event?t.name:a.description||'').slice(0,2500),days:t.days,progress:event?(t.actualFinish?100:0):fill(Number(a.progress)||0,0,100),remaining:f.remaining,
    plannedStart:c.start(aPlan.s),plannedFinish:finishDate(c,t,aPlan),baselineStart:base?.start||'',baselineFinish:base?.finish||'',
    actualStart:event?t.actualFinish:t.actualStart,actualFinish:t.actualFinish,remainingStart:f.resume==null?'':c.start(f.resume),forecastStart:(event?t.actualFinish:t.actualStart)||c.start(f.s),forecastFinish:end,varianceDays:base?date(end)-date(base.finish):null};
  });
  const finish=rows.map(r=>r.forecastFinish).sort().at(-1);
  return {version:1,statusDate,calendar:s.calendar,...(s.calendar==='custom'?{workdays:workdays(s.calendar,s.workdays)}:{}),plannedFinish:plan.finish,baseline:baseline?{id:baseline.id,name:baseline.name,finish:baseline.finish}:null,
   target,actual,variance,coverage,finish,slipDays:baseline?date(finish)-date(baseline.finish):null,rows,links:plan.used.map(({from,to,type,lag})=>({from,to,type,lag})),warnings};
 }
 function paymentMilestone(p,term){
  if(!term?.scheduleMilestoneId||!p.schedule)return null;
  const s=p.schedule,event=(s.milestones||[]).find(m=>m.id===term.scheduleMilestoneId);
  if(!event)return null;
  const asOf=(s.enabled!==false?s.statusDate:'')||p.draft?.date||new Date().toISOString().slice(0,10);
  const achieved=Boolean(event.actualFinish&&event.actualFinish<=asOf);
  let forecast='';
  if(s.enabled!==false)try{forecast=calculate(p,prepare(p,asOf),asOf).rows.find(r=>r.id===event.id)?.forecastFinish||''}catch{}
  return {id:event.id,code:event.code,name:event.name,achieved,actualDate:achieved?event.actualFinish:'',forecast};
 }
 function validateReport(s){
  if(!s||s.version!==1)throw Error('Invalid schedule report snapshot.');
  if(s.error){if(!str(s.error,1500))throw Error('Invalid schedule note.');return}
  if(!CAL.includes(s.calendar)||!Array.isArray(s.rows)||s.rows.length>250||!Array.isArray(s.warnings)||s.warnings.length>20||s.warnings.some(w=>!str(w,500)))throw Error('Invalid saved schedule forecast.');
  workdays(s.calendar,s.workdays);date(s.statusDate);date(s.plannedFinish);date(s.finish);
  if(s.baseline){if(!str(s.baseline.name,80)||!Number.isFinite(s.slipDays)||(![s.target,s.actual,s.variance,s.coverage].every(Number.isFinite)&&![s.target,s.actual,s.variance,s.coverage].every(x=>x===null))||[s.target,s.actual,s.coverage].some(n=>n<0||n>100)||Math.abs(s.variance)>100)throw Error('Invalid baseline comparison.');date(s.baseline.finish)}
  const ids=new Set(s.rows.map(r=>r?.id));
  if(s.links!==undefined&&(!Array.isArray(s.links)||s.links.length>1200||s.links.some(l=>!l||!ids.has(l.from)||!ids.has(l.to)||l.from===l.to||!TYPES.includes(l.type)||!int(l.lag,-3650,3650))))throw Error('Invalid schedule relationships in report.');
  for(const r of s.rows){if(!r||!str(r.code,30)||!str(r.description,2500)||!(r.kind==='milestone'?r.days===0:int(r.days,1,3650))||!int(r.remaining,0,3650)||!Number.isFinite(r.progress)||r.progress<0||r.progress>100)throw Error('Invalid saved schedule activity.');for(const k of ['plannedStart','plannedFinish','forecastStart','forecastFinish'])date(r[k]);for(const k of ['baselineStart','baselineFinish','actualStart','actualFinish','remainingStart'])if(r[k])date(r[k]);if(r.varianceDays!==null&&!Number.isFinite(r.varianceDays))throw Error('Invalid schedule variance.')}
 }
 return {TYPES,CAL,WEEK,LABELS,workdays,calendarLabel,nodes,wbsRows,blank,prepare,validateSchedule,validateReport,networkCheck,makeBaseline,calculate,paymentMilestone};
});
