import logging
import time
import threading
from typing import Optional, Any, Dict, Callable
from supabase.client import Client
from supabase_client import init_supabase

logger = logging.getLogger(__name__)

_supabase_instance: Optional[Client] = None

# --- SYSTÈME DE CACHE AVANCÉ (ANTI-THUNDERING HERD) ---
# Structure : { "clef": {"data": [...], "timestamp": temps, "lock": threading.Lock()} }
_cache: Dict[str, Dict[str, Any]] = {}
_global_lock = threading.Lock()
CACHE_TTL = 300  # 5 minutes

def get_supabase() -> Optional[Client]:
    """Retourne le client Supabase (Lazy Singleton)."""
    global _supabase_instance
    if _supabase_instance is None:
        _supabase_instance = init_supabase()
    if not _supabase_instance:
        logger.error("❌ Client Supabase non initialisé")
    return _supabase_instance

def fetch_with_cache(table: str, cache_key: str, ttl: int = CACHE_TTL) -> Any:
    """
    Exécute une requête 'select(*)' sur une table avec mise en cache optimisée.
    Sécurisé pour une forte charge (Threads et concurrence).
    """
    client = get_supabase()
    if not client:
        return []
        
    # On encapsule la requête dans une fonction lambda
    def fetch_data():
        response = client.table(table).select("*").execute()
        return response.data

    return get_cached_data_custom(cache_key, fetch_data, ttl)


def get_cached_data_custom(cache_key: str, fetch_function: Callable, ttl: int = CACHE_TTL) -> Any:
    """
    Cœur de l'optimisation : gère n'importe quelle requête avec verrouillage intelligent.
    """
    current_time = time.time()

    # 1. Vérification rapide (Thread-safe) sans bloquer les autres
    if cache_key in _cache:
        entry = _cache[cache_key]
        if current_time - entry['timestamp'] < ttl:
            logger.debug(f"⚡ Cache HIT immédiat pour : {cache_key}")
            return entry['data']

    # 2. On s'assure que la clé existe et possède son propre verrou
    with _global_lock:
        if cache_key not in _cache:
            _cache[cache_key] = {'data': None, 'timestamp': 0, 'lock': threading.Lock()}
        key_lock = _cache[cache_key]['lock']

    # 3. On bloque cette clé spécifique (les requêtes simultanées attendront ici)
    with key_lock:
        # Double vérification au cas où un autre thread vient de mettre à jour le cache
        current_time = time.time()
        if current_time - _cache[cache_key]['timestamp'] < ttl:
            logger.debug(f"⚡ Cache HIT bloqué pour : {cache_key}")
            return _cache[cache_key]['data']

        logger.info(f"🔄 Cache MISS, exécution de la requête : {cache_key}")
        try:
            # On exécute la fonction de requête passée en paramètre
            data = fetch_function()
            _cache[cache_key]['data'] = data
            _cache[cache_key]['timestamp'] = time.time()
            return data
        except Exception as e:
            logger.error(f"Erreur Supabase lors du cache ({cache_key}): {e}")
            # ★ Stale Cache : Si Supabase est hors ligne mais qu'on a d'anciennes données, on les retourne !
            if _cache[cache_key]['data'] is not None:
                logger.warning(f"⚠️ Renvoi des VIEILLES DONNÉES pour {cache_key} suite à l'erreur.")
                return _cache[cache_key]['data']
            return []