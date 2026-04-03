from supabase import create_client, Client
from config.settings import SUPABASE_URL, SUPABASE_KEY
import logging

logger = logging.getLogger(__name__)

supabase: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Connexion Supabase établie avec succès")
    except Exception as e:
        logger.error(f"❌ Erreur lors de la connexion à Supabase: {e}")
        supabase = None
else:
    logger.warning("⚠️ Variables d'environnement SUPABASE_URL ou SUPABASE_KEY manquantes")
    supabase = None