"""
Test de stockage/diffusion — objectif 500 vidéos d'environ 25 minutes.

À EXÉCUTER UNE FOIS L'ESPACE DISQUE LIBÉRÉ, contre un environnement de
staging avec son propre bucket Supabase Storage (pas le bucket de prod).

Comme on n'a pas 500 fichiers uniques de 25 minutes sous la main, ce script
réutilise un petit pool de fichiers échantillons réels (mettre 2-3 fichiers
représentatifs, idéalement un proche de 25 min, dans SAMPLE_VIDEO_PATHS) sous
des video_id distincts — le pipeline de transcodage ne sait pas qu'il s'agit
du même contenu, donc le travail CPU/IO mesuré est réaliste ; seule la
diversité de contenu est artificielle.

── Estimation au dos de l'enveloppe (à corriger avec de vraies mesures) ──────
Hypothèse : encodage logiciel libx264, 4 renditions (360p/720p/1080p/4K) en
une seule commande ffmpeg (cf. transcoding_service.py), ~0.5-1x temps réel
par rendition sur un CPU de classe serveur modeste → pour 25 min de source :
    - temps ffmpeg par vidéo  : ~12-50 min (variable selon CPU/preset)
    - upload des segments     : quelques minutes (parallélisé depuis Phase 1,
                                 ~250 segments × 4 qualités ≈ 1000 fichiers)
Avec la flotte Celery du docker-compose (2 replicas × concurrency=2 = 4
encodages en parallèle) :
    500 vidéos ÷ 4 parallèle × (12 à 50 min) ≈ 25 à 104 heures de mur total.
→ Si ce chiffre est inacceptable, les leviers sont : plus de replicas
  transcoder, un encodeur matériel (NVENC/QuickSync/MediaConvert), ou réduire
  le nombre de renditions générées par défaut (ex: pas de 4K systématique).

Usage :
    pip install requests   # déjà dans requirements.txt
    python storage_diffusion_test.py --count 500 --concurrency 20 \\
        --base-url https://staging.universe.film \\
        --samples sample1.mp4 sample2.mp4
"""
import argparse
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path

import requests

POLL_INTERVAL_S = 15
POLL_TIMEOUT_S = 3 * 3600  # 1h soft_time_limit côté Celery + marge


@dataclass
class UploadResult:
    video_id: str
    ok: bool
    seconds: float
    final_status: str
    error: str = ""


@dataclass
class RunStats:
    results: list = field(default_factory=list)

    def summarize(self) -> str:
        ok = [r for r in self.results if r.ok]
        failed = [r for r in self.results if not r.ok]
        lines = [
            f"Total: {len(self.results)}  Réussies: {len(ok)}  Échouées: {len(failed)}",
        ]
        if ok:
            durations = [r.seconds for r in ok]
            lines.append(
                f"Durée bout-en-bout (init→ready) — "
                f"min={min(durations):.0f}s p50={statistics.median(durations):.0f}s "
                f"max={max(durations):.0f}s"
            )
        for r in failed[:10]:
            lines.append(f"  ÉCHEC {r.video_id}: {r.error}")
        return "\n".join(lines)


def _device_headers() -> dict:
    return {"X-Device-Id": str(uuid.uuid4()), "Content-Type": "application/json"}


def run_one(base_url: str, sample_path: Path, index: int) -> UploadResult:
    started = time.monotonic()
    headers = _device_headers()
    video_id = f"loadtest-{index}-{uuid.uuid4().hex[:8]}"

    try:
        init_resp = requests.post(
            f"{base_url}/api/upload/init",
            headers=headers,
            json={
                "title": f"Load test {index}",
                "description": "Généré par storage_diffusion_test.py",
                "genre": "Test",
                "duration_seconds": 1500,  # ~25 min déclarées, indépendant du fichier réel
                "filename": sample_path.name,
            },
            timeout=30,
        )
        init_resp.raise_for_status()
        body = init_resp.json()
        real_video_id = body["video_id"]
        upload_url = body["upload_url"]

        with open(sample_path, "rb") as f:
            put_resp = requests.put(upload_url, data=f, timeout=600)
        put_resp.raise_for_status()

        start_resp = requests.post(
            f"{base_url}/api/upload/{real_video_id}/start",
            headers=headers,
            json={"source_storage_path": body["upload_path"]},
            timeout=30,
        )
        start_resp.raise_for_status()

        deadline = time.monotonic() + POLL_TIMEOUT_S
        last_status = "pending_upload"
        while time.monotonic() < deadline:
            time.sleep(POLL_INTERVAL_S)
            status_resp = requests.get(
                f"{base_url}/api/upload/{real_video_id}/status", headers=headers, timeout=30
            )
            status_resp.raise_for_status()
            last_status = status_resp.json().get("status", "unknown")
            if last_status in ("ready", "failed"):
                break

        elapsed = time.monotonic() - started
        return UploadResult(real_video_id, last_status == "ready", elapsed, last_status)

    except Exception as e:  # noqa: BLE001 — on veut continuer le run même si une upload échoue
        return UploadResult(video_id, False, time.monotonic() - started, "error", str(e)[:300])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--count", type=int, default=500)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--samples", nargs="+", required=True, help="2-3 fichiers vidéo réels à réutiliser")
    args = parser.parse_args()

    samples = [Path(p) for p in args.samples]
    for p in samples:
        if not p.exists():
            print(f"Fichier introuvable: {p}", file=sys.stderr)
            sys.exit(1)

    print(f"Démarrage : {args.count} uploads simulés, concurrence={args.concurrency}, "
          f"échantillons={[p.name for p in samples]}")
    print("Estimation de durée totale : voir le docstring du script avant de lancer un run complet.\n")

    stats = RunStats()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [
            pool.submit(run_one, args.base_url, samples[i % len(samples)], i)
            for i in range(args.count)
        ]
        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            stats.results.append(result)
            status = "OK" if result.ok else "FAIL"
            print(f"[{i}/{args.count}] {result.video_id} → {status} ({result.seconds:.0f}s, {result.final_status})")

    print("\n" + stats.summarize())


if __name__ == "__main__":
    main()
