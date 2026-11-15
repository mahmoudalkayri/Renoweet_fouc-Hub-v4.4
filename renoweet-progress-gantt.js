/* Gantt review and printable appendices from an immutable schedule snapshot. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RenoweetProgressGantt=api;
})(globalThis,function(){
 'use strict';
 const DAY=86400000,ROWS_PER_PAGE=20;
 const palette={baseline:'#7c8793',actual:'#147b66',forecast:'#4279bd',unrecorded:'#b27b32',line:'#dbe4e8',ink:'#17343d',muted:'#496268',status:'#a04067',link:'#526c79'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const day=value=>{const n=Date.parse(value+'T00:00:00Z')/DAY;return Number.isFinite(n)?n:null};
 const dte=n=>new Date(n*DAY);
 const n=x=>Number(x.toFixed(2));
 const seg=(a,b)=>a!==null&&b!==null&&a<=b?[a,b+1]:null;
 const short=(s,max)=>{const a=Array.from(String(s||''));return a.length>max?a.slice(0,max-1).join('')+'…':a.join('')};
 const ordered=rows=>rows.map((r,i)=>({r,i})).sort((a,b)=>{
  const aw=a.r.wbs||'',bw=b.r.wbs||'';
  return Number(!aw)-Number(!bw)||aw.localeCompare(bw,undefined,{numeric:true})||a.r.plannedStart.localeCompare(b.r.plannedStart)||a.i-b.i;
 }).map(({r})=>r);
 const words=(nl)=>nl?{title:'Planning: basis, werkelijk en prognose',activity:'Activiteit',progress:'Gereed',baseline:'Basisplanning',actual:'Werkelijk tot peildatum',forecast:'Resterend / prognose',unknown:'Werkelijke datums ontbreken',status:'Peildatum',milestone:'Mijlpaal',continued:'vervolg'}:{title:'Schedule: baseline, actual and forecast',activity:'Activity',progress:'Done',baseline:'Baseline',actual:'Actual through status date',forecast:'Remaining forecast',unknown:'Actual dates missing',status:'Status date',milestone:'Milestone',continued:'continued'};
 function tracks(r,status){
  const event=r.kind==='milestone',done=r.progress===100,first=day(r.actualStart),last=day(r.actualFinish),forecastEnd=day(r.forecastFinish),planStart=day(r.forecastStart);
  const baseline=seg(day(r.baselineStart),day(r.baselineFinish));
  if(event)return {event,baseline,actual:last!==null?[last,last+1]:null,unknown:null,remaining:last===null?seg(forecastEnd,forecastEnd):null};
  const actual=seg(first,last??(first!==null&&!done?status:null));
  const unknown=first===null&&r.progress>0?seg(planStart,done?forecastEnd:status):done&&last===null?seg(first,forecastEnd):null;
  const remainder=day(r.remainingStart);
  const remaining=!done&&r.remaining>0?seg(remainder??(r.progress>0||first!==null?Math.max(status+1,planStart??status+1):planStart),forecastEnd):null;
  return {event,baseline,actual,unknown,remaining};
 }
 function axis(lo,hi,isNL){
  const span=hi-lo,fmt=(options)=>new Intl.DateTimeFormat(isNL?'nl-NL':'en-GB',{timeZone:'UTC',...options});
  const out=[];
  if(span<=21){
   const step=span>12?2:1,format=fmt({day:'numeric',month:'short'});
   for(let i=lo;i<hi;i+=step)out.push({d:i,label:format.format(dte(i))});
  }else if(span<=96){
   const step=span>49?14:7,format=fmt({day:'numeric',month:'short'});
   let first=lo+((8-dte(lo).getUTCDay())%7);
   if(first-lo>=3)out.push({d:lo,label:format.format(dte(lo))});
   for(let i=first;i<hi;i+=step)out.push({d:i,label:format.format(dte(i))});
  }else{
   const spanMonths=span/30.44,step=spanMonths>54?Math.ceil(spanMonths/12):spanMonths>18?3:spanMonths>11?2:1;
   const format=fmt({month:'short',year:'2-digit'}),a=dte(lo);
   let i=Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1)/DAY;
   while(i<hi){
    const v=dte(i);if(i>=lo)out.push({d:i,label:format.format(v)});
    i=Date.UTC(v.getUTCFullYear(),v.getUTCMonth()+step,1)/DAY;
   }
  }
  return out;
 }
 function model(f){
  const status=day(f.statusDate),all=ordered(f.rows||[]).map(r=>({r,t:tracks(r,status)}));
  const dates=all.flatMap(({t})=>[t.baseline,t.actual,t.unknown,t.remaining].filter(Boolean).flat());
  dates.push(status,status+1);
  const lo=Math.min(...dates),hi=Math.max(lo+1,...dates);
  return {all,status,lo,hi};
 }
 function svg(f,{print=false,isNL=false,offset=0,limit,links=true}={}){
  const m=model(f),L=words(isNL),slice=m.all.slice(offset,limit==null?undefined:offset+limit);
  if(!slice.length)return '';
  const label=print?263:322,edge=18,head=56,rh=print?32:37;
  const width=print?1000:Math.max(1020,label+Math.min(2150,(m.hi-m.lo)*36)),plot=width-label-edge,height=head+rh*slice.length+13;
  const x=d=>label+(d-m.lo)*plot/(m.hi-m.lo),y=i=>head+i*rh;
  const t=(txt,left,top,px=13,attrs='')=>`<text x="${n(left)}" y="${n(top)}" font-size="${px}" ${attrs}>${esc(txt)}</text>`;
  const title=text=>`<title>${esc(text)}</title>`;
  const line=(x1,y1,x2,y2,attrs='')=>`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}/>`;
  function track(span,cy,klass,r,event=false){
   if(!span)return '';
   const start=x(span[0]),end=x(span[1]),w=Math.max(2,end-start),color=palette[klass];
   const detail=(r.code||'')+' · '+L[klass]+' · '+dte(span[0]).toISOString().slice(0,10)+(event?'':' – '+dte(span[1]-1).toISOString().slice(0,10));
   if(event)return `<g data-gantt-track="${klass}">${title(detail)}<path d="M${n(start)},${cy-5} l5,5 -5,5 -5,-5 z" fill="${color}" stroke="#fff" stroke-width="0.8"/></g>`;
   return `<g data-gantt-track="${klass}">${title(detail)}<rect x="${n(start)}" y="${cy-3}" width="${n(w)}" height="6" rx="2" fill="${klass==='unknown'?'#fff3df':color}"${klass==='unknown'?` stroke="${color}" stroke-dasharray="3 2"`:''}/></g>`;
  }
  const labelCell=(code,desc,i)=>`<svg x="9" y="${y(i)}" width="${label-64}" height="${rh}" overflow="hidden">${t(code,0,print?12:14,print?12:13,'font-weight="700"')}${t(desc,0,print?26:29,print?12:13,`fill="${palette.muted}"`)}</svg>`;
  const bands=slice.map((item,i)=>`<rect x="0" y="${y(i)}" width="${width}" height="${rh}" fill="${i%2?'#f4f7f8':'#fff'}"/>`+line(0,y(i)+rh,width,y(i)+rh,`stroke="${palette.line}" stroke-width=".7"`)).join('');
  const ticks=axis(m.lo,m.hi,isNL);let prev=-1e9;
  const grid=ticks.map(({d,label:tick},i)=>{
   const left=x(d);
   const show=left-prev>=(print?57:68)&&width-left>(tick.length*6.8+8);if(show)prev=left;
   return line(left,32,left,height-12,`stroke="${palette.line}" stroke-dasharray="3 3"`)+(show?t(tick,left+4,46,print?13:12,`fill="${palette.muted}"`):'');
  }).join('');
  const lane=(i)=>y(i)+rh-10;
  const index=new Map(slice.map((o,i)=>[o.r.id,{...o,i}]));
  const edges=links?(f.links||[]).filter(l=>index.has(l.from)&&index.has(l.to)).map(l=>{
   const a=index.get(l.from),b=index.get(l.to),point=(o,finish)=>{
    const r=o.r,tp=o.t,span=tp.remaining||tp.actual||tp.unknown;
    if(!span)return null;
    if(tp.event)return x(span[0]);
    if(finish)return x(span[1]);
    const initial=tp.actual||tp.unknown||span;
    return x(initial[0]);
   };
   const x1=point(a,l.type[0]==='F'),x2=point(b,l.type[1]==='F');if(x1===null||x2===null)return '';
   const y1=lane(a.i),y2=lane(b.i),direction=l.type[1]==='F'?-1:1,approach=x2-5*direction,elbow=x1+((l.type[0]==='F')?6:-6);
   const end=Math.max(label-3,Math.min(width-5,approach)),via=Math.max(label-3,Math.min(width-5,elbow));
   const hint=a.r.code+' → '+b.r.code+' · '+l.type+(l.lag?' '+(l.lag>0?'+':'')+l.lag+'d':'');
   return `<g data-gantt-link="${esc(l.type)}">${title(hint)}<path d="M${n(x1)} ${y1} H${n(via)} V${y2} H${n(end)} L${n(x2)} ${y2}" fill="none" stroke="${palette.link}" stroke-width="1.1" opacity=".67"/><path d="M${n(x2)} ${y2} l${-direction*4} -2 v4 z" fill="${palette.link}" opacity=".82"/></g>`;
  }).join(''):'';
  const entries=slice.map(({r,t:tr},i)=>{
   const cy=lane(i),bcy=y(i)+9,desc=short(r.description,print?37:44),details=[r.code,r.description,r.wbs,r.progress+'%'].filter(Boolean).join(' · ');
   const labelText=short(r.code,20)+(tr.event?' · ◇':'')+(r.wbs?' · '+short(r.wbs,print?29:35):'');
   return `<g data-gantt-row="${esc(r.id)}">${title(details)}${labelCell(short(labelText,print?33:43),desc,i)}${t(r.progress.toFixed(0)+'%',label-13,y(i)+(print?24:27),12,'text-anchor="end" font-weight="700"')}${track(tr.baseline,bcy,'baseline',r,tr.event)}${track(tr.actual,cy,'actual',r,tr.event)}${track(tr.unknown,cy,'unknown',r,tr.event)}${track(tr.remaining,cy,'forecast',r,tr.event)}</g>`;
  }).join('');
  const sx=x(m.status+1);
  const guide=line(sx,33,sx,height-11,`stroke="${palette.status}" stroke-width="1.4" stroke-dasharray="5 3"`);
  const statusLabel=t(L.status+': '+f.statusDate,Math.min(width-8,sx+5),30,12,`fill="${palette.status}"${sx>width-174?' text-anchor="end"':''}`);
  const range=dte(m.lo).toISOString().slice(0,10)+' → '+dte(m.hi-1).toISOString().slice(0,10);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="gantt-svg" role="img" aria-label="${esc(L.title)}" style="${print?'display:block;width:100%;height:auto':'display:block;max-width:none'}">${title(L.title)}<rect width="${width}" height="${height}" fill="#fff"/><g font-family="Arial, sans-serif" fill="${palette.ink}"><rect width="${width}" height="${head}" fill="#e9f0f1"/>${bands}${grid}${line(label-8,0,label-8,height-12,`stroke="${palette.line}"`)}${t(L.activity,9,44,14,'font-weight="700"')}${t(L.progress,label-13,44,12,'text-anchor="end" font-weight="700"')}${t(range,label+4,14,11,`fill="${palette.muted}"`)}${edges}${guide}${statusLabel}${entries}</g></svg>`;
 }
 function legend(f,isNL=false){
  const L=words(isNL),items=[...(f.baseline?['baseline']:[]),'actual','forecast','unknown','status','milestone'];
  return `<div class="gantt-legend" aria-label="${isNL?'Legenda':'Legend'}">${items.map(key=>`<span><i style="background:${palette[key]||palette.ink}" class="gantt-key gantt-key-${key}"></i>${esc(L[key])}</span>`).join('')}</div>`;
 }
 function pageCount(f){return Math.ceil(f.rows.length/ROWS_PER_PAGE)}
 return {svg,legend,words,pageCount,ROWS_PER_PAGE,tracks};
});
