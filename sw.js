const CACHE="grinnzove-lca-v4";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./grinnzove-logo.png","./unicarve-logo.jpg","./dafnae-logo.png","./cow.jpg","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp}).catch(()=>caches.match("./index.html"))))});