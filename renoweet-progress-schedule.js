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
 const LOGIC=['retain','override'];
 function validateExceptions(list){
  if(list===undefined)return;
  if(!Array.isArray(list)||list.length>366)throw Error('A calendar supports up to 366 exception dates.');
  const seen=new Set();
  for(const e of list){
   if(!e||typeof e.working!=='boolean'||e.id!==e.date||seen.has(e.date)||!str(e.label,100))throw Error('Invalid or duplicate calendar exception.');
   date(e.date);seen.add(e.date);
  }
 }
 function calendar(kind,days,exceptions=[]){
  const w=workdays(kind,days),per=w.length;
  const regular=n=>w.includes(((n-MONDAY)%7+7)%7+1);
  const normalIndex=n=>{const offset=n-MONDAY,week=Math.floor(offset/7),d=offset-week*7+1;return week*per+w.filter(x=>x<d).length};
  const values=new Map(exceptions.map(e=>[date(e.date),e.working])),xs=[...values.keys()].sort((a,b)=>a-b),prefix=[0];
  for(const day of xs)prefix.push(prefix.at(-1)+Number(values.get(day))-Number(regular(day)));
  const work=n=>values.get(n)??regular(n);
  const toIndex=n=>{
   let lo=0,hi=xs.length;
   while(lo<hi){const mid=(lo+hi)>>1;if(xs[mid]<n)lo=mid+1;else hi=mid}
   return normalIndex(n)+prefix[lo];
  };
  const min=date('1900-01-01'),max=date('2200-12-31');
  const fromIndex=n=>{
   if(!xs.length){const week=Math.floor(n/per);return MONDAY+7*week+w[n-week*per]-1}
   if(n<toIndex(min)||n>=toIndex(max+1))throw Error('The calculated date is outside the supported calendar.');
   let lo=min,hi=max;
   while(lo<hi){const mid=Math.floor((lo+hi)/2);if(toIndex(mid+1)>n)hi=mid;else lo=mid+1}
   return lo;
  };
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
  workdays(s.calendar,s.workdays);validateExceptions(s.exceptions);
  if(s.logic!==undefined&&!LOGIC.includes(s.logic))throw Error('Choose a scheduling rule for work started out of sequence.');
  if(s.handoverId!==undefined&&!str(s.handoverId,100))throw Error('Invalid handover milestone.');
  if(s.deadline!==undefined){if(!str(s.deadline,10))throw Error('Invalid handover deadline.');if(s.deadline)date(s.deadline)}
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
  if(s.handoverId&&!milestones.some(m=>m.id===s.handoverId))throw Error('Choose an existing handover milestone.');
  for(const t of [...s.tasks,...milestones])if(t.expectedFinish!==undefined){if(!str(t.expectedFinish,10))throw Error('Invalid expected finish date.');if(t.expectedFinish)date(t.expectedFinish)}
  for(const t of [...s.tasks,...milestones])if(t.wbsId!==undefined&&(!str(t.wbsId,100)||(t.wbsId&&!groups.has(t.wbsId))))throw Error('A schedule item refers to a missing WBS section.');
  const linkIds=new Set(),linkKeys=new Set();
  for(const l of s.links){
   const key=l&&JSON.stringify([l.from,l.to,l.type]);
   if(!l||!str(l.id,100)||!l.id||linkIds.has(l.id)||!str(l.from,100)||!str(l.to,100)||l.from===l.to||!TYPES.includes(l.type)||!int(l.lag,-3650,3650)||linkKeys.has(key))throw Error('Invalid or duplicate schedule relationship in backup.');
   if(l.material!==undefined&&(l.material!==true||l.type!=='FS'||!milestones.some(m=>m.id===l.from)))throw Error('An invalid material delivery is linked in the schedule.');
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
   validateExceptions(b.exceptions);const bc=calendar(b.calendar,b.workdays,b.exceptions);
   for(const r of b.rows)if(r.kind==='milestone'?!bc.work(date(r.start)):bc.checked(r.finish,r.code)+1-bc.checked(r.start,r.code)!==r.days)throw Error('Baseline duration does not match its calendar.');
   if(Math.abs(b.rows.reduce((sum,r)=>sum+r.weight,0)-(b.rows.some(r=>r.kind!=='milestone')?100:0))>.02)throw Error('Baseline weights must total 100%.');
   for(const l of b.links)if(!l||!ids.has(l.from)||!ids.has(l.to)||l.from===l.to||!TYPES.includes(l.type)||!int(l.lag,-3650,3650))throw Error('Invalid baseline relationship.');
  }
  if(s.baselineId&&!bases.has(s.baselineId))throw Error('Selected schedule baseline is missing.');
  return s;
 }
 function blank(today){
  date(today);return {version:1,calendar:'weekdays',start:today,statusDate:'',tasks:[],links:[],baselines:[],baselineId:'',wbs:[],milestones:[],exceptions:[],logic:'retain',handoverId:'',deadline:''};
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
  const c=calendar(s.calendar,s.workdays,s.exceptions),anchor=c.toIndex(date(s.start)),slots=new Map();
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
  return {id,name:String(name||'').trim().slice(0,80),createdAt:now,calendar:s.calendar,...(s.calendar==='custom'?{workdays:workdays(s.calendar,s.workdays)}:{}),start:plan.c.start(plan.anchor),finish:plan.finish,...(s.exceptions?.length?{exceptions:clone(s.exceptions)}:{}),links:clone(plan.used),rows:plan.tasks.map(t=>{
   const slot=plan.slots.get(t.id),event=isMilestone(t);return {id:t.id,code:t.code,description:String(event?t.name:plan.map.get(t.id).description||'').slice(0,2500),days:t.days,start:plan.c.start(slot.s),finish:finishDate(plan.c,t,slot),weight:event?0:(equal?1:Math.max(0,byId.get(t.id)||0))*100/sum,kind:event?'milestone':'activity',wbs:phases.get(t.wbsId)||''};
  })};
 }
 function actualDateIssues(p,s,status){
  const byId=new Map(active(p).map(a=>[a.id,a])),issues=[];
  for(const t of nodes(s)){
   const event=isMilestone(t),a=byId.get(t.id);if(!event&&!a)continue;
   const add=(field,message)=>issues.push({id:t.id,field,code:t.code,message});
   if(t.actualStart&&t.actualStart>status)add('actualStart',t.code+' actual start '+t.actualStart+' is after the status date ('+status+').');
   if(t.actualFinish&&t.actualFinish>status)add('actualFinish',t.code+' actual finish '+t.actualFinish+' is after the status date ('+status+').');
   else if(t.actualFinish&&!event){
    if(!t.actualStart||t.actualFinish<t.actualStart)add('actualFinish',t.code+' needs an actual start on or before its actual finish.');
    else if(Number(a.progress)<100)add('actualFinish',t.code+' has an actual finish but progress is below 100%. Clear the actual finish if work is still in progress; use Expected finish for a future date.');
   }
  }
  return issues;
 }
 // Input errors should not hide the reference dates used to find and correct them.
 function review(p,s,fallbackDate){
  const status=s.statusDate||fallbackDate;let error;
  try{return {forecast:calculate(p,s,fallbackDate)}}catch(e){error=String(e.message).slice(0,1500)}
  try{validateSchedule(s);date(status)}catch{return {error,issues:[]}}
  const issues=actualDateIssues(p,s,status);
  const baseline=s.baselines.find(b=>b.id===s.baselineId)||null,scope=new Map((baseline?.rows||[]).map(r=>[r.id,r]));
  let plan;try{plan=planned(p,s)}catch{}
  const byId=new Map(active(p).map(a=>[a.id,a])),rejected=new Set(issues.map(issue=>issue.id+'|'+issue.field));
  const phases=new Map(wbsRows(s).map(w=>[w.id,w.number+' '+w.name]));
  const rows=nodes(s).filter(t=>isMilestone(t)||byId.has(t.id)).map(t=>{
   const event=isMilestone(t),base=scope.get(t.id),a=byId.get(t.id),slot=plan?.slots.get(t.id);
   const actualFinish=rejected.has(t.id+'|actualFinish')?'':t.actualFinish;
   const actualStart=event?actualFinish:rejected.has(t.id+'|actualStart')?'':t.actualStart;
   return {id:t.id,code:t.code,kind:event?'milestone':'activity',description:String(event?t.name:a.description||'').slice(0,2500),wbs:phases.get(t.wbsId)||'',
    days:t.days,progress:event?(actualFinish?100:0):fill(Number(a.progress)||0,0,100),
    plannedStart:slot?plan.c.start(slot.s):'',plannedFinish:slot?finishDate(plan.c,t,slot):'',
    baselineStart:base?.start||'',baselineFinish:base?.finish||'',actualStart,actualFinish,
    forecastStart:'',forecastFinish:'',remainingStart:'',remaining:null,varianceDays:null};
  });
  if(!rows.some(r=>r.baselineStart||r.plannedStart||r.actualStart))return {error,issues};
  return {error,issues,chart:{version:1,reviewOnly:true,error,statusDate:status,calendar:s.calendar,...(s.calendar==='custom'?{workdays:workdays(s.calendar,s.workdays)}:{}),
   plannedFinish:plan?.finish||'',baseline:baseline?{id:baseline.id,name:baseline.name,finish:baseline.finish}:null,finish:'',rows,links:[],warnings:[],
   ...(issues.length?{actualIssues:issues.slice(0,20).map(x=>x.message)}:{})}};
 }
 // Backward pass over the remaining-work constraints actually used by the
 // forecast. Actual starts and finishes are fixed observations, not float variables.
 function pathAnalysis(c,sorted,forecast,constraints,rows,handoverId){
  const open=sorted.filter(t=>forecast.get(t.id).resume!=null),byId=new Map(rows.map(r=>[r.id,r]));
  const last=rows.reduce((d,r)=>r.forecastFinish>d?r.forecastFinish:d,'');
  const selected=byId.get(handoverId),targets=selected?[selected]:rows.filter(r=>r.forecastFinish===last);
  const late=new Map(),drivers=new Set(),drivingLinks=new Set(),incoming=new Map(open.map(t=>[t.id,[]])),outgoing=new Map(open.map(t=>[t.id,[]]));
  for(const edge of constraints){incoming.get(edge.to).push(edge);outgoing.get(edge.from).push(edge)}
  for(const t of [...open].reverse()){
   const f=forecast.get(t.id),d=date(last);
   // A milestone is a point at the start of a working day; the end of
   // a normal activity is after its final working day.
   let end=isMilestone(t)?c.toIndex(d+1)-1:c.toIndex(d+1);
   let start=end-f.remaining;
   for(const edge of outgoing.get(t.id))start=Math.min(start,late.get(edge.to)-edge.offset);
   late.set(t.id,start);
  }
  const upstream=targets.filter(r=>forecast.get(r.id).resume!=null).map(r=>r.id);
  while(upstream.length){
   const id=upstream.pop();if(drivers.has(id))continue;drivers.add(id);
   for(const e of incoming.get(id)||[])if(forecast.get(e.from).resume+e.offset===forecast.get(id).resume){drivingLinks.add(e.id);upstream.push(e.from)}
  }
  for(const row of rows){
   const f=forecast.get(row.id);row.floatDays=late.has(row.id)?late.get(row.id)-f.resume:null;row.driving=drivers.has(row.id);
  }
  return {finish:last,drivingLinks,driverIds:sorted.filter(t=>drivers.has(t.id)).map(t=>t.id),
   handover:selected?{id:selected.id,code:selected.code,name:selected.description,finish:selected.forecastFinish,achieved:!!selected.actualFinish}:null};
 }
 function calculate(p,s,fallbackDate){
  validateSchedule(s);
  const plan=planned(p,s),{c,map,sorted,incoming,slots}=plan;
  const statusDate=s.statusDate||fallbackDate,day=date(statusDate),cut=c.toIndex(day+1),forecast=new Map(),warnings=[],constraints=[],logic=s.logic||'retain';
  if(day<date(plan.c.start(plan.anchor)))warnings.push('The status date is before the first planned working day.');
  const ignored=s.links.length-plan.used.length;
  if(ignored)warnings.push(ignored+' relationship(s) ignored because a linked activity is no longer on the active estimate.');
  let assumedFinish=0,assumedStart=0,logicWarnings=0,onHold=0,nonWorkingActuals=0,estimated=0,expectedMisses=0;
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
   const source=complete||event?'none':t.remaining==null?'estimated':'entered';
   if(source==='estimated')estimated++;
   if(!complete&&!event&&a.status==='On hold')onHold++;
   let res;
   if(complete){
    if(actualFinish===null)assumedFinish++;
    res={s:assumed,f:actualFinish??cut,remaining:0};
    if(incoming.get(t.id).some(l=>bound(l,forecast.get(l.from))>(l.type[1]==='F'?res.f:res.s)))logicWarnings++;
   }else{
    const earliest=t.earliest?c.toIndex(date(t.earliest)):plan.anchor;
    const expected=t.expectedFinish?c.toIndex(date(t.expectedFinish))+(event?0:1):null;
    const earliestResume=Math.max(cut,plan.anchor,earliest,expected==null?-Infinity:expected-remaining);
    let start=earliestResume,outOfSequence=false;
    for(const l of incoming.get(t.id)){
     const pred=forecast.get(l.from),limit=bound(l,pred),finishConstraint=l.type[1]==='F';
     const violated=started&&(finishConstraint?limit>earliestResume+remaining:limit>assumed);
     if(violated)outOfSequence=true;
     if(started&&logic==='override')continue;
     if(finishConstraint||!started||violated){
      const shift=finishConstraint?remaining:0;
      start=Math.max(start,limit-shift);
      if(pred.resume!=null&&(l.type[0]==='F'||!pred.started)){
       constraints.push({id:l.id,from:l.from,to:l.to,offset:(l.type[0]==='F'?pred.remaining:0)+l.lag-shift});
      }
     }
    }
    if(outOfSequence)logicWarnings++;
    if(t.expectedFinish&&finishDate(c,t,{f:start+remaining})>t.expectedFinish)expectedMisses++;
    res={s:started?assumed:start,f:start+remaining,remaining,resume:start,started};
   }
   res.remainingSource=source;
   forecast.set(t.id,res);
  }
  if(nonWorkingActuals)warnings.push(nonWorkingActuals+' actual date(s) fall outside the current working week. Their recorded dates were kept.');
  if(assumedStart||assumedFinish)warnings.push('Missing actual dates: '+assumedStart+' start(s), '+assumedFinish+' finish(es). The forecast uses estimated dates for these; enter actuals to confirm them.');
  if(logicWarnings)warnings.push(logicWarnings+' activity/activities started or finished out of logical sequence. Actual dates were kept. '+(logic==='override'?'Started work uses Progress override.':'Remaining work follows retained dependencies.'));
  if(estimated)warnings.push(estimated+' unfinished activity/activities use estimated remaining days derived from physical progress. Enter remaining days to improve the forecast.');
  if(expectedMisses)warnings.push(expectedMisses+' expected finish date(s) are earlier than the calculated forecast. The forecast respects the remaining days, applicable links and work calendar.');
  if(onHold)warnings.push(onHold+' on-hold activity/activities are forecast using their current remaining days; set a later earliest start if needed.');
  const baseline=s.baselines.find(b=>b.id===s.baselineId)||null,scope=new Map((baseline?.rows||[]).map(r=>[r.id,r]));
  let target=null,actual=null,variance=null,coverage=null;
  if(baseline&&baseline.rows.some(r=>r.kind!=='milestone')){
   const bc=calendar(baseline.calendar,baseline.workdays,baseline.exceptions),elapsed=bc.toIndex(day+1);let planPct=0,actualPct=0,matched=0;
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
    actualStart:event?t.actualFinish:t.actualStart,actualFinish:t.actualFinish,expectedFinish:t.expectedFinish||'',remainingSource:f.remainingSource,remainingStart:f.resume==null?'':c.start(f.resume),forecastStart:(event?t.actualFinish:t.actualStart)||c.start(f.s),forecastFinish:end,varianceDays:base?date(end)-date(base.finish):null};
  });
  const analysis=pathAnalysis(c,sorted,forecast,constraints,rows,s.handoverId),finish=analysis.finish;
  const deadline=s.deadline||'',targetFinish=analysis.handover?.finish||finish;
  if(analysis.handover&&targetFinish<finish)warnings.push('Some work is forecast after the selected handover milestone. Check the handover predecessors.');
  const drivers=analysis.driverIds.map(id=>rows.find(r=>r.id===id).code);
  const calendarChanges=(s.exceptions||[]).filter(e=>e.date>=s.start&&e.date<=finish).sort((a,b)=>a.date.localeCompare(b.date));
  const calendarExceptions=calendarChanges.length;
  return {version:1,statusDate,calendar:s.calendar,...(s.calendar==='custom'?{workdays:workdays(s.calendar,s.workdays)}:{}),plannedFinish:plan.finish,baseline:baseline?{id:baseline.id,name:baseline.name,finish:baseline.finish}:null,
   target,actual,variance,coverage,finish,slipDays:baseline?date(finish)-date(baseline.finish):null,
   method:{logic,estimated,nonWorkingActuals,calendarExceptions,calendarChanges:clone(calendarChanges),drivers,handover:analysis.handover,deadline,deadlineVariance:deadline?date(targetFinish)-date(deadline):null},
   rows,links:plan.used.map(({id,from,to,type,lag})=>({from,to,type,lag,...(analysis.drivingLinks.has(id)?{driving:true}:{})})),warnings};
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
  if(s.error&&!str(s.error,1500))throw Error('Invalid schedule note.');
  if(s.reviewOnly===true){
   if(!s.error||!Array.isArray(s.rows)||!s.rows.length||s.rows.length>250||s.finish!==''||s.links?.length||s.actualIssues!==undefined&&(!Array.isArray(s.actualIssues)||s.actualIssues.length>20||s.actualIssues.some(x=>!str(x,500))))throw Error('Invalid schedule review snapshot.');
   workdays(s.calendar,s.workdays);date(s.statusDate);if(s.plannedFinish)date(s.plannedFinish);
   if(s.baseline){if(!str(s.baseline.name,80))throw Error('Invalid baseline review.');date(s.baseline.finish)}
   const ids=new Set();
   for(const r of s.rows){
    if(!r||!str(r.id,100)||!r.id||ids.has(r.id)||!str(r.code,30)||!str(r.description,2500)||!str(r.wbs,150)||!Number.isFinite(r.progress)||r.progress<0||r.progress>100||r.forecastStart||r.forecastFinish||r.remaining!==null)throw Error('Invalid schedule review activity.');
    ids.add(r.id);for(const k of ['plannedStart','plannedFinish','baselineStart','baselineFinish','actualStart','actualFinish'])if(r[k])date(r[k]);
    if(r.actualStart>s.statusDate||r.actualFinish>s.statusDate||r.actualFinish&&(!r.actualStart||r.actualStart>r.actualFinish))throw Error('Invalid actual dates in schedule review.');
   }
   return;
  }
  if(s.error)return;
  if(!CAL.includes(s.calendar)||!Array.isArray(s.rows)||s.rows.length>250||!Array.isArray(s.warnings)||s.warnings.length>20||s.warnings.some(w=>!str(w,500)))throw Error('Invalid saved schedule forecast.');
  workdays(s.calendar,s.workdays);date(s.statusDate);date(s.plannedFinish);date(s.finish);
  if(s.method){
   const m=s.method;
   if(!LOGIC.includes(m.logic)||!['estimated','calendarExceptions','nonWorkingActuals'].every(k=>int(m[k],0,366))||!Array.isArray(m.drivers)||m.drivers.length>250||m.drivers.some(c=>!str(c,30))||!str(m.deadline,10)||!(m.deadlineVariance===null||Number.isInteger(m.deadlineVariance)))throw Error('Invalid schedule forecast method.');
   if(m.deadline)date(m.deadline);validateExceptions(m.calendarChanges);
   if(m.calendarChanges&&m.calendarChanges.length!==m.calendarExceptions)throw Error('Invalid forecast calendar exceptions.');
   if(m.handover){if(!str(m.handover.code,30)||!str(m.handover.name,2500)||m.handover.achieved!==undefined&&typeof m.handover.achieved!=='boolean')throw Error('Invalid handover forecast.');date(m.handover.finish)}
  }
  if(s.baseline){if(!str(s.baseline.name,80)||!Number.isFinite(s.slipDays)||(![s.target,s.actual,s.variance,s.coverage].every(Number.isFinite)&&![s.target,s.actual,s.variance,s.coverage].every(x=>x===null))||[s.target,s.actual,s.coverage].some(n=>n<0||n>100)||Math.abs(s.variance)>100)throw Error('Invalid baseline comparison.');date(s.baseline.finish)}
  const ids=new Set(s.rows.map(r=>r?.id));
  if(s.links!==undefined&&(!Array.isArray(s.links)||s.links.length>1200||s.links.some(l=>!l||!ids.has(l.from)||!ids.has(l.to)||l.from===l.to||!TYPES.includes(l.type)||!int(l.lag,-3650,3650))))throw Error('Invalid schedule relationships in report.');
  for(const r of s.rows){if(!r||!str(r.code,30)||!str(r.description,2500)||!(r.kind==='milestone'?r.days===0:int(r.days,1,3650))||!int(r.remaining,0,3650)||!Number.isFinite(r.progress)||r.progress<0||r.progress>100)throw Error('Invalid saved schedule activity.');for(const k of ['plannedStart','plannedFinish','forecastStart','forecastFinish'])date(r[k]);for(const k of ['baselineStart','baselineFinish','actualStart','actualFinish','remainingStart','expectedFinish'])if(r[k])date(r[k]);if(r.remainingSource!==undefined&&!['none','estimated','entered'].includes(r.remainingSource)||r.driving!==undefined&&typeof r.driving!=='boolean'||r.floatDays!==undefined&&r.floatDays!==null&&!int(r.floatDays,0,110000))throw Error('Invalid schedule forecast row.');if(r.varianceDays!==null&&!Number.isFinite(r.varianceDays))throw Error('Invalid schedule variance.')}
 }
 return {TYPES,CAL,WEEK,LABELS,LOGIC,workdays,calendarLabel,nodes,wbsRows,blank,prepare,validateSchedule,validateReport,networkCheck,makeBaseline,calculate,review,paymentMilestone};
});
