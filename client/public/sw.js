// Cabinet Dealz — Service Worker
// Provides offline shell caching so the app loads even without a network.

// Do not cache application HTML or navigation responses. The Designer changes
// frequently and an old shell can point a phone at obsolete JavaScript chunks.
// This version advances again to remove stale app shells that were installed
// before recent Designer publishing. It then keeps future navigations network-current.
const CACHE_NAME = "cabinet-dealz-v3-network-current";

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.resolve());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Intentionally no fetch handler. Returning clients always request the latest
// deployed HTML and its content-hashed JavaScript chunks from the network.
