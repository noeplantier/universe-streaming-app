/**
 * universe_load_test.js — Universe App · k6 Load Test
 *
 * Architecture réelle :
 *   - API   : Supabase REST (PostgREST) — /rest/v1/reels
 *   - Vidéo : MP4 direct dans Supabase Storage CDN (bucket community-images)
 *   - Auth  : anon key (bearer) — pas de session Supabase Auth
 *
 * Scénarios inclus (activés via K6_SCENARIO env) :
 *   smoke     — 50 → 500 VUs / 10 min
 *   rampup    — 500 → 10 000 VUs / 60 min + 60 min soak
 *   stress    — 10 000 → 15 000 VUs jusqu'au breaking point
 *   all (défaut) — smoke puis rampup
 *
 * Run :
 *   k6 run --env SUPABASE_URL=https://knrzbdqfflobfjdmqyte.supabase.co \
 *          --env SUPABASE_ANON=<clé> \
 *          --env K6_SCENARIO=smoke \
 *          --out influxdb=http://localhost:8086/k6 \
 *          scripts/k6/universe_load_test.js
 */

import http         from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Config (env vars)
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = __ENV.SUPABASE_URL  || 'https://knrzbdqfflobfjdmqyte.supabase.co';
const SUPABASE_ANON = __ENV.SUPABASE_ANON || '';
const CDN_BASE      = `${SUPABASE_URL}/storage/v1/object/public/community-images`;
const SCENARIO      = __ENV.K6_SCENARIO   || 'all';

// Segment simulation (MP4 range requests)
// 1.5 Mbps × 6 s / 8 = 1 125 000 bytes, but we only probe first 64 KB for TTFF
const PROBE_BYTES   = 65_535; // first 64 KB → measures Time To First Byte
const SEGMENT_DURATION_S = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────
const ttff          = new Trend('ttff_ms',       true);  // Time To First Frame (segment p0)
const apiLatency    = new Trend('api_latency_ms', true);
const bufferingRate = new Rate('buffering_event');        // segment latency > segment duration
const segmentErrors = new Counter('segment_errors');
const activeViewers = new Gauge('active_viewers');

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = {
  smoke: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50  },
      { duration: '3m', target: 500 },
      { duration: '2m', target: 500 }, // hold
      { duration: '2m', target: 0   },
    ],
    tags: { scenario: 'smoke' },
  },
  rampup: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10m', target: 2500  },
      { duration: '10m', target: 5000  },
      { duration: '10m', target: 7500  },
      { duration: '10m', target: 10000 },
      { duration: '60m', target: 10000 }, // soak — fuites mémoire, throttling
      { duration: '5m',  target: 0     },
    ],
    tags: { scenario: 'rampup_soak' },
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 10000,
    stages: [
      { duration: '5m',  target: 11000 },
      { duration: '5m',  target: 12500 },
      { duration: '5m',  target: 15000 },
      { duration: '10m', target: 15000 },
      { duration: '5m',  target: 0     },
    ],
    tags: { scenario: 'stress' },
  },
};

const scenarioMap = {
  smoke:  { smoke:  SCENARIOS.smoke },
  rampup: { rampup: SCENARIOS.rampup },
  stress: { stress: SCENARIOS.stress },
  all:    { smoke: { ...SCENARIOS.smoke }, rampup: { ...SCENARIOS.rampup, startTime: '11m' } },
};

