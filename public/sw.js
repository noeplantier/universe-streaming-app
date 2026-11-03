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

const CACHE     = 'universe-pwa-v2';
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

  // Ne jamais mettre en cache les réponses API, JSON ou les données de session.
  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  // 4. Ressources → Network-first pour servir rapidement les mises à jour;
  //    le cache ne sert que de secours hors ligne.
  event.respondWith(
    fetch(request).then((response) => {
      if (response?.status === 200 && response.type !== 'opaque') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 })))
  );
});
