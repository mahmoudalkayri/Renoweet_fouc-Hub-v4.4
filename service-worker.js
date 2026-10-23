const CACHE_NAME="renoweet-focus-hub-v4.4.4-56";
const APP_SHELL=[
  "./","./index.html","./styles.css","./app.js","./company-details.txt","./company-details.js","./renoweet-print-layout.js?v=4.4.4.56","./renoweet-rich-text.js","./styles-rich-text.css","./renoweet-scope-photos.js","./manifest.webmanifest",
  "./icons/icon.svg","./icons/apple-touch-icon.png",
  "./icons/renoweet-logo.png","./Renoweet-Project-Notebook.html","./styles-project-notebook.css","./renoweet-project-notebook.js","./renoweet-os-project-bridge-v1.js",
  "./Renoweet-OS-Drive-v2.2.html","./Renoweet-Bookkeeping-Drive-v2.2.html","./Renoweet-BOD-Drive-v2.2.html",
  "./renoweet-assets-calculations.js?v=4.4.4.56","./renoweet-company-assets.js?v=4.4.4.56","./renoweet-company-assets-ui.js?v=4.4.4.56","./styles-company-assets.css?v=4.4.4.56",
  "./renoweet-recovery-records.js?v=4.4.4.56","./renoweet-recovery-records-ui.js?v=4.4.4.56","./renoweet-monthly-payments.js?v=4.4.4.56","./renoweet-monthly-payments-ui.js?v=4.4.4.56","./styles-monthly-payments.css?v=4.4.4.56",
  "./renoweet-invoice-closing.js","./renoweet-partial-invoice-engine.js?v=4.4.4.56","./renoweet-partial-invoices-ui.js?v=4.4.4.56","./renoweet-drive-core-v3.0.js","./renoweet-os-vat-engine-v1.js?v=4.4.4.56","./renoweet-os-drive-adapter-v3.6.js",
  "./renoweet-bookkeeping-drive-adapter-v3.7.js?v=4.4.4.56","./renoweet-bookkeeping-enhancements-v4.3.js?v=4.4.4.56","./renoweet-accounting-engine-v4.4.js?v=4.4.4.56","./renoweet-bookkeeping-v4.4.js?v=4.4.4.56","./styles-accounting-v4.4.css?v=4.4.4.56","./renoweet-os-enhancements-v4.3.js","./renoweet-bod-drive-adapter-v2.js","./Renoweet-Legacy-Import-2026-Q3.html","./migration-2026-q3.json","./Renoweet-Legacy-XLSX-Import-v4.4.html","./renoweet-legacy-xlsx-engine-v4.4.js"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;event.respondWith(fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));return resp}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))))});
