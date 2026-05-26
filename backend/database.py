import logging
import time
from typing import Optional, Any, Dict
from supabase.client import Client
from supabase_client import init_supabase

logger = logging.getLogger(__name__)

_supabase_instance: Optional[Client] = None

# --- SYSTÈME DE CACHE SIMPLE EN MÉMOIRE ---
_cache: Dict[str, dict] = {}
CACHE_TTL = 300  # 5 minutes de durée de vie par défaut

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
    Exécute une requête 'select(*)' sur une table avec mise en cache.
    Utile pour les données statiques (catalogues, catégories).
    """
    current_time = time.time()
    
    # Retourner les données du cache si elles sont valides
    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if current_time - timestamp < ttl:
            logger.info(f"⚡ Cache HIT pour : {cache_key}")
            return cached_data
            
    # Sinon, on requête Supabase
    client = get_supabase()
    if not client:
        return []
        
    logger.info(f"🔄 Cache MISS, requête Supabase pour : {cache_key}")
    try:
        response = client.table(table).select("*").execute()
        
        # Mettre en cache la nouvelle réponse
        _cache[cache_key] = (response.data, current_time)
        return response.data
    except Exception as e:
        logger.error(f"Erreur Supabase fetch_with_cache ({table}): {e}")
        return []