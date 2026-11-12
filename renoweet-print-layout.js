/* Shared A4 pagination for OS quotations/invoices and Bookkeeping invoices. */
(function(){
  const WIDTH=178, HEIGHT=267;
  const afterLayout=()=>new Promise(resolve=>{
    const timer=setTimeout(resolve,120);
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve()}));
  });
  async function settleAssets(root){
    const images=[...root.querySelectorAll('img')],listeners=[];
    let timer;
    const wait=images.map(async img=>{
      img.loading='eager';
      if(!img.complete)await new Promise(resolve=>{
        const done=()=>{img.removeEventListener('load',done);img.removeEventListener('error',done);resolve()};
        listeners.push(done);img.addEventListener('load',done);img.addEventListener('error',done);
        if(img.complete)done();
      });
      if(img.naturalWidth&&typeof img.decode==='function')await img.decode().catch(()=>{});
    });
    // Reading layout asks the browser for the fonts used by this actual snapshot.
    root.getBoundingClientRect();
    try{
      await Promise.race([
        Promise.all([...wait,document.fonts?.ready]),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The quotation or invoice images/fonts did not finish loading. Check the connection and try again.')),8000)})
      ]);
    }finally{clearTimeout(timer);listeners.forEach(done=>done())}
    await afterLayout();
  }
  async function createPdf({source,contentSelector,label,fileName,bookkeeping=false}){
    if(!source)throw new Error('Printable preview not found.');
    if(typeof html2canvas!=='function'||!window.jspdf?.jsPDF)throw new Error('PDF libraries are unavailable. Reload the app and try again.');
    const contents=[...source.querySelectorAll(contentSelector)].map(content=>content.cloneNode(true));
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
    let page,reserve=0;
    function fits(target=page,space=reserve){
      const boundary=target.getBoundingClientRect();
      return target.scrollHeight<=target.clientHeight+1 && target.scrollWidth<=target.clientWidth+1 && [...target.children].every(el=>el.getBoundingClientRect().bottom<=boundary.bottom-space+1);
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
      let active,group=null;
      const printedGroups=new Set();
      function start(){
        const t=table.cloneNode(false);
        const cols=table.querySelector('colgroup'),head=table.querySelector('thead');
        if(cols)t.appendChild(cols.cloneNode(true));
        if(head)t.appendChild(head.cloneNode(true));
        const body=document.createElement('tbody');t.appendChild(body);page.appendChild(t);
        if(!fits()){t.remove();page=newPage();page.appendChild(t);}
        if(!fits())throw new Error('A table header is too tall for an A4 page.');
        active={t,body,group:null};
      }
      function place(row){
        const heading=group&&active.group!==group?group.cloneNode(true):null;
        if(heading){
          if(printedGroups.has(group))heading.cells[0].append(' (vervolg)');
          active.body.appendChild(heading);
        }
        active.body.appendChild(row);
        return {
          commit(){active.group=group;if(group)printedGroups.add(group)},
          remove(){row.remove();heading?.remove()}
        };
      }
      start();
      for(const row of table.querySelectorAll('tbody tr')){
        if(row.classList.contains('ros-quote-group')){group=row;continue;}
        if(row.hasAttribute('data-print-ungrouped'))group=null;
        let current=row.cloneNode(true),trial=place(current);
        if(fits()){trial.commit();continue;}
        trial.remove();
        if(!active.body.children.length)active.t.remove();
        if(page.children.length)page=newPage();
        start();trial=place(current);
        if(fits()){trial.commit();continue;}
        trial.remove();
        // An unusually long description can span pages. Charge the line once.
        const words=textParts(row.cells[0]?.textContent||'');
        if(!words.length)throw new Error('A price line is too tall to print.');
        let at=0,first=true;
        while(at<words.length){
          current=row.cloneNode(true);
          current.cells[0].textContent='';
          if(!first)[...current.cells].slice(1).forEach(cell=>cell.textContent='');
          trial=place(current);
          let count=0;
          while(at<words.length){
            const prev=current.cells[0].textContent;
            current.cells[0].textContent=prev+words[at];
            if(!fits()){current.cells[0].textContent=prev;break;}
            at++;count++;
          }
          if(!count)throw new Error('A price line description cannot fit on an A4 page.');
          trial.commit();first=false;
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
    // Split rich text by DOM ranges, preserving bold/italic and every character.
    function addRichBlock(block,heading){
      const copy=block.cloneNode(true),wrap=document.createElement('div');
      if(heading)wrap.appendChild(heading.cloneNode(true));wrap.appendChild(copy);page.appendChild(wrap);
      if(fits())return;
      wrap.remove();if(page.children.length)page=newPage();page.appendChild(wrap);
      if(fits())return;
      wrap.remove();
      const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),leaves=[];let leaf,total=0;
      while((leaf=walker.nextNode())){leaves.push({node:leaf,start:total,end:total+leaf.length});total+=leaf.length;}
      if(!total){append(block);return;}
      function point(offset){const item=leaves.find(item=>offset<item.end)||leaves[leaves.length-1];return [item.node,Math.min(item.node.length,offset-item.start)];}
      const text=block.textContent;let at=0,first=true;
      while(at<total){
        const container=document.createElement('div');
        if(heading)container.appendChild(first?heading.cloneNode(true):continuation(heading));
        const piece=block.cloneNode(false);container.appendChild(piece);page.appendChild(container);
        function fill(end){const range=document.createRange(),a=point(at),b=point(end);range.setStart(...a);range.setEnd(...b);piece.replaceChildren(range.cloneContents());}
        let low=at,high=total;
        while(low<high){const mid=Math.ceil((low+high)/2);fill(mid);if(fits())low=mid;else high=mid-1;}
        if(low===at)throw new Error('A formatted print paragraph cannot fit on A4.');
        let end=low;
        if(end<total){const space=text.lastIndexOf(' ',end-1);if(space>at)end=space+1;}
        fill(end);at=end;first=false;if(at<total)page=newPage();
      }
    }
    function addMarkdown(node,heading){
      const children=[...node.children];
      if(!children.length){if(heading)append(heading);return;}
      for(let at=0;at<children.length;at++){
        const child=children[at];let h=at===0?heading:null;
        if(/^H[1-6]$/.test(child.tagName)&&children[at+1]){
          if(h)append(h);h=child;at++;const holder=node.cloneNode(false);holder.appendChild(children[at].cloneNode(true));addRichBlock(holder,h);continue;
        }
        const holder=node.cloneNode(false);holder.appendChild(child.cloneNode(true));addRichBlock(holder,h);
      }
    }
    function addPhotos(node,heading){
      if(page.children.length)page=newPage();
      if(heading)append(heading);
      const figures=[...node.children];
      for(let at=0;at<figures.length;at+=2){
        const row=node.cloneNode(false);row.style.gridTemplateColumns='1fr 1fr';row.style.marginBottom='6mm';row.append(...figures.slice(at,at+2).map(item=>item.cloneNode(true)));page.appendChild(row);
        if(fits())continue;
        row.remove();if(page.children.length)page=newPage();page.appendChild(row);
        if(fits())continue;
        row.remove();
        // Exceptional long captions use their own flowing description pages.
        for(const figure of figures.slice(at,at+2)){
          const single=node.cloneNode(false);single.style.gridTemplateColumns='1fr';const photo=figure.cloneNode(true),caption=photo.querySelector('figcaption');caption?.remove();single.appendChild(photo);append(single);
          if(caption){const body=document.createElement('div');body.className='renoweet-markdown';body.style.whiteSpace='pre-wrap';body.appendChild(caption.cloneNode(true));addRichBlock(body);}
          if(page.children.length)page=newPage();
        }
      }
    }
    function paginate(){
      stage.replaceChildren();pages.length=0;page=newPage();
      for(const content of contents){
        const nodes=[...content.children];
        for(let i=0;i<nodes.length;i++){
          const node=nodes[i];
          if(/^H[1-6]$/.test(node.tagName)&&nodes[i+1]?.matches('.ros-scope-photos')){addPhotos(nodes[++i],node);continue;}
          if(node.matches('.ros-scope-photos')){addPhotos(node);continue;}
          if(/^H[1-6]$/.test(node.tagName)&&nodes[i+1]?.matches('.renoweet-markdown')){addMarkdown(nodes[++i],node);continue;}
          if(node.matches('.renoweet-markdown')){addMarkdown(node);continue;}
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
    }
    try{
      // Warm the actual offscreen markup before making any page-break decisions.
      // This matters when Send has just rebuilt the preview, especially with photos.
      page=newPage();page.append(...contents);
      await settleAssets(stage);
      let overflow=-1;
      for(const slack of [6,14,26]){
        reserve=slack;paginate();
        await settleAssets(stage);
        overflow=pages.findIndex(candidate=>!fits(candidate,0));
        if(overflow<0)break;
      }
      if(overflow>=0){const i=overflow;throw new Error(`Page ${i+1} overflows the printable area after reflow. PDF was not created.`);}
      const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      for(let i=0;i<pages.length;i++){
        page=pages[i];
        if(!fits(page,0))throw new Error(`Page ${i+1} overflows the printable area. PDF was not created.`);
        if(i)pdf.addPage('a4','portrait');
        const canvas=await html2canvas(page,{scale:2,backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false,scrollX:0,scrollY:0,width:page.clientWidth,height:page.clientHeight,windowWidth:window.innerWidth||page.clientWidth,windowHeight:window.innerHeight||page.clientHeight});
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
