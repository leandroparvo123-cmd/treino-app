// Guarda os arquivos do app no celular pra ele abrir mesmo com internet fraca.
const CACHE = "treino-v11";
const CORE = ["./", "index.html", "app.js", "fig.js", "seed.js", "config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // bibliotecas do Firebase: primeiro do celular, depois da internet
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // arquivos do app: primeiro da internet (pra pegar atualizações), sem internet usa a cópia
  if (url.origin === self.location.origin) {
    e.respondWith(
      Promise.race([
        fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }),
        new Promise((_, rej) => setTimeout(rej, 4000)),
      ]).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
    );
  }
});
