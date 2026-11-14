'use strict';
const assert=require('node:assert/strict'),S=require('../renoweet-progress-schedule.js');
const p={activities:[{id:'a',description:'First activity',progress:0},{id:'b',description:'Second activity',progress:0},{id:'c',description:'Third activity',progress:0}]};
const make=(relations=[],days=[2,3,1],cal='weekdays')=>{
 const s=S.prepare(p,'2026-11-13');
 s.calendar=cal;s.statusDate='2026-11-12';s.tasks.forEach((t,i)=>t.days=days[i]);
 s.links=relations.map(([from,to,type,lag],i)=>({id:'l'+i,from,to,type,lag}));
 return s;
};
const get=(f,id)=>f.rows.find(r=>r.id===id);
let s=make([['a','b','FS',0],['b','c','FS',0]]),f=S.calculate(p,s,'2026-11-12');
assert.deepEqual(f.rows.map(r=>[r.code,r.plannedStart,r.plannedFinish]),[['A010','2026-11-13','2026-11-16'],['A020','2026-11-17','2026-11-19'],['A030','2026-11-20','2026-11-20']]);
assert.equal(f.finish,'2026-11-20');assert.equal(f.actual,null);
for(const [type,lag,expected] of [
 ['FS',0,['2026-11-17','2026-11-19']],
 ['FS',-1,['2026-11-16','2026-11-18']],
 ['SS',1,['2026-11-16','2026-11-18']],
 ['FF',0,['2026-11-13','2026-11-17']],
 ['FF',2,['2026-11-16','2026-11-18']],
 ['SF',4,['2026-11-16','2026-11-18']]
]){
 const plan=S.calculate(p,make([['a','b',type,lag]]),'2026-11-12');
 const row=get(plan,'b');assert.deepEqual([row.plannedStart,row.plannedFinish],expected,type+' '+lag);
}
assert.equal(get(S.calculate(p,make([['a','b','FS',0]],[2,3,1],'all'),'2026-11-12'),'b').plannedStart,'2026-11-15');
assert.throws(()=>S.networkCheck(p,make([['a','b','FS',0],['b','a','SS',0]])),/loop/);
assert.throws(()=>S.networkCheck(p,make([['a','a','FS',0]])),/relationship/);
assert.throws(()=>S.networkCheck(p,make([['a','b','FS',0],['a','b','FS',5]])),/relationship/);
assert.throws(()=>S.calculate(p,make([],[null,3,1]),'2026-11-12'),/duration.*A010/);
const original=S.makeBaseline(p,s,{id:'base1',name:'Original',now:'2026-11-12T08:00:00Z',weights:[60,30,10]});
s.baselines.push(original);s.baselineId=original.id;
p.activities[0].progress=50;s.tasks[0].actualStart='2026-11-13';s.tasks[0].remaining=2;s.statusDate='2026-11-16';
f=S.calculate(p,s,'2026-11-16');
assert.deepEqual([f.target,f.actual,f.variance,f.coverage],[60,30,-30,100]);
assert.equal(f.finish,'2026-11-24');assert.equal(f.slipDays,4);assert.equal(get(f,'a').forecastStart,'2026-11-13');assert.equal(get(f,'a').forecastFinish,'2026-11-18');
assert.equal(get(f,'b').forecastStart,'2026-11-19');
S.validateReport(f);
const saved=structuredClone(f);
p.activities[0].progress=100;s.tasks[0].actualFinish='2026-11-16';s.tasks[1].days=4;
const revised=S.makeBaseline(p,s,{id:'base2',name:'Revision 1',now:'2026-11-16T08:00:00Z',weights:[60,30,10]});
s.baselines.push(revised);s.baselineId=revised.id;
const next=S.calculate(p,s,'2026-11-16');assert.equal(next.baseline.name,'Revision 1');assert.equal(next.finish,'2026-11-23');assert.equal(next.slipDays,0);
assert.equal(original.finish,'2026-11-20');assert.equal(original.rows[1].days,3);assert.equal(original.links[1].from,'b');
assert.equal(saved.baseline.id,'base1');assert.equal(saved.actual,30);assert.equal(saved.finish,'2026-11-24');
p.activities[1].removedFromOs=true;
const scope=S.calculate(p,s,'2026-11-16');assert.equal(scope.coverage,70);assert.equal(scope.rows.length,2);assert(scope.warnings.some(w=>w.includes('Scope differs')));
p.activities[1].removedFromOs=false;
s.tasks[1].actualStart='2026-11-20';assert.throws(()=>S.calculate(p,s,'2026-11-16'),/after the status date/);s.tasks[1].actualStart='2026-11-16';
s.tasks[1].actualFinish='2026-11-16';assert.throws(()=>S.calculate(p,s,'2026-11-16'),/progress is below/);
s.tasks[1].actualFinish='';p.activities[1].progress=30;s.tasks[0].actualFinish='';p.activities[0].progress=50;
f=S.calculate(p,s,'2026-11-16');assert(f.warnings.some(w=>w.includes('out of logical sequence')));assert.equal(get(f,'b').forecastStart,'2026-11-16');
assert.throws(()=>S.validateSchedule({...s,start:'2026-02-30'}),/calendar date/);
assert.throws(()=>S.validateSchedule({...s,baselineId:'absent'}),/missing/);
console.log('Scheduling checks passed: FS/SS/FF/SF, working days, lag, loop detection, actuals and overrides, original/revised baselines, scope changes, frozen report comparisons and forecast dates.');
// Per-project custom weeks and zero-duration events use the same network boundaries.
const q={draft:{date:'2026-11-17'},activities:[{id:'work',description:'Fitout',progress:0}]},cs=S.prepare(q,'2026-11-16');
cs.calendar='custom';cs.workdays=[2,4];cs.statusDate='2026-11-16';cs.tasks[0].days=3;
cs.wbs=[{id:'phase',name:'Execution',parentId:''},{id:'sub',name:'Ground floor',parentId:'phase'}];cs.tasks[0].wbsId='sub';
cs.milestones=[{id:'handover',code:'M010',name:'Handover',earliest:'',actualFinish:'',wbsId:'phase'}];
cs.links=[{id:'dep',from:'work',to:'handover',type:'FS',lag:0}];q.schedule=cs;
assert.deepEqual(S.wbsRows(cs).map(w=>w.number),['1','1.1']);
let cf=S.calculate(q,cs,'2026-11-16');
assert.deepEqual([get(cf,'work').plannedStart,get(cf,'work').plannedFinish,get(cf,'handover').plannedFinish],['2026-11-17','2026-11-24','2026-11-26']);
assert.equal(get(cf,'handover').days,0);assert.equal(cf.finish,'2026-11-26');
const cb=S.makeBaseline(q,cs,{id:'custom-base',name:'Two-day week',now:'2026-11-15T00:00:00Z',weights:[100]});
assert.deepEqual(cb.workdays,[2,4]);assert.equal(cb.rows[1].weight,0);assert.match(cb.rows[0].wbs,/1\.1 Ground floor/);
cs.baselines.push(cb);cs.baselineId=cb.id;cs.workdays=[1,3,5];cs.statusDate='2026-11-20';q.activities[0].progress=50;
cf=S.calculate(q,cs,'2026-11-20');S.validateReport(cf);
assert.equal(cf.target,66.7,'Baseline keeps the original two-day calendar.');assert.equal(cf.actual,50);assert.equal(cf.finish,'2026-11-27');
const term={scheduleMilestoneId:'handover',amount:500,paid:false};
assert.equal(S.paymentMilestone(q,term).forecast,'2026-11-27');assert.equal(S.paymentMilestone(q,term).achieved,false);
cs.milestones[0].actualFinish='2026-11-19';assert.equal(S.paymentMilestone(q,term).achieved,true);assert.equal(term.paid,false);assert.equal(term.amount,500);
assert.equal(get(S.calculate(q,cs,'2026-11-20'),'handover').actualFinish,'2026-11-19');
cs.enabled=false;assert.equal(S.paymentMilestone(q,term).forecast,'');
assert.throws(()=>S.validateSchedule({...cs,workdays:[]}),/working day/);
assert.throws(()=>S.validateSchedule({...cs,wbs:cs.wbs.map(w=>w.id==='phase'?{...w,parentId:'sub'}:w)}),/parent or nesting/);
const only={activities:[]},onlySchedule=S.prepare(only,'2026-11-16');onlySchedule.milestones=structuredClone(cs.milestones);onlySchedule.milestones[0].actualFinish='';onlySchedule.milestones[0].wbsId='';onlySchedule.statusDate='2026-11-15';
const onlyBase=S.makeBaseline(only,onlySchedule,{id:'only-base',name:'Only event',now:'2026-11-15T00:00:00Z',weights:[]});
onlySchedule.baselines.push(onlyBase);onlySchedule.baselineId=onlyBase.id;
const onlyForecast=S.calculate(only,onlySchedule,'2026-11-15');S.validateReport(onlyForecast);assert.equal(onlyForecast.target,null);assert.equal(onlyForecast.finish,'2026-11-16');
console.log('Custom weeks, nested WBS, zero-day milestones, payment links and milestone-only forecasts passed.');
