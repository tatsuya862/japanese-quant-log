const CACHE_NAME = "quant-log-offline-voice-v5";
const CACHE_PREFIX = "quant-log-offline-voice-";
const APP_SHELL = [
  "offline-voice-memo.html",
  "offline-voice-memo.js?v=offline-voice-memo-04",
  "styles.css?v=offline-voice-memo-03",
  "offline-voice-memo.webmanifest",
  "assets/favicon_16x16.png"
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
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
