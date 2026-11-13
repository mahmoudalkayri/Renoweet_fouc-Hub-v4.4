/* Stable display order for quotation groups and their progress-report references. */
(function(root){
 'use strict';
 const name=value=>String(value??'').trim().replace(/\s+/g,' ').slice(0,100);
 function sections(lines=[]){
  const result=[],grouped=new Map(),numbered=lines.some(line=>name(line.group));
  for(const line of lines){
   const label=name(line.group),key=label.toLowerCase();
   if(!key){result.push({name:'',lines:[line]});continue}
   if(!grouped.has(key)){const section={name:label,lines:[]};grouped.set(key,section);result.push(section)}
   grouped.get(key).lines.push(line);
  }
  return result.map((section,i)=>({...section,number:numbered?String(i+1):'',items:section.lines.map((line,j)=>({line,code:section.name?`${i+1}.${j+1}`:numbered?String(i+1):String(i+1).padStart(2,'0')}))}));
 }
 function description(value,group){
  const text=String(value??''),colon=text.indexOf(':'),body=colon>=0?text.slice(colon+1).trimStart():'';
  return group&&body&&name(text.slice(0,colon)).toLowerCase()===name(group).toLowerCase()?body:text;
 }
 root.RenoweetEstimateOutline={name,sections,description};
})(globalThis);
