// Lightweight PWA Service Worker
const CACHE_NAME = "msc-school-pwa-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  // Let network handle dynamic API/Firestore requests directly
  if (e.request.url.includes("firestore.googleapis.com") || e.request.url.includes("firebase")) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

