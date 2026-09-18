(() => {
  'use strict';

  const LANG_KEY = 'renoweet-language';
  const DB_NAME = 'renoweet-project-portal';
  const MAX_PHOTOS = 10;

  const I18N = {
    nl: {
      projectPortal:'Projectnotitieboek', account:'Account', dataManagement:'Gegevens', projects:'Projecten', projectsCopy:'Open een werkopname of maak een nieuw project.', newProject:'Nieuw project', openOs:'Open OS',
      localMode:'Lokale database + OS-koppeling', localModeCopy:'Projecten blijven op dit apparaat. Een nieuw project wordt automatisch aan Renoweet OS toegevoegd en synchroniseert zodra OS met Drive is verbonden.', exportJson:'JSON exporteren', importJson:'JSON importeren',
      searchProjects:'Zoek op klant, adres of project', allStatuses:'Alle statussen', statusLead:'Aanvraag', statusInspection:'Opname', statusQuote:'Offerte', statusActive:'In uitvoering', statusDone:'Afgerond',
      email:'E-mailadres',
      saved:'Opgeslagen', saving:'Opslaan…', saveError:'Opslaan mislukt', printBlank:'Blanco formulier', printReport:'Rapport / PDF', inspectionReport:'Werkopname & scopebevestiging',
      projectTitlePlaceholder:'Projectnaam', address:'Adres', projectStatus:'Projectstatus', details:'Project', customerInput:'Klantinput vóór de opname', scope:'Scope en afbakening', checks:'Vooronderzoek', notes:'Opnamenotities', measurements:'Maten en besluiten', photos:"Foto's", approval:'Bevestiging',
      projectDetails:'Project- en klantgegevens', projectDetailsCopy:'Basisgegevens voor de werkopname en opvolging.', clientName:'Klantnaam', phone:'Telefoon', visitDate:'Datum opname', desiredStart:'Gewenste start', surveyor:'Opnemer / aannemer',
      customerInputCopy:'Bewaar de oorspronkelijke aanvraag, wensen en aangeleverde beelden bij het project.', customerComments:'Bericht / opmerkingen van klant', customerCommentsPlaceholder:'Plak hier het bericht dat de klant vooraf heeft gestuurd…', intakeSummary:'Samenvatting en vragen voor bezoek', intakeSummaryPlaceholder:'Belangrijkste wensen, ontbrekende informatie en punten om te controleren…', addCustomerFiles:"Foto's / tekeningen toevoegen", uploadHint:"Maximaal 10 foto's per project. Bij overschrijding wordt na waarschuwing de oudste verwijderd.", customerFiles:'Aangeleverde bestanden / tekeningen',
      scopeCopy:'Bevestig ieder onderdeel en leg afwijkingen of uitsluitingen vast.', addScope:'Onderdeel', checksCopy:'Controlepunten vóór offerte en uitvoering.', constraints:'Aanvullende randvoorwaarden / documenten', notesCopy:'Bestaande toestand, uitvoeringskeuze en afwerking.', measurementsCopy:'Leg meetpunten en afspraken vast voor offerte en uitvoering.', row:'Regel', position:'Ruimte / positie', item:'Onderdeel', measure:'Maat / hoogte', decision:'Besluit / actie',
      sitePhotos:'Fotologboek op locatie', sitePhotosCopy:"Maak foto's en noteer direct wat zichtbaar is en welke actie nodig is.", takePhoto:'Foto maken', choosePhotos:'Uit bibliotheek', photoNotes:'Foto- en observatienotities',
      followUp:'Openstaande punten en vervolg', followUpCopy:'Niet-bevestigde scopepunten worden automatisch samengevat.', clientActions:'Acties klant', contractorActions:'Acties Renoweet / vakpartners', quoteBasis:'Offerte-uitgangspunten en stelposten', planning:'Voorgestelde planning',
      approvalCopy:'Dit legt de besproken uitgangspunten vast en is geen definitieve prijsopgave of uitvoeringsopdracht.', confirmationText:'Scope, uitsluitingen, openstaande punten en notities zijn gezamenlijk doorgenomen. Wijzigingen worden vóór uitvoering schriftelijk bevestigd.', client:'Klant', name:'Naam', clear:'Wissen', confirmationDate:'Datum bevestiging', quoteDue:'Offerte uiterlijk', targetCompletion:'Beoogde oplevering',
      projectName:'Projectnaam', projectNameExample:'Bijv. verbouwing appartement', cancel:'Annuleren', createProject:'Project maken',
      open:'Openen', duplicate:'Dupliceren', delete:'Verwijderen', deleteConfirm:'Dit notitieboek en alle foto’s definitief verwijderen? Het gekoppelde OS-project blijft behouden.', updated:'Bijgewerkt', start:'Start', noProjects:'Nog geen projecten', noProjectsCopy:'Maak uw eerste project voor een werkopname.',
      local:'Lokaal + OS', offline:'Niet opgeslagen', dataLocalCopy:'Het notitieboek en de foto’s blijven in deze browser. Nieuwe projecten worden ook in de lokale OS-veiligheidsdatabase geplaatst. Exporteer regelmatig een JSON-back-up.',
      toConfirm:'Te bevestigen', agreed:'Akkoord', change:'Wijzigen', notApplicable:'Niet van toepassing', scopeTitle:'Onderdeel', scopeDescription:'Omschrijving / resultaat', scopeAgreement:'Afspraken, afwijkingen of uitsluitingen…', remove:'Verwijderen',
      noPhotos:'Nog geen afbeeldingen toegevoegd.', photoComment:'Wat is zichtbaar en welke actie is nodig?', general:'Algemeen', demolition:'Sloop / wanden', electrical:'Elektra', heating:'CV / verwarming', plumbing:'Water / afvoer', kitchen:'Keuken', finish:'Afwerking', logistics:'Logistiek', drawing:'Tekening',
      projectCreated:'Project aangemaakt en toegevoegd aan OS', projectLinkPending:'Project opgeslagen; OS-koppeling wacht op herstel', projectDuplicated:'Project gedupliceerd en toegevoegd aan OS', projectDeleted:'Projectnotitieboek verwijderd; het OS-project blijft behouden', photosSaved:"Foto's opgeslagen", photoDeleted:'Foto verwijderd', photoDeleteConfirm:'Deze foto definitief verwijderen?', localError:'Lokale opslag is niet beschikbaar.', exportDone:'JSON-back-up gedownload.', importDone:'JSON-back-up geïmporteerd.', importError:'Dit JSON-bestand is ongeldig.', importConfirm:'Projecten uit dit bestand samenvoegen met de lokale database?', importPhotoTrimWarning:'De back-up bevat meer dan 10 foto’s voor één of meer projecten. {count} oudste foto(’s) worden verwijderd.', photoLimitWarning:'Door deze foto’s toe te voegen worden {count} oudste foto(’s) uit dit project verwijderd. Doorgaan?',
      allScopeDone:'Alle scopepunten zijn akkoord of niet van toepassing.', blankPrintTitle:'Blanco opnameformulier', category:'Categorie', reportLanguage:'Rapporttaal'
    },
    en: {
      projectPortal:'Project notebook', account:'Account', dataManagement:'Data', projects:'Projects', projectsCopy:'Open a site survey or create a new project.', newProject:'New project', openOs:'Open OS',
      localMode:'Local database + OS link', localModeCopy:'Projects stay on this device. Every new project is added to Renoweet OS automatically and syncs when OS connects to Drive.', exportJson:'Export JSON', importJson:'Import JSON',
      searchProjects:'Search client, address or project', allStatuses:'All statuses', statusLead:'Enquiry', statusInspection:'Survey', statusQuote:'Quotation', statusActive:'In progress', statusDone:'Completed',
      email:'Email address',
      saved:'Saved', saving:'Saving…', saveError:'Save failed', printBlank:'Blank paper form', printReport:'Report / PDF', inspectionReport:'Site survey & scope confirmation',
      projectTitlePlaceholder:'Project name', address:'Address', projectStatus:'Project status', details:'Project', customerInput:'Customer input before visit', scope:'Scope and boundaries', checks:'Pre-work checks', notes:'Survey notes', measurements:'Measurements & decisions', photos:'Photos', approval:'Confirmation',
      projectDetails:'Project and customer details', projectDetailsCopy:'Core details for the site survey and follow-up.', clientName:'Customer name', phone:'Phone', visitDate:'Survey date', desiredStart:'Desired start', surveyor:'Surveyor / contractor',
      customerInputCopy:'Keep the original request, requirements and supplied images with the project.', customerComments:'Customer message / comments', customerCommentsPlaceholder:'Paste the message the customer sent before the visit…', intakeSummary:'Summary and questions for the visit', intakeSummaryPlaceholder:'Key wishes, missing information and points to verify…', addCustomerFiles:'Add photos / drawings', uploadHint:'Maximum 10 photos per project. If exceeded, the oldest will be deleted after a warning.', customerFiles:'Customer-supplied files / drawings',
      scopeCopy:'Confirm each item and record deviations or exclusions.', addScope:'Scope item', checksCopy:'Checks to complete before quotation and execution.', constraints:'Additional constraints / documents', notesCopy:'Existing condition, execution choices and finishes.', measurementsCopy:'Record measurement points and decisions for quotation and execution.', row:'Row', position:'Room / position', item:'Item', measure:'Size / height', decision:'Decision / action',
      sitePhotos:'On-site photo log', sitePhotosCopy:'Take photos and note what is visible and which action is needed.', takePhoto:'Take photo', choosePhotos:'Choose photos', photoNotes:'Photo and observation notes',
      followUp:'Open items and follow-up', followUpCopy:'Unconfirmed scope items are summarised automatically.', clientActions:'Customer actions', contractorActions:'Renoweet / trade partner actions', quoteBasis:'Quotation assumptions and allowances', planning:'Proposed programme',
      approvalCopy:'This records the discussed assumptions and is not a final quotation or instruction to proceed.', confirmationText:'The scope, exclusions, open items and notes above have been reviewed together. Changes will be confirmed in writing before execution.', client:'Customer', name:'Name', clear:'Clear', confirmationDate:'Confirmation date', quoteDue:'Quotation due', targetCompletion:'Target completion',
      projectName:'Project name', projectNameExample:'E.g. apartment renovation', cancel:'Cancel', createProject:'Create project',
      open:'Open', duplicate:'Duplicate', delete:'Delete', deleteConfirm:'Permanently delete this notebook and all photos? The linked OS project will remain.', updated:'Updated', start:'Start', noProjects:'No projects yet', noProjectsCopy:'Create your first site-survey project.',
      local:'Local + OS', offline:'Not saved', dataLocalCopy:'The notebook and photos stay in this browser. New projects are also written to the local OS safety database. Export a JSON backup regularly.',
      toConfirm:'To confirm', agreed:'Agreed', change:'Change', notApplicable:'Not applicable', scopeTitle:'Scope item', scopeDescription:'Description / required result', scopeAgreement:'Agreements, deviations or exclusions…', remove:'Remove',
      noPhotos:'No images added yet.', photoComment:'What is visible and which action is needed?', general:'General', demolition:'Demolition / walls', electrical:'Electrical', heating:'Heating', plumbing:'Water / drainage', kitchen:'Kitchen', finish:'Finishes', logistics:'Logistics', drawing:'Drawing',
      projectCreated:'Project created and added to OS', projectLinkPending:'Project saved; OS linking is waiting to recover', projectDuplicated:'Project duplicated and added to OS', projectDeleted:'Project notebook deleted; the OS project remains', photosSaved:'Photos saved', photoDeleted:'Photo deleted', photoDeleteConfirm:'Permanently delete this photo?', localError:'Local storage is unavailable.', exportDone:'JSON backup downloaded.', importDone:'JSON backup imported.', importError:'This JSON file is invalid.', importConfirm:'Merge the projects in this file into the local database?', importPhotoTrimWarning:'The backup contains more than 10 photos for one or more projects. The {count} oldest photo(s) will be removed.', photoLimitWarning:'Adding these photos will delete the {count} oldest photo(s) in this project. Continue?',
      allScopeDone:'All scope items are agreed or not applicable.', blankPrintTitle:'Blank site survey form', category:'Category', reportLanguage:'Report language'
    }
  };

  const CHECK_DEFS = [
    ['structure','Constructieve status wanden','Structural status of walls','Vaststellen of te wijzigen wanden niet-dragend zijn.','Confirm whether altered walls are non-loadbearing.'],
    ['permission','VvE / vergunning / huisregels','HOA / permits / building rules','Toestemming, werktijden, toegang en afvalregels controleren.','Check permissions, working hours, access and waste rules.'],
    ['asbestos','Asbest en bouwjaar','Asbestos and building age','Risico vóór sloop inventariseren.','Assess risk before demolition.'],
    ['utilities','Bestaande installaties','Existing services','Leidingroutes, afsluiters, meterkast en capaciteit opnemen.','Record service routes, isolators, consumer unit and capacity.'],
    ['drawings','Definitieve tekeningen / maatvoering','Final drawings / dimensions','Uitvoeringsinformatie en aansluitmaten bevestigen.','Confirm execution information and connection dimensions.'],
    ['finishes','Herstel en afwerking','Making good and finishes','Wand-, vloer- en plafondherstel expliciet afbakenen.','Define wall, floor and ceiling making-good.'],
    ['access','Logistiek en bescherming','Logistics and protection','Parkeren, lift/trap, opslag en bescherming opnemen.','Record parking, lift/stairs, storage and protection.'],
    ['safety','Veiligheid en keuringen','Safety and inspections','Benodigde vakmensen, metingen en opleverkeuringen bepalen.','Identify trades, tests and completion inspections.']
  ];
  const DISCIPLINES = [
    ['build','Bouwkundig & sloop','Building & demolition'],['walls','Nieuwe wanden & timmerwerk','New walls & carpentry'],['electrical','Elektra','Electrical'],['plumbing','Water & afvoer','Water & drainage'],['heating','CV / verwarming / ventilatie','Heating / ventilation'],['kitchen','Keuken / sanitair voorbereiding','Kitchen / sanitary preparation'],['finishes','Afwerking','Finishes'],['logistics','Logistiek, planning & oplevering','Logistics, programme & completion']
  ];
  const PHOTO_CATEGORIES = ['general','drawing','demolition','electrical','heating','plumbing','kitchen','finish','logistics'];
  const STATUS_LABELS = { lead:'statusLead', inspection:'statusInspection', quote:'statusQuote', active:'statusActive', done:'statusDone' };
  const SCOPE_STATUS_LABELS = { confirm:'toConfirm', agreed:'agreed', change:'change', na:'notApplicable' };

  const state = { lang: localStorage.getItem(LANG_KEY) || 'nl', store: null, projects: [], current: null, photos: [], dirtyTimer: null, suppress: false };
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const t = key => I18N[state.lang]?.[key] || I18N.nl[key] || key;
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = value => value ? new Intl.DateTimeFormat(state.lang === 'nl' ? 'nl-NL' : 'en-GB',{dateStyle:'medium'}).format(new Date(value)) : '—';

  function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(el._timer); el._timer=setTimeout(()=>el.classList.remove('show'),2300); }
  function setSync(mode, text) { const pill=$('#syncPill'); pill.className=`sync-pill ${mode||''}`; $('#syncText').textContent=text; }
  function showView(id) { ['dashboardView','editorView'].forEach(v => $('#'+v).classList.toggle('hidden', v!==id)); window.scrollTo(0,0); }

  function applyI18n() {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    $$('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
    $$('[data-lang]').forEach(el => el.classList.toggle('active', el.dataset.lang===state.lang));
    if (state.current) renderEditorDynamic();
    else if (!$('#dashboardView').classList.contains('hidden')) renderProjects();
  }

  function defaultScopes() {
    const nl=[
      ['Sloopwerk','Te verwijderen onderdelen, sloopgrenzen, bescherming en afvoer bevestigen.'],
      ['Wanden, deuren & timmerwerk','Nieuwe wanden, openingen, deuren, opbouw en akoestische eisen bevestigen.'],
      ['Elektrische installatie','Groepenkast, groepen, WCD’s, schakelaars, verlichting en keuringen bevestigen.'],
      ['Water, afvoer & verwarming','Bestaande routes, nieuwe aansluitpunten, omleggingen en testen bevestigen.'],
      ['Keuken- / badkamer­voorbereiding','Definitieve tekeningen, vermogens en aansluitmaten bevestigen.'],
      ['Herstel & afwerking','Stucwerk, vloer, plafond, plinten, schilderwerk en eindafwerking afbakenen.'],
      ['Uitsluitingen & werk door klant','Werk, materialen en montage buiten de offerte vastleggen.'],
      ['Planning, toegang & coördinatie','Start, doorlooptijd, toegang, werktijden en vakpartners bevestigen.']
    ];
    const en=[
      ['Demolition','Confirm elements to remove, boundaries, protection and disposal.'],
      ['Walls, doors & carpentry','Confirm new partitions, openings, doors, build-up and acoustic requirements.'],
      ['Electrical installation','Confirm consumer unit, circuits, sockets, switches, lighting and test requirements.'],
      ['Water, drainage & heating','Confirm existing routes, new connection points, rerouting and testing.'],
      ['Kitchen / bathroom preparation','Confirm final installation drawings, appliance loads and connection dimensions.'],
      ['Making good & finishes','Define plastering, flooring, ceilings, skirting, painting and final finish.'],
      ['Exclusions & customer-supplied work','Record work, materials and installations outside the quotation.'],
      ['Programme, access & coordination','Confirm desired start, duration, access, working hours and trade coordination.']
    ];
    return (state.lang==='nl'?nl:en).map(([title,description]) => ({id:uid(),title,description,status:'confirm',note:''}));
  }

  function blankProject(seed={}) {
    const now=new Date().toISOString();
    return {
      id: uid(), osProjectId: window.RenoweetOSProjectBridge?.createOsProjectId?.() || '', title:'', clientName:'', clientEmail:'', clientPhone:'', address:'', visitDate:'', desiredStart:'', surveyor:'', status:'lead',
      customerComments:'', intakeSummary:'', constraints:'', clientActions:'', contractorActions:'', quoteBasis:'', planning:'', scopeConfirmed:false,
      clientSignName:'', contractorSignName:'', approvalDate:'', quoteDate:'', targetFinish:'', signatures:{clientSignature:'',contractorSignature:''},
      scopes: defaultScopes(), checks:Object.fromEntries(CHECK_DEFS.map(d=>[d[0],false])), notes:Object.fromEntries(DISCIPLINES.map(d=>[d[0],'' ])), measurements:[{id:uid(),position:'',item:'',measure:'',decision:''},{id:uid(),position:'',item:'',measure:'',decision:''},{id:uid(),position:'',item:'',measure:'',decision:''}],
      createdAt:now, updatedAt:now, ...seed
    };
  }

  function openDb() {
    return new Promise((resolve,reject)=>{ const r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains('projects')) db.createObjectStore('projects',{keyPath:'id'}); if(!db.objectStoreNames.contains('photos')) { const s=db.createObjectStore('photos',{keyPath:'id'}); s.createIndex('projectId','projectId'); } }; r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  }
  async function idb(storeName,mode,fn) { const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(storeName,mode); const store=tx.objectStore(storeName); let request; try{request=fn(store);}catch(e){reject(e);return;} tx.oncomplete=()=>resolve(request?.result); tx.onerror=()=>reject(tx.error); }); }
  class LocalStore {
    async listProjects(){ return (await idb('projects','readonly',s=>s.getAll())).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))); }
    async saveProject(p){ p.updatedAt=new Date().toISOString(); await idb('projects','readwrite',s=>s.put(structuredClone(p))); return p; }
    async deleteProject(id){ await idb('projects','readwrite',s=>s.delete(id)); const db=await openDb(); await new Promise((resolve,reject)=>{ const tx=db.transaction('photos','readwrite'); const idx=tx.objectStore('photos').index('projectId'); const r=idx.openCursor(IDBKeyRange.only(id)); r.onsuccess=()=>{const c=r.result;if(c){c.delete();c.continue();}}; tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); }); }
    async listPhotos(projectId){ return (await idb('photos','readonly',s=>s.index('projectId').getAll(projectId))).map(p=>({...p,url:p.dataUrl})); }
    async addPhoto(projectId,file,phase){ const {dataUrl}=await compressImage(file); const stored={id:uid(),projectId,phase,category:phase==='previsit'?'drawing':'general',comment:'',createdAt:new Date().toISOString(),dataUrl}; await idb('photos','readwrite',s=>s.put(stored)); return {...stored,url:dataUrl}; }
    async updatePhoto(photo){ const stored={...photo,dataUrl:photo.dataUrl||photo.url}; delete stored.url; await idb('photos','readwrite',s=>s.put(stored)); }
    async deletePhoto(photo){ await idb('photos','readwrite',s=>s.delete(photo.id)); }
    async exportData(){ const photos=(await idb('photos','readonly',s=>s.getAll())).map(photo=>{const clean={...photo};delete clean.url;return clean;});return {format:'renoweet-local-database',version:1,exportedAt:new Date().toISOString(),projects:await idb('projects','readonly',s=>s.getAll()),photos}; }
    async importData(payload){
      const db=await openDb();
      await new Promise((resolve,reject)=>{ const tx=db.transaction(['projects','photos'],'readwrite'),projects=tx.objectStore('projects'),photos=tx.objectStore('photos'); for(const project of payload.projects)projects.put(project); for(const photo of payload.photos){const clean={...photo};delete clean.url;photos.put(clean);} tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error); });
    }
  }

  async function compressImage(file){ const source=await fileToDataUrl(file); const img=await loadImage(source); const max=1800, scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(img.naturalHeight*scale)); canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image conversion failed')),'image/jpeg',.82)); const dataUrl=await fileToDataUrl(blob); return {blob,dataUrl}; }
  function fileToDataUrl(file){ return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);}); }
  function loadImage(src){ return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;}); }

  async function loadDashboard(){ showView('dashboardView'); setSync('',t('local')); try{ state.projects=await state.store.listProjects(); renderProjects(); }catch(e){ setSync('error',t('offline')); toast(t('localError')); } }
  function renderProjects(){
    const query=$('#projectSearch').value.trim().toLowerCase(), filter=$('#statusFilter').value;
    const projects=state.projects.filter(p=>(!filter||p.status===filter)&&(!query||[p.title,p.clientName,p.address].join(' ').toLowerCase().includes(query)));
    const list=$('#projectList');
    if(!projects.length){ list.innerHTML=`<div class="empty-state"><h2>${esc(t('noProjects'))}</h2><p>${esc(t('noProjectsCopy'))}</p><button class="btn btn-primary" id="emptyNewProjectBtn" type="button">${esc(t('newProject'))}</button></div>`; return; }
    list.innerHTML=projects.map(p=>`<article class="project-card" data-status="${esc(p.status)}" data-project-id="${esc(p.id)}"><div class="project-card-bar"></div><div class="project-card-body"><span class="status-badge">${esc(t(STATUS_LABELS[p.status]||'statusLead'))}</span><h2>${esc(p.title||t('projectTitlePlaceholder'))}</h2><div class="address">${esc(p.address||'—')}</div><div class="project-meta"><span>${esc(t('clientName'))}<strong>${esc(p.clientName||'—')}</strong></span><span>${esc(t('updated'))}<strong>${esc(formatDate(p.updatedAt))}</strong></span></div></div><div class="project-card-actions"><button class="btn btn-primary open-project" type="button">${esc(t('open'))}</button><button class="btn btn-outline duplicate-project" type="button" title="${esc(t('duplicate'))}">⧉</button><button class="btn btn-danger delete-project" type="button" title="${esc(t('delete'))}">×</button></div></article>`).join('');
  }

  async function openProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; state.current=structuredClone(p); state.photos=[]; showView('editorView'); bindProjectFields(); renderEditorDynamic(); restoreSignatures(); $('#toolbarProjectTitle').textContent=state.current.title; $('#footerProject').textContent=[state.current.clientName,state.current.address].filter(Boolean).join(' · '); setSync('',t('local')); try{state.photos=await state.store.listPhotos(id);renderPhotos();}catch{toast(t('localError'));} }
  function bindProjectFields(){ $$('[data-field]').forEach(el=>{ const key=el.dataset.field, value=state.current[key]; if(el.type==='checkbox') el.checked=Boolean(value); else el.value=value??''; }); }
  function renderEditorDynamic(){ if(!state.current)return; renderScopes();renderChecks();renderNotes();renderMeasurements();renderPhotos();renderOpenItems(); $('#toolbarProjectTitle').textContent=state.current.title; }

  function renderScopes(){ const list=$('#scopeList'); list.innerHTML=state.current.scopes.map((s,i)=>`<article class="scope-card" data-scope-index="${i}" data-status="${esc(s.status)}"><div class="scope-index">${i+1}</div><div class="scope-copy"><input class="scope-title" data-scope-field="title" value="${esc(s.title)}" aria-label="${esc(t('scopeTitle'))}"><textarea data-scope-field="description" aria-label="${esc(t('scopeDescription'))}">${esc(s.description)}</textarea></div><div class="scope-side"><select class="scope-status" data-scope-field="status" aria-label="Status">${Object.entries(SCOPE_STATUS_LABELS).map(([v,k])=>`<option value="${v}"${s.status===v?' selected':''}>${esc(t(k))}</option>`).join('')}</select><button class="btn btn-danger btn-small no-print remove-scope" type="button">${esc(t('remove'))}</button></div><textarea class="scope-note" data-scope-field="note" placeholder="${esc(t('scopeAgreement'))}" data-paper-clear>${esc(s.note||'')}</textarea></article>`).join(''); }
  function renderChecks(){ $('#checkList').innerHTML=CHECK_DEFS.map(d=>`<label class="check-card"><input type="checkbox" data-check="${d[0]}" ${state.current.checks?.[d[0]]?'checked':''} data-paper-clear><span><strong>${esc(state.lang==='nl'?d[1]:d[2])}</strong><span>${esc(state.lang==='nl'?d[3]:d[4])}</span></span></label>`).join(''); }
  function renderNotes(){ $('#disciplineNotes').innerHTML=DISCIPLINES.map(d=>`<div class="note-card"><h3>${esc(state.lang==='nl'?d[1]:d[2])}</h3><textarea data-note="${d[0]}" data-paper-clear>${esc(state.current.notes?.[d[0]]||'')}</textarea></div>`).join(''); }
  function renderMeasurements(){ $('#measureBody').innerHTML=state.current.measurements.map((m,i)=>`<tr data-measure-index="${i}"><td><input data-measure="position" value="${esc(m.position)}" data-paper-clear></td><td><input data-measure="item" value="${esc(m.item)}" data-paper-clear></td><td><input data-measure="measure" value="${esc(m.measure)}" data-paper-clear></td><td><input data-measure="decision" value="${esc(m.decision)}" data-paper-clear></td><td class="row-delete no-print"><button class="btn btn-danger btn-small remove-measure" type="button">×</button></td></tr>`).join(''); }
  function renderPhotos(){ if(!state.current)return; $$('.photo-limit-indicator').forEach(el=>el.textContent=`${state.photos.length} / ${MAX_PHOTOS}`);renderPhotoPhase('previsit',$('#previsitPhotos'));renderPhotoPhase('site',$('#sitePhotos')); }
  function renderPhotoPhase(phase,holder){ const photos=state.photos.filter(p=>p.phase===phase); if(!photos.length){holder.innerHTML=`<div class="photo-empty">${esc(t('noPhotos'))}</div>`;return;} holder.innerHTML=photos.map((p,i)=>`<article class="photo-card" data-photo-id="${esc(p.id)}"><img src="${esc(p.url)}" alt="Photo ${i+1}"><div class="photo-body"><div class="photo-date">${esc(formatDate(p.createdAt))}</div><select data-photo-category>${PHOTO_CATEGORIES.map(c=>`<option value="${c}"${p.category===c?' selected':''}>${esc(t(c))}</option>`).join('')}</select><textarea data-photo-comment placeholder="${esc(t('photoComment'))}">${esc(p.comment||'')}</textarea><div class="photo-actions no-print"><button class="btn btn-danger btn-small delete-photo" type="button">${esc(t('delete'))}</button></div></div></article>`).join(''); }
  function renderOpenItems(){ const open=state.current.scopes.filter(s=>!['agreed','na'].includes(s.status)); $('#openItems').innerHTML=open.length?`<ol class="open-list">${open.map(s=>`<li><strong>${esc(s.title)}</strong> — ${esc(t(SCOPE_STATUS_LABELS[s.status]))}${s.note?`: ${esc(s.note)}`:''}</li>`).join('')}</ol>`:`<p class="all-done">${esc(t('allScopeDone'))}</p>`; }

  function scheduleSave(){ if(state.suppress||!state.current)return; $('#saveState').textContent=t('saving'); setSync('saving',t('saving')); clearTimeout(state.dirtyTimer); state.dirtyTimer=setTimeout(saveCurrent,650); }
  async function saveCurrent(){ clearTimeout(state.dirtyTimer); if(!state.current)return; state.current.signatures={clientSignature:signatureData('clientSignature'),contractorSignature:signatureData('contractorSignature')}; try{ const saved=await state.store.saveProject(state.current); state.current={...state.current,...saved}; const idx=state.projects.findIndex(p=>p.id===state.current.id); if(idx>=0)state.projects[idx]=structuredClone(state.current); else state.projects.unshift(structuredClone(state.current)); $('#saveState').textContent=t('saved'); setSync('',t('local')); }catch(e){ $('#saveState').textContent=t('saveError'); setSync('error',t('offline')); toast(t('localError')); } }

  function initSignature(id){ const canvas=$('#'+id),ctx=canvas.getContext('2d');ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#17232d';let drawing=false;const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();});const stop=()=>{if(drawing){drawing=false;scheduleSave();}};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop); }
  function signatureData(id){ try{return $('#'+id).toDataURL('image/png');}catch{return'';} }
  function restoreSignature(id,data){ const c=$('#'+id),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(!data)return;const i=new Image();i.onload=()=>ctx.drawImage(i,0,0,c.width,c.height);i.src=data; }
  function restoreSignatures(){ restoreSignature('clientSignature',state.current.signatures?.clientSignature);restoreSignature('contractorSignature',state.current.signatures?.contractorSignature); }

  async function addPhotos(files,phase){
    files=files.filter(file=>file.type.startsWith('image/'));
    if(!files.length)return;
    const excess=Math.max(0,state.photos.length+files.length-MAX_PHOTOS);
    if(excess>0&&!confirm(t('photoLimitWarning').replace('{count}',String(excess))))return;
    setSync('saving',t('saving'));
    for(const file of files){ try{const p=await state.store.addPhoto(state.current.id,file,phase);state.photos.push(p);}catch(e){toast(t('localError'));} }
    const removeCount=Math.max(0,state.photos.length-MAX_PHOTOS);
    if(removeCount){ const oldest=[...state.photos].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).slice(0,removeCount); for(const photo of oldest)await state.store.deletePhoto(photo); const ids=new Set(oldest.map(p=>p.id)); state.photos=state.photos.filter(p=>!ids.has(p.id)); }
    renderPhotos();setSync('',t('local'));toast(t('photosSaved'));
  }
  async function updatePhoto(card){ const p=state.photos.find(x=>x.id===card.dataset.photoId);if(!p)return;p.category=$('[data-photo-category]',card).value;p.comment=$('[data-photo-comment]',card).value;try{await state.store.updatePhoto(p);}catch{toast(t('localError'));} }

  async function exportJson(){
    await saveCurrent();
    const payload=await state.store.exportData();
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`renoweet-projecten-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(t('exportDone'));
  }
  async function importJson(file){
    try{
      const payload=JSON.parse(await file.text());
      if(payload?.format!=='renoweet-local-database'||payload.version!==1||!Array.isArray(payload.projects)||!Array.isArray(payload.photos))throw new Error('Invalid format');
      const current=await state.store.exportData(),projectMap=new Map(current.projects.map(p=>[p.id,p])),photoMap=new Map(current.photos.map(p=>[p.id,p]));
      for(const project of payload.projects)projectMap.set(project.id,project);
      for(const photo of payload.photos)photoMap.set(photo.id,photo);
      payload.projects=[...projectMap.values()];
      const validIds=new Set(payload.projects.map(p=>p.id));
      const grouped=new Map();
      for(const photo of photoMap.values()){ if(!validIds.has(photo.projectId))continue;const list=grouped.get(photo.projectId)||[];list.push(photo);grouped.set(photo.projectId,list); }
      payload.photos=[];
      const removed=[];
      for(const list of grouped.values()){ list.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));removed.push(...list.slice(0,Math.max(0,list.length-MAX_PHOTOS)));payload.photos.push(...list.slice(-MAX_PHOTOS)); }
      const trimmed=removed.length;
      let prompt=t('importConfirm');if(trimmed)prompt+=`\n\n${t('importPhotoTrimWarning').replace('{count}',String(trimmed))}`;if(!confirm(prompt))return;
      await state.store.importData(payload);for(const photo of removed)await state.store.deletePhoto(photo);state.current=null;state.photos=[];$('#accountDialog').close();await loadDashboard();toast(t('importDone'));
    }catch(e){toast(t('importError'));}
  }

  function prepareBlankPrint(){
    const elements=$$('[data-paper-clear],.scope-status,.scope-note,[data-measure]');
    const snapshot=elements.map(el=>({el,value:el.value,checked:el.checked}));
    const sig={client:signatureData('clientSignature'),contractor:signatureData('contractorSignature')};
    state.suppress=true; document.body.classList.add('paper-print');
    elements.forEach(el=>{if(el.type==='checkbox')el.checked=false;else if(el.classList.contains('scope-status'))el.value='confirm';else el.value='';});
    restoreSignature('clientSignature','');restoreSignature('contractorSignature','');
    let restored=false; const restore=()=>{if(restored)return;restored=true;snapshot.forEach(x=>{if(x.el.type==='checkbox')x.el.checked=x.checked;else x.el.value=x.value;});restoreSignature('clientSignature',sig.client);restoreSignature('contractorSignature',sig.contractor);document.body.classList.remove('paper-print');state.suppress=false;window.removeEventListener('afterprint',restore);};
    window.addEventListener('afterprint',restore);setTimeout(()=>window.print(),60);setTimeout(restore,15000);
  }

  async function linkProjectToOs(p){
    try{
      const result=await window.RenoweetOSProjectBridge.createFromNotebook(p);
      p.osProjectId=result.osProjectId;p.osLinkStatus='linked';p.osLinkedAt=new Date().toISOString();return true;
    }catch(error){console.error(error);p.osLinkStatus='pending';return false;}
  }
  async function createProjectFromDialog(){ const p=blankProject({title:$('#newTitle').value.trim(),clientName:$('#newClient').value.trim(),address:$('#newAddress').value.trim(),visitDate:$('#newVisitDate').value,desiredStart:$('#newStartDate').value,customerComments:$('#newComments').value.trim()}); if(!p.title)return; const linked=await linkProjectToOs(p);await state.store.saveProject(p); state.projects.unshift(p); $('#projectDialog').close(); $('#projectForm').reset(); toast(t(linked?'projectCreated':'projectLinkPending')); openProject(p.id); }
  function accountDialog(){ const content=$('#accountContent'); content.innerHTML=`<div class="account-row"><strong>${esc(t('localMode'))}</strong><span>${esc(t('dataLocalCopy'))}</span></div><div class="form-grid cols-2"><button class="btn btn-primary" id="exportJsonAction" type="button">${esc(t('exportJson'))}</button><button class="btn btn-outline" id="importJsonAction" type="button">${esc(t('importJson'))}</button></div>`; $('#accountDialog').showModal(); }

  async function init(){
    applyI18n(); initSignature('clientSignature');initSignature('contractorSignature');
    state.store=new LocalStore();await loadDashboard();
    registerWebMcp();
  }

  document.addEventListener('click',async e=>{
    const lang=e.target.closest('[data-lang]');if(lang){state.lang=lang.dataset.lang;localStorage.setItem(LANG_KEY,state.lang);applyI18n();return;}
    if(e.target.closest('#homeBtn')||e.target.closest('#backBtn')){await saveCurrent();state.current=null;await loadDashboard();return;}
    if(e.target.closest('#newProjectBtn')||e.target.closest('#emptyNewProjectBtn')){$('#projectDialog').showModal();return;}
    if(e.target.closest('#setupHelpBtn')||e.target.closest('#exportJsonAction')){exportJson();return;}
    if(e.target.closest('#importJsonAction')){$('#jsonImportInput').click();return;}
    if(e.target.closest('#openOsBtn')){window.open('./Renoweet-OS-Drive-v2.2.html','focus_os');return;}
    if(e.target.closest('#accountBtn')){accountDialog();return;}
    const closer=e.target.closest('[data-close-dialog]');if(closer){$('#'+closer.dataset.closeDialog).close();return;}
    const card=e.target.closest('.project-card');
    if(card&&e.target.closest('.open-project')){openProject(card.dataset.projectId);return;}
    if(card&&e.target.closest('.duplicate-project')){const original=state.projects.find(p=>p.id===card.dataset.projectId);const copy=structuredClone(original);copy.id=uid();copy.osProjectId=window.RenoweetOSProjectBridge?.createOsProjectId?.()||'';copy.title=`${copy.title} — ${t('duplicate')}`;copy.createdAt=copy.updatedAt=new Date().toISOString();copy.signatures={clientSignature:'',contractorSignature:''};const linked=await linkProjectToOs(copy);await state.store.saveProject(copy);state.projects.unshift(copy);renderProjects();toast(t(linked?'projectDuplicated':'projectLinkPending'));return;}
    if(card&&e.target.closest('.delete-project')){if(!confirm(t('deleteConfirm')))return;await state.store.deleteProject(card.dataset.projectId);state.projects=state.projects.filter(p=>p.id!==card.dataset.projectId);renderProjects();toast(t('projectDeleted'));return;}
    if(e.target.closest('#addScopeBtn')){state.current.scopes.push({id:uid(),title:'',description:'',status:'confirm',note:''});renderScopes();scheduleSave();return;}
    const scopeCard=e.target.closest('.scope-card');if(scopeCard&&e.target.closest('.remove-scope')){state.current.scopes.splice(Number(scopeCard.dataset.scopeIndex),1);renderScopes();renderOpenItems();scheduleSave();return;}
    if(e.target.closest('#addMeasureBtn')){state.current.measurements.push({id:uid(),position:'',item:'',measure:'',decision:''});renderMeasurements();scheduleSave();return;}
    const row=e.target.closest('[data-measure-index]');if(row&&e.target.closest('.remove-measure')){state.current.measurements.splice(Number(row.dataset.measureIndex),1);renderMeasurements();scheduleSave();return;}
    const photoCard=e.target.closest('.photo-card');if(photoCard&&e.target.closest('.delete-photo')){if(!confirm(t('photoDeleteConfirm')))return;const p=state.photos.find(x=>x.id===photoCard.dataset.photoId);await state.store.deletePhoto(p);state.photos=state.photos.filter(x=>x.id!==p.id);renderPhotos();toast(t('photoDeleted'));return;}
    const clear=e.target.closest('[data-clear-signature]');if(clear){restoreSignature(clear.dataset.clearSignature,'');scheduleSave();return;}
    if(e.target.closest('#printReportBtn')){await saveCurrent();window.print();return;}
    if(e.target.closest('#printBlankBtn')){prepareBlankPrint();return;}
  });

  document.addEventListener('input',e=>{
    if(state.suppress||!state.current)return;
    const field=e.target.closest('[data-field]');if(field){state.current[field.dataset.field]=field.type==='checkbox'?field.checked:field.value;if(field.dataset.field==='title'){$('#toolbarProjectTitle').textContent=field.value;}scheduleSave();return;}
    const scope=e.target.closest('[data-scope-field]');if(scope){const card=scope.closest('.scope-card'),item=state.current.scopes[Number(card.dataset.scopeIndex)];item[scope.dataset.scopeField]=scope.value;card.dataset.status=item.status;renderOpenItems();scheduleSave();return;}
    const check=e.target.closest('[data-check]');if(check){state.current.checks[check.dataset.check]=check.checked;scheduleSave();return;}
    const note=e.target.closest('[data-note]');if(note){state.current.notes[note.dataset.note]=note.value;scheduleSave();return;}
    const measure=e.target.closest('[data-measure]');if(measure){const row=measure.closest('[data-measure-index]');state.current.measurements[Number(row.dataset.measureIndex)][measure.dataset.measure]=measure.value;scheduleSave();return;}
    const comment=e.target.closest('[data-photo-comment]');if(comment){const card=comment.closest('.photo-card'),photo=state.photos.find(x=>x.id===card.dataset.photoId);if(photo)photo.comment=comment.value;clearTimeout(comment._timer);comment._timer=setTimeout(()=>updatePhoto(card),500);}
  });
  document.addEventListener('change',e=>{const category=e.target.closest('[data-photo-category]');if(category)updatePhoto(category.closest('.photo-card'));});
  $('#projectSearch').addEventListener('input',renderProjects);$('#statusFilter').addEventListener('change',renderProjects);
  $('#projectForm').addEventListener('submit',e=>{e.preventDefault();createProjectFromDialog();});
  $('#previsitUpload').addEventListener('change',e=>{addPhotos([...e.target.files],'previsit');e.target.value='';});
  $('#cameraUpload').addEventListener('change',e=>{addPhotos([...e.target.files],'site');e.target.value='';});
  $('#siteUpload').addEventListener('change',e=>{addPhotos([...e.target.files],'site');e.target.value='';});
  $('#jsonImportInput').addEventListener('change',e=>{if(e.target.files[0])importJson(e.target.files[0]);e.target.value='';});
  window.addEventListener('beforeunload',()=>{if(state.current)saveCurrent();});

  function registerWebMcp(){ const c=document.modelContext;if(!c?.registerTool)return;const controller=new AbortController();try{Promise.resolve(c.registerTool({name:'list_renoweet_projects',title:'List Renoweet projects',description:'List projects stored in the local Renoweet database on this device.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:async()=>({projects:(await state.store.listProjects()).map(p=>({id:p.id,osProjectId:p.osProjectId,title:p.title,client:p.clientName,address:p.address,status:p.status}))})},{signal:controller.signal})).catch(()=>{});Promise.resolve(c.registerTool({name:'create_renoweet_project',title:'Create Renoweet project',description:'Create a renovation survey project in the local notebook and add it to Renoweet OS.',inputSchema:{type:'object',properties:{title:{type:'string'},clientName:{type:'string'},address:{type:'string'},customerComments:{type:'string'}},required:['title'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input?.title?.trim())throw new Error('title is required');const p=blankProject({title:input.title.trim(),clientName:input.clientName||'',address:input.address||'',customerComments:input.customerComments||''});await linkProjectToOs(p);await state.store.saveProject(p);state.projects.unshift(p);if(!$('#dashboardView').classList.contains('hidden'))renderProjects();return{id:p.id,osProjectId:p.osProjectId,title:p.title};}},{signal:controller.signal})).catch(()=>{});}catch{} }

  init();
})();
