// VM Planner — service worker: SIEMPRE la versión más nueva; la caché es solo respaldo offline.
const CACHE = "vmplanner-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))) // si un CDN falla, no bloquea la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  // APIs, proxy y endpoints del server local: siempre red directa, jamás caché
  if (url.includes("api.anthropic.com") || url.includes("r.jina.ai") || url.includes("/proxy?") ||
      url.includes("/backup") || url.includes("/apple-note") || url.includes("googleapis.com")) return;

  const propio = url.startsWith(self.location.origin);
  if (propio || e.request.mode === "navigate") {
    // RED PRIMERO: un refresh trae siempre lo último; la caché solo responde sin internet
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
        return res;
      }).catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))
      )
    );
    return;
  }
  // CDN (pdf.js, etc.): caché primero, está bien que sea estable
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        if (res.ok && url.includes("cdnjs.cloudflare.com")) {
          const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
