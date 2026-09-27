/* Shared A4 pagination for OS quotations/invoices and Bookkeeping invoices. */
(function(){
  const WIDTH=178, HEIGHT=267;
  async function createPdf({source,contentSelector,label,fileName,bookkeeping=false}){
    if(!source)throw new Error('Printable preview not found.');
    if(typeof html2canvas!=='function'||!window.jspdf?.jsPDF)throw new Error('PDF libraries are unavailable. Reload the app and try again.');
    const contents=[...source.querySelectorAll(contentSelector)];
    if(!contents.length)throw new Error('Printable document content not found.');
    const stage=document.createElement('div');
    stage.className=bookkeeping?'ros-bk-pdf-stage ros-pdf-stage':'ros-pdf-stage';
    stage.setAttribute('aria-hidden','true');
    stage.style.cssText='position:absolute!important;top:-100000px!important;left:0!important;width:178mm!important;max-width:178mm!important;padding:0!important;margin:0!important;overflow:visible!important;visibility:visible!important;background:#fff!important;pointer-events:none!important;';
    document.body.appendChild(stage);
    const pages=[];
    function newPage(){
      const page=document.createElement('div');
      page.className='ros-pdf-page';
      page.style.cssText='display:block!important;position:relative!important;width:178mm!important;min-width:178mm!important;max-width:178mm!important;height:267mm!important;min-height:267mm!important;max-height:267mm!important;box-sizing:border-box!important;padding:0!important;margin:0!important;border:0!important;background:#fff!important;color:#142d35!important;font-family:Arial,Helvetica,sans-serif!important;overflow:hidden!important;';
      stage.appendChild(page);pages.push(page);return page;
    }
    let page=newPage();
    function fits(){
      const boundary=page.getBoundingClientRect();
      return page.scrollHeight<=page.clientHeight+1 && page.scrollWidth<=page.clientWidth+1 && [...page.children].every(el=>el.getBoundingClientRect().bottom<=boundary.bottom+1);
    }
    function append(node){
      let copy=node.cloneNode(true);page.appendChild(copy);
      if(!fits()){
        copy.remove();
        if(page.children.length)page=newPage();
        page.appendChild(copy);
        if(!fits())throw new Error('A print section is taller than one A4 page. Shorten or split that section.');
      }
      return copy;
    }
    function textParts(value){return value.match(/\S+\s*|\s+/gu)||[];}
    function continuation(heading){
      const h=heading.cloneNode(true);h.textContent=(heading.textContent||'').trim()+' (vervolg)';
      h.style.marginTop='0';return h;
    }
    // Keep a heading with the first words of its body, then flow the remaining
    // text across pages at its original size. Plain text retains pre-wrap CSS.
    function appendText(body,heading){
      const words=textParts(body.textContent||'');
      let index=0,first=true;
      do{
        const wrap=document.createElement('div');
        if(heading)wrap.appendChild(first?heading.cloneNode(true):continuation(heading));
        const block=body.cloneNode(false);block.textContent='';wrap.appendChild(block);page.appendChild(wrap);
        if(!fits()){
          wrap.remove();
          if(page.children.length)page=newPage();
          page.appendChild(wrap);
        }
        if(!fits())throw new Error('A print heading is too tall for an A4 page.');
        let added=0;
        while(index<words.length){
          const previous=block.textContent;
          block.textContent=previous+words[index];
          if(!fits()){block.textContent=previous;break;}
          index++;added++;
        }
        if(index<words.length){
          if(!added){wrap.remove();if(page.children.length){page=newPage();continue;}throw new Error('A word is too wide for the printable page.');}
          page=newPage();
        }
        first=false;
      }while(index<words.length);
    }
    function addTable(table){
      let active;
      function start(){
        const t=table.cloneNode(false);
        const cols=table.querySelector('colgroup'),head=table.querySelector('thead');
        if(cols)t.appendChild(cols.cloneNode(true));
        if(head)t.appendChild(head.cloneNode(true));
        const body=document.createElement('tbody');t.appendChild(body);page.appendChild(t);
        if(!fits()){t.remove();page=newPage();page.appendChild(t);}
        if(!fits())throw new Error('A table header is too tall for an A4 page.');
        active={t,body};
      }
      start();
      for(const row of table.querySelectorAll('tbody tr')){
        let current=row.cloneNode(true);active.body.appendChild(current);
        if(fits())continue;
        current.remove();
        if(!active.body.children.length)active.t.remove();
        if(page.children.length)page=newPage();
        start();active.body.appendChild(current);
        if(fits())continue;
        current.remove();
        // An unusually long description can itself span pages. Show the amount
        // only on its first segment, so the printed total is not duplicated.
        const cells=[...row.cells],words=textParts(cells[0]?.textContent||'');
        if(!words.length)throw new Error('An invoice row is too tall to print.');
        let at=0,first=true;
        while(at<words.length){
          current=row.cloneNode(true);
          current.cells[0].textContent='';
          if(!first)[...current.cells].slice(1).forEach(cell=>cell.textContent='');
          active.body.appendChild(current);
          let count=0;
          while(at<words.length){
            const prev=current.cells[0].textContent;
            current.cells[0].textContent=prev+words[at];
            if(!fits()){current.cells[0].textContent=prev;break;}
            at++;count++;
          }
          if(!count)throw new Error('An invoice description cannot fit on an A4 page.');
          first=false;
          if(at<words.length){page=newPage();start();}
        }
      }
    }
    function addTerms(terms){
      const whole=terms.cloneNode(true);page.appendChild(whole);
      if(fits())return;
      whole.remove();
      let box=null;
      function start(){box=terms.cloneNode(false);page.appendChild(box);}
      start();
      for(const child of terms.children){
        const item=child.cloneNode(true);box.appendChild(item);
        if(fits())continue;
        item.remove();
        if(!box.children.length)box.remove();
        if(page.children.length)page=newPage();
        start();box.appendChild(item);
        if(!fits()){
          item.remove();box.remove();
          if(child.children.length===0)appendText(child);
          else throw new Error('An invoice payment paragraph is too long to print.');
          start();
        }
      }
      if(box&&!box.children.length)box.remove();
    }
    try{
      for(const content of contents){
        const nodes=[...content.children];
        for(let i=0;i<nodes.length;i++){
          const node=nodes[i];
          if(node.matches('table.ros-quote-table,table.ros-doc-table')){addTable(node);continue;}
          if(node.matches('.ros-invoice-terms')&&node.children.length){addTerms(node);continue;}
          if(node.tagName==='H2'&&nodes[i+1]?.tagName==='H3'){
            const probe=document.createElement('div');
            probe.append(node.cloneNode(true),nodes[i+1].cloneNode(true));
            if(nodes[i+2]?.tagName==='DIV'){
              const sample=nodes[i+2].cloneNode(false);
              sample.textContent=(nodes[i+2].textContent||'').slice(0,100);
              probe.appendChild(sample);
            }
            page.appendChild(probe);
            const room=fits();probe.remove();
            if(!room&&page.children.length)page=newPage();
          }
          if(/^H[1-6]$/.test(node.tagName)&&nodes[i+1]?.tagName==='DIV'&&nodes[i+1].children.length===0){
            appendText(nodes[++i],node);continue;
          }
          if(node.tagName==='DIV'&&node.children.length===0&&node.textContent.trim().length>250){appendText(node);continue;}
          append(node);
        }
      }
      if(!pages.some(p=>p.children.length))throw new Error('Printable document was empty.');
      if(!pages[pages.length-1].children.length){pages.pop();stage.lastElementChild.remove();}
      await Promise.all([...stage.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=img.onerror=resolve;})));
      if(document.fonts?.ready)await document.fonts.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      for(let i=0;i<pages.length;i++){
        page=pages[i];
        if(!fits())throw new Error(`Page ${i+1} overflows the printable area. PDF was not created.`);
        if(i)pdf.addPage('a4','portrait');
        const canvas=await html2canvas(page,{scale:2,backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false,scrollX:0,scrollY:0,width:page.clientWidth,height:page.clientHeight,windowWidth:page.clientWidth,windowHeight:page.clientHeight});
        pdf.addImage(canvas.toDataURL('image/png'),'PNG',16,14,WIDTH,HEIGHT,undefined,'FAST');
        pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(95,105,110);
        pdf.text('Renoweet • Slim en Duurzaam. Voor elke klus.',16,291.5);
        pdf.text(`${label} • Pagina ${i+1} / ${pages.length}`,194,291.5,{align:'right'});
      }
      return new File([pdf.output('blob')],fileName,{type:'application/pdf'});
    }finally{stage.remove();}
  }
  window.RenoweetPrintLayout={createPdf};
})();
