import logging
from typing import Optional
from supabase.client import Client
from supabase_client import supabase
from config.settings import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

def get_supabase() -> Optional[Client]:
    """
    Retourne le client Supabase.
    L'utilisation de l'ORM Supabase (ex: supabase.table('...').select('...').eq('...')) 
    sécurise nativement les appels contre les injections SQL.
    """
    if not supabase:
        logger.error("❌ Client Supabase non initialisé")
        return None
    return supabase

async def test_supabase_connection():
    """Teste la connexion à Supabase"""
    try:
        client = get_supabase()
        if client:
            response = client.table("users").select("*").limit(1).execute()
            logger.info("✅ Connexion Supabase testée avec succès")
            return True
    except Exception as e:
        logger.error(f"❌ Erreur test connexion: {e}")
    return False