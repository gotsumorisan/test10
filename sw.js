const CACHE='hall-scan-v4-slot-only-r115-h4a-flat';
const IMAGE_CACHE='hall-scan-images-v3.15-r8';
const CORE=[
  './',
  './index.html',
  './search.html',
  './stores.html',
  './visual-guide.html',
  './abashiri.html',
  './kitami.html',
  './offline.html',
  './app-v2.css',
  './app-v3.css',
  './hallscan-v315.css',
  './hallscan-v315.js',
  './machine-strategy-v315.js',
  './lowrate-index-v315.js',
  './hallscan-monkey-main.webp',
  './hallscan-monkey-side.webp',
  './hallscan-otome-main.webp',
  './hallscan-otome-side.webp',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './aurora-kitami.webp',
  './daigoro-x.webp',
  './daigoro-z.webp',
  './dynam-kitami.webp',
  './hero-hall.webp',
  './himawari-kitami.webp',
  './machine-god-kiseki.webp',
  './machine-godeater.webp',
  './machine-hokuto-tensho2.webp',
  './machine-hokuto.webp',
  './machine-kabaneri.webp',
  './machine-kaguya.webp',
  './machine-karakuri.webp',
  './machine-karakuri2.webp',
  './machine-monkey5.webp',
  './machine-otome4.webp',
  './machine-otome5.webp',
  './machine-seed.webp',
  './machine-tokyo-ghoul.webp',
  './machine-tokyorev.webp',
  './machine-vvv2.webp',
  './machine-yoshimune.webp',
  './maruhan-abashiri.webp',
  './maruhan-kitami.webp',
  './maruhan-tanno.webp',
  './royal-abashiri.webp',
  './royal-kitami.webp',
  './taiyo-abashiri.webp',
  './towa-abashiri.webp',
  './aurora_kitami_integrated_factchecked.html',
  './daigoro_x_integrated_factchecked.html',
  './daigoro_z_integrated_factchecked.html',
  './daiman_integrated_factchecked.html',
  './dynam_kitami_integrated_factchecked.html',
  './kitami_himawari_integrated_factchecked.html',
  './maruhan_kitami_integrated_factchecked.html',
  './maruhan_tanno_integrated_factchecked.html',
  './royal_kitami_integrated_factchecked.html',
  './towa_kitami_integrated_factchecked.html',
  './fullrate-data-v314.js',
  './stores.json',
  './machines.json',
  './installations.json',
  './strategies.json',
  './screening.json',
  './look-guides.json',
  './audit-meta.json',
  './schema-manifest.json',
  './hallscan-data-store.mjs',
  './feature-flags.mjs',
  './staged-flags.mjs',
  './v4-slot-adapter.mjs',
  './search-v4-bridge.mjs',
  './search-v4-runtime.mjs',
  './store-v4-bridge.mjs',
  './store-v4-panel.mjs',
  './store-v4-runtime.mjs',
  './slot-detail-v4-bridge.mjs',
  './slot-detail-v4-panel.mjs',
  './prototype-model.mjs',
  './consultation-builder.mjs'
];
self.addEventListener('install', event => {
  // Deliberately do not call skipWaiting(). A new app shell must not take over
  // an already-open client that is still running the previous cached version.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  // Activation only happens after previous-version clients are gone. At that
  // point stale app-shell caches can be removed without creating a mixed shell.
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE && key !== IMAGE_CACHE).map(key => caches.delete(key))
    ))
  );
  // Deliberately do not call clients.claim(); the controller changes on a clean
  // navigation/relaunch instead of in the middle of an existing session.
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    if (event.request.destination === 'image') {
      event.respondWith(caches.open(IMAGE_CACHE).then(async cache => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const response = await fetch(event.request);
          if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(event.request, response.clone());
          }
          return response;
        } catch (_) {
          return new Response('', { status: 504, statusText: 'Offline' });
        }
      }));
    }
    return;
  }

  if (event.request.mode === 'navigate') {
    const canonical = new URL(event.request.url);
    canonical.search = '';
    canonical.hash = '';
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(canonical.href);
      if (hit) return hit;
      try {
        // Known app routes are precached. Navigation misses are intentionally
        // not written into the versioned app-shell cache, which keeps one cache
        // revision internally coherent until the next SW revision activates.
        return await fetch(event.request);
      } catch (_) {
        const offlineUrl = new URL('offline.html', self.registration.scope).href;
        return (await cache.match(offlineUrl)) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  event.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(event.request);
    if (hit) return hit;
    try {
      const response = await fetch(event.request);
      if (response && response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  }));
});
