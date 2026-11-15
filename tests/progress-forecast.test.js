'use strict';
const assert=require('node:assert/strict'),S=require('../renoweet-progress-schedule.js'),G=require('../renoweet-progress-gantt.js');
const activities=(...ids)=>({activities:ids.map(id=>({id,description:id,progress:0}))});
const at=(s,id)=>s.rows.find(r=>r.id===id);
const link=(from,to,type='FS',lag=0)=>({id:from+'-'+to+'-'+type,from,to,type,lag});
const calc=(p,s)=>S.calculate(p,s,'2026-11-15');
const ex=(date,working,label='')=>({id:date,date,working,label});
const milestone=(id,code='H010')=>({id,code,name:'Handover',earliest:'',actualFinish:'',wbsId:''});
const horizon='2026-11-16';
const p=activities('Strip','Fit','Snag','Touchups');
const s=S.prepare(p,horizon);s.tasks.forEach((t,i)=>{t.days=[2,3,1,1][i];t.remaining=t.days});
s.milestones=[milestone('Handover')];s.handoverId='Handover';s.deadline='2026-11-24';
s.links=[link('Strip','Fit'),link('Fit','Snag'),link('Snag','Handover')];
s.exceptions=[ex('2026-11-18',false,'Site closed'),ex('2026-11-21',true,'Agreed Saturday')];
let f=calc(p,s);
assert.equal(at(f,'Fit').forecastStart,'2026-11-19');
assert.equal(at(f,'Fit').forecastFinish,'2026-11-21');
assert.equal(f.finish,'2026-11-24');assert.equal(f.method.deadlineVariance,0);
assert.deepEqual(f.method.drivers,['A010','A020','A030','H010']);
assert.equal(at(f,'Touchups').floatDays,6,'Independent work can be late to the baseline without delaying handover.');
assert.equal(at(f,'Strip').floatDays,0);assert(f.links.every(l=>l.driving));
assert.equal(f.method.calendarExceptions,2);S.validateReport(f);
assert.match(G.svg(f),/data-gantt-driving="true"/);
const baseline=S.makeBaseline(p,s,{id:'approved',name:'Approved plan',now:'2026-11-15T12:00:00Z',weights:[25,25,25,25]});
s.baselines.push(baseline);s.baselineId=baseline.id;s.exceptions=s.exceptions.filter(e=>e.working);
assert.deepEqual(baseline.exceptions,[ex('2026-11-18',false,'Site closed'),ex('2026-11-21',true,'Agreed Saturday')]);
f=calc(p,s);assert.equal(at(f,'Fit').plannedStart,'2026-11-18');assert.equal(at(f,'Fit').baselineStart,'2026-11-19');
assert.equal(f.method.handover.finish,'2026-11-23');assert.equal(f.method.deadlineVariance,-1);
p.activities[1].progress=95;s.tasks[1].remaining=3;
s.tasks[1].expectedFinish='2026-11-21';
f=calc(p,s);assert.equal(at(f,'Fit').progress,95);assert.equal(at(f,'Fit').remaining,3);assert.equal(at(f,'Fit').remainingSource,'entered');
assert.equal(at(f,'Fit').forecastFinish,'2026-11-21');assert.equal(at(f,'Fit').actualFinish,'');
delete s.tasks[1].remaining; s.tasks[1].remaining=null;
f=calc(p,s);assert.equal(at(f,'Fit').remainingSource,'estimated');assert.equal(f.method.estimated,1);
assert(f.warnings.some(w=>w.includes('estimated remaining days')));
s.tasks[1].expectedFinish='2026-11-15';assert(calc(p,s).warnings.some(w=>w.includes('expected finish date')));
s.tasks[3].expectedFinish='2026-12-02';f=calc(p,s);
assert.equal(f.finish,'2026-12-02');assert(f.warnings.some(w=>w.includes('after the selected handover')));
assert.equal(at(f,'Touchups').floatDays,0);assert.equal(at(f,'Touchups').driving,false);
assert.throws(()=>S.validateSchedule({...s,exceptions:[ex('2026-11-18',true),ex('2026-11-18',false)]}),/duplicate/);

// A progressed successor started early: its history stays fixed under both scheduling policies.
const q=activities('before','started','after'),rule=S.prepare(q,'2026-11-09');rule.statusDate='2026-11-13';
rule.tasks.forEach((t,i)=>{t.days=[3,2,1][i];t.remaining=t.days});
q.activities[1].progress=50;rule.tasks[1].actualStart='2026-11-10';
rule.links=[link('before','started'),link('started','after')];
let retained=calc(q,rule),overridden=calc(q,{...rule,logic:'override'});
assert.equal(at(retained,'started').remainingStart,'2026-11-19');assert.equal(at(overridden,'started').remainingStart,'2026-11-16');
assert.equal(at(overridden,'started').actualStart,'2026-11-10');
assert.equal(at(retained,'after').forecastStart,'2026-11-23');assert.equal(at(overridden,'after').forecastStart,'2026-11-18');
assert(retained.links[0].driving);assert(!overridden.links[0].driving);S.validateReport(overridden);

// Independently enumerate feasible start tuples for small mixed networks and
// verify both earliest finishes and the allowance before project finish moves.
const DAY=86400000,d0=Date.parse(horizon)/DAY,off=d=>Date.parse(d)/DAY-d0;
for(const kind of S.TYPES)for(const lag of [-1,0,2]){
 const t=activities('A','B','C'),plan=S.prepare(t,horizon);plan.calendar='all';
 const durations=[3,2,2];plan.tasks.forEach((row,i)=>{row.days=durations[i];row.remaining=durations[i]});
 plan.milestones=[milestone('M')];plan.links=[link('A','B',kind,lag),link('B','M','FS',0)];
 const forecast=calc(t,plan);
 const feasible=[];
 for(let a=0;a<=11;a++)for(let b=0;b<=11;b++)for(let c=0;c<=11;c++)for(let m=0;m<=11;m++){
  if((kind[1]==='F'?b+2:b)<(kind[0]==='F'?a+3:a)+lag||m<b+2)continue;
  feasible.push({start:[a,b,c,m],finish:Math.max(a+2,b+1,c+1,m)});
 }
 const earliest=[0,1,2,3].map(i=>Math.min(...feasible.map(row=>row.start[i])));
 const end=Math.min(...feasible.map(row=>row.finish));
 assert.equal(off(forecast.finish),end,kind+' '+lag+' finish');
 const latest=[0,1,2,3].map(i=>Math.max(...feasible.filter(row=>row.finish<=end).map(row=>row.start[i])));
 assert.deepEqual(forecast.rows.map(r=>off(r.forecastStart)),earliest);
 assert.deepEqual(forecast.rows.map(r=>r.floatDays),latest.map((v,i)=>v-earliest[i]),kind+' '+lag+' float');
}
console.log('Forecast verified: calendar exceptions, frozen baseline, separate expected finish and progress, entered vs estimated days, both logic modes, deadline and handover, driving path and exhaustive small-network float checks.');
