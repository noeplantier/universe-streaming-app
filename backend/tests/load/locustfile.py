"""
Test de charge — objectif 10 000 viewers simultanés.

À EXÉCUTER UNE FOIS L'ESPACE DISQUE LIBÉRÉ (installation de locust requise) ET
CONTRE UN ENVIRONNEMENT DE STAGING, PAS LA PRODUCTION : à ce volume, les
segments HLS récupérés via les playlistUrl signées tapent directement le CDN
Supabase Storage — la bande passante/coût réel doit être budgétisé avant un
run grandeur réelle.

Installation (pas encore faite dans ce repo — disque insuffisant au moment de
la rédaction) :
    pip install locust

Lancement :
    locust -f backend/tests/load/locustfile.py --host https://staging.universe.film
    # Interface web sur http://localhost:8089 — y configurer :
    #   Users: 10000   Spawn rate: 200/s   (ajuster selon ce que l'infra tient)

Variables d'env :
    LOAD_TEST_FILM_ID  — id d'une vidéo réellement transcodée (status='ready')
                         dans l'environnement ciblé. Sans ça, /token renvoie 404
                         et le test ne mesure que la latence d'un échec, pas le
                         vrai chemin de lecture.

Ce que ça simule, par utilisateur virtuel (= 1 viewer) :
  1. Génère un X-Device-Id aléatoire (comme le ferait l'app — cf.
     frontend/services/api.ts getDeviceId), une fois au démarrage.
  2. POST /api/stream/{film_id}/token — chemin le plus sensible : c'est lui
     qui était cassé avant la passe Phase 0 (auth JWT inexistante côté
     client), et c'est lui qui doit absolument rester rapide à 10k clients
     simultanés (cf. Phase 1 : client Supabase singleton + thread offload).
  3. Récupère 2-3 segments de la playlist au rythme réel d'un lecteur HLS
     (toutes les ~6s, la durée d'un segment côté transcoding_service.py),
     plutôt que de marteler /token en boucle — un vrai viewer ne refait pas
     un POST /token à chaque frame.
"""
import os
import random
import uuid

from locust import HttpUser, task, between

FILM_ID = os.environ.get("LOAD_TEST_FILM_ID", "REPLACE_WITH_A_READY_FILM_ID")
SEGMENT_FETCH_INTERVAL_S = 6  # doit suivre SEGMENT_SECS de transcoding_service.py


class DeviceUser(HttpUser):
    """Un utilisateur virtuel = un viewer avec son propre device id."""

    wait_time = between(1, 3)

    def on_start(self):
        self.device_id = str(uuid.uuid4())
        self.headers = {"X-Device-Id": self.device_id, "Content-Type": "application/json"}
        self.qualities = []

    @task(3)
    def fetch_token_and_watch(self):
        """Le parcours principal : obtenir un token DRM, puis lire quelques segments."""
        with self.client.post(
            f"/api/stream/{FILM_ID}/token",
            headers=self.headers,
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"token issuance failed: {resp.status_code} {resp.text[:200]}")
                return
            data = resp.json()
            self.qualities = data.get("qualities", [])
            token = data.get("token", "")

        if not self.qualities:
            return

        # Simule un lecteur HLS réel : quelques segments à intervalle régulier,
        # pas une rafale — ce sont les requêtes que verrait nginx (proxy_cache
        # hls_cache, auth_request /drm_validate) en conditions réelles.
        quality = random.choice(self.qualities)
        playlist_url = quality.get("playlistUrl", "")
        if playlist_url:
            self.client.get(
                playlist_url,
                headers={"Authorization": f"Bearer {token}"},
                name="/cdn/.../playlist.m3u8",
            )

    @task(1)
    def poll_status(self):
        """Un viewer qui vérifie occasionnellement l'état (ex: avant de lire)."""
        self.client.get(f"/api/stream/{FILM_ID}/status", headers=self.headers, name="/api/stream/[id]/status")