export const options = {
  scenarios: scenarioMap[SCENARIO] || scenarioMap.all,

  thresholds: {
    // ── Acceptance criteria ───────────────────────────────────────────────────
    http_req_failed:   ['rate<0.005'],    // < 0.5% error rate
    http_req_duration: ['p(95)<3000'],    // p95 global < 3 s
    ttff_ms:           ['p(95)<3000'],    // Time To First Frame p95 < 3 s
    api_latency_ms:    ['p(95)<300'],     // API latency p95 < 300 ms
    buffering_event:   ['rate<0.02'],     // < 2% sessions avec buffering
    segment_errors:    ['count<1000'],    // < 1000 erreurs de segments absolues
  },

  // Sortie par défaut vers InfluxDB si disponible
  // Remplacer par --out cloud pour k6 Cloud
  ext: { loadimpact: { name: 'Universe App 10k Load Test' } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────────────
const API_HEADERS = {
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Content-Type':  'application/json',
  'Accept':        'application/json',
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup — récupère la liste réelle depuis Supabase (1 fois pour tous les VUs)
// ─────────────────────────────────────────────────────────────────────────────
export function setup() {
  console.log('▶ Setup: chargement des reels depuis Supabase...');
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/reels?status=eq.approved&select=id,video_url,duration,likes_count,views_count&limit=250&order=created_at.desc`,
    { headers: API_HEADERS, timeout: '30s' },
  );

  check(res, {
    'setup: liste reels 200': r => r.status === 200,
    'setup: liste non vide':  r => Array.isArray(r.json()) && r.json().length > 0,
  });

  const reels = Array.isArray(res.json()) ? res.json() : [];
  console.log(`▶ Setup: ${reels.length} reels chargés.`);
  return { reels };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — scénario utilisateur complet
// ─────────────────────────────────────────────────────────────────────────────
export default function(data) {
  const { reels } = data;
  if (!reels || reels.length === 0) { sleep(1); return; }

  activeViewers.add(1);

  // ── 1. Chargement du feed (pagination cursor-based, page 0) ───────────────
  group('feed_load', () => {
    const t0  = Date.now();
    const res = http.get(
      `${SUPABASE_URL}/rest/v1/reels?status=eq.approved&select=id,video_url,title,genre,duration&limit=20&order=created_at.desc`,
      { headers: API_HEADERS, tags: { name: 'feed_page_0' } },
    );
    apiLatency.add(Date.now() - t0);
    check(res, {
      'feed: statut 200': r => r.status === 200,
      'feed: contenu JSON': r => Array.isArray(r.json()),
    });
  });

  sleep(randomIntBetween(1, 3)); // penser / scroller (~1–3 s)

  // ── 2. Lecture d'une vidéo (range requests CDN) ───────────────────────────
  const reel = randomItem(reels);
  const videoUrl = resolveVideoUrl(reel.video_url);

  if (videoUrl) {
    group('video_playback', () => {
      // Nombre de segments regardés (5–15 = 30s à 90s de visionnage simulé)
      const segCount = randomIntBetween(5, 15);

      for (let seg = 0; seg < segCount; seg++) {
        const byteFrom = seg * 1_125_000; // 1.125 MB/segment (1.5 Mbps × 6s / 8)
        const byteTo   = byteFrom + PROBE_BYTES; // seulement 64 KB pour mesurer TTFF

        const t0 = Date.now();
        const res = http.get(videoUrl, {
          headers: {
            ...API_HEADERS,
            'Range':  `bytes=${byteFrom}-${byteTo}`,
            'Accept': 'video/mp4, video/*, */*',
          },
          tags: { name: 'video_segment' },
          timeout: '15s',
          responseType: 'none', // ne bufférise pas le corps — mesure latence uniquement
        });
        const elapsed = Date.now() - t0;

        if (seg === 0) ttff.add(elapsed); // premier segment = TTFF proxy

        // Heuristique buffering : segment plus lent que sa durée réelle
        bufferingRate.add(elapsed > SEGMENT_DURATION_S * 1000 ? 1 : 0);

        const ok = check(res, {
          'segment: 200 ou 206': r => r.status === 200 || r.status === 206,
        });
        if (!ok) segmentErrors.add(1);

        // Pause réaliste : joue le segment pendant sa durée, puis demande le suivant
        if (seg < segCount - 1) {
          const waitMs = Math.max(0, SEGMENT_DURATION_S * 1000 - elapsed);
          sleep(waitMs / 1000);
        }

        // 5% de chance de seek (pause + saut aléatoire)
        if (Math.random() < 0.05) {
          sleep(randomIntBetween(1, 3));
          // Le prochain segment sera aléatoire (seek)
          // seg += randomIntBetween(5, 20); // décommente pour seek réaliste
        }
      }
    });
  }

  // ── 3. Incrémente vue (fire and forget, pas bloquant) ─────────────────────
  group('view_increment', () => {
    http.patch(
      `${SUPABASE_URL}/rest/v1/reels?id=eq.${reel.id}`,
      JSON.stringify({ views_count: (reel.views_count || 0) + 1 }),
      {
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        tags: { name: 'view_count' },
        timeout: '5s',
      },
    );
  });

  // ── 4. 10% de likes ───────────────────────────────────────────────────────
  if (Math.random() < 0.10) {
    group('like', () => {
      http.patch(
        `${SUPABASE_URL}/rest/v1/reels?id=eq.${reel.id}`,
        JSON.stringify({ likes_count: (reel.likes_count || 0) + 1 }),
        {
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          tags: { name: 'like' },
          timeout: '5s',
        },
      );
    });
    sleep(0.3);
  }

  // ── 5. 20% charge une deuxième page de feed (infinite scroll) ─────────────
  if (Math.random() < 0.20) {
    group('feed_page_2', () => {
      const t0  = Date.now();
      const res = http.get(
        `${SUPABASE_URL}/rest/v1/reels?status=eq.approved&select=id,video_url,title,genre,duration&limit=20&offset=20&order=created_at.desc`,
        { headers: API_HEADERS, tags: { name: 'feed_page_1' } },
      );
      apiLatency.add(Date.now() - t0);
      check(res, { 'feed p2: 200': r => r.status === 200 });
    });
  }

  sleep(randomIntBetween(2, 5)); // 2–5 s entre deux vidéos
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log(`▶ Teardown: test terminé. ${data.reels.length} reels dans le pool.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function resolveVideoUrl(raw) {
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${CDN_BASE}/${raw}`;
}
