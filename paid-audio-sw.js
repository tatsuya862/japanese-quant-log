const CACHE_NAME = "quant-log-paid-audio-v13";
const CACHE_PREFIX = "quant-log-paid-audio-";
const APP_SHELL = [
  "paid-audio.html",
  "paid-audio-leverage.html",
  "paid-longgame-three-essentials.html",
  "paid-longgame-harvest-recovery.html",
  "paid-longgame-give-up.html",
  "paid-longgame-leverage.html",
  "paid-longgame-waves.html",
  "paid-audio.js?v=paid-audio-09",
  "styles.css?v=paid-give-up-01",
  "styles.css?v=paid-audio-09",
  "styles.css?v=paid-waves-02",
  "styles.css?v=paid-leverage-02",
  "membership.js?v=stripe-link-03",
  "assets/favicon_16x16.png",
  "assets/tatsuya-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isPaidPreviewAsset = url.pathname.includes("/paid-audio") || url.pathname.includes("/paid-longgame") || url.pathname.endsWith("/styles.css") || url.pathname.endsWith("/membership.js") || url.pathname.endsWith("/assets/tatsuya-logo.png") || url.pathname.endsWith("/assets/favicon_16x16.png");
  if (!isPaidPreviewAsset) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
