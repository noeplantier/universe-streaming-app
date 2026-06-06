/**
 * sw.js — Universe PWA
 *
 * Stratégie :
 *   Navigation (HTML)  → Network-first → fallback /index.html  (SPA routing)
 *   Assets (JS/CSS/img)→ Cache-first   → fallback réseau
 *
 * Critique : les requêtes de navigation ne sont JAMAIS servies depuis le cache
 * en réponse initiale. Elles passent d'abord par le réseau (Expo dev server ou
 * CDN en prod), ce qui garantit que le bundle JS est toujours injecté.
 */

const CACHE     = 'universe-pwa-v1';
const PRECACHE  = ['/manifest.json'];  // on ne précache PAS /index.html

// ── Install : précache minimal (pas index.html) ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate : nettoie les anciens caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignore les requêtes non-GET
  if (request.method !== 'GET') return;

  // 2. Ignore tout ce qui vient du dev server Expo / Metro
  //    (HMR, websocket, _expo, __metro, hot-update…)
  if (
    url.hostname === 'localhost' ||
    url.pathname.startsWith('/_expo') ||
    url.pathname.startsWith('/__expo') ||
    url.pathname.startsWith('/__metro') ||
    url.pathname.includes('.hot-update.') ||
    url.pathname.includes('hot-update.json')
  ) {
    // En développement : laisse passer directement, sans cache
    return;
  }

  // 3. Requêtes de navigation (HTML pages) → Network-first
  //    Si le réseau échoue (offline), on sert /index.html pour que
  //    Expo Router puisse gérer la route côté client.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() =>
          caches.match('/index.html').then(
            (cached) => cached || new Response('Offline', { status: 503 })
          )
        )
    );
    return;
  }

  // 4. Fichiers statiques (JS, CSS, images, fonts) → Cache-first
  //    Mis en cache lors du premier chargement, servis depuis le cache ensuite.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Ne cache que les réponses valides (pas les 404, erreurs réseau…)
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'opaque'
        ) {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, toCache));
        return response;
      });
    })
  );
});