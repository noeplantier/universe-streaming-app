from supabase import create_client, Client
from config.settings import SUPABASE_URL, SUPABASE_KEY
import logging

logger = logging.getLogger(__name__)

def init_supabase() -> Client:
    """Initialise de manière paresseuse le client Supabase"""
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            client = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("✅ Connexion Supabase établie avec succès")
            return client
        except Exception as e:
            logger.error(f"❌ Erreur lors de la connexion à Supabase: {e}")
            return None
    else:
        logger.warning("⚠️ Variables d'environnement SUPABASE_URL ou SUPABASE_KEY manquantes")
        return None