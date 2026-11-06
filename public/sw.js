// Becca's Crown Beauty Vault - Enterprise PWA Service Worker v6
const CACHE_NAME = "beccascrown-dashboard-v6";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/images/logo/logo-mark-gold.svg",
  "/images/logo/logo-mark-white.svg",
  "/images/logo/logo-white.svg",
];

// 1. Install lifecycle: Precache core offline assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Precache all assets reliably
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.debug("PWA Precache item notice:", asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate lifecycle: Purge old cache versions and claim immediate control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch lifecycle: High-performance routing with guaranteed offline fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Bypass non-GET, internal API, or data endpoints
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/")
  ) {
    return;
  }

  // B. Page Navigation: Network-First with guaranteed 200 OK Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(async () => {
          // 1. Check if the specific page was cached previously
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          // 2. Check if /dashboard or / was cached
          const dashboardCache = await caches.match("/dashboard");
          if (dashboardCache) return dashboardCache;

          // 3. Guaranteed 200 OK fallback to offline.html for Chrome PWA installability
          const offlineFallback = await caches.match(OFFLINE_URL);
          if (offlineFallback) return offlineFallback;

          return new Response("Offline mode active", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        })
    );
    return;
  }

  // C. Static Assets (Icons, Stylesheets, Static Chunks, Images)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => cached);
      })
    );
  }
});
