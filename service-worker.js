const CACHE_NAME="renoweet-focus-hub-v4.4-5";
const APP_SHELL=[
  "./","./index.html","./styles.css","./app.js","./manifest.webmanifest",
  "./icons/icon.svg","./icons/apple-touch-icon.png",
  "./Renoweet-OS-Drive-v2.2.html","./Renoweet-Bookkeeping-Drive-v2.2.html","./Renoweet-BOD-Drive-v2.2.html",
  "./renoweet-drive-core-v3.0.js","./renoweet-os-drive-adapter-v3.6.js",
  "./renoweet-bookkeeping-drive-adapter-v3.7.js","./renoweet-bookkeeping-enhancements-v4.3.js","./renoweet-accounting-engine-v4.4.js","./renoweet-bookkeeping-v4.4.js","./styles-accounting-v4.4.css","./renoweet-os-enhancements-v4.3.js","./renoweet-bod-drive-adapter-v2.js","./Renoweet-Legacy-Import-2026-Q3.html","./migration-2026-q3.json"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;event.respondWith(fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));return resp}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))))});
