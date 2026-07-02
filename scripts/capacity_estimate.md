# Universe App — Estimation de capacité & coûts (10 000 utilisateurs simultanés)

**Date :** 2026-07-02  
**Architecture actuelle :** Supabase Storage CDN (MP4 direct) + Supabase REST API

---

## 1. Calcul de bande passante

### Par utilisateur
| Qualité | Bitrate | Débit/viewer |
|---------|---------|--------------|
| 480p    | 800 kbps | 0.8 Mbps |
| 720p    | 1.5 Mbps | 1.5 Mbps |
| 1080p   | 3.5 Mbps | 3.5 Mbps |

**Hypothèse :** mix réaliste → moyenne pondérée **1.5 Mbps/viewer**

### À 10 000 viewers simultanés
```
Débit total    = 10 000 × 1.5 Mbps = 15 Gbps (egress CDN)
Par heure      = 15 Gbps × 3600 / 8 = 6 750 GB = 6.75 TB/h
Vidéo 25 min   = 6.75 TB × (25/60) = 2.81 TB par session complète
```

### Supabase Storage — limites & coûts CDN
| Plan | Stockage | Bande passante incluse | Coût supplément |
|------|----------|----------------------|-----------------|
| Free | 1 GB | 2 GB/mois | — |
| Pro (25$/m) | 100 GB | 200 GB/mois | $0.09/GB |
| Team (599$/m) | 200 GB | 400 GB/mois | $0.09/GB |

**Conclusion :** À 10k viewers, Supabase Storage **n'est pas dimensionné** pour ce volume de diffusion.

```
1 heure à 10k viewers = 6 750 GB supplémentaires
Coût supplémentaire   = 6 750 × $0.09 = $607.50 / heure
```

**→ Recommandation : CDN dédié (voir section 4)**

---

## 2. Calcul des requêtes API (Supabase REST)

### Requêtes par utilisateur et par seconde
| Action | Fréquence | RPS/user |
|--------|-----------|----------|
| Feed load (paged) | toutes les 30s en scroll | 0.033 |
| View increment | par vidéo (~2 min) | 0.008 |
| Like | 10% des vidéos | 0.001 |
| Gamification check | au démarrage | négligeable |

**RPS total à 10k users :**
```
Feed   : 10 000 × 0.033 = 330 RPS
Views  : 10 000 × 0.008 =  80 RPS
Likes  :                 =  10 RPS
Total  ≈ 420 RPS sur Supabase PostgREST
```

### Limites Supabase (plan Pro)
- Rate limit anon key : **3 600 req/min = 60 RPS** par défaut (configurable)
- Connection pool (PgBouncer) : 15 connexions en mode session, 200 en mode transaction

**⚠️ Problème :** 420 RPS dépasse le rate limit par défaut.

**Correctifs :**
1. Augmenter le rate limit via le dashboard Supabase → "Database → Connection Pooling"
2. Activer le mode **transaction pooling** pour optimiser les connexions
3. Ajouter un cache Redis/Upstash devant les endpoints read-heavy (feed)

---

## 3. Stockage des vidéos

### 250 vidéos × 25 minutes
| Qualité | Taille/vidéo | Total 250 vidéos |
|---------|-------------|-----------------|
| 480p  (800 kbps) | 150 MB | 37.5 GB |
| 720p  (1.5 Mbps) | 281 MB | 70.3 GB |
| 1080p (3.5 Mbps) | 656 MB | 164 GB  |

**Single quality (720p actuel) :** ~70 GB → Plan Pro Supabase suffit.

**Multi-bitrate HLS (tous formats) :** ~272 GB → au-delà du Pro, + coût encoding.

---

## 4. Architecture CDN recommandée (remplacement Supabase Storage direct)

### Option A — Cloudflare R2 + Cloudflare Stream
| Poste | Coût |
|-------|------|
| Stockage R2 : 70 GB | $0 (10 GB gratuit, puis $0.015/GB) ≈ $0.90/mois |
| Egress R2 → Cloudflare | **$0** (egress gratuit entre R2 et CDN Cloudflare) |
| Cloudflare Stream : 250 vidéos × 25 min = 6 250 min | $5 + $1/1000 min = ~$11.25 stockage |
| Livraison Stream (minutes regardées) | $1 / 1 000 min livrées |
| **Total 10k viewers × 25 min** | 10 000 × 25 = 250 000 min → **$250/session** |

