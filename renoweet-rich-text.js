/* Safe, deliberately small Markdown: raw HTML is always escaped. */
(function(){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function inline(value){
    return escape(value).replace(/`([^`\n]+)`/g,'<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
  }
  function render(value){
    const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');let out=[],paragraph=[],list=null;
    const flush=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[];}};
    const close=()=>{if(list){out.push('</'+list+'>');list=null;}};
    for(const line of lines){
      const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/),bullet=line.match(/^\s*[-*+]\s+(.+)$/),number=line.match(/^\s*(\d+)[.)]\s+(.+)$/);
      if(!line.trim()){flush();close();continue;}
      if(heading){flush();close();const level=Math.min(heading[1].length+2,6);out.push(`<h${level}>${inline(heading[2])}</h${level}>`);continue;}
      if(bullet||number){flush();const tag=number?'ol':'ul';if(list!==tag){close();out.push(number?`<ol start="${Number(number[1])}">`:'<ul>');list=tag;}out.push('<li>'+inline(number?number[2]:bullet[1])+'</li>');continue;}
      close();paragraph.push(line);
    }
    flush();close();return out.join('');
  }
  const block=value=>`<div class="renoweet-markdown">${render(value)}</div>`;
  function editor(id,value,minHeight='110px'){
    return `<div class="rw-markdown-editor"><div class="rw-format-tools no-print" role="group" aria-label="Text formatting">${[['bold','Bold'],['italic','Italic'],['heading','Heading'],['bullet','List'],['number','1. List']].map(([kind,label])=>`<button type="button" class="btn" data-rw-format="${kind}" data-rw-target="${escape(id)}">${label}</button>`).join('')}</div><textarea id="${escape(id)}" data-rw-markdown style="min-height:${minHeight}">${escape(value)}</textarea><small>Markdown: **bold**, *italic*, ## heading, - list. Formatting is included in the quotation.</small><details class="no-print"><summary>Formatted preview</summary><div class="renoweet-markdown rw-edit-preview">${render(value)}</div></details></div>`;
  }
  function applyFormat(value,start,end,kind){
    const selected=value.slice(start,end)||'text';let replacement;
    if(kind==='bold'||kind==='italic'){const marker=kind==='bold'?'**':'*';replacement=marker+selected+marker;}
    else {const prefix=kind==='heading'?'## ':kind==='number'?'1. ':'- ';const before=start>0&&value[start-1]!=='\n'?'\n':'';replacement=before+selected.split('\n').map((line,i)=>kind==='number'?`${i+1}. ${line}`:prefix+line).join('\n');}
    return {value:value.slice(0,start)+replacement+value.slice(end),start,end:start+replacement.length};
  }
  if(typeof document!=='undefined'){
    document.addEventListener('click',event=>{const button=event.target.closest('[data-rw-format]');if(!button)return;const field=document.getElementById(button.dataset.rwTarget);if(!field)return;event.preventDefault();const result=applyFormat(field.value,field.selectionStart,field.selectionEnd,button.dataset.rwFormat);field.value=result.value;field.focus();field.setSelectionRange(result.start,result.end);field.dispatchEvent(new Event('input',{bubbles:true}));});
    document.addEventListener('input',event=>{if(!event.target.matches('[data-rw-markdown]'))return;const preview=event.target.closest('.rw-markdown-editor')?.querySelector('.rw-edit-preview');if(preview)preview.innerHTML=render(event.target.value);});
  }
  window.RenoweetText={escape,inline,render,block,editor,applyFormat};
})();
