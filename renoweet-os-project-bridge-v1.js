(() => {
  'use strict';

  const BRIDGE_DB = 'renoweet-project-os-bridge-v1';
  const BRIDGE_STORE = 'pending';
  const OS_CACHE_DB = 'renoweet-os-local-cache-v1';
  const OS_CACHE_STORE = 'state';
  const OS_CACHE_PREFIX = 'renoweet-db';
  const ACTIVE_DATABASE_KEY = 'renoweetActiveDatabaseName';
  const CHANNEL_NAME = 'renoweet-os-projects-v1';

  const clone = value => value == null ? value : structuredClone(value);
  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();
  const token = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const osProjectId = () => {
    const d = new Date();
    const stamp = d.getFullYear()
      + String(d.getMonth() + 1).padStart(2, '0')
      + String(d.getDate()).padStart(2, '0')
      + String(d.getHours()).padStart(2, '0')
      + String(d.getMinutes()).padStart(2, '0')
      + String(d.getSeconds()).padStart(2, '0')
      + String(d.getMilliseconds()).padStart(3, '0');
    const random = globalThis.crypto?.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
      : token();
    return `P${stamp}-${random}`;
  };

  function openDatabase(name, version, upgrade) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => upgrade(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function bridgeDatabase() {
    return openDatabase(BRIDGE_DB, 1, database => {
      if (!database.objectStoreNames.contains(BRIDGE_STORE)) {
        database.createObjectStore(BRIDGE_STORE, {keyPath: 'id'});
      }
    });
  }

  async function osCacheDatabase() {
    return openDatabase(OS_CACHE_DB, 1, database => {
      if (!database.objectStoreNames.contains(OS_CACHE_STORE)) database.createObjectStore(OS_CACHE_STORE);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Storage transaction was cancelled.'));
    });
  }

  async function stageProject(project) {
    const database = await bridgeDatabase();
    const transaction = database.transaction(BRIDGE_STORE, 'readwrite');
    transaction.objectStore(BRIDGE_STORE).put({id: project.id, project: clone(project), queuedAt: now()});
    await transactionDone(transaction);
  }

  async function pendingProjects() {
    const database = await bridgeDatabase();
    const transaction = database.transaction(BRIDGE_STORE, 'readonly');
    const request = transaction.objectStore(BRIDGE_STORE).getAll();
    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    await transactionDone(transaction);
    return result;
  }

  async function clearPending(id) {
    const database = await bridgeDatabase();
    const transaction = database.transaction(BRIDGE_STORE, 'readwrite');
    transaction.objectStore(BRIDGE_STORE).delete(id);
    await transactionDone(transaction);
  }

  function projectStage(status) {
    return ({quote: 'Quoted', active: 'In progress', done: 'Completed'}[status] || 'Lead');
  }

  function scopeText(project) {
    return (project.scopes || []).map(item => {
      const state = ({agreed: 'Akkoord', change: 'Wijzigen', na: 'Niet van toepassing', confirm: 'Te bevestigen'}[item.status] || item.status || 'Te bevestigen');
      return `- ${item.title || 'Scopepunt'} [${state}]${item.description ? `\n  ${item.description}` : ''}${item.note ? `\n  Afspraak: ${item.note}` : ''}`;
    }).join('\n');
  }

  function notesText(project) {
    const labels = {
      build: 'Bouwkundig & sloop', walls: 'Nieuwe wanden & timmerwerk', electrical: 'Elektra',
      plumbing: 'Water & afvoer', heating: 'CV / verwarming / ventilatie', kitchen: 'Keuken / sanitair voorbereiding',
      finishes: 'Afwerking', logistics: 'Logistiek, planning & oplevering'
    };
    const sections = Object.entries(project.notes || {})
      .filter(([, value]) => String(value || '').trim())
      .map(([key, value]) => `${labels[key] || key}:\n${value}`);
    if (project.constraints) sections.push(`Randvoorwaarden / documenten:\n${project.constraints}`);
    if (project.intakeSummary) sections.push(`Vragen voor de opname:\n${project.intakeSummary}`);
    return sections.join('\n\n');
  }

  function makeOsProject(notebookProject) {
    const id = notebookProject.osProjectId || osProjectId();
    const timestamp = now();
    const requestedStart = notebookProject.desiredStart || '';
    return {
      id,
      created: String(notebookProject.createdAt || today()).slice(0, 10),
      updated: timestamp,
      stage: projectStage(notebookProject.status),
      customer: {
        name: notebookProject.clientName || '',
        phone: notebookProject.clientPhone || '',
        email: notebookProject.clientEmail || '',
        address: notebookProject.address || ''
      },
      title: notebookProject.title || 'Werkopname',
      description: notebookProject.customerComments || notebookProject.intakeSummary || '',
      scope: scopeText(notebookProject),
      notes: notesText(notebookProject),
      estimate: [{id: token(), desc: 'Arbeid', qty: 1, unit: 'uur', rate: 62.5}],
      materials: [], documents: [], payments: [], purchaseOrders: [], followUps: [],
      activity: [{
        id: token(), timestamp, type: 'Site survey',
        text: `Created from Renoweet Project Notebook${notebookProject.visitDate ? ` • survey ${notebookProject.visitDate}` : ''}. Notebook ID: ${notebookProject.id}`
      }],
      acceptance: {status: 'Pending', date: '', notes: ''},
      schedule: {start: requestedStart, end: requestedStart, time: '', notes: notebookProject.planning || '', shareClient: false, inviteEmail: '', inviteStatus: '', calendarSharedWith: '', calendarShareSignature: ''},
      quote: {
        number: '', date: today(), validDays: 14, vat: 21, status: 'Draft', parking: 0, travel: 0,
        exclusions: 'Niet inbegrepen tenzij expliciet vermeld:\n- Vergunningen, constructieberekeningen en werkzaamheden van derden.\n- Verborgen gebreken, asbest of niet-zichtbare leidingen/constructies.\n- Herstelwerk buiten de omschreven scope.',
        paymentTerms: 'Na akkoord op deze offerte is een aanbetaling verschuldigd ter voorbereiding en uitvoering van de werkzaamheden volgens planning. Het resterende bedrag wordt betaald volgens de afgesproken termijn(en), met de eindbetaling bij oplevering.',
        advancePct: 50, installments: 0,
        assumptions: notebookProject.quoteBasis || 'Uitvoering op basis van zichtbare situatie en beschikbare informatie tijdens inspectie. Definitieve maten, materiaalkeuzes en bereikbaarheid worden vóór start bevestigd.'
      },
      invoice: {number: '', date: today(), dueDays: 3, status: 'Draft'},
      checklist: [
        'Scope confirmed with customer', 'Measurements checked', 'Materials ordered', 'Access / parking / keys arranged',
        'Work area protected', 'Before photos taken', 'Work completed', 'Quality check completed',
        'Customer walkthrough', 'Invoice sent', 'Review request sent', 'Referral request sent'
      ].map((text, index) => ({order: index + 1, text, done: false})),
      siteSurvey: {notebookProjectId: notebookProject.id, linkedAt: timestamp, source: 'Renoweet Project Notebook'}
    };
  }

  function osCacheKey() {
    const databaseName = String(localStorage.getItem(ACTIVE_DATABASE_KEY) || '').trim();
    return {
      databaseName,
      key: `${OS_CACHE_PREFIX}::${encodeURIComponent(databaseName || 'UNASSIGNED')}`
    };
  }

  async function mergeIntoOsCache(project) {
    const database = await osCacheDatabase();
    const {key, databaseName} = osCacheKey();
    const transaction = database.transaction(OS_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(OS_CACHE_STORE);
    const request = store.get(key);
    let added = false;
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        try {
          const record = request.result || {db: {projects: [], bookkeeping: [], deleted: []}, syncedDb: null};
          record.db = record.db && typeof record.db === 'object' ? record.db : {projects: [], bookkeeping: [], deleted: []};
          record.db.projects = Array.isArray(record.db.projects) ? record.db.projects : [];
          record.db.bookkeeping = Array.isArray(record.db.bookkeeping) ? record.db.bookkeeping : [];
          record.db.deleted = Array.isArray(record.db.deleted) ? record.db.deleted : [];
          if (!record.db.projects.some(item => item.id === project.id)) {
            record.db.projects.unshift(clone(project));
            added = true;
          }
          record.savedAt = now();
          record.dirty = true;
          record.databaseName = databaseName;
          store.put(record, key);
          resolve();
        } catch (error) { reject(error); }
      };
      request.onerror = () => reject(request.error);
    });
    await transactionDone(transaction);
    return {added, key};
  }

  const channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHANNEL_NAME) : null;

  async function createFromNotebook(notebookProject) {
    if (!notebookProject || typeof notebookProject !== 'object') throw new Error('A notebook project is required.');
    if (!notebookProject.osProjectId) notebookProject.osProjectId = osProjectId();
    const project = makeOsProject(notebookProject);
    await stageProject(project);
    const local = await mergeIntoOsCache(project);
    channel?.postMessage({type: 'project-created', project: clone(project)});
    return {ok: true, osProjectId: project.id, added: local.added, status: 'local-os-linked'};
  }

  function attachOsRuntime(runtime) {
    if (!runtime || typeof runtime.add !== 'function') return;
    const accept = async project => {
      try {
        await runtime.add(clone(project));
        await clearPending(project.id);
        channel?.postMessage({type: 'project-accepted', projectId: project.id});
      } catch (error) { console.error('Renoweet notebook project could not be accepted by OS.', error); }
    };
    if (channel) channel.addEventListener('message', event => {
      if (event.data?.type === 'project-created' && event.data.project?.id) accept(event.data.project);
    });
    setTimeout(async () => {
      try { for (const item of await pendingProjects()) await accept(item.project); }
      catch (error) { console.warn('Renoweet notebook queue is unavailable.', error); }
    }, 1600);
  }

  const api = {createFromNotebook, makeOsProject, createOsProjectId: osProjectId, pendingProjects, clearPending, attachOsRuntime};
  window.RenoweetOSProjectBridge = api;

  if (typeof db !== 'undefined' && typeof cacheBrowserState === 'function') {
    attachOsRuntime({
      add: async project => {
        if (!Array.isArray(db.projects)) db.projects = [];
        if (!db.projects.some(item => item.id === project.id)) {
          db.projects.unshift(project);
          if (typeof localCacheDirty !== 'undefined') localCacheDirty = true;
          if (typeof restoredLocalCache !== 'undefined') restoredLocalCache = true;
          if (typeof resetProjectShadows === 'function') resetProjectShadows();
          await cacheBrowserState(true);
          if (typeof render === 'function') render();
          if (typeof scheduleSave === 'function') scheduleSave();
          if (typeof toast === 'function') toast('Project Notebook → OS linked');
        }
      }
    });
  }
})();
