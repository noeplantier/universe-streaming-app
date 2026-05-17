import logging
from typing import Optional
from supabase.client import Client

# Importez UNIQUEMENT la fonction d'initialisation, plus la variable globale
from supabase_client import init_supabase

logger = logging.getLogger(__name__)

# Cache local pour réutiliser le client
_supabase_instance: Optional[Client] = None

def get_supabase() -> Optional[Client]:
    """Retourne le client Supabase (Lazy Singleton)."""
    global _supabase_instance
    
    if _supabase_instance is None:
        _supabase_instance = init_supabase()
        
    if not _supabase_instance:
        logger.error("❌ Client Supabase non initialisé")
        
    return _supabase_instance

async def test_supabase_connection(client: Optional[Client] = None) -> bool:
    """Teste la connexion à Supabase de manière non-bloquante."""
    try:
        db_client = client or get_supabase()
        if db_client:
            response = db_client.table("users").select("id").limit(1).execute()
            logger.info("✅ Connexion Supabase testée avec succès")
            return True
        return False
    except Exception as e:
        logger.error(f"❌ Erreur test connexion: {e}")
        return False