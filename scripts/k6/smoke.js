/**
 * smoke.js — Test rapide 50 → 500 VUs (5–10 minutes)
 * Valide le "happy path" avant de lancer le test de charge complet.
 *
 * Run :
 *   k6 run --env SUPABASE_URL=https://knrzbdqfflobfjdmqyte.supabase.co \
 *          --env SUPABASE_ANON=<clé> \
 *          scripts/k6/smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const SUPABASE_URL  = __ENV.SUPABASE_URL  || 'https://knrzbdqfflobfjdmqyte.supabase.co';
const SUPABASE_ANON = __ENV.SUPABASE_ANON || '';
const CDN_BASE = `${SUPABASE_URL}/storage/v1/object/public/community-images`;

const ttff       = new Trend('ttff_ms');
const errRate    = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50  },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0   },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1% en smoke (plus permissif)
    http_req_duration: ['p(95)<5000'],  // 5 s max en smoke
    ttff_ms:           ['p(95)<3000'],
    errors:            ['rate<0.01'],
  },
};

const HEADERS = {
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Accept':        'application/json',
};

export function setup() {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/reels?status=eq.approved&select=id,video_url&limit=50`,
    { headers: HEADERS },
  );
  check(res, { 'setup OK': r => r.status === 200 });
  return { reels: res.json() || [] };
}

export default function(data) {
  const reels = data.reels;
  if (!reels.length) { sleep(1); return; }

  // Feed
  const feedRes = http.get(
    `${SUPABASE_URL}/rest/v1/reels?status=eq.approved&select=id,video_url,title&limit=20`,
    { headers: HEADERS },
  );
  const feedOk = check(feedRes, {
    'feed 200':    r => r.status === 200,
    'feed items': r => (r.json()?.length ?? 0) > 0,
  });
  errRate.add(!feedOk);

  sleep(1);

  // Segment vidéo (premier 64 KB)
  const reel = reels[Math.floor(Math.random() * reels.length)];
  const url  = reel.video_url?.startsWith('http')
    ? reel.video_url
    : `${CDN_BASE}/${reel.video_url}`;

  if (url && url !== CDN_BASE + '/') {
    const t0   = Date.now();
    const vRes = http.get(url, {
      headers: { ...HEADERS, 'Range': 'bytes=0-65535', 'Accept': 'video/mp4' },
      timeout: '10s',
      responseType: 'none',
    });
    ttff.add(Date.now() - t0);
    const segOk = check(vRes, { 'segment 206/200': r => r.status === 206 || r.status === 200 });
    errRate.add(!segOk);
  }

  sleep(2);
}