**→ Cloudflare Stream** est la solution la plus simple : HLS automatique, ABR, analytics, DRM optionnel.

### Option B — Bunny.net (le plus économique)
| Poste | Coût |
|-------|------|
| Stockage | $0.01/GB/mois |
| Livraison CDN | ~$0.01/GB (EU) |
| 10k viewers × 25 min × 1.5 Mbps / 8 × 60 | ≈ 2 812 GB → **$28.12/session** |

**→ Bunny.net** est 10× moins cher que Cloudflare Stream pour la livraison pure.

### Option C — AWS CloudFront + S3
| Poste | Coût |
|-------|------|
| S3 stockage 70 GB | $1.61/mois |
| CloudFront livraison 2 812 GB | $0.085/GB EU → **$239/session** |

**Recommandation finale :**
- **Court terme (MVP/test)** → Supabase Storage (limité à quelques centaines de viewers)
- **Croissance** → Bunny.net pour le CDN vidéo ($28 par 10k sessions 25 min)
- **Scale + DRM** → Cloudflare Stream

---

## 5. Checklist d'acceptance (pass/fail)

```
✅ PASS si ALL conditions remplies :
  - TTFF p95 < 3 000 ms
  - Buffering rate < 2%
  - HTTP error rate < 0.5%
  - API latency p95 < 300 ms
  - 10 000 VUs maintenu pendant 60 minutes
  - Aucun FAIL critique dans owasp_checklist.md
  - 0 secret key exposé dans le bundle
```

---

## 6. Plan d'exécution des tests (séquence)

```
Étape 1 — Préparer (1h)
  - terraform apply -var="key_name=..." -var="supabase_anon_key=..."
  - Attendre que InfluxDB et Grafana démarrent (2–3 min)
  - Importer universe_dashboard.json dans Grafana

Étape 2 — Smoke test (10 min)
  - k6 run --env K6_SCENARIO=smoke scripts/k6/smoke.js
  - Objectif : 0 erreur, TTFF < 3s à 500 users

Étape 3 — Ramp-up + soak (2h)
  - k6 run --env K6_SCENARIO=rampup scripts/k6/universe_load_test.js
  - Observer le Grafana : VUs, latence, taux d'erreur, TTFF

Étape 4 — Stress test (30 min, optionnel)
  - k6 run --env K6_SCENARIO=stress scripts/k6/universe_load_test.js
  - Identifier le breaking point (premier 5xx ou TTFF > 5s)

Étape 5 — Audit sécurité (20 min)
  - bash scripts/security/api_audit.sh
  - Relire scripts/security/owasp_checklist.md et cocher les items

Étape 6 — Cleanup
  - terraform destroy (arrêt des EC2 pour éviter les coûts)
  - DELETE FROM reels WHERE user_id = 'mock-seed-user';

Étape 7 — Rapport
  - Exporter les métriques k6 : k6 run --out json=results.json ...
  - Extraire p50/p95/p99 : jq '.metrics.http_req_duration.values' results.json
```

---

## 7. Actions post-test selon résultats

| Symptôme | Cause probable | Correctif |
|----------|---------------|-----------|
| TTFF > 3s | CDN cache miss ou latence origin | Passer à Bunny.net/Cloudflare Stream |
| Error rate > 0.5% | Rate limiting Supabase | Augmenter le pool, activer Redis cache |
| API latency > 300ms | PostgREST saturé | Activer pgBouncer transaction mode, index sur `status` |
| Buffering > 2% | Bitrate trop haut pour le réseau du client | Implémenter ABR (HLS multi-bitrate) |
| Mémoire croissante sur agents | Fuite dans le test k6 | Réduire `windowSize` dans k6 ou diminuer segCount |
| 5xx après 8k VUs | Origin server saturé | Autoscaling Supabase ou cache layer |
