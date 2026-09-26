(() => {
  'use strict';

  const BRIDGE_DB = 'renoweet-project-os-bridge-v1';
  const BRIDGE_STORE = 'pending';
  const OS_CACHE_DB = 'renoweet-os-local-cache-v1';
  const OS_CACHE_STORE = 'state';
  const OS_CACHE_PREFIX = 'renoweet-db';
  const ACTIVE_DATABASE_KEY = 'renoweetActiveDatabaseName';
  const DRIVE_CACHE_DB = 'RenoweetDriveCacheV2';
  const DRIVE_CACHE_STORE = 'snapshots';
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
      if (!database.objectStoreNames.contains(BRIDGE_STORE)) database.createObjectStore(BRIDGE_STORE, {keyPath: 'id'});
    });
  }

  async function osCacheDatabase() {
    return openDatabase(OS_CACHE_DB, 1, database => {
      if (!database.objectStoreNames.contains(OS_CACHE_STORE)) database.createObjectStore(OS_CACHE_STORE);
    });
  }

  async function driveCacheDatabase() {
    return openDatabase(DRIVE_CACHE_DB, 1, database => {
      if (!database.objectStoreNames.contains(DRIVE_CACHE_STORE)) database.createObjectStore(DRIVE_CACHE_STORE);
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

  function notebookSnapshot(project) {
    return {
      version: 1,
      capturedAt: now(),
      status: project.status || 'lead',
      visitDate: project.visitDate || '',
      desiredStart: project.desiredStart || '',
      surveyor: project.surveyor || '',
      customerComments: project.customerComments || '',
      intakeSummary: project.intakeSummary || '',
      constraints: project.constraints || '',
      scopes: clone(project.scopes || []),
      checks: clone(project.checks || {}),
      notes: clone(project.notes || {}),
      measurements: clone(project.measurements || []),
      clientActions: project.clientActions || '',
      contractorActions: project.contractorActions || '',
      quoteBasis: project.quoteBasis || '',
      planning: project.planning || '',
      scopeConfirmed: !!project.scopeConfirmed,
      clientSignName: project.clientSignName || '',
      contractorSignName: project.contractorSignName || '',
      approvalDate: project.approvalDate || '',
      quoteDate: project.quoteDate || '',
      targetFinish: project.targetFinish || ''
    };
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
      siteSurvey: {
        notebookProjectId: notebookProject.id,
        linkedAt: timestamp,
        lastSyncedAt: timestamp,
        source: 'Renoweet Project Notebook',
        contractBasisVersion: 1,
        snapshot: notebookSnapshot(notebookProject)
      }
    };
  }

  function applyNotebookToOsProject(existingProject, notebookProject) {
    if (!existingProject) return makeOsProject(notebookProject);
    const project = clone(existingProject);
    const timestamp = now();
    project.id = project.id || notebookProject.osProjectId || osProjectId();
    project.updated = timestamp;
    project.stage = projectStage(notebookProject.status);
    project.customer = {...(project.customer || {}), name: notebookProject.clientName || '', phone: notebookProject.clientPhone || '', email: notebookProject.clientEmail || '', address: notebookProject.address || ''};
    project.title = notebookProject.title || project.title || 'Werkopname';
    const description = notebookProject.customerComments || notebookProject.intakeSummary || '';
    if (description || !project.description) project.description = description;
    if (Array.isArray(notebookProject.scopes)) project.scope = scopeText(notebookProject);
    if (notebookProject.notes && typeof notebookProject.notes === 'object') project.notes = notesText(notebookProject);
    project.schedule = {...(project.schedule || {})};
    if (Object.prototype.hasOwnProperty.call(notebookProject, 'desiredStart')) {
      project.schedule.start = notebookProject.desiredStart || '';
      if (!project.schedule.end || project.schedule.end === existingProject?.schedule?.start) project.schedule.end = notebookProject.desiredStart || '';
    }
    if (Object.prototype.hasOwnProperty.call(notebookProject, 'planning')) project.schedule.notes = notebookProject.planning || '';
    project.quote = {...(project.quote || {})};
    if (notebookProject.quoteBasis) project.quote.assumptions = notebookProject.quoteBasis;
    const firstLink = !project.siteSurvey?.notebookProjectId;
    project.siteSurvey = {
      ...(project.siteSurvey || {}),
      notebookProjectId: notebookProject.id,
      linkedAt: project.siteSurvey?.linkedAt || timestamp,
      lastSyncedAt: timestamp,
      source: 'Renoweet Project Notebook',
      contractBasisVersion: 1,
      snapshot: notebookSnapshot(notebookProject)
    };
    if (firstLink) {
      project.activity = Array.isArray(project.activity) ? project.activity : [];
      project.activity.push({id: token(), timestamp, type: 'Site survey', text: `Linked to Renoweet Project Notebook. Notebook ID: ${notebookProject.id}`});
    }
    return project;
  }

  function notebookSeedFromOs(project) {
    const snapshot = project?.siteSurvey?.snapshot && typeof project.siteSurvey.snapshot === 'object' ? clone(project.siteSurvey.snapshot) : {};
    const seed = {
      osProjectId: project?.id || '',
      title: project?.title || '',
      clientName: project?.customer?.name || '',
      clientEmail: project?.customer?.email || '',
      clientPhone: project?.customer?.phone || '',
      address: project?.customer?.address || '',
      status: ({'Quoted': 'quote', 'Approved': 'quote', 'In progress': 'active', 'Completed': 'done'}[project?.stage] || 'lead'),
      customerComments: snapshot.customerComments || project?.description || '',
      intakeSummary: snapshot.intakeSummary || '',
      visitDate: snapshot.visitDate || '',
      desiredStart: snapshot.desiredStart || project?.schedule?.start || '',
      surveyor: snapshot.surveyor || '',
      constraints: snapshot.constraints || '',
      clientActions: snapshot.clientActions || '',
      contractorActions: snapshot.contractorActions || '',
      quoteBasis: snapshot.quoteBasis || project?.quote?.assumptions || '',
      planning: snapshot.planning || project?.schedule?.notes || '',
      scopeConfirmed: !!snapshot.scopeConfirmed,
      clientSignName: snapshot.clientSignName || '',
      contractorSignName: snapshot.contractorSignName || '',
      approvalDate: snapshot.approvalDate || '',
      quoteDate: snapshot.quoteDate || '',
      targetFinish: snapshot.targetFinish || '',
      osImportedAt: now(),
      osSourceUpdatedAt: project?.updated || ''
    };
    if (project?.siteSurvey?.notebookProjectId) seed.id = project.siteSurvey.notebookProjectId;
    if (Array.isArray(snapshot.scopes) && snapshot.scopes.length) seed.scopes = snapshot.scopes;
    else if (String(project?.scope || '').trim()) seed.scopes = [{id: token(), title: 'Existing OS scope', description: String(project.scope), status: 'confirm', note: ''}];
    if (snapshot.checks && typeof snapshot.checks === 'object') seed.checks = snapshot.checks;
    if (snapshot.notes && typeof snapshot.notes === 'object') seed.notes = snapshot.notes;
    else if (String(project?.notes || '').trim()) seed.notes = {build: String(project.notes)};
    if (Array.isArray(snapshot.measurements) && snapshot.measurements.length) seed.measurements = snapshot.measurements;
    return seed;
  }

  function hasBookkeepingTransfer(project, osState = {bookkeeping: []}) {
    const invoice = project?.invoice || {};
    if (invoice.bookkeepingQueuedAt) return true;
    if (String(invoice.bookkeepingStatus || '').trim()) return true;
    const invoiceNo = String(invoice.number || '').trim();
    const projectId = String(project?.id || '').trim();
    return (osState?.bookkeeping || []).some(row => {
      if (String(row?.Status || '').toLowerCase() === 'cancelled in os') return false;
      const rowProject = String(row?.['Project ID'] || '').trim();
      const rowInvoice = String(row?.['Invoice number'] || '').trim();
      return (projectId && rowProject === projectId) || (invoiceNo && rowInvoice === invoiceNo);
    });
  }

  function isEligibleOpenProject(project, osState = {bookkeeping: []}) {
    return !!project?.id && String(project.stage || 'Lead').toLowerCase() === 'lead' && !hasBookkeepingTransfer(project, osState);
  }

  function osCacheKey() {
    const databaseName = String(localStorage.getItem(ACTIVE_DATABASE_KEY) || '').trim();
    return {databaseName, key: `${OS_CACHE_PREFIX}::${encodeURIComponent(databaseName || 'UNASSIGNED')}`};
  }

  async function readLocalOsCache() {
    try {
      const database = await osCacheDatabase();
      const {key, databaseName} = osCacheKey();
      const transaction = database.transaction(OS_CACHE_STORE, 'readonly');
      const request = transaction.objectStore(OS_CACHE_STORE).get(key);
      const record = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      await transactionDone(transaction);
      if (!record?.db || !Array.isArray(record.db.projects)) return null;
      return {source: 'os-local-cache', savedAt: record.savedAt || '', dirty: !!record.dirty, databaseName: record.databaseName || databaseName, db: clone(record.db)};
    } catch (error) {
      console.warn('Renoweet OS local cache could not be read by Project Notebook.', error);
      return null;
    }
  }

  async function readDriveOsCache() {
    try {
      const year = new Date().getFullYear();
      const database = await driveCacheDatabase();
      const transaction = database.transaction(DRIVE_CACHE_STORE, 'readonly');
      const request = transaction.objectStore(DRIVE_CACHE_STORE).get(`year:${year}`);
      const record = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      await transactionDone(transaction);
      const canonical = record?.value;
      if (!canonical?.os || !Array.isArray(canonical.os.projects)) return null;
      return {source: 'drive-verified-cache', savedAt: record.savedAt || canonical.meta?.updatedAt || '', dirty: false, databaseName: `Renoweet-${year}.json`, db: clone(canonical.os)};
    } catch (error) {
      return null;
    }
  }

  async function readOsState() {
    const [local, drive] = await Promise.all([readLocalOsCache(), readDriveOsCache()]);
    if (local?.dirty) return local;
    if (!local) return drive;
    if (!drive) return local;
    const localTime = Date.parse(local.savedAt || '') || 0;
    const driveTime = Date.parse(drive.savedAt || '') || 0;
    return localTime >= driveTime ? local : drive;
  }

  async function listOpenProjects() {
    const state = await readOsState();
    if (!state) return [];
    return (state.db.projects || []).filter(project => isEligibleOpenProject(project, state.db)).map(clone).sort((a, b) => String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || '')));
  }

  async function mergeIntoOsCache(project, baseState = null) {
    const database = await osCacheDatabase();
    const {key, databaseName} = osCacheKey();
    const transaction = database.transaction(OS_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(OS_CACHE_STORE);
    const request = store.get(key);
    let added = false;
    let updated = false;
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        try {
          const fallbackDb = baseState?.db && Array.isArray(baseState.db.projects) ? clone(baseState.db) : {projects: [], bookkeeping: [], deleted: []};
          const record = request.result || {db: fallbackDb, syncedDb: baseState?.source === 'drive-verified-cache' ? clone(fallbackDb) : null};
          const recordTime = Date.parse(record.savedAt || '') || 0;
          const baseTime = Date.parse(baseState?.savedAt || '') || 0;
          if (baseState?.db && !record.dirty && baseTime > recordTime) {
            record.db = clone(baseState.db);
            if (baseState.source === 'drive-verified-cache') record.syncedDb = clone(baseState.db);
          }
          record.db = record.db && typeof record.db === 'object' ? record.db : fallbackDb;
          record.db.projects = Array.isArray(record.db.projects) ? record.db.projects : [];
          record.db.bookkeeping = Array.isArray(record.db.bookkeeping) ? record.db.bookkeeping : [];
          record.db.deleted = Array.isArray(record.db.deleted) ? record.db.deleted : [];
          const index = record.db.projects.findIndex(item => item.id === project.id);
          if (index >= 0) {
            record.db.projects[index] = clone(project);
            updated = true;
          } else {
            record.db.projects.unshift(clone(project));
            added = true;
          }
          record.savedAt = now();
          record.dirty = true;
          record.databaseName = databaseName || record.databaseName || baseState?.databaseName || '';
          store.put(record, key);
          resolve();
        } catch (error) { reject(error); }
      };
      request.onerror = () => reject(request.error);
    });
    await transactionDone(transaction);
    return {added, updated, key};
  }

  const channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHANNEL_NAME) : null;
  const listeners = new Set();
  if (channel) channel.addEventListener('message', event => {
    for (const listener of listeners) {
      try { listener(event.data); } catch (error) { console.warn(error); }
    }
  });

  async function syncFromNotebook(notebookProject, {stageIfNew = false} = {}) {
    if (!notebookProject || typeof notebookProject !== 'object') throw new Error('A notebook project is required.');
    if (!notebookProject.osProjectId) notebookProject.osProjectId = osProjectId();
    const state = await readOsState();
    const existing = state?.db?.projects?.find(item => item.id === notebookProject.osProjectId) || null;
    const project = applyNotebookToOsProject(existing, notebookProject);
    if (stageIfNew && !existing) await stageProject(project);
    const local = await mergeIntoOsCache(project, state);
    channel?.postMessage({type: existing ? 'project-updated' : 'project-created', project: clone(project)});
    return {ok: true, osProjectId: project.id, added: local.added, updated: local.updated, status: 'local-os-linked', project: clone(project)};
  }

  async function createFromNotebook(notebookProject) {
    return syncFromNotebook(notebookProject, {stageIfNew: true});
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function attachOsRuntime(runtime) {
    if (!runtime || (typeof runtime.add !== 'function' && typeof runtime.upsert !== 'function')) return;
    const accept = async project => {
      try {
        if (typeof runtime.upsert === 'function') await runtime.upsert(clone(project));
        else await runtime.add(clone(project));
        await clearPending(project.id);
        channel?.postMessage({type: 'project-accepted', projectId: project.id});
      } catch (error) { console.error('Renoweet notebook project could not be accepted by OS.', error); }
    };
    if (channel) channel.addEventListener('message', event => {
      if (['project-created', 'project-updated', 'project-upsert'].includes(event.data?.type) && event.data.project?.id) accept(event.data.project);
    });
    setTimeout(async () => {
      try { for (const item of await pendingProjects()) await accept(item.project); }
      catch (error) { console.warn('Renoweet notebook queue is unavailable.', error); }
    }, 1600);
  }

  const api = {
    createFromNotebook,
    syncFromNotebook,
    makeOsProject,
    applyNotebookToOsProject,
    notebookSeedFromOs,
    notebookSnapshot,
    hasBookkeepingTransfer,
    isEligibleOpenProject,
    listOpenProjects,
    readOsState,
    createOsProjectId: osProjectId,
    pendingProjects,
    clearPending,
    subscribe,
    attachOsRuntime
  };
  window.RenoweetOSProjectBridge = api;

  if (typeof db !== 'undefined' && typeof cacheBrowserState === 'function') {
    attachOsRuntime({
      upsert: async project => {
        if (!Array.isArray(db.projects)) db.projects = [];
        const index = db.projects.findIndex(item => item.id === project.id);
        if (index >= 0) db.projects[index] = clone(project);
        else db.projects.unshift(clone(project));
        if (typeof localCacheDirty !== 'undefined') localCacheDirty = true;
        if (typeof restoredLocalCache !== 'undefined') restoredLocalCache = true;
        if (typeof resetProjectShadows === 'function') resetProjectShadows();
        await cacheBrowserState(true);
        if (typeof render === 'function') render();
        if (typeof scheduleSave === 'function') scheduleSave();
        if (typeof toast === 'function') toast(index >= 0 ? 'Project Notebook → OS updated' : 'Project Notebook → OS linked');
      }
    });
  }
})();
